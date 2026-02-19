<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";

  import { csvDataStore, csvDataActions } from "../stores/csvDataStore.js";
  import { fileStore, fileActions } from "../stores/fileStore.js";
  import { uiStateActions } from "../stores/uiStateStore.js";

  // Remove frontend parsing utilities - using Rust backend instead
  // import { parseCsvWithTypes, validateCsvFormat } from '../utils/csvParser.js';
  // import { calculateDatasetStats } from '../utils/dataAnalyzer.js';

  // Drag and drop state
  let isDragOver = false;
  let dragCounter = 0;

  // File processing
  let processingFiles = new Set<string>();
  let currentProcessingFile: string | null = null;

  // Event handlers
  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    dragCounter++;
    isDragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      isDragOver = false;
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    dragCounter = 0;

    console.log("Drop event dataTransfer:", event.dataTransfer);
    console.log("Drop event files:", event.dataTransfer?.files);
    console.log("Drop event items:", event.dataTransfer?.items);

    if (!event.dataTransfer) {
      showError("No data transfer available");
      return;
    }

    // Check if we have files from dataTransfer
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      console.log("Processing files from dataTransfer.files");
      const files = Array.from(event.dataTransfer.files);
      await processFiles(files);
      return;
    }

    // Check if we have items (might contain file paths)
    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      console.log("Processing files from dataTransfer.items");
      for (let i = 0; i < event.dataTransfer.items.length; i++) {
        const item = event.dataTransfer.items[i];
        console.log("Item:", item);
        if (item.kind === "file") {
          const file = item.getAsFile();
          console.log("File from item:", file);
          if (file) {
            await processFiles([file]);
            return;
          }
        }
      }
    }

    // If we get here, drag and drop didn't work as expected
    showError(
      'Drag and drop is not supported in this environment. Please use the "Select Files" button instead.',
    );
  }

  // File selection via dialog
  async function selectFiles() {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "CSV Files",
            extensions: ["csv", "tsv", "txt"],
          },
        ],
      });

      if (selected && Array.isArray(selected)) {
        // Convert file paths to File objects for processing
        const files = selected.map((path) => ({
          path: path,
          name: path.split("/").pop() || "unknown.csv",
          size: 0, // We'll get this from Tauri
          type: "text/csv",
        })) as any[];
        await processFiles(files as any);
      }
    } catch (error: any) {
      console.error("Error selecting files:", error);
      showError(
        "Error selecting files: " + (error?.message || "Unknown error"),
      );
    }
  }

  // Process uploaded files
  async function processFiles(files: any[]) {
    if (!Array.isArray(files)) {
      console.error("processFiles: files is not an array:", files);
      showError("Invalid file selection");
      return;
    }

    for (const file of files) {
      const safeFileName =
        file?.name || file?.path?.split("/").pop() || "unknown_file.csv";

      if (processingFiles.has(safeFileName)) {
        showError(`File "${safeFileName}" is already being processed`);
        continue;
      }

      processingFiles.add(safeFileName);
      currentProcessingFile = safeFileName;

      try {
        await processSingleFile(file);
      } catch (error: any) {
        let errorMessage = "Unknown error";
        try {
          if (error && typeof error === "object") {
            errorMessage = error.message || error.toString() || "Unknown error";
          } else if (typeof error === "string") {
            errorMessage = error;
          }
        } catch (msgError) {
          console.error(
            "Error extracting message from error object:",
            msgError,
          );
          errorMessage = "Error processing file";
        }

        showError("Error processing " + safeFileName + ": " + errorMessage);
      } finally {
        processingFiles.delete(safeFileName);
        currentProcessingFile = null;
      }
    }
  }

  // Process a single file
  async function processSingleFile(file: any) {
    // Validate file object
    if (!file || typeof file !== "object") {
      throw new Error("Invalid file object provided");
    }

    // Generate tempFileId immediately to ensure it's always available for error handling
    const tempFileId =
      Date.now().toString() + "_" + Math.random().toString(36).substr(2, 9);
    const fileName =
      file?.name || file?.path?.split("/").pop() || "unknown_file.csv";
    const filePath = file?.path || file?.name;

    if (!filePath) {
      // Even if filePath is missing, we still have fileId for error handling
      console.error(
        "File path missing for file:",
        fileName,
        "tempFileId:",
        tempFileId,
      );
      throw new Error("File path is required but not provided");
    }

    try {
      // Update UI state
      uiStateActions.setLoading(true, `Processing ${fileName}...`);

      // Add file to stores
      // Add file to store and get the actual fileId
      const fileId = csvDataActions.addFile({
        name: fileName,
        path: filePath,
        size: file?.size || 0,
      });

      fileActions.addUploadedFile(fileId, file);
      fileActions.updateProcessingStatus(
        fileId,
        "processing",
        0,
        "Reading file...",
      );

      // Read file content first (this gives us all the data we need)
      let fileContent;
      try {
        fileActions.updateProcessingStatus(
          fileId,
          "processing",
          30,
          "Reading file content...",
        );
        fileContent = await invoke("read_csv_file", { filePath: filePath });
        fileActions.updateProcessingStatus(
          fileId,
          "processing",
          50,
          "File loaded successfully",
        );
      } catch (error: any) {
        const errorMessage =
          error?.message || error || "Failed to read file content";
        fileActions.updateProcessingStatus(fileId, "failed", 0, errorMessage);
        throw new Error(`Failed to read file content: ${errorMessage}`);
      }

      // Validate CSV file using Rust backend
      let validationResult;
      try {
        fileActions.updateProcessingStatus(
          fileId,
          "processing",
          60,
          "Validating file format...",
        );
        validationResult = await invoke("validate_csv_file", {
          filePath: filePath,
        });
        fileActions.updateProcessingStatus(
          fileId,
          "processing",
          70,
          "File validated successfully",
        );
      } catch (error: any) {
        const errorMessage =
          error?.message || error || "Failed to validate file";
        fileActions.updateProcessingStatus(fileId, "failed", 0, errorMessage);
        throw new Error(`Failed to validate file: ${errorMessage}`);
      }

      // Analyze CSV columns using Rust backend
      let columnAnalysis;
      try {
        fileActions.updateProcessingStatus(
          fileId,
          "processing",
          80,
          "Analyzing columns...",
        );
        columnAnalysis = await invoke("analyze_csv_columns", {
          filePath: filePath,
        });
        fileActions.updateProcessingStatus(
          fileId,
          "processing",
          90,
          "Column analysis complete",
        );
      } catch (error: any) {
        const errorMessage =
          error?.message || error || "Failed to analyze columns";
        fileActions.updateProcessingStatus(fileId, "failed", 0, errorMessage);
        throw new Error(`Failed to analyze columns: ${errorMessage}`);
      }

      // Optional: Skip data quality check for better performance
      let qualityReport = {
        valid_rows: fileContent.content.split("\n").length - 1,
        issues: [],
      };

      // Prepare column definitions from Rust backend analysis
      const columns = columnAnalysis.map((col) => ({
        id: col.name,
        name: col.name,
        type: col.data_type,
        nullable: col.nullable,
        uniqueCount: col.unique_count,
        nullPercentage: col.null_percentage,
        sampleValues: col.sample_values,
      }));

      // Update file information with correct counts
      csvDataActions.updateFile(fileId, {
        rowCount: validationResult.estimated_rows,
        columnCount: validationResult.column_count,
      });

      // Parse CSV content for table display
      // For now, we'll use the raw content and parse it on frontend
      // TODO: Replace with Rust backend parsing when ready
      if (!fileContent || !fileContent.content) {
        throw new Error("File content is not available");
      }

      const contentLines = fileContent.content
        .split("\n")
        .filter((line) => line.trim());
      const headerRow = contentLines[0];
      const dataRows = contentLines.slice(1);

      // Parse data rows into objects
      const parsedData = dataRows.map((row, index) => {
        const values = row.split(",");
        const obj = { id: index };
        columns.forEach((col, colIndex) => {
          obj[col.id] =
            colIndex < values.length ? values[colIndex].trim() : null;
        });
        return obj;
      });

      csvDataActions.setParsedData(fileId, parsedData, columns);
      csvDataActions.setFileStats(fileId, {
        validationResult,
        columnAnalysis,
        qualityReport,
        fileContent,
      });

      // Update file status
      fileActions.updateProcessingStatus(fileId, "completed", 100, "Complete");
      fileActions.setFileMetadata(fileId, {
        path: filePath,
        size: fileContent?.file_size || file?.size || 0,
        delimiter: fileContent?.delimiter || validationResult?.delimiter || ",",
        encoding: validationResult?.encoding || "UTF-8",
        hasHeaders: validationResult?.has_headers || true,
        created: fileContent?.metadata?.created || new Date().toISOString(),
        modified: fileContent?.metadata?.modified || new Date().toISOString(),
      });

      // Set as current file if it's the first one
      // Use a simple approach to avoid closure issues
      try {
        // We'll set this as current file - the store can handle checking if it's the first one
        csvDataActions.setCurrentFile(fileId);
      } catch (error) {
        console.error("Error setting current file:", error);
        // This is not critical, so we don't throw
      }

      // Dashboard layout - table will automatically appear when data is loaded
      // No need to switch tabs in the new dashboard design
    } catch (error: any) {
      console.error("Error processing file:", fileName, "Error:", error);
      console.error("Error type:", typeof error);
      console.error("Error constructor:", error?.constructor?.name);

      const errorMessage = error?.message || String(error) || "Unknown error";

      try {
        // Safely update file status - use tempFileId if fileId is not available
        const currentFileId =
          typeof fileId !== "undefined" ? fileId : tempFileId;
        console.error("Error occurred with details:", {
          fileId: currentFileId,
          tempFileId: tempFileId,
          fileName: fileName,
          hasFileId: typeof fileId !== "undefined",
          hasTempFileId: typeof tempFileId !== "undefined",
        });

        if (currentFileId && typeof currentFileId === "string") {
          fileActions.updateProcessingStatus(
            currentFileId,
            "failed",
            0,
            errorMessage,
          );
          csvDataActions.removeFile(currentFileId);
        } else {
          console.error("Invalid fileId for error handling:", currentFileId);
        }
      } catch (storeError) {
        console.error("Error updating file status:", storeError);
        // Don't throw this error as it's secondary to the main processing error
      }

      // Create a new error to avoid any corruption of the original error object
      const newError = new Error(
        "Failed to process file " + fileName + ": " + errorMessage,
      );
      newError.cause = error; // Preserve original error
      throw newError;
    } finally {
      uiStateActions.setLoading(false);
    }
  }

  // Show error message
  function showError(message: string) {
    // For now, just log to console. In a full implementation,
    // you'd want to show a toast notification or modal
    try {
      console.error("CSV Uploader Error:", message);
      alert(message); // Temporary solution
    } catch (displayError) {
      // If there's an issue displaying the error, log it safely
      console.error("Error displaying error message:", displayError);
      console.error("Original error message:", String(message));
      alert(
        "An error occurred while processing the file. Please check the console for details.",
      );
    }
  }

  // Format file size
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // Reactive statements for UI
  $: isProcessing = processingFiles.size > 0;
  $: processingCount = processingFiles.size;
  $: currentFile = currentProcessingFile;
