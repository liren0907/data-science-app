use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Data structures for CSV processing
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CSVContent {
    pub content: String,
    pub metadata: FileMetadata,
    pub encoding: String,
    pub estimated_rows: usize,
    pub can_process: bool,
    pub file_size: usize,
    pub delimiter: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileMetadata {
    pub size: u64,
    pub created: String,
    pub modified: String,
    pub permissions: String,
    pub extension: String,
    pub mime_type: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CsvValidationResult {
    pub is_valid: bool,
    pub delimiter: String,
    pub estimated_rows: u64,
    pub encoding: String,
    pub has_headers: bool,
    pub column_count: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CsvFileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: String,
    pub validation_result: CsvValidationResult,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ColumnAnalysis {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub unique_count: usize,
    pub null_percentage: f64,
    pub sample_values: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DataQualityReport {
    pub overall_score: f64,
    pub issues: Vec<String>,
    pub recommendations: Vec<String>,
    pub duplicate_count: usize,
    pub completeness_score: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExportOptions {
    pub delimiter: String,
    pub include_headers: bool,
    pub encoding: String,
    pub quote_fields: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AnalysisResult {
    pub analysis_type: String,
    pub summary: serde_json::Value,
    pub insights: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CSVDataStore {
    pub file_id: String,
    pub file_path: String,
    pub headers: Vec<String>,
    pub raw_data: Vec<Vec<String>>,                              // Original parsed rows
    pub processed_data: Vec<HashMap<String, serde_json::Value>>, // Parsed with types
    pub metadata: DataMetadata,
    pub filters: HashMap<String, FilterSpec>,
    pub sort_config: Option<SortSpec>,
    pub created_at: String,
    pub last_accessed: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DataMetadata {
    pub row_count: usize,
    pub column_count: usize,
    pub file_size: u64,
    pub encoding: String,
    pub delimiter: String,
    pub has_headers: bool,
    pub estimated_memory_usage: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FilterSpec {
    pub column: String,
    pub operator: String, // "equals", "contains", "greater_than", "less_than", etc.
    pub value: serde_json::Value,
    pub case_sensitive: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SortSpec {
    pub column: String,
    pub direction: String, // "asc", "desc"
    pub case_sensitive: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PaginationSpec {
    pub page: usize,
    pub page_size: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DataQuery {
    pub file_id: String,
    pub filters: HashMap<String, FilterSpec>,
    pub sort: Option<SortSpec>,
    pub pagination: PaginationSpec,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DataPage {
    pub data: Vec<HashMap<String, serde_json::Value>>,
    pub total_rows: usize,
    pub filtered_rows: usize,
    pub current_page: usize,
    pub total_pages: usize,
    pub page_size: usize,
    pub has_next: bool,
    pub has_prev: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CSVLoadResult {
    pub file_id: String,
    pub success: bool,
    pub metadata: DataMetadata,
    pub headers: Vec<String>,
    pub error_message: Option<String>,
}
