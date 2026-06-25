use std::collections::HashMap;
use sqlx::postgres::{PgConnectOptions, PgSslMode, PgPoolOptions};
use crate::models::{ConnectionConfig, SslMode};
use crate::error::AppError;
use crate::ssh::SshTunnel;

pub struct DbConnection {
    pub pool: sqlx::PgPool,
    pub ssh_tunnel: Option<SshTunnel>,
}

#[derive(Default)]
pub struct PoolManager {
    pub connections: HashMap<String, DbConnection>,
    pub active_pids: HashMap<String, u32>,
}

impl PoolManager {
    pub fn new() -> Self {
        Self {
            connections: HashMap::new(),
            active_pids: HashMap::new(),
        }
    }

    pub fn set_active_pid(&mut self, conn_id: &str, pid: u32) {
        self.active_pids.insert(conn_id.to_string(), pid);
    }

    pub fn take_active_pid(&mut self, conn_id: &str) -> Option<u32> {
        self.active_pids.remove(conn_id)
    }

    pub fn clear_active_pid(&mut self, conn_id: &str) {
        self.active_pids.remove(conn_id);
    }

    pub async fn get_or_create(
        &mut self,
        config: &ConnectionConfig,
        password: Option<String>,
    ) -> Result<sqlx::PgPool, AppError> {
        if let Some(conn) = self.connections.get(&config.id) {
            return Ok(conn.pool.clone());
        }
        
        let (pool, ssh_tunnel) = Self::create_pool(config, password).await?;
        let cloned_pool = pool.clone();
        
        self.connections.insert(config.id.clone(), DbConnection {
            pool,
            ssh_tunnel,
        });
        
        Ok(cloned_pool)
    }
    
    pub async fn get_pool(&self, id: &str) -> Result<sqlx::PgPool, AppError> {
        if let Some(conn) = self.connections.get(id) {
            Ok(conn.pool.clone())
        } else {
            Err(AppError::Database("Not connected. Please connect to the database first.".to_string()))
        }
    }
    
    pub async fn disconnect(&mut self, id: &str) -> Result<(), AppError> {
        self.active_pids.remove(id);
        if let Some(conn) = self.connections.remove(id) {
            conn.pool.close().await;
            if let Some(tunnel) = conn.ssh_tunnel {
                tunnel.stop();
            }
        }
        Ok(())
    }

    pub async fn test_connection(
        config: &ConnectionConfig,
        password: Option<String>,
    ) -> Result<bool, AppError> {
        let (pool, ssh_tunnel) = Self::create_pool(config, password).await?;
        
        // Execute SELECT 1 to verify database responsiveness
        let result = sqlx::query("SELECT 1")
            .execute(&pool)
            .await;
            
        pool.close().await;
        if let Some(tunnel) = ssh_tunnel {
            tunnel.stop();
        }
        
        match result {
            Ok(_) => Ok(true),
            Err(e) => Err(AppError::Database(format!("Ping failed: {}", e))),
        }
    }

    async fn create_pool(
        config: &ConnectionConfig,
        password: Option<String>,
    ) -> Result<(sqlx::PgPool, Option<SshTunnel>), AppError> {
        let mut ssh_tunnel = None;
        let (host, port) = if config.ssh_enabled {
            if let Some(ref ssh_cfg) = config.ssh_config {
                let tunnel = SshTunnel::start(ssh_cfg, &config.host, config.port).await?;
                let local_port = tunnel.local_port;
                ssh_tunnel = Some(tunnel);
                ("127.0.0.1".to_string(), local_port)
            } else {
                return Err(AppError::Ssh("SSH is enabled but SSH config is missing".to_string()));
            }
        } else {
            (config.host.clone(), config.port)
        };
        
        let mut connect_options = if host.starts_with('/') || host.starts_with('.') {
            PgConnectOptions::new()
                .socket(host)
                .username(&config.username)
                .database(&config.database)
        } else {
            PgConnectOptions::new()
                .host(&host)
                .port(port)
                .username(&config.username)
                .database(&config.database)
        };
        
        if let Some(ref pwd) = password {
            connect_options = connect_options.password(pwd);
        }
        
        let pg_ssl_mode = match config.ssl_mode {
            SslMode::Disable => PgSslMode::Disable,
            SslMode::Require => PgSslMode::Require,
            SslMode::VerifyCa => PgSslMode::VerifyCa,
            SslMode::VerifyFull => PgSslMode::VerifyFull,
        };
        
        connect_options = connect_options.ssl_mode(pg_ssl_mode);
        
        if let Some(ref ca_cert_path) = config.ca_cert_path {
            connect_options = connect_options.ssl_root_cert(ca_cert_path);
        }
        if let Some(ref client_cert_path) = config.client_cert_path {
            connect_options = connect_options.ssl_client_cert(client_cert_path);
        }
        if let Some(ref client_key_path) = config.client_key_path {
            connect_options = connect_options.ssl_client_key(client_key_path);
        }
        
        // Wrap connection in a timeout so unreachable hosts fail fast
        let pool = tokio::time::timeout(
            std::time::Duration::from_secs(10),
            PgPoolOptions::new()
                .max_connections(5)
                .acquire_timeout(std::time::Duration::from_secs(5))
                .connect_with(connect_options),
        )
        .await
        .map_err(|_| {
            if let Some(tunnel) = ssh_tunnel.take() {
                tunnel.stop();
            }
            AppError::Database("Connection timed out after 10s. Check that the host and port are correct and the database is running.".to_string())
        })?
        .map_err(|e| {
            if let Some(tunnel) = ssh_tunnel.take() {
                tunnel.stop();
            }
            let msg = e.to_string();
            // Give a friendlier message for common errors
            if msg.contains("Connection refused") || msg.contains("connection refused") {
                AppError::Database(format!("Connection refused — is PostgreSQL running on {}:{}?", config.host, config.port))
            } else if msg.contains("timeout") || msg.contains("timed out") {
                AppError::Database(format!("Connection timed out connecting to {}:{}. Check firewall settings.", config.host, config.port))
            } else if msg.contains("password authentication failed") {
                AppError::Database("Authentication failed — incorrect username or password.".to_string())
            } else if msg.contains("database") && msg.contains("does not exist") {
                AppError::Database(format!("Database \"{}\" does not exist.", config.database))
            } else {
                AppError::Database(format!("Failed to connect: {}", msg))
            }
        })?;
            
        Ok((pool, ssh_tunnel))
    }
}
