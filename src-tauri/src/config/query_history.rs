use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use crate::error::AppError;

const HISTORY_FILE: &str = "query_history.json";
const MAX_ENTRIES: usize = 500;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueryHistoryEntry {
    pub id: String,
    pub sql: String,
    pub executed_at: String,
    pub execution_time_ms: u64,
    pub conn_id: String,
}

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

fn get_history_path() -> Result<PathBuf, AppError> {
    let mut path = get_config_dir()?;
    path.push(HISTORY_FILE);
    Ok(path)
}

pub fn add_to_history(entry: QueryHistoryEntry) -> Result<(), AppError> {
    let mut entries = load_history(None)?;
    entries.insert(0, entry);
    // Keep only the latest MAX_ENTRIES
    if entries.len() > MAX_ENTRIES {
        entries.truncate(MAX_ENTRIES);
    }
    let path = get_history_path()?;
    let json = serde_json::to_string_pretty(&entries)?;
    let mut file = File::create(path)?;
    file.write_all(json.as_bytes())?;
    Ok(())
}

pub fn load_history(search: Option<&str>) -> Result<Vec<QueryHistoryEntry>, AppError> {
    let path = get_history_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path)?;
    if content.trim().is_empty() {
        return Ok(Vec::new());
    }
    let entries: Vec<QueryHistoryEntry> = serde_json::from_str(&content)?;
    if let Some(s) = search {
        let lower = s.to_lowercase();
        Ok(entries.into_iter().filter(|e| e.sql.to_lowercase().contains(&lower)).collect())
    } else {
        Ok(entries)
    }
}

pub fn clear_history() -> Result<(), AppError> {
    let path = get_history_path()?;
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}
