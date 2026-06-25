use crate::config::{self, AppSettings};
use crate::error::AppError;

#[tauri::command]
pub async fn get_settings() -> Result<AppSettings, AppError> {
    config::get_settings()
}

#[tauri::command]
pub async fn save_settings(settings: AppSettings) -> Result<(), AppError> {
    config::save_settings(settings)
}
