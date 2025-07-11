'use client';

import React from 'react';
import { ServiceStatus } from '@/types/dashboard';
import { StatusIndicator } from './StatusIndicator';
import { QuickActions } from './QuickActions';
import { formatDistanceToNow } from 'date-fns';

interface ServiceCardProps {
  service: ServiceStatus;
  onQuickAction?: () => void;
}

export function ServiceCard({ service, onQuickAction }: ServiceCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{service.name}</h3>
        <StatusIndicator status={service.status} />
      </div>
      
      <div className="space-y-2 text-sm text-gray-400">
        {service.responseTime !== undefined && (
          <p>Response: {service.responseTime}ms</p>
        )}
        <p>Uptime: {service.uptimePercentage.toFixed(1)}%</p>
        <p>
          Last check: {formatDistanceToNow(service.lastCheckAt, { addSuffix: true })}
        </p>
      </div>
      
      {service.features?.includes('disabled') && (
        <div className="mt-4 p-2 bg-yellow-900/20 rounded text-yellow-500 text-sm">
          Service temporarily unavailable
        </div>
      )}
      
      {service.url && !service.features?.includes('disabled') && (
        <QuickActions service={service} />
      )}
    </div>
  );
}