// Shared error classes

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: any;

  constructor(code: string, message: string, statusCode: number = 500, details: any = {}) {
    super(message);
    this.code = code;
    this.message = message;
    this.statusCode = statusCode;
    this.details = details;

    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Set the name property for better error identification
    this.name = this.constructor.name;
  }
}

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

// Type guard for AppError
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
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
