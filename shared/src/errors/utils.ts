/**
 * Error Utility Functions - Shared error handling for frontend and backend
 * 
 * This module provides comprehensive error handling utilities for the MediaNest application:
 * - Error serialization for API responses
 * - Error parsing from API responses
 * - Frontend error logging with context
 * - User-friendly error message mapping
 * - Retry logic determination
 * - Error detail extraction for debugging
 * 
 * @fileoverview Shared error utilities for consistent error handling across the application
 * @version 2.0.0
 * @author MediaNest Team
 * @since 1.0.0
 */

import { AppError } from './types';

/**
 * Serialized Error Interface
 * @interface SerializedError
 * @description Structure for serializing errors in API responses
 */
export interface SerializedError {
  /** Human-readable error message */
  message: string;
  /** Error code for programmatic handling */
  code: string;
  /** HTTP status code associated with the error */
  statusCode?: number;
  /** Additional error details and context */
  details?: any;
  /** Correlation ID for request tracking */
  correlationId?: string;
  /** Retry-after header value in seconds */
  retryAfter?: number;
}

/**
 * Serialize Error for API Response
 * 
 * @function serializeError
 * @description Converts an Error or AppError instance into a serializable format for API responses
 * @param {AppError | Error} error - The error to serialize
 * @returns {SerializedError} Serialized error object safe for JSON transmission
 * 
 * @example
 * // Serialize an AppError
 * const apiError = new AppError('VALIDATION_ERROR', 'Invalid input', 400);
 * const serialized = serializeError(apiError);
 * res.status(400).json({ error: serialized });
 * 
 * @example
 * // Serialize a generic Error
 * const genericError = new Error('Something went wrong');
 * const serialized = serializeError(genericError);
 * // Results in: { message: 'Something went wrong', code: 'UNKNOWN_ERROR', statusCode: 500 }
 * 
 * @security Ensures sensitive error details are properly handled
 * @version 2.0.0
 */
export function serializeError(error: AppError | Error): SerializedError {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    };
  }

  return {
    message: error.message || 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  };
}

/**
 * Parse Error from API Response
 * 
 * @function parseApiError
 * @description Converts an API error response back into an AppError instance
 * @param {any} response - The API response containing error information
 * @returns {AppError} AppError instance reconstructed from the response
 * 
 * @example
 * // Parse an API error response
 * const response = await fetch('/api/endpoint');
 * if (!response.ok) {
 *   const errorData = await response.json();
 *   const error = parseApiError(errorData);
 *   throw error;
 * }
 * 
 * @example
 * // Handle axios error response
 * try {
 *   await axios.get('/api/endpoint');
 * } catch (axiosError) {
 *   const error = parseApiError(axiosError.response?.data);
 *   console.error('API Error:', error.message);
 * }
 * 
 * @version 2.0.0
 */
export function parseApiError(response: any): AppError {
  if (response?.error) {
    const { message, code, statusCode, details } = response.error;
    return new AppError(
      code || 'API_ERROR',
      message || 'An error occurred',
      statusCode || 500,
      details,
    );
  }

  return new AppError('UNKNOWN_ERROR', 'An unknown error occurred', 500);
}

/**
 * Error Log Entry Interface
 * @interface ErrorLogEntry
 * @description Structure for logging errors with context information
 */
export interface ErrorLogEntry {
  /** The error instance to log */
  error: Error | AppError;
  /** Additional context information */
  context?: any;
  /** User agent string from browser */
  userAgent?: string;
  /** Current URL where error occurred */
  url?: string;
  /** ISO timestamp when error was logged */
  timestamp: string;
}

