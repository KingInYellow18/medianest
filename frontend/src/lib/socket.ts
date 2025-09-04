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

interface SocketEvents {
  'subscribe:status': () => void;
  'unsubscribe:status': () => void;
  'request:refresh': (serviceId: string) => void;
  'request:update': (data: any) => void;
  'service:status': (data: any) => void;
  'service:bulk-update': (data: any[]) => void;
  'connection:status': (data: {
    connected: boolean;
    latency?: number;
    reconnectAttempt?: number;
  }) => void;
  error: (data: { message: string; code?: string }) => void;
  'subscribe:request': (requestId: string) => void;
  'unsubscribe:request': (requestId: string) => void;
  [key: `request:${string}:status`]: (data: any) => void;
}

class SocketManager {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private connectionOptions: ConnectionOptions = {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    timeout: 10000,
  };
  private reconnectAttempt = 0;

  private static instance: SocketManager | null = null;

  private constructor() {}

  static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

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
    return this.socket;
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      if (process.env.NODE_ENV === 'development') {
        console.info('[Socket] Connected');
      }
      this.reconnectAttempt = 0;
      this.emit('connection:status', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV === 'development') {
        console.info('[Socket] Disconnected:', reason);
      }
      this.emit('connection:status', { connected: false });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      this.reconnectAttempt++;
      this.emit('connection:status', {
        connected: false,
        reconnectAttempt: this.reconnectAttempt,
      });
      this.emit('error', {
        message: error.message,
        code: (error as any).type,
      });
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      if (process.env.NODE_ENV === 'development') {
        console.info('[Socket] Reconnection attempt:', attempt);
      }
      this.reconnectAttempt = attempt;
    });

    this.socket.io.on('reconnect', (attempt) => {
      if (process.env.NODE_ENV === 'development') {
        console.info('[Socket] Reconnected after', attempt, 'attempts');
      }
      this.reconnectAttempt = 0;
    });

    this.socket.io.on('reconnect_error', (error) => {
      console.error('[Socket] Reconnection error:', error.message);
    });

    this.socket.io.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed');
      this.emit('error', {
        message: 'Failed to reconnect after maximum attempts',
        code: 'RECONNECT_FAILED',
      });
    });
  }

  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as (...args: any[]) => void);

    if (this.socket) {
      this.socket.on(event as string, callback as any);
    }
  }

  off<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]) {
    this.listeners.get(event)?.delete(callback as (...args: any[]) => void);

    if (this.socket) {
      this.socket.off(event as string, callback as any);
    }
  }

  emit<K extends keyof SocketEvents>(event: K, ...args: Parameters<SocketEvents[K]>) {
    if (this.socket?.connected) {
      this.socket.emit(event as string, ...args);
    } else {
      console.warn(`[Socket] Cannot emit '${event as string}' - not connected`);
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

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
    this.reconnectAttempt = 0;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  updateConnectionOptions(options: Partial<ConnectionOptions>) {
    this.connectionOptions = { ...this.connectionOptions, ...options };

    // If already connected, we need to reconnect with new options
    if (this.socket) {
      this.disconnect();
      this.connect();
    }
  }
}

export const socketManager = SocketManager.getInstance();
export type { SocketEvents };
