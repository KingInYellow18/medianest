// Test factories for error handling - applying proven 24-agent patterns

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
} from '../errors';

export interface ErrorTestCase {
  name: string;
  error: AppError;
  expectedCode: string;
  expectedStatusCode: number;
  expectedMessage?: string;
  expectedDetails?: any;
}

/**
 * Factory for creating comprehensive error test cases
 * Based on proven patterns from Wave 1 & 2 successes
 */
export class ErrorTestFactory {
  /**
   * Generate standard error test cases for consistent testing
   */
  static createStandardErrorCases(): ErrorTestCase[] {
    return [
      {
        name: 'ValidationError - Basic',
        error: new ValidationError('Invalid input'),
        expectedCode: 'VALIDATION_ERROR',
        expectedStatusCode: 400,
        expectedMessage: 'Invalid input',
        expectedDetails: {},
      },
      {
        name: 'ValidationError - With Details',
        error: new ValidationError('Field validation failed', {
          fields: ['email', 'password'],
          errors: ['Invalid email format', 'Password too short'],
        }),
        expectedCode: 'VALIDATION_ERROR',
        expectedStatusCode: 400,
        expectedMessage: 'Field validation failed',
        expectedDetails: {
          fields: ['email', 'password'],
          errors: ['Invalid email format', 'Password too short'],
        },
      },
      {
        name: 'AuthenticationError - Default',
        error: new AuthenticationError(),
        expectedCode: 'UNAUTHORIZED',
        expectedStatusCode: 401,
        expectedMessage: 'Authentication required',
      },
      {
        name: 'AuthenticationError - Custom Message',
        error: new AuthenticationError('Invalid token'),
        expectedCode: 'UNAUTHORIZED',
        expectedStatusCode: 401,
        expectedMessage: 'Invalid token',
      },
      {
        name: 'AuthorizationError - Default',
        error: new AuthorizationError(),
        expectedCode: 'FORBIDDEN',
        expectedStatusCode: 403,
        expectedMessage: 'Insufficient permissions',
      },
      {
        name: 'NotFoundError - Resource Specific',
        error: new NotFoundError('User'),
        expectedCode: 'NOT_FOUND',
        expectedStatusCode: 404,
        expectedMessage: 'User not found',
      },
      {
        name: 'RateLimitError - With Retry',
        error: new RateLimitError('Too many requests', 60),
        expectedCode: 'RATE_LIMIT_EXCEEDED',
        expectedStatusCode: 429,
        expectedMessage: 'Too many requests',
        expectedDetails: { retryAfter: 60 },
      },
      {
        name: 'ServiceUnavailableError - Database',
        error: new ServiceUnavailableError('Database'),
        expectedCode: 'SERVICE_UNAVAILABLE',
        expectedStatusCode: 503,
        expectedMessage: 'Database is temporarily unavailable',
      },
    ];
  }

  /**
   * Generate error cases for edge scenarios
   */
  static createEdgeErrorCases(): ErrorTestCase[] {
    return [
      {
        name: 'Empty message handling',
        error: new ValidationError(''),
        expectedCode: 'VALIDATION_ERROR',
        expectedStatusCode: 400,
        expectedMessage: '',
      },
      {
        name: 'Null details handling',
        error: new BadRequestError('Bad request', null),
        expectedCode: 'BAD_REQUEST',
        expectedStatusCode: 400,
        expectedMessage: 'Bad request',
        expectedDetails: null,
      },
      {
        name: 'Large details object',
        error: new InternalServerError('System error', {
          timestamp: new Date().toISOString(),
          requestId: 'req_12345',
          stackTrace: 'Error at line 123...',
          context: { userId: 'user_123', action: 'update', resource: 'profile' },
          metadata: { version: '1.0.0', environment: 'test' },
        }),
        expectedCode: 'INTERNAL_ERROR',
        expectedStatusCode: 500,
        expectedMessage: 'System error',
      },
    ];
  }

  /**
   * Generate realistic error scenarios for integration testing
   */
  static createRealisticErrorScenarios(): ErrorTestCase[] {
    return [
      {
        name: 'API Validation Error - User Registration',
        error: new ValidationError('User registration validation failed', {
          fields: {
            email: 'Email is already registered',
            password: 'Password must be at least 8 characters',
            confirmPassword: 'Passwords do not match',
          },
          source: 'user_registration',
          timestamp: new Date().toISOString(),
        }),
        expectedCode: 'VALIDATION_ERROR',
        expectedStatusCode: 400,
      },
      {
        name: 'Resource Conflict - Duplicate Entry',
        error: new ConflictError('Username already exists'),
        expectedCode: 'CONFLICT',
        expectedStatusCode: 409,
        expectedMessage: 'Username already exists',
      },
      {
        name: 'Rate Limiting - API Threshold',
        error: new RateLimitError('API rate limit exceeded for this endpoint', 120),
        expectedCode: 'RATE_LIMIT_EXCEEDED',
        expectedStatusCode: 429,
        expectedDetails: { retryAfter: 120 },
      },
      {
        name: 'Service Down - Database Connection',
        error: new ServiceUnavailableError('PostgreSQL'),
        expectedCode: 'SERVICE_UNAVAILABLE',
        expectedStatusCode: 503,
        expectedMessage: 'PostgreSQL is temporarily unavailable',
      },
    ];
  }

