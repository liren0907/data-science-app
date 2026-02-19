use crate::models::*;
use anyhow::Result;
use surrealdb::Surreal;
use surrealdb::engine::local::{Db, SurrealKv};

pub struct DatabaseManager {
    pub db: Surreal<Db>,
}

impl DatabaseManager {
    pub async fn new(db_path: &str) -> Result<Self> {
        // Initialize SurrealDB with RocksDB/SurrealKV at the specified path
        let db: Surreal<Db> = Surreal::new::<SurrealKv>(db_path).await?;

        // Use a default namespace and database
        db.use_ns("data_science_app").use_db("main").await?;

        Ok(Self { db })
    }

    // --- Safety Records ---

    pub async fn insert_safety_record(&self, record: &SafetyRecord) -> Result<String> {
        // Cloning data because SurrealDB create takes ownership or requires 'static lifetime for references
        let created: Option<SafetyRecord> = self.db.create("safety_records").content(record.clone()).await?;
        match created {
            Some(r) => Ok(r.id.map(|t| t.to_string()).unwrap_or_default()),
            None => Err(anyhow::anyhow!("Failed to create safety record")),
        }
    }

    pub async fn get_safety_records(&self, limit: Option<i32>) -> Result<Vec<SafetyRecord>> {
        let mut query = "SELECT * FROM safety_records ORDER BY timestamp DESC".to_string();
        if let Some(l) = limit {
            query.push_str(&format!(" LIMIT {}", l));
        }
        let records: Vec<SafetyRecord> = self.db.query(query).await?.take(0)?;
        Ok(records)
    }

    pub async fn get_safety_records_by_severity(&self, severity: &str) -> Result<Vec<SafetyRecord>> {
        let records: Vec<SafetyRecord> = self
            .db
            .query("SELECT * FROM safety_records WHERE severity = $severity ORDER BY timestamp DESC")
            .bind(("severity", severity.to_string()))
            .await?
            .take(0)?;
        Ok(records)
    }

    pub async fn get_stats(&self) -> Result<serde_json::Value> {
        // Implement database stats gathering here
        // For now, return a placeholder or partial stats
        Ok(serde_json::json!({
            "success": true,
            "message": "Stats not fully implemented for SurrealDB yet"
        }))
    }

    pub async fn reset_database(&self) -> Result<()> {
        // Warning: This deletes everything in the current namespace/database
        // self.db.query("REMOVE DATABASE main").await?; // Example, be careful
        // self.db.use_ns("data_science_app").use_db("main").await?;
        Ok(())
    }

    pub async fn cleanup_old_records(&self, _days: i32) -> Result<u64> {
        // Implement cleanup logic
        Ok(0)
    }

