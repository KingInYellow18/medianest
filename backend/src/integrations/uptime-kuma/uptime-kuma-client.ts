import { EventEmitter } from 'events';

import WebSocket from 'ws';

import { CircuitBreaker } from '../../utils/circuit-breaker';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/error-handling';

export interface UptimeKumaMonitor {
  id: number;
  name: string;
  url?: string;
  hostname?: string;
  port?: number;
  type: string;
  interval: number;
  active: boolean;
  tags: UptimeKumaTag[];
}

export interface UptimeKumaTag {
  id: number;
  name: string;
  color: string;
}

export interface UptimeKumaHeartbeat {
  id: number;
  monitorId: number;
  status: 0 | 1; // 0 = down, 1 = up
  time: string;
  msg: string;
  ping?: number;
  duration?: number;
  down_count: number;
  up_count: number;
}

export interface UptimeKumaStatus {
  ok: boolean;
  msg: string;
}

export interface UptimeKumaInfo {
  version: string;
  latestVersion: string;
  primaryBaseURL: string;
  serverTimezone: string;
  serverTimezoneOffset: string;
}

export interface UptimeKumaStats {
  up: number;
  down: number;
  unknown: number;
  pause: number;
  upRate?: string;
}

export interface UptimeKumaConfig {
  url: string;
  username?: string;
  password?: string;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  timeout?: number;
}

