use crate::parser::analyze_csv_columns;
use crate::types::*;
use regex::Regex;
use std::collections::HashMap;

pub fn infer_data_type(values: &[String]) -> String {
    if values.is_empty() {
        return "unknown".to_string();
    }

    let mut numeric_count = 0;
    let mut date_count = 0;
    let mut boolean_count = 0;

    for value in values {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Check for boolean
        if trimmed.to_lowercase() == "true" || trimmed.to_lowercase() == "false" {
            boolean_count += 1;
            continue;
        }

        // Check for numeric
        if trimmed.parse::<f64>().is_ok() {
            numeric_count += 1;
            continue;
        }

        // Check for date (simple pattern)
        if Regex::new(r"^\d{4}-\d{2}-\d{2}").unwrap().is_match(trimmed)
            || Regex::new(r"^\d{2}/\d{2}/\d{4}").unwrap().is_match(trimmed)
        {
            date_count += 1;
        }
    }

    let total_values = values.len();
    if numeric_count > total_values * 3 / 4 {
        "number".to_string()
    } else if boolean_count > total_values / 2 {
        "boolean".to_string()
    } else if date_count > total_values / 4 {
        "date".to_string()
    } else {
        "string".to_string()
    }
}

pub async fn perform_data_science(file_path: String, analysis_type: String) -> Result<AnalysisResult, String> {
    match analysis_type.as_str() {
        "summary" => perform_summary_analysis(&file_path),
        "correlation" => perform_correlation_analysis(&file_path),
        "distribution" => perform_distribution_analysis(&file_path),
        "outliers" => perform_outlier_analysis(&file_path),
        "patterns" => perform_pattern_analysis(&file_path),
        _ => Err(format!("Unknown analysis type: {}", analysis_type)),
    }
}

fn perform_summary_analysis(file_path: &str) -> Result<AnalysisResult, String> {
    let analyses = analyze_csv_columns(file_path.to_string())?;

    let total_columns = analyses.len();
    let total_rows = analyses
        .first()
        .map(|a| a.unique_count + (a.null_percentage * a.unique_count as f64 / (100.0 - a.null_percentage)) as usize)
        .unwrap_or(0);

    let data_types: HashMap<String, usize> =
        analyses
            .iter()
            .map(|a| a.data_type.clone())
            .fold(HashMap::new(), |mut map, dt| {
                *map.entry(dt).or_insert(0) += 1;
                map
            });

    let summary = serde_json::json!({
        "total_rows": total_rows,
        "total_columns": total_columns,
        "data_types": data_types,
        "columns": analyses.iter().map(|a| {
            serde_json::json!({
                "name": a.name,
                "type": a.data_type,
                "null_percentage": a.null_percentage,
                "unique_count": a.unique_count
            })
        }).collect::<Vec<_>>()
    });

    let insights = vec![
        format!("Dataset contains {} rows and {} columns", total_rows, total_columns),
        format!("Data types found: {:?}", data_types),
    ];

    Ok(AnalysisResult {
        analysis_type: "summary".to_string(),
        summary,
        insights,
    })
}

fn perform_correlation_analysis(file_path: &str) -> Result<AnalysisResult, String> {
    let analyses = analyze_csv_columns(file_path.to_string())?;

    let numeric_columns: Vec<&ColumnAnalysis> = analyses.iter().filter(|a| a.data_type == "number").collect();

    let summary = serde_json::json!({
        "numeric_columns_count": numeric_columns.len(),
        "correlation_available": numeric_columns.len() >= 2,
        "columns": numeric_columns.iter().map(|a| a.name.clone()).collect::<Vec<_>>()
    });

    let insights = if numeric_columns.len() >= 2 {
        vec!["Correlation analysis available for numeric columns".to_string()]
    } else {
        vec!["Need at least 2 numeric columns for correlation analysis".to_string()]
    };

    Ok(AnalysisResult {
        analysis_type: "correlation".to_string(),
        summary,
        insights,
    })
}

fn perform_distribution_analysis(file_path: &str) -> Result<AnalysisResult, String> {
    let analyses = analyze_csv_columns(file_path.to_string())?;

    let summary = serde_json::json!({
        "columns_analyzed": analyses.len(),
        "distribution_data": analyses.iter().map(|a| {
            serde_json::json!({
                "column": a.name,
                "type": a.data_type,
                "unique_values": a.unique_count,
                "null_percentage": a.null_percentage
            })
        }).collect::<Vec<_>>()
    });

    Ok(AnalysisResult {
        analysis_type: "distribution".to_string(),
        summary,
        insights: vec!["Distribution analysis completed".to_string()],
    })
}

fn perform_outlier_analysis(file_path: &str) -> Result<AnalysisResult, String> {
    let analyses = analyze_csv_columns(file_path.to_string())?;

    let numeric_columns: Vec<&ColumnAnalysis> = analyses.iter().filter(|a| a.data_type == "number").collect();

    let summary = serde_json::json!({
        "numeric_columns": numeric_columns.len(),
        "outlier_analysis_available": numeric_columns.len() > 0
    });

    Ok(AnalysisResult {
        analysis_type: "outliers".to_string(),
        summary,
        insights: vec!["Outlier detection requires numeric columns".to_string()],
    })
}

fn perform_pattern_analysis(file_path: &str) -> Result<AnalysisResult, String> {
    let analyses = analyze_csv_columns(file_path.to_string())?;

    let text_columns: Vec<&ColumnAnalysis> = analyses.iter().filter(|a| a.data_type == "string").collect();

    let summary = serde_json::json!({
        "text_columns": text_columns.len(),
        "pattern_analysis_available": text_columns.len() > 0
    });

    Ok(AnalysisResult {
        analysis_type: "patterns".to_string(),
        summary,
        insights: vec!["Pattern recognition available for text columns".to_string()],
    })
}
