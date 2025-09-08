'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

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

// CONTEXT7 PATTERN: Enhanced hook with memoized initial state
// Reference: React.dev performance guide - useMemo for initial state objects
export function useWebSocket() {
  // CONTEXT7 PATTERN: useMemo for initial state to prevent object recreation
  // Reference: React.dev performance guide - useMemo for stable object references
  const initialConnectionState = useMemo(
    () => ({
      connected: false,
      connecting: false,
      quality: 'unknown' as const,
      reconnectAttempt: 0,
    }),
    []
  );

  const [connectionState, setConnectionState] = useState<ConnectionState>(initialConnectionState);
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

  // CONTEXT7 PATTERN: useCallback for stable function references
  // Reference: React.dev performance guide - useCallback for event handlers and API calls
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

  // CONTEXT7 PATTERN: useMemo for return object to prevent recreation
  // Reference: React.dev performance guide - useMemo for stable object references
  return useMemo(
    () => ({
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
    }),
    [connectionState, connectionError, refreshService, reconnect, checkConnectionQuality]
  );
}

// CONTEXT7 PATTERN: Legacy hook with optimized state management
// Reference: React.dev performance guide - useMemo for initial state
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

  // CONTEXT7 PATTERN: useCallback for legacy method stability
  // Reference: React.dev performance guide - useCallback for consistent references
  const refreshService = useCallback((serviceId: string) => {
    socketManager.emit('request:refresh', serviceId);
  }, []);

  const reconnect = useCallback(() => {
    socketManager.disconnect();
    socketManager.connect();
  }, []);

  // CONTEXT7 PATTERN: useMemo for stable return object
  // Reference: React.dev performance guide - useMemo for object references
  return useMemo(
    () => ({
      isConnected,
      connectionError,
      reconnectAttempt,
      refreshService,
      reconnect,
    }),
    [isConnected, connectionError, reconnectAttempt, refreshService, reconnect]
  );
}

// Default exports for backward compatibility
export default useWebSocket;
