# Task: Uptime Kuma Real-time Monitoring Integration

**Priority:** High  
**Estimated Duration:** 2 days  
**Dependencies:** Socket.io server configuration (Phase 1)  
**Phase:** 2 (Week 7)

## Objective
Integrate with Uptime Kuma to provide real-time service status monitoring, enabling users to see the health of all integrated services (Plex, Overseerr, etc.) on the dashboard.

## Background
Uptime Kuma provides real-time monitoring for services. Our integration will connect to Uptime Kuma's Socket.io server to receive live status updates and display them on the MediaNest dashboard.

### Architecture Overview
- **Primary API**: Socket.io WebSocket for real-time events (no REST API for monitor control)
- **Authentication**: Session-based auth required before accessing monitor data
- **Events**: Real-time heartbeat updates, status changes, and uptime metrics
- **Limitations**: No official public API documentation; integration requires reverse-engineering or custom modifications

## Detailed Requirements

### 1. Uptime Kuma Socket.io Client
```typescript
// backend/src/integrations/uptime-kuma/uptime-kuma.client.ts
import { io, Socket } from 'socket.io-client';
import { logger } from '@/utils/logger';
import { EventEmitter } from 'events';

export interface MonitorStatus {
  monitorID: number;
  name: string;
  url?: string;
  type: string;
  interval: number;
  retryInterval: number;
  keyword?: string;
  hostname?: string;
  port?: number;
  active: boolean;
  status: boolean; // true = up, false = down
  msg?: string;
  ping?: number; // Response time in ms
  avgPing?: number;
  uptime24h?: number;
  uptime30d?: number;
  certInfo?: {
    valid: boolean;
    validTo: string;
    daysRemaining: number;
  };
}

export interface HeartbeatData {
  monitorID: number;
  status: 0 | 1 | 2; // 0 = down, 1 = up, 2 = pending
  time: string;
  msg: string;
  ping?: number;
  important?: boolean;
  duration?: number;
}

export class UptimeKumaClient extends EventEmitter {
  private socket?: Socket;
  private monitors: Map<number, MonitorStatus> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;

  constructor(
    private url: string,
    private username?: string,
    private password?: string
  ) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.url, {
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
          timeout: 10000
        });

        this.setupEventHandlers();

        this.socket.on('connect', async () => {
          logger.info('Connected to Uptime Kuma');
          this.reconnectAttempts = 0;
          
          // Authenticate if credentials provided
          if (this.username && this.password) {
            await this.authenticate();
          }
          
          // Request initial monitor list
          this.socket!.emit('monitorList');
          
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          logger.error('Uptime Kuma connection error', { error: error.message });
          this.reconnectAttempts++;
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(new Error('Failed to connect to Uptime Kuma'));
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private async authenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket!.emit('login', {
        username: this.username,
        password: this.password,
        token: ''
      }, (res: any) => {
        if (res.ok) {
          logger.info('Authenticated with Uptime Kuma');
          resolve();
        } else {
          logger.error('Uptime Kuma authentication failed', { msg: res.msg });
          reject(new Error(res.msg || 'Authentication failed'));
        }
      });
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Key Socket.io Events from Uptime Kuma:
    
    // Monitor list update - receives full monitor configuration
    this.socket.on('monitorList', (data: Record<string, MonitorStatus>) => {
      logger.debug('Received monitor list', { count: Object.keys(data).length });
      
      this.monitors.clear();
      for (const [id, monitor] of Object.entries(data)) {
        this.monitors.set(Number(id), monitor);
      }
      
      this.emit('monitorList', Array.from(this.monitors.values()));
    });

    // Real-time heartbeat updates (emitted at check interval)
    this.socket.on('heartbeat', (data: HeartbeatData) => {
      logger.debug('Received heartbeat', {
        monitorID: data.monitorID,
        status: data.status, // 0=down, 1=up, 2=pending
        ping: data.ping
      });
      
      const monitor = this.monitors.get(data.monitorID);
      if (monitor) {
        monitor.status = data.status === 1;
        monitor.ping = data.ping;
        monitor.msg = data.msg;
        
        this.emit('heartbeat', {
          monitor,
          heartbeat: data
        });
      }
    });

    // Important heartbeats (status changes only)
    this.socket.on('importantHeartbeatList', (monitorID: number, data: HeartbeatData[]) => {
      logger.info('Important heartbeat - status change detected', {
        monitorID,
        count: data.length,
        latest: data[0],
        transition: data[0]?.status === 1 ? 'UP' : 'DOWN'
      });
      
      this.emit('statusChange', {
        monitorID,
        heartbeats: data
      });
    });

    // Average ping updates
    this.socket.on('avgPing', (monitorID: number, avgPing: number) => {
      const monitor = this.monitors.get(monitorID);
      if (monitor) {
        monitor.avgPing = avgPing;
        this.emit('avgPing', { monitorID, avgPing });
      }
    });

    // Uptime updates
    this.socket.on('uptime', (monitorID: number, period: number, uptime: number) => {
      const monitor = this.monitors.get(monitorID);
      if (monitor) {
        if (period === 24) {
          monitor.uptime24h = uptime;
        } else if (period === 720) { // 30 days
          monitor.uptime30d = uptime;
        }
        
        this.emit('uptime', { monitorID, period, uptime });
      }
    });

    // Certificate info updates
    this.socket.on('certInfo', (monitorID: number, certInfo: any) => {
      const monitor = this.monitors.get(monitorID);
      if (monitor) {
        monitor.certInfo = certInfo;
        this.emit('certInfo', { monitorID, certInfo });
      }
    });

    // Disconnection handling
    this.socket.on('disconnect', (reason) => {
      logger.warn('Disconnected from Uptime Kuma', { reason });
      this.emit('disconnect', reason);
    });

    // Reconnection
    this.socket.on('reconnect', (attemptNumber) => {
      logger.info('Reconnected to Uptime Kuma', { attemptNumber });
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
    return Array.from(this.monitors.values()).find(m => m.name === name);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}
```