/**
 * Log Error with Context
 * 
 * @function logError
 * @description Logs an error with contextual information for debugging and monitoring
 * @param {Error | AppError} error - The error to log
 * @param {any} [context] - Additional context information
 * @returns {ErrorLogEntry} Complete error log entry with metadata
 * 
 * @example
 * // Log an error with context
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   logError(error, {
 *     operation: 'riskyOperation',
 *     userId: user.id,
 *     attempt: 3
 *   });
 * }
 * 
 * @example
 * // Frontend error logging
 * window.addEventListener('error', (event) => {
 *   logError(event.error, {
 *     filename: event.filename,
 *     lineno: event.lineno,
 *     colno: event.colno
 *   });
 * });
 * 
 * @todo Integrate with Sentry, LogRocket, or other error tracking services
 * @security Automatically captures browser metadata for security analysis
 * @version 2.0.0
 */
export function logError(error: Error | AppError, context?: any): ErrorLogEntry {
  const entry: ErrorLogEntry = {
    error,
    context,
    timestamp: new Date().toISOString(),
  };

  // Browser environment check - safely handle window object
  if (
    typeof globalThis !== 'undefined' &&
    'window' in globalThis &&
    typeof (globalThis as { window?: unknown }).window !== 'undefined'
  ) {
    const win = (
      globalThis as unknown as {
        window: { location?: { href?: string }; navigator?: { userAgent?: string } };
      }
    ).window;
    entry.userAgent = win?.navigator?.userAgent;
    entry.url = win?.location?.href;
  }

  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    /**
     * @todo Integrate with error tracking service
     * @description Send error to Sentry, LogRocket, Bugsnag, or similar service
     * @priority High
     * @category Production
     */
    // TODO: Send to Sentry, LogRocket, etc.
    console.error('[Error]', entry);
  } else {
    console.error('[Error]', error, context);
  }

  return entry;
}

/**
 * User-Friendly Error Messages
 * @const {Record<string, string>} USER_FRIENDLY_MESSAGES
 * @description Mapping of error codes to user-friendly messages
 * 
 * Categories:
 * - Network errors: Connection and timeout issues
 * - Authentication errors: Login and permission issues
 * - Validation errors: Input validation failures
 * - Rate limiting: Request throttling messages
 * - Service errors: Service availability issues
 * - Generic errors: Fallback messages
 * 
 * @example
 * // Get user-friendly message for error code
 * const message = USER_FRIENDLY_MESSAGES['AUTHENTICATION_ERROR'];
 * // Result: 'Please sign in to continue.'
 * 
 * @version 2.0.0
 */
export const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  /** Network and connectivity errors */
  // Network errors
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  TIMEOUT_ERROR: 'The request took too long. Please try again.',

  /** Authentication and authorization errors */
  // Auth errors
  AUTHENTICATION_ERROR: 'Please sign in to continue.',
  AUTHORIZATION_ERROR: "You don't have permission to do that.",
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',

  /** Input validation and data errors */
  // Validation
  VALIDATION_ERROR: 'Please check your input and try again.',
  INVALID_INPUT: 'The information provided is invalid.',

  /** Rate limiting and throttling errors */
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',

  /** Service availability and maintenance errors */
  // Service errors
  SERVICE_UNAVAILABLE: 'This service is temporarily unavailable.',
  MAINTENANCE_MODE: "We're performing maintenance. Please try again later.",

  /** Generic fallback error messages */
  // Generic
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
  NOT_FOUND: 'The requested item could not be found.',
  CONFLICT_ERROR: 'This action conflicts with another operation.',
};

/**
 * Get User-Friendly Error Message
 * 
 * @function getUserFriendlyMessage
 * @description Converts technical error messages into user-friendly text
 * @param {Error | AppError} error - The error to get a friendly message for
 * @returns {string} User-friendly error message
 * 
 * @example
 * // Convert AppError to friendly message
 * const error = new AppError('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded', 429);
 * const message = getUserFriendlyMessage(error);
 * // Result: 'Too many requests. Please wait a moment and try again.'
 * 
 * @example
 * // Convert generic Error to friendly message
 * const error = new Error('Network timeout occurred');
 * const message = getUserFriendlyMessage(error);
 * // Result: 'The request took too long. Please try again.'
 * 
 * @fallback Returns generic error message if no specific mapping exists
 * @version 2.0.0
 */
