'use client';

import React from 'react';
import { 
  EyeIcon, 
  EyeSlashIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';

interface MonitorVisibilityBulkActionsProps {
  selectedCount: number;
  onMakePublic: () => void;
  onMakeAdminOnly: () => void;
  onResetAll: () => void;
  disabled?: boolean;
}

export function MonitorVisibilityBulkActions({
  selectedCount,
  onMakePublic,
  onMakeAdminOnly,
  onResetAll,
  disabled = false,
}: MonitorVisibilityBulkActionsProps) {
  return (
    <div className="mt-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-4 py-3 rounded-md">
      <div className="flex items-center">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {selectedCount} monitor{selectedCount !== 1 ? 's' : ''} selected
        </span>
      </div>
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={onMakePublic}
          disabled={disabled}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <EyeIcon className="h-4 w-4 mr-1" />
          Make Public
        </button>
        <button
          type="button"
          onClick={onMakeAdminOnly}
          disabled={disabled}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <EyeSlashIcon className="h-4 w-4 mr-1" />
          Make Admin Only
        </button>
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
        <button
          type="button"
          onClick={onResetAll}
          disabled={disabled}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
          Reset All to Admin Only
        </button>
      </div>
    </div>
  );
}