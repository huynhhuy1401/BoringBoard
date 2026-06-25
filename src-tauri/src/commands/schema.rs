use tauri::State;
use crate::models::*;
use crate::db::{introspect, ddl};
use crate::error::AppError;
use crate::AppState;

#[tauri::command]
pub async fn get_databases(
    conn_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Database>, AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    introspect::get_databases(&pool).await
}

#[tauri::command]
pub async fn get_schemas(
    conn_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Schema>, AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    introspect::get_schemas(&pool).await
}

#[tauri::command]
pub async fn get_tables(
    conn_id: String,
    schema: String,
    state: State<'_, AppState>,
) -> Result<Vec<Table>, AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    introspect::get_tables(&pool, &schema).await
}

#[tauri::command]
pub async fn get_columns(
    conn_id: String,
    schema: String,
    table: String,
    state: State<'_, AppState>,
) -> Result<Vec<Column>, AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    introspect::get_columns(&pool, &schema, &table).await
}

#[tauri::command]
pub async fn get_indexes(
    conn_id: String,
    schema: String,
    table: String,
    state: State<'_, AppState>,
) -> Result<Vec<Index>, AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    introspect::get_indexes(&pool, &schema, &table).await
}

#[tauri::command]
pub async fn get_constraints(
    conn_id: String,
    schema: String,
    table: String,
    state: State<'_, AppState>,
) -> Result<Vec<Constraint>, AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    introspect::get_constraints(&pool, &schema, &table).await
}

#[tauri::command]
pub async fn get_triggers(
    conn_id: String,
    schema: String,
    table: String,
    state: State<'_, AppState>,
) -> Result<Vec<Trigger>, AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    introspect::get_triggers(&pool, &schema, &table).await
}

#[tauri::command]
pub async fn get_functions(
    conn_id: String,
    schema: String,
    state: State<'_, AppState>,
) -> Result<Vec<Function>, AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    introspect::get_functions(&pool, &schema).await
}

#[tauri::command]
pub async fn get_sequences(
    conn_id: String,
    schema: String,
    state: State<'_, AppState>,
) -> Result<Vec<Sequence>, AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    introspect::get_sequences(&pool, &schema).await
}

#[tauri::command]
pub async fn get_extensions(
    conn_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Extension>, AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    introspect::get_extensions(&pool).await
}

// --- DDL Generation Commands ---

#[tauri::command]
pub async fn get_table_ddl(
    conn_id: String,
    schema: String,
    table: String,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    ddl::generate_create_table(&pool, &schema, &table).await
}

#[tauri::command]
pub fn generate_select_sql(
    schema: String,
    table: String,
    columns: Vec<String>,
) -> String {
    ddl::generate_select(&schema, &table, &columns)
}

#[tauri::command]
pub fn generate_insert_sql(
    schema: String,
    table: String,
    columns: Vec<String>,
) -> String {
    ddl::generate_insert(&schema, &table, &columns)
}

// --- Schema Modification Commands ---

