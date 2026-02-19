// Module access for library compilation
#[cfg(feature = "tauri")]
use crate::data_science;
#[cfg(feature = "tauri")]
#[cfg(feature = "tauri")]
use crate::database_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    let mut builder = tauri::Builder::default();

    builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(dev)]
    {}

    builder
        .setup(|_app| {
            // Initialise SurrealDB when the app starts
            tauri::async_runtime::block_on(async {
                // Use the external crate 'database_surrealdb'
                match database_surrealdb::initialize("surrealdb_database.db").await {
                    Ok(_) => match database_surrealdb::verify_connection().await {
                        Ok(_) => {}
                        Err(e) => eprintln!("❌ Database verification failed: {}", e),
                    },
                    Err(e) => eprintln!("❌ Failed to initialise SurrealDB: {}", e),
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // SurrealDB Commands
            database_commands::create_safety_record,
            database_commands::get_safety_records,
            database_commands::get_safety_records_by_severity,
            database_commands::get_database_stats,
            database_commands::reset_database,
            database_commands::save_configuration,
            database_commands::get_configuration,
            database_commands::cleanup_old_records,
            // New 5+1 Table Schema Commands
            database_commands::save_stream_config,
            database_commands::get_stream_configs,
            database_commands::save_ogg_config,
            database_commands::get_ogg_configs,
            database_commands::save_org_config,
            database_commands::get_org_configs,
            database_commands::save_orsg_config,
            database_commands::get_orsg_configs,
            database_commands::save_event_config,
            database_commands::get_event_configs,
            database_commands::save_config_recipe,
            database_commands::get_config_recipes,
            // Generic CRUD Commands
            database_commands::get_config,
            database_commands::save_config,
            database_commands::update_config,
            database_commands::delete_config,
            database_commands::search_configs,
            database_commands::get_all_configs,
            database_commands::get_configs_paginated,
            // CSV Data Analysis Commands
            data_science::read_csv_file,
            data_science::validate_csv_file,
            data_science::scan_directory_for_csvs,
            data_science::analyze_csv_columns,
            data_science::validate_data_quality,
            data_science::export_to_csv,
            data_science::perform_data_science,
            data_science::open_file_location,
            // Store-backed CSV commands
            data_science::load_csv_into_store,
            data_science::query_csv_data,
            data_science::get_csv_headers,
            data_science::unload_csv_data,
            // Drag-and-drop CSV commands
            data_science::process_dragged_csv,
            data_science::cleanup_dragged_file,
        ])
        .run(context)
        .expect("error while running tauri application");
}