### 2. Service Status Manager
```typescript
// backend/src/services/status.service.ts
import { UptimeKumaClient } from '@/integrations/uptime-kuma/uptime-kuma.client';
import { serviceConfigRepository } from '@/repositories';
import { cacheService } from '@/services/cache.service';
import { socketService } from '@/services/socket.service';
import { logger } from '@/utils/logger';

export interface ServiceStatus {
  name: string;
  displayName: string;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  responseTime?: number;
  uptime24h?: number;
  uptime30d?: number;
  lastCheck?: Date;
  message?: string;
}

export class StatusService {
  private uptimeKumaClient?: UptimeKumaClient;
  private serviceMapping: Map<string, string> = new Map(); // Monitor name -> Service name
  private statusCache: Map<string, ServiceStatus> = new Map();
  private pollingInterval?: NodeJS.Timer;

  async initialize(): Promise<void> {
    try {
      const config = await serviceConfigRepository.findByName('uptime-kuma');
      if (!config || !config.enabled) {
        logger.warn('Uptime Kuma service is disabled');
        this.startFallbackPolling();
        return;
      }

      // Initialize service mapping
      this.serviceMapping.set('Plex Media Server', 'plex');
      this.serviceMapping.set('Overseerr', 'overseerr');
      this.serviceMapping.set('MediaNest API', 'api');
      this.serviceMapping.set('MediaNest Frontend', 'frontend');

      // Connect to Uptime Kuma
      this.uptimeKumaClient = new UptimeKumaClient(
        config.serviceUrl,
        config.configData?.username,
        config.configData?.password
      );

      await this.connectToUptimeKuma();
    } catch (error) {
      logger.error('Failed to initialize status service', { error });
      this.startFallbackPolling();
    }
  }

  private async connectToUptimeKuma(): Promise<void> {
    if (!this.uptimeKumaClient) return;

    try {
      await this.uptimeKumaClient.connect();
      
      // Set up event handlers
      this.uptimeKumaClient.on('monitorList', (monitors) => {
        this.updateAllStatuses(monitors);
      });

      this.uptimeKumaClient.on('heartbeat', ({ monitor, heartbeat }) => {
        this.updateServiceStatus(monitor);
      });

      this.uptimeKumaClient.on('statusChange', ({ monitorID }) => {
        const monitor = this.uptimeKumaClient!.getMonitor(monitorID);
        if (monitor) {
          this.updateServiceStatus(monitor);
          this.notifyStatusChange(monitor);
        }
      });

      this.uptimeKumaClient.on('disconnect', () => {
        logger.warn('Lost connection to Uptime Kuma, starting fallback polling');
        this.startFallbackPolling();
      });

      this.uptimeKumaClient.on('reconnect', () => {
        logger.info('Reconnected to Uptime Kuma, stopping fallback polling');
        this.stopFallbackPolling();
      });

    } catch (error) {
      logger.error('Failed to connect to Uptime Kuma', { error });
      this.startFallbackPolling();
    }
  }

  private updateServiceStatus(monitor: any): void {
    const serviceName = this.serviceMapping.get(monitor.name);
    if (!serviceName) return;

    const status: ServiceStatus = {
      name: serviceName,
      displayName: monitor.name,
      status: this.mapMonitorStatus(monitor),
      responseTime: monitor.ping,
      uptime24h: monitor.uptime24h,
      uptime30d: monitor.uptime30d,
      lastCheck: new Date(),
      message: monitor.msg
    };

    this.statusCache.set(serviceName, status);
    
    // Update cache
    cacheService.set(`status:${serviceName}`, status, { ttl: 300 });
    
    // Emit to connected clients
    socketService.emit('service:status', status);
  }

  private updateAllStatuses(monitors: any[]): void {
    const allStatuses: ServiceStatus[] = [];
    
    for (const monitor of monitors) {
      const serviceName = this.serviceMapping.get(monitor.name);
      if (serviceName) {
        const status: ServiceStatus = {
          name: serviceName,
          displayName: monitor.name,
          status: this.mapMonitorStatus(monitor),
          responseTime: monitor.ping,
          uptime24h: monitor.uptime24h,
          uptime30d: monitor.uptime30d,
          lastCheck: new Date(),
          message: monitor.msg
        };
        
        this.statusCache.set(serviceName, status);
        allStatuses.push(status);
      }
    }
    
    // Update cache
    cacheService.set('status:all', allStatuses, { ttl: 300 });
    
    // Emit to connected clients
    socketService.emit('service:status:all', allStatuses);
  }

  private mapMonitorStatus(monitor: any): 'up' | 'down' | 'degraded' | 'unknown' {
    if (!monitor.active) return 'unknown';
    if (monitor.status === false) return 'down';
    if (monitor.ping && monitor.ping > 1000) return 'degraded';
    return 'up';
  }

  private notifyStatusChange(monitor: any): void {
    const serviceName = this.serviceMapping.get(monitor.name);
    if (!serviceName) return;

    const status = this.mapMonitorStatus(monitor);
    const message = status === 'down' 
      ? `${monitor.name} is currently unavailable`
      : `${monitor.name} is back online`;

    socketService.emit('notification', {
      type: 'service-status',
      severity: status === 'down' ? 'error' : 'info',
      title: 'Service Status Update',
      message,
      data: { service: serviceName, status }
    });
  }

  // Fallback polling when Uptime Kuma is unavailable
  private startFallbackPolling(): void {
    if (this.pollingInterval) return;

    logger.info('Starting fallback status polling');
    
    this.pollingInterval = setInterval(async () => {
      await this.pollServiceStatuses();
    }, 30000); // Poll every 30 seconds
    
    // Initial poll
    this.pollServiceStatuses();
  }

  private stopFallbackPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  private async pollServiceStatuses(): Promise<void> {
    const services = ['plex', 'overseerr', 'api'];
    const statuses: ServiceStatus[] = [];
    
    for (const service of services) {
      const status = await this.checkServiceHealth(service);
      statuses.push(status);
      this.statusCache.set(service, status);
    }
    
    // Update cache and emit
    cacheService.set('status:all', statuses, { ttl: 300 });
    socketService.emit('service:status:all', statuses);
  }

  private async checkServiceHealth(service: string): Promise<ServiceStatus> {
    // Simple health check implementation
    try {
      const config = await serviceConfigRepository.findByName(service);
      if (!config || !config.enabled) {
        return {
          name: service,
          displayName: service.charAt(0).toUpperCase() + service.slice(1),
          status: 'unknown',
          message: 'Service not configured'
        };
      }

      // Attempt HTTP health check
      const start = Date.now();
      const response = await fetch(`${config.serviceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      const responseTime = Date.now() - start;
      
      return {
        name: service,
        displayName: service.charAt(0).toUpperCase() + service.slice(1),
        status: response.ok ? 'up' : 'down',
        responseTime,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        name: service,
        displayName: service.charAt(0).toUpperCase() + service.slice(1),
        status: 'down',
        lastCheck: new Date(),
        message: error.message
      };
    }
  }

  // Public methods
  async getAllStatuses(): Promise<ServiceStatus[]> {
    // Try cache first
    const cached = await cacheService.get<ServiceStatus[]>('status:all');
    if (cached) {
      return cached;
    }
    
    // Return from memory cache
    return Array.from(this.statusCache.values());
  }

  async getServiceStatus(service: string): Promise<ServiceStatus | null> {
    // Try cache first
    const cached = await cacheService.get<ServiceStatus>(`status:${service}`);
    if (cached) {
      return cached;
    }
    
    // Return from memory cache
    return this.statusCache.get(service) || null;
  }

  disconnect(): void {
    this.stopFallbackPolling();
    if (this.uptimeKumaClient) {
      this.uptimeKumaClient.disconnect();
    }
  }
}