</script>

<div class="csv-uploader-compact">
  <div class="upload-bar">
    <!-- Compact Drag and Drop Zone -->
    <div
      class="drop-zone-compact"
      class:drag-over={isDragOver}
      class:processing={isProcessing}
      on:dragenter={handleDragEnter}
      on:dragleave={handleDragLeave}
      on:dragover={handleDragOver}
      on:drop={handleDrop}
      role="button"
      tabindex="0"
      aria-label="Drop zone for CSV files"
    >
      {#if isProcessing}
        <div class="processing-compact">
          <div class="spinner-small"></div>
          <span class="processing-text-compact">
            Processing {currentFile || "files"}...
          </span>
        </div>
      {:else}
        <div class="drop-zone-content-compact">
          <span class="drop-icon">{isDragOver ? "📥" : "📄"}</span>
          <span class="drop-text">
            {isDragOver ? "Drop CSV files here" : "Drag & drop CSV files"}
          </span>
        </div>
      {/if}
    </div>

    <!-- Compact Select Button -->
    <button
      class="select-files-compact"
      on:click={selectFiles}
      disabled={isProcessing}
      title="Select CSV files"
    >
      {isProcessing ? "⏳ Processing..." : "📁 Select Files"}
    </button>
  </div>
</div>

<style>
  .upload-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: #f8fafc;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    border: 1px solid #e2e8f0;
  }

  /* Compact Drop Zone */
  .drop-zone-compact {
    flex: 1;
    border: 1px dashed #cbd5e1;
    border-radius: 2px;
    padding: 0.5rem 1rem;
    text-align: center;
    transition: all 0.2s ease;
    cursor: pointer;
    background: #ffffff;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .drop-zone-compact:hover:not(.processing) {
    border-color: #3b82f6;
    background: #f1f5f9;
  }

  .drop-zone-compact.drag-over {
    border-color: #10b981;
    background: #f0fdf4;
  }

  .drop-zone-compact.processing {
    border-color: #f59e0b;
    background: #fffbeb;
  }

  /* Drop Zone Content */
  .drop-zone-content-compact {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .drop-icon {
    font-size: 1rem;
    opacity: 0.7;
  }

  .drop-text {
    font-size: 0.8rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  /* Processing State */
  .processing-compact {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .spinner-small {
    width: 16px;
    height: 16px;
    border: 1.5px solid #e2e8f0;
    border-top: 1.5px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .processing-text-compact {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    font-family: ui-monospace, monospace;
  }

  /* Select Files Button */
  .select-files-compact {
    background: #2563eb;
    color: white;
    border: none;
    padding: 0.4rem 0.8rem;
    border-radius: 2px;
    font-weight: 700;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.1s ease;
    white-space: nowrap;
    font-family: ui-monospace, monospace;
  }

  .select-files-compact:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .select-files-compact:active:not(:disabled) {
    transform: translateY(1px);
  }

  .select-files-compact:disabled {
    opacity: 0.5;
    background: #94a3b8;
    cursor: not-allowed;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .upload-bar {
      padding: 0.375rem 0.75rem;
      gap: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .upload-bar {
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.5rem;
    }

    .drop-zone-compact {
      width: 100%;
    }

    .select-files-compact {
      width: 100%;
    }
  }
</style>
