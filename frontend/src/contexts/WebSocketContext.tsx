'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { enhancedSocketManager, ConnectionState } from '@/lib/enhanced-socket';

interface WebSocketContextType {
  // Connection state
  connectionState: ConnectionState;
  isConnected: boolean;

  // Connection methods
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;

  // Namespace connections
  connectNamespace: (namespace: string) => void;
  disconnectNamespace: (namespace: string) => void;

  // Event subscription helpers
  subscribe: <T = any>(event: string, callback: (data: T) => void) => () => void;
  subscribeToNamespace: <T = any>(
    namespace: string,
    event: string,
    callback: (data: T) => void
  ) => () => void;

  // Emit helpers with optimistic updates
  emit: (event: string, data?: any) => void;
  emitToNamespace: (namespace: string, event: string, data?: any) => void;
  emitWithCallback: <T = any>(event: string, data: any, timeout?: number) => Promise<T>;

  // Connection quality
  checkConnectionQuality: () => Promise<any>;

  // Notification helpers
  subscribeToNotifications: () => void;
  unsubscribeFromNotifications: () => void;
  markNotificationAsRead: (id: string) => Promise<boolean>;
  markAllNotificationsAsRead: () => Promise<number>;

  // Download helpers
  subscribeToDownloads: () => void;
  unsubscribeFromDownloads: () => void;
  getDownloadStatus: (downloadId: string) => Promise<any>;
  cancelDownload: (downloadId: string) => Promise<boolean>;
  retryDownload: (downloadId: string) => Promise<boolean>;

  // Status helpers
  subscribeToStatus: () => void;
  unsubscribeFromStatus: () => void;
  refreshService: (serviceId: string) => void;
  subscribeToService: (serviceId: string) => void;
  unsubscribeFromService: (serviceId: string) => void;

  // Admin helpers (if user is admin)
  isAdmin: boolean;
  broadcastAdminMessage: (message: any) => Promise<any>;
  getSystemOverview: () => Promise<any>;
  getConnectedUsers: () => Promise<any>;
  refreshAllServices: () => Promise<any>;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
  autoConnect?: boolean;
  userRole?: string;
}

