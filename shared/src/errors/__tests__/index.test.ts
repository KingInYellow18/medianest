import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  BadRequestError,
  InternalServerError,
  isAppError,
  toAppError,
  toErrorResponse,
} from '../index';
import {
  serializeError,
  parseApiError,
  logError,
  getUserFriendlyMessage,
  isRetryableError,
  extractErrorDetails,
  USER_FRIENDLY_MESSAGES,
} from '../utils';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create basic app error', () => {
      const error = new AppError('TEST_ERROR', 'Test error message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({});
    });

    it('should create app error with custom status and details', () => {
      const details = { field: 'email', value: 'invalid' };
      const error = new AppError('CUSTOM_ERROR', 'Custom error', 400, details);

      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual(details);
    });

    it('should have proper stack trace', () => {
      const error = new AppError('TEST', 'Test');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Invalid input');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
    });

    it('should create validation error with details', () => {
      const details = {
        fields: ['email', 'password'],
        errors: ['Email is invalid', 'Password is too short'],
      };
      const error = new ValidationError('Validation failed', details);

      expect(error.details).toEqual(details);
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AuthenticationError('Invalid credentials');

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
    });

    it('should use default message', () => {
      const error = new AuthenticationError();
      expect(error.message).toBe('Authentication required');
    });
  });

  describe('AuthorizationError', () => {
    it('should create authorization error', () => {
      const error = new AuthorizationError('Insufficient permissions');

      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
    });

    it('should use default message', () => {
      const error = new AuthorizationError();
      expect(error.message).toBe('Insufficient permissions');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error', () => {
      const error = new NotFoundError('User not found');

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });

    it('should use default message', () => {
      const error = new NotFoundError();
      expect(error.message).toBe('Resource not found');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new RateLimitError('Too many requests', 60);

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error.details).toEqual({ retryAfter: 60 });
    });

    it('should use default message', () => {
      const error = new RateLimitError(undefined, 30);
      expect(error.message).toBe('Too many requests');
      expect(error.details.retryAfter).toBe(30);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create service unavailable error', () => {
      const error = new ServiceUnavailableError('Database is down');

      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.statusCode).toBe(503);
    });

    it('should use default message', () => {
      const error = new ServiceUnavailableError();
      expect(error.message).toBe('Service temporarily unavailable');
    });
  });

  describe('isAppError', () => {
    it('should identify AppError instances', () => {
      expect(isAppError(new AppError('TEST', 'Test'))).toBe(true);
      expect(isAppError(new ValidationError('Test'))).toBe(true);
      expect(isAppError(new AuthenticationError())).toBe(true);
    });

    it('should reject non-AppError instances', () => {
      expect(isAppError(new Error('Regular error'))).toBe(false);
      expect(isAppError({ code: 'TEST', message: 'Test' })).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError('string')).toBe(false);
    });
  });

  describe('toErrorResponse', () => {
    it('should convert AppError to response', () => {
      const error = new ValidationError('Invalid data', { field: 'email' });
      const response = toErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid data',
          details: { field: 'email' },
        },
      });
    });

    it('should convert regular Error to response', () => {
      const error = new Error('Something went wrong');
      const response = toErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong',
          details: {},
        },
      });
    });

    it('should handle non-error objects', () => {
      const response = toErrorResponse('String error');

      expect(response).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          details: {},
        },
      });
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error', () => {
      const error = new ConflictError('Resource already exists');

      expect(error).toBeInstanceOf(ConflictError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('CONFLICT');
      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('BadRequestError', () => {
    it('should create bad request error', () => {
      const details = { field: 'id', reason: 'invalid format' };
      const error = new BadRequestError('Invalid request format', details);

      expect(error).toBeInstanceOf(BadRequestError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Invalid request format');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual(details);
    });
  });

  describe('InternalServerError', () => {
    it('should create internal server error', () => {
      const error = new InternalServerError('Database connection failed');

      expect(error).toBeInstanceOf(InternalServerError);
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.message).toBe('Database connection failed');
      expect(error.statusCode).toBe(500);
    });

    it('should use default message', () => {
      const error = new InternalServerError();
      expect(error.message).toBe('An internal server error occurred');
    });
  });

  describe('toAppError', () => {
    it('should return AppError unchanged', () => {
      const original = new ValidationError('Test validation error');
      const result = toAppError(original);

      expect(result).toBe(original);
      expect(result).toBeInstanceOf(ValidationError);
    });

    it('should convert Error to InternalServerError', () => {
      const original = new Error('Regular error message');
      const result = toAppError(original);

      expect(result).toBeInstanceOf(InternalServerError);
      expect(result.message).toBe('Regular error message');
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.statusCode).toBe(500);
    });

    it('should convert unknown error to InternalServerError', () => {
      const result = toAppError('string error');

      expect(result).toBeInstanceOf(InternalServerError);
      expect(result.message).toBe('An unknown error occurred');
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.statusCode).toBe(500);
    });
  });

  describe('Constructor Argument Order Tests', () => {
    it('should verify constructor argument order - code first, then message', () => {
      const error = new AppError('TEST_CODE', 'Test message', 418);

      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(418);
    });

    it('should verify error classes use correct constructor order', () => {
      const validation = new ValidationError('Validation failed');
      expect(validation.code).toBe('VALIDATION_ERROR');
      expect(validation.message).toBe('Validation failed');
      expect(validation.statusCode).toBe(400);

      const auth = new AuthenticationError('Invalid token');
      expect(auth.code).toBe('UNAUTHORIZED');
      expect(auth.message).toBe('Invalid token');
      expect(auth.statusCode).toBe(401);

      const notFound = new NotFoundError('User');
      expect(notFound.code).toBe('NOT_FOUND');
      expect(notFound.message).toBe('User not found');
      expect(notFound.statusCode).toBe(404);
    });
  });
});

