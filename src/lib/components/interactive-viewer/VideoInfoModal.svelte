<!-- VideoInfoModal component -->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();

  export let videoMetadata: any = null;
  export let isVisible = false;

  interface LoadingStrategy {
    type: string;
    label: string;
    description: string;
    icon: string;
    value?: number;
  }

  let selectedStrategy: LoadingStrategy = {
    type: 'first_n',
    label: 'Quick Preview',
    description: 'Load first 20 frames for quick preview',
    icon: '⚡',
    value: 20
  };

  const strategies: LoadingStrategy[] = [
    {
      type: 'first_n',
      label: 'Quick Preview',
      description: 'Load first 20 frames for quick preview',
      icon: '⚡',
      value: 20
    },
    {
      type: 'all_frames',
      label: 'Load All Frames',
      description: 'Load complete video (may use significant memory)',
      icon: '📹'
    },
    {
      type: 'every_nth',
      label: 'Smart Sampling',
      description: 'Load every 10th frame for efficient analysis',
      icon: '🎯',
      value: 10
    },
    {
      type: 'key_frames',
      label: 'Key Frames Only',
      description: 'Extract important frames automatically',
      icon: '🔑'
    }
  ];

  function handleStrategySelect(strategy: LoadingStrategy) {
    selectedStrategy = strategy;
  }

  function handleConfirm() {
    dispatch('confirm', selectedStrategy);
    isVisible = false;
  }

  function handleCancel() {
    dispatch('cancel');
    isVisible = false;
  }

  function formatFileSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return mb > 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
  }

  function getMemoryWarning(strategy: LoadingStrategy): string {
    if (!videoMetadata) return '';
    
    const baseMb = videoMetadata.estimated_memory_mb || 0;
    
    switch (strategy.type) {
      case 'all_frames':
        return baseMb > 500 ? '⚠️ High memory usage expected' : '';
      case 'first_n':
        return '';
      case 'every_nth':
        const sampledMb = baseMb / (strategy.value || 10);
        return sampledMb > 200 ? '⚠️ Moderate memory usage' : '';
      default:
        return '';
    }
  }
</script>

{#if isVisible && videoMetadata}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200">
        <h2 class="text-2xl font-bold text-gray-900">Video Analysis Complete</h2>
        <p class="text-gray-600 mt-1">Choose how you'd like to process this video</p>
      </div>

      <div class="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Video Info Panel -->
        <div class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Video Information</h3>
            
            <!-- Thumbnail -->
            {#if videoMetadata.thumbnail}
              <div class="mb-4">
                <img 
                  src="data:image/jpeg;base64,{videoMetadata.thumbnail}" 
                  alt="Video thumbnail"
                  class="rounded-lg shadow-md max-w-full h-auto"
                />
              </div>
            {/if}

            <!-- Metadata Grid -->
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div class="space-y-3">
                <div>
                  <span class="text-gray-500">Duration</span>
                  <div class="font-medium">{videoMetadata.duration_formatted}</div>
                </div>
                <div>
                  <span class="text-gray-500">Resolution</span>
                  <div class="font-medium">{videoMetadata.resolution}</div>
                </div>
                <div>
                  <span class="text-gray-500">Frame Rate</span>
                  <div class="font-medium">{videoMetadata.fps.toFixed(1)} fps</div>
                </div>
              </div>
              <div class="space-y-3">
                <div>
                  <span class="text-gray-500">Total Frames</span>
                  <div class="font-medium">{videoMetadata.frame_count.toLocaleString()}</div>
                </div>
                <div>
                  <span class="text-gray-500">File Size</span>
                  <div class="font-medium">{formatFileSize(videoMetadata.file_size_bytes)}</div>
                </div>
                <div>
                  <span class="text-gray-500">Est. Memory</span>
                  <div class="font-medium">{videoMetadata.estimated_memory_mb.toFixed(0)} MB</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading Strategy Panel -->
        <div class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Processing Strategy</h3>
            
            <div class="space-y-3">
              {#each strategies as strategy}
                <button
                  class="w-full text-left p-4 rounded-lg border-2 transition-all {
                    selectedStrategy.type === strategy.type 
                      ? 'border-indigo-500 bg-indigo-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }"
                  on:click={() => handleStrategySelect(strategy)}
                >
                  <div class="flex items-start space-x-3">
                    <span class="text-2xl">{strategy.icon}</span>
                    <div class="flex-1">
                      <div class="font-medium text-gray-900">{strategy.label}</div>
                      <div class="text-sm text-gray-600 mt-1">{strategy.description}</div>
                      {#if strategy.value}
                        <div class="text-xs text-gray-500 mt-1">
                          {strategy.type === 'first_n' ? `First ${strategy.value} frames` : `Every ${strategy.value} frames`}
                        </div>
                      {/if}
                      <!-- Memory Warning -->
                      {#if getMemoryWarning(strategy)}
                        <div class="text-xs text-orange-600 mt-1">
                          {getMemoryWarning(strategy)}
                        </div>
                      {/if}
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          </div>

          <!-- Estimated Results -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="font-medium text-gray-900 mb-2">Estimated Results</h4>
            <div class="text-sm text-gray-600 space-y-1">
              {#if selectedStrategy.type === 'all_frames'}
                <div>• Frames to load: {videoMetadata.frame_count.toLocaleString()}</div>
                <div>• Memory usage: ~{videoMetadata.estimated_memory_mb.toFixed(0)} MB</div>
              {:else if selectedStrategy.type === 'first_n'}
                <div>• Frames to load: {Math.min(selectedStrategy.value || 20, videoMetadata.frame_count)}</div>
                <div>• Memory usage: ~{((selectedStrategy.value || 20) / videoMetadata.frame_count * videoMetadata.estimated_memory_mb).toFixed(0)} MB</div>
              {:else if selectedStrategy.type === 'every_nth'}
                <div>• Frames to load: ~{Math.ceil(videoMetadata.frame_count / (selectedStrategy.value || 10)).toLocaleString()}</div>
                <div>• Memory usage: ~{(videoMetadata.estimated_memory_mb / (selectedStrategy.value || 10)).toFixed(0)} MB</div>
              {:else if selectedStrategy.type === 'key_frames'}
                <div>• Frames to load: ~{Math.ceil(videoMetadata.frame_count / 30).toLocaleString()}</div>
                <div>• Memory usage: ~{(videoMetadata.estimated_memory_mb / 30).toFixed(0)} MB</div>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-6 border-t border-gray-200 flex justify-end space-x-3">
        <button
          on:click={handleCancel}
          class="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          on:click={handleConfirm}
          class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          Start Processing
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }
  .overflow-y-auto::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }
  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }
  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: #a1a1a1;
  }
</style>
