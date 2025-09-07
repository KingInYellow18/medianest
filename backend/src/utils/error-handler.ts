import { logger } from './logger';

/**
 * Handle async operations with automatic error logging and return tuple
 * @param fn - Async function to execute
 * @param errorMessage - Custom error message for logging
 * @returns Promise<[result | null, error | null]>
 */
export async function handleAsync<T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<[T | null, Error | null]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    logger.error(errorMessage || 'Operation failed', error);
    return [null, error as Error];
  }
}

/**
 * Handle async operations with automatic error logging and throw on error
 * @param fn - Async function to execute
 * @param errorMessage - Custom error message for logging
 * @returns Promise<T>
 * @throws Error if operation fails
 */
export async function handleAsyncWithThrow<T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.error(errorMessage || 'Operation failed', error);
    throw error;
  }
}

/**
 * Safe wrapper for operations that might throw
 * @param fn - Function to execute safely
 * @param defaultValue - Default value to return on error
 * @param errorMessage - Custom error message for logging
 * @returns Result or default value
 */
export function safeTry<T>(fn: () => T, defaultValue: T, errorMessage?: string): T {
  try {
    return fn();
  } catch (error) {
    if (errorMessage) {
      logger.error(errorMessage, error);
    }
    return defaultValue;
  }
}

/**
 * Safe async wrapper for operations that might throw
 * @param fn - Async function to execute safely
 * @param defaultValue - Default value to return on error
 * @param errorMessage - Custom error message for logging
 * @returns Promise<Result or default value>
 */
export async function safeAsyncTry<T>(
  fn: () => Promise<T>,
  defaultValue: T,
  errorMessage?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (errorMessage) {
      logger.error(errorMessage, error);
    }
    return defaultValue;
  }
}

/**
 * Error handler for cache operations
 * @param operation - Operation name
 * @param key - Cache key involved
 * @param error - Error that occurred
 * @param defaultValue - Default value to return
 */
export function handleCacheError<T>(
  operation: string,
  key: string | string[],
  error: any,
  defaultValue: T
): T {
  logger.error(`Cache ${operation} error`, { key, error });
  return defaultValue;
}

/**
 * Error handler for database operations
 * @param operation - Operation name
 * @param context - Additional context data
 * @param error - Error that occurred
 * @throws Processed error
 */
export function handleDatabaseError(
  operation: string,
  context: Record<string, any>,
  error: any
): never {
  logger.error(`Database ${operation} error`, { ...context, error });

  // Handle Prisma-specific errors
  if (error.code === 'P2002') {
    throw new Error('Duplicate entry');
  }
  if (error.code === 'P2025') {
    throw new Error('Record not found');
  }
  if (error.code === 'P2003') {
    throw new Error('Foreign key constraint failed');
  }
  if (error.code === 'P2016') {
    throw new Error('Query interpretation error');
  }

  // Re-throw unknown errors
  throw error;
}

/**
 * Generic error handler with context logging
 * @param error - Error to handle
 * @param context - Additional context data
 * @param customMessage - Custom error message
 */
export function logErrorWithContext(
  error: any,
  context: Record<string, any>,
  customMessage?: string
): void {
  const message = customMessage || 'Error occurred';
  logger.error(message, {
    ...context,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
  });
}

/**
 * Create a consistent error response object
 * @param message - Error message
 * @param code - Error code
 * @param statusCode - HTTP status code
 * @param details - Additional error details
 */
export function createErrorResponse(
  message: string,
  code?: string,
  statusCode?: number,
  details?: Record<string, any>
) {
  return {
    error: {
      message,
      code: code || 'INTERNAL_ERROR',
      statusCode: statusCode || 500,
      timestamp: new Date().toISOString(),
      ...details,
    },
  };
}
