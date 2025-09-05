import { EventEmitter } from 'events';

import { getRedis } from '../config/redis';
import { getPrismaClient } from '../db/prisma';
import { OverseerrApiClient } from '../integrations/overseerr/overseerr-api.client';
import { PlexApiClient } from '../integrations/plex/plex-api.client';
import { UptimeKumaClient } from '../integrations/uptime-kuma/uptime-kuma-client';
import { logger } from '../utils/logger';

export interface ServiceHealthStatus {
  service: string;
  healthy: boolean;
  lastChecked: Date;
  responseTime?: number;
  error?: string;
  circuitBreakerState: string;
  additionalInfo?: Record<string, any>;
}

export interface ServiceIntegrationConfig {
  plex?: {
    enabled: boolean;
    serverUrl?: string;
    defaultToken?: string;
  };
  overseerr?: {
    enabled: boolean;
    url?: string;
    apiKey?: string;
  };
  uptimeKuma?: {
    enabled: boolean;
    url?: string;
    username?: string;
    password?: string;
  };
}

export class IntegrationService extends EventEmitter {
  private clients: Map<string, any> = new Map();
  private healthStatuses: Map<string, ServiceHealthStatus> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private redis = getRedis();
  private prisma = getPrismaClient();

  constructor(private config: ServiceIntegrationConfig = {}) {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('serviceHealthChanged', (status: ServiceHealthStatus) => {
      logger.info('Service health status changed', {
        service: status.service,
        healthy: status.healthy,
        error: status.error,
      });
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing external service integrations');

    try {
      await this.initializePlexIntegration();
      await this.initializeOverseerrIntegration();
      await this.initializeUptimeKumaIntegration();

      this.startHealthChecks();

      logger.info('Service integrations initialized successfully', {
        enabledServices: Array.from(this.clients.keys()),
      });
    } catch (error) {
      logger.error('Failed to initialize service integrations', { error: error.message });
      throw error;
    }
  }

  private async initializePlexIntegration(): Promise<void> {
    if (!this.config.plex?.enabled) {
      logger.debug('Plex integration disabled');
      return;
    }

    try {
      // For now, we'll create a default client. In production, this would come from user settings
      if (this.config.plex.defaultToken) {
        const plexClient = await PlexApiClient.createFromUserToken(
          this.config.plex.defaultToken,
          this.config.plex.serverUrl
        );

        this.clients.set('plex', plexClient);
        logger.info('Plex integration initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize Plex integration', { error: error.message });
    }
  }

  private async initializeOverseerrIntegration(): Promise<void> {
    if (
      !this.config.overseerr?.enabled ||
      !this.config.overseerr.url ||
      !this.config.overseerr.apiKey
    ) {
      logger.debug('Overseerr integration disabled or not configured');
      return;
    }

    try {
      const overseerrClient = await OverseerrApiClient.createFromConfig(
        this.config.overseerr.url,
        this.config.overseerr.apiKey
      );

      this.clients.set('overseerr', overseerrClient);
      logger.info('Overseerr integration initialized');
    } catch (error) {
      logger.error('Failed to initialize Overseerr integration', { error: error.message });
    }
  }

  private async initializeUptimeKumaIntegration(): Promise<void> {
    if (!this.config.uptimeKuma?.enabled || !this.config.uptimeKuma.url) {
      logger.debug('Uptime Kuma integration disabled or not configured');
      return;
    }

    try {
      const uptimeKumaClient = UptimeKumaClient.createClient({
        url: this.config.uptimeKuma.url,
        username: this.config.uptimeKuma.username,
        password: this.config.uptimeKuma.password,
        reconnectInterval: 5000,
        heartbeatInterval: 30000,
        timeout: 10000,
      });

      // Setup event handlers
      uptimeKumaClient.on('monitorsUpdated', (monitors) => {
        this.emit('uptimeKumaMonitorsUpdated', monitors);
      });

      uptimeKumaClient.on('heartbeat', (heartbeat) => {
        this.emit('uptimeKumaHeartbeat', heartbeat);
      });

      uptimeKumaClient.on('statsUpdated', (stats) => {
        this.emit('uptimeKumaStatsUpdated', stats);
      });

      await uptimeKumaClient.connect();
      this.clients.set('uptimeKuma', uptimeKumaClient);
      logger.info('Uptime Kuma integration initialized');
    } catch (error) {
      logger.error('Failed to initialize Uptime Kuma integration', { error: error.message });
    }
  }

  private startHealthChecks(): void {
    // Initial health check
    this.performHealthChecks();

    // Schedule regular health checks every 2 minutes
    this.healthCheckInterval = setInterval(
      () => {
        this.performHealthChecks();
      },
      2 * 60 * 1000
    );
  }

  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.clients.entries()).map(
      async ([serviceName, client]) => {
        try {
          const startTime = Date.now();
          let healthStatus: ServiceHealthStatus;

          if (client.healthCheck) {
            const health = await client.healthCheck();
            healthStatus = {
              service: serviceName,
              healthy: health.healthy,
              lastChecked: health.lastChecked,
              responseTime: health.responseTime,
              error: health.error,
              circuitBreakerState: client.getCircuitBreakerStats?.()?.state || 'UNKNOWN',
            };
          } else if (client.isHealthy) {
            // For Uptime Kuma client
            healthStatus = {
              service: serviceName,
              healthy: client.isHealthy(),
              lastChecked: new Date(),
              responseTime: Date.now() - startTime,
              circuitBreakerState: client.getCircuitBreakerStats?.()?.state || 'UNKNOWN',
            };
          } else {
            healthStatus = {
              service: serviceName,
              healthy: false,
              lastChecked: new Date(),
              error: 'Health check method not available',
              circuitBreakerState: 'UNKNOWN',
            };
          }

          const previousStatus = this.healthStatuses.get(serviceName);
          const hasChanged = !previousStatus || previousStatus.healthy !== healthStatus.healthy;

          this.healthStatuses.set(serviceName, healthStatus);

          // Cache status in Redis
          await this.cacheServiceStatus(serviceName, healthStatus);

          if (hasChanged) {
            this.emit('serviceHealthChanged', healthStatus);
          }
        } catch (error) {
          const healthStatus: ServiceHealthStatus = {
            service: serviceName,
            healthy: false,
            lastChecked: new Date(),
            error: error.message,
            circuitBreakerState: 'OPEN',
          };

          this.healthStatuses.set(serviceName, healthStatus);
          this.emit('serviceHealthChanged', healthStatus);

          logger.error(`Health check failed for ${serviceName}`, { error: error.message });
        }
      }
    );

    await Promise.allSettled(healthCheckPromises);
  }

  private async cacheServiceStatus(
    serviceName: string,
    status: ServiceHealthStatus
  ): Promise<void> {
    try {
      const cacheKey = `service:health:${serviceName}`;
      const cacheValue = JSON.stringify(status);

      await this.redis.setex(cacheKey, 300, cacheValue); // Cache for 5 minutes
    } catch (error) {
      logger.error('Failed to cache service status', {
        service: serviceName,
        error: error.message,
      });
    }
  }

  // Service-specific methods

  async getPlexClient(userToken?: string): Promise<PlexApiClient | null> {
    if (userToken) {
      // Create user-specific client
      try {
        return await PlexApiClient.createFromUserToken(userToken);
      } catch (error) {
        logger.error('Failed to create user Plex client', { error: error.message });
        return null;
      }
    }

    return this.clients.get('plex') || null;
  }

  getOverseerrClient(): OverseerrApiClient | null {
    return this.clients.get('overseerr') || null;
  }

  getUptimeKumaClient(): UptimeKumaClient | null {
    return this.clients.get('uptimeKuma') || null;
  }

  // Health and status methods

  getServiceHealth(serviceName: string): ServiceHealthStatus | null {
    return this.healthStatuses.get(serviceName) || null;
  }

  getAllServiceHealth(): ServiceHealthStatus[] {
    return Array.from(this.healthStatuses.values());
  }

  async getCachedServiceStatus(serviceName: string): Promise<ServiceHealthStatus | null> {
    try {
      const cacheKey = `service:health:${serviceName}`;
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.error('Failed to get cached service status', {
        service: serviceName,
        error: error.message,
      });
    }

    return null;
  }

  getOverallSystemHealth(): {
    healthy: boolean;
    totalServices: number;
    healthyServices: number;
    services: ServiceHealthStatus[];
  } {
    const services = this.getAllServiceHealth();
    const healthyServices = services.filter((s) => s.healthy).length;

    return {
      healthy: healthyServices === services.length && services.length > 0,
      totalServices: services.length,
      healthyServices,
      services,
    };
  }

  // Management methods

  async resetCircuitBreakers(): Promise<void> {
    for (const [serviceName, client] of this.clients.entries()) {
      if (client.resetCircuitBreaker) {
        client.resetCircuitBreaker();
        logger.info(`Circuit breaker reset for ${serviceName}`);
      }
    }
  }

  async resetServiceCircuitBreaker(serviceName: string): Promise<boolean> {
    const client = this.clients.get(serviceName);
    if (client?.resetCircuitBreaker) {
      client.resetCircuitBreaker();
      logger.info(`Circuit breaker reset for ${serviceName}`);
      return true;
    }
    return false;
  }

  async refreshServiceConfiguration(): Promise<void> {
    // In a real implementation, this would reload service configs from database
    logger.info('Refreshing service configurations');

    // For now, just trigger a health check
    await this.performHealthChecks();
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down integration service');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Disconnect from WebSocket clients
    const uptimeKumaClient = this.clients.get('uptimeKuma') as UptimeKumaClient;
    if (uptimeKumaClient) {
      uptimeKumaClient.disconnect();
    }

    this.clients.clear();
    this.healthStatuses.clear();
    this.removeAllListeners();

    logger.info('Integration service shutdown complete');
  }
}
