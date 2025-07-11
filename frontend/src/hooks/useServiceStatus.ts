'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ServiceStatus, ServiceStatusUpdate } from '@/types/dashboard';

export function useServiceStatus(initialServices: ServiceStatus[]) {
  const [services, setServices] = useState<ServiceStatus[]>(initialServices);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    
    // Get auth token from cookie or session storage
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('next-auth.session-token='))
      ?.split('=')[1];

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

    socketInstance.on('service:status', (data: ServiceStatusUpdate) => {
      console.log('Service status update:', data);
      setServices(prev => 
        prev.map(service => 
          service.id === data.serviceId 
            ? { 
                ...service, 
                ...data.update,
                lastCheckAt: data.update.lastCheckAt 
                  ? new Date(data.update.lastCheckAt) 
                  : service.lastCheckAt
              }
            : service
        )
      );
    });

    socketInstance.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return { services, connected };
}