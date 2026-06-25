use crate::models::{ConnectionConfig, SslMode};
use crate::error::AppError;
use uuid::Uuid;

pub fn parse_connection_url(url: &str) -> Result<ConnectionConfig, AppError> {
    let trimmed = url.trim();
    let remaining = if let Some(stripped) = trimmed.strip_prefix("postgresql://") {
        stripped
    } else if let Some(stripped) = trimmed.strip_prefix("postgres://") {
        stripped
    } else {
        return Err(AppError::Config("Invalid connection URL: must start with postgresql:// or postgres://".to_string()));
    };

    // 1. Split userinfo from hostinfo
    let (userinfo, hostinfo) = if let Some(idx) = remaining.rfind('@') {
        let (u, h) = remaining.split_at(idx);
        (Some(u), &h[1..]) // skip '@'
    } else {
        (None, remaining)
    };

    // 2. Parse userinfo -> username, password
    let mut username = "postgres".to_string();
    let mut password = None;
    if let Some(ui) = userinfo {
        if let Some(idx) = ui.find(':') {
            let (u, p) = ui.split_at(idx);
            username = url_decode(u);
            password = Some(url_decode(&p[1..])); // skip ':'
        } else {
            username = url_decode(ui);
        }
    }

    // 3. Split query string from host_db
    let (host_db, query_str) = if let Some(idx) = hostinfo.find('?') {
        let (h, q) = hostinfo.split_at(idx);
        (h, Some(&q[1..])) // skip '?'
    } else {
        (hostinfo, None)
    };

    // 4. Split host_port from database
    let (host_port, database) = if let Some(idx) = host_db.find('/') {
        let (hp, db) = host_db.split_at(idx);
        (hp, url_decode(&db[1..])) // skip '/'
    } else {
        (host_db, "".to_string())
    };

    let database = if database.is_empty() {
        "postgres".to_string()
    } else {
        database
    };

    // 5. Parse host and port (handle IPv6)
    let mut host = host_port.to_string();
    let mut port = 5432;
    if let Some(idx) = host_port.rfind(':') {
        // check if it's port, not part of IPv6 like [::1]
        let (h_part, p_part) = host_port.split_at(idx);
        let p_val = &p_part[1..];
        if let Ok(p) = p_val.parse::<u16>() {
            host = h_part.to_string();
            // Strip brackets for IPv6 if they exist and we stripped the port
            if host.starts_with('[') && host.ends_with(']') {
                host = host[1..host.len() - 1].to_string();
            }
            port = p;
        } else {
            // It could be IPv6 with no port e.g. [::1]
            if host.starts_with('[') && host.ends_with(']') {
                host = host[1..host.len() - 1].to_string();
            }
        }
    } else {
        if host.starts_with('[') && host.ends_with(']') {
            host = host[1..host.len() - 1].to_string();
        }
    }

    // If host is empty (e.g. postgresql:///dbname), default to localhost
    if host.is_empty() {
        host = "localhost".to_string();
    }

    // 6. Parse SSL Mode and other query params
    let mut ssl_mode = SslMode::Disable;
    if let Some(q) = query_str {
        for pair in q.split('&') {
            let mut parts = pair.splitn(2, '=');
            if let Some(key) = parts.next() {
                let val = parts.next().unwrap_or("");
                if key == "sslmode" {
                    ssl_mode = match val {
                        "disable" => SslMode::Disable,
                        "require" => SslMode::Require,
                        "verify-ca" => SslMode::VerifyCa,
                        "verify-full" => SslMode::VerifyFull,
                        _ => SslMode::Disable,
                    };
                }
            }
        }
    }

    // Generate a profile name based on username, host, and database
    let profile_name = format!("{}@{}/{}", username, host, database);

    Ok(ConnectionConfig {
        id: Uuid::new_v4().to_string(),
        name: profile_name,
        color_tag: None,
        group: None,
        host,
        port,
        database,
        username,
        password,
        save_password: true,
        ssl_mode,
        client_cert_path: None,
        client_key_path: None,
        ca_cert_path: None,
        ssh_enabled: false,
        ssh_config: None,
    })
}

fn url_decode(s: &str) -> String {
    let mut bytes = Vec::with_capacity(s.len());
    let mut chars = s.as_bytes().iter().copied();
    while let Some(b) = chars.next() {
        if b == b'%' {
            let mut hex = Vec::new();
            if let Some(h1) = chars.next() { hex.push(h1); }
            if let Some(h2) = chars.next() { hex.push(h2); }
            if hex.len() == 2 {
                if let Ok(hex_str) = std::str::from_utf8(&hex) {
                    if let Ok(val) = u8::from_str_radix(hex_str, 16) {
                        bytes.push(val);
                        continue;
                    }
                }
            }
            bytes.push(b'%');
            bytes.extend(hex);
        } else if b == b'+' {
            bytes.push(b' ');
        } else {
            bytes.push(b);
        }
    }
    String::from_utf8_lossy(&bytes).into_owned()
}
