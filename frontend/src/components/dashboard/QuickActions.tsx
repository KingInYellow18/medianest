'use client';

import React from 'react';

import { ServiceStatus, QuickAction } from '@/types/dashboard';

interface QuickActionsProps {
  service: ServiceStatus;
  onQuickAction?: (action: QuickAction) => void;
}

export function QuickActions({ service, onQuickAction }: QuickActionsProps) {
  const getQuickActions = (service: ServiceStatus): QuickAction[] => {
    const actions: QuickAction[] = [];

    switch (service.name) {
      case 'Plex':
        actions.push({
          type: 'navigate',
          serviceId: service.id,
          url: '/media/browse',
        });
        if (service.url) {
          actions.push({
            type: 'configure',
            serviceId: service.id,
            url: service.url,
          });
        }
        break;
      case 'Overseerr':
        actions.push({
          type: 'navigate',
          serviceId: service.id,
          url: '/media/search',
        });
        if (service.url) {
          actions.push({
            type: 'configure',
            serviceId: service.id,
            url: service.url,
          });
        }
        break;
      case 'Uptime Kuma':
        if (service.url) {
          actions.push({
            type: 'configure',
            serviceId: service.id,
            url: service.url,
          });
        }
        actions.push({
          type: 'refresh',
          serviceId: service.id,
        });
        break;
      default:
        if (service.url) {
          actions.push({
            type: 'configure',
            serviceId: service.id,
            url: service.url,
          });
        }
    }

    return actions;
  };

  const getActionText = (action: QuickAction) => {
    switch (action.type) {
      case 'navigate':
        switch (service.name) {
          case 'Plex':
            return 'Browse Library';
          case 'Overseerr':
            return 'Request Media';
          default:
            return 'Open';
        }
      case 'configure':
        return 'Open Service';
      case 'refresh':
        return 'Refresh Status';
      default:
        return 'Action';
    }
  };

  const getActionIcon = (action: QuickAction) => {
    switch (action.type) {
      case 'navigate':
        return '🔍';
      case 'configure':
        return '🔗';
      case 'refresh':
        return '🔄';
      default:
        return '⚡';
    }
  };

  const handleActionClick = (action: QuickAction) => {
    if (onQuickAction) {
      onQuickAction(action);
    } else if (action.url) {
      // Fallback: open URL directly
      window.open(action.url, '_blank');
    }
  };

  const actions = getQuickActions(service);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2">
      {actions.map((action, index) => (
        <button
          key={`${action.type}-${index}`}
          onClick={() => handleActionClick(action)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <span>{getActionIcon(action)}</span>
          <span>{getActionText(action)}</span>
        </button>
      ))}
    </div>
  );
}
