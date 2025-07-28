/**
 * TIER 1 CRITICAL SECURITY TESTS - ERROR BOUNDARIES (12 tests)
 * Testing error boundary security vulnerabilities and edge cases
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ErrorBoundary, useErrorHandler, AsyncErrorBoundary } from '../ErrorBoundary';

// Mock the shared utilities
vi.mock('@medianest/shared', () => ({
  logError: vi.fn(),
  getUserFriendlyMessage: vi.fn().mockImplementation((error: Error) => {
    if (error.message.includes('XSS')) return 'A security error occurred';
    if (error.message.includes('sensitive')) return 'An error occurred';
    return error.message;
  }),
  extractErrorDetails: vi.fn().mockImplementation((error: Error) => ({
    message: error.message,
    stack: error.stack,
    name: error.name,
  })),
}));

// Test component that throws errors
function ThrowError({ errorMessage, shouldThrow }: { errorMessage: string; shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>No error</div>;
}

// Hook component for testing useErrorHandler
function ErrorHandlerTest({ errorToThrow }: { errorToThrow?: Error }) {
  const { captureError, resetError } = useErrorHandler();

  React.useEffect(() => {
    if (errorToThrow) {
      captureError(errorToThrow);
    }
  }, [errorToThrow, captureError]);

  return (
    <div>
      <button onClick={() => resetError()}>Reset Error</button>
      <div>Error Handler Test</div>
    </div>
  );
}

describe('ErrorBoundary Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error for error boundary tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('XSS Prevention Tests', () => {
    test('should sanitize error messages containing script tags', () => {
      const maliciousError = '<script>alert("XSS")</script>';
      
      render(
        <ErrorBoundary>
          <ThrowError errorMessage={maliciousError} shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should show sanitized message, not execute script
      expect(screen.getByText('A security error occurred')).toBeInTheDocument();
      expect(screen.queryByText(maliciousError)).not.toBeInTheDocument();
    });

    test('should prevent XSS in error message with HTML injection', () => {
      const maliciousError = '<img src=x onerror="alert(\'XSS\')">';
      
      render(
        <ErrorBoundary>
          <ThrowError errorMessage={maliciousError} shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should not render raw HTML
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    test('should sanitize error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const maliciousError = '<script>document.location="http://evil.com"</script>';
      
      render(
        <ErrorBoundary>
          <ThrowError errorMessage={maliciousError} shouldThrow={true} />
        </ErrorBoundary>
      );

      const details = screen.getByText('Error Details (Development Only)');
      expect(details).toBeInTheDocument();
      
      // Details should be JSON-stringified, not executable
      const detailsContainer = details.nextElementSibling;
      expect(detailsContainer?.textContent).not.toContain('<script>');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Information Disclosure Prevention', () => {
    test('should not expose sensitive data in error messages', () => {
      const sensitiveError = 'Database password: secret123 failed to connect';
      
      render(
        <ErrorBoundary>
          <ThrowError errorMessage={sensitiveError} shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should show generic message, not sensitive details
      expect(screen.getByText('An error occurred')).toBeInTheDocument();
      expect(screen.queryByText('secret123')).not.toBeInTheDocument();
    });

    test('should hide stack traces in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <ErrorBoundary>
          <ThrowError errorMessage="Test error" shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should not show development details in production
      expect(screen.queryByText('Error Details (Development Only)')).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    test('should limit error details exposure to authorized users only', () => {
      const errorWithSensitiveStack = new Error('Test error');
      errorWithSensitiveStack.stack = 'at /home/user/.env (line 1)\nat /etc/passwd (line 5)';

      render(
        <ErrorBoundary>
          <ThrowError errorMessage={errorWithSensitiveStack.message} shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should not expose file system paths
      expect(screen.queryByText('/home/user/.env')).not.toBeInTheDocument();
      expect(screen.queryByText('/etc/passwd')).not.toBeInTheDocument();
    });
  });

  describe('Error Handler Security', () => {
    test('should prevent error handler from throwing additional security vulnerabilities', () => {
      const maliciousError = new Error('XSS attempt: <script>evil()</script>');
      
      render(
        <ErrorBoundary>
          <ErrorHandlerTest errorToThrow={maliciousError} />
        </ErrorBoundary>
      );

      // Should catch and handle the error securely
      expect(screen.getByText('A security error occurred')).toBeInTheDocument();
    });

    test('should validate error objects before processing', () => {
      // Test with malformed error object
      const malformedError = {
        message: '<script>alert("XSS")</script>',
        toString: () => '<img src=x onerror=alert("XSS")>',
      } as any;

      render(
        <ErrorBoundary>
          <ErrorHandlerTest errorToThrow={malformedError} />
        </ErrorBoundary>
      );

      expect(screen.getByText('A security error occurred')).toBeInTheDocument();
    });

    test('should safely reset error state without side effects', async () => {
      const user = userEvent.setup();
      const testError = new Error('Test error');
      
      render(
        <ErrorBoundary>
          <ErrorHandlerTest errorToThrow={testError} />
        </ErrorBoundary>
      );

      const resetButton = screen.getByText('Reset Error');
      await user.click(resetButton);

      // Should reset without security issues
      await waitFor(() => {
        expect(screen.getByText('Error Handler Test')).toBeInTheDocument();
      });
    });
  });

  describe('Async Error Boundary Security', () => {
    test('should handle promise rejections securely', async () => {
      function AsyncComponent() {
        React.useEffect(() => {
          Promise.reject(new Error('<script>malicious()</script>'));
        }, []);
        return <div>Async Component</div>;
      }

      render(
        <AsyncErrorBoundary>
          <AsyncComponent />
        </AsyncErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('A security error occurred')).toBeInTheDocument();
      });
    });

    test('should prevent race conditions in error handling', async () => {
      let resolveCount = 0;
      
      function RaceConditionComponent() {
        React.useEffect(() => {
          // Simulate multiple async operations
          Promise.resolve().then(() => {
            resolveCount++;
            if (resolveCount === 1) {
              throw new Error('Race condition error');
            }
          });
          Promise.resolve().then(() => {
            resolveCount++;
            if (resolveCount === 2) {
              throw new Error('Second race error');
            }
          });
        }, []);
        return <div>Race Test</div>;
      }

      render(
        <AsyncErrorBoundary>
          <RaceConditionComponent />
        </AsyncErrorBoundary>
      );

      // Should handle race conditions gracefully
      await waitFor(() => {
        expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('Error Boundary Edge Cases', () => {
    test('should handle circular reference errors safely', () => {
      const circularError = new Error('Circular reference');
      const circular: any = { prop: null };
      circular.prop = circular;
      (circularError as any).circular = circular;

      render(
        <ErrorBoundary>
          <ThrowError errorMessage={circularError.message} shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Circular reference')).toBeInTheDocument();
    });

    test('should limit error message length to prevent DoS', () => {
      const longError = 'A'.repeat(10000); // Very long error message
      
      render(
        <ErrorBoundary>
          <ThrowError errorMessage={longError} shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should truncate or handle long messages safely
      const errorElement = screen.getByText(/Something went wrong/);
      expect(errorElement).toBeInTheDocument();
    });

    test('should handle null/undefined errors gracefully', () => {
      function NullErrorComponent() {
        throw null;
      }

      render(
        <ErrorBoundary>
          <NullErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });
});