'use client';

import { ServiceUnavailableError, isAppError } from '@medianest/shared/client';
import React from 'react';

import { ErrorBoundary } from './ErrorBoundary';

interface ServiceErrorBoundaryProps {
  children: React.ReactNode;
  serviceName: string;
}

export function ServiceErrorBoundary({ children, serviceName }: ServiceErrorBoundaryProps) {
  const fallback = (
    <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div className="flex items-start space-x-3">
        <svg
          className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            {serviceName} Temporarily Unavailable
          </h3>
          <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            We're having trouble connecting to {serviceName}. The service may be down or undergoing
            maintenance.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm font-medium text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
          >
            Try again →
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      fallback={fallback}
      onError={(error) => {
        // Check if it's a service error
        if (isAppError(error) && error instanceof ServiceUnavailableError) {
          console.warn(`${serviceName} service error:`, error.message);
        }
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
