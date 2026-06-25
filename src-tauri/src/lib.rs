pub mod error;
pub mod models;
pub mod config;
pub mod ssh;
pub mod db;
pub mod commands;

use std::sync::Arc;
use tokio::sync::Mutex;
use db::PoolManager;

pub struct AppState {
    pub pool_manager: Arc<Mutex<PoolManager>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = AppState {
        pool_manager: Arc::new(Mutex::new(PoolManager::new())),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::connection::list_saved_connections,
            commands::connection::save_connection,
            commands::connection::delete_connection,
            commands::connection::test_connection,
            commands::connection::create_connection,
            commands::connection::disconnect,
            commands::connection::parse_connection_url,
            commands::connection::get_connection_password,
            commands::query::execute_query,
            commands::query::explain_query,
            commands::query::cancel_query,
            commands::schema::get_databases,
            commands::schema::get_schemas,
            commands::schema::get_tables,
            commands::schema::get_columns,
            commands::schema::get_indexes,
            commands::schema::get_constraints,
            commands::schema::get_triggers,
            commands::schema::get_functions,
            commands::schema::get_sequences,
            commands::schema::get_sequence_details,
            commands::schema::drop_sequence,
            commands::schema::get_extensions,
            commands::schema::get_table_ddl,
            commands::schema::get_function_ddl,
            commands::schema::drop_view,
            commands::schema::drop_function,
            commands::schema::generate_select_sql,
            commands::schema::generate_insert_sql,
            commands::schema::truncate_table,
            commands::schema::drop_table,
            commands::schema::create_table,
            commands::schema::alter_table_add_column,
            commands::schema::alter_table_drop_column,
            commands::schema::alter_table_rename_column,
            commands::schema::rename_table,
            commands::schema::vacuum_table,
            commands::schema::analyze_table,
            commands::schema::alter_table_alter_column_type,
            commands::schema::alter_table_alter_column_nullable,
            commands::schema::alter_table_alter_column_default,
            commands::schema::drop_constraint,
            commands::schema::drop_trigger,
            commands::schema::rename_index,
            commands::schema::create_index,
            commands::schema::drop_index,
            commands::data::get_table_data,
            commands::data::update_row,
            commands::data::insert_row,
            commands::data::delete_rows,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::tabs::save_tab_state,
            commands::tabs::load_tab_state,
            commands::query_favorites::list_query_favorites,
            commands::query_favorites::save_query_favorite,
            commands::query_favorites::delete_query_favorite,
            commands::query_history::get_query_history,
            commands::query_history::clear_query_history,
            commands::sql_scripts::list_sql_scripts,
            commands::sql_scripts::save_sql_script,
            commands::sql_scripts::load_sql_script,
            commands::sql_scripts::delete_sql_script,
            commands::sql_scripts::rename_sql_script,
            commands::import::import_sql_file,
            commands::import::import_csv_file,
            commands::import::import_json_file,
            commands::admin::get_server_info,
            commands::admin::get_active_queries,
            commands::admin::get_table_stats,
            commands::admin::cancel_backend,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
