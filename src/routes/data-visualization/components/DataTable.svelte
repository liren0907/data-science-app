<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import { csvDataStore, csvDataActions } from "../stores/csvDataStore.js";
  import { uiStateStore, uiStateActions } from "../stores/uiStateStore.js";

  const dispatch = createEventDispatcher();

  // Reactive data from stores
  $: currentFileId = $csvDataStore.currentFileId;
  $: parsedData = currentFileId
    ? $csvDataStore.parsedData.get(currentFileId)
    : [];
  $: columns = currentFileId ? $csvDataStore.columns.get(currentFileId) : [];

  // Table state
  let globalFilter = "";
  let sortColumn = "";
  let sortDirection = "asc"; // 'asc' or 'desc'
  let currentPage = 1;
  let pageSize = $uiStateStore.pageSize;

  // Simplified filtering state
  let columnFilters = new Map(); // Map<columnId, { value: string }>
  let filterDebounceTimer: number;
  let lastFilteredData: any[] = [];
  let filteredData: any[] = [];

  // Debounced filtering to improve performance
  $: if (parsedData && (globalFilter || columnFilters.size > 0)) {
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => {
      const newFilteredData = filterDataSimple(
        parsedData,
        globalFilter,
        columnFilters,
      );
      if (
        JSON.stringify(newFilteredData) !== JSON.stringify(lastFilteredData)
      ) {
        lastFilteredData = [...newFilteredData]; // Create shallow copy
        filteredData = [...newFilteredData];
      }
    }, 150); // 150ms debounce
  } else if (parsedData) {
    // No filters applied, use all data
    filteredData = [...parsedData];
    lastFilteredData = [...parsedData];
  }

  $: sortedData = sortData(filteredData, sortColumn, sortDirection);
  $: paginatedData = paginateData(sortedData, currentPage, pageSize);

  // Update filtered data in store (debounced to avoid too many updates)
  $: if (currentFileId && filteredData && filteredData !== lastFilteredData) {
    csvDataActions.setFilteredData(currentFileId, filteredData);
  }

  // Table info
  $: tableInfo = {
    totalRows: parsedData.length,
    filteredRows: filteredData.length,
    currentPage,
    totalPages: Math.ceil(filteredData.length / pageSize),
    startRow: (currentPage - 1) * pageSize + 1,
    endRow: Math.min(currentPage * pageSize, filteredData.length),
  };

  // Data manipulation functions
  function filterData(data: any[], filter: string) {
    if (!filter || !data) return data;

    const lowerFilter = filter.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(lowerFilter),
      ),
    );
  }

  // Optimized filtering with early exit and caching
  function filterDataSimple(
    data: any[],
    globalFilter: string,
    columnFilters: Map<string, any>,
  ) {
    if (!data || data.length === 0) return [];

    // Prepare filter values for performance
    const globalFilterLower = globalFilter?.trim()?.toLowerCase() || "";
    const hasGlobalFilter = globalFilterLower.length > 0;
    const columnFilterEntries = Array.from(columnFilters.entries()).filter(
      ([_, value]) => value?.trim(),
    );

    // Early exit if no filters
    if (!hasGlobalFilter && columnFilterEntries.length === 0) {
      return data;
    }

    return data.filter((row) => {
      // Global filter check (early exit for performance)
      if (hasGlobalFilter) {
        const globalMatch = Object.values(row).some((value) =>
          String(value).toLowerCase().includes(globalFilterLower),
        );
        if (!globalMatch) return false;
      }

      // Column-specific filters check (all must match)
      for (const [columnId, filterValue] of columnFilterEntries) {
        const cellValue = String(row[columnId] || "").toLowerCase();
        const filter = filterValue.toLowerCase();
        if (!cellValue.includes(filter)) {
          return false; // Early exit on first mismatch
        }
      }

      return true;
    });
  }

  function sortData(data: any[], column: string, direction: string) {
    if (!column || !data) return data;

    return [...data].sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return direction === "asc" ? -1 : 1;
      if (bVal == null) return direction === "asc" ? 1 : -1;

      // Sort based on type
      let comparison = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return direction === "asc" ? comparison : -comparison;
    });
  }

  function paginateData(data: any[], page: number, size: number) {
    const startIndex = (page - 1) * size;
    const endIndex = startIndex + size;
    return data.slice(startIndex, endIndex);
  }

  // Event handlers
  function handleGlobalFilterChange(event: Event) {
    const target = event.target as HTMLInputElement;
    globalFilter = target.value;
    currentPage = 1; // Reset to first page when filtering
  }

  function handleSort(columnId: string) {
    if (sortColumn === columnId) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortColumn = columnId;
      sortDirection = "asc";
    }
    currentPage = 1; // Reset to first page when sorting
  }

  function handlePageSizeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    pageSize = parseInt(target.value);
    currentPage = 1;
    uiStateActions.setPageSize(pageSize);
  }

  function handlePageChange(page: number) {
    currentPage = page;
    uiStateActions.setCurrentPage(page);
  }

  // Simplified filter management functions
  function clearColumnFilter(columnId: string) {
    columnFilters.delete(columnId);
    columnFilters = columnFilters; // Trigger reactivity
    currentPage = 1;
  }

  function clearAllFilters() {
    columnFilters.clear();
    columnFilters = columnFilters;
    globalFilter = "";
    currentPage = 1;
  }

  function handleColumnFilterInput(columnId: string, event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    if (value.trim() === "") {
      columnFilters.delete(columnId);
    } else {
      columnFilters.set(columnId, value.trim());
    }
    columnFilters = columnFilters;
    currentPage = 1;
  }

  // Utility functions
  function formatCellValue(value: any, type: string) {
    if (value === null || value === undefined || value === "") {
      return "null";
    }

    switch (type) {
      case "number":
        return typeof value === "number" ? value.toLocaleString() : value;
      case "date":
        try {
          const date = new Date(value);
          return isNaN(date.getTime()) ? value : date.toLocaleDateString();
        } catch {
          return value;
        }
      case "boolean":
        return value ? "true" : "false";
      default:
        return String(value);
    }
  }

  function getSortIcon(columnId: string) {
    if (sortColumn !== columnId) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function getColumnWidth(type: string) {
    switch (type) {
      case "number":
        return 120;
      case "date":
        return 120;
      case "boolean":
        return 80;
      default:
        return 150;
    }
  }

  // Export current view with simplified filters
  function exportCurrentView() {
    dispatch("export", {
      data: filteredData,
      columns: columns,
      filter: globalFilter,
      columnFilters: Array.from(columnFilters.entries()),
      sortColumn,
      sortDirection,
    });
  }
</script>

{#if currentFileId && parsedData.length > 0}
  <div class="data-table-container">
    <!-- Compact Table Header -->
    <div class="compact-table-header">
      <!-- Left Section: Search & Filters -->
      <div class="header-left">
        <div class="search-container">
          <input
            type="text"
            class="search-input-compact"
            placeholder="Search all columns..."
            bind:value={globalFilter}
            on:input={handleGlobalFilterChange}
          />
          <span class="search-icon">🔍</span>
        </div>

        <!-- Compact Filter & Info -->
        <div class="compact-info">
          {#if columnFilters.size > 0}
            <span class="filters-indicator">
              🔍 {columnFilters.size} filter{columnFilters.size !== 1
                ? "s"
                : ""}
            </span>
          {/if}
          <span class="entries-info">
            {tableInfo.startRow}-{tableInfo.endRow} of {tableInfo.filteredRows}
            {#if tableInfo.filteredRows !== tableInfo.totalRows}
              ({tableInfo.totalRows} total)
            {/if}
          </span>
        </div>
      </div>

      <!-- Right Section: Controls -->
      <div class="header-right">
        <!-- Page Size Selector -->
        <select
          class="page-size-select-compact"
          value={pageSize}
          on:change={handlePageSizeChange}
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>

        <!-- Clear All Filters Button -->
        {#if globalFilter || columnFilters.size > 0}
          <button
            class="control-btn-compact clear-all-btn"
            on:click={clearAllFilters}
            title="Clear All Filters"
          >
            🗑️
          </button>
        {/if}

        <!-- Export Button -->
        <button
          class="control-btn-compact export-btn"
          on:click={exportCurrentView}
          title="Export Data"
        >
          📤
        </button>

        <!-- Fullscreen Toggle -->
        <button
          class="control-btn-compact"
          on:click={() => uiStateActions.toggleFullscreen()}
          title={$uiStateStore.fullscreenMode
            ? "Exit Fullscreen"
            : "Enter Fullscreen"}
        >
          {$uiStateStore.fullscreenMode ? "🪟" : "⛶"}
        </button>
      </div>
    </div>

    <!-- Data Table -->
    <div class="table-wrapper" class:fullscreen={$uiStateStore.fullscreenMode}>
      <table class="data-table">
        <!-- Table Header with Inline Filters -->
        <thead>
          <!-- Column Names Row -->
          <tr>
            {#each columns as column}
              <th
                class="table-header"
                class:sorted={sortColumn === column.id}
                on:click={() => handleSort(column.id)}
                style="min-width: {getColumnWidth(column.type)}px"
              >
                <div class="header-content">
                  <span class="column-name">{column.name}</span>
                  <span class="sort-icon">{getSortIcon(column.id)}</span>
                </div>
              </th>
            {/each}
          </tr>
          <!-- Filter Row -->
          <tr class="filter-row">
            {#each columns as column}
              <th class="filter-header">
                <div class="column-filter-container">
                  <input
                    type="text"
                    class="column-filter-input"
                    placeholder="Filter {column.name}..."
                    value={columnFilters.get(column.id) || ""}
                    on:input={(e) => handleColumnFilterInput(column.id, e)}
                  />
                  {#if columnFilters.has(column.id)}
                    <button
                      class="clear-column-filter-btn"
                      on:click={() => clearColumnFilter(column.id)}
                      title="Clear filter"
                    >
                      ✕
                    </button>
                  {/if}
                </div>
              </th>
            {/each}
          </tr>
        </thead>

        <!-- Table Body -->
        <tbody>
          {#each paginatedData as row}
            <tr class="table-row">
              {#each columns as column}
                <td class="table-cell">
                  {formatCellValue(row[column.id], column.type)}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination-container">
      <div class="pagination-info">
        Page {tableInfo.currentPage} of {tableInfo.totalPages}
      </div>

      <div class="pagination-controls">
        <button
          class="pagination-btn"
          disabled={currentPage <= 1}
          on:click={() => handlePageChange(1)}
        >
          ⇤ First
        </button>

        <button
          class="pagination-btn"
          disabled={currentPage <= 1}
          on:click={() => handlePageChange(currentPage - 1)}
        >
          ← Previous
        </button>

        <!-- Page Numbers -->
        <div class="page-numbers">
          {#each Array.from( { length: Math.min(5, tableInfo.totalPages) }, (_, i) => {
              const startPage = Math.max(1, currentPage - 2);
              return startPage + i;
            }, ).filter((page) => page <= tableInfo.totalPages) as pageNum}
            <button
              class="page-number-btn"
              class:active={pageNum === currentPage}
              on:click={() => handlePageChange(pageNum)}
            >
              {pageNum}
            </button>
          {/each}
        </div>

        <button
          class="pagination-btn"
          disabled={currentPage >= tableInfo.totalPages}
          on:click={() => handlePageChange(currentPage + 1)}
        >
          Next →
        </button>

        <button
          class="pagination-btn"
          disabled={currentPage >= tableInfo.totalPages}
          on:click={() => handlePageChange(tableInfo.totalPages)}
        >
          Last ⇥
        </button>
      </div>
    </div>
  </div>
{:else}
  <!-- Empty State -->
  <div class="empty-state">
    <div class="empty-state-content">
      <div class="empty-icon">📊</div>
      <h3>No Data Available</h3>
      <p>Upload a CSV file to start visualizing your data</p>
      <button
        class="upload-btn"
        on:click={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        Go to Upload Section
      </button>
    </div>
  </div>
{/if}

<style>
  .data-table-container {
    width: 100%;
    background: #ffffff;
    border-radius: 2px;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    box-sizing: border-box;
  }

  /* Compact Table Header */
  .compact-table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-bottom: 0.75rem;
    padding: 0.5rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .compact-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    font-family: ui-monospace, monospace;
  }

  .search-container {
    position: relative;
  }

  .search-input-compact {
    padding: 0.375rem 2rem 0.375rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 2px;
    font-size: 0.8rem;
    width: 180px;
    background: #ffffff;
    color: #334155;
    font-family: inherit;
  }

  .search-input-compact:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.5);
  }

  .search-icon {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    font-size: 0.75rem;
  }

  .page-size-select-compact {
    padding: 0.25rem 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 2px;
    background: #ffffff;
    color: #475569;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: ui-monospace, monospace;
  }

  .control-btn-compact {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 2px;
    padding: 0.375rem;
    cursor: pointer;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .control-btn-compact:hover {
    background: #f1f5f9;
    border-color: #94a3b8;
  }

  /* Table Styles */
  .table-wrapper {
    width: 100%;
    overflow-x: auto;
    border: 1px solid #e2e8f0;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    font-family: ui-monospace, monospace;
  }

  .table-header {
    background: #f1f5f9;
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #e2e8f0;
    border-right: 1px solid #e2e8f0;
    cursor: pointer;
  }

  .table-header:hover {
    background: #e2e8f0;
  }

  .table-header.sorted {
    color: #2563eb;
    background: #eff6ff;
  }

  .table-cell {
    padding: 0.375rem 0.75rem;
    border-bottom: 1px solid #f1f5f9;
    border-right: 1px solid #f1f5f9;
    color: #334155;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .table-row:hover {
    background: #f8fafc;
  }

  .table-row:nth-child(even) {
    background: #fafafa;
  }

  /* Column filters */
  .column-filter-input {
    width: 100%;
    padding: 0.25rem 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 2px;
    font-size: 0.75rem;
    background: #ffffff;
    margin-top: 0.25rem;
    font-family: inherit;
  }

  .filter-row {
    background: #f8fafc;
  }

  .filter-header {
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid #e2e8f0;
    border-right: 1px solid #e2e8f0;
  }

  /* Pagination */
  .pagination-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.75rem;
    padding: 0.5rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 2px;
  }

  .pagination-info {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    font-family: ui-monospace, monospace;
  }

  .pagination-controls {
    display: flex;
    gap: 0.25rem;
  }

  .pagination-btn,
  .page-number-btn {
    padding: 0.25rem 0.5rem;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    border-radius: 2px;
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    font-family: ui-monospace, monospace;
    text-transform: uppercase;
  }

  .pagination-btn:hover:not(:disabled),
  .page-number-btn:hover:not(.active) {
    background: #f1f5f9;
  }

  .pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-number-btn.active {
    background: #2563eb;
    color: white;
    border-color: #2563eb;
  }

  /* Empty State */
  .empty-state {
    padding: 4rem 2rem;
    text-align: center;
    background: #ffffff;
    border: 1px dashed #cbd5e1;
    border-radius: 4px;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.3;
  }

  .empty-state h3 {
    font-family: ui-monospace, monospace;
    font-size: 1rem;
    font-weight: 700;
    text-transform: uppercase;
    color: #475569;
    margin-bottom: 0.5rem;
  }

  .empty-state p {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .upload-btn {
    background: #2563eb;
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 2px;
    font-weight: 700;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    font-family: ui-monospace, monospace;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Table Wrapper */
  .table-wrapper {
    overflow-x: auto;
    overflow-y: hidden;
    margin-bottom: 1rem;
    border-radius: 8px;
    border: 1px solid rgba(229, 231, 235, 0.8);
    max-width: 100%;
    box-sizing: border-box;
  }

  .table-wrapper.fullscreen {
    max-height: 70vh;
    overflow-y: auto;
  }

  /* Data Table */
  .data-table {
    width: 100%;
    min-width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    line-height: 1.3;
    table-layout: auto;
  }

  /* Table Header */
  .table-header {
    background: rgba(249, 250, 251, 0.8);
    backdrop-filter: blur(10px);
    border-bottom: 2px solid rgba(229, 231, 235, 0.8);
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-weight: 600;
    color: #374151;
    position: sticky;
    top: 0;
    z-index: 10;
    font-size: 0.8rem;
  }

  .table-header.sorted {
    background: #eff6ff;
    border-bottom-color: #3b82f6;
  }

  .header-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .column-name {
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
  }

  /* Filter Row */
  .filter-row {
    background: rgba(248, 250, 252, 0.8);
    border-bottom: 2px solid #e5e7eb;
  }

  .filter-header {
    padding: 0.5rem !important;
    border-bottom: none;
  }

  .column-filter-container {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .column-filter-input {
    width: 100%;
    padding: 0.375rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 0.8rem;
    background: white;
    color: #374151;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .column-filter-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .column-filter-input::placeholder {
    color: #9ca3af;
    font-size: 0.75rem;
  }

  .clear-column-filter-btn {
    padding: 0.125rem 0.25rem;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 3px;
    font-size: 0.7rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
    line-height: 1;
  }

  .clear-column-filter-btn:hover {
    background: #dc2626;
  }

  .sort-icon {
    font-size: 0.8rem;
    color: #9ca3af;
    transition: color 0.2s ease;
  }

  .table-header.sorted .sort-icon {
    color: #3b82f6;
  }

  /* Table Body */
  .table-row {
    transition: background-color 0.2s ease;
  }

  .table-row:hover {
    background: #f9fafb;
  }

  .table-row:nth-child(even) {
    background: #fafafa;
  }

  .table-row:nth-child(even):hover {
    background: #f3f4f6;
  }

  .table-cell {
    padding: 0.375rem 0.75rem;
    border-bottom: 1px solid rgba(229, 231, 235, 0.8);
    vertical-align: top;
    height: 32px;
  }

  /* Pagination */
  .pagination-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .pagination-info {
    font-size: 0.9rem;
    color: #6b7280;
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .pagination-btn,
  .page-number-btn {
    padding: 0.375rem 0.75rem;
    border: 1px solid #d1d5db;
    background: white;
    color: #374151;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pagination-btn:hover:not(:disabled),
  .page-number-btn:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-number-btn.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .page-numbers {
    display: flex;
    gap: 0.25rem;
    margin: 0 0.5rem;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    border: 2px dashed #e5e7eb;
  }

  .empty-state-content {
    text-align: center;
    color: #6b7280;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-state-content h3 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.5rem 0;
  }

  .empty-state-content p {
    margin: 0 0 2rem 0;
  }

  .upload-btn {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .upload-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    /* Column Filter Mobile Styles */
    .column-filter-input {
      font-size: 0.75rem;
      padding: 0.25rem 0.375rem;
    }

    .column-filter-input::placeholder {
      font-size: 0.7rem;
    }

    .column-name {
      font-size: 0.8rem;
    }

    .filter-header {
      padding: 0.25rem !important;
    }

    .column-filter-container {
      gap: 0.125rem;
    }

    .clear-column-filter-btn {
      padding: 0.1rem 0.2rem;
      font-size: 0.6rem;
    }

    .pagination-container {
      flex-direction: column;
      gap: 0.5rem;
    }

    .pagination-controls {
      justify-content: center;
    }

    .page-numbers {
      display: none;
    }
  }
</style>
