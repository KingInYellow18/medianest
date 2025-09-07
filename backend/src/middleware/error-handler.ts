// Re-export error handlers for compatibility
export { errorHandler } from './error';
export { AppError } from '../utils/errors';

// Export error types for imports that expect them from this location
export {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError, // @ts-ignore
} from '@medianest/shared';

// Create a compatibility ApiError class that matches old interface
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: any;

  constructor(message: string, statusCode: number = 500, details: any = {}) {
    super(message);
    this.message = message;
    this.statusCode = statusCode;
    this.code = this.getErrorCode(statusCode);
    this.details = details;

    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    this.name = this.constructor.name;
  }

  private getErrorCode(statusCode: number): string {
    switch (statusCode) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 429:
        return 'RATE_LIMIT_EXCEEDED';
      case 503:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