export function WebSocketProvider({
  children,
  autoConnect = true,
  userRole,
}: WebSocketProviderProps) {
  // CONTEXT7 PATTERN: useMemo for initial state objects
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

  // CONTEXT7 PATTERN: useMemo for Set initialization to prevent recreation
  // Reference: React.dev performance guide - useMemo for complex initial values
  const initialNamespaces = useMemo(() => new Set<string>(), []);
  const [connectedNamespaces, setConnectedNamespaces] = useState<Set<string>>(initialNamespaces);

  // CONTEXT7 PATTERN: useMemo for computed admin state
  // Reference: React.dev performance guide - useMemo for derived state
  const isAdmin = useMemo(() => userRole === 'admin', [userRole]);

  // Subscribe to connection state changes
  useEffect(() => {
    const unsubscribe = enhancedSocketManager.onStateChange((state) => {
      setConnectionState(state);
    });

    return unsubscribe;
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      enhancedSocketManager.connect();
    }

    // Admin status is now computed via useMemo

    return () => {
      if (autoConnect) {
        enhancedSocketManager.disconnect();
      }
    };
  }, [autoConnect, userRole]);

  const connect = useCallback(() => {
    enhancedSocketManager.connect();
  }, []);

  const disconnect = useCallback(() => {
    enhancedSocketManager.disconnect();
    setConnectedNamespaces(new Set());
  }, []);

  const reconnect = useCallback(() => {
    enhancedSocketManager.disconnect();
    setTimeout(() => {
      enhancedSocketManager.connect();
    }, 1000);
  }, []);

  const connectNamespace = useCallback((namespace: string) => {
    enhancedSocketManager.connectNamespace(namespace);
    setConnectedNamespaces((prev) => new Set(prev).add(namespace));
  }, []);

  const disconnectNamespace = useCallback((namespace: string) => {
    const socket = enhancedSocketManager.getNamespace(namespace);
    if (socket) {
      socket.disconnect();
    }
    setConnectedNamespaces((prev) => {
      const newSet = new Set(prev);
      newSet.delete(namespace);
      return newSet;
    });
  }, []);

  const subscribe = useCallback(<T = any,>(event: string, callback: (data: T) => void) => {
    enhancedSocketManager.on(event as any, callback);

    return () => {
      enhancedSocketManager.off(event as any, callback);
    };
  }, []);

  const subscribeToNamespace = useCallback(
    <T = any,>(namespace: string, event: string, callback: (data: T) => void) => {
      const socket = enhancedSocketManager.getNamespace(namespace);
      if (socket) {
        socket.on(event, callback);
        return () => {
          socket.off(event, callback);
        };
      }
      return () => {};
    },
    []
  );

  const emit = useCallback((event: string, data?: any) => {
    enhancedSocketManager.emit(event as any, data);
  }, []);

  const emitToNamespace = useCallback((namespace: string, event: string, data?: any) => {
    enhancedSocketManager.emitToNamespace(namespace, event as any, data);
  }, []);

  const emitWithCallback = useCallback(
    <T = any,>(event: string, data: any, timeout = 10000): Promise<T> => {
      return new Promise((resolve, reject) => {
        const socket = enhancedSocketManager.getSocket();
        if (!socket?.connected) {
          reject(new Error('Not connected'));
          return;
        }

        const timeoutId = setTimeout(() => {
          reject(new Error('Request timeout'));
        }, timeout);

        socket.emit(event, data, (response: T) => {
          clearTimeout(timeoutId);
          resolve(response);
        });
      });
    },
    []
  );

  const checkConnectionQuality = useCallback(() => {
    return enhancedSocketManager.checkConnectionQuality();
  }, []);

  // Notification helpers
  const subscribeToNotifications = useCallback(() => {
    connectNamespace('/notifications');
    enhancedSocketManager.emitToNamespace('/notifications', 'subscribe:notifications');
  }, [connectNamespace]);

  const unsubscribeFromNotifications = useCallback(() => {
    enhancedSocketManager.emitToNamespace('/notifications', 'unsubscribe:notifications');
  }, []);

  const markNotificationAsRead = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const result = await emitWithCallback('notification:read', id);
        return result.success || false;
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
        return false;
      }
    },
    [emitWithCallback]
  );

  const markAllNotificationsAsRead = useCallback(async (): Promise<number> => {
    try {
      const result = await emitWithCallback('notifications:read-all', {});
      return result.readCount || 0;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return 0;
    }
  }, [emitWithCallback]);

  // Download helpers
  const subscribeToDownloads = useCallback(() => {
    connectNamespace('/downloads');
    enhancedSocketManager.emitToNamespace('/downloads', 'downloads:subscribe');
  }, [connectNamespace]);

  const unsubscribeFromDownloads = useCallback(() => {
    enhancedSocketManager.emitToNamespace('/downloads', 'downloads:unsubscribe');
  }, []);

  const getDownloadStatus = useCallback(
    async (downloadId: string) => {
      try {
        return await emitWithCallback('downloads:status', downloadId);
      } catch (error) {
        console.error('Failed to get download status:', error);
        return { success: false, error: error.message };
      }
    },
    [emitWithCallback]
  );

  const cancelDownload = useCallback(
    async (downloadId: string): Promise<boolean> => {
      try {
        const result = await emitWithCallback('downloads:cancel', downloadId);
        return result.success || false;
      } catch (error) {
        console.error('Failed to cancel download:', error);
        return false;
      }
    },
    [emitWithCallback]
  );

  const retryDownload = useCallback(
    async (downloadId: string): Promise<boolean> => {
      try {
        const result = await emitWithCallback('downloads:retry', downloadId);
        return result.success || false;
      } catch (error) {
        console.error('Failed to retry download:', error);
        return false;
      }
    },
    [emitWithCallback]
  );

  // Status helpers
  const subscribeToStatus = useCallback(() => {
    connectNamespace('/status');
    enhancedSocketManager.emitToNamespace('/status', 'subscribe:status');
  }, [connectNamespace]);

  const unsubscribeFromStatus = useCallback(() => {
    enhancedSocketManager.emitToNamespace('/status', 'unsubscribe:status');
  }, []);

  const refreshService = useCallback((serviceId: string) => {
    enhancedSocketManager.emit('request:refresh', serviceId);
  }, []);

  const subscribeToService = useCallback((serviceId: string) => {
    enhancedSocketManager.emitToNamespace('/status', 'subscribe:service', serviceId);
  }, []);

  const unsubscribeFromService = useCallback((serviceId: string) => {
    enhancedSocketManager.emitToNamespace('/status', 'unsubscribe:service', serviceId);
  }, []);

  // Admin helpers
  const broadcastAdminMessage = useCallback(
    async (message: any) => {
      if (!isAdmin) {
        throw new Error('Admin access required');
      }

      try {
        connectNamespace('/admin');
        return await emitWithCallback('admin:broadcast', message);
      } catch (error) {
        console.error('Failed to broadcast admin message:', error);
        throw error;
      }
    },
    [isAdmin, connectNamespace, emitWithCallback]
  );

  const getSystemOverview = useCallback(async () => {
    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    try {
      connectNamespace('/admin');
      return await emitWithCallback('admin:system:overview', {});
    } catch (error) {
      console.error('Failed to get system overview:', error);
      throw error;
    }
  }, [isAdmin, connectNamespace, emitWithCallback]);

  const getConnectedUsers = useCallback(async () => {
    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    try {
      connectNamespace('/admin');
      return await emitWithCallback('admin:users:connected', {});
    } catch (error) {
      console.error('Failed to get connected users:', error);
      throw error;
    }
  }, [isAdmin, connectNamespace, emitWithCallback]);

  const refreshAllServices = useCallback(async () => {
    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    try {
      connectNamespace('/admin');
      return await emitWithCallback('admin:refresh:all-services', {});
    } catch (error) {
      console.error('Failed to refresh all services:', error);
      throw error;
    }
  }, [isAdmin, connectNamespace, emitWithCallback]);

  // CONTEXT7 PATTERN: useMemo for context value to prevent unnecessary re-renders
  // Reference: React.dev performance guide - useMemo for context value objects
  const contextValue: WebSocketContextType = useMemo(
    () => ({
      // Connection state
      connectionState,
      isConnected: connectionState.connected,

      // Connection methods
      connect,
      disconnect,
      reconnect,

      // Namespace connections
      connectNamespace,
      disconnectNamespace,

      // Event subscription helpers
      subscribe,
      subscribeToNamespace,

      // Emit helpers
      emit,
      emitToNamespace,
      emitWithCallback,

      // Connection quality
      checkConnectionQuality,

      // Notification helpers
      subscribeToNotifications,
      unsubscribeFromNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,

      // Download helpers
      subscribeToDownloads,
      unsubscribeFromDownloads,
      getDownloadStatus,
      cancelDownload,
      retryDownload,

      // Status helpers
      subscribeToStatus,
      unsubscribeFromStatus,
      refreshService,
      subscribeToService,
      unsubscribeFromService,

      // Admin helpers
      isAdmin,
      broadcastAdminMessage,
      getSystemOverview,
      getConnectedUsers,
      refreshAllServices,
    }),
    [
      // Dependencies for context value memoization
      connectionState,
      connect,
      disconnect,
      reconnect,
      connectNamespace,
      disconnectNamespace,
      subscribe,
      subscribeToNamespace,
      emit,
      emitToNamespace,
      emitWithCallback,
      checkConnectionQuality,
      subscribeToNotifications,
      unsubscribeFromNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      subscribeToDownloads,
      unsubscribeFromDownloads,
      getDownloadStatus,
      cancelDownload,
      retryDownload,
      subscribeToStatus,
      unsubscribeFromStatus,
      refreshService,
      subscribeToService,
      unsubscribeFromService,
      isAdmin,
      broadcastAdminMessage,
      getSystemOverview,
      getConnectedUsers,
      refreshAllServices,
    ]
  );

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>;
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

