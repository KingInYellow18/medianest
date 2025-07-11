'use client';

import React from 'react';

interface ConnectionStatusProps {
  connected: boolean;
}

export function ConnectionStatus({ connected }: ConnectionStatusProps) {
  if (connected) {
    return null; // Don't show anything when connected
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-600 text-white px-4 py-2 text-center text-sm">
      <div className="flex items-center justify-center space-x-2">
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span>Reconnecting to live updates...</span>
      </div>
    </div>
  );
}