# Database System Architecture & Configuration Management

## Overview

The Safety AI Database System provides a comprehensive SQLite-based configuration management solution for the Tauri application. This document outlines the complete architecture, from database schema to frontend integration, reflecting the current implementation state.

## Table of Contents

- [Database Schema](#database-schema)
- [Backend Architecture](#backend-architecture)
- [Tauri Commands API](#tauri-commands-api)
- [Frontend Integration](#frontend-integration)
- [Security & Validation](#security--validation)
- [Performance & Optimization](#performance--optimization)
- [Migration & Compatibility](#migration--compatibility)

## Database Schema

### Current Schema (6+1 Tables)

The database uses SQLite with 7 total tables: 5 configuration tables, 1 recipe table, and 1 legacy table.

#### Configuration Tables (5 Types)

| Table | Purpose | Primary Key | Unique Constraint |
|-------|---------|-------------|-------------------|
| `stream_configs` | Video/camera/RTSP source configs | `id` (INTEGER) | `config_name` |
| `ogg_configs` | OpenVINO Graphics configs | `id` (INTEGER) | `config_name` |
| `org_configs` | Object Recognition Graphics configs | `id` (INTEGER) | `config_name` |
| `orsg_configs` | Object Recognition Scene Graph configs | `id` (INTEGER) | `config_name` |
| `event_configs` | Event processing configs | `id` (INTEGER) | `config_name` |

#### Recipe Table (1 Type)

| Table | Purpose | Primary Key | Foreign Keys |
|-------|---------|-------------|--------------|
| `config_recipes` | Configuration combinations | `id` (INTEGER) | All config table IDs |

#### Legacy Tables

| Table | Purpose | Status |
|-------|---------|--------|
| `safety_records` | Safety monitoring records | Read-only |
| `configurations` | Legacy single config table | Deprecated |

### Schema Definition

```sql
-- Configuration Tables (5 types)
CREATE TABLE IF NOT EXISTS stream_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_name TEXT UNIQUE NOT NULL,
    config_content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ogg_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_name TEXT UNIQUE NOT NULL,
    config_content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS org_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_name TEXT UNIQUE NOT NULL,
    config_content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orsg_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_name TEXT UNIQUE NOT NULL,
    config_content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_name TEXT UNIQUE NOT NULL,
    config_content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Recipe Table (1 type)
CREATE TABLE IF NOT EXISTS config_recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_name TEXT UNIQUE NOT NULL,
    stream_config_id INTEGER,
    ogg_config_id INTEGER,
    org_config_id INTEGER,
    orsg_config_id INTEGER,
    event_config_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (stream_config_id) REFERENCES stream_configs(id) ON DELETE SET NULL,
    FOREIGN KEY (ogg_config_id) REFERENCES ogg_configs(id) ON DELETE SET NULL,
    FOREIGN KEY (org_config_id) REFERENCES org_configs(id) ON DELETE SET NULL,
    FOREIGN KEY (orsg_config_id) REFERENCES orsg_configs(id) ON DELETE SET NULL,
    FOREIGN KEY (event_config_id) REFERENCES event_configs(id) ON DELETE SET NULL
);

-- Legacy Tables
CREATE TABLE IF NOT EXISTS safety_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    data TEXT NOT NULL,
    severity TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Backend Architecture

### DatabaseManager Structure

```rust
pub struct DatabaseManager {
    conn: Mutex<Connection>,
}

impl DatabaseManager {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let mut manager = Self { conn: Mutex::new(conn) };
        manager.initialize_tables()?;
        Ok(manager)
    }
}
```

### Thread Safety

The database uses `Arc<Mutex<DatabaseManager>>` for thread-safe operations:

```rust
static SQLITE_DB: Mutex<Option<Arc<Mutex<DatabaseManager>>>> = Mutex::new(None);

pub fn initialize_sqlite_database(db_path: &str) -> Result<(), String> {
    match DatabaseManager::new(db_path) {
        Ok(db) => {
            *SQLITE_DB.lock().unwrap() = Some(Arc::new(Mutex::new(db)));
            Ok(())
        }
        Err(e) => Err(format!("Failed to initialize SQLite database: {}", e))
    }
}
```

### Validation System

Comprehensive validation with regex and length checks:

```rust
pub fn validate_config_name(name: &str) -> Result<(), String> {
    let rules = ValidationRules::default();
    if name.is_empty() {
        return Err("Configuration name cannot be empty".to_string());
    }
    if name.len() > rules.max_name_length {
        return Err(format!("Configuration name too long (max {} chars)", rules.max_name_length));
    }
    if !rules.allowed_name_chars.is_match(name) {
        return Err("Configuration name contains invalid characters".to_string());
    }
    Ok(())
}
```

## Tauri Commands API

### Command Architecture

The system provides both **type-specific commands** and **generic CRUD commands** for maximum flexibility.

#### Type-Specific Commands (10 commands)

**Save Commands:**
- `save_stream_config(config_name, config_content) -> i64`
- `save_ogg_config(config_name, config_content) -> i64`
- `save_org_config(config_name, config_content) -> i64`
- `save_orsg_config(config_name, config_content) -> i64`
- `save_event_config(config_name, config_content) -> i64`

**Load Commands:**
- `get_stream_configs() -> Vec<StreamConfig>`
- `get_ogg_configs() -> Vec<OggConfig>`
- `get_org_configs() -> Vec<OrgConfig>`
- `get_orsg_configs() -> Vec<OrsgConfig>`
- `get_event_configs() -> Vec<EventConfig>`

#### Recipe Commands (2 commands)

- `save_config_recipe(recipe_name, stream_config_id?, ogg_config_id?, org_config_id?, orsg_config_id?, event_config_id?) -> i64`
- `get_config_recipes() -> Vec<ConfigRecipe>`

#### Generic CRUD Commands (7 core + 4 convenience = 11 commands)

**Core Generic Commands:**
- `get_config(table, id?, name?) -> serde_json::Value`
- `save_config(table, name, content) -> serde_json::Value`
- `update_config(table, id, field, value) -> serde_json::Value`
- `delete_config(table, id?, name?) -> serde_json::Value`
- `search_configs(table, query, limit?) -> serde_json::Value`
- `get_all_configs(table) -> serde_json::Value`
- `get_configs_paginated(table, page, limit, sort_by?, sort_order?) -> serde_json::Value`

**Convenience Commands:**
- `get_config_by_id(table, id) -> serde_json::Value`
- `get_config_by_name(table, name) -> serde_json::Value`
- `delete_config_by_id(table, id) -> serde_json::Value`
- `delete_config_by_name(table, name) -> serde_json::Value`

#### Legacy Commands (8 commands)

- `create_safety_record(record_type, data, severity) -> String`
- `get_safety_records(limit?) -> serde_json::Value`
- `get_safety_records_by_severity(severity) -> serde_json::Value`
- `get_database_stats() -> serde_json::Value`
- `reset_database() -> String`
- `save_configuration(name, content) -> String`
- `get_configuration(name) -> serde_json::Value`
- `cleanup_old_records(days) -> String`

### Command Registration

All commands are registered in `src-tauri/src/commands.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    // Database Commands (31 total)
    database::create_safety_record,
    database::get_safety_records,
    database::get_safety_records_by_severity,
    database::get_database_stats,
    database::reset_database,
    database::save_configuration,
    database::get_configuration,
    database::cleanup_old_records,

    // Type-specific Commands (10)
    database::save_stream_config, database::get_stream_configs,
    database::save_ogg_config, database::get_ogg_configs,
    database::save_org_config, database::get_org_configs,
    database::save_orsg_config, database::get_orsg_configs,
    database::save_event_config, database::get_event_configs,

    // Recipe Commands (2)
    database::save_config_recipe, database::get_config_recipes,

    // Generic CRUD Commands (11)
    database::get_config, database::save_config, database::update_config,
    database::delete_config, database::search_configs, database::get_all_configs,
    database::get_configs_paginated, database::get_config_by_id,
    database::get_config_by_name, database::delete_config_by_id,
    database::delete_config_by_name,
])
```

## Frontend Integration

### DatabaseConfigPicker Component

The `DatabaseConfigPicker.svelte` component provides the user interface for configuration management.

#### Component Features

- **Multi-Type Support**: Handles all 5 configuration types simultaneously
- **Auto-Population**: Automatically fills configuration editors when selections are made
- **Visual Status**: Shows loading states and selection status
- **Event System**: Dispatches events for parent component communication

#### Component Structure

```typescript
interface DatabaseConfigPickerProps {
    availableConfigs: {
        stream: DatabaseConfig[];
        ogg: DatabaseConfig[];
        org: DatabaseConfig[];
        orsg: DatabaseConfig[];
        event: DatabaseConfig[];
    };
    selectedConfigs: {
        stream: DatabaseConfig | null;
        ogg: DatabaseConfig | null;
        org: DatabaseConfig | null;
        orsg: DatabaseConfig | null;
        event: DatabaseConfig | null;
    };
}

interface DatabaseConfig {
    id: number;
    config_name: string;
    config_content: string;
    created_at: string;
}
```

#### Event System

```typescript
// Dispatched Events
dispatch('configSelected', {
    configType: string,
    config: DatabaseConfig
});

dispatch('selectionsCleared');
dispatch('mergeSelected');
dispatch('saveAsTemplate', {
    templateName: string,
    selectedConfigs: SelectedConfigs
});
```

### ConfigurationPanel Integration

The parent `ConfigurationPanel.svelte` integrates the DatabaseConfigPicker:

```typescript
<DatabaseConfigPicker
    {availableConfigs}
    {selectedConfigs}
    on:configSelected={handleConfigSelected}
    on:saveAsTemplate={handleSaveAsRecipe}
/>
```

### API Wrapper Classes

#### Generic ConfigAPI Class

```typescript
export class ConfigAPI {
    static async get<T>(params: GetConfigParams): Promise<ApiResponse<T>>
    static async save(params: SaveConfigParams): Promise<ApiResponse<{ id: number }>>
    static async update(params: UpdateConfigParams): Promise<ApiResponse<boolean>>
    static async delete(params: DeleteConfigParams): Promise<ApiResponse<boolean>>
    static async search<T>(params: SearchConfigParams): Promise<ApiResponse<T[]>>
    static async getPaginated<T>(params: PaginationParams): Promise<PaginatedResponse<T>>
}
```

#### Specialized API Classes

```typescript
export class StreamConfigAPI extends ConfigAPI {
    static async saveStreamConfig(name: string, config: StreamConfigData): Promise<ApiResponse<{ id: number }>>
    static async getById(id: number): Promise<ApiResponse<StreamConfig>>
    static async getByName(name: string): Promise<ApiResponse<StreamConfig>>
}
```

### Type Definitions

#### Frontend Types

```typescript
// Generic config structure
interface BaseConfig {
    id: number | null;
    config_name?: string;
    config_content?: string;
    created_at?: string;
}

// Specific config types
interface StreamConfig extends BaseConfig {
    id: number | null;
    config_name: string;
    config_content: string;
    created_at: string;
}

// Recipe type
interface ConfigRecipe {
    id: number | null;
    recipe_name: string;
    stream_config_id: number | null;
    ogg_config_id: number | null;
    org_config_id: number | null;
    orsg_config_id: number | null;
    event_config_id: number | null;
    created_at: string;
}
```

#### Backend Types

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamConfig {
    pub id: Option<i64>,
    pub config_name: String,
    pub config_content: String,
    pub created_at: String,
}
```

## Security & Validation

### Input Validation

#### Backend Validation Rules

```rust
#[derive(Debug, Clone)]
pub struct ValidationRules {
    pub max_name_length: usize,        // 255 chars
    pub max_content_length: usize,     // 1MB
    pub allowed_name_chars: Regex,     // ^[a-zA-Z0-9_-]+$
}
```

#### Validation Functions

- `validate_config_name(name: &str)` - Name format validation
- `validate_json_content(content: &str)` - JSON structure validation
- `validate_table_name(table: &str)` - Table name validation
- `validate_table_operation(table: &str, operation: &str)` - Operation permission validation

### Security Features

#### SQL Injection Prevention

- Parameterized queries for all database operations
- Input sanitization with regex validation
- Table name whitelisting

#### Access Control

```rust
const VALID_TABLES: &[&str] = &[
    "stream_configs", "ogg_configs", "org_configs",
    "orsg_configs", "event_configs", "config_recipes"
];

const READONLY_TABLES: &[&str] = &[
    "safety_records"  // Legacy table - read-only for safety
];
```

### Error Handling

#### Backend Error Patterns

```rust
#[tauri::command]
pub async fn save_config(table: String, name: String, content: String) -> Result<serde_json::Value, String> {
    // Validation
    if let Err(validation_error) = validate_save_params(&table, &name, &content) {
        return Err(validation_error);
    }

    // Database operation
    match db.save_config_generic(&table, &name, &content) {
        Ok(id) => Ok(serde_json::json!({
            "success": true,
            "id": id,
            "message": format!("Configuration '{}' saved successfully", name)
        })),
        Err(e) => Err(format!("Failed to save config: {}", e))
    }
}
```

#### Frontend Error Handling

```typescript
try {
    const result = await ConfigAPI.save(params);
    if (result.success) {
        showSuccess(result.message || 'Configuration saved');
        return result.data;
    } else {
        showError(result.error || 'Unknown error occurred');
        throw new Error(result.error);
    }
} catch (error) {
    console.error('Save operation failed:', error);
    showError('Failed to save configuration');
    throw error;
}
```

## Performance & Optimization

### Database Optimizations

#### Indexing Strategy

```sql
-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_stream_configs_name ON stream_configs(config_name);
CREATE INDEX IF NOT EXISTS idx_stream_configs_created_at ON stream_configs(created_at);
-- Similar indexes for all config tables
CREATE INDEX IF NOT EXISTS idx_config_recipes_recipe_name ON config_recipes(recipe_name);
```

#### Connection Management

- Thread-safe connection pooling with `Arc<Mutex<DatabaseManager>>`
- Automatic reconnection on connection failures
- Connection health monitoring

### Query Optimizations

#### Prepared Statements

The system uses prepared statements for all database operations to improve performance and security.

#### Batch Operations

```rust
impl DatabaseManager {
    pub fn save_configs_batch(&mut self, configs: Vec<(String, String)>) -> Result<Vec<i64>, rusqlite::Error> {
        let tx = self.conn.transaction()?;
        let mut ids = Vec::new();

        for (name, content) in configs {
            tx.execute(
                "INSERT INTO stream_configs (config_name, config_content, created_at)
                 VALUES (?1, ?2, datetime('now'))",
                params![name, content]
            )?;
            ids.push(tx.last_insert_rowid());
        }

        tx.commit()?;
        Ok(ids)
    }
}
```

### Frontend Optimizations

#### Caching System

```typescript
export class ConfigCache {
    private cache = new Map<string, CacheEntry>();
    private readonly ttl = 5 * 60 * 1000; // 5 minutes

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry || Date.now() - entry.timestamp > this.ttl) {
            return null;
        }
        return entry.data as T;
    }

    set<T>(key: string, data: T): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
}
```

#### Request Batching

```typescript
export class RequestBatcher {
    private queue = new Map<string, BatchedRequest>();

    batch<T>(key: string, operation: () => Promise<T>): Promise<T> {
        // Implementation for request batching and debouncing
    }
}
```

## Migration & Compatibility

### Schema Evolution

The system supports smooth migration from legacy to new schema:

```sql
-- Migration path (already implemented)
-- 1. Create new 5+1 tables alongside existing ones
-- 2. Migrate data if needed
-- 3. Update application to use new tables
-- 4. Deprecate old tables when ready
```

### Command Compatibility

#### Backward Compatibility

- Legacy commands (`save_configuration`, `get_configuration`) remain functional
- New generic commands work alongside type-specific commands
- Gradual migration path for frontend components

#### Migration Strategy

1. **Phase 1**: Implement new schema and commands alongside existing ones
2. **Phase 2**: Update frontend components to use new commands
3. **Phase 3**: Deprecate and remove old commands when no longer needed

### Testing Strategy

#### Unit Tests

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_generic_crud_validation() {
        // Test validation functions
    }

    #[test]
    fn test_save_config_generic_success() {
        // Test successful save operations
    }

    #[test]
    fn test_concurrent_access() {
        // Test thread safety
    }
}
```

#### Integration Tests

- End-to-end configuration workflows
- Frontend-backend communication
- Concurrent operation handling

## Usage Examples

### Basic Configuration Management

```typescript
// Save a stream configuration
const result = await ConfigAPI.save({
    table: 'stream_configs',
    name: 'production_camera_1',
    content: JSON.stringify({
        resolution: '1920x1080',
        fps: 30,
        codec: 'h264'
    })
});

// Load all stream configurations
const configs = await ConfigAPI.getAll('stream_configs');

// Search configurations
const searchResults = await ConfigAPI.search({
    table: 'stream_configs',
    query: 'camera',
    limit: 10
});
```

### Recipe Management

```typescript
// Save a complete configuration recipe
const recipeResult = await ConfigAPI.saveRecipe({
    recipeName: 'production_setup_v1',
    streamConfigId: 1,
    oggConfigId: 2,
    orgConfigId: 3,
    orsgConfigId: 4,
    eventConfigId: 5
});

// Load all recipes with resolved configurations
const recipes = await ConfigAPI.getRecipes();
```

### Advanced Operations

```typescript
// Paginated loading with sorting
const paginatedResult = await ConfigAPI.getPaginated({
    table: 'stream_configs',
    page: 1,
    limit: 20,
    sortBy: 'created_at',
    sortOrder: 'desc'
});

// Update specific fields
const updateResult = await ConfigAPI.update({
    table: 'stream_configs',
    id: 123,
    field: 'config_content',
    value: JSON.stringify(updatedConfig)
});
```

## Conclusion

The Safety AI Database System provides a robust, scalable, and secure configuration management solution with:

- **Flexible Schema**: 5+1 table architecture supporting complex configuration relationships
- **Dual API**: Both type-specific and generic CRUD commands for maximum flexibility
- **Security**: Comprehensive validation, SQL injection prevention, and access control
- **Performance**: Optimized queries, caching, and connection management
- **Maintainability**: Well-structured code with comprehensive testing
- **Scalability**: Support for future configuration types and operations

The system successfully balances the need for type-specific operations with the benefits of generic CRUD patterns, providing both developer-friendly APIs and end-user functionality.
