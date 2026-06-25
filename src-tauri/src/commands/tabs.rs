use crate::config::tab_state::{self, SavedTab};
use crate::error::AppError;

#[tauri::command]
pub async fn save_tab_state(tabs: Vec<SavedTab>) -> Result<(), AppError> {
    tab_state::save_tab_state(tabs)
}

#[tauri::command]
pub async fn load_tab_state() -> Result<Vec<SavedTab>, AppError> {
    tab_state::load_tab_state()
}
