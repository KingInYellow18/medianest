'use client';

import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { initializeErrorLogger } from '@/lib/error-logger';
import { AppError } from '@medianest/shared/client';

// PERFORMANCE OPTIMIZATION: Dynamically import heavy components
const WebSocketProvider = dynamic(
  () => import('@/contexts/WebSocketContext').then((mod) => ({ default: mod.WebSocketProvider })),
  {
    ssr: false,
    loading: () => null, // No loading state for context providers
  }
);

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
              if (error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500) {
                return false;
              }
              return failureCount < 3;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors
              if (error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500) {
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
