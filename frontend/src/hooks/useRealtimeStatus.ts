'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketManager } from '@/lib/socket';
import { ServiceStatus } from '@/types/dashboard';

interface ServiceStatusUpdate {
  serviceId: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  timestamp: string;
  details?: Record<string, any>;
}

export function useRealtimeStatus() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleStatusUpdate = (update: ServiceStatusUpdate) => {
      // Update single service
      queryClient.setQueryData<ServiceStatus[]>(
        ['services', 'status'],
        (old) => {
          if (!old) return old;

          return old.map(service =>
            service.id === update.serviceId
              ? {
                  ...service,
                  status: update.status,
                  responseTime: update.responseTime,
                  lastCheckAt: new Date(update.timestamp),
                  details: update.details 
                    ? { ...service.details, ...update.details } 
                    : service.details
                }
              : service
          );
        }
      );

      // Set update data for animation trigger
      queryClient.setQueryData(['service-update', update.serviceId], update);

      // Clear animation trigger after 1 second
      setTimeout(() => {
        queryClient.removeQueries({ queryKey: ['service-update', update.serviceId] });
      }, 1000);
    };

    const handleBulkUpdate = (services: ServiceStatus[]) => {
      // Update all services at once
      const processedServices = services.map(service => ({
        ...service,
        lastCheckAt: new Date(service.lastCheckAt)
      }));
      
      queryClient.setQueryData(['services', 'status'], processedServices);
    };

    socketManager.on('service:status', handleStatusUpdate);
    socketManager.on('service:bulk-update', handleBulkUpdate);

    return () => {
      socketManager.off('service:status', handleStatusUpdate);
      socketManager.off('service:bulk-update', handleBulkUpdate);
    };
  }, [queryClient]);
}