import { UptimeKumaClient } from '@/integrations/uptime-kuma/uptime-kuma.client';
import { serviceConfigRepository } from '@/repositories';
import { socketService } from '@/services/socket.service';
import { logger } from '@/utils/logger';
import { redisClient } from '@/config/redis';
import { encryptionService } from './encryption.service';

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
      const password = config.configData?.password ? 
        await encryptionService.decrypt(config.configData.password) : 
        undefined;

      // Connect to Uptime Kuma
      this.uptimeKumaClient = new UptimeKumaClient(
        config.serviceUrl,
        username,
        password
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

      this.uptimeKumaClient.on('heartbeat', ({ monitor }) => {
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
    
    // Update Redis cache
    redisClient.setex(
      `${this.cachePrefix}${serviceName}`, 
      this.cacheTTL, 
      JSON.stringify(status)
    ).catch(err => logger.error('Failed to cache status', { err }));
    
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
    
    // Update Redis cache
    redisClient.setex(
      `${this.cachePrefix}all`, 
      this.cacheTTL, 
      JSON.stringify(allStatuses)
    ).catch(err => logger.error('Failed to cache all statuses', { err }));
    
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
    const services = ['plex', 'overseerr', 'medianest'];
    const statuses: ServiceStatus[] = [];
    
    for (const service of services) {
      const status = await this.checkServiceHealth(service);
      statuses.push(status);
      this.statusCache.set(service, status);
    }
    
    // Update cache and emit
    await redisClient.setex(
      `${this.cachePrefix}all`, 
      this.cacheTTL, 
      JSON.stringify(statuses)
    );
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

      // For MVP, just return a mock status
      // In production, you'd make actual HTTP health checks
      return {
        name: service,
        displayName: service.charAt(0).toUpperCase() + service.slice(1),
        status: 'up',
        responseTime: Math.floor(Math.random() * 100),
        uptime24h: 99.9,
        uptime30d: 99.5,
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
    const cached = await redisClient.get(`${this.cachePrefix}all`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Return from memory cache
    return Array.from(this.statusCache.values());
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

  disconnect(): void {
    this.stopFallbackPolling();
    if (this.uptimeKumaClient) {
      this.uptimeKumaClient.disconnect();
    }
  }
}

export const statusService = new StatusService();