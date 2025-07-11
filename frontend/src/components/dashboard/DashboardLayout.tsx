'use client';

import React from 'react';
import { ServiceStatus, QuickAction } from '@/types/dashboard';
import { useServiceStatus } from '@/hooks/useServiceStatus';
import { ServiceCard } from './ServiceCard';
import { ConnectionStatus } from './ConnectionStatus';

interface DashboardLayoutProps {
  initialServices: ServiceStatus[];
  children?: React.ReactNode;
}

export function DashboardLayout({ initialServices, children }: DashboardLayoutProps) {
  const { services, connected } = useServiceStatus(initialServices);

  const handleViewDetails = (serviceId: string) => {
    console.log('View details for service:', serviceId);
    // TODO: Implement service details modal or navigation
  };

  const handleQuickAction = (action: QuickAction) => {
    console.log('Quick action:', action);
    
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
        // TODO: Implement service refresh functionality
        break;
      default:
        console.log('Unknown action type:', action.type);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <ConnectionStatus connected={connected} />
        
        {children}
        
        {services.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">Loading services...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {services.map((service) => (
              <ServiceCard 
                key={service.id} 
                service={service}
                onViewDetails={handleViewDetails}
                onQuickAction={handleQuickAction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}