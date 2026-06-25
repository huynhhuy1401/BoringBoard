use tauri::State;
use crate::models::{QueryResult, ExplainResult};
use crate::db::query;
use crate::config::query_history::{self, QueryHistoryEntry};
use crate::error::AppError;
use crate::AppState;

#[tauri::command]
pub async fn execute_query(
    conn_id: String,
    sql: String,
    schema: Option<String>,
    state: State<'_, AppState>,
) -> Result<QueryResult, AppError> {
    // Acquire a dedicated connection so we can track its backend PID for cancellation
    let (mut conn, pid) = {
        let pm = state.pool_manager.lock().await;
        let pool = pm.get_pool(&conn_id).await?;
        let mut conn = pool.acquire().await.map_err(|e| AppError::Database(e.to_string()))?;
        let pid: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
            .fetch_one(&mut *conn)
            .await
            .map_err(|e| AppError::Database(format!("Failed to get backend PID: {}", e)))?;
        (conn, pid as u32)
    };

    // Store PID for cancellation
    {
        let mut pm = state.pool_manager.lock().await;
        pm.set_active_pid(&conn_id, pid);
    }

    // Set search_path if schema is provided
    if let Some(ref schema_name) = schema {
        let search_path_sql = format!(
            "SET LOCAL search_path TO {}, public",
            quote_ident(schema_name)
        );
        let _ = sqlx::query(&search_path_sql).execute(&mut *conn).await;
    }

    // Run the query on the tracked connection
    let result = query::execute_query(&mut conn, &sql).await;

    // Clear PID regardless of outcome
    {
        let mut pm = state.pool_manager.lock().await;
        pm.clear_active_pid(&conn_id);
    }

    // Save to query history on success
    if let Ok(ref qr) = result {
        let _ = query_history::add_to_history(QueryHistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            sql: sql.clone(),
            executed_at: chrono::Utc::now().to_rfc3339(),
            execution_time_ms: qr.execution_time_ms,
            conn_id: conn_id.clone(),
        });
    }

    result
}

#[tauri::command]
pub async fn explain_query(
    conn_id: String,
    sql: String,
    schema: Option<String>,
    state: State<'_, AppState>,
) -> Result<ExplainResult, AppError> {
    // Acquire a dedicated connection so we can track its backend PID for cancellation
    let (mut conn, pid) = {
        let pm = state.pool_manager.lock().await;
        let pool = pm.get_pool(&conn_id).await?;
        let mut conn = pool.acquire().await.map_err(|e| AppError::Database(e.to_string()))?;
        let pid: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
            .fetch_one(&mut *conn)
            .await
            .map_err(|e| AppError::Database(format!("Failed to get backend PID: {}", e)))?;
        (conn, pid as u32)
    };

    // Store PID for cancellation
    {
        let mut pm = state.pool_manager.lock().await;
        pm.set_active_pid(&conn_id, pid);
    }

    // Set search_path if schema is provided
    if let Some(ref schema_name) = schema {
        let search_path_sql = format!(
            "SET LOCAL search_path TO {}, public",
            quote_ident(schema_name)
        );
        let _ = sqlx::query(&search_path_sql).execute(&mut *conn).await;
    }

    // Run the explain on the tracked connection
    let result = query::explain_query(&mut conn, &sql).await;

    // Clear PID regardless of outcome
    {
        let mut pm = state.pool_manager.lock().await;
        pm.clear_active_pid(&conn_id);
    }

    result
}

fn quote_ident(name: &str) -> String {
    if name.contains('"') || name.chars().any(|c| c.is_uppercase()) || name.contains(' ') {
        format!("\"{}\"", name)
    } else {
        name.to_string()
    }
}

#[tauri::command]
pub async fn cancel_query(
    conn_id: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pid = {
        let mut pm = state.pool_manager.lock().await;
        pm.take_active_pid(&conn_id)
    };

    if let Some(pid) = pid {
        // Use a fresh connection from the pool to send the cancel
        let pool = {
            let pm = state.pool_manager.lock().await;
            pm.get_pool(&conn_id).await?
        };
        sqlx::query("SELECT pg_cancel_backend($1)")
            .bind(pid as i32)
            .execute(&pool)
            .await
            .map_err(|e| AppError::Database(format!("Failed to cancel query: {}", e)))?;
    }
    // Silently succeed if no active PID (query already finished or not started)

    Ok(())
}
