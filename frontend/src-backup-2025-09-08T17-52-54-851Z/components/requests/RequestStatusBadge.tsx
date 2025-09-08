'use client';

import clsx from 'clsx';
import { Clock, CheckCircle, XCircle, AlertCircle, Loader2, Download } from 'lucide-react';

import { RequestStatus } from '@/types/requests';

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-yellow-500 bg-yellow-500/10',
    label: 'Pending',
  },
  approved: {
    icon: CheckCircle,
    color: 'text-blue-500 bg-blue-500/10',
    label: 'Approved',
  },
  processing: {
    icon: Loader2,
    color: 'text-purple-500 bg-purple-500/10',
    label: 'Processing',
    animate: true,
  },
  'partially-available': {
    icon: Download,
    color: 'text-orange-500 bg-orange-500/10',
    label: 'Partial',
  },
  available: {
    icon: CheckCircle,
    color: 'text-green-500 bg-green-500/10',
    label: 'Available',
  },
  denied: {
    icon: XCircle,
    color: 'text-red-500 bg-red-500/10',
    label: 'Denied',
  },
  failed: {
    icon: AlertCircle,
    color: 'text-red-500 bg-red-500/10',
    label: 'Failed',
  },
};

interface RequestStatusBadgeProps {
  status: RequestStatus;
  showLabel?: boolean;
}

export function RequestStatusBadge({ status, showLabel = true }: RequestStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        config.color
      )}
    >
      <Icon
        className={clsx('w-3.5 h-3.5', {
          'animate-spin': 'animate' in config && config.animate,
        })}
      />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}
