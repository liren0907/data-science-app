# Data Science App

A modern, high-performance application for data analysis and visualization, built with SvelteKit, Tauri v2, and Rust. Features a powerful CSV analysis engine and embedded SurrealDB integration.

## Architecture & Modules

The application is built with a modular Rust architecture organized into multiple crates within a Cargo workspace.

### Core Components

- **Frontend**: SvelteKit + Tailwind CSS + DaisyUI
- **Backend**: Tauri v2 + Rust
- **Database**: Embedded SurrealDB (surrealkv)

### Main Workspace Crates

- **`data-science-app-backend`**: The core Tauri application layer and command interface.
- **`data-science`**: Dedicated crate for CSV parsing, statistical analysis, data quality validation, and format detection.
- **`database-surrealdb`**: Embedded SurrealDB integration managing persistent data, configurations, and providing generic CRUD operations.

## Features

### 📊 Data Analysis
- **CSV Processing**: High-performance parsing and validation of large CSV datasets.
- **Statistical Analysis**: Automatic summary statistics, column type inference, and distribution analysis.
- **Data Quality**: Automated checks for missing values, outliers, and schema consistency.
- **Visualization**: Interactive charts and data exploration tools.

### 💾 Database Management
- **Embedded NoSQL**: Uses SurrealDB with RocksDB/SurrealKV storage engine.
- **Generic CRUD**: Flexible API for storing and retrieving arbitrary JSON data.
- **Configuration Management**: Type-safe storage for application configs and user preferences.

## Quick Start

### Prerequisites
- Node.js (v18+)
- Rust (stable)
- Yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd data-science-app
   ```

2. **Install frontend dependencies**
   ```bash
   yarn install
   ```

3. **Run in development mode**
   ```bash
   yarn tauri dev
   ```

## Dependencies

- **Frontend:**
    - SvelteKit 2.0
    - Tailwind CSS
    - Tauri API
    - D3.js / Plotly.js
- **Backend:**
    - Tauri v2
    - Serde / Serde JSON
    - Tokio
    - SurrealDB
    - CSV / Calamine