describe('Error Utilities', () => {
  describe('serializeError', () => {
    it('should serialize AppError correctly', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      const serialized = serializeError(error);

      expect(serialized).toEqual({
        message: 'Invalid input',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: { field: 'email' },
      });
    });

    it('should serialize regular Error correctly', () => {
      const error = new Error('Something went wrong');
      const serialized = serializeError(error);

      expect(serialized).toEqual({
        message: 'Something went wrong',
        code: 'UNKNOWN_ERROR',
        statusCode: 500,
      });
    });

    it('should handle error without message', () => {
      const error = new Error();
      const serialized = serializeError(error);

      expect(serialized.message).toBe('An unknown error occurred');
    });
  });

  describe('parseApiError', () => {
    it('should parse error response correctly', () => {
      const response = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid data',
          statusCode: 400,
          details: { field: 'email' },
        },
      };

      const parsed = parseApiError(response);

      expect(parsed.code).toBe('VALIDATION_ERROR');
      expect(parsed.message).toBe('Invalid data');
      expect(parsed.statusCode).toBe(400);
      expect(parsed.details).toEqual({ field: 'email' });
    });

    it('should handle response with missing fields', () => {
      const response = {
        error: {
          message: 'Some error',
        },
      };

      const parsed = parseApiError(response);

      expect(parsed.code).toBe('API_ERROR');
      expect(parsed.message).toBe('Some error');
      expect(parsed.statusCode).toBe(500);
    });

    it('should handle response without error field', () => {
      const response = { success: false };
      const parsed = parseApiError(response);

      expect(parsed.code).toBe('UNKNOWN_ERROR');
      expect(parsed.message).toBe('An unknown error occurred');
      expect(parsed.statusCode).toBe(500);
    });

    it('should verify constructor argument order in parseApiError', () => {
      const response = {
        error: {
          code: 'TEST_CODE',
          message: 'Test message',
          statusCode: 418,
        },
      };

      const parsed = parseApiError(response);

      expect(parsed.code).toBe('TEST_CODE');
      expect(parsed.message).toBe('Test message');
      expect(parsed.statusCode).toBe(418);
    });
  });

  describe('logError', () => {
    it('should create error log entry', () => {
      const error = new ValidationError('Test error');
      const context = { userId: '123', action: 'create' };

      const entry = logError(error, context);

      expect(entry.error).toBe(error);
      expect(entry.context).toEqual(context);
      expect(entry.timestamp).toBeDefined();
      expect(new Date(entry.timestamp)).toBeInstanceOf(Date);
    });

    it('should handle error without context', () => {
      const error = new Error('Test error');
      const entry = logError(error);

      expect(entry.error).toBe(error);
      expect(entry.context).toBeUndefined();
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return user-friendly message for AppError', () => {
      const error = new AuthenticationError();
      const message = getUserFriendlyMessage(error);

      // Since there's no mapping for 'UNAUTHORIZED', it should fall back to the error message
      expect(message).toBe('Authentication required');
    });

    it('should fall back to error message for unknown code', () => {
      const error = new AppError('UNKNOWN_CODE', 'Custom error message');
      const message = getUserFriendlyMessage(error);

      expect(message).toBe('Custom error message');
    });

    it('should handle network errors', () => {
      const error = new Error('Network request failed');
      const message = getUserFriendlyMessage(error);

      expect(message).toBe(USER_FRIENDLY_MESSAGES.NETWORK_ERROR);
    });

    it('should handle timeout errors', () => {
      const error = new Error('Request timeout exceeded');
      const message = getUserFriendlyMessage(error);

      expect(message).toBe(USER_FRIENDLY_MESSAGES.TIMEOUT_ERROR);
    });

    it('should return generic message for unknown errors', () => {
      const error = new Error('Some random error');
      const message = getUserFriendlyMessage(error);

      expect(message).toBe(USER_FRIENDLY_MESSAGES.UNKNOWN_ERROR);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable AppError status codes', () => {
      expect(isRetryableError(new AppError('TIMEOUT', 'Request timeout', 408))).toBe(true);
      expect(isRetryableError(new RateLimitError())).toBe(true);
      expect(isRetryableError(new AppError('INTERNAL', 'Server error', 500))).toBe(true);
      expect(isRetryableError(new ServiceUnavailableError())).toBe(true);
    });

    it('should identify non-retryable AppError status codes', () => {
      expect(isRetryableError(new ValidationError('Invalid input'))).toBe(false);
      expect(isRetryableError(new AuthenticationError())).toBe(false);
      expect(isRetryableError(new NotFoundError())).toBe(false);
    });

    it('should identify retryable regular errors', () => {
      expect(isRetryableError(new Error('Network error occurred'))).toBe(true);
      expect(isRetryableError(new Error('Connection timeout'))).toBe(true);
    });

    it('should identify non-retryable regular errors', () => {
      expect(isRetryableError(new Error('Invalid input format'))).toBe(false);
    });
  });

  describe('extractErrorDetails', () => {
    it('should extract AppError details', () => {
      const details = { field: 'email', value: 'invalid@' };
      const error = new ValidationError('Invalid email', details);

      const extracted = extractErrorDetails(error);

      expect(extracted).toMatchObject({
        message: 'Invalid email',
        name: 'ValidationError',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details,
      });
      expect(extracted.stack).toBeDefined();
    });

    it('should extract regular Error details', () => {
      const error = new Error('Regular error');
      const extracted = extractErrorDetails(error);

      expect(extracted).toMatchObject({
        message: 'Regular error',
        name: 'Error',
      });
      expect(extracted.stack).toBeDefined();
      expect(extracted.code).toBeUndefined();
      expect(extracted.statusCode).toBeUndefined();
    });

    it('should handle error with cause chain', () => {
      const rootCause = new Error('Root cause');
      const error = new Error('Main error', { cause: rootCause });

      const extracted = extractErrorDetails(error);

      expect(extracted.cause).toBeDefined();
      expect(extracted.cause.message).toBe('Root cause');
    });
  });
});
