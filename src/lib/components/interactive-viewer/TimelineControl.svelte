<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let frameCount = 0;
  export let currentIndex = 0;
  export let isPlaying = false; // Control play/pause state from parent

  const dispatch = createEventDispatcher();

  let timelineEl: HTMLElement;
  let isDragging = false;

  // Reactive calculations
  $: progress = frameCount > 1 ? (currentIndex / (frameCount - 1)) * 100 : 0;

  // --- Event Handlers ---

  function handleMouseDown(event: MouseEvent) {
    if (event.button !== 0) return; // Only main button
    isDragging = true;
    updateFrameFromEvent(event);
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(event: MouseEvent) {
    if (isDragging) {
      updateFrameFromEvent(event);
    }
  }

  function handleMouseUp(event: MouseEvent) {
    if (event.button !== 0) return;
    isDragging = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }

  function updateFrameFromEvent(event: MouseEvent) {
    if (!timelineEl) return;
    const bounds = timelineEl.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const width = bounds.width;
    
    // Clamp the position between 0 and width
    const clampedX = Math.max(0, Math.min(x, width));
    
    const targetFrame = Math.round((clampedX / width) * (frameCount - 1));

    if (targetFrame !== currentIndex) {
      dispatch('seek', { frame: targetFrame });
    }
  }

  function togglePlay() {
    dispatch('togglePlay');
  }

  function restart() {
    dispatch('restart');
  }

  function formatTime(frame: number, frameRate = 30) {
    if (frameCount <= 0) return "00:00.000";
    const totalSeconds = frame / frameRate;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.round((totalSeconds - (minutes * 60) - seconds) * 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  }
</script>

<div class="w-full bg-gray-800 text-white rounded-lg p-3 flex flex-col space-y-3 select-none">
  <!-- Top Bar: Controls and Time -->
  <div class="flex justify-between items-center px-1">
    <div class="flex items-center space-x-3">
      <button
        on:click={restart}
        class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-indigo-600 transition-colors"
        aria-label="Restart"
      >
        <!-- Restart Icon -->
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M14 4h2v12h-2V4zm-2 6l-9-6v12l9-6z"/>
        </svg>
      </button>
      <button 
        on:click={togglePlay}
        class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-indigo-600 transition-colors"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        <!-- Play/Pause Icon -->
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          {#if isPlaying}
            <!-- Pause Icon -->
            <path d="M6 4h3v12H6V4zm5 0h3v12h-3V4z"/>
          {:else}
            <!-- Play Icon -->
            <path d="M6 4l10 6-10 6V4z"/>
          {/if}
        </svg>
      </button>
      <div class="font-mono text-sm tracking-wider">
        <span>{formatTime(currentIndex)}</span>
        <span class="text-gray-400"> / {formatTime(frameCount > 0 ? frameCount - 1 : 0)}</span>
      </div>
    </div>
    <div class="font-mono text-xs text-gray-400">
      {currentIndex} / {frameCount > 0 ? frameCount - 1 : 0} frames
    </div>
  </div>

  <!-- Timeline Bar -->
  <div 
    class="w-full h-4 relative cursor-pointer"
    bind:this={timelineEl}
    on:mousedown={handleMouseDown}
  >
    <!-- Background Bar -->
    <div class="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-gray-600 rounded-full"></div>
    
    <!-- Progress Bar -->
    <div 
      class="absolute top-1/2 -translate-y-1/2 h-1.5 bg-indigo-500 rounded-full"
      style="width: {progress}%;"
    ></div>

    <!-- Playhead Handle -->
    <div 
      class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-indigo-500 shadow-lg"
      style="left: {progress}%;"
    ></div>
  </div>
</div> 