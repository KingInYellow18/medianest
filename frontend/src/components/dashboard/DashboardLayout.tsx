'use client';

import React from 'react';
import { ServiceStatus } from '@/types/dashboard';
import { useServiceStatus } from '@/hooks/useServiceStatus';
import { ServiceCard } from './ServiceCard';
import { ConnectionStatus } from './ConnectionStatus';

interface DashboardLayoutProps {
  initialServices: ServiceStatus[];
  children?: React.ReactNode;
}

export function DashboardLayout({ initialServices, children }: DashboardLayoutProps) {
  const { services, connected } = useServiceStatus(initialServices);

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
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}