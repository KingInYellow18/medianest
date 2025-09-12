/**
 * Error Boundary Testing Helpers
 *
 * This module provides utilities to properly test React Error Boundaries
 * with Vitest, addressing the challenge where React errors are caught by
 * the testing framework before Error Boundaries can handle them.
 */

import { render, RenderOptions } from '@testing-library/react';
import React from 'react';

// Spy to track if error boundaries are working
const errorBoundaryTestSpy: any = null;

// Configure error boundary testing environment
export const configureErrorBoundaryTesting = () => {
  // Store original console.error
  const originalConsoleError = console.error;

  // Create custom error handler that doesn't interfere with Error Boundary tests
  console.error = (...args: any[]) => {
    const message = args[0];
    if (typeof message === 'string') {
      // Known error messages that should be handled by ErrorBoundary
      const errorBoundaryMessages = [
        'Test error message',
        'Stack trace test',
        'Callback test error',
        'First error',
        'Custom fallback test',
        'Fallback info test',
        'Original error',
        'Retry test error',
        'Retry functionality test',
        'Timeout test error',
        'Accessibility test',
        'Button accessibility test',
        'Keyboard test',
        'Screen reader test',
        'Deep nested error',
        'Development logging test',
        'Production logging test',
        'HOC error test',
        'Wrapped component error',
        'Error with <script>',
        'very long error message',
      ];

      // If this is an expected error boundary test error, suppress it
      if (errorBoundaryMessages.some((msg) => message.includes(msg))) {
        return;
      }

      // Also suppress React's error boundary warnings
      if (
        message.includes('Error boundaries should implement getDerivedStateFromError') ||
        message.includes('componentDidCatch') ||
        message.includes('The above error occurred in the')
      ) {
        return;
      }
    }

    // For other errors, use original console.error
    originalConsoleError(...args);
  };

  return originalConsoleError;
};

// Restore original console.error
export const restoreErrorBoundaryTesting = (originalConsoleError: any) => {
  console.error = originalConsoleError;
};

// Render function optimized for error boundary testing
export const renderWithErrorBoundarySupport = (ui: React.ReactElement, options?: RenderOptions) => {
  const originalConsoleError = configureErrorBoundaryTesting();

  try {
    return render(ui, options);
  } finally {
    // Don't restore immediately - let the test complete first
    // This allows assertions to run without console spam
    setTimeout(() => restoreErrorBoundaryTesting(originalConsoleError), 0);
  }
};

// Test helper that wraps test functions with proper error boundary setup
export const withErrorBoundarySupport = (testFn: () => void | Promise<void>) => {
  return async () => {
    const originalConsoleError = configureErrorBoundaryTesting();

    try {
      await testFn();
    } finally {
      restoreErrorBoundaryTesting(originalConsoleError);
    }
  };
};

// Error throwing component for consistent testing
export const TestErrorComponent = ({
  message = 'Test error',
  shouldThrow = true,
}: {
  message?: string;
  shouldThrow?: boolean;
}) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div data-testid='no-error'>No error thrown</div>;
};
