import Cookies from 'js-cookie';
import { io, Socket } from 'socket.io-client';
import { getApiConfig } from '@/config';

interface ConnectionOptions {
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
  timeout?: number;
}

interface EnhancedSocketEvents {
  // Status events
  'subscribe:status': () => void;
  'unsubscribe:status': () => void;
  'subscribe:service': (serviceId: string) => void;
  'unsubscribe:service': (serviceId: string) => void;
  'request:refresh': (serviceId: string) => void;
  'admin:refresh-status': () => void;
  'service:history': (serviceId: string, hours?: number, callback?: (result: any) => void) => void;

  // Download events
  'downloads:subscribe': (callback?: (result: any) => void) => void;
  'downloads:unsubscribe': (callback?: (result: any) => void) => void;
  'downloads:queue:status': (callback?: (result: any) => void) => void;
  'downloads:status': (downloadId: string, callback?: (result: any) => void) => void;
  'downloads:cancel': (downloadId: string, callback?: (result: any) => void) => void;
  'downloads:retry': (downloadId: string, callback?: (result: any) => void) => void;

  // Notification events
  'subscribe:notifications': () => void;
  'unsubscribe:notifications': () => void;
  'notification:read': (notificationId: string, callback?: (result: any) => void) => void;
  'notifications:read-all': (callback?: (result: any) => void) => void;
  'notification:dismiss': (notificationId: string, callback?: (result: any) => void) => void;
  'notifications:history': (
    options?: { limit?: number; offset?: number },
    callback?: (result: any) => void,
  ) => void;
  'notification:action': (
    data: { notificationId: string; action: string },
    callback?: (result: any) => void,
  ) => void;

  // Admin events
  'admin:broadcast': (data: any, callback?: (result: any) => void) => void;
  'admin:refresh:all-services': (callback?: (result: any) => void) => void;
  'admin:system:overview': (callback?: (result: any) => void) => void;
  'admin:users:connected': (callback?: (result: any) => void) => void;
  'admin:user:disconnect': (userId: string, callback?: (result: any) => void) => void;
  'admin:subscribe:activity': () => void;
  'admin:unsubscribe:activity': () => void;

  // Connection management
  'client:ping': (timestamp?: number, callback?: (result: any) => void) => void;
  'connection:quality-check': (callback?: (result: any) => void) => void;
  'client:reconnected': (data?: any) => void;

  // Received events
  'connection:status': (data: {
    connected: boolean;
    latency?: number;
    reconnectAttempt?: number;
  }) => void;
  'service:status': (data: any) => void;
  'service:bulk-update': (data: any[]) => void;
  'status:current': (data: any) => void;
  'status:refreshed': (data: any) => void;
  'download:progress': (data: any) => void;
  'download:completed': (data: any) => void;
  'download:failed': (data: any) => void;
  'download:cancelled': (data: any) => void;
  'notification:new': (data: any) => void;
  'notification:system': (data: any) => void;
  'admin:broadcast:message': (data: any) => void;
  'admin:activity': (data: any) => void;
  error: (data: { message: string; code?: string }) => void;

  // Legacy events for backward compatibility
  'request:update': (data: any) => void;
  'subscribe:request': (requestId: string) => void;
  'unsubscribe:request': (requestId: string) => void;
  [key: `request:${string}:status`]: (data: any) => void;
}

interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  latency?: number;
  quality: 'excellent' | 'good' | 'poor' | 'unknown';
  reconnectAttempt: number;
  lastError?: string;
}

class EnhancedSocketManager {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private connectionOptions: ConnectionOptions = {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: 10,
    timeout: 20000,
  };
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastPingTime = 0;
  private connectionState: ConnectionState = {
    connected: false,
    connecting: false,
    quality: 'unknown',
    reconnectAttempt: 0,
  };
  private offlineBuffer: Array<{ event: string; args: any[] }> = [];
  private namespaces: Map<string, Socket> = new Map();
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();

  private static instance: EnhancedSocketManager | null = null;

  private constructor() {}

  static getInstance(): EnhancedSocketManager {
    if (!EnhancedSocketManager.instance) {
      EnhancedSocketManager.instance = new EnhancedSocketManager();
    }
    return EnhancedSocketManager.instance;
  }

