/**
 * Media metadata interface based on usage across the application
 */
export interface MediaMetadata {
  // Core file information
  file_path?: string;
  file_size_bytes?: number;
  file_size_mb?: number;

  // Media properties (video-specific, null for images)
  frame_count?: number;
  fps?: number;
  width?: number;
  height?: number;
  resolution?: string;
  duration_seconds?: number;
  duration_formatted?: string;
  codec_name?: string;

  // Color and depth information
  color_space?: string;
  bit_depth?: number;
  channels?: number;

  // Enhanced metrics
  format?: string;
  aspect_ratio?: number;
  bitrate_mbps?: number;
  total_pixels?: number;
  quality_category?: string;
  estimated_memory_mb?: number;

  // Media type indicator
  media_type?: 'video' | 'image';

  // Optional thumbnail
  thumbnail?: string;

  // Additional properties that might exist
  [key: string]: unknown;
}

/**
 * Utility functions for formatting various data types used in media analysis
 */
export const formatters = {
  /**
   * Format a number as decimal with specified precision
   * @param n - Number to format
   * @param digits - Number of decimal places (default: 2)
   * @returns Formatted decimal string
   */
  decimal: (n: number | unknown, digits: number = 2): string =>
    typeof n === 'number' ? n.toFixed(digits) : String(n),

  /**
   * Format a number with locale-specific thousands separators
   * @param n - Number to format
   * @returns Formatted integer string
   */
  integer: (n: number | unknown): string =>
    typeof n === 'number' ? n.toLocaleString(undefined) : String(n),

  /**
   * Format seconds into HH:MM:SS or MM:SS time string
   * @param seconds - Time in seconds
   * @returns Formatted time string
   */
  time: (seconds: number | unknown): string => {
    if (!seconds || typeof seconds !== 'number' || isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const mm = h ? String(m).padStart(2, '0') : String(m);
    const ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  },

  /**
   * Format file size in megabytes
   * @param mb - Size in megabytes
   * @returns Formatted file size string
   */
  fileSize: (mb: number | unknown): string =>
    mb ? `${formatters.decimal(mb, 2)} MB` : '—',

  /**
   * Format bitrate in megabits per second
   * @param mbps - Bitrate in Mbps
   * @returns Formatted bitrate string
   */
  bitrate: (mbps: number | unknown): string =>
    mbps ? `${formatters.decimal(mbps, 2)} Mbps` : 'Unknown',

  /**
   * Format memory size in megabytes
   * @param mb - Memory size in MB
   * @returns Formatted memory string
   */
  memory: (mb: number | unknown): string =>
    mb ? `${formatters.decimal(mb, 1)} MB` : '—',

  /**
   * Extract resolution from metadata
   * @param metadata - Media metadata object
   * @returns Resolution string or 'Unknown'
   */
  resolution: (metadata: MediaMetadata | null | undefined): string =>
    metadata?.resolution || 'Unknown',

  /**
   * Format FPS value
   * @param fps - Frames per second
   * @returns Formatted FPS string
   */
  fps: (fps: number | unknown): string =>
    fps ? formatters.decimal(fps, 1) : '—',

  /**
   * Format dimensions as width × height px
   * @param metadata - Media metadata object
   * @returns Formatted dimensions string
   */
  dimensions: (metadata: MediaMetadata | null | undefined): string => {
    if (metadata?.width && metadata?.height) {
      return `${metadata.width} × ${metadata.height} px`;
    }
    return 'Unknown';
  },

  /**
   * Format aspect ratio
   * @param ratio - Aspect ratio as number
   * @returns Formatted aspect ratio string
   */
  aspectRatio: (ratio: number | unknown): string =>
    ratio ? formatters.decimal(ratio, 2) : '—',

  /**
   * Format total pixels count
   * @param pixels - Total pixel count
   * @returns Formatted pixel count string
   */
  pixels: (pixels: number | unknown): string =>
    pixels ? formatters.integer(pixels) : '—',

  /**
   * Format frame count
   * @param frames - Number of frames
   * @returns Formatted frame count string
   */
  frames: (frames: number | unknown): string =>
    frames ? formatters.integer(frames) : '—',

  /**
   * Format bit depth
   * @param depth - Bit depth
   * @returns Formatted bit depth string
   */
  bitDepth: (depth: number | unknown): string =>
    depth ? `${depth} bits` : '—',

  /**
   * Format color channels
   * @param channels - Number of channels
   * @returns Formatted channels string
   */
  channels: (channels: number | unknown): string =>
    channels ? `${channels} channels` : '—',

  /**
   * Format bytes to human readable size
   * @param bytes - Size in bytes
   * @returns Formatted size string
   */
  bytes: (bytes: number | unknown): string => {
    if (!bytes || typeof bytes !== 'number') return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${formatters.decimal(size, 2)} ${units[unitIndex]}`;
  }
};
