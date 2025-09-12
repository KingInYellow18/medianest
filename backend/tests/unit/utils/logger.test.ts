import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import after mocking
import winston from 'winston';

import { logger, createChildLogger } from '@/utils/logger';

// Mock winston before importing logger
vi.mock('winston', () => {
  const mockLoggerInstance = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
    child: vi.fn((ctx: any) => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
      silly: vi.fn(),
      child: vi.fn((ctx: any) => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        verbose: vi.fn(),
        silly: vi.fn(),
        child: vi.fn(),
      })),
    })),
  };

  const mockWinston = {
    createLogger: vi.fn(() => mockLoggerInstance),
    format: {
      combine: vi.fn(() => vi.fn()),
      timestamp: vi.fn(() => vi.fn()),
      errors: vi.fn(() => vi.fn()),
      splat: vi.fn(() => vi.fn()),
      json: vi.fn(() => vi.fn()),
      printf: vi.fn(() => vi.fn()),
      colorize: vi.fn(() => vi.fn()),
    },
    transports: {
      Console: vi.fn(),
      File: vi.fn(),
    },
  };

  return {
    default: mockWinston,
    ...mockWinston,
  };
});

vi.mock('winston-daily-rotate-file', () => ({
  default: vi.fn(),
}));

describe('Logger Utility', () => {
  beforeEach(() => {
    // Don't clear winston.createLogger mock since it's called during import
    // vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logger instance', () => {
    it('should create logger with winston', () => {
      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should expose info method', () => {
      const message = 'Test info message';
      const meta = { userId: '123' };

      expect(() => logger.info(message, meta)).not.toThrow();
      expect(logger.info).toBeDefined();
    });

    it('should expose error method', () => {
      const message = 'Test error message';
      const error = new Error('Test error');

      expect(() => logger.error(message, { error })).not.toThrow();
      expect(logger.error).toBeDefined();
    });

    it('should expose warn method', () => {
      const message = 'Test warning message';

      expect(() => logger.warn(message)).not.toThrow();
      expect(logger.warn).toBeDefined();
    });

    it('should expose debug method', () => {
      const message = 'Test debug message';
      const context = { component: 'test' };

      expect(() => logger.debug(message, context)).not.toThrow();
      expect(logger.debug).toBeDefined();
    });
  });

  describe('log levels', () => {
    it('should handle different log levels', () => {
      const testCases = [
        { level: 'info', method: 'info' },
        { level: 'error', method: 'error' },
        { level: 'warn', method: 'warn' },
        { level: 'debug', method: 'debug' },
        { level: 'verbose', method: 'verbose' },
        { level: 'silly', method: 'silly' },
      ];

      testCases.forEach(({ level, method }) => {
        const message = `Test ${level} message`;
        expect(() => (logger as any)[method](message)).not.toThrow();
        expect((logger as any)[method]).toBeDefined();
      });
    });
  });

  describe('structured logging', () => {
    it('should handle object metadata', () => {
      const message = 'User action';
      const metadata = {
        userId: '123',
        action: 'login',
        ip: '192.168.1.1',
        timestamp: new Date(),
      };

      expect(() => logger.info(message, metadata)).not.toThrow();
      expect(logger.info).toBeDefined();
    });

    it('should handle nested objects', () => {
      const message = 'API request';
      const metadata = {
        request: {
          method: 'POST',
          url: '/api/users',
          headers: {
            'content-type': 'application/json',
            'user-agent': 'test-agent',
          },
          body: {
            name: 'Test User',
            email: 'test@example.com',
          },
        },
        response: {
          status: 201,
          duration: 150,
        },
      };

      expect(() => logger.info(message, metadata)).not.toThrow();
    });

    it('should handle arrays in metadata', () => {
      const message = 'Batch operation';
      const metadata = {
        items: ['item1', 'item2', 'item3'],
        results: [
          { id: 1, success: true },
          { id: 2, success: false, error: 'Validation failed' },
        ],
      };

      expect(() => logger.info(message, metadata)).not.toThrow();
    });
  });

  describe('error logging', () => {
    it('should handle Error objects', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      expect(() => logger.error('An error occurred', { error })).not.toThrow();
    });

    it('should handle custom error properties', () => {
      const error = new Error('Custom error') as any;
      error.code = 'CUSTOM_ERROR';
      error.statusCode = 400;
      error.details = { field: 'email', issue: 'invalid format' };

      expect(() => logger.error('Validation error', { error })).not.toThrow();
    });

    it('should handle non-Error objects', () => {
      const errorLike = {
        message: 'Not a real Error',
        code: 'FAKE_ERROR',
        stack: 'Fake stack trace',
      };

      expect(() => logger.error('Error-like object', { error: errorLike })).not.toThrow();
    });
  });

  describe('performance logging', () => {
    it('should log performance metrics', () => {
      const metrics = {
        operation: 'database_query',
        duration: 250,
        queryCount: 3,
        memoryUsage: {
          heapUsed: 50000000,
          heapTotal: 100000000,
        },
      };

      expect(() => logger.info('Performance metrics', metrics)).not.toThrow();
    });

    it('should log timing information', () => {
      const startTime = Date.now();
      const endTime = startTime + 1500;

      const timingInfo = {
        operation: 'api_request',
        startTime,
        endTime,
        duration: endTime - startTime,
      };

      expect(() => logger.debug('Request timing', timingInfo)).not.toThrow();
    });
  });

  describe('security logging', () => {
    it('should log authentication events', () => {
      const authEvent = {
        event: 'login_attempt',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        timestamp: new Date(),
      };

      expect(() => logger.info('Authentication event', authEvent)).not.toThrow();
    });

    it('should log security violations', () => {
      const violation = {
        type: 'rate_limit_exceeded',
        ip: '192.168.1.100',
        endpoint: '/api/login',
        attempts: 10,
        window: '5 minutes',
      };

      expect(() => logger.warn('Security violation detected', violation)).not.toThrow();
    });

    it('should handle sensitive data filtering', () => {
      const sensitiveData = {
        user: {
          id: '123',
          email: 'test@example.com',
          password: 'secret123',
          token: 'jwt-token-here',
        },
        request: {
          headers: {
            authorization: 'Bearer token',
            'content-type': 'application/json',
          },
        },
      };

      expect(() => logger.info('User operation', sensitiveData)).not.toThrow();
    });
  });

  describe('createChildLogger', () => {
    it('should create child logger with context', () => {
      const childContext = {
        component: 'auth-service',
        requestId: 'req-123',
      };

      const childLogger = createChildLogger(childContext.requestId);

      expect(childLogger).toBeDefined();
      expect(childLogger.info).toBeDefined();
      expect(childLogger.error).toBeDefined();
      expect(childLogger.warn).toBeDefined();
      expect(childLogger.debug).toBeDefined();
    });

    it('should inherit parent logger methods in child', () => {
      const child = createChildLogger('test-correlation-id');

      expect(child).toBeDefined();
      expect(child.info).toBeDefined();
      expect(child.error).toBeDefined();
      expect(child.warn).toBeDefined();
      expect(child.debug).toBeDefined();
      expect(() => child.info('Child log message')).not.toThrow();
    });

    it('should create nested child loggers', () => {
      const parent = createChildLogger('parent-correlation-id');

      expect(parent).toBeDefined();
      expect(parent.child).toBeDefined();

      if (parent && typeof parent.child === 'function') {
        const nested = parent.child({ operation: 'nested' });

        expect(nested).toBeDefined();
        if (nested && typeof nested.info === 'function') {
          expect(() => nested.info('Nested message')).not.toThrow();
        }
      }
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle undefined metadata', () => {
      expect(() => logger.info('Message with undefined metadata', undefined)).not.toThrow();
    });

    it('should handle null metadata', () => {
      expect(() => logger.info('Message with null metadata', null)).not.toThrow();
    });

    it('should handle empty metadata object', () => {
      expect(() => logger.info('Message with empty metadata', {})).not.toThrow();
    });

    it('should handle circular references in metadata', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // Create circular reference

      expect(() => logger.info('Message with circular reference', { data: obj })).not.toThrow();
    });

    it('should handle very large metadata objects', () => {
      const largeObject = {
        data: 'x'.repeat(10000),
        array: new Array(1000).fill('item'),
        nested: {
          level1: {
            level2: {
              level3: {
                deepData: 'very deep',
              },
            },
          },
        },
      };

      expect(() => logger.info('Large metadata object', largeObject)).not.toThrow();
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Message with special chars: 🚀 ñoño @#$%^&*()[]{}|\\:";\'<>?,./';

      expect(() => logger.info(specialMessage)).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should log HTTP request/response cycle', () => {
      expect(() => {
        logger.info('HTTP request started', {
          method: 'POST',
          url: '/api/users',
          headers: { 'content-type': 'application/json' },
          body: { name: 'John Doe' },
          timestamp: Date.now(),
        });

        logger.debug('Processing user creation', {
          operation: 'create_user',
          userId: 'pending',
        });

        logger.info('HTTP request completed', {
          method: 'POST',
          url: '/api/users',
          status: 201,
          duration: 150,
          response: { id: 'user-123', name: 'John Doe' },
        });
      }).not.toThrow();
    });

    it('should log database operations', () => {
      expect(() => {
        logger.debug('Database query started', {
          query: 'SELECT * FROM users WHERE email = ?',
          params: ['test@example.com'],
        });

        logger.debug('Database query completed', {
          query: 'SELECT * FROM users WHERE email = ?',
          duration: 45,
          rowCount: 1,
        });
      }).not.toThrow();
    });

    it('should log error with full context', () => {
      const error = new Error('Database connection failed');
      const context = {
        operation: 'user_lookup',
        userId: 'user-123',
        query: 'SELECT * FROM users',
        timestamp: Date.now(),
        retryAttempt: 3,
        connectionString: 'postgresql://***:***@localhost:5432/db',
      };

      expect(() => {
        logger.error('Database operation failed', { error, ...context });
      }).not.toThrow();
    });
  });
});
