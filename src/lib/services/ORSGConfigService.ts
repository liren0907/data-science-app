import { invoke } from '@tauri-apps/api/core';
import type { OrsgConfig, ApiResponse, PaginatedResponse } from '../../types/tauri';

// Error types for ORSG configuration operations
export type OrsgConfigError =
    | 'NETWORK_ERROR'
    | 'TIMEOUT_ERROR'
    | 'VALIDATION_ERROR'
    | 'TAURI_ERROR'
    | 'PARSE_ERROR'
    | 'UNKNOWN_ERROR';

// Metadata for tracking operation results
export interface OrsgConfigMetadata {
    timestamp: number;
    duration: number;
    retries: number;
    command: string;
}

// Result wrapper for service operations
export interface OrsgConfigResult<T = any> {
    success: boolean;
    data?: T;
    error?: OrsgConfigError;
    message?: string;
    metadata: OrsgConfigMetadata;
}

// Metrics interface for monitoring
export interface OrsgConfigMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastRequestTime: number;
    uptime: number;
}

/**
 * ORSG Configuration Service
 * Handles all ORSG config operations with Tauri backend
 */
export class ORSGConfigService {
    private static readonly COMMAND_TIMEOUT = 10000; // 10 seconds
    private static readonly MAX_RETRIES = 3;

    // Metrics tracking
    private static metrics: OrsgConfigMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastRequestTime: 0,
        uptime: Date.now()
    };

    /**
     * Get all ORSG configurations from database
     */
    static async getOrsgConfigs(): Promise<OrsgConfigResult<OrsgConfig[]>> {
        const startTime = Date.now();
        this.metrics.totalRequests++;

        try {
            const result = await invoke('get_orsg_configs');

            if (result && typeof result === 'object' && 'success' in result) {
                const apiResult = result as ApiResponse<OrsgConfig[]>;

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
                            command: 'get_orsg_configs'
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
                    data: result as OrsgConfig[],
                    metadata: {
                        timestamp: Date.now(),
                        duration: Date.now() - startTime,
                        retries: 0,
                        command: 'get_orsg_configs'
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
                    command: 'get_orsg_configs'
                }
            };
        }
    }

    /**
     * Get paginated ORSG configurations
     */
    static async getOrsgConfigsPaginated(params: {
        page: number;
        limit: number;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }): Promise<OrsgConfigResult<PaginatedResponse<OrsgConfig>>> {
        const startTime = Date.now();
        this.metrics.totalRequests++;

        try {
            const result = await invoke('get_configs_paginated', {
                table: 'orsg_configs',
                ...params
            });

            if (result && typeof result === 'object' && 'success' in result) {
                const apiResult = result as ApiResponse<PaginatedResponse<OrsgConfig>>;

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
                    throw new Error(apiResult.error || 'Pagination failed');
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
     * Search ORSG configurations
     */
    static async searchOrsgConfigs(query: string, limit: number = 20): Promise<OrsgConfigResult<OrsgConfig[]>> {
        const startTime = Date.now();
        this.metrics.totalRequests++;

        try {
            const result = await invoke('search_orsg_configs', {
                query,
                limit
            });

            if (result && typeof result === 'object') {
                this.metrics.successfulRequests++;
                this.updateMetrics(startTime);

                // Handle both direct array and wrapped response
                const data = Array.isArray(result) ? result : (result as any).data || [];

                return {
                    success: true,
                    data: data as OrsgConfig[],
                    metadata: {
                        timestamp: Date.now(),
                        duration: Date.now() - startTime,
                        retries: 0,
                        command: 'search_orsg_configs'
                    }
                };
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
                    command: 'search_orsg_configs'
                }
            };
        }
    }

    /**
     * Classify error types for better error handling
     */
    private static classifyError(error: any): OrsgConfigError {
        if (!error) return 'UNKNOWN_ERROR';

        const errorString = String(error).toLowerCase();

        if (errorString.includes('network') || errorString.includes('connection')) {
            return 'NETWORK_ERROR';
        }
        if (errorString.includes('timeout')) {
            return 'TIMEOUT_ERROR';
        }
        if (errorString.includes('validation') || errorString.includes('invalid')) {
            return 'VALIDATION_ERROR';
        }
        if (errorString.includes('tauri') || errorString.includes('invoke')) {
            return 'TAURI_ERROR';
        }
        if (errorString.includes('parse') || errorString.includes('json')) {
            return 'PARSE_ERROR';
        }

        return 'UNKNOWN_ERROR';
    }

    /**
     * Get user-friendly error message
     */
    private static getErrorMessage(error: any): string {
        return error?.message || String(error) || 'An unknown error occurred';
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
    static getMetrics(): OrsgConfigMetrics {
        return { ...this.metrics };
    }

    /**
     * Cancel all pending requests (placeholder for future implementation)
     */
    static cancelRequests(): void {
        console.log('ORSG Config Service: Cancelling pending requests...');
        // Implementation would depend on request tracking
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
export const orsgConfigService = {
    /**
     * Get all ORSG configurations
     */
    async getOrsgConfigs(): Promise<OrsgConfigResult<OrsgConfig[]>> {
        return ORSGConfigService.getOrsgConfigs();
    },

    /**
     * Get paginated ORSG configurations
     */
    async getOrsgConfigsPaginated(params: {
        page: number;
        limit: number;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }): Promise<OrsgConfigResult<PaginatedResponse<OrsgConfig>>> {
        return ORSGConfigService.getOrsgConfigsPaginated(params);
    },

    /**
     * Search ORSG configurations
     */
    async searchOrsgConfigs(query: string, limit?: number): Promise<OrsgConfigResult<OrsgConfig[]>> {
        return ORSGConfigService.searchOrsgConfigs(query, limit);
    },

    /**
     * Get service metrics
     */
    getMetrics(): OrsgConfigMetrics {
        return ORSGConfigService.getMetrics();
    },

    /**
     * Cancel pending requests
     */
    cancelRequests(): void {
        ORSGConfigService.cancelRequests();
    },

    /**
     * Reset service metrics
     */
    resetMetrics(): void {
        ORSGConfigService.resetMetrics();
    }
};