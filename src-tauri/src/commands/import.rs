use serde_json::Value as JsonValue;
use tauri::State;
use crate::error::AppError;
use crate::models::ImportResult;
use crate::AppState;

#[tauri::command]
pub async fn import_sql_file(
    conn_id: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<ImportResult, AppError> {
    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| AppError::Io(format!("Failed to read file: {}", e)))?;

    let statements = split_sql(&content);

    let pool = {
        let pm = state.pool_manager.lock().await;
        pm.get_pool(&conn_id).await?
    };

    let total = statements.len() as u32;
    let mut succeeded: u32 = 0;
    let mut failed: u32 = 0;
    let mut errors = Vec::new();

    for (i, stmt) in statements.iter().enumerate() {
        let trimmed = stmt.trim();
        if trimmed.is_empty() {
            continue;
        }
        match sqlx::query(trimmed).execute(&pool).await {
            Ok(_) => {
                succeeded += 1;
            }
            Err(e) => {
                failed += 1;
                errors.push(format!("Statement {}: {}", i + 1, e));
            }
        }
    }

    Ok(ImportResult {
        total_rows: total,
        inserted: succeeded,
        failed,
        errors,
    })
}

#[tauri::command]
pub async fn import_csv_file(
    conn_id: String,
    schema: String,
    table: String,
    file_path: String,
    has_header: bool,
    state: State<'_, AppState>,
) -> Result<ImportResult, AppError> {
    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| AppError::Io(format!("Failed to read file: {}", e)))?;

    let pool = {
        let pm = state.pool_manager.lock().await;
        pm.get_pool(&conn_id).await?
    };

    let mut reader = csv::ReaderBuilder::new()
        .has_headers(has_header)
        .from_reader(content.as_bytes());

    let headers: Vec<String> = if has_header {
        reader
            .headers()
            .map_err(|e| AppError::Io(format!("Failed to read CSV headers: {}", e)))?
            .iter()
            .map(|h| h.to_string())
            .collect()
    } else {
        // Read first record to determine column count
        let mut records = csv::ReaderBuilder::new()
            .has_headers(false)
            .from_reader(content.as_bytes());
        match records.records().next() {
            Some(Ok(rec)) => (1..=rec.len()).map(|i| format!("column{}", i)).collect(),
            _ => return Err(AppError::Io("CSV file is empty".to_string())),
        }
    };

    // Re-create reader to iterate all records from the beginning
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(has_header)
        .from_reader(content.as_bytes());

    let col_count = headers.len();
    let placeholders: Vec<String> = (1..=col_count).map(|i| format!("${}", i)).collect();
    let quoted_table = format!("\"{}\".\"{}\"", schema, table);
    let col_names: Vec<String> = headers.iter().map(|h| format!("\"{}\"", h)).collect();
    let insert_sql = format!(
        "INSERT INTO {} ({}) VALUES ({})",
        quoted_table,
        col_names.join(", "),
        placeholders.join(", ")
    );

    let mut total: u32 = 0;
    let mut inserted: u32 = 0;
    let mut failed: u32 = 0;
    let mut errors = Vec::new();
    let mut batch: Vec<Vec<String>> = Vec::new();

    for result in reader.records() {
        let record = match result {
            Ok(r) => r,
            Err(e) => {
                total += 1;
                failed += 1;
                errors.push(format!("Row {}: {}", total, e));
                continue;
            }
        };

        total += 1;
        let values: Vec<String> = record.iter().map(|v| v.to_string()).collect();
        batch.push(values);

        if batch.len() >= 100 {
            let (s, f, e) = execute_csv_batch(&pool, &insert_sql, &mut batch, total).await;
            inserted += s;
            failed += f;
            errors.extend(e);
        }
    }

    if !batch.is_empty() {
        let (s, f, e) = execute_csv_batch(&pool, &insert_sql, &mut batch, total).await;
        inserted += s;
        failed += f;
        errors.extend(e);
    }

    Ok(ImportResult {
        total_rows: total,
        inserted,
        failed,
        errors,
    })
}

async fn execute_csv_batch(
    pool: &sqlx::PgPool,
    insert_sql: &str,
    batch: &mut Vec<Vec<String>>,
    total_so_far: u32,
) -> (u32, u32, Vec<String>) {
    let mut succeeded: u32 = 0;
    let mut failed: u32 = 0;
    let mut errors = Vec::new();
    let batch_size = batch.len();

    for (idx, values) in batch.drain(..).enumerate() {
        let row_num = total_so_far - batch_size as u32 + idx as u32 + 1;
        let mut query = sqlx::query(insert_sql);
        for v in &values {
            if v.is_empty() {
                query = query.bind(None::<String>);
            } else {
                query = query.bind(v);
            }
        }
        match query.execute(pool).await {
            Ok(_) => succeeded += 1,
            Err(e) => {
                failed += 1;
                errors.push(format!("Row {}: {}", row_num, e));
            }
        }
    }

    (succeeded, failed, errors)
}

