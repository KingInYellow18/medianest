import {
  ServiceStatus as SharedServiceStatus,
  ServiceName,
  SOCKET_EVENTS,
} from '@medianest/shared';

import { redisClient } from '@/config/redis';
import { UptimeKumaClient, MonitorStatus } from '@/integrations/uptime-kuma/uptime-kuma.client';
import { serviceConfigRepository } from '@/repositories';
import { socketService } from '@/services/socket.service';
import { logger } from '@/utils/logger';

import { encryptionService } from './encryption.service';

// Extend the shared ServiceStatus type for backend-specific fields
export interface ServiceStatus
  extends Omit<SharedServiceStatus, 'id' | 'uptime' | 'details' | 'features'> {
  message?: string;
  uptime24h?: number;
  uptime30d?: number;
  lastCheck?: Date;
}

export class StatusService {
  private uptimeKumaClient?: UptimeKumaClient;
  private serviceMapping: Map<string, string> = new Map(); // Monitor name -> Service name
  private statusCache: Map<string, ServiceStatus> = new Map();
  private pollingInterval?: NodeJS.Timer;
  private cachePrefix = 'status:';
  private cacheTTL = 300; // 5 minutes

  async initialize(): Promise<void> {
    try {
      const config = await serviceConfigRepository.findByName('uptime-kuma');
      if (!config || !config.enabled) {
        logger.warn('Uptime Kuma service is disabled, using fallback polling');
        this.startFallbackPolling();
        return;
      }

      // Initialize service mapping (customize based on your monitor names)
      this.serviceMapping.set('Plex Media Server', 'plex');
      this.serviceMapping.set('Overseerr', 'overseerr');
      this.serviceMapping.set('MediaNest', 'medianest');

      // Decrypt credentials if needed
      const username = config.configData?.username;
      const password = config.configData?.password
        ? await encryptionService.decrypt(config.configData.password)
        : undefined;

      // Connect to Uptime Kuma
      this.uptimeKumaClient = new UptimeKumaClient(config.serviceUrl, username, password);

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
      this.uptimeKumaClient.on('monitorList', async (monitors) => {
        await this.updateAllStatuses(monitors);
      });

      this.uptimeKumaClient.on('heartbeat', async ({ monitor }) => {
        await this.updateServiceStatus(monitor);
      });

      this.uptimeKumaClient.on('statusChange', async ({ monitorID }) => {
        const monitor = this.uptimeKumaClient!.getMonitor(monitorID);
        if (monitor) {
          await this.updateServiceStatus(monitor);
          await this.notifyStatusChange(monitor);
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

  private async updateServiceStatus(monitor: any): Promise<void> {
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
      message: monitor.msg,
    };

    this.statusCache.set(serviceName, status);

    // Update Redis cache
    redisClient
      .setex(`${this.cachePrefix}${serviceName}`, this.cacheTTL, JSON.stringify(status))
      .catch((err) => logger.error('Failed to cache status', { err }));

    // Check if monitor is public
    const { monitorVisibilityService } = await import('./monitor-visibility.service');
    const isPublic = await monitorVisibilityService.isMonitorPublic(monitor.monitorID);

    // Emit to connected clients based on visibility
    const io = socketService.getIo();
    if (io) {
      io.sockets.sockets.forEach((socket) => {
        // Admins get all updates, users only get public monitor updates
        if (socket.data.user?.role === 'ADMIN' || isPublic) {
          socket.emit('service:status', status);
        }
      });
    }
  }

  private async updateAllStatuses(monitors: any[]): Promise<void> {
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
          message: monitor.msg,
        };

        this.statusCache.set(serviceName, status);
        allStatuses.push(status);
      }
    }

    // Update Redis cache
    redisClient
      .setex(`${this.cachePrefix}all`, this.cacheTTL, JSON.stringify(allStatuses))
      .catch((err) => logger.error('Failed to cache all statuses', { err }));

    // Get visibility settings for filtering
    const { monitorVisibilityService } = await import('./monitor-visibility.service');
    const monitorIds = monitors.map((m) => m.monitorID);
    const visibilityMap = await monitorVisibilityService.getMonitorVisibility(monitorIds);

    // Filter statuses for public visibility
    const publicStatuses = allStatuses.filter((status) => {
      const monitor = monitors.find((m) => this.serviceMapping.get(m.name) === status.name);
      return monitor && visibilityMap.get(monitor.monitorID) === true;
    });

    // Cache public statuses separately
    redisClient
      .setex(`${this.cachePrefix}public`, this.cacheTTL, JSON.stringify(publicStatuses))
      .catch((err) => logger.error('Failed to cache public statuses', { err }));

    // Emit to connected clients based on their role
    const io = socketService.getIo();
    if (io) {
      // Emit to admin users (all statuses)
      io.sockets.sockets.forEach((socket) => {
        if (socket.data.user?.role === 'ADMIN') {
          socket.emit('service:status:all', allStatuses);
        } else {
          // Regular users only get public statuses
          socket.emit('service:status:all', publicStatuses);
        }
      });
    }
  }

  private mapMonitorStatus(monitor: any): 'up' | 'down' | 'degraded' {
    if (!monitor.active) return 'down';
    if (monitor.status === false) return 'down';
    if (monitor.ping && monitor.ping > 1000) return 'degraded';
    return 'up';
  }

  private async notifyStatusChange(monitor: any): Promise<void> {
    const serviceName = this.serviceMapping.get(monitor.name);
    if (!serviceName) return;

    const status = this.mapMonitorStatus(monitor);
    const message =
      status === 'down'
        ? `${monitor.name} is currently unavailable`
        : `${monitor.name} is back online`;

    // Check if monitor is public
    const { monitorVisibilityService } = await import('./monitor-visibility.service');
    const isPublic = await monitorVisibilityService.isMonitorPublic(monitor.monitorID);

    const notification = {
      type: 'service-status',
      severity: status === 'down' ? 'error' : 'info',
      title: 'Service Status Update',
      message,
      data: { service: serviceName, status },
    };

    // Emit notification based on visibility
    const io = socketService.getIo();
    if (io) {
      io.sockets.sockets.forEach((socket) => {
        // Admins get all notifications, users only get public monitor notifications
        if (socket.data.user?.role === 'ADMIN' || isPublic) {
          socket.emit('notification', notification);
        }
      });
    }
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
    const services = ['plex', 'overseerr', 'medianest'];
    const statuses: ServiceStatus[] = [];

    for (const service of services) {
      const status = await this.checkServiceHealth(service);
      statuses.push(status);
      this.statusCache.set(service, status);
    }

    // Update cache and emit
    await redisClient.setex(`${this.cachePrefix}all`, this.cacheTTL, JSON.stringify(statuses));
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
          status: 'down',
          message: 'Service not configured',
          lastCheck: new Date(),
          lastCheckAt: new Date(),
        };
      }

