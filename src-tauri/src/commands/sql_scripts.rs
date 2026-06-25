use crate::config::sql_scripts::{self, SqlScript};
use crate::error::AppError;

#[tauri::command]
pub async fn list_sql_scripts() -> Result<Vec<SqlScript>, AppError> {
    sql_scripts::list_scripts()
}

#[tauri::command]
pub async fn save_sql_script(name: String, sql: String) -> Result<SqlScript, AppError> {
    sql_scripts::save_script(&name, &sql)
}

#[tauri::command]
pub async fn load_sql_script(path: String) -> Result<SqlScript, AppError> {
    sql_scripts::load_script(&path)
}

#[tauri::command]
pub async fn delete_sql_script(path: String) -> Result<(), AppError> {
    sql_scripts::delete_script(&path)
}

#[tauri::command]
pub async fn rename_sql_script(old_path: String, new_name: String) -> Result<SqlScript, AppError> {
    sql_scripts::rename_script(&old_path, &new_name)
}
