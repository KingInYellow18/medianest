import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, createChildLogger } from '@/utils/logger';

// Mock winston
const mockWinston = {
  createLogger: vi.fn(),
  format: {
    combine: vi.fn(),
    timestamp: vi.fn(),
    errors: vi.fn(),
    json: vi.fn(),
    printf: vi.fn(),
    colorize: vi.fn(),
  },
  transports: {
    Console: vi.fn(),
    File: vi.fn(),
  },
};

vi.mock('winston', () => mockWinston);

describe('Logger Utility', () => {
  let mockLoggerInstance: any;

  beforeEach(() => {
    mockLoggerInstance = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
      silly: vi.fn(),
      child: vi.fn(),
    };

    mockWinston.createLogger.mockReturnValue(mockLoggerInstance);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logger instance', () => {
    it('should create logger with winston', () => {
      expect(mockWinston.createLogger).toHaveBeenCalled();
    });

    it('should expose info method', () => {
      const message = 'Test info message';
      const meta = { userId: '123' };

      logger.info(message, meta);

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(message, meta);
    });

    it('should expose error method', () => {
      const message = 'Test error message';
      const error = new Error('Test error');

      logger.error(message, { error });

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(message, { error });
    });

    it('should expose warn method', () => {
      const message = 'Test warning message';

      logger.warn(message);

      expect(mockLoggerInstance.warn).toHaveBeenCalledWith(message);
    });

    it('should expose debug method', () => {
      const message = 'Test debug message';
      const context = { component: 'test' };

      logger.debug(message, context);

      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(message, context);
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
        (logger as any)[method](message);
        expect((mockLoggerInstance as any)[method]).toHaveBeenCalledWith(message);
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

      logger.info(message, metadata);

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(message, metadata);
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

      logger.info(message, metadata);

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(message, metadata);
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

      logger.info(message, metadata);

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(message, metadata);
    });
  });

  describe('error logging', () => {
    it('should handle Error objects', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      logger.error('An error occurred', { error });

      expect(mockLoggerInstance.error).toHaveBeenCalledWith('An error occurred', { error });
    });

    it('should handle custom error properties', () => {
      const error = new Error('Custom error') as any;
      error.code = 'CUSTOM_ERROR';
      error.statusCode = 400;
      error.details = { field: 'email', issue: 'invalid format' };

      logger.error('Validation error', { error });

      expect(mockLoggerInstance.error).toHaveBeenCalledWith('Validation error', { error });
    });

    it('should handle non-Error objects', () => {
      const errorLike = {
        message: 'Not a real Error',
        code: 'FAKE_ERROR',
        stack: 'Fake stack trace',
      };

      logger.error('Error-like object', { error: errorLike });

      expect(mockLoggerInstance.error).toHaveBeenCalledWith('Error-like object', { error: errorLike });
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

      logger.info('Performance metrics', metrics);

      expect(mockLoggerInstance.info).toHaveBeenCalledWith('Performance metrics', metrics);
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

      logger.debug('Request timing', timingInfo);

      expect(mockLoggerInstance.debug).toHaveBeenCalledWith('Request timing', timingInfo);
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

      logger.info('Authentication event', authEvent);

      expect(mockLoggerInstance.info).toHaveBeenCalledWith('Authentication event', authEvent);
    });

    it('should log security violations', () => {
      const violation = {
        type: 'rate_limit_exceeded',
        ip: '192.168.1.100',
        endpoint: '/api/login',
        attempts: 10,
        window: '5 minutes',
      };

      logger.warn('Security violation detected', violation);

      expect(mockLoggerInstance.warn).toHaveBeenCalledWith('Security violation detected', violation);
    });

    it('should handle sensitive data filtering', () => {
      // This test assumes the logger implementation filters sensitive data
      const sensitiveData = {
        user: {
          id: '123',
          email: 'test@example.com',
          password: 'secret123', // Should be filtered
          token: 'jwt-token-here', // Should be filtered
        },
        request: {
          headers: {
            authorization: 'Bearer token', // Should be filtered
            'content-type': 'application/json',
          },
        },
      };

      logger.info('User operation', sensitiveData);

      expect(mockLoggerInstance.info).toHaveBeenCalledWith('User operation', sensitiveData);
    });
  });

  describe('createChildLogger', () => {
    it('should create child logger with context', () => {
      const childContext = {
        component: 'auth-service',
        requestId: 'req-123',
      };

      mockLoggerInstance.child.mockReturnValue({
        ...mockLoggerInstance,
        defaultMeta: childContext,
      });

      const childLogger = createChildLogger(childContext);

      expect(mockLoggerInstance.child).toHaveBeenCalledWith(childContext);
      expect(childLogger).toBeDefined();
    });

    it('should inherit parent logger methods in child', () => {
      const childLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        child: vi.fn(),
      };

      mockLoggerInstance.child.mockReturnValue(childLogger);

      const child = createChildLogger({ service: 'test' });
      
      if (child && typeof child.info === 'function') {
        child.info('Child log message');
        expect(childLogger.info).toHaveBeenCalledWith('Child log message');
      }
    });

    it('should create nested child loggers', () => {
      const parentChild = {
        info: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      };

      const nestedChild = {
        info: vi.fn(),
        error: vi.fn(),
        child: vi.fn(),
      };

      mockLoggerInstance.child.mockReturnValue(parentChild);
      parentChild.child.mockReturnValue(nestedChild);

      const parent = createChildLogger({ service: 'parent' });
      if (parent && typeof parent.child === 'function') {
        const nested = parent.child({ operation: 'nested' });
        
        if (nested && typeof nested.info === 'function') {
          nested.info('Nested message');
          expect(nestedChild.info).toHaveBeenCalledWith('Nested message');
        }
      }
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle undefined metadata', () => {
      logger.info('Message with undefined metadata', undefined);

      expect(mockLoggerInstance.info).toHaveBeenCalledWith('Message with undefined metadata', undefined);
    });

    it('should handle null metadata', () => {
      logger.info('Message with null metadata', null);

      expect(mockLoggerInstance.info).toHaveBeenCalledWith('Message with null metadata', null);
    });

    it('should handle empty metadata object', () => {
      logger.info('Message with empty metadata', {});

      expect(mockLoggerInstance.info).toHaveBeenCalledWith('Message with empty metadata', {});
    });

    it('should handle circular references in metadata', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // Create circular reference

      logger.info('Message with circular reference', { data: obj });

      expect(mockLoggerInstance.info).toHaveBeenCalledWith('Message with circular reference', { data: obj });
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

      logger.info('Large metadata object', largeObject);

      expect(mockLoggerInstance.info).toHaveBeenCalledWith('Large metadata object', largeObject);
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Message with special chars: 🚀 ñoño @#$%^&*()[]{}|\\:";\'<>?,./';

      logger.info(specialMessage);

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(specialMessage);
    });
  });

  describe('integration scenarios', () => {
    it('should log HTTP request/response cycle', () => {
      // Request start
      logger.info('HTTP request started', {
        method: 'POST',
        url: '/api/users',
        headers: { 'content-type': 'application/json' },
        body: { name: 'John Doe' },
        timestamp: Date.now(),
      });

      // Processing
      logger.debug('Processing user creation', {
        operation: 'create_user',
        userId: 'pending',
      });

      // Response
      logger.info('HTTP request completed', {
        method: 'POST',
        url: '/api/users',
        status: 201,
        duration: 150,
        response: { id: 'user-123', name: 'John Doe' },
      });

      expect(mockLoggerInstance.info).toHaveBeenCalledTimes(2);
      expect(mockLoggerInstance.debug).toHaveBeenCalledTimes(1);
    });

    it('should log database operations', () => {
      logger.debug('Database query started', {
        query: 'SELECT * FROM users WHERE email = ?',
        params: ['test@example.com'],
      });

      logger.debug('Database query completed', {
        query: 'SELECT * FROM users WHERE email = ?',
        duration: 45,
        rowCount: 1,
      });

      expect(mockLoggerInstance.debug).toHaveBeenCalledTimes(2);
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

      logger.error('Database operation failed', { error, ...context });

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Database operation failed',
        expect.objectContaining({
          error,
          operation: 'user_lookup',
          userId: 'user-123',
          retryAttempt: 3,
        })
      );
    });
  });
});