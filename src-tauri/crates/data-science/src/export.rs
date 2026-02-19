use crate::types::ExportOptions;
use std::io::Write;

pub fn export_to_csv(data: Vec<serde_json::Value>, file_path: String, options: ExportOptions) -> Result<(), String> {
    let mut writer = std::fs::File::create(&file_path).map_err(|e| format!("Failed to create file: {}", e))?;

    // If we have data and include_headers is true, try to extract headers from first object
    if options.include_headers && !data.is_empty() {
        if let Some(first_item) = data.first() {
            if let Some(obj) = first_item.as_object() {
                let headers: Vec<String> = obj.keys().cloned().collect();
                let header_line = headers.join(&options.delimiter);
                writeln!(writer, "{}", header_line).map_err(|e| format!("Failed to write headers: {}", e))?;

                // Write data rows
                for item in &data {
                    if let Some(obj) = item.as_object() {
                        let values: Vec<String> = headers
                            .iter()
                            .map(|key| obj.get(key).and_then(|v| v.as_str()).unwrap_or("").to_string())
                            .collect();
                        let line = values.join(&options.delimiter);
                        writeln!(writer, "{}", line).map_err(|e| format!("Failed to write data row: {}", e))?;
                    }
                }
            }
        }
    } else {
        // Write data without headers
        for item in &data {
            if let Some(obj) = item.as_object() {
                let values: Vec<String> = obj.values().map(|v| v.as_str().unwrap_or("").to_string()).collect();
                let line = values.join(&options.delimiter);
                writeln!(writer, "{}", line).map_err(|e| format!("Failed to write data row: {}", e))?;
            }
        }
    }

    Ok(())
}
