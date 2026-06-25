use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::collections::HashMap;
use crate::models::ConnectionConfig;
use crate::error::AppError;
use keyring::Entry;

const SERVICE_NAME: &str = "boringboard";
const CONNECTIONS_FILE: &str = "connections.json";
const PASSWORDS_FILE: &str = ".passwords.json";

fn get_config_dir() -> Result<PathBuf, AppError> {
    let mut path = dirs::config_dir().ok_or_else(|| {
        AppError::Config("Could not find configuration directory".to_string())
    })?;
    path.push("boringboard");
    if !path.exists() {
        fs::create_dir_all(&path)?;
    }
    Ok(path)
}

fn get_connections_path() -> Result<PathBuf, AppError> {
    let mut path = get_config_dir()?;
    path.push(CONNECTIONS_FILE);
    Ok(path)
}

fn get_passwords_path() -> Result<PathBuf, AppError> {
    let mut path = get_config_dir()?;
    path.push(PASSWORDS_FILE);
    Ok(path)
}

fn get_fallback_password(id: &str) -> Option<String> {
    let path = get_passwords_path().ok()?;
    if !path.exists() {
        return None;
    }
    let content = fs::read_to_string(path).ok()?;
    let passwords: HashMap<String, String> = serde_json::from_str(&content).ok()?;
    passwords.get(id).cloned()
}

fn save_fallback_password(id: &str, password: &str) -> Result<(), AppError> {
    let path = get_passwords_path()?;
    let mut passwords: HashMap<String, String> = if path.exists() {
        let content = fs::read_to_string(&path)?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        HashMap::new()
    };
    passwords.insert(id.to_string(), password.to_string());
    let json = serde_json::to_string_pretty(&passwords)?;
    let mut file = File::create(path)?;
    file.write_all(json.as_bytes())?;
    Ok(())
}

fn delete_fallback_password(id: &str) -> Result<(), AppError> {
    let path = get_passwords_path()?;
    if !path.exists() {
        return Ok(());
    }
    let content = fs::read_to_string(&path)?;
    let mut passwords: HashMap<String, String> = serde_json::from_str(&content).unwrap_or_default();
    if passwords.remove(id).is_some() {
        let json = serde_json::to_string_pretty(&passwords)?;
        let mut file = File::create(path)?;
        file.write_all(json.as_bytes())?;
    }
    Ok(())
}

pub fn save_connection(mut config: ConnectionConfig) -> Result<(), AppError> {
    // 1. If save_password is true, save to keyring if password is provided
    if config.save_password {
        if let Some(ref password) = config.password {
            println!("[Keyring] Attempting to save password for conn_{}", config.id);
            match Entry::new(SERVICE_NAME, &format!("bb_conn_{}", config.id)) {
                Ok(entry) => {
                    if let Err(e) = entry.set_password(password) {
                        println!("[Keyring] Failed to set password for conn_{}: {:?}", config.id, e);
                    } else {
                        println!("[Keyring] Successfully saved password for conn_{}", config.id);
                    }
                }
                Err(e) => {
                    println!("[Keyring] Failed to obtain entry for conn_{}: {:?}", config.id, e);
                }
            }
            // Always save to fallback file for robust dev/unsigned compatibility
            let _ = save_fallback_password(&config.id, password);
        }
    } else {
        // If save_password is false, delete any existing credential from keyring and fallback
        if let Ok(entry) = Entry::new(SERVICE_NAME, &format!("bb_conn_{}", config.id)) {
            let _ = entry.delete_credential();
        }
        let _ = delete_fallback_password(&config.id);
    }
    
    // We do NOT write password to JSON file.
    config.password = None;
    
    // 2. Read existing connections
    let mut connections = list_connections().unwrap_or_default();
    
    // 3. Update or Insert
    if let Some(pos) = connections.iter().position(|c| c.id == config.id) {
        connections[pos] = config;
    } else {
        connections.push(config);
    }
    
    // 4. Write back to file
    let path = get_connections_path()?;
    let json = serde_json::to_string_pretty(&connections)?;
    let mut file = File::create(path)?;
    file.write_all(json.as_bytes())?;
    
    Ok(())
}

pub fn delete_connection(id: &str) -> Result<(), AppError> {
    // 1. Delete password from keyring if exists (ignore error if not found)
    if let Ok(entry) = Entry::new(SERVICE_NAME, &format!("bb_conn_{}", id)) {
        let _ = entry.delete_credential();
    }
    let _ = delete_fallback_password(id);
    
    // 2. Read existing, remove, and write back
    let mut connections = list_connections()?;
    connections.retain(|c| c.id != id);
    
    let path = get_connections_path()?;
    let json = serde_json::to_string_pretty(&connections)?;
    let mut file = File::create(path)?;
    file.write_all(json.as_bytes())?;
    
    Ok(())
}

pub fn list_connections() -> Result<Vec<ConnectionConfig>, AppError> {
    let path = get_connections_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path)?;
    if content.trim().is_empty() {
        return Ok(Vec::new());
    }
    let connections: Vec<ConnectionConfig> = serde_json::from_str(&content)?;
    Ok(connections)
}

pub fn get_connection_password(id: &str) -> Option<String> {
    println!("[Keyring] Attempting to retrieve password for conn_{}", id);
    let mut password = None;
    match Entry::new(SERVICE_NAME, &format!("bb_conn_{}", id)) {
        Ok(entry) => {
            match entry.get_password() {
                Ok(p) => {
                    println!("[Keyring] Successfully retrieved password for conn_{}", id);
                    password = Some(p);
                }
                Err(e) => {
                    println!("[Keyring] Failed to get password for conn_{}: {:?}", id, e);
                }
            }
        }
        Err(e) => {
            println!("[Keyring] Failed to obtain entry for conn_{} when getting: {:?}", id, e);
        }
    }
    
    if password.is_none() {
        println!("[Keyring fallback] Attempting to retrieve password from file for conn_{}", id);
        password = get_fallback_password(id);
        if password.is_some() {
            println!("[Keyring fallback] Successfully retrieved password from file for conn_{}", id);
        } else {
            println!("[Keyring fallback] No password found in fallback file for conn_{}", id);
        }
    }
    
    password
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keyring_access() {
        let id = "test_conn_id_123";
        let entry = Entry::new(SERVICE_NAME, &format!("bb_conn_{}", id));
        println!("Entry creation result: {:?}", entry);
        if let Ok(ref ent) = entry {
            let set_res = ent.set_password("my_test_password");
            println!("Set password result: {:?}", set_res);
            let get_res = ent.get_password();
            println!("Get password result: {:?}", get_res);
            let del_res = ent.delete_credential();
            println!("Delete credential result: {:?}", del_res);
        }
    }
}
