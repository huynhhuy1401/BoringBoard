use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub total_rows: u32,
    pub inserted: u32,
    pub failed: u32,
    pub errors: Vec<String>,
}
