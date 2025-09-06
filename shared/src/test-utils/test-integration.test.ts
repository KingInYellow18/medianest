// Integration tests for shared utilities - proving 24-agent patterns work

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ErrorTestFactory,
  MockErrorLogger,
  ErrorTestDataGenerator,
  ErrorAssertions,
} from './error-factories';
import {
  serializeError,
  parseApiError,
  logError,
  getUserFriendlyMessage,
  isRetryableError,
} from '../errors/utils';
import { ValidationError, AuthenticationError } from '../errors';

describe('Shared Test Utilities Integration', () => {
  describe('ErrorTestFactory', () => {
    it('should generate comprehensive error test cases', () => {
      const standardCases = ErrorTestFactory.createStandardErrorCases();
      const edgeCases = ErrorTestFactory.createEdgeErrorCases();
      const realisticCases = ErrorTestFactory.createRealisticErrorScenarios();

      expect(standardCases).toHaveLength(8);
      expect(edgeCases).toHaveLength(3);
      expect(realisticCases).toHaveLength(4);

      // Verify structure of test cases
      standardCases.forEach((testCase) => {
        expect(testCase).toHaveProperty('name');
        expect(testCase).toHaveProperty('error');
        expect(testCase).toHaveProperty('expectedCode');
        expect(testCase).toHaveProperty('expectedStatusCode');
      });
    });

    it('should create error chain for cause tracking', () => {
      const errorChain = ErrorTestFactory.createErrorChain();

      expect(errorChain.message).toBe('Request processing failed');
      expect(errorChain).toHaveProperty('details');
    });
  });

  describe('MockErrorLogger', () => {
    let mockLogger: MockErrorLogger;

    beforeEach(() => {
      mockLogger = new MockErrorLogger();
    });

    it('should track logged errors correctly', () => {
      const error1 = new ValidationError('First error');
      const error2 = new AuthenticationError('Second error');

      mockLogger.log(error1, { userId: '123' });
      mockLogger.log(error2);

      expect(mockLogger.getErrorCount()).toBe(2);
      expect(mockLogger.hasErrorWithMessage('First error')).toBe(true);
      expect(mockLogger.hasErrorWithCode('VALIDATION_ERROR')).toBe(true);

      const lastLog = mockLogger.getLastLog();
      expect(lastLog.error.message).toBe('Second error');
    });

    it('should clear logs properly', () => {
      mockLogger.log(new Error('Test error'));
      expect(mockLogger.getErrorCount()).toBe(1);

      mockLogger.clear();
      expect(mockLogger.getErrorCount()).toBe(0);
    });
  });

  describe('ErrorTestDataGenerator', () => {
    it('should generate invalid user data for validation testing', () => {
      const invalidData = ErrorTestDataGenerator.generateInvalidUserData();

      expect(invalidData).toHaveLength(5);
      expect(invalidData[0]).toHaveProperty('email', 'invalid-email');
      expect(invalidData[1]).toHaveProperty('email', '');
    });

    it('should generate API error responses for parsing tests', () => {
      const responses = ErrorTestDataGenerator.generateApiErrorResponses();

      expect(responses).toHaveLength(6);
      expect(responses[0]).toHaveProperty('error.code', 'VALIDATION_ERROR');
      expect(responses[1]).toHaveProperty('error.message', 'Something went wrong');
      expect(responses[2]).not.toHaveProperty('error');
    });
  });

  describe('ErrorAssertions', () => {
    it('should assert error properties correctly', () => {
      const error = new ValidationError('Test validation', { field: 'email' });

      expect(() => {
        ErrorAssertions.assertErrorMatches(error, {
          expectedCode: 'VALIDATION_ERROR',
          expectedStatusCode: 400,
          expectedMessage: 'Test validation',
          expectedDetails: { field: 'email' },
        });
      }).not.toThrow();
    });

    it('should assert error response structure', () => {
      const error = new AuthenticationError('Invalid token');
      const response = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
          details: {},
        },
      };

      expect(() => {
        ErrorAssertions.assertErrorResponse(response, error);
      }).not.toThrow();
    });
  });

  describe('Integration with Actual Error Utilities', () => {
    it('should work with serializeError', () => {
      const testCases = ErrorTestFactory.createStandardErrorCases();

      testCases.forEach((testCase) => {
        const serialized = serializeError(testCase.error);

        expect(serialized.code).toBe(testCase.expectedCode);
        expect(serialized.statusCode).toBe(testCase.expectedStatusCode);
        expect(serialized.message).toBe(testCase.error.message);
      });
    });

    it('should work with parseApiError', () => {
      const responses = ErrorTestDataGenerator.generateApiErrorResponses();

      responses.forEach((response) => {
        expect(() => {
          const parsed = parseApiError(response);
          expect(parsed).toHaveProperty('code');
          expect(parsed).toHaveProperty('message');
          expect(parsed).toHaveProperty('statusCode');
        }).not.toThrow();
      });
    });

    it('should work with getUserFriendlyMessage', () => {
      const testCases = ErrorTestFactory.createRealisticErrorScenarios();

      testCases.forEach((testCase) => {
        const friendlyMessage = getUserFriendlyMessage(testCase.error);
        expect(typeof friendlyMessage).toBe('string');
        expect(friendlyMessage.length).toBeGreaterThan(0);
      });
    });

    it('should work with isRetryableError', () => {
      const retryCases = ErrorTestFactory.createRealisticErrorScenarios();

      retryCases.forEach((testCase) => {
        const isRetryable = isRetryableError(testCase.error);
        expect(typeof isRetryable).toBe('boolean');

        // Rate limit and service unavailable should be retryable
        if (testCase.expectedStatusCode === 429 || testCase.expectedStatusCode === 503) {
          expect(isRetryable).toBe(true);
        }
      });
    });
  });

  describe('Cross-Package Pattern Verification', () => {
    it('should demonstrate proven shared utility patterns', () => {
      // Pattern 1: Factory-generated test data
      const testErrors = ErrorTestFactory.createStandardErrorCases();
      expect(testErrors.length).toBeGreaterThan(0);

      // Pattern 2: Mock logging with verification
      const mockLogger = new MockErrorLogger();
      const error = new ValidationError('Pattern test');
      mockLogger.log(error);
      expect(mockLogger.getErrorCount()).toBe(1);

      // Pattern 3: Assertion helpers for consistency
      expect(() => {
        ErrorAssertions.assertErrorMatches(error, {
          expectedCode: 'VALIDATION_ERROR',
          expectedStatusCode: 400,
        });
      }).not.toThrow();

      // Pattern 4: Integration with actual utilities
      const serialized = serializeError(error);
      expect(serialized.code).toBe('VALIDATION_ERROR');
    });
  });
});
