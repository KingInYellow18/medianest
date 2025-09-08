'use client';

import {
  AppError,
  AuthenticationError,
  RateLimitError,
  getUserFriendlyMessage,
  logError,
  isRetryableError,
} from '@medianest/shared/client';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

interface ErrorHandlerOptions {
  onAuthError?: () => void;
  onRateLimitError?: (retryAfter?: number) => void;
  showToast?: boolean;
  retryable?: boolean;
}

export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const router = useRouter();
  const [error, setError] = useState<Error | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleError = useCallback(
    (error: Error | AppError, context?: any) => {
      // Log the error
      logError(error, context);

      // Handle specific error types
      if (error instanceof AuthenticationError) {
        if (options.onAuthError) {
          options.onAuthError();
        } else {
          // Default: redirect to sign in
          router.push('/auth/signin');
        }
        return;
      }

      if (error instanceof RateLimitError) {
        if (options.onRateLimitError) {
          options.onRateLimitError(error.details?.retryAfter);
        }
      }

      // Set error state for UI display
      setError(error);

      // Show toast notification if enabled
      if (options.showToast && typeof window !== 'undefined') {
        // You can integrate with your toast library here
        const message = getUserFriendlyMessage(error);
        console.error('[Toast]', message);
      }
    },
    [router, options]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const retry = useCallback(
    async (fn: () => Promise<any>) => {
      if (!error || !isRetryableError(error) || isRetrying) {
        return;
      }

      setIsRetrying(true);
      clearError();

      try {
        await fn();
      } catch (retryError) {
        handleError(retryError as Error);
      } finally {
        setIsRetrying(false);
      }
    },
    [error, isRetrying, clearError, handleError]
  );

  return {
    error,
    isRetrying,
    handleError,
    clearError,
    retry,
    errorMessage: error ? getUserFriendlyMessage(error) : null,
  };
}

// Hook for async operations with error handling
export function useAsyncError() {
  const { handleError } = useErrorHandler();

  return useCallback(
    (error: Error) => {
      handleError(error);
    },
    [handleError]
  );
}
