import { writable } from 'svelte/store';

// CSV data management store
export const csvDataStore = writable({
  files: [],           // Array of loaded CSV files
  currentFileId: null, // Currently active file ID
  parsedData: new Map(), // Map of fileId -> parsed CSV data
  filteredData: new Map(), // Map of fileId -> filtered CSV data
  columns: new Map(),  // Map of fileId -> column definitions
  filters: new Map(),  // Map of fileId -> active filters
  sortConfig: new Map(), // Map of fileId -> sorting configuration
  selectedRows: new Map(), // Map of fileId -> selected row indices
  fileStats: new Map(), // Map of fileId -> file statistics
});

// Store actions
export const csvDataActions = {
  // Add a new file
  addFile(fileData) {
    let newFileId = null;
    csvDataStore.update(store => {
      const fileId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
      newFileId = fileId; // Store the ID to return later
      store.files.push({
        id: fileId,
        name: fileData.name,
        path: fileData.path,
        size: fileData.size,
        uploadedAt: new Date(),
        ...fileData
      });
      return store;
    });
    return newFileId;
  },

  // Update file information
  updateFile(fileId, updates) {
    csvDataStore.update(store => {
      const fileIndex = store.files.findIndex(f => f.id === fileId);
      if (fileIndex !== -1) {
        store.files[fileIndex] = { ...store.files[fileIndex], ...updates };
      }
      return store;
    });
  },

  // Set current file
  setCurrentFile(fileId) {
    csvDataStore.update(store => {
      store.currentFileId = fileId;
      return store;
    });
  },

  // Update parsed data for a file
  setParsedData(fileId, data, columns) {
    csvDataStore.update(store => {
      store.parsedData.set(fileId, data);
      store.filteredData.set(fileId, data); // Initially, filtered data = parsed data
      store.columns.set(fileId, columns);
      return store;
    });
  },

  // Update filtered data for a file
  setFilteredData(fileId, filteredData) {
    csvDataStore.update(store => {
      store.filteredData.set(fileId, filteredData);
      return store;
    });
  },

  // Update filters for a file
  setFilters(fileId, filters) {
    csvDataStore.update(store => {
      store.filters.set(fileId, filters);
      return store;
    });
  },

  // Update sort config for a file
  setSortConfig(fileId, sortConfig) {
    csvDataStore.update(store => {
      store.sortConfig.set(fileId, sortConfig);
      return store;
    });
  },

  // Update selected rows for a file
  setSelectedRows(fileId, selectedRows) {
    csvDataStore.update(store => {
      store.selectedRows.set(fileId, selectedRows);
      return store;
    });
  },

  // Update file statistics
  setFileStats(fileId, stats) {
    csvDataStore.update(store => {
      store.fileStats.set(fileId, stats);
      return store;
    });
  },

  // Remove a file
  removeFile(fileId) {
    csvDataStore.update(store => {
      store.files = store.files.filter(f => f.id !== fileId);
      store.parsedData.delete(fileId);
      store.filteredData.delete(fileId);
      store.columns.delete(fileId);
      store.filters.delete(fileId);
      store.sortConfig.delete(fileId);
      store.selectedRows.delete(fileId);
      store.fileStats.delete(fileId);

      // If current file was removed, set to first available
      if (store.currentFileId === fileId) {
        store.currentFileId = store.files.length > 0 ? store.files[0].id : null;
      }

      return store;
    });
  },

  // Clear all data
  clearAll() {
    csvDataStore.set({
      files: [],
      currentFileId: null,
      parsedData: new Map(),
      filteredData: new Map(),
      columns: new Map(),
      filters: new Map(),
      sortConfig: new Map(),
      selectedRows: new Map(),
      fileStats: new Map(),
    });
  }
};