#[tauri::command]
pub async fn truncate_table(
    conn_id: String,
    schema: String,
    table: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let sql = format!(
        "TRUNCATE TABLE {}.{}",
        quote_ident(&schema),
        quote_ident(&table)
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn drop_table(
    conn_id: String,
    schema: String,
    table: String,
    cascade: bool,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let cascade_str = if cascade { " CASCADE" } else { "" };
    let sql = format!(
        "DROP TABLE {}.{}{}",
        quote_ident(&schema),
        quote_ident(&table),
        cascade_str
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

// --- Schema Management Commands ---

#[tauri::command]
pub async fn create_table(
    conn_id: String,
    schema: String,
    table_name: String,
    columns: Vec<CreateColumn>,
    primary_key_columns: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let col_defs: Vec<String> = columns
        .iter()
        .map(|c| {
            let mut parts = vec![format!("{} {}", quote_ident(&c.name), c.data_type)];
            if !c.nullable {
                parts.push("NOT NULL".to_string());
            }
            if let Some(ref default) = c.default {
                parts.push(format!("DEFAULT {}", default));
            }
            parts.join(" ")
        })
        .collect();
    let mut all_parts = col_defs;
    if let Some(pk_cols) = primary_key_columns {
        if !pk_cols.is_empty() {
            let pk_idents: Vec<String> = pk_cols.iter().map(|c| quote_ident(c)).collect();
            all_parts.push(format!("PRIMARY KEY ({})", pk_idents.join(", ")));
        }
    }
    let sql = format!(
        "CREATE TABLE {}.{} ({})",
        quote_ident(&schema),
        quote_ident(&table_name),
        all_parts.join(", ")
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn alter_table_add_column(
    conn_id: String,
    schema: String,
    table: String,
    column: CreateColumn,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let mut parts = vec![format!("{} {}", quote_ident(&column.name), column.data_type)];
    if !column.nullable {
        parts.push("NOT NULL".to_string());
    }
    if let Some(ref default) = column.default {
        parts.push(format!("DEFAULT {}", default));
    }
    let sql = format!(
        "ALTER TABLE {}.{} ADD COLUMN {}",
        quote_ident(&schema),
        quote_ident(&table),
        parts.join(" ")
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn alter_table_drop_column(
    conn_id: String,
    schema: String,
    table: String,
    column_name: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let sql = format!(
        "ALTER TABLE {}.{} DROP COLUMN {}",
        quote_ident(&schema),
        quote_ident(&table),
        quote_ident(&column_name)
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn alter_table_rename_column(
    conn_id: String,
    schema: String,
    table: String,
    old_name: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let sql = format!(
        "ALTER TABLE {}.{} RENAME COLUMN {} TO {}",
        quote_ident(&schema),
        quote_ident(&table),
        quote_ident(&old_name),
        quote_ident(&new_name)
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn rename_table(
    conn_id: String,
    schema: String,
    old_name: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let sql = format!(
        "ALTER TABLE {}.{} RENAME TO {}",
        quote_ident(&schema),
        quote_ident(&old_name),
        quote_ident(&new_name)
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn vacuum_table(
    conn_id: String,
    schema: String,
    table: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let sql = format!("VACUUM {}.{}", quote_ident(&schema), quote_ident(&table));
    let mut conn = pool.acquire().await.map_err(|e| AppError::Database(e.to_string()))?;
    sqlx::query(&sql).execute(&mut *conn).await?;
    Ok(())
}

#[tauri::command]
pub async fn analyze_table(
    conn_id: String,
    schema: String,
    table: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let sql = format!("ANALYZE {}.{}", quote_ident(&schema), quote_ident(&table));
    let mut conn = pool.acquire().await.map_err(|e| AppError::Database(e.to_string()))?;
    sqlx::query(&sql).execute(&mut *conn).await?;
    Ok(())
}

#[tauri::command]
pub async fn create_index(
    conn_id: String,
    schema: String,
    table: String,
    index_name: String,
    columns: Vec<IndexColumn>,
    is_unique: bool,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let unique = if is_unique { "UNIQUE " } else { "" };
    let col_parts: Vec<String> = columns
        .iter()
        .map(|c| {
            let sort = if c.sort_order == "DESC" { " DESC" } else { "" };
            let nulls = match c.nulls_order.as_str() {
                "FIRST" => " NULLS FIRST",
                "LAST" => " NULLS LAST",
                _ => "",
            };
            format!("{}{}{}", quote_ident(&c.name), sort, nulls)
        })
        .collect();
    let sql = format!(
        "CREATE {}INDEX {} ON {}.{} ({})",
        unique,
        quote_ident(&index_name),
        quote_ident(&schema),
        quote_ident(&table),
        col_parts.join(", ")
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn drop_index(
    conn_id: String,
    schema: String,
    index_name: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let sql = format!("DROP INDEX {}.{}", quote_ident(&schema), quote_ident(&index_name));
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_function_ddl(
    conn_id: String,
    schema: String,
    name: String,
    argument_types: String,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let sql = r#"
        SELECT pg_get_functiondef(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = $1 AND p.proname = $2 AND oidvectortypes(p.proargtypes) = $3
    "#;
    let ddl: Option<String> = sqlx::query_scalar(sql)
        .bind(&schema)
        .bind(&name)
        .bind(&argument_types)
        .fetch_optional(&pool)
        .await?;
    Ok(ddl.unwrap_or_else(|| format!("-- Function definition not found for {}.{}({})", schema, name, argument_types)))
}

#[tauri::command]
pub async fn drop_view(
    conn_id: String,
    schema: String,
    view: String,
    is_materialized: bool,
    cascade: bool,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let cascade_str = if cascade { " CASCADE" } else { "" };
    let view_type = if is_materialized { "MATERIALIZED VIEW" } else { "VIEW" };
    let sql = format!(
        "DROP {} {}.{}{}",
        view_type,
        quote_ident(&schema),
        quote_ident(&view),
        cascade_str
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn drop_function(
    conn_id: String,
    schema: String,
    name: String,
    argument_types: String,
    cascade: bool,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let cascade_str = if cascade { " CASCADE" } else { "" };
    let sql = format!(
        "DROP FUNCTION {}.{}({}){}",
        quote_ident(&schema),
        quote_ident(&name),
        argument_types,
        cascade_str
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[derive(Debug, serde::Serialize)]
pub struct SequenceDetails {
    pub name: String,
    pub schema: String,
    pub data_type: String,
    pub start_value: i64,
    pub increment_by: i64,
    pub max_value: i64,
    pub min_value: i64,
    pub cache_size: i64,
    pub is_cycled: bool,
    pub last_value: Option<i64>,
    pub ddl: String,
}

#[tauri::command]
pub async fn get_sequence_details(
    conn_id: String,
    schema: String,
    name: String,
    state: State<'_, AppState>,
) -> Result<SequenceDetails, AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    
    let sql = r#"
        SELECT 
            c.relname,
            n.nspname,
            t.typname,
            s.seqstart::bigint,
            s.seqincrement::bigint,
            s.seqmaxvalue::bigint,
            s.seqminvalue::bigint,
            s.seqcache::bigint,
            s.seqcycle,
            pg_sequence_last_value(c.oid)::bigint
        FROM pg_sequence s
        JOIN pg_class c ON c.oid = s.seqrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_type t ON t.oid = s.seqtypid
        WHERE n.nspname = $1 AND c.relname = $2
    "#;
    
    let row = sqlx::query(sql)
        .bind(&schema)
        .bind(&name)
        .fetch_optional(&pool)
        .await?;
        
    if let Some(r) = row {
        use sqlx::Row;
        let name: String = r.get(0);
        let schema: String = r.get(1);
        let data_type: String = r.get(2);
        let start_value: i64 = r.get(3);
        let increment_by: i64 = r.get(4);
        let max_value: i64 = r.get(5);
        let min_value: i64 = r.get(6);
        let cache_size: i64 = r.get(7);
        let is_cycled: bool = r.get(8);
        let last_value: Option<i64> = r.get(9);
        
        let cycle_str = if is_cycled { "CYCLE" } else { "NO CYCLE" };
        let ddl = format!(
            "-- Sequence: {schema}.{name}\n\nCREATE SEQUENCE {}.{}\n    AS {}\n    START WITH {}\n    INCREMENT BY {}\n    MINVALUE {}\n    MAXVALUE {}\n    CACHE {}\n    {};",
            quote_ident(&schema),
            quote_ident(&name),
            data_type,
            start_value,
            increment_by,
            min_value,
            max_value,
            cache_size,
            cycle_str
        );
        
        Ok(SequenceDetails {
            name,
            schema,
            data_type,
            start_value,
            increment_by,
            max_value,
            min_value,
            cache_size,
            is_cycled,
            last_value,
            ddl,
        })
    } else {
        Err(AppError::Database(format!("Sequence {}.{} not found or unsupported Postgres version", schema, name)))
    }
}

#[tauri::command]
pub async fn drop_sequence(
    conn_id: String,
    schema: String,
    name: String,
    cascade: bool,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let cascade_str = if cascade { " CASCADE" } else { "" };
    let sql = format!(
        "DROP SEQUENCE {}.{}{}",
        quote_ident(&schema),
        quote_ident(&name),
        cascade_str
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn alter_table_alter_column_type(
    conn_id: String,
    schema: String,
    table: String,
    column_name: String,
    new_type: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let sql = format!(
        "ALTER TABLE {}.{} ALTER COLUMN {} SET DATA TYPE {}",
        quote_ident(&schema),
        quote_ident(&table),
        quote_ident(&column_name),
        new_type
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn alter_table_alter_column_nullable(
    conn_id: String,
    schema: String,
    table: String,
    column_name: String,
    nullable: bool,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let action = if nullable { "DROP NOT NULL" } else { "SET NOT NULL" };
    let sql = format!(
        "ALTER TABLE {}.{} ALTER COLUMN {} {}",
        quote_ident(&schema),
        quote_ident(&table),
        quote_ident(&column_name),
        action
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn alter_table_alter_column_default(
    conn_id: String,
    schema: String,
    table: String,
    column_name: String,
    default: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let sql = match default {
        Some(val) => format!(
            "ALTER TABLE {}.{} ALTER COLUMN {} SET DEFAULT {}",
            quote_ident(&schema),
            quote_ident(&table),
            quote_ident(&column_name),
            val
        ),
        None => format!(
            "ALTER TABLE {}.{} ALTER COLUMN {} DROP DEFAULT",
            quote_ident(&schema),
            quote_ident(&table),
            quote_ident(&column_name)
        ),
    };
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn drop_constraint(
    conn_id: String,
    schema: String,
    table: String,
    constraint_name: String,
    cascade: bool,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let cascade_str = if cascade { " CASCADE" } else { "" };
    let sql = format!(
        "ALTER TABLE {}.{} DROP CONSTRAINT {}{}",
        quote_ident(&schema),
        quote_ident(&table),
        quote_ident(&constraint_name),
        cascade_str
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn drop_trigger(
    conn_id: String,
    schema: String,
    trigger_name: String,
    table: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let sql = format!(
        "DROP TRIGGER {} ON {}.{}",
        quote_ident(&trigger_name),
        quote_ident(&schema),
        quote_ident(&table)
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn rename_index(
    conn_id: String,
    schema: String,
    old_name: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let pool_manager = state.pool_manager.lock().await;
    let pool = pool_manager.get_pool(&conn_id).await?;
    let sql = format!(
        "ALTER INDEX {}.{} RENAME TO {}",
        quote_ident(&schema),
        quote_ident(&old_name),
        quote_ident(&new_name)
    );
    sqlx::query(&sql).execute(&pool).await?;
    Ok(())
}

fn quote_ident(name: &str) -> String {
    if name.contains('"') || name.chars().any(|c| c.is_uppercase()) || name.contains(' ') {
        format!("\"{}\"", name)
    } else {
        name.to_string()
    }
}
