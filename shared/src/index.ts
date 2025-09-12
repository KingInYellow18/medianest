/**
 * @medianest/shared - Shared Types and Utilities for MediaNest
 *
 * This module provides a comprehensive shared library for the MediaNest application,
 * containing reusable types, utilities, patterns, and configurations that are used
 * across both frontend and backend components.
 *
 * Key Features:
 * - Type-safe shared interfaces and types
 * - Error handling utilities and patterns
 * - Configuration management
 * - Validation utilities
 * - Caching and middleware patterns
 * - Database utilities
 * - Security utilities
 * - Architectural patterns
 *
 * @package @medianest/shared
 * @version 2.0.0
 * @author MediaNest Team
 * @since 1.0.0
 * @license MIT
 */

// @medianest/shared - Shared types and utilities for MediaNest

/**
 * Shared Utilities Export
 * @description Core utility functions used across the application
 */
// Export shared utilities first (no conflicts)
export * from './utils';

/**
 * Conflict Resolution: generateId function
 * @description Explicitly re-export generateId to avoid naming conflicts
 */
// Handle generateId conflict by explicitly re-exporting
export { generateId as utilsGenerateId } from './utils';

/**
 * Shared Constants Export
 * @description Application-wide constants and enumerations
 */
// Export shared constants (no conflicts)
export * from './constants';

/**
 * Configuration Management Export
 * @description Configuration utilities and validation
 */
// Export configuration management (no conflicts)
export * from './config';

/**
 * Validation Utilities Export
 * @description Input validation and schema validation utilities
 */
// Export validation utilities (no conflicts)
export * from './validation';

/**
 * Error Classes Export
 * @description Main error class implementations and utilities
 */
// Export error classes from errors module (these are the main implementations)
export * from './errors';

/**
 * Architectural Patterns Export
 * @description Design patterns and architectural utilities
 */
// Export architectural patterns
export * from './patterns';

/**
 * Middleware Export
 * @description Shared middleware with conflict resolution
 */
// Export middleware (with specific exclusions to avoid conflicts)
export { CachingMiddleware } from './middleware';
export type { CacheConfig as MiddlewareCacheConfig } from './middleware';

/**
 * Database Utilities Export
 * @description Database connection and ORM utilities
 */
// Export database utilities
export * from './database';

/**
 * Caching Utilities Export
 * @description Cache management and optimization utilities
 */
// Export caching utilities
export * from './cache';

/**
 * Security Utilities Export
 * @description Security-related functions and middleware
 */
// Export security utilities
export * from './security';

/**
 * Cache Types Conflict Resolution
 * @description Specific cache type exports to prevent naming conflicts
 */
// Re-export specific cache types to avoid conflicts
export type { PerformanceCacheConfig as CachePerformanceConfig } from './cache';

/**
 * Core Types Export
 * @description Main application types with conflict resolution
 */
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

/**
 * Context7 Types Export
 * @description Advanced types from Context7 integration with explicit naming
 * @note ApiResponse is already exported above as the canonical version
 */
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

/**
 * Context7 Functions Export
 * @description Utility functions from Context7 integration
 */
// Export functions (not types) from Context7
export {
  success,
  failure,
  createUserId,
  createEntityId,
  createRequestId,
  createSessionId,
} from './types/context7-shared';

/**
 * Test Utilities Export (Conditional)
 * @description Test utilities available but not built by default
 * @todo Fix test-utils type issues and re-enable
 * @priority Medium
 * @category Testing
 * @blockedBy Type resolution conflicts in test utilities
 */
// Export test utilities conditionally (available but not built by default)
// TODO: Fix test-utils type issues and re-enable
// export * from './test-utils';
