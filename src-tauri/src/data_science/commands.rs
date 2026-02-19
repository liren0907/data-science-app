// Allow dead code for Tauri command functions that are registered but not directly called
#[allow(dead_code)]
// Import data analysis library types
use data_science::{CSVLoadResult, DataPage, DataQuery};

// CSV File Operations

#[tauri::command]
pub async fn read_csv_file(file_path: String) -> Result<data_science::CSVContent, String> {
    data_science::read_csv_file(file_path)
}

#[tauri::command]
pub async fn validate_csv_file(file_path: String) -> Result<data_science::CsvValidationResult, String> {
    data_science::validate_csv_file(file_path)
}

#[tauri::command]
pub async fn scan_directory_for_csvs(dir_path: String) -> Result<Vec<data_science::CsvFileInfo>, String> {
    data_science::scan_directory_for_csvs(dir_path)
}

#[tauri::command]
pub async fn analyze_csv_columns(file_path: String) -> Result<Vec<data_science::ColumnAnalysis>, String> {
    data_science::analyze_csv_columns(file_path)
}

#[tauri::command]
pub async fn validate_data_quality(file_path: String) -> Result<data_science::DataQualityReport, String> {
    data_science::validate_data_quality(file_path)
}

#[tauri::command]
pub async fn export_to_csv(
    data: Vec<serde_json::Value>,
    file_path: String,
    options: data_science::ExportOptions,
) -> Result<(), String> {
    data_science::export_to_csv(data, file_path, options)
}

#[tauri::command]
pub async fn perform_data_science(
    file_path: String,
    analysis_type: String,
) -> Result<data_science::AnalysisResult, String> {
    data_science::perform_data_science(file_path, analysis_type).await
}

#[tauri::command]
pub async fn open_file_location(file_path: String) -> Result<(), String> {
    // For now, just return success. In a real implementation,
    // you might use Tauri's shell API to open the file location
    println!("Opening file location: {}", file_path);
    Ok(())
}

// Backend-Centric CSV Data Management Commands

#[tauri::command]
pub fn load_csv_into_store(file_path: String) -> Result<CSVLoadResult, String> {
    data_science::load_csv_into_store(&file_path)
}

#[tauri::command]
pub fn query_csv_data(query: DataQuery) -> Result<DataPage, String> {
    data_science::query_csv_data(&query)
}

#[tauri::command]
pub fn get_csv_headers(file_id: String) -> Result<Vec<String>, String> {
    data_science::get_csv_headers(&file_id)
}

#[tauri::command]
pub fn unload_csv_data(file_id: String) -> Result<(), String> {
    data_science::unload_csv_data(&file_id)
}

// Native Drag-and-Drop File Handling

#[tauri::command]
pub async fn process_dragged_csv(file_data: Vec<u8>, filename: String) -> Result<String, String> {
    use std::fs;

    // Use native app-specific temp directory (more structured than system temp)
    let app_temp_dir = std::env::temp_dir().join("data-science-app").join("dragged-files");

    // Create directory if it doesn't exist
    fs::create_dir_all(&app_temp_dir).map_err(|e| format!("Failed to create app temp directory: {}", e))?;

    // Generate unique filename with timestamp to avoid conflicts
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {}", e))?
        .as_millis();

    let unique_filename = format!("{}_{}", timestamp, filename);
    let file_path = app_temp_dir.join(unique_filename);

    // Write file data to app-specific temp directory
    fs::write(&file_path, file_data).map_err(|e| format!("Failed to write file: {}", e))?;

    println!("Saved dragged file to app temp: {}", file_path.display());

    // Return the path as string for processing
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn cleanup_dragged_file(file_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    // Get app-specific temp directory for safety check
    let app_temp_dir = std::env::temp_dir().join("data-science-app").join("dragged-files");

    let file_path_obj = Path::new(&file_path);

    // Only delete if it's in our app temp directory for security
    if file_path_obj.starts_with(&app_temp_dir) && file_path_obj.exists() {
        fs::remove_file(&file_path).map_err(|e| format!("Failed to cleanup dragged file: {}", e))?;
        println!("Cleaned up dragged file: {}", file_path);
    } else {
        println!("Skipping cleanup for file outside app temp directory: {}", file_path);
    }

    Ok(())
}
