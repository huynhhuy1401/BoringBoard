use crate::config::query_history::{self, QueryHistoryEntry};
use crate::error::AppError;

#[tauri::command]
pub async fn get_query_history(search: Option<String>) -> Result<Vec<QueryHistoryEntry>, AppError> {
    query_history::load_history(search.as_deref())
}

#[tauri::command]
pub async fn clear_query_history() -> Result<(), AppError> {
    query_history::clear_history()
}
