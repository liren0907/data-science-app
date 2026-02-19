use crate::types::*;
use std::collections::HashMap;

pub fn infer_data_types(raw_data: &[Vec<String>], headers: &[String]) -> Vec<HashMap<String, serde_json::Value>> {
    raw_data
        .iter()
        .map(|row| {
            let mut processed_row = HashMap::new();
            for (i, value) in row.iter().enumerate() {
                if let Some(header) = headers.get(i) {
                    processed_row.insert(header.clone(), infer_value_type(value));
                }
            }
            processed_row
        })
        .collect()
}

pub fn infer_value_type(value: &str) -> serde_json::Value {
    let trimmed = value.trim();

    // Try to parse as integer first
    if let Ok(int_val) = trimmed.parse::<i64>() {
        return serde_json::Value::Number(serde_json::Number::from(int_val));
    }

    // Try to parse as float
    if let Ok(float_val) = trimmed.parse::<f64>() {
        if let Some(num) = serde_json::Number::from_f64(float_val) {
            return serde_json::Value::Number(num);
        }
    }

    // Try to parse as boolean
    match trimmed.to_lowercase().as_str() {
        "true" => return serde_json::Value::Bool(true),
        "false" => return serde_json::Value::Bool(false),
        _ => {}
    }

    // Default to string
    serde_json::Value::String(value.to_string())
}

pub fn apply_filters(data: &[HashMap<String, serde_json::Value>], filters: &HashMap<String, FilterSpec>) -> Vec<usize> {
    if filters.is_empty() {
        return (0..data.len()).collect();
    }

    data.iter()
        .enumerate()
        .filter_map(|(index, row)| {
            let matches_all_filters = filters.iter().all(|(_, filter)| {
                if let Some(value) = row.get(&filter.column) {
                    match_filter_value(value, &filter.operator, &filter.value, filter.case_sensitive)
                } else {
                    false
                }
            });

            if matches_all_filters {
                Some(index)
            } else {
                None
            }
        })
        .collect()
}

pub fn match_filter_value(
    value: &serde_json::Value,
    operator: &str,
    filter_value: &serde_json::Value,
    case_sensitive: bool,
) -> bool {
    match operator {
        "equals" => {
            if case_sensitive {
                value == filter_value
            } else {
                value.to_string().to_lowercase() == filter_value.to_string().to_lowercase()
            }
        }
        "contains" => {
            let value_str = if case_sensitive {
                value.to_string()
            } else {
                value.to_string().to_lowercase()
            };
            let filter_str = if case_sensitive {
                filter_value.to_string()
            } else {
                filter_value.to_string().to_lowercase()
            };
            value_str.contains(&filter_str)
        }
        "greater_than" => {
            if let (Some(v), Some(f)) = (value.as_f64(), filter_value.as_f64()) {
                v > f
            } else {
                false
            }
        }
        "less_than" => {
            if let (Some(v), Some(f)) = (value.as_f64(), filter_value.as_f64()) {
                v < f
            } else {
                false
            }
        }
        "greater_than_or_equal" => {
            if let (Some(v), Some(f)) = (value.as_f64(), filter_value.as_f64()) {
                v >= f
            } else {
                false
            }
        }
        "less_than_or_equal" => {
            if let (Some(v), Some(f)) = (value.as_f64(), filter_value.as_f64()) {
                v <= f
            } else {
                false
            }
        }
        _ => false,
    }
}

pub fn apply_sorting(
    indices: &[usize],
    data: &[HashMap<String, serde_json::Value>],
    sort_spec: &SortSpec,
) -> Vec<usize> {
    let mut sorted_indices = indices.to_vec();

    sorted_indices.sort_by(|&a, &b| {
        let value_a = data[a].get(&sort_spec.column);
        let value_b = data[b].get(&sort_spec.column);

        match (value_a, value_b) {
            (Some(a), Some(b)) => compare_values(a, b, &sort_spec.direction, sort_spec.case_sensitive),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => std::cmp::Ordering::Equal,
        }
    });

    sorted_indices
}

pub fn compare_values(
    a: &serde_json::Value,
    b: &serde_json::Value,
    direction: &str,
    case_sensitive: bool,
) -> std::cmp::Ordering {
    let ordering = match (a, b) {
        (serde_json::Value::Number(n1), serde_json::Value::Number(n2)) => {
            let f1 = n1.as_f64().unwrap_or(0.0);
            let f2 = n2.as_f64().unwrap_or(0.0);
            f1.partial_cmp(&f2).unwrap_or(std::cmp::Ordering::Equal)
        }
        (serde_json::Value::String(s1), serde_json::Value::String(s2)) => {
            if case_sensitive {
                s1.cmp(s2)
            } else {
                s1.to_lowercase().cmp(&s2.to_lowercase())
            }
        }
        (serde_json::Value::Bool(b1), serde_json::Value::Bool(b2)) => b1.cmp(b2),
        _ => {
            let s1 = a.to_string();
            let s2 = b.to_string();
            if case_sensitive {
                s1.cmp(&s2)
            } else {
                s1.to_lowercase().cmp(&s2.to_lowercase())
            }
        }
    };

    if direction == "desc" {
        ordering.reverse()
    } else {
        ordering
    }
}

pub fn calculate_memory_usage(data: &[HashMap<String, serde_json::Value>]) -> usize {
    data.len() * std::mem::size_of::<HashMap<String, serde_json::Value>>()
}

pub fn detect_encoding(bytes: &[u8]) -> String {
    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(bytes, true);
    let encoding = detector.guess(None, true);

    match encoding.name() {
        "UTF-8" => "UTF-8".to_string(),
        "UTF-16LE" => "UTF-16LE".to_string(),
        "UTF-16BE" => "UTF-16BE".to_string(),
        "windows-1252" => "Windows-1252".to_string(),
        "ISO-8859-1" => "ISO-8859-1".to_string(),
        _ => "UTF-8".to_string(), // Default fallback
    }
}
