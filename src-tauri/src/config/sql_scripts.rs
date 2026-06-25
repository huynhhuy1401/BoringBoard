use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SqlScript {
    pub name: String,
    pub path: String,
    pub sql: String,
    pub modified_at: String,
}

fn get_scripts_dir() -> Result<PathBuf, AppError> {
    let home = dirs::home_dir().ok_or_else(|| {
        AppError::Config("Could not find home directory".to_string())
    })?;
    let path = home.join("boringboard-scripts");
    if !path.exists() {
        fs::create_dir_all(&path)?;
    }
    Ok(path)
}

pub fn list_scripts() -> Result<Vec<SqlScript>, AppError> {
    let dir = get_scripts_dir()?;
    let mut scripts = Vec::new();

    let entries = fs::read_dir(&dir)?;
    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "sql") {
            let metadata = fs::metadata(&path)?;
            let modified = metadata.modified()?;
            let modified_at: chrono::DateTime<chrono::Utc> = modified.into();

            let name = path.file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let sql = fs::read_to_string(&path).unwrap_or_default();

            scripts.push(SqlScript {
                name,
                path: path.to_string_lossy().to_string(),
                sql,
                modified_at: modified_at.to_rfc3339(),
            });
        }
    }

    scripts.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(scripts)
}

pub fn save_script(name: &str, sql: &str) -> Result<SqlScript, AppError> {
    let dir = get_scripts_dir()?;
    let path = dir.join(format!("{}.sql", name));
    fs::write(&path, sql)?;

    let metadata = fs::metadata(&path)?;
    let modified = metadata.modified()?;
    let modified_at: chrono::DateTime<chrono::Utc> = modified.into();

    Ok(SqlScript {
        name: name.to_string(),
        path: path.to_string_lossy().to_string(),
        sql: sql.to_string(),
        modified_at: modified_at.to_rfc3339(),
    })
}

pub fn load_script(path: &str) -> Result<SqlScript, AppError> {
    let p = PathBuf::from(path);
    if !p.exists() {
        return Err(AppError::Config(format!("Script not found: {}", path)));
    }

    let metadata = fs::metadata(&p)?;
    let modified = metadata.modified()?;
    let modified_at: chrono::DateTime<chrono::Utc> = modified.into();

    let name = p.file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let sql = fs::read_to_string(&p)?;

    Ok(SqlScript {
        name,
        path: p.to_string_lossy().to_string(),
        sql,
        modified_at: modified_at.to_rfc3339(),
    })
}

pub fn delete_script(path: &str) -> Result<(), AppError> {
    let p = PathBuf::from(path);
    if p.exists() {
        fs::remove_file(&p)?;
    }
    Ok(())
}

pub fn rename_script(old_path: &str, new_name: &str) -> Result<SqlScript, AppError> {
    let old = PathBuf::from(old_path);
    if !old.exists() {
        return Err(AppError::Config(format!("Script not found: {}", old_path)));
    }

    let dir = old.parent().ok_or_else(|| {
        AppError::Config("Could not determine script directory".to_string())
    })?;
    let new_path = dir.join(format!("{}.sql", new_name));
    fs::rename(&old, &new_path)?;

    let sql = fs::read_to_string(&new_path)?;
    let metadata = fs::metadata(&new_path)?;
    let modified = metadata.modified()?;
    let modified_at: chrono::DateTime<chrono::Utc> = modified.into();

    Ok(SqlScript {
        name: new_name.to_string(),
        path: new_path.to_string_lossy().to_string(),
        sql,
        modified_at: modified_at.to_rfc3339(),
    })
}
