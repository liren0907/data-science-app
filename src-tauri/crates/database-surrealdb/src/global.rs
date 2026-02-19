//! Global SurrealDB singleton and top-level API functions.
//!
//! This module owns the single shared `DatabaseManager` instance for the entire
//! application lifetime. All Tauri command wrappers call these free functions
//! instead of managing state themselves.

use crate::manager::DatabaseManager;
use crate::models::*;
use chrono::Utc;
use std::sync::{Arc, Mutex};

// Global singleton

static SURREAL_DB: Mutex<Option<Arc<DatabaseManager>>> = Mutex::new(None);

fn get_db() -> Result<Arc<DatabaseManager>, String> {
    SURREAL_DB
        .lock()
        .unwrap()
        .as_ref()
        .cloned()
        .ok_or_else(|| "SurrealDB not initialised. Call initialize() first.".to_string())
}

// Lifecycle

pub async fn initialize(db_path: &str) -> Result<(), String> {
    match DatabaseManager::new(db_path).await {
        Ok(db) => {
            *SURREAL_DB.lock().unwrap() = Some(Arc::new(db));
            println!("🗄️ SurrealDB initialised successfully");
            Ok(())
        }
        Err(e) => {
            let msg = format!("Failed to initialise SurrealDB: {}", e);
            eprintln!("❌ {}", msg);
            Err(msg)
        }
    }
}

pub async fn verify_connection() -> Result<(), String> {
    let db = get_db()?;
    db.get_stats()
        .await
        .map(|_| println!("✅ Database connection verified"))
        .map_err(|e| format!("Database connection test failed: {}", e))
}

// Safety Records

pub async fn create_safety_record(
    record_type: String,
    data: serde_json::Value,
    severity: String,
) -> Result<String, String> {
    let db = get_db()?;
    let record = SafetyRecord {
        id: None,
        record_type,
        timestamp: Utc::now().to_rfc3339(),
        data,
        severity,
        created_at: Utc::now().to_rfc3339(),
    };
    db.insert_safety_record(&record)
        .await
        .map(|id| format!("Safety record created with ID: {}", id))
        .map_err(|e| format!("Failed to create safety record: {}", e))
}

pub async fn get_safety_records(limit: Option<i32>) -> Result<serde_json::Value, String> {
    let db = get_db()?;
    db.get_safety_records(limit)
        .await
        .map(|r| serde_json::json!({ "success": true, "count": r.len(), "records": r }))
        .map_err(|e| format!("Failed to get safety records: {}", e))
}

pub async fn get_safety_records_by_severity(severity: String) -> Result<serde_json::Value, String> {
    let db = get_db()?;
    db.get_safety_records_by_severity(&severity)
        .await
        .map(|r| serde_json::json!({ "success": true, "count": r.len(), "severity": severity, "records": r }))
        .map_err(|e| format!("Failed to get safety records by severity: {}", e))
}

pub async fn get_database_stats() -> Result<serde_json::Value, String> {
    get_db()?
        .get_stats()
        .await
        .map_err(|e| format!("Failed to get database stats: {}", e))
}

pub async fn reset_database() -> Result<String, String> {
    get_db()?
        .reset_database()
        .await
        .map(|_| "Database reset successfully.".to_string())
        .map_err(|e| format!("Failed to reset database: {}", e))
}

pub async fn cleanup_old_records(days: i32) -> Result<String, String> {
    get_db()?
        .cleanup_old_records(days)
        .await
        .map(|n| format!("Cleaned up {} old records", n))
        .map_err(|e| format!("Failed to cleanup records: {}", e))
}

// Legacy Configuration

pub async fn save_configuration(name: String, content: serde_json::Value) -> Result<String, String> {
    let db = get_db()?;
    let cfg = Configuration {
        id: None,
        name,
        content: content.to_string(),
        updated_at: Utc::now().to_rfc3339(),
    };
    db.save_configuration(&cfg)
        .await
        .map(|id| format!("Configuration saved with ID: {}", id))
        .map_err(|e| format!("Failed to save configuration: {}", e))
}

pub async fn get_configuration(name: String) -> Result<serde_json::Value, String> {
    get_db()?
        .get_configuration(&name)
        .await
        .map(|opt| match opt {
            Some(cfg) => serde_json::json!({ "success": true, "configuration": cfg }),
            None => serde_json::json!({ "success": false, "message": format!("'{}' not found", name) }),
        })
        .map_err(|e| format!("Failed to get configuration: {}", e))
}

// Typed Config Tables

pub async fn save_stream_config(config_name: String, config_content: String) -> Result<String, String> {
    get_db()?
        .save_stream_config(&StreamConfig {
            id: None,
            config_name,
            config_content,
            created_at: Utc::now().to_rfc3339(),
        })
        .await
        .map_err(|e| format!("Failed to save stream config: {}", e))
}

pub async fn get_stream_configs() -> Result<Vec<StreamConfig>, String> {
    get_db()?
        .get_stream_configs()
        .await
        .map_err(|e| format!("Failed to get stream configs: {}", e))
}

pub async fn save_ogg_config(config_name: String, config_content: String) -> Result<String, String> {
    get_db()?
        .save_ogg_config(&OggConfig {
            id: None,
            config_name,
            config_content,
            created_at: Utc::now().to_rfc3339(),
        })
        .await
        .map_err(|e| format!("Failed to save OGG config: {}", e))
}

