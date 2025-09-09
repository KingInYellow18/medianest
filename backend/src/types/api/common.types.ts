// Common API response and error types
import type { ApiResponse } from '@medianest/shared';

// ApiResponse now imported from shared package

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// HTTP method types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// Request body types for different endpoints
export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface RegisterRequestBody {
  email: string;
  password: string;
  name?: string;
}

export interface UpdateUserRequestBody {
  name?: string;
  email?: string;
  password?: string;
}

// Generic request/response utilities
export type RequestBody<T = Record<string, unknown>> = T;
export type QueryParams = Record<string, string | number | boolean | undefined>;
export type PathParams = Record<string, string | number>;

// API client configuration
export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
}