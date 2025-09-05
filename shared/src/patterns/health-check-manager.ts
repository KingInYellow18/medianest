import { EventEmitter } from 'events';
import { redisConfig } from '../config/redis.config';
import { createServiceLogger } from '../config/logging.config';
import { ServiceClient, HealthStatus } from './integration-client-factory';

export interface ServiceHealthStatus extends HealthStatus {
  service: string;
  circuitBreakerState: string;
  additionalInfo?: Record<string, any>;
}

export class HealthCheckManager extends EventEmitter {
  private clients: Map<string, ServiceClient> = new Map();
  private healthStatuses: Map<string, ServiceHealthStatus> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private redis: any = null;
  private intervalMs: number;
  private logger = createServiceLogger('health-check-manager');

  constructor(intervalMs: number = 2 * 60 * 1000) {
    super();
    this.intervalMs = intervalMs;
    
    // Initialize Redis client using shared configuration
    try {
      this.redis = redisConfig.getRedisClient('health-monitor');
    } catch (error) {
      // Redis client not initialized yet - will be set up later
      this.redis = null;
    }
    
    this.setupEventHandlers();
  }

  /**
   * Initialize Redis client for health check caching
   */
  public initializeRedis(redisClient: any): void {
    this.redis = redisClient;
  }

  private setupEventHandlers(): void {
    this.on('serviceHealthChanged', (status: ServiceHealthStatus) => {
      this.logger.info('Service health status changed', {
        service: status.service,
        healthy: status.healthy,
        error: status.error,
      });
    });
  }

  /**
   * Register a service client for health monitoring
   */
  registerClient(serviceName: string, client: ServiceClient): void {
    this.clients.set(serviceName, client);
    logger.debug(`Registered health monitoring for ${serviceName}`);
  }

  /**
   * Unregister a service client
   */
  unregisterClient(serviceName: string): void {
    this.clients.delete(serviceName);
    this.healthStatuses.delete(serviceName);
    logger.debug(`Unregistered health monitoring for ${serviceName}`);
  }

  /**
   * Start health check monitoring
   */
  startHealthChecks(): void {
    // Initial health check
    this.performHealthChecks();

    // Schedule regular health checks
    this.healthCheckInterval = setInterval(
      () => {
        this.performHealthChecks();
      },
      this.intervalMs
    );

    logger.info('Health check monitoring started', {
      interval: this.intervalMs,
      services: Array.from(this.clients.keys()),
    });
  }

  /**
   * Stop health check monitoring
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Health check monitoring stopped');
    }
  }

  /**
   * Perform health checks for all registered clients
   */
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
            // For clients that only have isHealthy method
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

          await this.updateHealthStatus(serviceName, healthStatus);
        } catch (error) {
          const healthStatus: ServiceHealthStatus = {
            service: serviceName,
            healthy: false,
            lastChecked: new Date(),
            error: error.message,
            circuitBreakerState: 'OPEN',
          };

          await this.updateHealthStatus(serviceName, healthStatus);
          logger.error(`Health check failed for ${serviceName}`, { error: error.message });
        }
      }
    );

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Update health status and emit events if changed
   */
  private async updateHealthStatus(
    serviceName: string,
    healthStatus: ServiceHealthStatus
  ): Promise<void> {
    const previousStatus = this.healthStatuses.get(serviceName);
    const hasChanged = !previousStatus || previousStatus.healthy !== healthStatus.healthy;

    this.healthStatuses.set(serviceName, healthStatus);

    // Cache status in Redis
    await this.cacheServiceStatus(serviceName, healthStatus);

    if (hasChanged) {
      this.emit('serviceHealthChanged', healthStatus);
    }
  }

  /**
   * Cache service status in Redis
   */
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

  /**
   * Get health status for a specific service
   */
  getServiceHealth(serviceName: string): ServiceHealthStatus | null {
    return this.healthStatuses.get(serviceName) || null;
  }

  /**
   * Get health status for all services
   */
  getAllServiceHealth(): ServiceHealthStatus[] {
    return Array.from(this.healthStatuses.values());
  }

  /**
   * Get cached service status from Redis
   */
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

  /**
   * Get overall system health summary
   */
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

  /**
   * Clean up resources
   */
  shutdown(): void {
    this.stopHealthChecks();
    this.clients.clear();
    this.healthStatuses.clear();
    this.removeAllListeners();
    logger.info('Health check manager shutdown complete');
  }
}
