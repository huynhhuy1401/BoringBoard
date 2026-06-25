use tauri::State;
use serde_json::{json, Value};
use crate::db::query;
use crate::error::AppError;
use crate::models::QueryResult;
use crate::AppState;

#[tauri::command]
pub async fn get_server_info(
    conn_id: String,
    state: State<'_, AppState>,
) -> Result<Value, AppError> {
    let pool = {
        let pm = state.pool_manager.lock().await;
        pm.get_pool(&conn_id).await?
    };

    let row: (String, String, String, Option<String>, Option<i32>) = sqlx::query_as(
        "SELECT version() as version, current_database() as database, current_user as \"user\", inet_server_addr()::text as server_addr, inet_server_port() as server_port"
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| AppError::Database(e.to_string()))?;

    let server_version: String = sqlx::query_scalar("SHOW server_version")
        .fetch_one(&pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let size_row: (i64, String) = sqlx::query_as(
        "SELECT pg_database_size(current_database()) as db_size, pg_size_pretty(pg_database_size(current_database())) as db_size_pretty"
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(json!({
        "version": row.0,
        "database": row.1,
        "user": row.2,
        "server_addr": row.3,
        "server_port": row.4,
        "server_version": server_version,
        "db_size": size_row.0,
        "db_size_pretty": size_row.1,
    }))
}

#[tauri::command]
pub async fn get_active_queries(
    conn_id: String,
    state: State<'_, AppState>,
) -> Result<QueryResult, AppError> {
    let pool = {
        let pm = state.pool_manager.lock().await;
        pm.get_pool(&conn_id).await?
    };
    let mut conn = pool.acquire().await.map_err(|e| AppError::Database(e.to_string()))?;
    query::execute_query(
        &mut conn,
        "SELECT pid, usename, datname, client_addr::text, state, query, query_start::text, wait_event_type, wait_event FROM pg_stat_activity WHERE state IS NOT NULL ORDER BY query_start DESC",
    ).await
}

#[tauri::command]
pub async fn get_table_stats(
    conn_id: String,
    schema: String,
    table: String,
    state: State<'_, AppState>,
) -> Result<Value, AppError> {
    let pool = {
        let pm = state.pool_manager.lock().await;
        pm.get_pool(&conn_id).await?
    };

    let qualified = format!("{}.{}", quote_ident(&schema), quote_ident(&table));
    let sql = format!(
        "SELECT pg_total_relation_size('{qualified}') as total_size, \
         pg_size_pretty(pg_total_relation_size('{qualified}')) as total_size_pretty, \
         pg_relation_size('{qualified}') as table_size, \
         pg_size_pretty(pg_relation_size('{qualified}')) as table_size_pretty, \
         n_live_tup, n_dead_tup, \
         last_vacuum::text, last_autovacuum::text, last_analyze::text \
         FROM pg_stat_user_tables WHERE schemaname = '{schema}' AND relname = '{table}'"
    );

    let row = sqlx::query(&sql)
        .fetch_optional(&pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    match row {
        Some(r) => {
            use sqlx::Row;
            Ok(json!({
                "total_size": r.try_get::<i64, _>("total_size").unwrap_or(0),
                "total_size_pretty": r.try_get::<String, _>("total_size_pretty").unwrap_or_default(),
                "table_size": r.try_get::<i64, _>("table_size").unwrap_or(0),
                "table_size_pretty": r.try_get::<String, _>("table_size_pretty").unwrap_or_default(),
                "n_live_tup": r.try_get::<i64, _>("n_live_tup").unwrap_or(0),
                "n_dead_tup": r.try_get::<i64, _>("n_dead_tup").unwrap_or(0),
                "last_vacuum": r.try_get::<String, _>("last_vacuum").ok(),
                "last_autovacuum": r.try_get::<String, _>("last_autovacuum").ok(),
                "last_analyze": r.try_get::<String, _>("last_analyze").ok(),
            }))
        }
        None => Ok(json!(null)),
    }
}

#[tauri::command]
pub async fn cancel_backend(
    conn_id: String,
    pid: i32,
    state: State<'_, AppState>,
) -> Result<bool, AppError> {
    let pool = {
        let pm = state.pool_manager.lock().await;
        pm.get_pool(&conn_id).await?
    };
    let result: bool = sqlx::query_scalar("SELECT pg_cancel_backend($1)")
        .bind(pid)
        .fetch_one(&pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(result)
}

fn quote_ident(name: &str) -> String {
    if name.contains('"') || name.chars().any(|c| c.is_uppercase()) || name.contains(' ') {
        format!("\"{}\"", name)
    } else {
        name.to_string()
    }
}