export const statusService = new StatusService();
```

### 3. WebSocket Room Management
```typescript
// backend/src/socket/handlers/status.handlers.ts
import { Server, Socket } from 'socket.io';
import { statusService } from '@/services/status.service';
import { logger } from '@/utils/logger';

export function statusHandlers(io: Server, socket: Socket): void {
  // Join status room for real-time updates
  socket.on('status:subscribe', async () => {
    try {
      socket.join('status-updates');
      logger.debug('Client subscribed to status updates', { 
        socketId: socket.id 
      });
      
      // Send current status immediately
      const statuses = await statusService.getAllStatuses();
      socket.emit('service:status:all', statuses);
    } catch (error) {
      logger.error('Failed to subscribe to status', { error });
      socket.emit('error', { 
        message: 'Failed to subscribe to status updates' 
      });
    }
  });

  // Unsubscribe from status updates
  socket.on('status:unsubscribe', () => {
    socket.leave('status-updates');
    logger.debug('Client unsubscribed from status updates', { 
      socketId: socket.id 
    });
  });

  // Get status for specific service
  socket.on('status:get', async (service: string) => {
    try {
      const status = await statusService.getServiceStatus(service);
      socket.emit(`service:status:${service}`, status);
    } catch (error) {
      logger.error('Failed to get service status', { service, error });
      socket.emit('error', { 
        message: `Failed to get status for ${service}` 
      });
    }
  });

  // Request refresh of all statuses
  socket.on('status:refresh', async () => {
    try {
      // This would trigger a manual refresh in Uptime Kuma
      const statuses = await statusService.getAllStatuses();
      io.to('status-updates').emit('service:status:all', statuses);
    } catch (error) {
      logger.error('Failed to refresh statuses', { error });
      socket.emit('error', { 
        message: 'Failed to refresh service statuses' 
      });
    }
  });
}
```

### 4. Status API Endpoints
```typescript
// backend/src/routes/v1/status.ts
import { Router } from 'express';
import { statusService } from '@/services/status.service';
import { authenticate } from '@/middleware/auth';
import { asyncHandler } from '@/utils/async-handler';