pub async fn get_ogg_configs() -> Result<Vec<OggConfig>, String> {
    get_db()?
        .get_ogg_configs()
        .await
        .map_err(|e| format!("Failed to get OGG configs: {}", e))
}

pub async fn save_org_config(config_name: String, config_content: String) -> Result<String, String> {
    get_db()?
        .save_org_config(&OrgConfig {
            id: None,
            config_name,
            config_content,
            created_at: Utc::now().to_rfc3339(),
        })
        .await
        .map_err(|e| format!("Failed to save ORG config: {}", e))
}

pub async fn get_org_configs() -> Result<Vec<OrgConfig>, String> {
    get_db()?
        .get_org_configs()
        .await
        .map_err(|e| format!("Failed to get ORG configs: {}", e))
}

pub async fn save_orsg_config(config_name: String, config_content: String) -> Result<String, String> {
    get_db()?
        .save_orsg_config(&OrsgConfig {
            id: None,
            config_name,
            config_content,
            created_at: Utc::now().to_rfc3339(),
        })
        .await
        .map_err(|e| format!("Failed to save ORSG config: {}", e))
}

pub async fn get_orsg_configs() -> Result<Vec<OrsgConfig>, String> {
    get_db()?
        .get_orsg_configs()
        .await
        .map_err(|e| format!("Failed to get ORSG configs: {}", e))
}

pub async fn save_event_config(config_name: String, config_content: String) -> Result<String, String> {
    get_db()?
        .save_event_config(&EventConfig {
            id: None,
            config_name,
            config_content,
            created_at: Utc::now().to_rfc3339(),
        })
        .await
        .map_err(|e| format!("Failed to save Event config: {}", e))
}

pub async fn get_event_configs() -> Result<Vec<EventConfig>, String> {
    get_db()?
        .get_event_configs()
        .await
        .map_err(|e| format!("Failed to get Event configs: {}", e))
}

pub async fn save_config_recipe(
    recipe_name: String,
    stream_config_id: Option<i64>,
    ogg_config_id: Option<i64>,
    org_config_id: Option<i64>,
    orsg_config_id: Option<i64>,
    event_config_id: Option<i64>,
) -> Result<String, String> {
    let recipe_content = serde_json::json!({
        "stream_config_id": stream_config_id,
        "ogg_config_id": ogg_config_id,
        "org_config_id": org_config_id,
        "orsg_config_id": orsg_config_id,
        "event_config_id": event_config_id,
    })
    .to_string();
    get_db()?
        .save_config_recipe(&ConfigRecipe {
            id: None,
            recipe_name,
            recipe_content,
            created_at: Utc::now().to_rfc3339(),
        })
        .await
        .map_err(|e| format!("Failed to save config recipe: {}", e))
}

pub async fn get_config_recipes() -> Result<Vec<ConfigRecipe>, String> {
    get_db()?
        .get_config_recipes()
        .await
        .map_err(|e| format!("Failed to get config recipes: {}", e))
}

// Generic CRUD (implemented via DatabaseManager generic methods)

pub async fn get_config(table: String, id: Option<i64>, name: Option<String>) -> Result<serde_json::Value, String> {
    get_db()?
        .get_generic(&table, id, name.as_deref())
        .await
        .map(|opt| match opt {
            Some(v) => serde_json::json!({ "success": true, "data": v }),
            None => serde_json::json!({ "success": false, "message": "Record not found" }),
        })
        .map_err(|e| format!("Failed to get config: {}", e))
}

pub async fn save_config(table: String, name: String, content: String) -> Result<serde_json::Value, String> {
    get_db()?
        .save_generic(&table, &name, &content)
        .await
        .map(|id| serde_json::json!({ "success": true, "id": id }))
        .map_err(|e| format!("Failed to save config: {}", e))
}

pub async fn update_config(table: String, id: i64, field: String, value: String) -> Result<serde_json::Value, String> {
    get_db()?
        .update_generic_field(&table, id, &field, &value)
        .await
        .map(|ok| serde_json::json!({ "success": ok }))
        .map_err(|e| format!("Failed to update config: {}", e))
}

pub async fn delete_config(table: String, id: Option<i64>, name: Option<String>) -> Result<serde_json::Value, String> {
    get_db()?
        .delete_generic(&table, id, name.as_deref())
        .await
        .map(|ok| serde_json::json!({ "success": ok }))
        .map_err(|e| format!("Failed to delete config: {}", e))
}

pub async fn search_configs(table: String, query: String, limit: Option<i32>) -> Result<serde_json::Value, String> {
    get_db()?
        .search_generic(&table, &query, limit)
        .await
        .map(|r| serde_json::json!({ "success": true, "count": r.len(), "results": r }))
        .map_err(|e| format!("Failed to search configs: {}", e))
}

pub async fn get_all_configs(table: String) -> Result<serde_json::Value, String> {
    get_db()?
        .get_all_generic(&table)
        .await
        .map(|data| serde_json::json!({ "success": true, "data": data }))
        .map_err(|e| format!("Failed to get all configs: {}", e))
}

pub async fn get_configs_paginated(
    table: String,
    page: i32,
    limit: i32,
    sort_by: Option<String>,
    sort_order: Option<String>,
) -> Result<serde_json::Value, String> {
    get_db()?
        .get_generic_paginated(&table, page, limit, sort_by.as_deref(), sort_order.as_deref())
        .await
        .map_err(|e| format!("Failed to get paginated configs: {}", e))
}
