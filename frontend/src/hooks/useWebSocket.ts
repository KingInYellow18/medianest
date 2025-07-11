'use client';

import { useEffect, useState, useCallback } from 'react';
import { socketManager } from '@/lib/socket';

interface ConnectionStatus {
  connected: boolean;
  latency?: number;
  reconnectAttempt?: number;
}

interface ErrorMessage {
  message: string;
  code?: string;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    const socket = socketManager.connect();

    const handleConnectionStatus = (status: ConnectionStatus) => {
      setIsConnected(status.connected);
      setReconnectAttempt(status.reconnectAttempt || 0);
      if (status.connected) {
        setConnectionError(null);
      }
    };

    const handleError = (error: ErrorMessage) => {
      setConnectionError(error.message);
    };

    socketManager.on('connection:status', handleConnectionStatus);
    socketManager.on('error', handleError);

    // Subscribe to status updates when connected
    if (socket.connected) {
      socket.emit('subscribe:status');
    }

    // Subscribe when connection is established
    socket.on('connect', () => {
      socket.emit('subscribe:status');
    });

    return () => {
      // Unsubscribe before disconnecting
      if (socket.connected) {
        socket.emit('unsubscribe:status');
      }
      socketManager.off('connection:status', handleConnectionStatus);
      socketManager.off('error', handleError);
    };
  }, []);

  const refreshService = useCallback((serviceId: string) => {
    socketManager.emit('request:refresh', serviceId);
  }, []);

  const reconnect = useCallback(() => {
    socketManager.disconnect();
    socketManager.connect();
  }, []);

  return { 
    isConnected, 
    connectionError, 
    reconnectAttempt,
    refreshService,
    reconnect
  };
}