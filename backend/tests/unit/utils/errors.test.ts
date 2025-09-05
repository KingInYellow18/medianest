import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError
} from '@/utils/errors';

describe('Custom Error Classes', () => {
  describe('AppError', () => {
    it('should create error with default values', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.details).toBeUndefined();
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('Error');
    });

    it('should create error with custom values', () => {
      const details = { field: 'username', reason: 'invalid format' };
      const error = new AppError('Custom error', 400, 'CUSTOM_ERROR', details);

      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should maintain proper stack trace', () => {
      const error = new AppError('Stack trace test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Stack trace test');
      expect(error.stack).toContain('AppError');
    });

    it('should be serializable', () => {
      const error = new AppError('Serializable error', 400, 'SERIALIZE_ERROR', { test: true });
      
      const serialized = JSON.stringify({
        message: error.message,
        statusCode: error.statusCode,
        code: error.code,
        details: error.details
      });

      const parsed = JSON.parse(serialized);
      expect(parsed.message).toBe('Serializable error');
      expect(parsed.statusCode).toBe(400);
      expect(parsed.code).toBe('SERIALIZE_ERROR');
      expect(parsed.details).toEqual({ test: true });
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with default properties', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should create validation error with details', () => {
      const details = { 
        fields: ['email', 'password'], 
        errors: ['Invalid email format', 'Password too short'] 
      };
      const error = new ValidationError('Validation failed', details);

      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should handle complex validation details', () => {
      const complexDetails = {
        field: 'user.profile.settings',
        value: null,
        expected: 'object',
        constraints: {
          required: true,
          minProperties: 1
        }
      };
      const error = new ValidationError('Complex validation error', complexDetails);

      expect(error.details).toEqual(complexDetails);
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error with default message', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should create authentication error with custom message', () => {
      const error = new AuthenticationError('Invalid token');

      expect(error.message).toBe('Invalid token');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should handle empty string message', () => {
      const error = new AuthenticationError('');

      expect(error.message).toBe('');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('AuthorizationError', () => {
    it('should create authorization error with default message', () => {
      const error = new AuthorizationError();

      expect(error.message).toBe('Insufficient permissions');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should create authorization error with custom message', () => {
      const error = new AuthorizationError('Admin role required');

      expect(error.message).toBe('Admin role required');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with resource name', () => {
      const error = new NotFoundError('User');

      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND_ERROR');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should handle special characters in resource name', () => {
      const error = new NotFoundError('Media Request #123');

      expect(error.message).toBe('Media Request #123 not found');
    });

    it('should handle empty resource name', () => {
      const error = new NotFoundError('');

      expect(error.message).toBe(' not found');
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error', () => {
      const error = new ConflictError('Resource already exists');

      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT_ERROR');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should handle complex conflict scenarios', () => {
      const error = new ConflictError('User with email test@example.com already exists');

      expect(error.message).toContain('already exists');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error without retry after', () => {
      const error = new RateLimitError();

      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.retryAfter).toBeUndefined();
      expect(error.details).toEqual({ retryAfter: undefined });
      expect(error).toBeInstanceOf(AppError);
    });

    it('should create rate limit error with retry after', () => {
      const error = new RateLimitError(3600);

      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.retryAfter).toBe(3600);
      expect(error.details).toEqual({ retryAfter: 3600 });
    });

    it('should handle zero retry after', () => {
      const error = new RateLimitError(0);

      expect(error.retryAfter).toBe(0);
      expect(error.details).toEqual({ retryAfter: 0 });
    });

    it('should handle negative retry after', () => {
      const error = new RateLimitError(-1);

      expect(error.retryAfter).toBe(-1);
      expect(error.details).toEqual({ retryAfter: -1 });
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create service unavailable error', () => {
      const error = new ServiceUnavailableError('Plex');

      expect(error.message).toBe('Plex is temporarily unavailable');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should handle service names with spaces', () => {
      const error = new ServiceUnavailableError('Media Request Service');

      expect(error.message).toBe('Media Request Service is temporarily unavailable');
    });

    it('should handle empty service name', () => {
      const error = new ServiceUnavailableError('');

      expect(error.message).toBe(' is temporarily unavailable');
    });
  });

  describe('Error inheritance chain', () => {
    it('should maintain instanceof relationships', () => {
      const appError = new AppError('Test');
      const validationError = new ValidationError('Test');
      const authError = new AuthenticationError('Test');

      expect(appError).toBeInstanceOf(Error);
      expect(validationError).toBeInstanceOf(Error);
      expect(validationError).toBeInstanceOf(AppError);
      expect(authError).toBeInstanceOf(Error);
      expect(authError).toBeInstanceOf(AppError);
    });

    it('should preserve error properties through inheritance', () => {
      const errors = [
        new ValidationError('Test', { field: 'test' }),
        new AuthenticationError('Test'),
        new NotFoundError('Test'),
        new ConflictError('Test'),
        new RateLimitError(60),
        new ServiceUnavailableError('Test')
      ];

      errors.forEach(error => {
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('statusCode');
        expect(error).toHaveProperty('code');
        expect(error).toHaveProperty('stack');
        expect(typeof error.statusCode).toBe('number');
        expect(typeof error.code).toBe('string');
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new AppError(longMessage);

      expect(error.message).toBe(longMessage);
      expect(error.message.length).toBe(10000);
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Error with 特殊字符 and émojis 🚨';
      const error = new AppError(specialMessage);

      expect(error.message).toBe(specialMessage);
    });

    it('should handle null and undefined in details', () => {
      const error1 = new AppError('Test', 400, 'TEST', null);
      const error2 = new AppError('Test', 400, 'TEST', undefined);

      expect(error1.details).toBeNull();
      expect(error2.details).toBeUndefined();
    });

    it('should handle circular references in details', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      expect(() => {
        new AppError('Test', 400, 'TEST', circular);
      }).not.toThrow();
    });
  });
});