import { writable } from 'svelte/store';

// UI state management store
export const uiStateStore = writable({
  isLoading: false,
  loadingMessage: '',
  showFilters: false,
  tableView: 'grid', // 'grid' or 'cards'
  theme: 'light', // 'light' or 'dark'
  sidebarCollapsed: false,
  showColumnAnalyzer: false,
  showDataSummary: true,
  searchQuery: '',
  selectedColumns: new Set(),
  pageSize: 50,
  currentPage: 1,
  fullscreenMode: false,
});

// UI state actions
export const uiStateActions = {
  // Loading state
  setLoading(loading, message = '') {
    uiStateStore.update(store => ({
      ...store,
      isLoading: loading,
      loadingMessage: message
    }));
  },


  // Toggle states
  toggleFilters() {
    uiStateStore.update(store => ({
      ...store,
      showFilters: !store.showFilters
    }));
  },

  toggleSidebar() {
    uiStateStore.update(store => ({
      ...store,
      sidebarCollapsed: !store.sidebarCollapsed
    }));
  },

  toggleColumnAnalyzer() {
    uiStateStore.update(store => ({
      ...store,
      showColumnAnalyzer: !store.showColumnAnalyzer
    }));
  },

  toggleDataSummary() {
    uiStateStore.update(store => ({
      ...store,
      showDataSummary: !store.showDataSummary
    }));
  },

  toggleFullscreen() {
    uiStateStore.update(store => ({
      ...store,
      fullscreenMode: !store.fullscreenMode
    }));
  },

  // View settings
  setTableView(view) {
    uiStateStore.update(store => ({
      ...store,
      tableView: view
    }));
  },

  setTheme(theme) {
    uiStateStore.update(store => ({
      ...store,
      theme: theme
    }));
  },

  // Search
  setSearchQuery(query) {
    uiStateStore.update(store => ({
      ...store,
      searchQuery: query
    }));
  },

  // Pagination
  setPageSize(size) {
    uiStateStore.update(store => ({
      ...store,
      pageSize: size,
      currentPage: 1 // Reset to first page
    }));
  },

  setCurrentPage(page) {
    uiStateStore.update(store => ({
      ...store,
      currentPage: page
    }));
  },

  // Column selection
  toggleColumnSelection(columnId) {
    uiStateStore.update(store => {
      const newSelection = new Set(store.selectedColumns);
      if (newSelection.has(columnId)) {
        newSelection.delete(columnId);
      } else {
        newSelection.add(columnId);
      }
      return {
        ...store,
        selectedColumns: newSelection
      };
    });
  },

  selectAllColumns(columnIds) {
    uiStateStore.update(store => ({
      ...store,
      selectedColumns: new Set(columnIds)
    }));
  },

  clearColumnSelection() {
    uiStateStore.update(store => ({
      ...store,
      selectedColumns: new Set()
    }));
  },

  // Reset to defaults
  reset() {
    uiStateStore.set({
      isLoading: false,
      loadingMessage: '',
      showFilters: false,
      tableView: 'grid',
      theme: 'light',
      sidebarCollapsed: false,
      showColumnAnalyzer: false,
      showDataSummary: true,
      searchQuery: '',
      selectedColumns: new Set(),
      pageSize: 50,
      currentPage: 1,
      fullscreenMode: false,
    });
  }
};
