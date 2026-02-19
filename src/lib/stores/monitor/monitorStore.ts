import { writable, derived } from 'svelte/store';
import type { MonitorState, FrameMetadata, VideoMetadata, ProcessingStats, SecurityEvent } from './types';

const INITIAL_STATE: MonitorState = {
    isConnected: false,
    isStreaming: false,
    isPlaying: false,
    currentFrameIndex: 0,
    frameData: [],
    videoMetadata: null,
    processingStats: {
        stage: 'idle',
        video_progress_percentage: 0,
        fps: 0,
        processing_time_ms: 0,
        total_detections: 0,
        total_violations: 0
    },
    securityEvents: [],
    loadingState: {
        isModelLoading: false,
        progress: 0,
        message: ''
    }
};

function createMonitorStore() {
    const { subscribe, set, update } = writable<MonitorState>(INITIAL_STATE);

    return {
        subscribe,

        // Actions
        setStreaming: (isStreaming: boolean) => update(s => ({ ...s, isStreaming })),

        setPlaying: (isPlaying: boolean) => update(s => ({ ...s, isPlaying })),

        setCurrentFrameIndex: (index: number) => update(s => {
            if (index < 0 || index >= s.frameData.length) return s;
            return { ...s, currentFrameIndex: index };
        }),

        setVideoMetadata: (metadata: VideoMetadata) => update(s => ({ ...s, videoMetadata: metadata })),

        addFrame: (frame: FrameMetadata) => update(s => {
            // Create a new array reference to trigger updates
            const newFrameData = [...s.frameData, frame];

            // Auto-advance if streaming and not manually paused/playing
            let newIndex = s.currentFrameIndex;
            if (s.isStreaming && !s.isPlaying) {
                newIndex = newFrameData.length - 1;
            }

            return {
                ...s,
                frameData: newFrameData,
                currentFrameIndex: newIndex
            };
        }),

        updateStats: (stats: Partial<ProcessingStats>) => update(s => ({
            ...s,
            processingStats: { ...s.processingStats, ...stats }
        })),

        addSecurityEvent: (event: SecurityEvent) => update(s => ({
            ...s,
            securityEvents: [...s.securityEvents, event]
        })),

        reset: () => set(INITIAL_STATE),

        // Setters for raw loading state
        setLoadingState: (state: Partial<MonitorState['loadingState']>) => update(s => ({
            ...s,
            loadingState: { ...s.loadingState, ...state }
        }))
    };
}

export const monitorStore = createMonitorStore();

// Derived stores for convenience
export const currentFrame = derived(monitorStore, $s => $s.frameData[$s.currentFrameIndex] || null);
export const isStreaming = derived(monitorStore, $s => $s.isStreaming);
export const videoMetadata = derived(monitorStore, $s => $s.videoMetadata);
export const processingStats = derived(monitorStore, $s => $s.processingStats);