export function getUserFriendlyMessage(error: Error | AppError): string {
  if (error instanceof AppError) {
    return USER_FRIENDLY_MESSAGES[error.code] ?? error.message;
  }

  // Check for common error patterns
  const message = error.message.toLowerCase();
  if (message.includes('network') || message.includes('fetch')) {
    return USER_FRIENDLY_MESSAGES.NETWORK_ERROR ?? 'Network error occurred';
  }
  if (message.includes('timeout')) {
    return USER_FRIENDLY_MESSAGES.TIMEOUT_ERROR ?? 'Request timeout occurred';
  }

  return USER_FRIENDLY_MESSAGES.UNKNOWN_ERROR ?? 'An unexpected error occurred';
}

/**
 * Check if Error is Retryable
 * 
 * @function isRetryableError
 * @description Determines if an error represents a transient condition that may succeed on retry
 * @param {Error | AppError} error - The error to analyze
 * @returns {boolean} True if the error is likely to succeed on retry
 * 
 * @example
 * // Check if API error is retryable
 * try {
 *   await apiCall();
 * } catch (error) {
 *   if (isRetryableError(error)) {
 *     // Implement retry logic
 *     await new Promise(resolve => setTimeout(resolve, 1000));
 *     return apiCall(); // Retry once
 *   }
 *   throw error; // Don't retry
 * }
 * 
 * @example
 * // Exponential backoff with retry check
 * async function callWithRetry(fn, maxRetries = 3) {
 *   for (let attempt = 1; attempt <= maxRetries; attempt++) {
 *     try {
 *       return await fn();
 *     } catch (error) {
 *       if (!isRetryableError(error) || attempt === maxRetries) {
 *         throw error;
 *       }
 *       await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
 *     }
 *   }
 * }
 * 
 * @criteria
 * - HTTP status codes: 408, 429, 500, 502, 503, 504
 * - Network errors: Connection timeouts, DNS failures
 * - Temporary service unavailability
 * 
 * @version 2.0.0
 */
export function isRetryableError(error: Error | AppError): boolean {
  if (error instanceof AppError) {
    // Retryable status codes
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(error.statusCode);
  }

  // Check for network errors
  const message = error.message.toLowerCase();
  return message.includes('network') || message.includes('timeout');
}

/**
 * Extract Error Details for Debugging
 * 
 * @function extractErrorDetails
 * @description Extracts comprehensive error information for debugging and logging
 * @param {Error | AppError} error - The error to extract details from
 * @returns {Record<string, any>} Detailed error information object
 * 
 * @example
 * // Extract details from an AppError
 * const error = new AppError('VALIDATION_ERROR', 'Invalid input', 400, { field: 'email' });
 * const details = extractErrorDetails(error);
 * console.log(details);
 * // {
 * //   message: 'Invalid input',
 * //   name: 'AppError',
 * //   code: 'VALIDATION_ERROR',
 * //   statusCode: 400,
 * //   details: { field: 'email' },
 * //   stack: '...'
 * // }
 * 
 * @example
 * // Extract details with error cause chain
 * const cause = new Error('Database connection failed');
 * const error = new AppError('SERVICE_UNAVAILABLE', 'Service unavailable', 503, null, { cause });
 * const details = extractErrorDetails(error);
 * // Includes nested cause details
 * 
 * @features
 * - Extracts standard Error properties (message, name, stack)
 * - Includes AppError-specific properties (code, statusCode, details)
 * - Recursively extracts error cause chain
 * - Safe for JSON serialization
 * 
 * @version 2.0.0
 */
export function extractErrorDetails(error: Error | AppError): Record<string, any> {
  const details: Record<string, any> = {
    message: error.message,
    name: error.name,
    stack: error.stack,
  };

  if (error instanceof AppError) {
    details.code = error.code;
    details.statusCode = error.statusCode;
    details.details = error.details;
  }

  // Add cause if available (Error.cause)
  if ('cause' in error && error.cause) {
    details.cause = extractErrorDetails(error.cause as Error);
  }

  return details;
}
