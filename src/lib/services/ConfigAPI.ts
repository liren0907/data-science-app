import { invoke } from '@tauri-apps/api/core';
import type {
    ConfigTable,
    BaseConfig,
    ConfigRecipe,
    GetConfigParams,
    SaveConfigParams,
    UpdateConfigParams,
    DeleteConfigParams,
    SearchConfigParams,
    PaginationParams,
    ApiResponse,
    PaginatedResponse,
    SearchResponse,
    CacheConfig,
    CacheEntry,
    ConfigEvent,
    ConfigEventType
} from '../../types/tauri.d';

/**
 * Generic Configuration API Wrapper
 * Provides a unified interface for all configuration CRUD operations
 */
export class ConfigAPI<T extends BaseConfig = BaseConfig> {
    private cache: Map<string, CacheEntry> = new Map();
    private cacheConfig: CacheConfig;
    private eventListeners: Map<string, ((event: ConfigEvent) => void)[]> = new Map();

    constructor(cacheConfig: CacheConfig = { enabled: true, ttl: 300000, maxSize: 100 }) {
        this.cacheConfig = cacheConfig;
    }

    /**
     * Generate cache key for a request
     */
    private generateCacheKey(operation: string, params: any): string {
        return `${operation}_${JSON.stringify(params)}`;
    }

    /**
     * Get cached data if available and not expired
     */
    private getCached<T>(key: string): T | null {
        if (!this.cacheConfig.enabled) return null;

        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    /**
     * Set cached data
     */
    private setCached<T>(key: string, data: T): void {
        if (!this.cacheConfig.enabled) return;

        // Implement LRU eviction if cache is full
        if (this.cache.size >= this.cacheConfig.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: this.cacheConfig.ttl
        });
    }

    /**
     * Emit configuration event
     */
    private emitEvent(type: ConfigEventType, table: ConfigTable, data?: any, error?: any): void {
        const event: ConfigEvent = {
            type,
            table,
            data,
            error,
            timestamp: Date.now()
        };

        const listeners = this.eventListeners.get(table) || [];
        listeners.forEach(listener => listener(event));
    }