const router = Router();

// Get all service statuses
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const statuses = await statusService.getAllStatuses();
  
  res.json({
    success: true,
    data: statuses,
    meta: {
      timestamp: new Date(),
      count: statuses.length
    }
  });
}));

// Get specific service status
router.get('/:service', authenticate, asyncHandler(async (req, res) => {
  const { service } = req.params;
  const status = await statusService.getServiceStatus(service);
  
  if (!status) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'SERVICE_NOT_FOUND',
        message: `Service '${service}' not found`
      }
    });
  }
  
  res.json({
    success: true,
    data: status
  });
}));

export default router;
```

## Technical Implementation Details

### Connection Strategy
1. Primary: WebSocket connection to Uptime Kuma
2. Fallback: HTTP polling every 30 seconds
3. Automatic reconnection with exponential backoff
4. Graceful degradation when Uptime Kuma unavailable

### Integration Challenges (2024)
- **No REST API**: Monitor control requires Socket.io events or database manipulation
- **Authentication**: Must establish session before receiving monitor data
- **Event Documentation**: No official docs; events discovered through reverse-engineering
- **Workaround**: Some developers modify Uptime Kuma source to add REST endpoints

### Real-time Updates
- WebSocket rooms for efficient broadcasting
- Status changes pushed immediately to all connected clients
- Heartbeat events provide live response time updates (every 20s by default)
- Important status changes trigger notifications

### Caching Strategy
- All statuses: 5 minutes
- Individual service: 5 minutes
- Memory cache for instant access
- Redis cache for distributed systems

## Acceptance Criteria
1. ✅ Connects to Uptime Kuma via WebSocket
2. ✅ Receives real-time status updates
3. ✅ Maps monitors to MediaNest services
4. ✅ Falls back to polling when disconnected
5. ✅ Broadcasts updates to connected clients
6. ✅ Notifications for service status changes
7. ✅ Caches status data appropriately
8. ✅ Handles connection failures gracefully

## Testing Requirements
1. **Unit Tests:**
   - Client connection logic
   - Event handler processing
   - Status mapping functions
   - Fallback polling mechanism

2. **Integration Tests:**
   - Real Uptime Kuma connection
   - WebSocket event flow
   - Reconnection behavior
   - Cache integration

## Dependencies
- `socket.io-client` - WebSocket client
- Existing Socket.io server
- Cache service
- Service config repository

## References
- [Uptime Kuma Wiki](https://github.com/louislam/uptime-kuma/wiki)
- [Socket.io Client Documentation](https://socket.io/docs/v4/client-api/)
- [WebSocket Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications)

## Status
- [ ] Not Started
- [ ] In Progress
- [x] Completed
- [ ] Blocked

## Implementation Summary (MVP)

### What Was Built
1. **Simplified Uptime Kuma Client** (`backend/src/integrations/uptime-kuma/uptime-kuma.client.ts`)
   - Socket.io client for real-time updates
   - Basic authentication support
   - Monitor list and heartbeat event handling
   - Simple reconnection logic
   - Event emitter for status changes

2. **Status Service Layer** (`backend/src/services/status.service.ts`)
   - Service initialization with fallback polling
   - Monitor to service name mapping
   - Real-time status updates via WebSocket
   - Fallback polling when Uptime Kuma unavailable
   - Redis caching for status data (5 minutes)
   - Status change notifications

3. **Dashboard Controller** (`backend/src/controllers/dashboard.controller.ts`)
   - GET /api/v1/dashboard/status - All service statuses
   - GET /api/v1/dashboard/status/:service - Specific service status
   - GET /api/v1/dashboard/stats - Dashboard statistics
   - GET /api/v1/dashboard/notifications - User notifications

4. **WebSocket Handlers** (`backend/src/socket/handlers/status.handlers.ts`)
   - subscribe:status - Join status update room
   - unsubscribe:status - Leave status update room
   - status:get - Get specific service status
   - admin:refresh-status - Force status refresh (admin only)

### MVP Simplifications
- Basic reconnection instead of complex strategies
- Simple polling fallback (30s intervals)
- Mock status data when Uptime Kuma unavailable
- No advanced monitoring features
- Basic service mapping configuration

### Test Coverage
- Unit tests for Socket.io event handling
- Integration tests for fallback polling
- WebSocket room management tests
- Service status mapping tests