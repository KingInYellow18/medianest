import { describe, it, expect, beforeEach } from 'vitest';
import { AppError, handleAsyncError, createErrorResponse, isAppError } from '@/utils/errors';

describe('Error Utilities', () => {
  describe('AppError class', () => {
    it('should create AppError with all parameters', () => {
      const error = new AppError('VALIDATION_ERROR', 'Invalid input data', 400, {
        field: 'email',
        received: 'invalid-email',
      });

      expect(error.name).toBe('AppError');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input data');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({
        field: 'email',
        received: 'invalid-email',
      });
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.stack).toBeDefined();
    });

    it('should create AppError with minimal parameters', () => {
      const error = new AppError('GENERIC_ERROR', 'Something went wrong');

      expect(error.code).toBe('GENERIC_ERROR');
      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500); // Default status code
      expect(error.details).toBeUndefined();
    });

    it('should create AppError with custom status code', () => {
      const error = new AppError('NOT_FOUND', 'Resource not found', 404);

      expect(error.statusCode).toBe(404);
    });

    it('should be an instance of Error', () => {
      const error = new AppError('TEST_ERROR', 'Test message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should have consistent timestamp', () => {
      const before = Date.now();
      const error = new AppError('TEST_ERROR', 'Test message');
      const after = Date.now();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(after);
    });

    it('should preserve stack trace', () => {
      function createError() {
        return new AppError('TEST_ERROR', 'Test message');
      }

      const error = createError();
      expect(error.stack).toContain('createError');
    });
  });

  describe('isAppError function', () => {
    it('should return true for AppError instances', () => {
      const appError = new AppError('TEST_ERROR', 'Test message');
      expect(isAppError(appError)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const regularError = new Error('Regular error');
      expect(isAppError(regularError)).toBe(false);
    });

    it('should return false for error-like objects', () => {
      const errorLike = {
        name: 'Error',
        message: 'Error message',
        stack: 'Stack trace',
      };
      expect(isAppError(errorLike)).toBe(false);
    });

    it('should return false for null and undefined', () => {
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isAppError('error string')).toBe(false);
      expect(isAppError(123)).toBe(false);
      expect(isAppError(true)).toBe(false);
    });

    it('should return false for objects with partial AppError properties', () => {
      const partial = {
        code: 'TEST_ERROR',
        message: 'Test message',
        // Missing statusCode and other AppError properties
      };
      expect(isAppError(partial)).toBe(false);
    });
  });

  describe('handleAsyncError function', () => {
    it('should return result on successful promise', async () => {
      const successfulPromise = Promise.resolve('success');
      const [result, error] = await handleAsyncError(successfulPromise);

      expect(result).toBe('success');
      expect(error).toBeNull();
    });

    it('should return error on rejected promise', async () => {
      const failingPromise = Promise.reject(new Error('Test error'));
      const [result, error] = await handleAsyncError(failingPromise);

      expect(result).toBeNull();
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Test error');
    });

    it('should handle AppError rejection', async () => {
      const appError = new AppError('TEST_ERROR', 'Test app error', 400);
      const failingPromise = Promise.reject(appError);
      const [result, error] = await handleAsyncError(failingPromise);

      expect(result).toBeNull();
      expect(error).toBeInstanceOf(AppError);
      expect(error?.code).toBe('TEST_ERROR');
    });

    it('should handle string error rejection', async () => {
      const failingPromise = Promise.reject('String error');
      const [result, error] = await handleAsyncError(failingPromise);

      expect(result).toBeNull();
      expect(error).toBe('String error');
    });

    it('should handle null error rejection', async () => {
      const failingPromise = Promise.reject(null);
      const [result, error] = await handleAsyncError(failingPromise);

      expect(result).toBeNull();
      expect(error).toBeNull();
    });

    it('should handle undefined error rejection', async () => {
      const failingPromise = Promise.reject(undefined);
      const [result, error] = await handleAsyncError(failingPromise);

      expect(result).toBeNull();
      expect(error).toBeUndefined();
    });

    it('should handle complex object results', async () => {
      const complexResult = {
        data: { id: 1, name: 'Test' },
        meta: { count: 1, page: 1 },
      };
      const successfulPromise = Promise.resolve(complexResult);
      const [result, error] = await handleAsyncError(successfulPromise);

      expect(result).toEqual(complexResult);
      expect(error).toBeNull();
    });

    it('should handle array results', async () => {
      const arrayResult = [1, 2, 3, 'test', { key: 'value' }];
      const successfulPromise = Promise.resolve(arrayResult);
      const [result, error] = await handleAsyncError(successfulPromise);

      expect(result).toEqual(arrayResult);
      expect(error).toBeNull();
    });
  });

  describe('createErrorResponse function', () => {
    it('should create response from AppError', () => {
      const appError = new AppError('VALIDATION_ERROR', 'Invalid input', 400, {
        field: 'email',
      });

      const response = createErrorResponse(appError);

      expect(response).toEqual({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid input',
        statusCode: 400,
        details: { field: 'email' },
        timestamp: appError.timestamp,
      });
    });

    it('should create response from regular Error', () => {
      const regularError = new Error('Regular error message');
      const response = createErrorResponse(regularError);

      expect(response).toEqual({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Regular error message',
        statusCode: 500,
        timestamp: expect.any(Date),
      });
    });

    it('should handle Error with custom properties', () => {
      const customError = new Error('Custom error') as any;
      customError.statusCode = 422;
      customError.code = 'CUSTOM_CODE';

      const response = createErrorResponse(customError);

      expect(response.error).toBe('CUSTOM_CODE');
      expect(response.statusCode).toBe(422);
    });

    it('should create response from string error', () => {
      const response = createErrorResponse('String error message');

      expect(response).toEqual({
        success: false,
        error: 'UNKNOWN_ERROR',
        message: 'String error message',
        statusCode: 500,
        timestamp: expect.any(Date),
      });
    });

    it('should create response from error object', () => {
      const errorObject = {
        message: 'Error object message',
        code: 'ERROR_OBJECT_CODE',
        statusCode: 403,
      };

      const response = createErrorResponse(errorObject);

      expect(response.error).toBe('ERROR_OBJECT_CODE');
      expect(response.message).toBe('Error object message');
      expect(response.statusCode).toBe(403);
    });

    it('should handle null error', () => {
      const response = createErrorResponse(null);

      expect(response).toEqual({
        success: false,
        error: 'UNKNOWN_ERROR',
        message: 'Unknown error occurred',
        statusCode: 500,
        timestamp: expect.any(Date),
      });
    });

    it('should handle undefined error', () => {
      const response = createErrorResponse(undefined);

      expect(response).toEqual({
        success: false,
        error: 'UNKNOWN_ERROR',
        message: 'Unknown error occurred',
        statusCode: 500,
        timestamp: expect.any(Date),
      });
    });

    it('should preserve error details', () => {
      const errorWithDetails = new AppError('DETAILED_ERROR', 'Error with details', 400, {
        validationErrors: [
          { field: 'name', message: 'Required' },
          { field: 'email', message: 'Invalid format' },
        ],
        requestId: 'req-123',
      });

      const response = createErrorResponse(errorWithDetails);

      expect(response.details).toEqual({
        validationErrors: [
          { field: 'name', message: 'Required' },
          { field: 'email', message: 'Invalid format' },
        ],
        requestId: 'req-123',
      });
    });
  });

  describe('error code standardization', () => {
    it('should handle common HTTP error codes', () => {
      const testCases = [
        { code: 'BAD_REQUEST', statusCode: 400 },
        { code: 'UNAUTHORIZED', statusCode: 401 },
        { code: 'FORBIDDEN', statusCode: 403 },
        { code: 'NOT_FOUND', statusCode: 404 },
        { code: 'VALIDATION_ERROR', statusCode: 422 },
        { code: 'INTERNAL_ERROR', statusCode: 500 },
      ];

      testCases.forEach(({ code, statusCode }) => {
        const error = new AppError(code, 'Test message', statusCode);
        expect(error.code).toBe(code);
        expect(error.statusCode).toBe(statusCode);
      });
    });

    it('should handle custom business logic error codes', () => {
      const businessErrors = [
        'USER_NOT_FOUND',
        'MEDIA_REQUEST_EXISTS',
        'PLEX_AUTH_FAILED',
        'YOUTUBE_DOWNLOAD_ERROR',
        'CACHE_MISS',
        'DATABASE_CONNECTION_ERROR',
      ];

      businessErrors.forEach(code => {
        const error = new AppError(code, 'Business logic error');
        expect(error.code).toBe(code);
        expect(error.statusCode).toBe(500); // Default
      });
    });
  });

  describe('error inheritance and polymorphism', () => {
    class CustomAppError extends AppError {
      constructor(message: string, public readonly source: string) {
        super('CUSTOM_ERROR', message, 400);
      }
    }

    it('should work with inherited error classes', () => {
      const customError = new CustomAppError('Custom message', 'test-source');

      expect(customError).toBeInstanceOf(Error);
      expect(customError).toBeInstanceOf(AppError);
      expect(customError).toBeInstanceOf(CustomAppError);
      expect(customError.source).toBe('test-source');
      expect(isAppError(customError)).toBe(true);
    });

    it('should preserve custom properties in error response', () => {
      const customError = new CustomAppError('Custom message', 'test-source');
      const response = createErrorResponse(customError);

      expect(response.error).toBe('CUSTOM_ERROR');
      expect(response.statusCode).toBe(400);
    });
  });

  describe('error serialization', () => {
    it('should serialize AppError to JSON correctly', () => {
      const error = new AppError('TEST_ERROR', 'Test message', 400, {
        field: 'test',
      });

      const serialized = JSON.parse(JSON.stringify(error));

      expect(serialized.name).toBe('AppError');
      expect(serialized.code).toBe('TEST_ERROR');
      expect(serialized.message).toBe('Test message');
      expect(serialized.statusCode).toBe(400);
      expect(serialized.details).toEqual({ field: 'test' });
    });

    it('should handle circular references in details', () => {
      const details: any = { name: 'test' };
      details.self = details; // Create circular reference

      const error = new AppError('CIRCULAR_ERROR', 'Error with circular ref', 400, details);

      // Should not throw when serializing
      expect(() => createErrorResponse(error)).not.toThrow();
    });
  });

  describe('integration with async operations', () => {
    async function simulateAsyncOperation(shouldFail: boolean) {
      if (shouldFail) {
        throw new AppError('OPERATION_FAILED', 'Async operation failed', 500);
      }
      return { success: true, data: 'operation result' };
    }

    it('should handle successful async operations', async () => {
      const [result, error] = await handleAsyncError(simulateAsyncOperation(false));

      expect(result).toEqual({ success: true, data: 'operation result' });
      expect(error).toBeNull();
    });

    it('should handle failed async operations', async () => {
      const [result, error] = await handleAsyncError(simulateAsyncOperation(true));

      expect(result).toBeNull();
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('OPERATION_FAILED');
    });

    it('should work with Promise chains', async () => {
      const chainedOperation = simulateAsyncOperation(false)
        .then(result => ({ ...result, processed: true }))
        .then(result => ({ ...result, final: true }));

      const [result, error] = await handleAsyncError(chainedOperation);

      expect(result).toEqual({
        success: true,
        data: 'operation result',
        processed: true,
        final: true,
      });
      expect(error).toBeNull();
    });

    it('should catch errors in Promise chains', async () => {
      const chainedOperation = simulateAsyncOperation(false)
        .then(() => {
          throw new AppError('CHAIN_ERROR', 'Error in chain', 400);
        });

      const [result, error] = await handleAsyncError(chainedOperation);

      expect(result).toBeNull();
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('CHAIN_ERROR');
    });
  });
});