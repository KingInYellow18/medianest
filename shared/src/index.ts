// @medianest/shared - Shared types and utilities for MediaNest

// Export shared utilities first (no conflicts)
export * from './utils';

// Handle generateId conflict by explicitly re-exporting
export { generateId as utilsGenerateId } from './utils';

// Export shared constants (no conflicts)
export * from './constants';

// Export configuration management (no conflicts)
export * from './config';

// Export validation utilities (no conflicts)
export * from './validation';

// Export error classes from errors module (these are the main implementations)
export * from './errors';

// Export types last, with explicit re-exports to resolve conflicts
export type {
  User,
  ApiResponse, // Now uses consolidated Context7 definition
  LegacyApiResponse, // For backward compatibility
  ApiError,
  // Re-export specific types from types module to avoid conflicts
  ServiceStatus,
  ServiceStatusUpdate,
  ServiceName,
  ServiceConfiguration,
  ServiceDetails,
  UptimeMetrics,
  RequestStatus,
  SeasonRequest,
  MediaRequest,
  RequestSubmission,
  RequestStatusUpdate,
  RequestFilters,
  RequestHistoryOptions,
  RequestHistoryResponse,
  MediaType,
} from './types';

// Export Context7 types with explicit naming to avoid conflicts
// Note: ApiResponse is already exported above as the canonical version
export type {
  Result,
  PaginatedApiResponse,
  PaginationMeta,
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
} from './types/context7-shared';

// Export functions (not types) from Context7
export {
  success,
  failure,
  createUserId,
  createEntityId,
  createRequestId,
  createSessionId,
} from './types/context7-shared';

// Export test utilities conditionally (available but not built by default)
// TODO: Fix test-utils type issues and re-enable
// export * from './test-utils';
