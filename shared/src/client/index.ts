/**
 * Client-safe exports for browser environments
 *
 * This module exports types and utilities that are safe to use in browsers
 */

// Re-export core types from context7-shared
export * from '../types/context7-shared';

// Re-export shared types
export * from '../types';

// Re-export constants
export * from '../constants';

// Re-export validation
export * from '../validation';

// Export from request types
export {
  RequestStatus,
  type SeasonRequest,
  type MediaRequest,
  type RequestSubmission,
  type RequestStatusUpdate,
  type RequestFilters,
  type RequestHistoryOptions,
  type RequestHistoryResponse,
  type MediaType,
} from '../types/request';

// Export from service types
export type {
  ServiceStatus,
  ServiceStatusUpdate,
  ServiceName,
  ServiceConfiguration,
  ServiceDetails,
  UptimeMetrics,
} from '../types/service';

// Export from context7-shared
export type {
  MediaRequestStatus,
  RequestPriority,
  BaseMediaItem,
  UserRole,
  BaseUser,
  UserPreferences,
  ApiResponse,
  PaginatedApiResponse,
} from '../types/context7-shared';

// Export constants
export { RATE_LIMITS, API_ENDPOINTS, SERVICES, SOCKET_EVENTS, ERROR_CODES } from '../constants';
