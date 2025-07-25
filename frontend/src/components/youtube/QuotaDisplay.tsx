'use client';

import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { RefreshCw, AlertCircle } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import type { UserQuota } from '@/types/youtube';

interface QuotaDisplayProps {
  quota: UserQuota;
  onRefresh: () => void;
}

export function QuotaDisplay({ quota, onRefresh }: QuotaDisplayProps) {
  const percentage = (quota.used / quota.limit) * 100;
  const remaining = quota.limit - quota.used;

  return (
    <div
      className={clsx(
        'rounded-lg p-4',
        quota.canDownload ? 'bg-gray-700' : 'bg-red-900/20 border border-red-800',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          {!quota.canDownload && <AlertCircle className="w-4 h-4 text-red-500" />}
          Download Quota
        </h3>
        <button
          onClick={onRefresh}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Refresh quota"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <Progress value={percentage} className="mb-2" />

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">
          {quota.used} / {quota.limit} downloads used
        </span>
        {!quota.canDownload && (
          <span className="text-red-400">
            Resets {formatDistanceToNow(quota.resetAt, { addSuffix: true })}
          </span>
        )}
      </div>

      {quota.canDownload ? (
        <p className="text-xs text-gray-500 mt-2">
          {remaining} download{remaining !== 1 ? 's' : ''} remaining
        </p>
      ) : (
        <p className="text-xs text-red-400 mt-2">Quota exceeded. Please wait for reset.</p>
      )}
    </div>
  );
}
