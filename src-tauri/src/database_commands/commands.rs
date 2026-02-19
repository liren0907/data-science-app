//! Tauri Database Commands
//!
//! Thin wrappers over `database_surrealdb::global` free functions.
//! No logic here — each function simply forwards its arguments to the crate.

// Safety Records

#[tauri::command]
pub async fn create_safety_record(
    record_type: String,
    data: serde_json::Value,
    severity: String,
) -> Result<String, String> {
    database_surrealdb::create_safety_record(record_type, data, severity).await
}

#[tauri::command]
pub async fn get_safety_records(limit: Option<i32>) -> Result<serde_json::Value, String> {
    database_surrealdb::get_safety_records(limit).await
}

#[tauri::command]
pub async fn get_safety_records_by_severity(severity: String) -> Result<serde_json::Value, String> {
    database_surrealdb::get_safety_records_by_severity(severity).await
}

#[tauri::command]
pub async fn get_database_stats() -> Result<serde_json::Value, String> {
    database_surrealdb::get_database_stats().await
}

#[tauri::command]
pub async fn reset_database() -> Result<String, String> {
    database_surrealdb::reset_database().await
}

#[tauri::command]
pub async fn cleanup_old_records(days: i32) -> Result<String, String> {
    database_surrealdb::cleanup_old_records(days).await
}

// Legacy Configuration

#[tauri::command]
pub async fn save_configuration(name: String, content: serde_json::Value) -> Result<String, String> {
    database_surrealdb::save_configuration(name, content).await
}

#[tauri::command]
pub async fn get_configuration(name: String) -> Result<serde_json::Value, String> {
    database_surrealdb::get_configuration(name).await
}

// Typed Config Tables

#[tauri::command]
pub async fn save_stream_config(config_name: String, config_content: String) -> Result<String, String> {
    database_surrealdb::save_stream_config(config_name, config_content).await
}

#[tauri::command]
pub async fn get_stream_configs() -> Result<Vec<database_surrealdb::StreamConfig>, String> {
    database_surrealdb::get_stream_configs().await
}

#[tauri::command]
pub async fn save_ogg_config(config_name: String, config_content: String) -> Result<String, String> {
    database_surrealdb::save_ogg_config(config_name, config_content).await
}

#[tauri::command]
pub async fn get_ogg_configs() -> Result<Vec<database_surrealdb::OggConfig>, String> {
    database_surrealdb::get_ogg_configs().await
}

#[tauri::command]
pub async fn save_org_config(config_name: String, config_content: String) -> Result<String, String> {
    database_surrealdb::save_org_config(config_name, config_content).await
}

#[tauri::command]
pub async fn get_org_configs() -> Result<Vec<database_surrealdb::OrgConfig>, String> {
    database_surrealdb::get_org_configs().await
}

#[tauri::command]
pub async fn save_orsg_config(config_name: String, config_content: String) -> Result<String, String> {
    database_surrealdb::save_orsg_config(config_name, config_content).await
}

#[tauri::command]
pub async fn get_orsg_configs() -> Result<Vec<database_surrealdb::OrsgConfig>, String> {
    database_surrealdb::get_orsg_configs().await
}

#[tauri::command]
pub async fn save_event_config(config_name: String, config_content: String) -> Result<String, String> {
    database_surrealdb::save_event_config(config_name, config_content).await
}

#[tauri::command]
pub async fn get_event_configs() -> Result<Vec<database_surrealdb::EventConfig>, String> {
    database_surrealdb::get_event_configs().await
}

#[tauri::command]
pub async fn save_config_recipe(
    recipe_name: String,
    stream_config_id: Option<i64>,
    ogg_config_id: Option<i64>,
    org_config_id: Option<i64>,
    orsg_config_id: Option<i64>,
    event_config_id: Option<i64>,
) -> Result<String, String> {
    database_surrealdb::save_config_recipe(
        recipe_name,
        stream_config_id,
        ogg_config_id,
        org_config_id,
        orsg_config_id,
        event_config_id,
    )
    .await
}

#[tauri::command]
pub async fn get_config_recipes() -> Result<Vec<database_surrealdb::ConfigRecipe>, String> {
    database_surrealdb::get_config_recipes().await
}

// Generic CRUD

#[tauri::command]
pub async fn get_config(table: String, id: Option<i64>, name: Option<String>) -> Result<serde_json::Value, String> {
    database_surrealdb::get_config(table, id, name).await
}

#[tauri::command]
pub async fn save_config(table: String, name: String, content: String) -> Result<serde_json::Value, String> {
    database_surrealdb::save_config(table, name, content).await
}

#[tauri::command]
pub async fn update_config(table: String, id: i64, field: String, value: String) -> Result<serde_json::Value, String> {
    database_surrealdb::update_config(table, id, field, value).await
}

#[tauri::command]
pub async fn delete_config(table: String, id: Option<i64>, name: Option<String>) -> Result<serde_json::Value, String> {
    database_surrealdb::delete_config(table, id, name).await
}

#[tauri::command]
pub async fn search_configs(table: String, query: String, limit: Option<i32>) -> Result<serde_json::Value, String> {
    database_surrealdb::search_configs(table, query, limit).await
}

#[tauri::command]
pub async fn get_all_configs(table: String) -> Result<serde_json::Value, String> {
    database_surrealdb::get_all_configs(table).await
}

#[tauri::command]
pub async fn get_configs_paginated(
    table: String,
    page: i32,
    limit: i32,
    sort_by: Option<String>,
    sort_order: Option<String>,
) -> Result<serde_json::Value, String> {
    database_surrealdb::get_configs_paginated(table, page, limit, sort_by, sort_order).await
}
