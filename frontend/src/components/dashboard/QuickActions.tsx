'use client';

import React from 'react';
import Link from 'next/link';
import { ServiceStatus } from '@/types/dashboard';

interface QuickActionsProps {
  service: ServiceStatus;
}

export function QuickActions({ service }: QuickActionsProps) {
  const getActionLink = (serviceName: string) => {
    switch (serviceName.toLowerCase()) {
      case 'plex':
        return '/media/browse';
      case 'overseerr':
        return '/media/search';
      case 'uptime kuma':
        return service.url || '#';
      default:
        return '#';
    }
  };

  const getActionText = (serviceName: string) => {
    switch (serviceName.toLowerCase()) {
      case 'plex':
        return 'Browse Library';
      case 'overseerr':
        return 'Request Media';
      case 'uptime kuma':
        return 'View Status';
      default:
        return 'Open Service';
    }
  };

  return (
    <div className="mt-4">
      <Link
        href={getActionLink(service.name)}
        className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
      >
        {getActionText(service.name)}
      </Link>
    </div>
  );
}