import { EventEmitter } from 'events';

import { io, Socket } from 'socket.io-client';

import { logger } from '@/utils/logger';
import { CatchError } from '../types/common';

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

  constructor(
    private url: string,
    private username?: string,
    private password?: string
  ) {
    super();
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
          reconnectionAttempts: 5,
          reconnectionDelay: 5000,
          timeout: 10000,
        });

        this.setupEventHandlers();

        this.socket.on('connect', async () => {
          logger.info('Connected to Uptime Kuma');
          this.connected = true;

          // Authenticate if credentials provided
          if (this.username && this.password) {
            try {
              await this.authenticate();
            } catch (error: CatchError) {
              logger.error('Authentication failed', { error });
              // Continue without auth - may have limited access
            }
          }

          // Request initial monitor list
          this.socket!.emit('monitorList');

          resolve();
        });

        this.socket.on('connect_error', (error) => {
          logger.error('Uptime Kuma connection error', {
            error: error instanceof Error ? error.message : ('Unknown error' as any),
          });
          if (!this.connected) {
            reject(new Error('Failed to connect to Uptime Kuma'));
          }
        });

        // Set timeout for initial connection
        setTimeout(() => {
          if (!this.connected) {
            this.disconnect();
            reject(new Error('Connection timeout'));
          }
        }, 15000);
      } catch (error: CatchError) {
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
        }
      );
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Monitor list update
    this.socket.on('monitorList', (data: Record<string, MonitorStatus>) => {
      logger.debug('Received monitor list', { count: Object.keys(data).length });

      this.monitors.clear();
      for (const [id, monitor] of Object.entries(data)) {
        this.monitors.set(Number(id), monitor);
      }

      this.emit('monitorList', Array.from(this.monitors.values()));
    });

    // Real-time heartbeat updates
    this.socket.on('heartbeat', (data: HeartbeatData) => {
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

    // Disconnection handling
    this.socket.on('disconnect', (reason) => {
      logger.warn('Disconnected from Uptime Kuma', { reason });
      this.connected = false;
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
    }

    this.connected = false;
    this.monitors.clear();
  }
}
