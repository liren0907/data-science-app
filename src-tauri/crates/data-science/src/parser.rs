use crate::analysis::infer_data_type;
use crate::types::*;
use crate::utils::detect_encoding;
use chrono::{DateTime, Utc};
use std::fs;
use std::path::Path;

pub fn read_csv_file(file_path: String) -> Result<CSVContent, String> {
    // Check if file exists and get metadata
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    let metadata = fs::metadata(&file_path).map_err(|e| format!("Failed to read file metadata: {}", e))?;

    let file_size = metadata.len();
    let modified: DateTime<Utc> = metadata
        .modified()
        .map_err(|e| format!("Failed to get modification time: {}", e))?
        .into();
    let created: DateTime<Utc> = metadata
        .created()
        .map_err(|e| format!("Failed to get creation time: {}", e))?
        .into();

    // Detect encoding
    let content_bytes = fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let encoding_name = detect_encoding(&content_bytes);

    // Convert to UTF-8 if needed
    let content = String::from_utf8_lossy(&content_bytes).to_string();

    // Detect delimiter
    let delimiter = detect_delimiter(&content)?;

    // Estimate rows
    let estimated_rows = content.lines().count().saturating_sub(1); // Subtract header row

    let file_metadata = FileMetadata {
        size: file_size,
        created: created.to_rfc3339(),
        modified: modified.to_rfc3339(),
        permissions: format!("{:?}", metadata.permissions()),
        extension: path.extension().and_then(|ext| ext.to_str()).unwrap_or("").to_string(),
        mime_type: "text/csv".to_string(),
    };

    Ok(CSVContent {
        content: content.to_string(),
        metadata: file_metadata,
        encoding: encoding_name,
        estimated_rows,
        can_process: true,
        file_size: file_size as usize,
        delimiter: Some(delimiter),
    })
}

pub fn validate_csv_file(file_path: String) -> Result<CsvValidationResult, String> {
    let content = fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let delimiter = detect_delimiter(&content)?;
    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() {
        return Err("File is empty".to_string());
    }

    // Detect encoding
    let content_bytes = fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;
    let encoding_name = detect_encoding(&content_bytes);

    // Check for headers (simple heuristic: if first row contains strings that look like headers)
    let first_row = lines[0];
    let column_count = first_row.split(&delimiter).count();
    let has_headers = is_likely_header_row(first_row, &delimiter);

    let estimated_rows = if has_headers && lines.len() > 1 {
        (lines.len() - 1) as u64
    } else {
        lines.len() as u64
    };

    Ok(CsvValidationResult {
        is_valid: true,
        delimiter,
        estimated_rows,
        encoding: encoding_name,
        has_headers,
        column_count,
    })
}

pub fn scan_directory_for_csvs(dir_path: String) -> Result<Vec<CsvFileInfo>, String> {
    let path = Path::new(&dir_path);
    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let mut csv_files = Vec::new();

    for entry in fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_path = entry.path();

        // Check if it's a CSV file
        if let Some(extension) = file_path.extension() {
            if extension.to_str().unwrap_or("").to_lowercase() == "csv" {
                let metadata = entry
                    .metadata()
                    .map_err(|e| format!("Failed to read metadata: {}", e))?;

                let modified: DateTime<Utc> = metadata
                    .modified()
                    .map_err(|e| format!("Failed to get modification time: {}", e))?
                    .into();

                let file_path_str = file_path.to_string_lossy().to_string();
                let file_name = file_path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();

                // Validate the CSV file
                let validation_result = match validate_csv_file(file_path_str.clone()) {
                    Ok(result) => result,
                    Err(_e) => CsvValidationResult {
                        is_valid: false,
                        delimiter: ",".to_string(),
                        estimated_rows: 0,
                        encoding: "unknown".to_string(),
                        has_headers: false,
                        column_count: 0,
                    },
                };

                csv_files.push(CsvFileInfo {
                    path: file_path_str,
                    name: file_name,
                    size: metadata.len(),
                    modified: modified.to_rfc3339(),
                    validation_result,
                });
            }
        }
    }

    Ok(csv_files)
}

