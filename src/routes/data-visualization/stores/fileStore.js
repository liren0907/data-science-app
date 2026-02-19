import { writable } from 'svelte/store';

// File management store
export const fileStore = writable({
  uploadedFiles: new Map(), // Map of fileId -> File object
  fileMetadata: new Map(),  // Map of fileId -> metadata from backend
  validationResults: new Map(), // Map of fileId -> validation results
  processingStatus: new Map(), // Map of fileId -> processing status
  processingQueue: [], // Queue of files being processed
});

// File store actions
export const fileActions = {
  // Add uploaded file
  addUploadedFile(fileId, file) {
    fileStore.update(store => {
      store.uploadedFiles.set(fileId, file);
      store.processingStatus.set(fileId, {
        status: 'pending',
        progress: 0,
        message: 'Waiting to process...'
      });
      return store;
    });
  },

  // Update file metadata
  setFileMetadata(fileId, metadata) {
    fileStore.update(store => {
      store.fileMetadata.set(fileId, metadata);
      return store;
    });
  },

  // Update validation results
  setValidationResult(fileId, result) {
    fileStore.update(store => {
      store.validationResults.set(fileId, result);
      return store;
    });
  },

  // Update processing status
  updateProcessingStatus(fileId, status, progress = null, message = null) {
    fileStore.update(store => {
      const currentStatus = store.processingStatus.get(fileId) || {};
      store.processingStatus.set(fileId, {
        ...currentStatus,
        status,
        ...(progress !== null && { progress }),
        ...(message !== null && { message })
      });
      return store;
    });
  },

  // Add to processing queue
  addToProcessingQueue(fileId) {
    fileStore.update(store => {
      if (!store.processingQueue.includes(fileId)) {
        store.processingQueue.push(fileId);
      }
      return store;
    });
  },

  // Remove from processing queue
  removeFromProcessingQueue(fileId) {
    fileStore.update(store => {
      store.processingQueue = store.processingQueue.filter(id => id !== fileId);
      return store;
    });
  },

  // Get next file to process
  getNextInQueue() {
    let nextFileId = null;
    fileStore.update(store => {
      if (store.processingQueue.length > 0) {
        nextFileId = store.processingQueue[0];
        store.processingQueue.shift();
      }
      return store;
    });
    return nextFileId;
  },

  // Remove file completely
  removeFile(fileId) {
    fileStore.update(store => {
      store.uploadedFiles.delete(fileId);
      store.fileMetadata.delete(fileId);
      store.validationResults.delete(fileId);
      store.processingStatus.delete(fileId);
      store.processingQueue = store.processingQueue.filter(id => id !== fileId);
      return store;
    });
  },

  // Clear all files
  clearAll() {
    fileStore.set({
      uploadedFiles: new Map(),
      fileMetadata: new Map(),
      validationResults: new Map(),
      processingStatus: new Map(),
      processingQueue: [],
    });
  },

  // Get processing statistics
  getProcessingStats() {
    let stats = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      queued: 0
    };

    fileStore.update(store => {
      stats.total = store.uploadedFiles.size;
      stats.queued = store.processingQueue.length;

      for (const [fileId, status] of store.processingStatus) {
        switch (status.status) {
          case 'pending':
            stats.pending++;
            break;
          case 'processing':
            stats.processing++;
            break;
          case 'completed':
            stats.completed++;
            break;
          case 'failed':
            stats.failed++;
            break;
        }
      }

      return store;
    });

    return stats;
  }
};
