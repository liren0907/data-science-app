import { invoke } from '@tauri-apps/api/core';
import type { OggConfig, ApiResponse, PaginatedResponse } from '../../types/tauri';

// Error types for OGG configuration operations
export type OggConfigError =
    | 'NETWORK_ERROR'
    | 'TIMEOUT_ERROR'
    | 'VALIDATION_ERROR'
    | 'TAURI_ERROR'
    | 'PARSE_ERROR'
    | 'UNKNOWN_ERROR';

// Metadata for tracking operation results
export interface OggConfigMetadata {
    timestamp: number;
    duration: number;
    retries: number;
    command: string;
}

// Result wrapper for service operations
export interface OggConfigResult<T = any> {
    success: boolean;
    data?: T;
    error?: OggConfigError;
    message?: string;
    metadata: OggConfigMetadata;
}

// Metrics interface for monitoring
export interface OggConfigMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastRequestTime: number;
    uptime: number;
}

/**
 * OGG Configuration Service
 * Handles all OGG config operations with Tauri backend
 */
export class OggConfigService {
    private static readonly COMMAND_TIMEOUT = 10000; // 10 seconds
    private static readonly MAX_RETRIES = 3;

    // Metrics tracking
    private static metrics: OggConfigMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastRequestTime: 0,
        uptime: Date.now()
    };

    /**
     * Get all OGG configurations from database
     */
    static async getOggConfigs(): Promise<OggConfigResult<OggConfig[]>> {
        const startTime = Date.now();
        this.metrics.totalRequests++;

        try {
            const result = await invoke('get_ogg_configs');

            if (result && typeof result === 'object' && 'success' in result) {
                const apiResult = result as ApiResponse<OggConfig[]>;

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
                            command: 'get_ogg_configs'
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
                    data: result as OggConfig[],
                    metadata: {
                        timestamp: Date.now(),
                        duration: Date.now() - startTime,
                        retries: 0,
                        command: 'get_ogg_configs'
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
                    command: 'get_ogg_configs'
                }
            };
        }
    }

    /**
     * Get paginated OGG configurations
     */
    static async getOggConfigsPaginated(params: {
        page: number;
        limit: number;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }): Promise<OggConfigResult<PaginatedResponse<OggConfig>>> {
        const startTime = Date.now();
        this.metrics.totalRequests++;

        try {
            const result = await invoke('get_configs_paginated', {
                table: 'ogg_configs',
                ...params
            });

            if (result && typeof result === 'object' && 'success' in result) {
                const apiResult = result as ApiResponse<PaginatedResponse<OggConfig>>;

                if (apiResult.success) {
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
                    throw new Error(apiResult.error || 'Failed to get paginated OGG configs');
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
     * Search OGG configurations
     */
    static async searchOggConfigs(query: string, limit: number = 20): Promise<OggConfigResult<OggConfig[]>> {
        const startTime = Date.now();
        this.metrics.totalRequests++;

        try {
            const result = await invoke('search_configs', {
                table: 'ogg_configs',
                query,
                limit
            });

            if (result && typeof result === 'object' && 'success' in result) {
                const apiResult = result as ApiResponse<OggConfig[]>;

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
                    throw new Error(apiResult.error || 'Search failed');
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
     * Classify error types for better handling
     */
    private static classifyError(error: any): OggConfigError {
        if (!error) return 'UNKNOWN_ERROR';

        const errorMessage = error.message || error.toString().toLowerCase();

        if (errorMessage.includes('network') || errorMessage.includes('connection')) {
            return 'NETWORK_ERROR';
        }
        if (errorMessage.includes('timeout')) {
            return 'TIMEOUT_ERROR';
        }
        if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
            return 'VALIDATION_ERROR';
        }
        if (errorMessage.includes('tauri') || errorMessage.includes('invoke')) {
            return 'TAURI_ERROR';
        }
        if (errorMessage.includes('parse') || errorMessage.includes('json')) {
            return 'PARSE_ERROR';
        }

        return 'UNKNOWN_ERROR';
    }

    /**
     * Get user-friendly error message
     */
    private static getErrorMessage(error: any): string {
        return error?.message || error?.toString() || 'An unknown error occurred';
    }

    /**
     * Update performance metrics
     */
    private static updateMetrics(startTime: number): void {
        const duration = Date.now() - startTime;
        this.metrics.lastRequestTime = Date.now();

        // Calculate rolling average response time
        const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + duration;
        this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;
    }

    /**
     * Get current service metrics
     */
    static getMetrics(): OggConfigMetrics {
        return { ...this.metrics };
    }

    /**
     * Cancel any pending requests (placeholder for future implementation)
     */
    static cancelRequests(): void {
        // Implementation would depend on request tracking
        console.log('OGG Config requests cancelled');
    }

    /**
     * Reset service metrics
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

// Export singleton instance for easy use
export const oggConfigService = {
    /**
     * Get all OGG configurations
     */
    async getOggConfigs(): Promise<OggConfigResult<OggConfig[]>> {
        return OggConfigService.getOggConfigs();
    },

    /**
     * Get paginated OGG configurations
     */
    async getOggConfigsPaginated(params: {
        page: number;
        limit: number;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }): Promise<OggConfigResult<PaginatedResponse<OggConfig>>> {
        return OggConfigService.getOggConfigsPaginated(params);
    },

    /**
     * Search OGG configurations
     */
    async searchOggConfigs(query: string, limit?: number): Promise<OggConfigResult<OggConfig[]>> {
        return OggConfigService.searchOggConfigs(query, limit);
    },

    /**
     * Get service metrics
     */
    getMetrics(): OggConfigMetrics {
        return OggConfigService.getMetrics();
    },

    /**
     * Cancel pending requests
     */
    cancelRequests(): void {
        OggConfigService.cancelRequests();
    }
};