  /**
   * Create error for testing serialization/deserialization
   */
  static createSerializationTestError(): AppError {
    return new ValidationError('Serialization test error', {
      nested: {
        field: 'email',
        rules: ['required', 'email_format'],
        value: 'invalid@',
      },
      timestamp: '2024-01-01T00:00:00.000Z',
      requestId: 'test_req_123',
    });
  }

  /**
   * Create error chain for testing error cause tracking
   */
  static createErrorChain(): Error {
    const rootCause = new Error('Database connection timeout');
    const serviceError = new ServiceUnavailableError('User service unavailable');

    // Simulate error cause chain
    const chainedError = new InternalServerError('Request processing failed', {
      originalError: rootCause.message,
      serviceError: serviceError.message,
      cause: 'downstream_service_failure',
    });

    return chainedError;
  }
}

/**
 * Mock error logger for testing
 */
export class MockErrorLogger {
  private logs: any[] = [];

  log(error: Error, context?: any): void {
    this.logs.push({
      error,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  getLogs(): any[] {
    return [...this.logs];
  }

  getLastLog(): any {
    return this.logs[this.logs.length - 1];
  }

  clear(): void {
    this.logs = [];
  }

  hasErrorWithMessage(message: string): boolean {
    return this.logs.some((log) => log.error.message === message);
  }

  hasErrorWithCode(code: string): boolean {
    return this.logs.some((log) => log.error.code === code);
  }

  getErrorCount(): number {
    return this.logs.length;
  }
}

/**
 * Test data generators for error-related scenarios
 */
export class ErrorTestDataGenerator {
  /**
   * Generate test user data that will trigger validation errors
   */
  static generateInvalidUserData(): any[] {
    return [
      { email: 'invalid-email', password: '123' }, // Both invalid
      { email: '', password: 'validPassword123!' }, // Empty email
      { email: 'valid@test.com', password: '' }, // Empty password
      { email: 'user@domain', password: 'short' }, // Invalid email format, short password
      {
        email: 'a'.repeat(255) + '@test.com',
        password: 'a'.repeat(1000),
      }, // Too long values
    ];
  }

  /**
   * Generate API response data for error parsing tests
   */
  static generateApiErrorResponses(): any[] {
    return [
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          statusCode: 400,
          details: { field: 'email' },
        },
      },
      {
        error: { message: 'Something went wrong' }, // Missing code and statusCode
      },
      {
        success: false, // No error field
      },
      null, // Null response
      undefined, // Undefined response
      'string error', // Non-object response
    ];
  }
}

/**
 * Error assertion helpers for consistent testing
 */
export class ErrorAssertions {
  /**
   * Assert that an error matches expected properties
   */
  static assertErrorMatches(
    actual: AppError,
    expected: Pick<
      ErrorTestCase,
      'expectedCode' | 'expectedStatusCode' | 'expectedMessage' | 'expectedDetails'
    >,
  ): void {
    if (expected.expectedCode) {
      expect(actual.code).toBe(expected.expectedCode);
    }
    if (expected.expectedStatusCode) {
      expect(actual.statusCode).toBe(expected.expectedStatusCode);
    }
    if (expected.expectedMessage) {
      expect(actual.message).toBe(expected.expectedMessage);
    }
    if (expected.expectedDetails !== undefined) {
      expect(actual.details).toEqual(expected.expectedDetails);
    }
  }

  /**
   * Assert that error response has correct structure
   */
  static assertErrorResponse(response: any, expectedError: AppError): void {
    expect(response).toMatchObject({
      success: false,
      error: {
        code: expectedError.code,
        message: expectedError.message,
        details: expectedError.details || {},
      },
    });
  }

  /**
   * Assert that error was properly logged
   */
  static assertErrorLogged(mockLogger: MockErrorLogger, expectedError: Error): void {
    expect(mockLogger.hasErrorWithMessage(expectedError.message)).toBe(true);
    expect(mockLogger.getErrorCount()).toBeGreaterThan(0);
  }
}
