/**
 * Custom Render Utilities for React Testing Library
 * Provides enhanced testing utilities with providers and helpers
 */

import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';

// Mock Error Boundary Provider for testing error states
export const TestErrorBoundaryProvider = ({
  children,
  shouldError = false,
}: {
  children: ReactNode;
  shouldError?: boolean;
}) => {
  if (shouldError) {
    throw new Error('Test Error Boundary Trigger');
  }
  return <>{children}</>;
};

// Custom render function with providers
const AllTheProviders = ({ children }: { children: ReactNode }) => {
  return <div data-testid='test-wrapper'>{children}</div>;
};

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
  const user = userEvent.setup();

  return {
    user,
    ...render(ui, { wrapper: AllTheProviders, ...options }),
  };
};

// Component that throws an error for testing ErrorBoundary
export const ThrowError = ({
  shouldThrow = true,
  message = 'Test error message',
}: {
  shouldThrow?: boolean;
  message?: string;
}) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div>No error thrown</div>;
};

// Component that throws async error
export const ThrowAsyncError = ({
  shouldThrow = true,
  message = 'Async test error',
  delay = 0,
}: {
  shouldThrow?: boolean;
  message?: string;
  delay?: number;
}) => {
  React.useEffect(() => {
    if (shouldThrow) {
      setTimeout(() => {
        throw new Error(message);
      }, delay);
    }
  }, [shouldThrow, message, delay]);

  return <div>Async component</div>;
};

// Test data generators with unique IDs
let serviceCounter = 0;
export const createMockService = (overrides: Record<string, any> = {}) => {
  serviceCounter++;
  return {
    id: `test-service-${serviceCounter}` as any,
    name: 'Test Service',
    status: 'active' as const,
    lastChecked: new Date('2025-01-12T10:00:00Z'),
    uptime: 0.995,
    responseTime: 150,
    errorCount: 2,
    ...overrides,
  };
};

export const createMockServiceWithError = () =>
  createMockService({
    status: 'error',
    errorCount: 5,
    uptime: 0.85,
    responseTime: undefined,
  });

export const createMockServiceInactive = () =>
  createMockService({
    status: 'inactive',
    uptime: 0.0,
    responseTime: undefined,
    errorCount: 0,
  });

// Accessibility testing utilities
export const axeMatchers = {
  toHaveNoViolations: expect.extend({
    toHaveNoViolations(received) {
      const pass = received.violations.length === 0;
      if (pass) {
        return {
          message: () => 'Expected accessibility violations, but none were found',
          pass: true,
        };
      } else {
        return {
          message: () =>
            `Expected no accessibility violations, but found:\n${received.violations
              .map((v: any) => `- ${v.description}`)
              .join('\n')}`,
          pass: false,
        };
      }
    },
  }),
};

// Performance testing utilities
export const measureRenderTime = async (renderFn: () => void) => {
  const start = performance.now();
  renderFn();
  const end = performance.now();
  return end - start;
};

// Error boundary testing utilities
export const suppressErrorOutput = (testFn: () => void) => {
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};

  try {
    testFn();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
};

// Mock ErrorBoundary that doesn't interfere with testing
export const MockErrorBoundary = ({
  children,
  onError,
  fallback,
}: {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  fallback?: (error: Error, errorInfo: any) => React.ReactNode;
}) => {
  return <React.Suspense fallback={<div>Loading...</div>}>{children}</React.Suspense>;
};

// Test helper that wraps components for error testing
export const renderWithErrorHandling = (ui: ReactElement, options?: RenderOptions) => {
  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;

  // Suppress React error logging during tests
  console.error = () => {};
  console.warn = () => {};

  try {
    return render(ui, options);
  } finally {
    // Restore console methods
    console.error = originalError;
    console.warn = originalWarn;
  }
};

// Test helper for error boundary testing with proper error catching
export const renderWithErrorBoundary = (ui: ReactElement, options?: RenderOptions) => {
  // Temporarily suppress React's error logging
  const originalConsoleError = console.error;
  console.error = () => {};

  const result = render(ui, options);

  // Restore console.error after render
  console.error = originalConsoleError;

  return result;
};

export * from '@testing-library/react';
export { customRender as render };