// CONTEXT7 PATTERN: Specialized hooks with memoization
// Reference: React.dev performance guide - Custom hooks with useMemo
export function useConnectionState() {
  const { connectionState } = useWebSocket();
  // Return the connectionState directly as it's already memoized in the context
  return connectionState;
}

export function useNotifications() {
  const {
    subscribeToNotifications,
    unsubscribeFromNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    subscribe,
  } = useWebSocket();

  // CONTEXT7 PATTERN: useMemo for hook return object
  // Reference: React.dev performance guide - useMemo for stable references
  return useMemo(
    () => ({
      subscribeToNotifications,
      unsubscribeFromNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      onNotification: (callback: (notification: any) => void) =>
        subscribe('notification:new', callback),
      onSystemNotification: (callback: (notification: any) => void) =>
        subscribe('notification:system', callback),
    }),
    [
      subscribeToNotifications,
      unsubscribeFromNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      subscribe,
    ]
  );
}

export function useDownloads() {
  const {
    subscribeToDownloads,
    unsubscribeFromDownloads,
    getDownloadStatus,
    cancelDownload,
    retryDownload,
    subscribe,
  } = useWebSocket();

  // CONTEXT7 PATTERN: useMemo for download hook return object
  // Reference: React.dev performance guide - useMemo for hook stability
  return useMemo(
    () => ({
      subscribeToDownloads,
      unsubscribeFromDownloads,
      getDownloadStatus,
      cancelDownload,
      retryDownload,
      onDownloadProgress: (callback: (progress: any) => void) =>
        subscribe('download:progress', callback),
      onDownloadComplete: (callback: (data: any) => void) =>
        subscribe('download:completed', callback),
      onDownloadFailed: (callback: (error: any) => void) => subscribe('download:failed', callback),
    }),
    [
      subscribeToDownloads,
      unsubscribeFromDownloads,
      getDownloadStatus,
      cancelDownload,
      retryDownload,
      subscribe,
    ]
  );
}

