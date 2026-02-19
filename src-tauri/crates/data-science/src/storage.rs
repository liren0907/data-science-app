use crate::parser::{read_csv_file, validate_csv_file};
use crate::types::*;
use crate::utils::{apply_filters, apply_sorting, calculate_memory_usage, infer_data_types};
use chrono::Utc;
use std::collections::HashMap;

lazy_static::lazy_static! {
    static ref CSV_DATA_STORE: std::sync::Mutex<HashMap<String, CSVDataStore>> = std::sync::Mutex::new(HashMap::new());
}

// Backend-centric CSV data management functions
pub fn load_csv_into_store(file_path: &str) -> Result<CSVLoadResult, String> {
    let file_path_string = file_path.to_string();

    // Generate unique file ID
    let file_id = format!("csv_{}", chrono::Utc::now().timestamp_millis());

    // Read and validate CSV file
    let csv_content = read_csv_file(file_path_string.clone())?;
    let validation = validate_csv_file(file_path_string.clone())?;

    if !validation.is_valid {
        return Ok(CSVLoadResult {
            file_id,
            success: false,
            metadata: DataMetadata {
                row_count: 0,
                column_count: 0,
                file_size: csv_content.file_size as u64,
                encoding: csv_content.encoding,
                delimiter: validation.delimiter,
                has_headers: validation.has_headers,
                estimated_memory_usage: 0,
            },
            headers: Vec::new(),
            error_message: Some("CSV file validation failed".to_string()),
        });
    }

    // Parse CSV data
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(validation.delimiter.as_bytes()[0])
        .has_headers(validation.has_headers)
        .from_reader(csv_content.content.as_bytes());

    let mut raw_data = Vec::new();

    // Read headers
    let headers: Vec<String> = if validation.has_headers {
        if let Ok(header_record) = reader.headers() {
            header_record.iter().map(|s| s.to_string()).collect()
        } else {
            // Fallback: generate column names
            (0..validation.column_count)
                .map(|i| format!("Column {}", i + 1))
                .collect()
        }
    } else {
        // No headers, generate column names
        (0..validation.column_count)
            .map(|i| format!("Column {}", i + 1))
            .collect()
    };

    // Read data rows
    for result in reader.records() {
        match result {
            Ok(record) => {
                let row: Vec<String> = record.iter().map(|s| s.to_string()).collect();
                raw_data.push(row);
            }
            Err(e) => {
                eprintln!("Error reading CSV record: {}", e);
                // Continue processing other records
            }
        }
    }

    // Process data with type inference
    let processed_data = infer_data_types(&raw_data, &headers);

    // Calculate memory usage estimate
    let estimated_memory = calculate_memory_usage(&processed_data);

    let metadata = DataMetadata {
        row_count: raw_data.len(),
        column_count: headers.len(),
        file_size: csv_content.file_size as u64,
        encoding: csv_content.encoding,
        delimiter: validation.delimiter,
        has_headers: validation.has_headers,
        estimated_memory_usage: estimated_memory,
    };

    // Create data store entry
    let data_store = CSVDataStore {
        file_id: file_id.clone(),
        file_path: file_path.to_string(),
        headers: headers.clone(),
        raw_data,
        processed_data,
        metadata: metadata.clone(),
        filters: HashMap::new(),
        sort_config: None,
        created_at: Utc::now().to_rfc3339(),
        last_accessed: Utc::now().to_rfc3339(),
    };

    // Store in global data store
    {
        let mut store = CSV_DATA_STORE
            .lock()
            .map_err(|e| format!("Failed to lock data store: {}", e))?;
        store.insert(file_id.clone(), data_store);
    }

    Ok(CSVLoadResult {
        file_id,
        success: true,
        metadata,
        headers,
        error_message: None,
    })
}

pub fn query_csv_data(query: &DataQuery) -> Result<DataPage, String> {
    let mut store = CSV_DATA_STORE
        .lock()
        .map_err(|e| format!("Failed to lock data store: {}", e))?;

    let data_store = store
        .get_mut(&query.file_id)
        .ok_or_else(|| format!("CSV file with ID '{}' not found", query.file_id))?;

    // Update last accessed time
    data_store.last_accessed = chrono::Utc::now().to_rfc3339();

    // Apply filters
    data_store.filters = query.filters.clone();
    let filtered_indices = apply_filters(&data_store.processed_data, &query.filters);

    // Apply sorting
    let mut sorted_indices = filtered_indices;
    if let Some(sort_spec) = &query.sort {
        sorted_indices = apply_sorting(&sorted_indices, &data_store.processed_data, sort_spec);
    }

    // Apply pagination
    let total_filtered = sorted_indices.len();
    let start_idx = (query.pagination.page - 1) * query.pagination.page_size;
    let end_idx = std::cmp::min(start_idx + query.pagination.page_size, total_filtered);

    let page_indices: Vec<usize> = sorted_indices[start_idx..end_idx].to_vec();

    // Extract data for current page
    let page_data: Vec<HashMap<String, serde_json::Value>> = page_indices
        .iter()
        .map(|&idx| data_store.processed_data[idx].clone())
        .collect();

    let total_pages = (total_filtered + query.pagination.page_size - 1) / query.pagination.page_size;

    Ok(DataPage {
        data: page_data,
        total_rows: data_store.processed_data.len(),
        filtered_rows: total_filtered,
        current_page: query.pagination.page,
        total_pages,
        page_size: query.pagination.page_size,
        has_next: query.pagination.page < total_pages,
        has_prev: query.pagination.page > 1,
    })
}

pub fn get_csv_headers(file_id: &str) -> Result<Vec<String>, String> {
    let store = CSV_DATA_STORE
        .lock()
        .map_err(|e| format!("Failed to lock data store: {}", e))?;

    let data_store = store
        .get(file_id)
        .ok_or_else(|| format!("CSV file with ID '{}' not found", file_id))?;

    Ok(data_store.headers.clone())
}

pub fn unload_csv_data(file_id: &str) -> Result<(), String> {
    let mut store = CSV_DATA_STORE
        .lock()
        .map_err(|e| format!("Failed to lock data store: {}", e))?;
    store.remove(file_id);
    Ok(())
}
