<script lang="ts">
  // Props to receive data from the parent page
  export let frameData: string | null = null;
  // The 'annotations' prop is kept for API compatibility but no longer used for drawing
  export const annotations: any[] = [];
</script>

<div class="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center text-white relative">
  {#if frameData}
    <img
      src={`data:image/jpeg;base64,${frameData}`}
      alt="Video Frame"
      class="w-full h-full object-cover"
    />
    <!-- The SVG overlay for drawing annotations has been removed. -->
  {:else}
    <div class="text-center">
      <h3 class="text-lg font-semibold">Interactive Player</h3>
      <p class="text-gray-400">Select a video to begin</p>
    </div>
  {/if}
</div> 