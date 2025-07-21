'use client';

import React from 'react';
import { Switch } from '@headlessui/react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface MonitorVisibilityToggleProps {
  monitorId: number;
  isPublic: boolean;
  onChange: (monitorId: number, isPublic: boolean) => void;
  disabled?: boolean;
  showLabel?: boolean;
}

export function MonitorVisibilityToggle({
  monitorId,
  isPublic,
  onChange,
  disabled = false,
  showLabel = false,
}: MonitorVisibilityToggleProps) {
  const handleChange = (checked: boolean) => {
    onChange(monitorId, checked);
  };

  return (
    <div className="flex items-center">
      <Switch
        checked={isPublic}
        onChange={handleChange}
        disabled={disabled}
        className={clsx(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
          isPublic ? 'bg-green-600' : 'bg-yellow-600',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="sr-only">
          {isPublic ? 'Make admin-only' : 'Make public'}
        </span>
        <span
          className={clsx(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            isPublic ? 'translate-x-6' : 'translate-x-1'
          )}
        >
          {isPublic ? (
            <EyeIcon className="h-3 w-3 text-green-600 m-0.5" />
          ) : (
            <EyeSlashIcon className="h-3 w-3 text-yellow-600 m-0.5" />
          )}
        </span>
      </Switch>
      {showLabel && (
        <span className="ml-3 text-sm">
          <span className="font-medium text-gray-900 dark:text-white">
            {isPublic ? 'Public' : 'Admin Only'}
          </span>
        </span>
      )}
    </div>
  );
}