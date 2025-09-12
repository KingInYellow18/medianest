/**
 * Specialized utilities for testing React Error Boundaries
 * This addresses the challenge of testing error boundaries where errors are caught
 * by the boundary but still reported as test failures by the test framework
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react';

// Component that safely throws errors for testing ErrorBoundaries
export const SafeErrorThrower = ({
  shouldThrow = true,
  message = 'Test error message',
  children,
}: {
  shouldThrow?: boolean;
  message?: string;
  children?: React.ReactNode;
}) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <>{children || <div>No error thrown</div>}</>;
};

// Render function that properly handles ErrorBoundary testing
export const renderWithErrorBoundary = (
  ui: React.ReactElement,
  options?: RenderOptions & { suppressErrors?: boolean },
) => {
  const { suppressErrors = true, ...renderOptions } = options || {};

  let consoleErrorSpy: any = null;

  if (suppressErrors) {
    // Suppress console.error during rendering
    consoleErrorSpy = jest
      ? jest.spyOn(console, 'error').mockImplementation(() => {})
      : (() => {
          const originalError = console.error;
          console.error = () => {};
          return {
            mockRestore: () => {
              console.error = originalError;
            },
          };
        })();
  }

  try {
    return render(ui, renderOptions);
  } finally {
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  }
};

// Test wrapper that handles error boundary testing with proper cleanup
export const withErrorBoundaryTest = (testFn: () => void) => {
  const originalError = console.error;
  const originalWarn = console.warn;

  // Mock console methods to prevent error spam during tests
  console.error = () => {};
  console.warn = () => {};

  try {
    testFn();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
};

// Higher-order component for testing error boundaries
export const TestErrorBoundaryWrapper = ({
  children,
  onError,
  fallback,
}: {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  fallback?: (error: Error, errorInfo: any) => React.ReactNode;
}) => {
  return React.createElement('div', { 'data-testid': 'error-boundary-test-wrapper' }, children);
};
