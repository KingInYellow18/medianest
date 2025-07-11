'use client';

interface AvailabilityBadgeProps {
  status: 'available' | 'partial' | 'requested' | 'processing' | 'unavailable';
}

export function AvailabilityBadge({ status }: AvailabilityBadgeProps) {
  const statusConfig = {
    available: {
      label: 'Available',
      className: 'bg-green-500/90 text-white',
    },
    partial: {
      label: 'Partial',
      className: 'bg-yellow-500/90 text-white',
    },
    requested: {
      label: 'Requested',
      className: 'bg-blue-500/90 text-white',
    },
    processing: {
      label: 'Processing',
      className: 'bg-purple-500/90 text-white',
    },
    unavailable: {
      label: 'Not Available',
      className: 'bg-gray-600/90 text-gray-200',
    },
  };

  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}