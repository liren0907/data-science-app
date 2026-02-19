export interface VideoMetadata {
    video_fps: number;
    video_total_frames: number;
    video_width: number;
    video_height: number;
    duration_formatted: string;
    resolution?: string;
}

export interface ProcessingStats {
    stage: string;
    video_progress_percentage: number;
    fps: number;
    processing_time_ms: number;
    total_detections: number;
    total_violations: number;
}

export interface SecurityEvent {
    id: string;
    timestamp: number;
    frameIndex: number;
    type: string;
    description: string;
    severity: "low" | "medium" | "high";
    snapshot?: string; // Base64 image
}

export interface FrameMetadata {
    frame_index: number;
    timestamp: number;
    frame_data: string; // Base64 image
    metadata: {
        stage: string;
        video_progress_percentage: number;
        fps: number; // Inference FPS
        processing_time_ms: number;
        video_fps: number;
        video_total_frames: number;
        video_width: number;
        video_height: number;
    };
    dag_store_metadata?: any; // To be refined if we know the DAG structure
    detections?: any[];
    violations?: any[];
}

export interface MonitorState {
    isConnected: boolean;
    isStreaming: boolean;
    isPlaying: boolean;
    currentFrameIndex: number;
    frameData: FrameMetadata[];
    videoMetadata: VideoMetadata | null;
    processingStats: ProcessingStats;
    securityEvents: SecurityEvent[];
    loadingState: {
        isModelLoading: boolean;
        progress: number;
        message: string;
    };
}

export interface StreamEventPayload {
    kind: "progress" | "complete" | "error";
    metadata?: {
        frame_index?: number;
        timestamp?: number;
        frame_data?: string;
        metadata?: any; // processing stats
        dag_store_metadata?: any;
    };
    error?: string;
}
