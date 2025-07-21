import { EventEmitter } from 'events';

import { io, Socket } from 'socket.io-client';

import { logger } from '@/utils/logger';

export interface MonitorStatus {
  monitorID: number;
  name: string;
  url?: string;
  type: string;
  active: boolean;
  status: boolean; // true = up, false = down
  msg?: string;
  ping?: number; // Response time in ms
  avgPing?: number;
  uptime24h?: number;
  uptime30d?: number;
}

export interface HeartbeatData {
  monitorID: number;
  status: 0 | 1 | 2; // 0 = down, 1 = up, 2 = pending
  time: string;
  msg: string;
  ping?: number;
  important?: boolean;
}

export class UptimeKumaClient extends EventEmitter {
  private socket?: Socket;
  private monitors: Map<number, MonitorStatus> = new Map();
  private connected = false;
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private lastCleanup = 0;
  private connectionMetrics = {
    connectTime: 0,
    disconnectCount: 0,
    errorCount: 0,
    messageCount: 0,
  };
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private reconnectAttempts = 0;

  constructor(
    private url: string,
    private username?: string,
    private password?: string,
  ) {
    super();

    // Set max listeners to prevent memory leaks
    this.setMaxListeners(50);

    // Setup periodic cleanup
    this.setupCleanupInterval();
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.url, {
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS,
          reconnectionDelay: 5000,
          reconnectionDelayMax: 30000,
          randomizationFactor: 0.5,
          timeout: 15000,
          forceNew: true,
          autoConnect: false, // Manual connection control
        });

        this.setupEventHandlers();

        this.socket.on('connect', async () => {
          logger.info('Connected to Uptime Kuma');
          this.connected = true;
          this.connectionMetrics.connectTime = Date.now();
          this.reconnectAttempts = 0;

          // Authenticate if credentials provided
          if (this.username && this.password) {
            try {
              await this.authenticate();
            } catch (error) {
              logger.error('Authentication failed', { error });
              this.connectionMetrics.errorCount++;
              // Continue without auth - may have limited access
            }
          }

          // Request initial monitor list
          this.socket!.emit('monitorList');

          // Setup heartbeat to keep connection alive
          this.setupHeartbeat();

          resolve();
        });

        this.socket.on('connect_error', (error) => {
          this.connectionMetrics.errorCount++;
          this.reconnectAttempts++;

          logger.error('Uptime Kuma connection error', {
            error: error.message,
            attempt: this.reconnectAttempts,
            maxAttempts: this.MAX_RECONNECT_ATTEMPTS,
          });

          if (!this.connected && this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            reject(new Error('Failed to connect to Uptime Kuma after maximum attempts'));
          }
        });

        // Start the connection
        this.socket.connect();