#[tauri::command]
pub async fn import_json_file(
    conn_id: String,
    schema: String,
    table: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<ImportResult, AppError> {
    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| AppError::Io(format!("Failed to read file: {}", e)))?;

    let records: Vec<serde_json::Map<String, JsonValue>> = serde_json::from_str(&content)
        .map_err(|e| AppError::Io(format!("Failed to parse JSON: {}", e)))?;

    let pool = {
        let pm = state.pool_manager.lock().await;
        pm.get_pool(&conn_id).await?
    };

    let total = records.len() as u32;
    let mut inserted: u32 = 0;
    let mut failed: u32 = 0;
    let mut errors = Vec::new();
    let mut batch: Vec<&serde_json::Map<String, JsonValue>> = Vec::new();

    for (idx, record) in records.iter().enumerate() {
        batch.push(record);

        if batch.len() >= 100 {
            let (s, f, e) =
                execute_json_batch(&pool, &schema, &table, &mut batch, idx as u32 + 1).await;
            inserted += s;
            failed += f;
            errors.extend(e);
        }
    }

    if !batch.is_empty() {
        let last = total;
        let (s, f, e) = execute_json_batch(&pool, &schema, &table, &mut batch, last).await;
        inserted += s;
        failed += f;
        errors.extend(e);
    }

    Ok(ImportResult {
        total_rows: total,
        inserted,
        failed,
        errors,
    })
}

async fn execute_json_batch(
    pool: &sqlx::PgPool,
    schema: &str,
    table: &str,
    batch: &mut Vec<&serde_json::Map<String, JsonValue>>,
    total_so_far: u32,
) -> (u32, u32, Vec<String>) {
    let mut succeeded: u32 = 0;
    let mut failed: u32 = 0;
    let mut errors = Vec::new();

    for record in batch.drain(..) {
        if record.is_empty() {
            failed += 1;
            errors.push(format!("Row {}: empty object", total_so_far));
            continue;
        }

        let columns: Vec<String> = record.keys().map(|k| format!("\"{}\"", k)).collect();
        let placeholders: Vec<String> = (1..=record.len()).map(|i| format!("${}", i)).collect();
        let sql = format!(
            "INSERT INTO \"{}\".\"{}\" ({}) VALUES ({})",
            schema,
            table,
            columns.join(", "),
            placeholders.join(", ")
        );

        let mut query = sqlx::query(&sql);
        for key in record.keys() {
            let val = &record[key];
            match val {
                JsonValue::Null => {
                    query = query.bind(None::<JsonValue>);
                }
                JsonValue::String(s) => {
                    query = query.bind(s.clone());
                }
                JsonValue::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        query = query.bind(i);
                    } else if let Some(f) = n.as_f64() {
                        query = query.bind(f);
                    } else {
                        query = query.bind(n.to_string());
                    }
                }
                JsonValue::Bool(b) => {
                    query = query.bind(*b);
                }
                _ => {
                    query = query.bind(val.clone());
                }
            }
        }

        match query.execute(pool).await {
            Ok(_) => succeeded += 1,
            Err(e) => {
                failed += 1;
                errors.push(format!("Row {}: {}", total_so_far, e));
            }
        }
    }

    (succeeded, failed, errors)
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
                if chars[i] == '\'' && (i + 1 >= len || chars[i + 1] != '\'') {
                    i += 1;
                    break;
                }
                if chars[i] == '\'' && i + 1 < len && chars[i + 1] == '\'' {
                    current.push(chars[i + 1]);
                    i += 2;
                    continue;
                }
                i += 1;
            }
            continue;
        }

        if chars[i] == '-' && i + 1 < len && chars[i + 1] == '-' {
            while i < len && chars[i] != '\n' {
                current.push(chars[i]);
                i += 1;
            }
            continue;
        }

        if chars[i] == '/' && i + 1 < len && chars[i + 1] == '*' {
            current.push(chars[i]);
            current.push(chars[i + 1]);
            i += 2;
            while i + 1 < len && !(chars[i] == '*' && chars[i + 1] == '/') {
                current.push(chars[i]);
                i += 1;
            }
            if i + 1 < len {
                current.push(chars[i]);
                current.push(chars[i + 1]);
                i += 2;
            }
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
