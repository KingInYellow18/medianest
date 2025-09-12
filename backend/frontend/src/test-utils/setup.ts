/**
 * React Testing Library Setup for MediaNest Frontend
 * Configures Vitest environment for React component testing
 */

import { cleanup } from '@testing-library/react';
import { beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { configureErrorBoundaryTesting, restoreErrorBoundaryTesting } from './errorBoundaryHelpers';

// Store original console methods
let originalConsoleError: any = null;

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();

  // Restore original console.error if it was modified for error boundary tests
  if (originalConsoleError) {
    restoreErrorBoundaryTesting(originalConsoleError);
    originalConsoleError = null;
  }
});

// Setup globals for testing
beforeEach(() => {
  // Don't mock console methods globally - let individual tests handle this
  // This is important for ErrorBoundary tests that need to check console calls

  // Configure error boundary testing support
  originalConsoleError = configureErrorBoundaryTesting();
});

// Mock environment variables
process.env.NODE_ENV = 'test';

// Setup fake timers by default
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

// Global test utilities
declare global {
  var __TEST_ENV__: true;
}

globalThis.__TEST_ENV__ = true;
