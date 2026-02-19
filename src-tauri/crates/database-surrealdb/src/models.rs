use serde::{Deserialize, Serialize};
use surrealdb::sql::Thing;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyRecord {
    pub id: Option<Thing>,
    pub record_type: String,
    pub timestamp: String,
    pub data: serde_json::Value,
    pub severity: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Configuration {
    pub id: Option<Thing>,
    pub name: String,
    pub content: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamConfig {
    pub id: Option<Thing>,
    pub config_name: String,
    pub config_content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OggConfig {
    pub id: Option<Thing>,
    pub config_name: String,
    pub config_content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrgConfig {
    pub id: Option<Thing>,
    pub config_name: String,
    pub config_content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrsgConfig {
    pub id: Option<Thing>,
    pub config_name: String,
    pub config_content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventConfig {
    pub id: Option<Thing>,
    pub config_name: String,
    pub config_content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigRecipe {
    pub id: Option<Thing>,
    pub recipe_name: String,
    pub recipe_content: String,
    pub created_at: String,
}