    async fn get_configs_generic<T: for<'de> serde::Deserialize<'de> + Send + Sync + 'static>(
        &self,
        table: &str,
    ) -> Result<Vec<T>> {
        let configs: Vec<T> = self.db.select(table).await?;
        Ok(configs)
    }

    // --- Stream Configs ---
    pub async fn save_stream_config(&self, config: &StreamConfig) -> Result<String> {
        let created: Option<StreamConfig> = self.db.create("stream_configs").content(config.clone()).await?;
        Ok(created.and_then(|c| c.id).map(|t| t.to_string()).unwrap_or_default())
    }

    pub async fn get_stream_configs(&self) -> Result<Vec<StreamConfig>> {
        self.get_configs_generic("stream_configs").await
    }

    // --- OGG Configs ---
    pub async fn save_ogg_config(&self, config: &OggConfig) -> Result<String> {
        let created: Option<OggConfig> = self.db.create("ogg_configs").content(config.clone()).await?;
        Ok(created.and_then(|c| c.id).map(|t| t.to_string()).unwrap_or_default())
    }

    pub async fn get_ogg_configs(&self) -> Result<Vec<OggConfig>> {
        self.get_configs_generic("ogg_configs").await
    }

    // --- ORG Configs ---
    pub async fn save_org_config(&self, config: &OrgConfig) -> Result<String> {
        let created: Option<OrgConfig> = self.db.create("org_configs").content(config.clone()).await?;
        Ok(created.and_then(|c| c.id).map(|t| t.to_string()).unwrap_or_default())
    }

    pub async fn get_org_configs(&self) -> Result<Vec<OrgConfig>> {
        self.get_configs_generic("org_configs").await
    }

    // --- ORSG Configs ---
    pub async fn save_orsg_config(&self, config: &OrsgConfig) -> Result<String> {
        let created: Option<OrsgConfig> = self.db.create("orsg_configs").content(config.clone()).await?;
        Ok(created.and_then(|c| c.id).map(|t| t.to_string()).unwrap_or_default())
    }

    pub async fn get_orsg_configs(&self) -> Result<Vec<OrsgConfig>> {
        self.get_configs_generic("orsg_configs").await
    }

    // --- Event Configs ---
    pub async fn save_event_config(&self, config: &EventConfig) -> Result<String> {
        let created: Option<EventConfig> = self.db.create("event_configs").content(config.clone()).await?;
        Ok(created.and_then(|c| c.id).map(|t| t.to_string()).unwrap_or_default())
    }

    pub async fn get_event_configs(&self) -> Result<Vec<EventConfig>> {
        self.get_configs_generic("event_configs").await
    }

    // --- Config Recipes ---
    pub async fn save_config_recipe(&self, config: &ConfigRecipe) -> Result<String> {
        let created: Option<ConfigRecipe> = self.db.create("config_recipes").content(config.clone()).await?;
        Ok(created.and_then(|c| c.id).map(|t| t.to_string()).unwrap_or_default())
    }

    pub async fn get_config_recipes(&self) -> Result<Vec<ConfigRecipe>> {
        self.get_configs_generic("config_recipes").await
    }

    // --- Legacy Configurations ---
    pub async fn save_configuration(&self, config: &Configuration) -> Result<String> {
        let created: Option<Configuration> = self.db.create("configurations").content(config.clone()).await?;
        Ok(created.and_then(|c| c.id).map(|t| t.to_string()).unwrap_or_default())
    }

    pub async fn get_configuration(&self, name: &str) -> Result<Option<Configuration>> {
        let mut result = self
            .db
            .query("SELECT * FROM configurations WHERE name = $name")
            .bind(("name", name.to_string()))
            .await?;
        let config: Option<Configuration> = result.take(0)?;
        Ok(config)
    }

    // ============================================================
    // Generic CRUD — operate on any table via serde_json::Value
    // ============================================================

    /// Get a record from any config table by name or by ID.
    pub async fn get_generic(
        &self,
        table: &str,
        id: Option<i64>,
        name: Option<&str>,
    ) -> Result<Option<serde_json::Value>> {
        let mut result = if let Some(name_val) = name {
            self.db
                .query("SELECT * FROM type::table($table) WHERE config_name = $name LIMIT 1")
                .bind(("table", table.to_string()))
                .bind(("name", name_val.to_string()))
                .await?
        } else if let Some(id_val) = id {
            self.db
                .query("SELECT * FROM type::table($table) WHERE id = $id LIMIT 1")
                .bind(("table", table.to_string()))
                .bind(("id", id_val))
                .await?
        } else {
            return Ok(None);
        };
        let record: Option<serde_json::Value> = result.take(0)?;
        Ok(record)
    }

    /// Save (create) a new record in any config table.
    pub async fn save_generic(&self, table: &str, name: &str, content: &str) -> Result<String> {
        let now = chrono::Utc::now().to_rfc3339();
        let mut result = self
            .db
            .query("CREATE type::table($table) SET config_name = $name, config_content = $content, created_at = $ts")
            .bind(("table", table.to_string()))
            .bind(("name", name.to_string()))
            .bind(("content", content.to_string()))
            .bind(("ts", now))
            .await?;
        let created: Option<serde_json::Value> = result.take(0)?;
        Ok(created
            .and_then(|v| v.get("id").cloned())
            .map(|v| v.to_string())
            .unwrap_or_default())
    }

    /// Update a single named field on a record in any config table.
    pub async fn update_generic_field(&self, table: &str, id: i64, field: &str, value: &str) -> Result<bool> {
        // Validate field name to prevent SurrealQL injection
        if !field.chars().all(|c| c.is_alphanumeric() || c == '_') {
            anyhow::bail!("Invalid field name: {}", field);
        }
        let query = format!("UPDATE type::table($table) SET {} = $value WHERE id = $id", field);
        self.db
            .query(query)
            .bind(("table", table.to_string()))
            .bind(("value", value.to_string()))
            .bind(("id", id))
            .await?;
        Ok(true)
    }

    /// Delete a record from any config table by name or ID.
    pub async fn delete_generic(&self, table: &str, id: Option<i64>, name: Option<&str>) -> Result<bool> {
        if let Some(name_val) = name {
            self.db
                .query("DELETE FROM type::table($table) WHERE config_name = $name")
                .bind(("table", table.to_string()))
                .bind(("name", name_val.to_string()))
                .await?;
        } else if let Some(id_val) = id {
            self.db
                .query("DELETE FROM type::table($table) WHERE id = $id")
                .bind(("table", table.to_string()))
                .bind(("id", id_val))
                .await?;
        } else {
            return Ok(false);
        }
        Ok(true)
    }

    /// Search records in any config table by config_name (substring match).
    pub async fn search_generic(&self, table: &str, query: &str, limit: Option<i32>) -> Result<Vec<serde_json::Value>> {
        let lim = limit.unwrap_or(50);
        let mut result = self
            .db
            .query("SELECT * FROM type::table($table) WHERE string::contains(config_name, $query) LIMIT $lim")
            .bind(("table", table.to_string()))
            .bind(("query", query.to_string()))
            .bind(("lim", lim))
            .await?;
        let records: Vec<serde_json::Value> = result.take(0)?;
        Ok(records)
    }

    /// Fetch all records from any config table.
    pub async fn get_all_generic(&self, table: &str) -> Result<Vec<serde_json::Value>> {
        let records: Vec<serde_json::Value> = self
            .db
            .query("SELECT * FROM type::table($table)")
            .bind(("table", table.to_string()))
            .await?
            .take(0)?;
        Ok(records)
    }

    /// Fetch a paginated, optionally sorted page from any config table.
    pub async fn get_generic_paginated(
        &self,
        table: &str,
        page: i32,
        limit: i32,
        sort_by: Option<&str>,
        sort_order: Option<&str>,
    ) -> Result<serde_json::Value> {
        let page = page.max(1);
        let limit = limit.max(1);
        let start = (page - 1) * limit;

        let order_clause = match sort_by {
            Some(col) if col.chars().all(|c| c.is_alphanumeric() || c == '_') => {
                let dir = if sort_order.map(|o| o.to_uppercase()) == Some("DESC".to_string()) {
                    "DESC"
                } else {
                    "ASC"
                };
                format!(" ORDER BY {} {}", col, dir)
            }
            _ => String::new(),
        };

        let query = format!(
            "SELECT * FROM type::table($table){} LIMIT $limit START $start",
            order_clause
        );
        let mut result = self
            .db
            .query(query)
            .bind(("table", table.to_string()))
            .bind(("limit", limit))
            .bind(("start", start))
            .await?;
        let records: Vec<serde_json::Value> = result.take(0)?;

        // Total count for pagination metadata
        let mut count_result = self
            .db
            .query("SELECT count() FROM type::table($table) GROUP ALL")
            .bind(("table", table.to_string()))
            .await?;
        let count_val: Option<serde_json::Value> = count_result.take(0)?;
        let total: i64 = count_val
            .and_then(|v| v.get("count").and_then(|c| c.as_i64()))
            .unwrap_or(0);
        let total_pages = ((total as f64) / (limit as f64)).ceil() as i64;

        Ok(serde_json::json!({
            "success": true,
            "data": records,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages,
                "has_next": (page as i64) < total_pages,
                "has_prev": page > 1
            }
        }))
    }
}
