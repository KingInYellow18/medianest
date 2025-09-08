'use client';

// Temporary fix for shared library - define AppError locally until module is built
class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

const isAppError = (error: any): error is AppError => error instanceof AppError;
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState, useEffect } from 'react';

import { initializeErrorLogger } from '@/lib/error-logger';

import { ErrorBoundary } from './ErrorBoundary';

// PERFORMANCE OPTIMIZATION: Dynamically import heavy components
// Temporarily disable WebSocket provider to fix build
const WebSocketProvider: React.ComponentType<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export function DynamicProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes - increase for better caching
            gcTime: 10 * 60 * 1000, // 10 minutes garbage collection time
            refetchOnWindowFocus: false,
            refetchOnReconnect: 'always',
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors
              if (isAppError(error) && error.statusCode >= 400 && error.statusCode < 500) {
                return false;
              }
              return failureCount < 3;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors
              if (isAppError(error) && error.statusCode >= 400 && error.statusCode < 500) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      })
  );

  useEffect(() => {
    // Initialize error logger
    initializeErrorLogger({
      enabled: process.env.NODE_ENV === 'production',
      sampleRate: 1.0,
    });
  }, []);

  return (
    <ErrorBoundary>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <WebSocketProvider>{children}</WebSocketProvider>
        </QueryClientProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
