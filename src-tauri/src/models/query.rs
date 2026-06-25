use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub udt_name: String,
    pub oid: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueryResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub affected_rows: u64,
    pub execution_time_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_count: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DataOptions {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub sort_column: Option<String>,
    pub sort_direction: Option<String>, // ASC or DESC
    pub filter_column: Option<String>,
    pub filter_value: Option<String>,
    pub filter_operator: Option<String>, // contains, equals, not_equals, starts_with, ends_with, greater, greater_equal, less, less_equal, is_null, is_not_null
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExplainResult {
    pub plan: serde_json::Value,
    pub execution_time_ms: u64,
}
