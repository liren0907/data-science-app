// Module declarations
pub mod analysis;
pub mod export;
pub mod parser;
pub mod storage;
pub mod types;
pub mod utils;

// Re-export public types and functions for external use
pub use analysis::perform_data_science;
pub use export::export_to_csv;
pub use parser::{
    analyze_csv_columns, read_csv_file, scan_directory_for_csvs, validate_csv_file, validate_data_quality,
};
pub use storage::{get_csv_headers, load_csv_into_store, query_csv_data, unload_csv_data};
pub use types::*;
