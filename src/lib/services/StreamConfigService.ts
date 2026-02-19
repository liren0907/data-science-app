import { invoke } from '@tauri-apps/api/core';
import type { StreamConfig, ApiResponse, PaginatedResponse } from '../../types/tauri';

// Error types for stream configuration operations
export type StreamConfigError =
    | 'NETWORK_ERROR'
    | 'TIMEOUT_ERROR'
    | 'VALIDATION_ERROR'
    | 'TAURI_ERROR'
    | 'PARSE_ERROR'
    | 'UNKNOWN_ERROR';

// Metadata for tracking operation results
export interface StreamConfigMetadata {
    timestamp: number;
    duration: number;
    retries: number;
    command: string;
}

// Result wrapper for service operations
export interface StreamConfigResult<T = any> {
    success: boolean;
    data?: T;
    error?: StreamConfigError;
    message?: string;
    metadata: StreamConfigMetadata;
}

// Metrics interface for monitoring
export interface StreamConfigMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastRequestTime: number;
    uptime: number;
}

/**
 * Stream Configuration Service
 * Handles all stream config operations with Tauri backend
 */
export class StreamConfigService {
    private static readonly COMMAND_TIMEOUT = 10000; // 10 seconds
    private static readonly MAX_RETRIES = 3;

    // Metrics tracking
    private static metrics: StreamConfigMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastRequestTime: 0,
        uptime: Date.now()
    };

    /**
     * Get all stream configurations from database
     */
    static async getStreamConfigs(): Promise<StreamConfigResult<StreamConfig[]>> {
        const startTime = Date.now();
        this.metrics.totalRequests++;

        try {
            const result = await invoke('get_stream_configs');

            if (result && typeof result === 'object' && 'success' in result) {
                const apiResult = result as ApiResponse<StreamConfig[]>;

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
                            command: 'get_stream_configs'
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
                    data: result as StreamConfig[],
                    metadata: {
                        timestamp: Date.now(),
                        duration: Date.now() - startTime,
                        retries: 0,
                        command: 'get_stream_configs'
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
                    command: 'get_stream_configs'
                }
            };
        }
    }

    /**
     * Get stream configurations with pagination
     */
    static async getStreamConfigsPaginated(params: {
        page: number;
        limit: number;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }): Promise<StreamConfigResult<PaginatedResponse<StreamConfig>>> {
        const startTime = Date.now();
        this.metrics.totalRequests++;

        try {
            const result = await invoke('get_configs_paginated', {
                table: 'stream_configs',
                ...params
            });

            if (result && typeof result === 'object' && 'success' in result) {
                const apiResult = result as ApiResponse<PaginatedResponse<StreamConfig>>;

                if (apiResult.success && apiResult.data) {
                    this.metrics.successfulRequests++;
                    this.updateMetrics(startTime);

                    return {
                        success: true,
                        data: apiResult.data,
                        metadata: {
                            timestamp: Date.now(),
                            duration: Date.now() - startTime,
                            retries: 0,
                            command: 'get_configs_paginated'
                        }
                    };
                } else {
                    throw new Error(apiResult.error || 'Invalid response format');
                }
            } else {
                throw new Error('Invalid response format');
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
                    command: 'get_configs_paginated'
                }
            };
        }
    }

    /**
     * Search stream configurations
     */
    static async searchStreamConfigs(query: string, limit: number = 20): Promise<StreamConfigResult<StreamConfig[]>> {
        const startTime = Date.now();
        this.metrics.totalRequests++;

        try {
            const result = await invoke('search_configs', {
                table: 'stream_configs',
                query,
                limit
            });

            if (result && typeof result === 'object' && 'success' in result) {
                const apiResult = result as ApiResponse<StreamConfig[]>;

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
                            command: 'search_configs'
                        }
                    };
                } else {
                    throw new Error(apiResult.error || 'Invalid response format');
                }
            } else {
                throw new Error('Invalid response format');
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
                    command: 'search_configs'
                }
            };
        }
    }

    /**
     * Classify error types for better error handling
     */
    private static classifyError(error: any): StreamConfigError {
        if (!error) return 'UNKNOWN_ERROR';

        const errorMessage = error.message || error.toString();

        if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
            return 'TIMEOUT_ERROR';
        }

        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            return 'NETWORK_ERROR';
        }

        if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
            return 'PARSE_ERROR';
        }

        if (errorMessage.includes('tauri') || errorMessage.includes('invoke')) {
            return 'TAURI_ERROR';
        }

        if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
            return 'VALIDATION_ERROR';
        }

        return 'UNKNOWN_ERROR';
    }

    /**
     * Get user-friendly error messages
     */
    private static getErrorMessage(error: any): string {
        if (!error) return 'Unknown error occurred';
        return error.message || error.toString();
    }

    /**
     * Update metrics after request completion
     */
    private static updateMetrics(startTime: number): void {
        const duration = Date.now() - startTime;
        const totalRequests = this.metrics.totalRequests;

        // Update average response time
        this.metrics.averageResponseTime =
            (this.metrics.averageResponseTime * (totalRequests - 1) + duration) / totalRequests;

        this.metrics.lastRequestTime = Date.now();
    }

    /**
     * Get current metrics
     */
    static getMetrics(): StreamConfigMetrics {
        return { ...this.metrics };
    }

    /**
     * Cancel all active requests
     */
    static cancelRequests(): void {
        // For now, just log. In a more complex implementation,
        // you'd track active requests and cancel them
        console.log('Canceling active stream config requests');
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

// Export convenience functions for direct use
export const streamConfigService = {
    /**
     * Get all stream configs - convenience wrapper
     */
    async getStreamConfigs(): Promise<StreamConfigResult<StreamConfig[]>> {
        return StreamConfigService.getStreamConfigs();
    },

    /**
     * Get paginated stream configs - convenience wrapper
     */
    async getStreamConfigsPaginated(params: {
        page: number;
        limit: number;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }): Promise<StreamConfigResult<PaginatedResponse<StreamConfig>>> {
        return StreamConfigService.getStreamConfigsPaginated(params);
    },

    /**
     * Search stream configs - convenience wrapper
     */
    async searchStreamConfigs(query: string, limit?: number): Promise<StreamConfigResult<StreamConfig[]>> {
        return StreamConfigService.searchStreamConfigs(query, limit);
    },

    /**
     * Get metrics - convenience wrapper
     */
    getMetrics(): StreamConfigMetrics {
        return StreamConfigService.getMetrics();
    },

    /**
     * Cancel requests - convenience wrapper
     */
    cancelRequests(): void {
        StreamConfigService.cancelRequests();
    }
};