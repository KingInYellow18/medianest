/**
 * Utility for testing React Error Boundaries with Vitest
 *
 * This provides a clean way to test error boundaries by temporarily
 * suppressing React's error logging during error boundary tests.
 */

// Store original console.error function
const originalError = console.error;

export const suppressReactErrorLogs = (callback: () => void) => {
  // Temporarily suppress console.error to prevent React error logs during tests
  console.error = () => {};

  try {
    callback();
  } finally {
    // Restore original console.error
    console.error = originalError;
  }
};

export const withErrorBoundarySuppression = (testFn: () => void | Promise<void>) => {
  return () => {
    console.error = () => {};
    try {
      return testFn();
    } finally {
      console.error = originalError;
    }
  };
};
