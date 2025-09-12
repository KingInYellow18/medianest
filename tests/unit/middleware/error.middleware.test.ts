/**
 * ERROR MIDDLEWARE UNIT TESTS
 *
 * Comprehensive tests for error middleware covering:
 * - Error handling and formatting
 * - Different error types
 * - Security sanitization
 * - Logging integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { errorHandler, notFoundHandler } from '../../../backend/src/middleware/error.middleware';
import { AppError, ValidationError, AuthenticationError } from '../../../backend/src/utils/errors';
import { createMockResponse, createMockNext } from '../../mocks/auth-mock';

// Mock logger
vi.mock('../../../backend/src/utils/logger');

describe('Error Middleware', () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: any;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      path: '/api/test',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
      },
      user: { id: 'test-user-id' },
    };

    mockResponse = createMockResponse();
    mockNext = createMockNext();
  });

  describe('errorHandler', () => {
    it('should handle AppError with custom status code', () => {
      const error = new AppError('Custom error message', 422);

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Custom error message',
          code: 'APP_ERROR',
          statusCode: 422,
        },
        timestamp: expect.any(String),
        path: '/api/test',
      });
    });

    it('should handle ValidationError', () => {
      const error = new ValidationError('Invalid input data');

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Invalid input data',
          code: 'VALIDATION_ERROR',
          statusCode: 400,
        },
        timestamp: expect.any(String),
        path: '/api/test',
      });
    });

    it('should handle AuthenticationError', () => {
      const error = new AuthenticationError('Invalid token');

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Invalid token',
          code: 'AUTHENTICATION_ERROR',
          statusCode: 401,
        },
        timestamp: expect.any(String),
        path: '/api/test',
      });
    });

    it('should handle generic Error as 500', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
          statusCode: 500,
        },
        timestamp: expect.any(String),
        path: '/api/test',
      });
    });

    it('should handle Prisma unique constraint error', () => {
      const error = new Error('Unique constraint failed');
      (error as any).code = 'P2002';
      (error as any).meta = { target: ['email'] };

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'A record with this email already exists',
          code: 'CONFLICT_ERROR',
          statusCode: 409,
        },
        timestamp: expect.any(String),
        path: '/api/test',
      });
    });

    it('should handle Prisma record not found error', () => {
      const error = new Error('Record not found');
      (error as any).code = 'P2025';

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Record not found',
          code: 'NOT_FOUND_ERROR',
          statusCode: 404,
        },
        timestamp: expect.any(String),
        path: '/api/test',
      });
    });

    it('should handle JWT TokenExpiredError', () => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';
      (error as any).expiredAt = new Date();

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED',
          statusCode: 401,
        },
        timestamp: expect.any(String),
        path: '/api/test',
      });
    });

    it('should handle JWT JsonWebTokenError', () => {
      const error = new Error('invalid token');
      error.name = 'JsonWebTokenError';

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Invalid token',
          code: 'INVALID_TOKEN',
          statusCode: 401,
        },
        timestamp: expect.any(String),
        path: '/api/test',
      });
    });

    it('should include stack trace in development environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            stack: expect.any(String),
          }),
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');

      errorHandler(error, mockRequest, mockResponse, mockNext);

      const callArg = mockResponse.json.mock.calls[0][0];
      expect(callArg.error).not.toHaveProperty('stack');

      process.env.NODE_ENV = originalEnv;
    });

    it('should sanitize sensitive information from error messages', () => {
      const error = new Error('Database connection failed: user=admin password=secret123');

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Internal server error',
          }),
        }),
      );
    });

    it('should log errors appropriately', () => {
      const { logger } = require('../../../backend/src/utils/logger');
      const error = new AppError('Test error', 400);

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Error occurred:', {
        error: error.message,
        statusCode: 400,
        method: 'GET',
        path: '/api/test',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        userId: 'test-user-id',
        timestamp: expect.any(String),
        stack: expect.any(String),
      });
    });

    it('should handle missing response object gracefully', () => {
      const error = new AppError('Test error', 400);

      expect(() => {
        errorHandler(error, mockRequest, null as any, mockNext);
      }).not.toThrow();
    });

    it('should generate unique error ID for tracking', () => {
      const error = new AppError('Test error', 400);

      errorHandler(error, mockRequest, mockResponse, mockNext);

      const callArg = mockResponse.json.mock.calls[0][0];
      expect(callArg).toHaveProperty('errorId');
      expect(typeof callArg.errorId).toBe('string');
      expect(callArg.errorId).toMatch(/^[a-f0-9-]{36}$/); // UUID format
    });

    it('should handle rate limit errors specially', () => {
      const error = new Error('Too many requests');
      (error as any).statusCode = 429;
      (error as any).resetTime = Date.now() + 60000; // 1 minute from now

      errorHandler(error, mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Too many requests, please try again later',
          code: 'RATE_LIMIT_ERROR',
          statusCode: 429,
          retryAfter: expect.any(Number),
        },
        timestamp: expect.any(String),
        path: '/api/test',
        errorId: expect.any(String),
      });
    });
  });

  describe('notFoundHandler', () => {
    it('should handle 404 not found', () => {
      notFoundHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: `Route ${mockRequest.method} ${mockRequest.path} not found`,
          code: 'NOT_FOUND',
          statusCode: 404,
        },
        timestamp: expect.any(String),
        path: '/api/test',
      });
    });

    it('should handle request without path', () => {
      const requestWithoutPath = { ...mockRequest };
      delete requestWithoutPath.path;

      notFoundHandler(requestWithoutPath, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: `Route ${mockRequest.method} undefined not found`,
          code: 'NOT_FOUND',
          statusCode: 404,
        },
        timestamp: expect.any(String),
        path: undefined,
      });
    });

    it('should log 404 errors', () => {
      const { logger } = require('../../../backend/src/utils/logger');

      notFoundHandler(mockRequest, mockResponse);

      expect(logger.warn).toHaveBeenCalledWith('404 - Route not found:', {
        method: 'GET',
        path: '/api/test',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        timestamp: expect.any(String),
      });
    });
  });
});
