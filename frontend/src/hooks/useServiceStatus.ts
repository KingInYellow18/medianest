'use client';

import { useEffect, useState } from 'react';

import { getApiConfig } from '@/config';
import { socketManager } from '@/lib/socket';
import { ServiceStatus } from '@/types/dashboard';

export function useServiceStatus(initialServices: ServiceStatus[]) {
  const [services, setServices] = useState<ServiceStatus[]>(initialServices);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to socket
    socketManager.connect();

    const handleConnectionStatus = (status: { connected: boolean }) => {
      setConnected(status.connected);
    };

    const handleServiceUpdate = (data: ServiceStatus) => {
      // Service status updated via socket
      setServices((prev) => {
        const existingService = prev.find((s) => s.id === data.id);
        if (existingService) {
          // Update existing service
          return prev.map((service) =>
            service.id === data.id
              ? {
                  ...data,
                  lastCheckAt: new Date(data.lastCheckAt),
                }
              : service
          );
        } else {
          // Add new service
          return [...prev, { ...data, lastCheckAt: new Date(data.lastCheckAt) }];
        }
      });
    };

    const handleBulkUpdate = (data: ServiceStatus[]) => {
      // Bulk service status update received
      setServices(
        data.map((service) => ({
          ...service,
          lastCheckAt: new Date(service.lastCheckAt),
        }))
      );
    };

    // Listen for events
    socketManager.on('connection:status', handleConnectionStatus);
    socketManager.on('service:status', handleServiceUpdate);
    socketManager.on('service:bulk-update', handleBulkUpdate);

    // Subscribe to updates when connected
    if (socketManager.isConnected()) {
      socketManager.emit('subscribe:status');
    }

    // Fetch services periodically as fallback
    const fetchServices = async () => {
      try {
        const { baseUrl } = getApiConfig();
        const response = await fetch(`${baseUrl}/dashboard/status`);
        if (response.ok) {
          const data = await response.json();
          const services = data.data.services.map((service: any) => ({
            ...service,
            displayName: service.displayName || service.name,
            uptime: service.uptime || {
              '24h': service.uptimePercentage || 0,
              '7d': service.uptimePercentage || 0,
              '30d': service.uptimePercentage || 0,
            },
            lastCheckAt: new Date(service.lastCheckAt),
          }));
          setServices(services);
        }
      } catch (error) {
        console.error('Failed to fetch services:', error);
      }
    };

    // Initial fetch
    fetchServices();

    // Fetch every 30 seconds as fallback
    const interval = setInterval(fetchServices, 30000);

    return () => {
      // Unsubscribe from updates
      if (socketManager.isConnected()) {
        socketManager.emit('unsubscribe:status');
      }

      // Remove event listeners
      socketManager.off('connection:status', handleConnectionStatus);
      socketManager.off('service:status', handleServiceUpdate);
      socketManager.off('service:bulk-update', handleBulkUpdate);

      clearInterval(interval);
    };
  }, []);

  return { services, connected };
}
