use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use crate::error::AppError;

const TAB_STATE_FILE: &str = "tab_state.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedTab {
    pub id: String,
    pub tab_type: String,
    pub title: String,
    pub sql: Option<String>,
    pub schema: Option<String>,
    pub table_name: Option<String>,
    pub script_path: Option<String>,
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

fn get_tab_state_path() -> Result<PathBuf, AppError> {
    let mut path = get_config_dir()?;
    path.push(TAB_STATE_FILE);
    Ok(path)
}

pub fn save_tab_state(tabs: Vec<SavedTab>) -> Result<(), AppError> {
    let path = get_tab_state_path()?;
    let json = serde_json::to_string_pretty(&tabs)?;
    let mut file = File::create(path)?;
    file.write_all(json.as_bytes())?;
    Ok(())
}

pub fn load_tab_state() -> Result<Vec<SavedTab>, AppError> {
    let path = get_tab_state_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path)?;
    if content.trim().is_empty() {
        return Ok(Vec::new());
    }
    let tabs: Vec<SavedTab> = serde_json::from_str(&content)?;
    Ok(tabs)
}
