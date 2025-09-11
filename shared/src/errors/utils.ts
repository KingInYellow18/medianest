// Error utility functions for frontend and backend

import { AppError } from './types';

// Error serialization for API responses
export interface SerializedError {
  message: string;
  code: string;
  statusCode?: number;
  details?: any;
  correlationId?: string;
  retryAfter?: number;
}

// Serialize error for API response
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

// Parse error from API response
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

// Error logger for frontend
export interface ErrorLogEntry {
  error: Error | AppError;
  context?: any;
  userAgent?: string;
  url?: string;
  timestamp: string;
}

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
    // TODO: Send to Sentry, LogRocket, etc.
    console.error('[Error]', entry);
  } else {
    console.error('[Error]', error, context);
  }

  return entry;
}

// User-friendly error messages
export const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  // Network errors
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  TIMEOUT_ERROR: 'The request took too long. Please try again.',

  // Auth errors
  AUTHENTICATION_ERROR: 'Please sign in to continue.',
  AUTHORIZATION_ERROR: "You don't have permission to do that.",
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',

  // Validation
  VALIDATION_ERROR: 'Please check your input and try again.',
  INVALID_INPUT: 'The information provided is invalid.',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',

  // Service errors
  SERVICE_UNAVAILABLE: 'This service is temporarily unavailable.',
  MAINTENANCE_MODE: "We're performing maintenance. Please try again later.",

  // Generic
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
  NOT_FOUND: 'The requested item could not be found.',
  CONFLICT_ERROR: 'This action conflicts with another operation.',
};

// Get user-friendly message
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

// Check if error is retryable
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

// Extract error details for debugging
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
