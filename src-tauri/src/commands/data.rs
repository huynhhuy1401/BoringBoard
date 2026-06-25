use tauri::State;
use std::collections::HashMap;
use crate::models::{QueryResult, DataOptions};
use crate::db::query;
use crate::error::AppError;
use crate::AppState;

#[tauri::command]
pub async fn get_table_data(
    conn_id: String,
    schema: String,
    table: String,
    opts: DataOptions,
    state: State<'_, AppState>,
) -> Result<QueryResult, AppError> {
    let mut sql = format!("SELECT * FROM \"{}\".\"{}\"", schema, table);

    if let (Some(col), Some(op)) = (&opts.filter_column, &opts.filter_operator) {
        if !col.trim().is_empty() {
            let clause = match op.as_str() {
                "is_null" => format!(" WHERE \"{}\" IS NULL", col),
                "is_not_null" => format!(" WHERE \"{}\" IS NOT NULL", col),
                "contains" => {
                    if let Some(val) = &opts.filter_value {
                        if !val.trim().is_empty() {
                            format!(" WHERE \"{}\"::text ILIKE '%{}%'", col, val.replace("'", "''"))
                        } else { String::new() }
                    } else { String::new() }
                },
                "equals" => {
                    if let Some(val) = &opts.filter_value {
                        if !val.trim().is_empty() {
                            format!(" WHERE \"{}\" = '{}'", col, val.replace("'", "''"))
                        } else { String::new() }
                    } else { String::new() }
                },
                "not_equals" => {
                    if let Some(val) = &opts.filter_value {
                        if !val.trim().is_empty() {
                            format!(" WHERE \"{}\" != '{}'", col, val.replace("'", "''"))
                        } else { String::new() }
                    } else { String::new() }
                },
                "starts_with" => {
                    if let Some(val) = &opts.filter_value {
                        if !val.trim().is_empty() {
                            format!(" WHERE \"{}\"::text LIKE '{}%'", col, val.replace("'", "''"))
                        } else { String::new() }
                    } else { String::new() }
                },
                "ends_with" => {
                    if let Some(val) = &opts.filter_value {
                        if !val.trim().is_empty() {
                            format!(" WHERE \"{}\"::text LIKE '%{}'", col, val.replace("'", "''"))
                        } else { String::new() }
                    } else { String::new() }
                },
                "greater" => {
                    if let Some(val) = &opts.filter_value {
                        if !val.trim().is_empty() {
                            format!(" WHERE \"{}\" > '{}'", col, val.replace("'", "''"))
                        } else { String::new() }
                    } else { String::new() }
                },
                "greater_equal" => {
                    if let Some(val) = &opts.filter_value {
                        if !val.trim().is_empty() {
                            format!(" WHERE \"{}\" >= '{}'", col, val.replace("'", "''"))
                        } else { String::new() }
                    } else { String::new() }
                },
                "less" => {
                    if let Some(val) = &opts.filter_value {
                        if !val.trim().is_empty() {
                            format!(" WHERE \"{}\" < '{}'", col, val.replace("'", "''"))
                        } else { String::new() }
                    } else { String::new() }
                },
                "less_equal" => {
                    if let Some(val) = &opts.filter_value {
                        if !val.trim().is_empty() {
                            format!(" WHERE \"{}\" <= '{}'", col, val.replace("'", "''"))
                        } else { String::new() }
                    } else { String::new() }
                },
                _ => {
                    // Default to contains (ILIKE)
                    if let Some(val) = &opts.filter_value {
                        if !val.trim().is_empty() {
                            format!(" WHERE \"{}\"::text ILIKE '%{}%'", col, val.replace("'", "''"))
                        } else { String::new() }
                    } else { String::new() }
                },
            };
            sql.push_str(&clause);
        }
    }

    if let (Some(col), Some(dir)) = (&opts.sort_column, &opts.sort_direction) {
        if !col.trim().is_empty() {
            let direction = if dir.to_uppercase() == "DESC" { "DESC" } else { "ASC" };
            sql.push_str(&format!(" ORDER BY \"{}\" {}", col, direction));
        }
    }

    if let Some(limit) = opts.limit {
        sql.push_str(&format!(" LIMIT {}", limit));
    }

    if let Some(offset) = opts.offset {
        sql.push_str(&format!(" OFFSET {}", offset));
    }

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

    // Run the query on the tracked connection
    let mut result = query::execute_query(&mut conn, &sql).await;

    // If there's a filter, run a count query to get total matching rows
    if opts.filter_column.is_some() && opts.filter_operator.is_some() {
        let mut count_sql = format!("SELECT count(*) FROM \"{}\".\"{}\"", schema, table);
        if let (Some(col), Some(op)) = (&opts.filter_column, &opts.filter_operator) {
            if !col.trim().is_empty() {
                let clause = match op.as_str() {
                    "is_null" => format!(" WHERE \"{}\" IS NULL", col),
                    "is_not_null" => format!(" WHERE \"{}\" IS NOT NULL", col),
                    "contains" => {
                        if let Some(val) = &opts.filter_value {
                            if !val.trim().is_empty() {
                                format!(" WHERE \"{}\"::text ILIKE '%{}%'", col, val.replace("'", "''"))
                            } else { String::new() }
                        } else { String::new() }
                    },
                    "equals" => {
                        if let Some(val) = &opts.filter_value {
                            if !val.trim().is_empty() {
                                format!(" WHERE \"{}\" = '{}'", col, val.replace("'", "''"))
                            } else { String::new() }
                        } else { String::new() }
                    },
                    "not_equals" => {
                        if let Some(val) = &opts.filter_value {
                            if !val.trim().is_empty() {
                                format!(" WHERE \"{}\" != '{}'", col, val.replace("'", "''"))
                            } else { String::new() }
                        } else { String::new() }
                    },
                    "starts_with" => {
                        if let Some(val) = &opts.filter_value {
                            if !val.trim().is_empty() {
                                format!(" WHERE \"{}\"::text LIKE '{}%'", col, val.replace("'", "''"))
                            } else { String::new() }
                        } else { String::new() }
                    },
                    "ends_with" => {
                        if let Some(val) = &opts.filter_value {
                            if !val.trim().is_empty() {
                                format!(" WHERE \"{}\"::text LIKE '%{}'", col, val.replace("'", "''"))
                            } else { String::new() }
                        } else { String::new() }
                    },
                    "greater" => {
                        if let Some(val) = &opts.filter_value {
                            if !val.trim().is_empty() {
                                format!(" WHERE \"{}\" > '{}'", col, val.replace("'", "''"))
                            } else { String::new() }
                        } else { String::new() }
                    },
                    "greater_equal" => {
                        if let Some(val) = &opts.filter_value {
                            if !val.trim().is_empty() {
                                format!(" WHERE \"{}\" >= '{}'", col, val.replace("'", "''"))
                            } else { String::new() }
                        } else { String::new() }
                    },
                    "less" => {
                        if let Some(val) = &opts.filter_value {
                            if !val.trim().is_empty() {
                                format!(" WHERE \"{}\" < '{}'", col, val.replace("'", "''"))
                            } else { String::new() }
                        } else { String::new() }
                    },
                    "less_equal" => {
                        if let Some(val) = &opts.filter_value {
                            if !val.trim().is_empty() {
                                format!(" WHERE \"{}\" <= '{}'", col, val.replace("'", "''"))
                            } else { String::new() }
                        } else { String::new() }
                    },
                    _ => {
                        if let Some(val) = &opts.filter_value {
                            if !val.trim().is_empty() {
                                format!(" WHERE \"{}\"::text ILIKE '%{}%'", col, val.replace("'", "''"))
                            } else { String::new() }
                        } else { String::new() }
                    },
                };
                count_sql.push_str(&clause);
            }
        }
        if let Ok(count_result) = sqlx::query_scalar::<_, i64>(&count_sql)
            .fetch_one(&mut *conn)
            .await
        {
            if let Ok(ref mut r) = result {
                r.total_count = Some(count_result as u64);
            }
        }
    }

    // Clear PID regardless of outcome
    {
        let mut pm = state.pool_manager.lock().await;
        pm.clear_active_pid(&conn_id);
    }

    result
}

