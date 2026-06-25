use sqlx::{Column as SqlxColumn, Row, TypeInfo, ValueRef, postgres::PgRow, PgConnection};
use serde_json::{Value as JsonValue, Number as JsonNumber};
use std::time::Instant;
use crate::models::{QueryResult, ColumnInfo, ExplainResult};
use crate::error::AppError;

pub async fn execute_query(
    conn: &mut PgConnection,
    sql: &str,
) -> Result<QueryResult, AppError> {
    let statements = split_sql(sql);

    if statements.len() <= 1 {
        return execute_single(conn, sql).await;
    }

    let start_time = Instant::now();
    let mut last_result = QueryResult {
        columns: Vec::new(),
        rows: Vec::new(),
        affected_rows: 0,
        execution_time_ms: 0,
        total_count: None,
    };

    for stmt in &statements {
        let trimmed = stmt.trim();
        if trimmed.is_empty() { continue; }
        match execute_single(conn, trimmed).await {
            Ok(result) => {
                if !result.columns.is_empty() {
                    last_result = result;
                } else {
                    last_result.affected_rows = result.affected_rows;
                }
            }
            Err(e) => {
                last_result.execution_time_ms = start_time.elapsed().as_millis() as u64;
                return Err(e);
            }
        }
    }

    last_result.execution_time_ms = start_time.elapsed().as_millis() as u64;
    Ok(last_result)
}

fn split_sql(sql: &str) -> Vec<String> {
    let mut statements = Vec::new();
    let mut current = String::new();
    let chars: Vec<char> = sql.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        if chars[i] == '\'' {
            current.push(chars[i]);
            i += 1;
            while i < len {
                current.push(chars[i]);
                if chars[i] == '\'' && (i + 1 >= len || chars[i + 1] != '\'') { i += 1; break; }
                if chars[i] == '\'' && i + 1 < len && chars[i + 1] == '\'' { current.push(chars[i + 1]); i += 2; continue; }
                i += 1;
            }
            continue;
        }

        if chars[i] == '-' && i + 1 < len && chars[i + 1] == '-' {
            while i < len && chars[i] != '\n' { current.push(chars[i]); i += 1; }
            continue;
        }

        if chars[i] == '/' && i + 1 < len && chars[i + 1] == '*' {
            current.push(chars[i]); current.push(chars[i + 1]); i += 2;
            while i + 1 < len && !(chars[i] == '*' && chars[i + 1] == '/') { current.push(chars[i]); i += 1; }
            if i + 1 < len { current.push(chars[i]); current.push(chars[i + 1]); i += 2; }
            continue;
        }

        if chars[i] == '$' {
            let rest: String = chars[i..].iter().collect();
            if let Some(tag_end) = rest[1..].find('$') {
                let tag: String = chars[i..=i + tag_end + 1].iter().collect();
                let tag_len = tag.len();
                current.push_str(&tag);
                i += tag_len;
                let search: String = chars[i..].iter().collect();
                if let Some(end_pos) = search.find(&tag) {
                    let block: String = chars[i..i + end_pos + tag_len].iter().collect();
                    current.push_str(&block);
                    i += end_pos + tag_len;
                }
                continue;
            }
        }

        if chars[i] == ';' {
            let trimmed = current.trim();
            if !trimmed.is_empty() {
                statements.push(current.trim().to_string());
            }
            current.clear();
            i += 1;
            continue;
        }

        current.push(chars[i]);
        i += 1;
    }

    let trimmed = current.trim();
    if !trimmed.is_empty() {
        statements.push(current.trim().to_string());
    }

    statements
}

async fn execute_single(
    conn: &mut PgConnection,
    sql: &str,
) -> Result<QueryResult, AppError> {
    let start_time = Instant::now();
    let rows = sqlx::query(sql).fetch_all(&mut *conn).await?;
    let execution_time_ms = start_time.elapsed().as_millis() as u64;

    if rows.is_empty() {
        return Ok(QueryResult {
            columns: Vec::new(),
            rows: Vec::new(),
            affected_rows: 0,
            execution_time_ms,
            total_count: None,
        });
    }

    let first_row = &rows[0];
    let columns: Vec<ColumnInfo> = first_row
        .columns()
        .iter()
        .map(|col| {
            let type_info = col.type_info();
            ColumnInfo {
                name: col.name().to_string(),
                data_type: type_info.name().to_string(),
                udt_name: type_info.name().to_string(),
                oid: type_info.oid().map(|o| o.0),
            }
        })
        .collect();

    let mut json_rows = Vec::new();
    for row in rows {
        let parsed_row = pg_row_to_json_values(&row)?;
        json_rows.push(parsed_row);
    }

    let affected_rows = json_rows.len() as u64;

    Ok(QueryResult {
        columns,
        rows: json_rows,
        affected_rows,
        execution_time_ms,
        total_count: None,
    })
}

pub async fn explain_query(
    conn: &mut PgConnection,
    sql: &str,
) -> Result<ExplainResult, AppError> {
    let start_time = Instant::now();
    // We run EXPLAIN (FORMAT JSON)
    let explain_sql = format!("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {}", sql);
    let rows = sqlx::query(&explain_sql)
        .fetch_all(&mut *conn)
        .await?;
        
    let execution_time_ms = start_time.elapsed().as_millis() as u64;
    
    if rows.is_empty() {
        return Err(AppError::Database("Explain returned no results".to_string()));
    }
    
    // The result of EXPLAIN (FORMAT JSON) is a single column row with JSON
    let plan: serde_json::Value = rows[0].try_get(0)?;
    
    Ok(ExplainResult {
        plan,
        execution_time_ms,
    })
}