    /**
     * Add event listener
     */
    public on(table: ConfigTable, listener: (event: ConfigEvent) => void): () => void {
        if (!this.eventListeners.has(table)) {
            this.eventListeners.set(table, []);
        }
        this.eventListeners.get(table)!.push(listener);

        // Return unsubscribe function
        return () => {
            const listeners = this.eventListeners.get(table) || [];
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    }

    /**
     * Get configuration by ID or name
     */
    public async get(params: GetConfigParams): Promise<ApiResponse<T>> {
        const cacheKey = this.generateCacheKey('get', params);
        const cached = this.getCached<ApiResponse<T>>(cacheKey);

        if (cached) {
            return cached;
        }

        try {
            const result = await invoke<ApiResponse>('get_config', params) as ApiResponse<T>;
            this.setCached(cacheKey, result);
            return result;
        } catch (error) {
            const apiError = { success: false, error: String(error) };
            this.emitEvent('error', params.table, undefined, apiError);
            return apiError;
        }
    }

    /**
     * Save configuration
     */
    public async save(params: SaveConfigParams): Promise<ApiResponse<{id: number}>> {
        try {
            let result: any;

            // Use specific command for stream_configs (more stable)
            if (params.table === 'stream_configs') {
                result = await invoke<number>('save_stream_config', {
                    config_name: params.name,
                    config_content: params.content
                });

                // Convert to expected format
                result = {
                    success: true,
                    id: result
                };
            } else {
                // Use generic command for other tables
                result = await invoke<ApiResponse<{id: number}>>('save_config', params);
            }

            if (result.success) {
                // Clear related cache entries
                this.clearTableCache(params.table);
                this.emitEvent('created', params.table, result.data || { id: result.id });
            }
            return result;
        } catch (error) {
            const apiError = { success: false, error: String(error) };
            this.emitEvent('error', params.table, undefined, apiError);
            return apiError;
        }
    }

    /**
     * Update configuration field
     */
    public async update(params: UpdateConfigParams): Promise<ApiResponse<boolean>> {
        try {
            const result = await invoke<ApiResponse<boolean>>('update_config', params);
            if (result.success) {
                // Clear related cache entries
                this.clearTableCache(params.table);
                this.emitEvent('updated', params.table, { id: params.id, field: params.field, value: params.value });
            }
            return result;
        } catch (error) {
            const apiError = { success: false, error: String(error) };
            this.emitEvent('error', params.table, undefined, apiError);
            return apiError;
        }
    }

    /**
     * Delete configuration
     */
    public async delete(params: DeleteConfigParams): Promise<ApiResponse<boolean>> {
        try {
            const result = await invoke<ApiResponse<boolean>>('delete_config', params);
            if (result.success) {
                // Clear related cache entries
                this.clearTableCache(params.table);
                this.emitEvent('deleted', params.table, params);
            }
            return result;
        } catch (error) {
            const apiError = { success: false, error: String(error) };
            this.emitEvent('error', params.table, undefined, apiError);
            return apiError;
        }
    }

    /**
     * Search configurations
     */
    public async search(params: SearchConfigParams): Promise<SearchResponse<T>> {
        const cacheKey = this.generateCacheKey('search', params);
        const cached = this.getCached<SearchResponse<T>>(cacheKey);

        if (cached) {
            return cached;
        }

        try {
            const result = await invoke<SearchResponse>('search_configs', params) as SearchResponse<T>;
            this.setCached(cacheKey, result);
            return result;
        } catch (error) {
            const errorMsg = String(error);
            this.emitEvent('error', params.table, undefined, { success: false, error: errorMsg });
            return { success: false, count: 0, results: [], error: errorMsg } as any;
        }
    }

    /**
     * Get all configurations from a table
     */
    public async getAll(table: ConfigTable): Promise<ApiResponse<T[]>> {
        const cacheKey = this.generateCacheKey('getAll', { table });
        const cached = this.getCached<ApiResponse<T[]>>(cacheKey);

        if (cached) {
            return cached;
        }

        try {
            const result = await invoke<ApiResponse>('get_all_configs', { table }) as ApiResponse<T[]>;
            this.setCached(cacheKey, result);
            return result;
        } catch (error) {
            const apiError = { success: false, error: String(error), data: [] };
            this.emitEvent('error', table, undefined, apiError);
            return apiError;
        }
    }

    /**
     * Get configurations with pagination
     */
    public async getPaginated(params: PaginationParams): Promise<PaginatedResponse<T>> {
        const cacheKey = this.generateCacheKey('getPaginated', params);
        const cached = this.getCached<PaginatedResponse<T>>(cacheKey);

        if (cached) {
            return cached;
        }

        try {
            const result = await invoke<PaginatedResponse>('get_configs_paginated', params) as PaginatedResponse<T>;
            this.setCached(cacheKey, result);
            return result;
        } catch (error) {
            const errorMsg = String(error);
            this.emitEvent('error', params.table, undefined, { success: false, error: errorMsg });
            return {
                success: false,
                data: [],
                pagination: {
                    page: params.page,
                    limit: params.limit,
                    total: 0,
                    total_pages: 0,
                    has_next: false,
                    has_prev: false
                },
                error: errorMsg
            };
        }
    }

    /**
     * Clear cache for a specific table
     */
    public clearTableCache(table: ConfigTable): void {
        const keysToDelete: string[] = [];
        for (const [key] of this.cache) {
            if (key.includes(`"${table}"`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
    }

    /**
     * Clear all cache
     */
    public clearAllCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    public getCacheStats(): { size: number; maxSize: number; enabled: boolean } {
        return {
            size: this.cache.size,
            maxSize: this.cacheConfig.maxSize,
            enabled: this.cacheConfig.enabled
        };
    }

    /**
     * Update cache configuration
     */
    public updateCacheConfig(config: Partial<CacheConfig>): void {
        this.cacheConfig = { ...this.cacheConfig, ...config };
        if (!config.enabled) {
            this.clearAllCache();
        }
    }
}

// ===== SPECIALIZED API CLASSES =====

/**
 * Stream Configuration API
 */
export class StreamConfigAPI extends ConfigAPI<import('../../types/tauri').StreamConfig> {
    constructor(cacheConfig?: CacheConfig) {
        super(cacheConfig);
    }

    /**
     * Get stream config by name (convenience method)
     */
    async getByName(name: string): Promise<ApiResponse<import('../../types/tauri').StreamConfig>> {
        return this.get({ table: 'stream_configs', name });
    }

    /**
     * Save stream config (convenience method)
     */
    async saveConfig(name: string, content: string): Promise<ApiResponse<{id: number}>> {
        return this.save({ table: 'stream_configs', name, content });
    }
}

/**
 * OGG Configuration API
 */
export class OggConfigAPI extends ConfigAPI<import('../../types/tauri').OggConfig> {
    constructor(cacheConfig?: CacheConfig) {
        super(cacheConfig);
    }

    async getByName(name: string): Promise<ApiResponse<import('../../types/tauri').OggConfig>> {
        return this.get({ table: 'ogg_configs', name });
    }

    async saveConfig(name: string, content: string): Promise<ApiResponse<{id: number}>> {
        return this.save({ table: 'ogg_configs', name, content });
    }
}

/**
 * Config Recipe API
 */
export class ConfigRecipeAPI extends ConfigAPI<ConfigRecipe> {
    constructor(cacheConfig?: CacheConfig) {
        super(cacheConfig);
    }

    async getByName(name: string): Promise<ApiResponse<ConfigRecipe>> {
        return this.get({ table: 'config_recipes', name });
    }

    async saveRecipe(name: string, recipeData: Omit<ConfigRecipe, 'id' | 'recipe_name' | 'created_at'>): Promise<ApiResponse<{id: number}>> {
        const content = JSON.stringify(recipeData);
        return this.save({ table: 'config_recipes', name, content });
    }
}

// ===== SINGLETON INSTANCES =====

export const streamConfigAPI = new StreamConfigAPI();
export const oggConfigAPI = new OggConfigAPI();
export const orgConfigAPI = new ConfigAPI<import('../../types/tauri').OrgConfig>();
export const orsgConfigAPI = new ConfigAPI<import('../../types/tauri').OrsgConfig>();
export const eventConfigAPI = new ConfigAPI<import('../../types/tauri').EventConfig>();
export const configRecipeAPI = new ConfigRecipeAPI();

// ===== UTILITY FUNCTIONS =====

/**
 * Batch operations helper
 */
export async function batchOperations<T>(
    operations: (() => Promise<ApiResponse<T>>)[]
): Promise<ApiResponse<T>[]> {
    const results: ApiResponse<T>[] = [];

    for (const operation of operations) {
        try {
            const result = await operation();
            results.push(result);
        } catch (error) {
            results.push({ success: false, error: String(error) });
        }
    }

    return results;
}

/**
 * Debounced API calls
 */
export function debounce<T extends any[], R>(
    func: (...args: T) => Promise<R>,
    wait: number
): (...args: T) => Promise<R> {
    let timeout: NodeJS.Timeout;

    return (...args: T): Promise<R> => {
        return new Promise((resolve, reject) => {
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                try {
                    const result = await func(...args);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }, wait);
        });
    };
}