export class UptimeKumaClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastHeartbeat: Date | null = null;
  private circuitBreaker: CircuitBreaker;
  // Message ID counter for WebSocket communication
  private messageId = 0;

  private monitors: Map<number, UptimeKumaMonitor> = new Map();
  private latestHeartbeats: Map<number, UptimeKumaHeartbeat> = new Map();
  private stats: UptimeKumaStats = { up: 0, down: 0, unknown: 0, pause: 0 };

  constructor(private config: UptimeKumaConfig) {
    super();

    this.circuitBreaker = new CircuitBreaker('uptime-kuma-websocket', {
      failureThreshold: 3,
      resetTimeout: 30000,
      monitoringPeriod: 60000,
      expectedErrors: ['ENOTFOUND', 'ECONNREFUSED', 'timeout', 'websocket'],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('connect', () => {
      logger.info('Uptime Kuma WebSocket connected');
      this.startHeartbeat();
    });

    this.on('disconnect', () => {
      logger.warn('Uptime Kuma WebSocket disconnected');
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.on('error', (error) => {
      logger.error('Uptime Kuma WebSocket error', { error: getErrorMessage(error) });
    });
  }

  async connect(): Promise<void> {
    return this.circuitBreaker.execute(async () => {
      await this.establishConnection();
    });
  }

  private async establishConnection(): Promise<void> {
    if (this.ws) {
      this.ws.close();
    }

    const wsUrl = this.config.url.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket';

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.timeout || 10000);

      this.ws = new WebSocket(wsUrl, {
        headers: {
          'User-Agent': 'MediaNest/1.0 Uptime-Kuma-Client',
        },
      });

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.lastHeartbeat = new Date();
        this.emit('connect');
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', (code, reason) => {
        clearTimeout(timeout);
        this.isConnected = false;
        this.emit('disconnect', { code, reason: reason.toString() });
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        this.emit('error', error);
        reject(error);
      });
    });
  }

  private handleMessage(message: string): void {
    try {
      // Socket.io protocol parsing
      if (message.startsWith('0')) {
        // Connection message
        return;
      }

      if (message.startsWith('40')) {
        // Connected to namespace
        this.authenticate();
        return;
      }

      if (message.startsWith('42')) {
        // Event message
        const eventData = message.substring(2);
        const parsed = JSON.parse(eventData);

        if (Array.isArray(parsed) && parsed.length >= 2) {
          const [eventName, data] = parsed;
          this.handleEvent(eventName, data);
        }
      }

      if (message === '2') {
        // Ping
        this.ws?.send('3'); // Pong
        this.lastHeartbeat = new Date();
      }
    } catch (error: unknown) {
      logger.error('Failed to parse Uptime Kuma message', {
        message: message.substring(0, 100),
        error: getErrorMessage(error),
      });
    }
  }

  private handleEvent(eventName: string, data: unknown): void {
    switch (eventName) {
      case 'monitorList':
        this.handleMonitorList(data as Record<string, UptimeKumaMonitor>);
        break;

      case 'heartbeat':
        this.handleHeartbeat(data as UptimeKumaHeartbeat);
        break;

      case 'heartbeatList':
        this.handleHeartbeatList(data as Record<string, UptimeKumaHeartbeat[]>);
        break;

      case 'info':
        this.emit('info', data);
        break;

      case 'avgPing':
        this.emit('avgPing', data);
        break;

      default:
        logger.debug('Unhandled Uptime Kuma event', { eventName, data });
    }
  }

  private handleMonitorList(monitors: Record<string, UptimeKumaMonitor>): void {
    this.monitors.clear();

    Object.values(monitors).forEach((monitor) => {
      this.monitors.set(monitor.id, monitor);
    });

    this.updateStats();
    this.emit('monitorsUpdated', this.monitors);
  }

  private handleHeartbeat(heartbeat: UptimeKumaHeartbeat): void {
    this.latestHeartbeats.set(heartbeat.monitorId, heartbeat);
    this.updateStats();
    this.emit('heartbeat', heartbeat);
  }

  private handleHeartbeatList(heartbeats: Record<string, UptimeKumaHeartbeat[]>): void {
    Object.entries(heartbeats).forEach(([monitorId, monitorHeartbeats]) => {
      const latest = monitorHeartbeats[monitorHeartbeats.length - 1];
      if (latest) {
        this.latestHeartbeats.set(parseInt(monitorId), latest);
      }
    });

    this.updateStats();
    this.emit('heartbeatsUpdated', this.latestHeartbeats);
  }

  private updateStats(): void {
    this.stats = { up: 0, down: 0, unknown: 0, pause: 0 };

    this.monitors.forEach((monitor) => {
      if (!monitor.active) {
        this.stats.pause++;
        return;
      }

      const heartbeat = this.latestHeartbeats.get(monitor.id);
      if (!heartbeat) {
        this.stats.unknown++;
      } else if (heartbeat.status === 1) {
        this.stats.up++;
      } else {
        this.stats.down++;
      }
    });

    const total = this.stats.up + this.stats.down;
    if (total > 0) {
      this.stats.upRate = ((this.stats.up / total) * 100).toFixed(1);
    }

    this.emit('statsUpdated', this.stats);
  }

  private authenticate(): void {
    if (this.config.username && this.config.password) {
      this.sendMessage('login', {
        username: this.config.username,
        password: this.config.password,
        token: '',
      });
    } else {
      // Request monitor list without authentication
      this.sendMessage('getMonitorList');
    }
  }

  private sendMessage(event: string, data?: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send message, WebSocket not connected', { event });
      return;
    }

    const message = data !== undefined ? [event, data] : [event];
    const socketIoMessage = '42' + JSON.stringify(message);

    this.ws.send(socketIoMessage);
  }

  private startHeartbeat(): void {
    const interval = this.config.heartbeatInterval || 30000;

    this.heartbeatTimer = setInterval(() => {
      if (this.lastHeartbeat && Date.now() - this.lastHeartbeat.getTime() > interval * 2) {
        logger.warn('Uptime Kuma heartbeat timeout, reconnecting');
        this.disconnect();
        this.scheduleReconnect();
      }
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    const interval = this.config.reconnectInterval || 5000;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      logger.info('Attempting to reconnect to Uptime Kuma');
      this.connect().catch((error: any) => {
        logger.error('Reconnection failed', { error: getErrorMessage(error) });
        this.scheduleReconnect();
      });
    }, interval);
  }

  disconnect(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
  }

  getMonitors(): Map<number, UptimeKumaMonitor> {
    return new Map(this.monitors);
  }

  getLatestHeartbeats(): Map<number, UptimeKumaHeartbeat> {
    return new Map(this.latestHeartbeats);
  }

  getStats(): UptimeKumaStats {
    return { ...this.stats };
  }

  getMonitorStatus(monitorId: number): 'up' | 'down' | 'unknown' | 'paused' {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) return 'unknown';

    if (!monitor.active) return 'paused';

    const heartbeat = this.latestHeartbeats.get(monitorId);
    if (!heartbeat) return 'unknown';

    return heartbeat.status === 1 ? 'up' : 'down';
  }

  isHealthy(): boolean {
    return this.isConnected && this.circuitBreaker.getStats().state === 'CLOSED';
  }

  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  static createClient(config: UptimeKumaConfig): UptimeKumaClient {
    return new UptimeKumaClient(config);
  }
}
