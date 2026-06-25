use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use crate::error::AppError;

const FAVORITES_FILE: &str = "query_favorites.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueryFavorite {
    pub id: String,
    pub name: String,
    pub sql: String,
    pub created_at: String,
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

fn get_favorites_path() -> Result<PathBuf, AppError> {
    let mut path = get_config_dir()?;
    path.push(FAVORITES_FILE);
    Ok(path)
}

pub fn load_favorites() -> Result<Vec<QueryFavorite>, AppError> {
    let path = get_favorites_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path)?;
    if content.trim().is_empty() {
        return Ok(Vec::new());
    }
    let entries: Vec<QueryFavorite> = serde_json::from_str(&content)?;
    Ok(entries)
}

pub fn save_favorites(favorites: &[QueryFavorite]) -> Result<(), AppError> {
    let path = get_favorites_path()?;
    let json = serde_json::to_string_pretty(favorites)?;
    let mut file = File::create(path)?;
    file.write_all(json.as_bytes())?;
    Ok(())
}