        // Set timeout for initial connection
        setTimeout(() => {
          if (!this.connected) {
            this.cleanup();
            reject(new Error('Connection timeout'));
          }
        }, 20000);
      } catch (error) {
        reject(error);
      }
    });
  }

  private async authenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit(
        'login',
        {
          username: this.username,
          password: this.password,
          token: '',
        },
        (res: any) => {
          if (res && res.ok) {
            logger.info('Authenticated with Uptime Kuma');
            resolve();
          } else {
            logger.error('Uptime Kuma authentication failed', { msg: res?.msg });
            reject(new Error(res?.msg || 'Authentication failed'));
          }
        },
      );
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Monitor list update with memory management
    this.socket.on('monitorList', (data: Record<string, MonitorStatus>) => {
      logger.debug('Received monitor list', { count: Object.keys(data).length });
      this.connectionMetrics.messageCount++;

      // Clear old monitors to prevent memory leaks
      this.monitors.clear();

      // Validate and sanitize monitor data
      for (const [id, monitor] of Object.entries(data)) {
        if (this.isValidMonitor(monitor)) {
          this.monitors.set(Number(id), monitor);
        } else {
          logger.warn('Invalid monitor data received', { id, monitor });
        }
      }

      this.emit('monitorList', Array.from(this.monitors.values()));
    });

    // Real-time heartbeat updates with validation
    this.socket.on('heartbeat', (data: HeartbeatData) => {
      this.connectionMetrics.messageCount++;

      if (!this.isValidHeartbeat(data)) {
        logger.warn('Invalid heartbeat data received', { data });
        return;
      }

      const monitor = this.monitors.get(data.monitorID);
      if (monitor) {
        monitor.status = data.status === 1;
        monitor.ping = data.ping;
        monitor.msg = data.msg;

        this.emit('heartbeat', {
          monitor,
          heartbeat: data,
        });
      }
    });

    // Important heartbeats (status changes)
    this.socket.on('importantHeartbeatList', (monitorID: number, data: HeartbeatData[]) => {
      logger.info('Status change detected', {
        monitorID,
        latest: data[0]?.status === 1 ? 'UP' : 'DOWN',
      });

      this.emit('statusChange', {
        monitorID,
        heartbeats: data,
      });
    });

    // Uptime updates
    this.socket.on('uptime', (monitorID: number, period: number, uptime: number) => {
      const monitor = this.monitors.get(monitorID);
      if (monitor) {
        if (period === 24) {
          monitor.uptime24h = uptime;
        } else if (period === 720) {
          // 30 days
          monitor.uptime30d = uptime;
        }

        this.emit('uptime', { monitorID, period, uptime });
      }
    });

    // Disconnection handling with cleanup
    this.socket.on('disconnect', (reason) => {
      logger.warn('Disconnected from Uptime Kuma', { reason });
      this.connected = false;
      this.connectionMetrics.disconnectCount++;

      // Clear heartbeat interval
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = undefined;
      }

      this.emit('disconnect', reason);
    });

    // Reconnection
    this.socket.on('reconnect', (attemptNumber) => {
      logger.info('Reconnected to Uptime Kuma', { attemptNumber });
      this.connected = true;
      this.emit('reconnect', attemptNumber);

      // Re-request monitor list
      this.socket!.emit('monitorList');
    });
  }

  getMonitors(): MonitorStatus[] {
    return Array.from(this.monitors.values());
  }

  getMonitor(id: number): MonitorStatus | undefined {
    return this.monitors.get(id);
  }

  getMonitorByName(name: string): MonitorStatus | undefined {
    return Array.from(this.monitors.values()).find((m) => m.name === name);
  }

  disconnect(): void {
    this.cleanup();
  }

  // Enhanced cleanup method to prevent memory leaks
  private cleanup(): void {
    logger.debug('Cleaning up Uptime Kuma client resources');

    // Clear all timers
    if (this.reconnectTimer) {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Disconnect socket and remove all listeners
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = undefined;
    }

    // Clear state
    this.connected = false;
    this.monitors.clear();
    this.reconnectAttempts = 0;

    // Clear credentials from memory for security
    if (this.username) {
      this.username = undefined;
    }
    if (this.password) {
      this.password = undefined;
    }

    // Remove all event listeners
    this.removeAllListeners();

    logger.debug('Uptime Kuma client cleanup completed');
  }

  // Setup heartbeat to keep connection alive
  private setupHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Ping every 30 seconds
  }

  // Setup periodic cleanup interval
  private setupCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.performPeriodicCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  // Periodic cleanup to prevent memory accumulation
  private performPeriodicCleanup(): void {
    const now = Date.now();

    // Clean up old metrics
    if (now - this.lastCleanup > this.CLEANUP_INTERVAL) {
      this.lastCleanup = now;

      // Reset counters to prevent overflow
      if (this.connectionMetrics.messageCount > 10000) {
        this.connectionMetrics.messageCount = Math.floor(this.connectionMetrics.messageCount / 2);
      }

      logger.debug('Periodic cleanup completed', {
        monitorsCount: this.monitors.size,
        metrics: this.connectionMetrics,
      });
    }
  }

  // Validation methods
  private isValidMonitor(monitor: any): boolean {
    return (
      monitor &&
      typeof monitor === 'object' &&
      typeof monitor.monitorID === 'number' &&
      typeof monitor.name === 'string'
    );
  }

  private isValidHeartbeat(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.monitorID === 'number' &&
      typeof data.status === 'number' &&
      [0, 1, 2].includes(data.status)
    );
  }

  // Get connection metrics
  public getMetrics(): typeof this.connectionMetrics & { monitorsCount: number } {
    return {
      ...this.connectionMetrics,
      monitorsCount: this.monitors.size,
    };
  }

  // Force cleanup (for testing or emergency)
  public forceCleanup(): void {
    this.cleanup();
  }
}
