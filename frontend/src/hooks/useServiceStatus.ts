'use client';

import { useEffect, useState } from 'react';
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
      console.log('Service status update:', data);
      setServices(prev => {
        const existingService = prev.find(s => s.id === data.id);
        if (existingService) {
          // Update existing service
          return prev.map(service => 
            service.id === data.id 
              ? { 
                  ...data,
                  lastCheckAt: new Date(data.lastCheckAt)
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
      console.log('Bulk service update:', data);
      setServices(data.map(service => ({
        ...service,
        lastCheckAt: new Date(service.lastCheckAt)
      })));
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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
        const response = await fetch(`${apiUrl}/dashboard/status`);
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