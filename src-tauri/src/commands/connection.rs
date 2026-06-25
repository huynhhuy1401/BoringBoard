use tauri::State;
use crate::models::ConnectionConfig;
use crate::config;
use crate::db::PoolManager;
use crate::error::AppError;
use crate::AppState;

#[tauri::command]
pub async fn list_saved_connections() -> Result<Vec<ConnectionConfig>, AppError> {
    config::list_connections()
}

#[tauri::command]
pub async fn save_connection(config: ConnectionConfig) -> Result<(), AppError> {
    config::save_connection(config)
}

#[tauri::command]
pub async fn delete_connection(id: String) -> Result<(), AppError> {
    config::delete_connection(&id)
}

#[tauri::command]
pub async fn test_connection(mut config: ConnectionConfig) -> Result<bool, AppError> {
    // If password is not provided in UI, check keychain
    if config.password.is_none() {
        config.password = config::get_connection_password(&config.id);
    }
    PoolManager::test_connection(&config, config.password.clone()).await
}

#[tauri::command]
pub async fn create_connection(
    mut config: ConnectionConfig,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    if config.password.is_none() {
        config.password = config::get_connection_password(&config.id);
    }
    
    let mut pool_manager = state.pool_manager.lock().await;
    pool_manager.get_or_create(&config, config.password.clone()).await?;
    
    Ok(config.id)
}

#[tauri::command]
pub async fn disconnect(
    connection_id: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let mut pool_manager = state.pool_manager.lock().await;
    pool_manager.disconnect(&connection_id).await
}

#[tauri::command]
pub async fn parse_connection_url(url: String) -> Result<ConnectionConfig, AppError> {
    config::parse_connection_url(&url)
}

#[tauri::command]
pub async fn get_connection_password(id: String) -> Result<Option<String>, AppError> {
    Ok(config::get_connection_password(&id))
}
