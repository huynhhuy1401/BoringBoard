use chrono::Utc;
use uuid::Uuid;

use crate::config::query_favorites::{self, QueryFavorite};
use crate::error::AppError;

#[tauri::command]
pub async fn list_query_favorites() -> Result<Vec<QueryFavorite>, AppError> {
    query_favorites::load_favorites()
}

#[tauri::command]
pub async fn save_query_favorite(name: String, sql: String, conn_id: String) -> Result<QueryFavorite, AppError> {
    let favorite = QueryFavorite {
        id: Uuid::new_v4().to_string(),
        name,
        sql,
        created_at: Utc::now().to_rfc3339(),
        conn_id,
    };
    let mut favorites = query_favorites::load_favorites()?;
    favorites.insert(0, favorite.clone());
    query_favorites::save_favorites(&favorites)?;
    Ok(favorite)
}

#[tauri::command]
pub async fn delete_query_favorite(id: String) -> Result<(), AppError> {
    let mut favorites = query_favorites::load_favorites()?;
    favorites.retain(|f| f.id != id);
    query_favorites::save_favorites(&favorites)?;
    Ok(())
}
