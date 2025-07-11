'use client';

import React from 'react';
import clsx from 'clsx';

interface StatusIndicatorProps {
  status: 'up' | 'down' | 'degraded';
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  return (
    <div className="flex items-center space-x-2">
      <div
        className={clsx(
          'w-3 h-3 rounded-full animate-pulse',
          {
            'bg-green-500': status === 'up',
            'bg-red-500': status === 'down',
            'bg-yellow-500': status === 'degraded',
          }
        )}
        role="status"
        aria-label={`Service status: ${status}`}
      />
      <span
        className={clsx(
          'text-xs font-medium uppercase',
          {
            'text-green-500': status === 'up',
            'text-red-500': status === 'down',
            'text-yellow-500': status === 'degraded',
          }
        )}
      >
        {status}
      </span>
    </div>
  );
}