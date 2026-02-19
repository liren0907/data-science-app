// Global type declarations for Tauri API
declare module '@tauri-apps/api/core' {
    export function invoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T>;
}

declare module '@tauri-apps/api' {
    export * from '@tauri-apps/api/core';
}

// ===== GENERIC CRUD TYPES =====

export interface BaseConfig {
    id?: number;
    config_name: string;
    config_content: string;
    created_at?: string;
}

export interface StreamConfig extends BaseConfig {}
export interface OggConfig extends BaseConfig {}
export interface OrgConfig extends BaseConfig {}
export interface OrsgConfig extends BaseConfig {}
export interface EventConfig extends BaseConfig {}

export interface ConfigRecipe {
    id?: number;
    recipe_name: string;
    stream_config_id?: number;
    ogg_config_id?: number;
    org_config_id?: number;
    orsg_config_id?: number;
    event_config_id?: number;
    created_at?: string;
}

export type AnyConfig = StreamConfig | OggConfig | OrgConfig | OrsgConfig | EventConfig | ConfigRecipe;

export type ConfigTable = 'stream_configs' | 'ogg_configs' | 'org_configs' | 'orsg_configs' | 'event_configs' | 'config_recipes';

export type ConfigOperation = 'get' | 'save' | 'update' | 'delete' | 'search' | 'get_all' | 'get_paginated';

// API Request/Response Types
export interface GetConfigParams {
    table: ConfigTable;
    id?: number;
    name?: string;
}

export interface SaveConfigParams {
    table: ConfigTable;
    name: string;
    content: string;
}

export interface UpdateConfigParams {
    table: ConfigTable;
    id: number;
    field: string;
    value: string;
}

export interface DeleteConfigParams {
    table: ConfigTable;
    id?: number;
    name?: string;
}

export interface SearchConfigParams {
    table: ConfigTable;
    query: string;
    limit?: number;
}

export interface PaginationParams {
    table: ConfigTable;
    page: number;
    limit: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export interface PaginatedResponse<T = any> {
    success: boolean;
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
    };
}

export interface SearchResponse<T = any> {
    success: boolean;
    count: number;
    results: T[];
}

export type ApiError = {
    code: string;
    message: string;
    details?: any;
};

// Cache types
export interface CacheEntry<T = any> {
    data: T;
    timestamp: number;
    ttl: number;
}

export interface CacheConfig {
    enabled: boolean;
    ttl: number; // Time to live in milliseconds
    maxSize: number;
}

// Event types for real-time updates
export type ConfigEventType = 'created' | 'updated' | 'deleted' | 'error';

export interface ConfigEvent<T = any> {
    type: ConfigEventType;
    table: ConfigTable;
    data?: T;
    error?: ApiError;
    timestamp: number;
}

// Augment Window for Tauri detection in Svelte pages
declare global {
    interface Window {
        __TAURI__?: any;
    }
}
export {};