  connect(namespace?: string): Socket {
    if (namespace) {
      return this.connectNamespace(namespace);
    }

    if (this.socket?.connected) {
      return this.socket;
    }

    this.updateConnectionState({ connecting: true });

    const token =
      Cookies.get('next-auth.session-token') || Cookies.get('__Secure-next-auth.session-token');
    const { backendUrl } = getApiConfig();
    const socketUrl = backendUrl;

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      ...this.connectionOptions,
    });

    this.setupEventHandlers();
    this.startHeartbeat();
    return this.socket;
  }

  connectNamespace(namespace: string): Socket {
    if (this.namespaces.has(namespace) && this.namespaces.get(namespace)?.connected) {
      return this.namespaces.get(namespace)!;
    }

    const token =
      Cookies.get('next-auth.session-token') || Cookies.get('__Secure-next-auth.session-token');
    const { backendUrl } = getApiConfig();
    const socketUrl = `${backendUrl}${namespace}`;

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      ...this.connectionOptions,
    });

    this.namespaces.set(namespace, socket);
    this.setupNamespaceHandlers(socket, namespace);
    return socket;
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
      this.updateConnectionState({
        connected: true,
        connecting: false,
        reconnectAttempt: 0,
        lastError: undefined,
      });
      this.flushOfflineBuffer();
      this.emit('connection:status', { connected: true });

      // Notify server about reconnection if this isn't the first connection
      if (this.lastPingTime > 0) {
        this.socket?.emit('client:reconnected', {
          previousSocketId: this.socket?.id,
          disconnectedFor: Date.now() - this.lastPingTime,
        });
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      this.lastPingTime = Date.now();
      this.updateConnectionState({
        connected: false,
        connecting: false,
        lastError: reason,
      });
      this.emit('connection:status', { connected: false });
      this.stopHeartbeat();
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      const newAttempt = this.connectionState.reconnectAttempt + 1;
      this.updateConnectionState({
        connected: false,
        connecting: false,
        reconnectAttempt: newAttempt,
        lastError: error.message,
      });

      this.emit('connection:status', {
        connected: false,
        reconnectAttempt: newAttempt,
      });
      this.emit('error', {
        message: error.message,
        code: (error as any).type,
      });
    });

    // Enhanced reconnection handling
    this.socket.io.on('reconnect_attempt', (attempt) => {
      console.log('[Socket] Reconnection attempt:', attempt);
      this.updateConnectionState({
        connecting: true,
        reconnectAttempt: attempt,
      });
      this.emit('connection:status', {
        connected: false,
        reconnectAttempt: attempt,
      });
    });

    this.socket.io.on('reconnect', (attempt) => {
      console.log('[Socket] Reconnected after', attempt, 'attempts');
      this.updateConnectionState({
        connected: true,
        connecting: false,
        reconnectAttempt: 0,
        lastError: undefined,
      });
      this.emit('connection:status', { connected: true });
    });

    this.socket.io.on('reconnect_error', (error) => {
      console.error('[Socket] Reconnection error:', error.message);
      this.updateConnectionState({
        lastError: error.message,
      });
    });

    this.socket.io.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed');
      this.updateConnectionState({
        connected: false,
        connecting: false,
        lastError: 'Reconnection failed after maximum attempts',
      });
      this.emit('error', {
        message: 'Failed to reconnect after maximum attempts',
        code: 'RECONNECT_FAILED',
      });
    });

    // Server-initiated events
    this.socket.on('connection:established', (data) => {
      console.log('[Socket] Connection established:', data);
    });

    this.socket.on('client:reconnection-confirmed', (data) => {
      console.log('[Socket] Reconnection confirmed:', data);
    });

    this.socket.on('admin:force-disconnect', (data) => {
      console.warn('[Socket] Force disconnected by admin:', data);
      this.emit('error', {
        message: `Disconnected by administrator: ${data.reason}`,
        code: 'ADMIN_DISCONNECT',
      });
    });
  }

  private setupNamespaceHandlers(socket: Socket, namespace: string) {
    socket.on('connect', () => {
      console.log(`[Socket:${namespace}] Connected`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket:${namespace}] Disconnected:`, reason);
    });

    socket.on('connect_error', (error) => {
      console.error(`[Socket:${namespace}] Connection error:`, error.message);
    });
  }

  private updateConnectionState(updates: Partial<ConnectionState>) {
    this.connectionState = { ...this.connectionState, ...updates };
    this.stateListeners.forEach((listener) => {
      try {
        listener(this.connectionState);
      } catch (error) {
        console.error('[Socket] Error in state listener:', error);
      }
    });
  }

  on<K extends keyof EnhancedSocketEvents>(event: K, callback: EnhancedSocketEvents[K]) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as (...args: any[]) => void);

    if (this.socket) {
      this.socket.on(event as string, callback as any);
    }
  }

  off<K extends keyof EnhancedSocketEvents>(event: K, callback: EnhancedSocketEvents[K]) {
    this.listeners.get(event)?.delete(callback as (...args: any[]) => void);

    if (this.socket) {
      this.socket.off(event as string, callback as any);
    }
  }

  emit<K extends keyof EnhancedSocketEvents>(
    event: K,
    ...args: Parameters<EnhancedSocketEvents[K]>
  ) {
    if (this.socket?.connected) {
      this.socket.emit(event as string, ...args);
    } else {
      // Buffer events when offline (except for connection-related events)
      const nonBufferedEvents = ['connection:status', 'error', 'client:ping'];
      if (!nonBufferedEvents.includes(event as string)) {
        this.offlineBuffer.push({ event: event as string, args });
        console.warn(`[Socket] Buffered '${event as string}' - not connected`);
      } else {
        console.warn(`[Socket] Cannot emit '${event as string}' - not connected`);
      }
    }

    // Also emit to local listeners
    const localListeners = this.listeners.get(event);
    if (localListeners) {
      localListeners.forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`[Socket] Error in local listener for '${event as string}':`, error);
        }
      });
    }
  }

  emitToNamespace<K extends keyof EnhancedSocketEvents>(
    namespace: string,
    event: K,
    ...args: Parameters<EnhancedSocketEvents[K]>
  ) {
    const socket = this.namespaces.get(namespace);
    if (socket?.connected) {
      socket.emit(event as string, ...args);
    } else {
      console.warn(`[Socket:${namespace}] Cannot emit '${event as string}' - not connected`);
    }
  }

  disconnect() {
    this.stopHeartbeat();

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // Disconnect all namespaces
    this.namespaces.forEach((socket, namespace) => {
      socket.removeAllListeners();
      socket.disconnect();
      console.log(`[Socket:${namespace}] Disconnected`);
    });
    this.namespaces.clear();

    this.listeners.clear();
    this.offlineBuffer = [];
    this.updateConnectionState({
      connected: false,
      connecting: false,
      quality: 'unknown',
      reconnectAttempt: 0,
      lastError: undefined,
    });
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(callback);
    // Immediately call with current state
    callback(this.connectionState);

    // Return unsubscribe function
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  updateConnectionOptions(options: Partial<ConnectionOptions>) {
    this.connectionOptions = { ...this.connectionOptions, ...options };

    // If already connected, we need to reconnect with new options
    if (this.socket) {
      this.disconnect();
      this.connect();
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        const startTime = Date.now();
        this.socket.emit('client:ping', startTime, (response: any) => {
          const latency = Date.now() - startTime;
          this.updateConnectionQuality(latency);
          this.updateConnectionState({ latency });
          this.emit('connection:status', {
            connected: true,
            latency,
          });
        });
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private updateConnectionQuality(latency: number) {
    let quality: 'excellent' | 'good' | 'poor';
    if (latency < 100) {
      quality = 'excellent';
    } else if (latency < 300) {
      quality = 'good';
    } else {
      quality = 'poor';
    }
    this.updateConnectionState({ quality });
  }

  private flushOfflineBuffer() {
    if (this.offlineBuffer.length > 0 && this.socket?.connected) {
      console.log(`[Socket] Flushing ${this.offlineBuffer.length} buffered events`);
      this.offlineBuffer.forEach(({ event, args }) => {
        this.socket?.emit(event, ...args);
      });
      this.offlineBuffer = [];
    }
  }

  getConnectionQuality(): 'excellent' | 'good' | 'poor' | 'unknown' {
    return this.connectionState.quality;
  }

  getNamespace(namespace: string): Socket | undefined {
    return this.namespaces.get(namespace);
  }

  // Utility method for checking connection quality
  async checkConnectionQuality(): Promise<{
    success: boolean;
    responseTime?: number;
    quality?: string;
    error?: string;
  }> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      const startTime = Date.now();
      this.socket.emit('connection:quality-check', (response: any) => {
        const responseTime = Date.now() - startTime;
        if (response.success) {
          this.updateConnectionQuality(responseTime);
          resolve({
            success: true,
            responseTime,
            quality: this.connectionState.quality,
          });
        } else {
          resolve({ success: false, error: response.error });
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        resolve({ success: false, error: 'Quality check timeout' });
      }, 10000);
    });
  }
}

export const enhancedSocketManager = EnhancedSocketManager.getInstance();
export type { EnhancedSocketEvents, ConnectionState };
export default EnhancedSocketManager;
