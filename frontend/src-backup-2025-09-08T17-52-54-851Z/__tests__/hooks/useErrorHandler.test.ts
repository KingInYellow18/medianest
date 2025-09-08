import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a simple error handler hook for testing
const useErrorHandler = () => {
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleError = (err: Error) => {
    setError(err);
    setIsLoading(false);
    console.error('Error caught:', err);
  };

  const clearError = () => {
    setError(null);
  };

  const executeWithErrorHandling = async (fn: () => Promise<any>) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fn();
      setIsLoading(false);
      return result;
    } catch (err) {
      handleError(err as Error);
      throw err;
    }
  };

  return {
    error,
    isLoading,
    handleError,
    clearError,
    executeWithErrorHandling,
  };
};

import { useState } from 'react';

describe('useErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should initialize with no error and not loading', () => {
    const { result } = renderHook(() => useErrorHandler());

    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle error correctly', () => {
    const { result } = renderHook(() => useErrorHandler());
    const testError = new Error('Test error');

    act(() => {
      result.current.handleError(testError);
    });

    expect(result.current.error).toBe(testError);
    expect(console.error).toHaveBeenCalledWith('Error caught:', testError);
  });

  it('should clear error', () => {
    const { result } = renderHook(() => useErrorHandler());
    const testError = new Error('Test error');

    act(() => {
      result.current.handleError(testError);
    });

    expect(result.current.error).toBe(testError);

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should handle successful async execution', async () => {
    const { result } = renderHook(() => useErrorHandler());
    const mockFn = vi.fn().mockResolvedValue('success');

    let executionResult;
    await act(async () => {
      executionResult = await result.current.executeWithErrorHandling(mockFn);
    });

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(executionResult).toBe('success');
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle async execution with error', async () => {
    const { result } = renderHook(() => useErrorHandler());
    const testError = new Error('Async error');
    const mockFn = vi.fn().mockRejectedValue(testError);

    await act(async () => {
      try {
        await result.current.executeWithErrorHandling(mockFn);
      } catch (err) {
        // Expected to throw
      }
    });

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe(testError);
    expect(result.current.isLoading).toBe(false);
  });

  it('should set loading state during execution', async () => {
    const { result } = renderHook(() => useErrorHandler());
    let resolvePromise: (value: string) => void;
    const mockFn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolvePromise = resolve;
        })
    );

    act(() => {
      result.current.executeWithErrorHandling(mockFn);
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolvePromise!('resolved');
      // Wait for promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should clear previous error when starting new execution', async () => {
    const { result } = renderHook(() => useErrorHandler());
    const firstError = new Error('First error');

    // Set initial error
    act(() => {
      result.current.handleError(firstError);
    });

    expect(result.current.error).toBe(firstError);

    // Execute new operation
    const mockFn = vi.fn().mockResolvedValue('success');
    await act(async () => {
      await result.current.executeWithErrorHandling(mockFn);
    });

    expect(result.current.error).toBeNull();
  });

  it('should handle different error types', () => {
    const { result } = renderHook(() => useErrorHandler());

    // Test with custom error
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }

    const customError = new CustomError('Custom error message');

    act(() => {
      result.current.handleError(customError);
    });

    expect(result.current.error).toBe(customError);
    expect(result.current.error?.name).toBe('CustomError');
    expect(result.current.error?.message).toBe('Custom error message');
  });

  it('should provide consistent API', () => {
    const { result } = renderHook(() => useErrorHandler());

    expect(typeof result.current.handleError).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
    expect(typeof result.current.executeWithErrorHandling).toBe('function');
    expect(typeof result.current.error).toBe('object');
    expect(typeof result.current.isLoading).toBe('boolean');
  });

  it('should handle multiple errors sequentially', () => {
    const { result } = renderHook(() => useErrorHandler());

    const error1 = new Error('Error 1');
    const error2 = new Error('Error 2');

    act(() => {
      result.current.handleError(error1);
    });

    expect(result.current.error).toBe(error1);

    act(() => {
      result.current.handleError(error2);
    });

    expect(result.current.error).toBe(error2);
  });
});