#[tauri::command]
pub async fn update_row(
    conn_id: String,
    schema: String,
    table: String,
    pk_column: String,
    pk_value: serde_json::Value,
    changes: HashMap<String, serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    if changes.is_empty() {
        return Ok(());
    }
    
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    
    let set_clauses: Vec<String> = changes
        .iter()
        .map(|(col, val)| format!("\"{}\" = {}", col, json_to_sql_literal(val)))
        .collect();
        
    let sql = format!(
        "UPDATE \"{}\".\"{}\" SET {} WHERE \"{}\" = {};",
        schema,
        table,
        set_clauses.join(", "),
        pk_column,
        json_to_sql_literal(&pk_value)
    );
    
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn insert_row(
    conn_id: String,
    schema: String,
    table: String,
    data: HashMap<String, serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    if data.is_empty() {
        return Ok(());
    }
    
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    
    let mut columns = Vec::new();
    let mut values = Vec::new();
    
    for (col, val) in data {
        columns.push(format!("\"{}\"", col));
        values.push(json_to_sql_literal(&val));
    }
    
    let sql = format!(
        "INSERT INTO \"{}\".\"{}\" ({}) VALUES ({});",
        schema,
        table,
        columns.join(", "),
        values.join(", ")
    );
    
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_rows(
    conn_id: String,
    schema: String,
    table: String,
    pk_column: String,
    pk_values: Vec<serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<u64, AppError> {
    if pk_values.is_empty() {
        return Ok(0);
    }
    
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    
    let in_clause: Vec<String> = pk_values
        .iter()
        .map(json_to_sql_literal)
        .collect();
        
    let sql = format!(
        "DELETE FROM \"{}\".\"{}\" WHERE \"{}\" IN ({});",
        schema,
        table,
        pk_column,
        in_clause.join(", ")
    );
    
    let result = sqlx::query(&sql).execute(&pool).await?;
    Ok(result.rows_affected())
}

fn json_to_sql_literal(val: &serde_json::Value) -> String {
    match val {
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::Bool(b) => if *b { "true" } else { "false" }.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => format!("'{}'", s.replace("'", "''")),
        other => format!("'{}'::jsonb", other.to_string().replace("'", "''")),
    }
}
