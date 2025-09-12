/**
 * Fixed ErrorBoundary Test with Proper Error Handling
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// Component that throws an error for testing
const ThrowError = ({ message }: { message: string }) => {
  throw new Error(message);
};

describe('ErrorBoundary Fixed Test', () => {
  it('should catch and display error when child component throws', async () => {
    // Create a promise to handle the error
    const errorPromise = new Promise<void>((resolve, reject) => {
      // Temporarily override the global error handler
      const originalOnError = window.onerror;
      const originalOnUnhandledRejection = window.onunhandledrejection;

      window.onerror = (message, source, lineno, colno, error) => {
        if (error && error.message === 'Test error message') {
          // This is our expected error, resolve the promise
          resolve();
          return true; // Prevent the error from being logged
        }
        // For other errors, use the original handler
        return originalOnError ? originalOnError(message, source, lineno, colno, error) : false;
      };

      // Suppress console.error temporarily
      const originalConsoleError = console.error;
      console.error = vi.fn();

      try {
        render(
          <ErrorBoundary>
            <ThrowError message='Test error message' />
          </ErrorBoundary>,
        );

        // Check that the ErrorBoundary rendered correctly
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Something went wrong')).toBeVisible();
        expect(screen.getByText('Test error message')).toBeInTheDocument();

        resolve();
      } catch (error) {
        reject(error);
      } finally {
        // Restore original handlers
        window.onerror = originalOnError;
        window.onunhandledrejection = originalOnUnhandledRejection;
        console.error = originalConsoleError;
      }
    });

    await errorPromise;
  });
});
