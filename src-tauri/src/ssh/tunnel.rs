use std::net::{SocketAddr, TcpListener as StdTcpListener};
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use async_trait::async_trait;
use russh::client::{self, Handler};
use russh_keys::agent::client::AgentClient;
use crate::models::SshConfig;
use crate::error::AppError;

#[derive(Clone)]
struct TunnelClientHandler;

#[async_trait]
impl Handler for TunnelClientHandler {
    type Error = russh::Error;
    async fn check_server_key(
        &mut self,
        _server_public_key: &russh_keys::key::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

pub struct SshTunnel {
    pub local_port: u16,
    shutdown_tx: oneshot::Sender<()>,
}

impl SshTunnel {
    pub async fn start(
        ssh_config: &SshConfig,
        db_host: &str,
        db_port: u16,
    ) -> Result<Self, AppError> {
        // 1. Find an available local port
        let listener = StdTcpListener::bind("127.0.0.1:0")
            .map_err(|e| AppError::Ssh(format!("Failed to bind local port: {}", e)))?;
        let local_port = listener.local_addr()
            .map_err(|e| AppError::Ssh(format!("Failed to get local port: {}", e)))?
            .port();
        let listener = TcpListener::from_std(listener)
            .map_err(|e| AppError::Ssh(format!("Failed to convert TCP listener: {}", e)))?;

        // 2. Configure russh client
        let config = Arc::new(client::Config::default());
        let addr = format!("{}:{}", ssh_config.host, ssh_config.port);
        let socket_addr: SocketAddr = addr.parse().map_err(|_| {
            AppError::Ssh(format!("Invalid SSH host/port address: {}", addr))
        })?;

        // 3. Connect to SSH host
        let mut session = client::connect(config, socket_addr, TunnelClientHandler).await
            .map_err(|e| AppError::Ssh(format!("SSH connection failed: {}", e)))?;

        // 4. Authenticate
        match ssh_config.auth_method {
            crate::models::SshAuthMethod::Password => {
                let password = ssh_config.password.as_deref().unwrap_or("");
                let authenticated = session.authenticate_password(&ssh_config.username, password).await
                    .map_err(|e| AppError::Ssh(format!("SSH auth error: {}", e)))?;
                if !authenticated {
                    return Err(AppError::Ssh("SSH password authentication failed".to_string()));
                }
            }
            crate::models::SshAuthMethod::PrivateKey => {
                let key_path = ssh_config.private_key_path.as_ref().ok_or_else(|| {
                    AppError::Ssh("Private key path is required for private-key auth".to_string())
                })?;
                
                let keypair = russh_keys::load_secret_key(
                    key_path,
                    ssh_config.passphrase.as_deref()
                ).map_err(|e| AppError::Ssh(format!("Failed to parse private key: {}", e)))?;

                let authenticated = session.authenticate_publickey(&ssh_config.username, Arc::new(keypair)).await
                    .map_err(|e| AppError::Ssh(format!("SSH key auth error: {}", e)))?;
                if !authenticated {
                    return Err(AppError::Ssh("SSH private key authentication failed".to_string()));
                }
            }
            crate::models::SshAuthMethod::Agent => {
                // Connect to the running SSH agent via SSH_AUTH_SOCK
                let mut agent = AgentClient::connect_env().await
                    .map_err(|e| AppError::Ssh(format!("Failed to connect to SSH agent: {}. Is SSH_AUTH_SOCK set?", e)))?;

                let identities = agent.request_identities().await
                    .map_err(|e| AppError::Ssh(format!("Failed to list SSH agent keys: {}", e)))?;

                if identities.is_empty() {
                    return Err(AppError::Ssh("SSH Agent authentication failed: no keys found in agent. Try running 'ssh-add' to add a key.".to_string()));
                }

                let mut authenticated = false;
                let mut last_error: Option<String> = None;

                for key in identities {
                    let (returned_agent, result) = session.authenticate_future(
                        &ssh_config.username,
                        key,
                        agent,
                    ).await;
                    agent = returned_agent;

                    match result {
                        Ok(true) => {
                            authenticated = true;
                            break;
                        }
                        Ok(false) => continue,
                        Err(e) => {
                            last_error = Some(e.to_string());
                            continue;
                        }
                    }
                }

                if !authenticated {
                    let msg = if let Some(e) = last_error {
                        format!("SSH Agent authentication failed: {}", e)
                    } else {
                        "SSH Agent authentication failed: no valid keys accepted by server".to_string()
                    };
                    return Err(AppError::Ssh(msg));
                }
            }
        }

        // 5. Start port forwarding loop in background
        let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();
        let target_host = db_host.to_string();
        let target_port = db_port;
        let session = Arc::new(tokio::sync::Mutex::new(session));

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = &mut shutdown_rx => {
                        break;
                    }
                    res = listener.accept() => {
                        if let Ok((client_stream, _)) = res {
                            let session_clone = Arc::clone(&session);
                            let target_host = target_host.clone();
                            let target_port = target_port;
                            tokio::spawn(async move {
                                let session_guard = session_clone.lock().await;
                                let channel_res = session_guard.channel_open_direct_tcpip(
                                    &target_host,
                                    target_port as u32,
                                    "127.0.0.1",
                                    local_port as u32,
                                ).await;
                                drop(session_guard);

                                if let Ok(channel) = channel_res {
                                    let stream = channel.into_stream();
                                    let (mut c_read, mut c_write) = tokio::io::split(client_stream);
                                    let (mut s_read, mut s_write) = tokio::io::split(stream);
                                    
                                    let _ = tokio::join!(
                                        tokio::io::copy(&mut c_read, &mut s_write),
                                        tokio::io::copy(&mut s_read, &mut c_write)
                                    );
                                }
                            });
                        }
                    }
                }
            }
        });

        Ok(Self {
            local_port,
            shutdown_tx,
        })
    }

    pub fn stop(self) {
        let _ = self.shutdown_tx.send(());
    }
}