      // For MVP, just return a mock status
      // In production, you'd make actual HTTP health checks
      return {
        name: service,
        displayName: service.charAt(0).toUpperCase() + service.slice(1),
        status: 'up',
        responseTime: Math.floor(Math.random() * 100),
        uptime24h: 99.9,
        uptime30d: 99.5,
        lastCheck: new Date(),
        lastCheckAt: new Date(),
      };
    } catch (error) {
      return {
        name: service,
        displayName: service.charAt(0).toUpperCase() + service.slice(1),
        status: 'down',
        lastCheck: new Date(),
        lastCheckAt: new Date(),
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Public methods
  async getAllStatuses(isAdmin: boolean = false): Promise<ServiceStatus[]> {
    // Import monitor visibility service dynamically to avoid circular dependency
    const { monitorVisibilityService } = await import('./monitor-visibility.service');

    // Get filtered monitors based on user role
    const filteredMonitors = await monitorVisibilityService.getFilteredMonitors(isAdmin);
    const filteredMonitorNames = new Set(filteredMonitors.map((m) => m.name));

    // Try cache first for all statuses
    const cacheKey = isAdmin ? `${this.cachePrefix}all` : `${this.cachePrefix}public`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const allStatuses = JSON.parse(cached) as ServiceStatus[];
      // Filter based on visibility
      return allStatuses.filter((status) =>
        filteredMonitorNames.has(status.displayName || status.name),
      );
    }

    // Return from memory cache, filtered by visibility
    return Array.from(this.statusCache.values()).filter((status) =>
      filteredMonitorNames.has(status.displayName || status.name),
    );
  }

  async getServiceStatus(service: string): Promise<ServiceStatus | null> {
    // Try cache first
    const cached = await redisClient.get(`${this.cachePrefix}${service}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Return from memory cache
    return this.statusCache.get(service) || null;
  }

  async refreshServiceStatus(service: string): Promise<ServiceStatus> {
    logger.info(`Manually refreshing status for service: ${service}`);

    // If Uptime Kuma is connected, request immediate update
    if (this.uptimeKumaClient?.isConnected) {
      const monitors = this.uptimeKumaClient.getMonitors();
      for (const monitor of monitors) {
        const serviceName = this.serviceMapping.get(monitor.name);
        if (serviceName === service) {
          // Force a health check by emitting a refresh request
          this.uptimeKumaClient.emit('refreshMonitor', monitor.id);

          // Return the latest cached status
          const status = this.statusCache.get(service);
          if (status) return status;
          break;
        }
      }
    }

    // Fallback: manually check service health
    const status = await this.checkServiceHealth(service);
    this.statusCache.set(service, status);

    // Update cache
    await redisClient.setex(`${this.cachePrefix}${service}`, this.cacheTTL, JSON.stringify(status));

    return status;
  }

  disconnect(): void {
    this.stopFallbackPolling();
    if (this.uptimeKumaClient) {
      this.uptimeKumaClient.disconnect();
    }
  }

  // Get all monitors from Uptime Kuma
  getUptimeKumaMonitors(): MonitorStatus[] {
    if (!this.uptimeKumaClient || !this.uptimeKumaClient.isConnected) {
      return [];
    }
    return this.uptimeKumaClient.getMonitors();
  }

  // Get specific monitor by ID
  getUptimeKumaMonitor(monitorId: number): MonitorStatus | undefined {
    if (!this.uptimeKumaClient || !this.uptimeKumaClient.isConnected) {
      return undefined;
    }
    return this.uptimeKumaClient.getMonitor(monitorId);
  }

  // Emit visibility change event
  emitVisibilityChange(monitorId: number, isPublic: boolean): void {
    socketService.emit('MONITOR_VISIBILITY_CHANGED', {
      monitorId,
      isPublic,
      timestamp: new Date(),
    });
  }
}

export const statusService = new StatusService();
