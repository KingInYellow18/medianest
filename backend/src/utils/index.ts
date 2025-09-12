// Utility exports for easy importing

// Error handling utilities
export {
  handleAsync,
  handleAsyncWithThrow,
  safeTry,
  safeAsyncTry,
  handleCacheError,
  handleDatabaseError,
  logErrorWithContext,
  createErrorResponse,
} from './error-handler';

// Validation utilities
export {
  isNullOrUndefined,
  isNotNullOrUndefined,
  isEmpty,
  isNotEmpty,
  isEmptyArray,
  isNotEmptyArray,
  isEmptyObject,
  isNotEmptyObject,
  validateRequiredFields,
  requireFields,
  assertNotNull,
  assertNotEmpty,
  assertNotEmptyArray,
  safeGet,
  isValidEmail,
  isValidUrl,
  isPositiveNumber,
  isNonNegativeNumber,
  createValidationError,
  sanitizeInput,
  deepValidate,
} from './validation.utils';

// Response utilities
export {
  sendSuccess,
  sendError,
  sendPaginated,
  sendCreated,
  sendNoContent,
  sendNotFound,
  sendValidationError,
  sendUnauthorized,
  sendForbidden,
  sendConflict,
  sendRateLimit,
  sendInternalError,
  sendServiceUnavailable,
  asyncHandler,
  createResponseTransformer,
  CacheControl,
  CORS,
} from './response.utils';
export type { ApiResponse, PaginationMeta } from '@medianest/shared';

// Async utilities
export {
  retryAsync,
  sleep,
  withTimeout,
  processBatch,
  processBatchWithErrors,
  debounceAsync,
  throttleAsync,
  createCircuitBreaker,
  createSemaphore,
  withSemaphore,
  promisify,
} from './async.utils';

// Transform utilities
export {
  camelToSnakeCase,
  snakeToCamelCase,
  deepTransformKeys,
  removeNullUndefined,
  deepRemoveNullUndefined,
  pick,
  omit,
  arrayToObject,
  groupBy,
  flattenObject,
  unflattenObject,
  deepMerge,
  StringCase,
  paginateArray,
  multiSort,
  createTransformPipeline,
  safeJsonParse,
  safeJsonStringify,
} from './transform.utils';

// Re-export existing utilities
export { logger } from './logger';
export type { AppError } from './errors';
