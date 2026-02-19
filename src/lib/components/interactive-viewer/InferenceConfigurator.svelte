<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { open } from '@tauri-apps/plugin-dialog';

  const dispatch = createEventDispatcher();

  let modelPath: string | null = null;
  let device = 'CPU';
  let confidenceThreshold = 0.5;
  let nmsThreshold = 0.45;

  function handleChange() {
    if (!modelPath) return; // Don't dispatch if model path is not set

    dispatch('configChange', {
      model_path: modelPath,
      device,
      confidence_threshold: confidenceThreshold,
      nms_threshold: nmsThreshold,
    });
  }

  async function selectModelFile() {
    try {
      const selected = await open({
        title: 'Select an OpenVINO AI Model',
        multiple: false,
        filters: [{ name: 'OpenVINO Model', extensions: ['xml'] }]
      });
      if (typeof selected === 'string') {
        modelPath = selected;
        handleChange(); // Dispatch change after selecting a file
      }
    } catch (e) {
      console.error('Error selecting model file:', e);
    }
  }
</script>

<div class="w-full h-auto bg-white p-6 rounded-lg shadow-md space-y-6">
  <h2 class="text-xl font-bold mb-4">Configuration</h2>
  
  <!-- AI Model -->
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
    <button on:click={selectModelFile} class="w-full p-2 border rounded-md text-left text-gray-700 hover:bg-gray-50">
      {modelPath ? modelPath.split(/[\\/]/).pop() : 'Select Model (.xml)'}
    </button>
  </div>

  <!-- Device -->
  <div>
    <label for="device" class="block text-sm font-medium text-gray-700 mb-1">Compute Device</label>
    <select id="device" bind:value={device} on:change={handleChange} class="w-full p-2 border rounded-md">
      <option>CPU</option>
      <option>GPU</option>
    </select>
  </div>

  <!-- Confidence -->
  <div>
    <label for="confidence" class="block text-sm font-medium text-gray-700">
      Confidence Threshold: {confidenceThreshold.toFixed(2)}
    </label>
    <input 
      id="confidence" 
      type="range" 
      bind:value={confidenceThreshold} 
      on:change={handleChange}
      min="0.1" 
      max="1" 
      step="0.05" 
      class="w-full"
    />
  </div>

</div> 