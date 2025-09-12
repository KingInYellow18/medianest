// Common types used across frontend and backend

// Re-export all types from specific modules
export * from './service';

// Export Context7 types with proper naming for consolidation
// ApiResponse is now the canonical version from Context7 (readonly properties)
export type {
  Result,
  ApiResponse, // This is now the primary ApiResponse interface
  PaginatedApiResponse,
  BaseUser,
  UserRole,
  UserPreferences,
  BaseMediaItem,
  MediaRequest as Context7MediaRequest,
  MediaRequestStatus,
  RequestPriority,
  ServiceConfig,
  DatabaseConfig,
  DomainEvent,
  EventHandler,
  LogLevel,
  LogEntry,
  PerformanceMetric,
  HealthCheck,
  CacheEntry,
  CacheMetrics,
  QueueJob,
  QueueStats,
  ValidationRule,
  ValidationResult,
  Environment,
} from './context7-shared';

// Functions are now exported from main index.ts to avoid conflicts

// Export request types with original names for compatibility
export * from './request';

export interface User {
  id: string;
  plexId?: string;
  plexUsername?: string | null;
  email: string;
  name?: string | null;
  role: string;
  status: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

// Legacy API Response interface for backward compatibility with existing response builders
// This maintains the old structure while we transition to Context7 ApiResponse
export interface LegacyApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
  meta?: {
    timestamp?: Date | string;
    count?: number;
    page?: number;
    totalPages?: number;
    totalCount?: number;
    currentPage?: number;
    version?: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}
