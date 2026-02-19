import { invoke } from '@tauri-apps/api/core';
import type { OrgConfig, ApiResponse, PaginatedResponse } from '../../types/tauri';

// Error types for ORG configuration operations
export type OrgConfigError =
    | 'NETWORK_ERROR'
    | 'TIMEOUT_ERROR'
    | 'VALIDATION_ERROR'
    | 'TAURI_ERROR'
    | 'PARSE_ERROR'
    | 'UNKNOWN_ERROR';

// Metadata for tracking operation results
export interface OrgConfigMetadata {
    timestamp: number;
    duration: number;
    retries: number;
    command: string;
}

// Result wrapper for service operations
export interface OrgConfigResult<T = any> {
    success: boolean;
    data?: T;
    error?: OrgConfigError;
    message?: string;
    metadata: OrgConfigMetadata;
}

// Metrics interface for monitoring
export interface OrgConfigMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastRequestTime: number;
    uptime: number;
}

/**
 * ORG Configuration Service
 * Handles all ORG config operations with Tauri backend
 */
export class ORGConfigService {
    private static readonly COMMAND_TIMEOUT = 10000; // 10 seconds
    private static readonly MAX_RETRIES = 3;

    // Metrics tracking
    private static metrics: OrgConfigMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastRequestTime: 0,
        uptime: Date.now()
    };

    /**
     * Get all ORG configurations from database
     */
    static async getOrgConfigs(): Promise<OrgConfigResult<OrgConfig[]>> {
        const startTime = Date.now();
        this.metrics.totalRequests++;

        try {
            const result = await invoke('get_org_configs');

            if (result && typeof result === 'object' && 'success' in result) {
                const apiResult = result as ApiResponse<OrgConfig[]>;

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
                            command: 'get_org_configs'
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
                    data: result as OrgConfig[],
                    metadata: {
                        timestamp: Date.now(),
                        duration: Date.now() - startTime,
                        retries: 0,
                        command: 'get_org_configs'
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
                    command: 'get_org_configs'
                }
            };
        }
    }

    /**
     * Get paginated ORG configurations
     */
    static async getOrgConfigsPaginated(params: {
        page: number;
        limit: number;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }): Promise<OrgConfigResult<PaginatedResponse<OrgConfig>>> {
        const startTime = Date.now();
        this.metrics.totalRequests++;

        try {
            const result = await invoke('get_org_configs_paginated', params);

            if (result && typeof result === 'object') {
                this.metrics.successfulRequests++;
                this.updateMetrics(startTime);

                return {
                    success: true,
                    data: result as PaginatedResponse<OrgConfig>,
                    metadata: {
                        timestamp: Date.now(),
                        duration: Date.now() - startTime,
                        retries: 0,
                        command: 'get_org_configs_paginated'
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
                    command: 'get_org_configs_paginated'
                }
            };
        }
    }

    /**
     * Search ORG configurations
     */
    static async searchOrgConfigs(query: string, limit: number = 20): Promise<OrgConfigResult<OrgConfig[]>> {
        const startTime = Date.now();
        this.metrics.totalRequests++;

        try {
            const result = await invoke('search_org_configs', {
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
                    data: data as OrgConfig[],
                    metadata: {
                        timestamp: Date.now(),
                        duration: Date.now() - startTime,
                        retries: 0,
                        command: 'search_org_configs'
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
                    command: 'search_org_configs'
                }
            };
        }
    }

    /**
     * Classify error types for better error handling
     */
    private static classifyError(error: any): OrgConfigError {
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
    static getMetrics(): OrgConfigMetrics {
        return { ...this.metrics };
    }

    /**
     * Cancel all pending requests (placeholder for future implementation)
     */
    static cancelRequests(): void {
        console.log('ORG Config Service: Cancelling pending requests...');
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
export const orgConfigService = {
    /**
     * Get all ORG configurations
     */
    async getOrgConfigs(): Promise<OrgConfigResult<OrgConfig[]>> {
        return ORGConfigService.getOrgConfigs();
    },

    /**
     * Get paginated ORG configurations
     */
    async getOrgConfigsPaginated(params: {
        page: number;
        limit: number;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }): Promise<OrgConfigResult<PaginatedResponse<OrgConfig>>> {
        return ORGConfigService.getOrgConfigsPaginated(params);
    },

    /**
     * Search ORG configurations
     */
    async searchOrgConfigs(query: string, limit?: number): Promise<OrgConfigResult<OrgConfig[]>> {
        return ORGConfigService.searchOrgConfigs(query, limit);
    },

    /**
     * Get service metrics
     */
    getMetrics(): OrgConfigMetrics {
        return ORGConfigService.getMetrics();
    },

    /**
     * Cancel pending requests
     */
    cancelRequests(): void {
        ORGConfigService.cancelRequests();
    },

    /**
     * Reset service metrics
     */
    resetMetrics(): void {
        ORGConfigService.resetMetrics();
    }
};