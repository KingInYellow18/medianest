import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  isAppError,
  toErrorResponse,
} from '../index';

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
});
