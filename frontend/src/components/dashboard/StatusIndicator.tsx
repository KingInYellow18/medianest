'use client';

import clsx from 'clsx';
import React from 'react';

interface StatusIndicatorProps {
  status: 'up' | 'down' | 'degraded';
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function StatusIndicator({
  status,
  pulse = false,
  size = 'md',
  showText = true,
}: StatusIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const statusClasses = {
    up: 'bg-green-500',
    down: 'bg-red-500',
    degraded: 'bg-yellow-500',
  };

  const textClasses = {
    up: 'text-green-400',
    down: 'text-red-400',
    degraded: 'text-yellow-400',
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="relative">
        <div
          className={clsx('rounded-full', sizeClasses[size], statusClasses[status], {
            'animate-pulse': pulse && status === 'up',
          })}
          role="status"
          aria-label={`Service status: ${status}`}
        />
        {pulse && status === 'up' && (
          <div
            className={clsx(
              'absolute inset-0 rounded-full animate-ping',
              statusClasses[status],
              'opacity-75',
            )}
          />
        )}
      </div>
      {showText && (
        <span className={clsx('text-xs font-medium uppercase tracking-wide', textClasses[status])}>
          {status}
        </span>
      )}
    </div>
  );
}
