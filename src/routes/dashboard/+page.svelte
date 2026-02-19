<script lang="ts">
  import { onMount } from "svelte";
  import { csvDataStore } from "../data-visualization/stores/csvDataStore.js";
  import { goto } from "$app/navigation";

  let files = [];
  let stats = {
    totalFiles: 0,
    totalRows: 0,
    lastActivity: "No activity yet"
  };

  // Subscribe to store updates
  $: {
    if ($csvDataStore && $csvDataStore.files) {
      files = $csvDataStore.files;
      stats.totalFiles = files.length;
      
      // Calculate total rows across all loaded files
      let rowCount = 0;
      if ($csvDataStore.parsedData) {
        $csvDataStore.parsedData.forEach((data) => {
          if (data && Array.isArray(data)) {
            rowCount += data.length;
          }
        });
      }
      stats.totalRows = rowCount;

      if (files.length > 0) {
        // Find the most recently added file
        const lastFile = files[files.length - 1];
        stats.lastActivity = `Loaded ${lastFile.name}`;
      }
    }
  }

  function navigateToViz() {
    goto("/data-visualization");
  }

  function formatDate(date) {
    if (!date) return "-";
    return new Date(date).toLocaleString();
  }
</script>

<div class="p-6 max-w-7xl mx-auto space-y-8">
  <!-- Header Section -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-slate-800 tracking-tight">Data Science Dashboard</h1>
      <p class="text-slate-500 mt-1">Overview of your current analysis session</p>
    </div>
    <button 
      class="btn btn-primary gap-2 shadow-lg shadow-blue-500/20"
      on:click={navigateToViz}
    >
      <span class="material-symbols-outlined">add_chart</span>
      New Analysis
    </button>
  </div>

  <!-- Stats Grid -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <!-- Stat Card 1 -->
    <div class="card bg-white shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
      <div class="card-body">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <span class="material-symbols-outlined text-2xl">folder_open</span>
          </div>
          <div>
            <p class="text-sm font-medium text-slate-500">Loaded Datasets</p>
            <h3 class="text-2xl font-bold text-slate-800">{stats.totalFiles}</h3>
          </div>
        </div>
      </div>
    </div>

    <!-- Stat Card 2 -->
    <div class="card bg-white shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
      <div class="card-body">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <span class="material-symbols-outlined text-2xl">table_rows</span>
          </div>
          <div>
            <p class="text-sm font-medium text-slate-500">Total Rows Processed</p>
            <h3 class="text-2xl font-bold text-slate-800">{stats.totalRows.toLocaleString()}</h3>
          </div>
        </div>
      </div>
    </div>

    <!-- Stat Card 3 -->
    <div class="card bg-white shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
      <div class="card-body">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <span class="material-symbols-outlined text-2xl">history</span>
          </div>
          <div>
            <p class="text-sm font-medium text-slate-500">Last Activity</p>
            <h3 class="text-lg font-bold text-slate-800 truncate max-w-[200px]" title={stats.lastActivity}>
              {stats.lastActivity}
            </h3>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Recent Files Section -->
  <div class="card bg-white shadow-sm border border-slate-200/60">
    <div class="card-body p-0">
      <div class="p-6 border-b border-slate-100 flex justify-between items-center">
        <h3 class="text-lg font-bold text-slate-800">Recent Datasets</h3>
        <button class="btn btn-ghost btn-sm text-slate-500" on:click={navigateToViz}>View All</button>
      </div>
      
      {#if files.length === 0}
        <div class="p-12 text-center text-slate-400">
          <span class="material-symbols-outlined text-5xl mb-3 opacity-20">dataset</span>
          <p>No datasets loaded yet.</p>
          <button class="btn btn-link btn-sm mt-2" on:click={navigateToViz}>Load a CSV file</button>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full">
            <thead>
              <tr class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <th class="pl-6">File Name</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each files.slice(0, 5) as file}
                <tr class="hover:bg-slate-50/50 transition-colors">
                  <td class="pl-6 font-medium text-slate-700">
                    <div class="flex items-center gap-3">
                      <span class="material-symbols-outlined text-slate-400">description</span>
                      {file.name}
                    </div>
                  </td>
                  <td class="text-slate-500">{file.size || '-'}</td>
                  <td class="text-slate-500">{formatDate(file.uploadedAt)}</td>
                  <td>
                    <button 
                      class="btn btn-xs btn-ghost text-blue-600 hover:bg-blue-50"
                      on:click={navigateToViz}
                    >
                      Analyze
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Quick Tips / Getting Started -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="card bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-lg">
      <div class="card-body">
        <h3 class="card-title text-xl mb-2">🚀 Getting Started</h3>
        <ul class="space-y-3 text-slate-300">
          <li class="flex items-start gap-3">
            <span class="material-symbols-outlined text-blue-400 mt-0.5">upload_file</span>
            <span>Upload your CSV data in the Data Visualization tab.</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="material-symbols-outlined text-purple-400 mt-0.5">filter_alt</span>
            <span>Use the advanced table to filter and sort your data.</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="material-symbols-outlined text-emerald-400 mt-0.5">monitoring</span>
            <span>Create interactive charts with Plotly and D3.js.</span>
          </li>
        </ul>
      </div>
    </div>
    
    <div class="card bg-blue-50/50 border border-blue-100 text-slate-700 shadow-sm">
      <div class="card-body">
        <h3 class="card-title text-lg text-blue-900 mb-2">💡 Analysis Tips</h3>
        <p class="text-sm mb-4">
          Ensure your CSV files have clear headers for the best experience. 
          The application supports automatic type detection for numbers and dates.
        </p>
        <div class="card-actions justify-end">
          <button class="btn btn-sm btn-outline btn-primary" on:click={navigateToViz}>Go to Workspace</button>
        </div>
      </div>
    </div>
  </div>
</div>
