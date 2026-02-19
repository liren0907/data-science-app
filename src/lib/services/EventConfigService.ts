import { invoke } from '@tauri-apps/api/core';
import type { EventConfig, ApiResponse, PaginatedResponse } from '../../types/tauri';

// Error types for Event configuration operations
export type EventConfigError =
    | 'NETWORK_ERROR'
    | 'TIMEOUT_ERROR'
    | 'VALIDATION_ERROR'
    | 'TAURI_ERROR'
    | 'PARSE_ERROR'
    | 'UNKNOWN_ERROR';

// Metadata for tracking operation results
export interface EventConfigMetadata {
    timestamp: number;
    duration: number;
    retries: number;
    command: string;
}

// Result wrapper for service operations
export interface EventConfigResult<T = any> {
    success: boolean;
    data?: T;
    error?: EventConfigError;
    message?: string;
    metadata: EventConfigMetadata;
}

// Metrics interface for monitoring
export interface EventConfigMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastRequestTime: number;
    uptime: number;
}

/**
 * Event Configuration Service
 * Handles all Event config operations with Tauri backend
 */
export class EventConfigService {
    private static readonly COMMAND_TIMEOUT = 10000; // 10 seconds
    private static readonly MAX_RETRIES = 3;

    // Metrics tracking
    private static metrics: EventConfigMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastRequestTime: 0,
        uptime: Date.now()
    };

    /**
     * Get all event configurations
     */
    static async getEventConfigs(): Promise<EventConfigResult<EventConfig[]>> {
        const startTime = Date.now();
        this.metrics.totalRequests++;

        try {
            const result = await invoke('get_event_configs');

            if (result && typeof result === 'object' && 'success' in result) {
                const apiResult = result as ApiResponse<EventConfig[]>;

                if (apiResult.success && Array.isArray(apiResult.data)) {
                    this.metrics.successfulRequests++;
                    this.updateMetrics(startTime);

                    return {
                        success: true,
                        data: apiResult.data,
                        metadata: {
                            timestamp: Date.now(),
                            duration: Date.now() - startTime,
                            retries: 0,
                            command: 'get_event_configs'
                        }
                    };
                } else {
                    throw new Error(apiResult.error || 'Invalid response format');
                }
            } else {
                // Handle direct array response
                this.metrics.successfulRequests++;
                this.updateMetrics(startTime);

                return {
                    success: true,
                    data: result as EventConfig[],
                    metadata: {
                        timestamp: Date.now(),
                        duration: Date.now() - startTime,
                        retries: 0,
                        command: 'get_event_configs'
                    }
                };
            }
        } catch (error) {
            this.metrics.failedRequests++;
            this.updateMetrics(startTime);

            return {
                success: false,
                error: this.classifyError(error),
                message: this.getErrorMessage(error),
                metadata: {
                    timestamp: Date.now(),
                    duration: Date.now() - startTime,
                    retries: 0,
                    command: 'get_event_configs'
                }
            };
        }
    }

    /**
     * Get paginated event configurations
     */
    static async getEventConfigsPaginated(params: {
        page: number;
        limit: number;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }): Promise<EventConfigResult<PaginatedResponse<EventConfig>>> {
        const startTime = Date.now();
        const metadata: EventConfigMetadata = {
            timestamp: startTime,
            duration: 0,
            retries: 0,
            command: 'get_event_configs_paginated'
        };

        try {
            this.metrics.totalRequests++;
            
            const response = await invoke<ApiResponse<PaginatedResponse<EventConfig>>>(
                'get_event_configs_paginated',
                params
            );
            
            metadata.duration = Date.now() - startTime;
            this.updateMetrics(startTime);
            
            if (response.success && response.data) {
                this.metrics.successfulRequests++;
                return {
                    success: true,
                    data: response.data,
                    metadata
                };
            } else {
                this.metrics.failedRequests++;
                return {
                    success: false,
                    error: 'TAURI_ERROR',
                    message: response.message || 'Failed to fetch paginated event configs',
                    metadata
                };
            }
        } catch (error) {
            this.metrics.failedRequests++;
            metadata.duration = Date.now() - startTime;
            
            return {
                success: false,
                error: this.classifyError(error),
                message: this.getErrorMessage(error),
                metadata
            };
        }
    }

    /**
     * Search event configurations
     */
    static async searchEventConfigs(query: string, limit: number = 20): Promise<EventConfigResult<EventConfig[]>> {
        const startTime = Date.now();
        const metadata: EventConfigMetadata = {
            timestamp: startTime,
            duration: 0,
            retries: 0,
            command: 'search_event_configs'
        };

        try {
            this.metrics.totalRequests++;
            
            const response = await invoke<ApiResponse<EventConfig[]>>(
                'search_event_configs',
                { query, limit }
            );
            
            metadata.duration = Date.now() - startTime;
            this.updateMetrics(startTime);
            
            if (response.success && response.data) {
                this.metrics.successfulRequests++;
                return {
                    success: true,
                    data: response.data,
                    metadata
                };
            } else {
                this.metrics.failedRequests++;
                return {
                    success: false,
                    error: 'TAURI_ERROR',
                    message: response.message || 'Failed to search event configs',
                    metadata
                };
            }
        } catch (error) {
            this.metrics.failedRequests++;
            metadata.duration = Date.now() - startTime;
            
            return {
                success: false,
                error: this.classifyError(error),
                message: this.getErrorMessage(error),
                metadata
            };
        }
    }

    /**
     * Classify error types for better handling
     */
    private static classifyError(error: any): EventConfigError {
        if (error?.message?.includes('timeout')) {
            return 'TIMEOUT_ERROR';
        }
        if (error?.message?.includes('network')) {
            return 'NETWORK_ERROR';
        }
        if (error?.message?.includes('validation')) {
            return 'VALIDATION_ERROR';
        }
        if (error?.message?.includes('parse')) {
            return 'PARSE_ERROR';
        }
        if (error?.name === 'TauriError') {
            return 'TAURI_ERROR';
        }
        return 'UNKNOWN_ERROR';
    }

    /**
     * Get user-friendly error message
     */
    private static getErrorMessage(error: any): string {
        return error?.message || 'An unexpected error occurred';
    }

    /**
     * Update internal metrics
     */
    private static updateMetrics(startTime: number): void {
        const duration = Date.now() - startTime;
        const totalRequests = this.metrics.totalRequests;
        
        this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime * (totalRequests - 1) + duration) / totalRequests;
        this.metrics.lastRequestTime = Date.now();
    }

    /**
     * Get current metrics
     */
    static getMetrics(): EventConfigMetrics {
        return { ...this.metrics };
    }

    /**
     * Cancel all pending requests (placeholder for future implementation)
     */
    static cancelRequests(): void {
        // Implementation would depend on request tracking
        console.warn('Request cancellation not yet implemented for EventConfigService');
    }

    /**
     * Reset metrics
     */
    static resetMetrics(): void {
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            lastRequestTime: 0,
            uptime: Date.now()
        };
    }
}

// Export singleton instance for convenience
export const eventConfigService = {
    /**
     * Get all event configurations
     */
    async getEventConfigs(): Promise<EventConfigResult<EventConfig[]>> {
        return EventConfigService.getEventConfigs();
    },

    /**
     * Get paginated event configurations
     */
    async getEventConfigsPaginated(params: {
        page: number;
        limit: number;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }): Promise<EventConfigResult<PaginatedResponse<EventConfig>>> {
        return EventConfigService.getEventConfigsPaginated(params);
    },

    /**
     * Search event configurations
     */
    async searchEventConfigs(query: string, limit?: number): Promise<EventConfigResult<EventConfig[]>> {
        return EventConfigService.searchEventConfigs(query, limit);
    },

    /**
     * Get current metrics
     */
    getMetrics(): EventConfigMetrics {
        return EventConfigService.getMetrics();
    },

    /**
     * Cancel all pending requests
     */
    cancelRequests(): void {
        EventConfigService.cancelRequests();
    },

    /**
     * Reset metrics
     */
    resetMetrics(): void {
        EventConfigService.resetMetrics();
    }
};