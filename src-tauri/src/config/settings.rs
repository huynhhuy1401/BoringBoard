use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use crate::error::AppError;

const SETTINGS_FILE: &str = "settings.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub theme: String, // "dark" | "light" | "system"
    pub editor_font_size: u32,
    pub editor_word_wrap: bool,
    pub auto_refresh_monitoring: bool,
    pub monitoring_interval_seconds: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "light".to_string(),
            editor_font_size: 14,
            editor_word_wrap: false,
            auto_refresh_monitoring: true,
            monitoring_interval_seconds: 10,
        }
    }
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

fn get_settings_path() -> Result<PathBuf, AppError> {
    let mut path = get_config_dir()?;
    path.push(SETTINGS_FILE);
    Ok(path)
}

pub fn save_settings(settings: AppSettings) -> Result<(), AppError> {
    let path = get_settings_path()?;
    let json = serde_json::to_string_pretty(&settings)?;
    let mut file = File::create(path)?;
    file.write_all(json.as_bytes())?;
    Ok(())
}

pub fn get_settings() -> Result<AppSettings, AppError> {
    let path = get_settings_path()?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let content = fs::read_to_string(path)?;
    if content.trim().is_empty() {
        return Ok(AppSettings::default());
    }
    let settings: AppSettings = serde_json::from_str(&content)?;
    Ok(settings)
}