pub fn analyze_csv_columns(file_path: String) -> Result<Vec<ColumnAnalysis>, String> {
    let content = fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let delimiter = detect_delimiter(&content)?;
    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() {
        return Err("File is empty".to_string());
    }

    let first_row = lines[0];
    let headers: Vec<String> = first_row.split(&delimiter).map(|s| s.trim().to_string()).collect();

    let mut column_data: Vec<Vec<String>> = vec![Vec::new(); headers.len()];
    let mut total_rows = 0;

    // Collect data for each column
    for line in lines.iter().skip(1) {
        let values: Vec<String> = line.split(&delimiter).map(|s| s.trim().to_string()).collect();

        if values.len() == headers.len() {
            for (i, value) in values.iter().enumerate() {
                if i < column_data.len() {
                    column_data[i].push(value.clone());
                }
            }
            total_rows += 1;
        }
    }

    let mut analyses = Vec::new();

    for (i, header) in headers.iter().enumerate() {
        let column_values = &column_data[i];
        let null_count = column_values.iter().filter(|v| v.is_empty() || *v == "").count();
        let null_percentage = if total_rows > 0 {
            (null_count as f64 / total_rows as f64) * 100.0
        } else {
            0.0
        };

        let unique_values: std::collections::HashSet<String> = column_values.iter().cloned().collect();
        let unique_count = unique_values.len();

        let data_type = infer_data_type(column_values);

        let sample_values = column_values.iter().take(5).cloned().collect();

        analyses.push(ColumnAnalysis {
            name: header.clone(),
            data_type,
            nullable: null_count > 0,
            unique_count,
            null_percentage,
            sample_values,
        });
    }

    Ok(analyses)
}

pub fn validate_data_quality(file_path: String) -> Result<DataQualityReport, String> {
    let content = fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let delimiter = detect_delimiter(&content)?;
    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() {
        return Err("File is empty".to_string());
    }

    let mut issues = Vec::new();
    let mut recommendations = Vec::new();
    let mut duplicate_count = 0;

    // Check for duplicate rows
    let mut seen_rows = std::collections::HashSet::new();
    for (_i, line) in lines.iter().enumerate().skip(1) {
        // Skip header
        if !seen_rows.insert(*line) {
            duplicate_count += 1;
        }
    }

    // Check for completeness
    let first_row = lines[0];
    let column_count = first_row.split(&delimiter).count();
    let mut total_cells = 0;
    let mut empty_cells = 0;

    for line in lines.iter().skip(1) {
        let cells: Vec<&str> = line.split(&delimiter).collect();
        total_cells += column_count;
        empty_cells += cells.iter().filter(|cell| cell.trim().is_empty()).count();
    }

    let completeness_score = if total_cells > 0 {
        ((total_cells - empty_cells) as f64 / total_cells as f64) * 100.0
    } else {
        100.0
    };

    // Generate issues and recommendations
    if duplicate_count > 0 {
        issues.push(format!("Found {} duplicate rows", duplicate_count));
        recommendations.push("Consider removing duplicate rows to improve data quality".to_string());
    }

    if completeness_score < 80.0 {
        issues.push(format!("Data completeness is only {:.1}%", completeness_score));
        recommendations.push("Review and fill missing values to improve completeness".to_string());
    }

    if column_count < 2 {
        issues.push("File appears to have only one column".to_string());
        recommendations.push("Verify that the correct delimiter is being used".to_string());
    }

    let overall_score = (completeness_score + (if duplicate_count == 0 { 100.0 } else { 50.0 })) / 2.0;

    Ok(DataQualityReport {
        overall_score,
        issues,
        recommendations,
        duplicate_count,
        completeness_score,
    })
}

pub fn detect_delimiter(content: &str) -> Result<String, String> {
    let sample = &content[..content.len().min(10000)]; // Sample first 10KB
    let delimiters = [",", ";", "\t", "|"];

    let mut best_delimiter = ",";
    let mut max_consistency = 0;

    for delimiter in &delimiters {
        let lines: Vec<&str> = sample.lines().take(10).collect(); // Check first 10 lines
        if lines.len() < 2 {
            continue;
        }

        let counts: Vec<usize> = lines.iter().map(|line| line.split(delimiter).count()).collect();

        if counts.len() > 1 {
            let first_count = counts[0];
            let consistency = counts.iter().filter(|&&count| count == first_count).count();
            if consistency > max_consistency {
                max_consistency = consistency;
                best_delimiter = delimiter;
            }
        }
    }

    Ok(best_delimiter.to_string())
}

pub fn is_likely_header_row(row: &str, delimiter: &str) -> bool {
    let values: Vec<&str> = row.split(delimiter).collect();
    if values.len() < 2 {
        return false;
    }

    // Simple heuristic: if most values contain letters and are reasonably short
    let text_like_count = values
        .iter()
        .filter(|v| {
            let trimmed = v.trim();
            !trimmed.is_empty() && trimmed.chars().any(|c| c.is_alphabetic()) && trimmed.len() < 50
        })
        .count();

    text_like_count >= (values.len() + 1) / 2 // Majority are text-like
}