export function useServiceStatus() {
  const {
    subscribeToStatus,
    unsubscribeFromStatus,
    refreshService,
    subscribeToService,
    unsubscribeFromService,
    subscribe,
  } = useWebSocket();

  // CONTEXT7 PATTERN: useMemo for service status hook
  // Reference: React.dev performance guide - useMemo for consistent object references
  return useMemo(
    () => ({
      subscribeToStatus,
      unsubscribeFromStatus,
      refreshService,
      subscribeToService,
      unsubscribeFromService,
      onStatusUpdate: (callback: (status: any) => void) => subscribe('service:status', callback),
      onBulkStatusUpdate: (callback: (statuses: any[]) => void) =>
        subscribe('service:bulk-update', callback),
      onStatusRefresh: (callback: () => void) => subscribe('status:refreshed', callback),
    }),
    [
      subscribeToStatus,
      unsubscribeFromStatus,
      refreshService,
      subscribeToService,
      unsubscribeFromService,
      subscribe,
    ]
  );
}

export function useAdminSocket() {
  const {
    isAdmin,
    broadcastAdminMessage,
    getSystemOverview,
    getConnectedUsers,
    refreshAllServices,
    subscribe,
    connectNamespace,
  } = useWebSocket();

  useEffect(() => {
    if (isAdmin) {
      connectNamespace('/admin');
    }
  }, [isAdmin, connectNamespace]);

  if (!isAdmin) {
    throw new Error('Admin access required');
  }

  return {
    broadcastAdminMessage,
    getSystemOverview,
    getConnectedUsers,
    refreshAllServices,
    onAdminActivity: (callback: (activity: any) => void) => subscribe('admin:activity', callback),
    onBroadcastMessage: (callback: (message: any) => void) =>
      subscribe('admin:broadcast:message', callback),
  };
}
