# Data Analysis Module Architecture

## 1. Overview

The `data-analysis` module is a powerful and comprehensive toolkit for parsing, analyzing, and managing CSV data within the AI-App ecosystem. It provides a suite of functions for data validation, quality assessment, in-memory storage, and analysis. The module is designed to be robust and efficient, with a clear separation of concerns between parsing, storage, and analysis.

## 2. Core Data Structures

The module defines a rich set of data structures in `types.rs` to represent CSV data and analysis results.

- **`CSVContent`**: Represents the content and metadata of a CSV file.
- **`CsvValidationResult`**: Contains the results of a CSV file validation, including delimiter, row count, and encoding.
- **`CsvFileInfo`**: A summary of a CSV file, including its path, size, and validation result.
- **`ColumnAnalysis`**: Provides detailed analysis of a single column, including data type, null percentage, and unique values.
- **`DataQualityReport`**: A report on the quality of a CSV file, with an overall score and a list of issues.
- **`CSVDataStore`**: The main in-memory data store for a loaded CSV file, containing raw and processed data, metadata, and filter/sort configurations.
- **`DataQuery`**: Represents a query to be performed on the in-memory data, with specifications for filtering, sorting, and pagination.
- **`DataPage`**: A paginated result of a data query.

## 3. Module Breakdown

The `data-analysis` crate is organized into several modules, each with a specific responsibility.

- **`parser.rs`**: Handles the parsing and validation of CSV files. It can detect delimiters, encodings, and header rows, and it provides functions for analyzing column structure and data quality.
- **`storage.rs`**: Manages the in-memory storage of CSV data. It uses a `lazy_static` `Mutex`-wrapped `HashMap` to store `CSVDataStore` objects, allowing for efficient querying and manipulation of loaded data.
- **`analysis.rs`**: Contains the core data analysis logic. It can infer data types, perform summary analysis, and conduct more advanced analyses like correlation, distribution, and outlier detection.
- **`export.rs`**: Provides functionality for exporting data to CSV files with customizable options.
- **`utils.rs`**: Contains a collection of utility functions for tasks like data type inference, filtering, sorting, and memory usage calculation.
- **`types.rs`**: Defines all the data structures used throughout the crate.
- **`lib.rs`**: The main library file that re-exports the public API of the other modules.

## 4. Public API & Tauri Commands

The `data-analysis` module exposes a comprehensive API for working with CSV data. Many of these functions are also exposed as Tauri commands, making them directly callable from the frontend.

### Exposed Tauri Commands:

- **`read_csv_file`**: Reads a CSV file and returns its content and metadata.
- **`validate_csv_file`**: Validates a CSV file and returns a `CsvValidationResult`.
- **`scan_directory_for_csvs`**: Scans a directory for CSV files and returns a list of `CsvFileInfo` objects.
- **`analyze_csv_columns`**: Analyzes the columns of a CSV file and returns a list of `ColumnAnalysis` objects.
- **`validate_data_quality`**: Assesses the quality of a CSV file and returns a `DataQualityReport`.
- **`export_to_csv`**: Exports data to a CSV file.
- **`perform_data_analysis`**: Performs a specified type of analysis on a CSV file.
- **`load_csv_into_store`**: Loads a CSV file into the in-memory data store.
- **`query_csv_data`**: Queries the in-memory data store with filtering, sorting, and pagination.
- **`get_csv_headers`**: Gets the headers of a loaded CSV file.
- **`unload_csv_data`**: Removes a CSV file from the in-memory data store.
- **`open_file_location`**: Opens the file location in the system's file explorer.
- **`process_dragged_csv`**: A command to handle dragged and dropped CSV files.
- **`cleanup_dragged_file`**: A command to clean up temporary files after a drag-and-drop operation.

## 5. Usage Examples

### Example 1: Loading and Querying Data

```rust
// This is a Rust example of how to use the functions.
// In the frontend, you would use Tauri's invoke function.
use data_analysis::{load_csv_into_store, query_csv_data, DataQuery, PaginationSpec};
use std::collections::HashMap;

fn manage_csv_data() {
    // Load a CSV file into the store
    let load_result = load_csv_into_store("path/to/your/data.csv");
    match load_result {
        Ok(result) => {
            if result.success {
                let file_id = result.file_id;

                // Query the loaded data
                let query = DataQuery {
                    file_id: file_id.clone(),
                    filters: HashMap::new(), // No filters
                    sort: None, // No sorting
                    pagination: PaginationSpec { page: 1, page_size: 10 },
                };

                let query_result = query_csv_data(&query);
                match query_result {
                    Ok(page) => {
                        println!("Page 1 data: {:?}", page.data);
                        println!("Total rows: {}", page.total_rows);
                    }
                    Err(e) => eprintln!("Query failed: {}", e),
                }

                // Unload the data when done
                let _ = unload_csv_data(&file_id);
            } else {
                eprintln!("Failed to load CSV: {}", result.error_message.unwrap_or_default());
            }
        }
        Err(e) => eprintln!("Load failed: {}", e),
    }
}
```

### Example 2: Performing Data Analysis

```rust
// This is a Rust example of how to use the function.
use data_analysis::perform_data_analysis;

async fn analyze_data() {
    let analysis_result = perform_data_analysis("path/to/your/data.csv".to_string(), "summary".to_string()).await;
    match analysis_result {
        Ok(result) => {
            println!("Analysis Summary: {:?}", result.summary);
            println!("Insights: {:?}", result.insights);
        }
        Err(e) => eprintln!("Analysis failed: {}", e),
    }
}
```
