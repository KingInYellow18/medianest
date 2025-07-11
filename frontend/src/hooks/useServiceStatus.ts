'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';
import { ServiceStatus } from '@/types/dashboard';

export function useServiceStatus(initialServices: ServiceStatus[]) {
  const [services, setServices] = useState<ServiceStatus[]>(initialServices);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    
    // Get auth token from cookie
    const token = Cookies.get('next-auth.session-token');

    const socketInstance = io(socketUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('Connected to WebSocket');
      setConnected(true);
      
      // Subscribe to service status updates
      socketInstance.emit('subscribe:status');
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
      setConnected(false);
    });

    socketInstance.on('service:status', (data: ServiceStatus) => {
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
    });

    socketInstance.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    setSocket(socketInstance);

    // Fetch services periodically
    const fetchServices = async () => {
      try {
        const response = await fetch('/api/services/status');
        if (response.ok) {
          const data = await response.json();
          setServices(data.map((service: any) => ({
            ...service,
            lastCheckAt: new Date(service.lastCheckAt),
          })));
        }
      } catch (error) {
        console.error('Failed to fetch services:', error);
      }
    };

    // Initial fetch
    fetchServices();

    // Fetch every 30 seconds
    const interval = setInterval(fetchServices, 30000);

    return () => {
      socketInstance.off('connect');
      socketInstance.off('disconnect');
      socketInstance.off('service:status');
      socketInstance.off('connect_error');
      socketInstance.disconnect();
      clearInterval(interval);
    };
  }, []);

  return { services, connected };
}