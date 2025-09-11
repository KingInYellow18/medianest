/**
 * Shared utility functions for MediaNest
 *
 * This module provides a centralized export for all utility functions,
 * organized by category for better tree-shaking and maintainability.
 */

// Core utilities
export * from './type-guards';
// Export safe-parsing but exclude conflicting safeJsonParse (use the one from type-guards)
export {
  safeParseInt,
  safeParsePort,
  safeJsonParseSimple,
  safeParseBoolean,
  safeGetEnv,
  requireEnv,
  safeParseFloat,
  safeParseArray,
  safeParseUrl,
  safeParseDatabaseTimeout,
  safeParsePoolSize,
} from './safe-parsing';
export * from './validation';

// String and data utilities
export * from './format';
export * from './generators';
export * from './date-utils';

// Crypto utilities (browser-safe by default)
export * from './crypto-client';
export * from './crypto-utils';

// Performance and monitoring
export * from './performance-monitor';
export * from './response-patterns';
export * from './error-standardization';
export * from './null-safety-enforcement';

// Database utilities
export * from './database-optimizations';

// Logger (simple re-export)
export { logger } from './logger';

// Commonly used functions - explicit re-exports for better IDE support
export {
  generateCorrelationId,
  generateSimpleId,
  generateSessionId,
  generateRequestId,
} from './generators';
export { isNonNullable, isString, isNumber, isBoolean, isDefined } from './type-guards';
export { formatDate, formatDateTime, formatBytes, formatPercentage } from './format';
export { isValidEmail, isValidUrl, isValidUuid, sanitizeString } from './validation';
export { generateToken, generateId as generateCryptoId, simpleHash } from './crypto-client';

// Note: Server-side crypto functions from './crypto' are available but not re-exported
// to avoid Node.js dependencies in browser environments. Import directly when needed.
