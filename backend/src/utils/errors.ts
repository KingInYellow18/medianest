/**
 * Application-specific error class
 * This provides a temporary solution until the shared package exports are properly configured
 */
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

/**
 * Authentication-specific error
 */
export class AuthenticationError extends AppError {
  constructor(message: string, details: any = {}) {
    super('AUTHENTICATION_ERROR', message, 401, details);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super('NOT_FOUND', message, 404);
  }
}

/**
 * Type guard for AppError
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}
