'use client';

import { useEffect, useState, useCallback } from 'react';
import { enhancedSocketManager, ConnectionState } from '@/lib/enhanced-socket';
import { socketManager } from '@/lib/socket'; // Keep for backward compatibility

interface ConnectionStatus {
  connected: boolean;
  latency?: number;
  reconnectAttempt?: number;
}

interface ErrorMessage {
  message: string;
  code?: string;
}

// Enhanced hook with better state management
export function useWebSocket() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    connected: false,
    connecting: false,
    quality: 'unknown',
    reconnectAttempt: 0,
  });
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    // Use enhanced socket manager
    const socket = enhancedSocketManager.connect();

    // Subscribe to connection state changes
    const unsubscribeStateChange = enhancedSocketManager.onStateChange((state) => {
      setConnectionState(state);
      if (state.connected) {
        setConnectionError(null);
      } else if (state.lastError) {
        setConnectionError(state.lastError);
      }
    });

    const handleError = (error: ErrorMessage) => {
      setConnectionError(error.message);
    };

    enhancedSocketManager.on('error', handleError);

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
      enhancedSocketManager.off('error', handleError);
      unsubscribeStateChange();
    };
  }, []);

  const refreshService = useCallback((serviceId: string) => {
    enhancedSocketManager.emit('request:refresh', serviceId);
  }, []);

  const reconnect = useCallback(() => {
    enhancedSocketManager.disconnect();
    setTimeout(() => {
      enhancedSocketManager.connect();
    }, 1000);
  }, []);

  const checkConnectionQuality = useCallback(() => {
    return enhancedSocketManager.checkConnectionQuality();
  }, []);

  return {
    // Enhanced state
    connectionState,
    isConnected: connectionState.connected,
    isConnecting: connectionState.connecting,
    connectionQuality: connectionState.quality,
    latency: connectionState.latency,

    // Legacy compatibility
    connectionError,
    reconnectAttempt: connectionState.reconnectAttempt,

    // Methods
    refreshService,
    reconnect,
    checkConnectionQuality,
  };
}

// Legacy hook for backward compatibility
export function useLegacyWebSocket() {
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
    reconnect,
  };
}
