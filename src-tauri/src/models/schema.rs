use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Database {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Schema {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Table {
    pub name: String,
    pub schema: String,
    pub is_view: bool,
    pub is_materialized_view: bool,
    pub is_partitioned: bool,
    pub is_foreign: bool,
    pub row_count_estimate: Option<i64>,
    pub comment: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Column {
    pub name: String,
    pub data_type: String,
    pub udt_name: String,
    pub is_nullable: bool,
    pub column_default: Option<String>,
    pub character_maximum_length: Option<i32>,
    pub numeric_precision: Option<i32>,
    pub numeric_scale: Option<i32>,
    pub is_identity: bool,
    pub is_generated: bool,
    pub is_primary_key: bool,
    pub is_foreign_key: bool,
    pub comment: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Index {
    pub name: String,
    pub table_name: String,
    pub is_unique: bool,
    pub is_primary: bool,
    pub definition: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Constraint {
    pub name: String,
    pub constraint_type: String,
    pub definition: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Trigger {
    pub name: String,
    pub definition: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Function {
    pub name: String,
    pub schema: String,
    pub return_type: String,
    pub argument_types: String,
    pub language: String,
    pub definition: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Sequence {
    pub name: String,
    pub data_type: String,
    pub last_value: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Extension {
    pub name: String,
    pub default_version: String,
    pub installed_version: Option<String>,
    pub comment: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateColumn {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub default: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IndexColumn {
    pub name: String,
    pub sort_order: String,
    pub nulls_order: String,
}