fn pg_row_to_json_values(row: &PgRow) -> Result<Vec<JsonValue>, AppError> {
    let mut values = Vec::new();
    for i in 0..row.len() {
        let col = row.column(i);
        let type_name = col.type_info().name();
        
        let value = if row.try_get_raw(i).map_err(|e| AppError::Database(e.to_string()))?.is_null() {
            JsonValue::Null
        } else {
            match type_name {
                "BOOL" => {
                    let val: bool = row.try_get(i)?;
                    JsonValue::Bool(val)
                }
                "INT2" => {
                    let val: i16 = row.try_get(i)?;
                    JsonValue::Number(val.into())
                }
                "INT4" => {
                    let val: i32 = row.try_get(i)?;
                    JsonValue::Number(val.into())
                }
                "INT8" => {
                    let val: i64 = row.try_get(i)?;
                    JsonValue::Number(val.into())
                }
                "FLOAT4" => {
                    let val: f32 = row.try_get(i)?;
                    if let Some(num) = JsonNumber::from_f64(val as f64) {
                        JsonValue::Number(num)
                    } else {
                        JsonValue::String(val.to_string())
                    }
                }
                "FLOAT8" => {
                    let val: f64 = row.try_get(i)?;
                    if let Some(num) = JsonNumber::from_f64(val) {
                        JsonValue::Number(num)
                    } else {
                        JsonValue::String(val.to_string())
                    }
                }
                "NUMERIC" => {
                    // Try decoding as f64; sqlx does not support NUMERIC -> String,
                    // so fall back to a placeholder for values that don't fit in f64.
                    if let Ok(f) = row.try_get::<f64, _>(i) {
                        if let Some(num) = JsonNumber::from_f64(f) {
                            JsonValue::Number(num)
                        } else {
                            JsonValue::String(f.to_string())
                        }
                    } else {
                        // NUMERIC overflow — f64 can't hold it and String decode
                        // isn't supported by sqlx. Show a placeholder.
                        JsonValue::String("<numeric>".into())
                    }
                }
                "JSON" | "JSONB" => {
                    let val: JsonValue = row.try_get(i)?;
                    val
                }
                "UUID" => {
                    let val: uuid::Uuid = row.try_get(i)?;
                    JsonValue::String(val.to_string())
                }
                "DATE" => {
                    let val: chrono::NaiveDate = row.try_get(i)?;
                    JsonValue::String(val.to_string())
                }
                "TIME" => {
                    let val: chrono::NaiveTime = row.try_get(i)?;
                    JsonValue::String(val.to_string())
                }
                "TIMESTAMP" => {
                    let val: chrono::NaiveDateTime = row.try_get(i)?;
                    JsonValue::String(val.to_string())
                }
                "TIMESTAMPTZ" => {
                    let val: chrono::DateTime<chrono::Utc> = row.try_get(i)?;
                    JsonValue::String(val.to_string())
                }
                "BYTEA" => {
                    let val: Vec<u8> = row.try_get(i)?;
                    let hex_string: String = val.iter().map(|b| format!("{:02x}", b)).collect();
                    JsonValue::String(format!("\\x{}", hex_string))
                }
                _ if type_name.starts_with('_') => {
                    // If it is an array type (starts with underscore in PG)
                    let val: Result<JsonValue, sqlx::Error> = row.try_get(i);
                    match val {
                        Ok(j) => j,
                        Err(_) => {
                            let val: Result<Vec<String>, sqlx::Error> = row.try_get(i);
                            match val {
                                Ok(arr) => JsonValue::Array(arr.into_iter().map(JsonValue::String).collect()),
                                Err(_) => {
                                    let s: Result<String, sqlx::Error> = row.try_get(i);
                                    match s {
                                        Ok(str_val) => JsonValue::String(str_val),
                                        Err(_) => JsonValue::String(format!("<unsupported array: {}>", type_name)),
                                    }
                                }
                            }
                        }
                    }
                }
                _ => {
                    // Fallback: try String, then raw bytes as UTF-8 text, then unsupported
                    let s: Result<String, sqlx::Error> = row.try_get(i);
                    match s {
                        Ok(str_val) => JsonValue::String(str_val),
                        Err(_) => {
                            let raw = row.try_get_raw(i);
                            match raw {
                                Ok(bytes) if !bytes.is_null() => {
                                    match bytes.as_bytes() {
                                        Ok(b) => match std::str::from_utf8(b) {
                                            Ok(text) => JsonValue::String(text.to_string()),
                                            Err(_) => JsonValue::String(format!("<unsupported type: {}>", type_name)),
                                        },
                                        Err(_) => JsonValue::String(format!("<unsupported type: {}>", type_name)),
                                    }
                                }
                                _ => JsonValue::String(format!("<unsupported type: {}>", type_name)),
                            }
                        }
                    }
                }
            }
        };
        values.push(value);
    }
    Ok(values)
}
