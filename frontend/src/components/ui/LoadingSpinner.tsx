import React from 'react';
import clsx from 'clsx';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={clsx('relative', className)}>
      <div
        className={clsx(
          'animate-spin rounded-full border-b-2 border-t-2 border-indigo-600',
          sizeClasses[size],
        )}
      />
    </div>
  );
}
