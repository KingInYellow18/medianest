'use client';

import React from 'react';

import { useRealtimeStatus } from '@/hooks/useRealtimeStatus';
import { useServiceStatus } from '@/hooks/useServiceStatus';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ServiceStatus, QuickAction } from '@/types/dashboard';

import { ConnectionStatus } from './ConnectionStatus';
import { ServiceCard } from './ServiceCard';
import { UpdateAnimation } from './UpdateAnimation';

interface DashboardLayoutProps {
  initialServices: ServiceStatus[];
  children?: React.ReactNode;
}

export function DashboardLayout({ initialServices, children }: DashboardLayoutProps) {
  const { services, connected } = useServiceStatus(initialServices);
  const { connectionError, reconnectAttempt, refreshService } = useWebSocket();

  // Enable real-time updates
  useRealtimeStatus();

  const handleViewDetails = (serviceId: string) => {
    // Handle service details view (TODO: implement modal/page)
    // TODO: Implement service details modal or navigation
  };

  const handleQuickAction = (action: QuickAction) => {
    // Handle quick action (TODO: implement action handlers)

    switch (action.type) {
      case 'navigate':
        // Handle navigation actions
        if (action.url) {
          window.location.href = action.url;
        }
        break;
      case 'configure':
        // Handle external service links
        if (action.url) {
          window.open(action.url, '_blank');
        }
        break;
      case 'refresh':
        // Handle refresh actions
        if (action.serviceId) {
          refreshService(action.serviceId);
        }
        break;
      default:
      // TODO: Handle unknown action type
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <ConnectionStatus
          connected={connected}
          error={connectionError}
          reconnectAttempt={reconnectAttempt}
        />

        {children}

        {services.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">Loading services...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {services.map((service) => (
              <UpdateAnimation key={service.id} serviceId={service.id}>
                <ServiceCard
                  service={service}
                  onViewDetails={handleViewDetails}
                  onQuickAction={handleQuickAction}
                />
              </UpdateAnimation>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
