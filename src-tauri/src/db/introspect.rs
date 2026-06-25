use sqlx::PgPool;
use crate::models::*;
use crate::error::AppError;

pub async fn get_databases(pool: &PgPool) -> Result<Vec<Database>, AppError> {
    let sql = "SELECT datname AS name FROM pg_database WHERE datistemplate = false ORDER BY datname;";
    let dbs = sqlx::query_as::<_, Database>(sql)
        .fetch_all(pool)
        .await?;
    Ok(dbs)
}

pub async fn get_schemas(pool: &PgPool) -> Result<Vec<Schema>, AppError> {
    let sql = "SELECT nspname AS name FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema' ORDER BY nspname;";
    let schemas = sqlx::query_as::<_, Schema>(sql)
        .fetch_all(pool)
        .await?;
    Ok(schemas)
}

pub async fn get_tables(pool: &PgPool, schema: &str) -> Result<Vec<Table>, AppError> {
    let sql = r#"
        SELECT 
            c.relname AS name,
            n.nspname AS schema,
            c.relkind = 'v' AS is_view,
            c.relkind = 'm' AS is_materialized_view,
            c.relkind = 'p' AS is_partitioned,
            c.relkind = 'f' AS is_foreign,
            c.reltuples::bigint AS row_count_estimate,
            pg_catalog.obj_description(c.oid, 'pg_class') AS comment
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relkind IN ('r', 'v', 'm', 'p', 'f')
        ORDER BY c.relname;
    "#;
    let tables = sqlx::query_as::<_, Table>(sql)
        .bind(schema)
        .fetch_all(pool)
        .await?;
    Ok(tables)
}

pub async fn get_columns(pool: &PgPool, schema: &str, table: &str) -> Result<Vec<Column>, AppError> {
    let sql = r#"
        SELECT 
            a.attname AS name,
            format_type(a.atttypid, a.atttypmod) AS data_type,
            t.typname AS udt_name,
            NOT a.attnotnull AS is_nullable,
            pg_get_expr(ad.adbin, ad.adrelid) AS column_default,
            NULL::integer AS character_maximum_length,
            NULL::integer AS numeric_precision,
            NULL::integer AS numeric_scale,
            a.attidentity != '' AS is_identity,
            a.attgenerated != '' AS is_generated,
            EXISTS (
                SELECT 1 FROM pg_index i 
                WHERE i.indrelid = a.attrelid AND i.indisprimary AND a.attnum = ANY(i.indkey)
            ) AS is_primary_key,
            EXISTS (
                SELECT 1 FROM pg_constraint con 
                WHERE con.conrelid = a.attrelid AND con.contype = 'f' AND a.attnum = ANY(con.conkey)
            ) AS is_foreign_key,
            pg_catalog.col_description(a.attrelid, a.attnum) AS comment
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_type t ON t.oid = a.atttypid
        LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
        WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum;
    "#;
    let columns = sqlx::query_as::<_, Column>(sql)
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await?;
    Ok(columns)
}

pub async fn get_indexes(pool: &PgPool, schema: &str, table: &str) -> Result<Vec<Index>, AppError> {
    let sql = r#"
        SELECT 
            c.relname AS name,
            t.relname AS table_name,
            i.indisunique AS is_unique,
            i.indisprimary AS is_primary,
            pg_get_indexdef(i.indexrelid) AS definition
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = $1 AND t.relname = $2
        ORDER BY c.relname;
    "#;
    let indexes = sqlx::query_as::<_, Index>(sql)
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await?;
    Ok(indexes)
}

pub async fn get_constraints(pool: &PgPool, schema: &str, table: &str) -> Result<Vec<Constraint>, AppError> {
    let sql = r#"
        SELECT 
            conname AS name,
            CASE contype 
                WHEN 'p' THEN 'PRIMARY KEY'
                WHEN 'f' THEN 'FOREIGN KEY'
                WHEN 'u' THEN 'UNIQUE'
                WHEN 'c' THEN 'CHECK'
                ELSE contype::text
            END AS constraint_type,
            pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conrelid = (
            SELECT c.oid FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE n.nspname = $1 AND c.relname = $2
        )
        ORDER BY conname;
    "#;
    let constraints = sqlx::query_as::<_, Constraint>(sql)
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await?;
    Ok(constraints)
}

pub async fn get_triggers(pool: &PgPool, schema: &str, table: &str) -> Result<Vec<Trigger>, AppError> {
    let sql = r#"
        SELECT 
            tgname AS name,
            pg_get_triggerdef(oid) AS definition
        FROM pg_trigger
        WHERE tgrelid = (
            SELECT c.oid FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE n.nspname = $1 AND c.relname = $2
        ) AND NOT tgisinternal
        ORDER BY tgname;
    "#;
    let triggers = sqlx::query_as::<_, Trigger>(sql)
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await?;
    Ok(triggers)
}

pub async fn get_functions(pool: &PgPool, schema: &str) -> Result<Vec<Function>, AppError> {
    let sql = r#"
        SELECT 
            p.proname AS name,
            n.nspname AS schema,
            format_type(p.prorettype, NULL) AS return_type,
            oidvectortypes(p.proargtypes) AS argument_types,
            l.lanname AS language,
            p.prosrc AS definition
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN pg_language l ON l.oid = p.prolang
        WHERE n.nspname = $1
        ORDER BY p.proname;
    "#;
    let functions = sqlx::query_as::<_, Function>(sql)
        .bind(schema)
        .fetch_all(pool)
        .await?;
    Ok(functions)
}

pub async fn get_sequences(pool: &PgPool, schema: &str) -> Result<Vec<Sequence>, AppError> {
    let sql = r#"
        SELECT 
            c.relname AS name,
            t.typname AS data_type,
            pg_sequence_last_value(c.oid) AS last_value
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_sequence s ON s.seqrelid = c.oid
        JOIN pg_type t ON t.oid = s.seqtypid
        WHERE n.nspname = $1
        ORDER BY c.relname;
    "#;
    let sequences = sqlx::query_as::<_, Sequence>(sql)
        .bind(schema)
        .fetch_all(pool)
        .await?;
    Ok(sequences)
}

pub async fn get_extensions(pool: &PgPool) -> Result<Vec<Extension>, AppError> {
    let sql = r#"
        SELECT 
            name,
            default_version,
            installed_version,
            comment
        FROM pg_available_extensions
        WHERE installed_version IS NOT NULL
        ORDER BY name;
    "#;
    let extensions = sqlx::query_as::<_, Extension>(sql)
        .fetch_all(pool)
        .await?;
    Ok(extensions)
}
