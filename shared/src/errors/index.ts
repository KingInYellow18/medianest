// Shared error classes

// Import core types from separate module to avoid circular dependencies
import { AppError, isAppError } from './types';

export { AppError, isAppError };

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource?: string) {
    const message = resource ? `${resource} not found` : 'Resource not found';
    super('NOT_FOUND', message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message?: string, retryAfter?: number) {
    super(
      'RATE_LIMIT_EXCEEDED',
      message || 'Too many requests',
      429,
      retryAfter ? { retryAfter } : {},
    );
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service?: string) {
    const message = service
      ? `${service} is temporarily unavailable`
      : 'Service temporarily unavailable';
    super('SERVICE_UNAVAILABLE', message, 503);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: any) {
    super('BAD_REQUEST', message, 400, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'An internal server error occurred', details?: any) {
    super('INTERNAL_ERROR', message, 500, details);
  }
}

// Convert any error to AppError
export function toAppError(error: any): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalServerError(error.message);
  }

  return new InternalServerError('An unknown error occurred');
}

// Convert error to error response format
export function toErrorResponse(error: any) {
  if (isAppError(error)) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details || {},
      },
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        details: {},
      },
    };
  }

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: {},
    },
  };
}

// Export utilities
export * from './utils';
