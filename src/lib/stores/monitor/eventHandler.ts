import { listen } from '@tauri-apps/api/event';
import { monitorStore } from './monitorStore';
import type { StreamEventPayload, FrameMetadata, VideoMetadata } from './types';

export class MonitorEventHandler {
    private unlisten: (() => void) | null = null;
    private eventId: string = "ai-stream";

    constructor() {
        // defined
    }

    async connect() {
        if (this.unlisten) return;

        console.log("MonitorEventHandler: Connecting to event stream...");
        try {
            this.unlisten = await listen<StreamEventPayload>(this.eventId, (event) => {
                this.handleEvent(event.payload);
            });
            monitorStore.updateStats({ stage: 'connected' });
        } catch (error) {
            console.error("MonitorEventHandler: Failed to listen", error);
        }
    }

    disconnect() {
        if (this.unlisten) {
            console.log("MonitorEventHandler: Disconnecting...");
            this.unlisten();
            this.unlisten = null;
        }
    }

    private handleEvent(payload: StreamEventPayload) {
        if (!payload || !payload.kind) return;

        switch (payload.kind) {
            case 'progress':
                this.handleProgress(payload);
                break;
            case 'complete':
                this.handleComplete();
                break;
            case 'error':
                this.handleError(payload.error);
                break;
        }
    }

    private handleProgress(payload: StreamEventPayload) {
        const metadata = payload.metadata;
        if (!metadata) return;

        const processingStats = metadata.metadata; // Nested metadata from backend

        // Update Stats
        if (processingStats) {
            monitorStore.updateStats({
                stage: processingStats.stage || 'processing',
                video_progress_percentage: processingStats.video_progress_percentage || 0,
                fps: processingStats.fps || 0,
                processing_time_ms: processingStats.processing_time_ms || 0
            });

            // Set Video Metadata if not set
            if (processingStats.video_total_frames && processingStats.video_fps) {
                const videoMeta: VideoMetadata = {
                    video_fps: processingStats.video_fps,
                    video_total_frames: processingStats.video_total_frames,
                    video_width: processingStats.video_width || 0,
                    video_height: processingStats.video_height || 0,
                    duration_formatted: this.formatDuration(processingStats.video_total_frames, processingStats.video_fps),
                    resolution: processingStats.video_width ? `${processingStats.video_width}x${processingStats.video_height}` : undefined
                };
                // We only set if store is empty? Or always update?
                monitorStore.setVideoMetadata(videoMeta);
            }
        }

        // Add Frame
        if (metadata.frame_data && typeof metadata.frame_data === 'string') {
            const frame: FrameMetadata = {
                frame_index: metadata.frame_index || 0,
                timestamp: metadata.timestamp || 0,
                frame_data: metadata.frame_data,
                metadata: processingStats || {},
                dag_store_metadata: metadata.dag_store_metadata,
                detections: [], // Extracted later if needed
                violations: []
            };
            monitorStore.addFrame(frame);
        }
    }

    private handleComplete() {
        monitorStore.setStreaming(false);
        monitorStore.updateStats({ stage: 'completed' });
    }

    private handleError(error?: string) {
        console.error("MonitorEventHandler Error:", error);
        monitorStore.setStreaming(false);
        monitorStore.updateStats({ stage: 'error' });
    }

    private formatDuration(totalFrames: number, fps: number): string {
        if (!fps) return "0:00";
        const totalSeconds = totalFrames / fps;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
}

export const monitorEventHandler = new MonitorEventHandler();
