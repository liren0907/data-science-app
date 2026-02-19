<!-- ProgressIndicator component -->

<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let isVisible = false;
  export let current = 0;
  export let total = 0;
  export let status = '';
  export let canCancel = true;

  $: percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  $: isIndeterminate = total === 0;

  function handleCancel() {
    dispatch('cancel');
  }

  function formatProgress(current, total) {
    if (total === 0) return 'Processing...';
    return `${current.toLocaleString()} / ${total.toLocaleString()}`;
  }
</script>

{#if isVisible}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl">
      <!-- Header -->
      <div class="text-center mb-6">
        <div class="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
          <svg class="w-8 h-8 text-indigo-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-gray-900">Processing Video</h3>
        <p class="text-gray-600 mt-1">{status || 'Loading frames...'}</p>
      </div>

      <!-- Progress Bar -->
      <div class="mb-6">
        {#if isIndeterminate}
          <!-- Indeterminate progress bar -->
          <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div class="h-full bg-indigo-600 rounded-full animate-pulse"></div>
          </div>
        {:else}
          <!-- Determinate progress bar -->
          <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              class="h-full bg-indigo-600 rounded-full transition-all duration-300 ease-out"
              style="width: {percentage}%"
            ></div>
          </div>
          
          <!-- Progress text -->
          <div class="flex justify-between text-sm text-gray-600 mt-2">
            <span>{formatProgress(current, total)}</span>
            <span>{percentage}%</span>
          </div>
        {/if}
      </div>

      <!-- Stats -->
      {#if !isIndeterminate}
        <div class="grid grid-cols-2 gap-4 text-center text-sm text-gray-600 mb-6">
          <div>
            <div class="font-medium text-gray-900">{current.toLocaleString()}</div>
            <div>Processed</div>
          </div>
          <div>
            <div class="font-medium text-gray-900">{(total - current).toLocaleString()}</div>
            <div>Remaining</div>
          </div>
        </div>
      {/if}

      <!-- Actions -->
      {#if canCancel}
        <div class="text-center">
          <button
            on:click={handleCancel}
            class="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: .5;
    }
  }
</style>
