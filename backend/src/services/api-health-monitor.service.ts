import { logger } from '@/utils/logger';
import { redisClient } from '@/config/redis';
import { PlexClient } from '@/integrations/plex/plex.client';
import { YouTubeClient } from '@/integrations/youtube/youtube.client';
import { AppError } from '@medianest/shared/src/errors';

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  lastCheck: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: HealthStatus[];
  timestamp: string;
  uptime: number;
}

interface HealthCheckResult {
  success: boolean;
  latency: number;
  error?: string;
  metadata?: Record<string, any>;
}

export class ApiHealthMonitorService {
  private readonly services: Map<string, () => Promise<HealthCheckResult>> = new Map();
  private readonly healthCache = new Map<string, HealthStatus>();
  private readonly checkInterval = 30000; // 30 seconds
  private intervalId?: NodeJS.Timeout;
  private startTime = Date.now();

  constructor() {
    this.registerHealthChecks();
  }

  /**
   * Register all health check functions
   */
  private registerHealthChecks(): void {
    this.services.set('plex', this.checkPlexHealth.bind(this));
    this.services.set('youtube', this.checkYouTubeHealth.bind(this));
    this.services.set('redis', this.checkRedisHealth.bind(this));
    this.services.set('database', this.checkDatabaseHealth.bind(this));
  }

  /**
   * Start periodic health checks
   */
  startMonitoring(): void {
    if (this.intervalId) {
      logger.warn('Health monitoring already started');
      return;
    }

    logger.info('Starting API health monitoring');
    
    // Initial health check
    this.performAllHealthChecks();
    
    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.performAllHealthChecks();
    }, this.checkInterval);
  }

  /**
   * Stop periodic health checks
   */
  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('API health monitoring stopped');
    }
  }

  /**
   * Get current system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    // Ensure we have fresh health data
    if (this.healthCache.size === 0) {
      await this.performAllHealthChecks();
    }

    const services = Array.from(this.healthCache.values());
    const overall = this.calculateOverallHealth(services);

    return {
      overall,
      services,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get health status for a specific service
   */
  async getServiceHealth(serviceName: string): Promise<HealthStatus | null> {
    const healthCheck = this.services.get(serviceName);
    if (!healthCheck) {
      return null;
    }

    const startTime = Date.now();
    try {
      const result = await healthCheck();
      const status: HealthStatus = {
        service: serviceName,
        status: result.success ? 'healthy' : 'unhealthy',
        latency: result.latency,
        lastCheck: new Date().toISOString(),
        error: result.error,
        metadata: result.metadata,
      };

      this.healthCache.set(serviceName, status);
      return status;
    } catch (error) {
      const status: HealthStatus = {
        service: serviceName,
        status: 'unhealthy',
        latency: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      this.healthCache.set(serviceName, status);
      return status;
    }
  }

  /**
   * Perform health checks for all registered services
   */
  private async performAllHealthChecks(): Promise<void> {
    const promises = Array.from(this.services.keys()).map(serviceName =>
      this.getServiceHealth(serviceName)
    );

    await Promise.allSettled(promises);

    // Log unhealthy services
    const unhealthyServices = Array.from(this.healthCache.values())
      .filter(status => status.status === 'unhealthy');

    if (unhealthyServices.length > 0) {
      logger.warn('Unhealthy services detected', {
        services: unhealthyServices.map(s => ({
          name: s.service,
          error: s.error,
        })),
      });
    }
  }

  /**
   * Calculate overall system health
   */
  private calculateOverallHealth(services: HealthStatus[]): SystemHealth['overall'] {
    if (services.length === 0) return 'unhealthy';

    const healthyCount = services.filter(s => s.status === 'healthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;

    // System is healthy if all services are healthy
    if (healthyCount === services.length) {
      return 'healthy';
    }

    // System is degraded if some services are unhealthy but core services work
    if (unhealthyCount <= services.length / 2) {
      return 'degraded';
    }

    // System is unhealthy if majority of services are down
    return 'unhealthy';
  }

  /**
   * Check Plex service health
   */
  private async checkPlexHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // We would need a service account or admin token for health checks
      const adminUserId = process.env.PLEX_ADMIN_USER_ID;
      if (!adminUserId) {
        return {
          success: false,
          latency: Date.now() - startTime,
          error: 'No admin user configured for Plex health checks',
        };
      }

      const { plexService } = await import('@/services/plex.service');
      const serverInfo = await plexService.getServerInfo(adminUserId);
      
      return {
        success: true,
        latency: Date.now() - startTime,
        metadata: {
          serverName: serverInfo.name,
          version: serverInfo.version,
          platform: serverInfo.platform,
        },
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check YouTube service health
   */
  private async checkYouTubeHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const client = new YouTubeClient();
      const isAvailable = await client.checkAvailability();
      
      return {
        success: isAvailable,
        latency: Date.now() - startTime,
        error: isAvailable ? undefined : 'yt-dlp not available',
        metadata: {
          ytDlpAvailable: isAvailable,
        },
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const testKey = 'health:check:redis';
      const testValue = `test-${Date.now()}`;
      
      await redisClient.set(testKey, testValue, 'EX', 10);
      const retrievedValue = await redisClient.get(testKey);
      await redisClient.del(testKey);
      
      const success = retrievedValue === testValue;
      
      return {
        success,
        latency: Date.now() - startTime,
        error: success ? undefined : 'Redis connectivity test failed',
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Import database connection dynamically to avoid circular dependencies
      const { prisma } = await import('@/config/database');
      
      // Simple connectivity test
      await prisma.$queryRaw`SELECT 1`;
      
      return {
        success: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Database connectivity failed',
      };
    }
  }

  /**
   * Get service uptime statistics
   */
  async getUptimeStats(serviceName: string, hours: number = 24): Promise<{
    uptime: number;
    totalChecks: number;
    failedChecks: number;
    averageLatency: number;
  }> {
    try {
      const key = `health:stats:${serviceName}`;
      const stats = await redisClient.get(key);
      
      if (!stats) {
        return {
          uptime: 0,
          totalChecks: 0,
          failedChecks: 0,
          averageLatency: 0,
        };
      }

      return JSON.parse(stats);
    } catch (error) {
      logger.error('Failed to get uptime stats', { serviceName, error });
      return {
        uptime: 0,
        totalChecks: 0,
        failedChecks: 0,
        averageLatency: 0,
      };
    }
  }

  /**
   * Record health check result for statistics
   */
  private async recordHealthStats(serviceName: string, result: HealthCheckResult): Promise<void> {
    try {
      const key = `health:stats:${serviceName}`;
      const existing = await redisClient.get(key);
      
      let stats = {
        uptime: 0,
        totalChecks: 0,
        failedChecks: 0,
        averageLatency: 0,
        lastUpdate: Date.now(),
      };

      if (existing) {
        stats = JSON.parse(existing);
      }

      stats.totalChecks++;
      if (!result.success) {
        stats.failedChecks++;
      }
      
      // Calculate running average latency
      stats.averageLatency = (stats.averageLatency + result.latency) / 2;
      stats.uptime = ((stats.totalChecks - stats.failedChecks) / stats.totalChecks) * 100;
      stats.lastUpdate = Date.now();

      await redisClient.setex(key, 86400, JSON.stringify(stats)); // 24 hours
    } catch (error) {
      logger.error('Failed to record health stats', { serviceName, error });
    }
  }

  /**
   * Get health trends for monitoring dashboard
   */
  async getHealthTrends(hours: number = 24): Promise<{
    [serviceName: string]: {
      timestamps: number[];
      statuses: string[];
      latencies: number[];
    };
  }> {
    const trends: any = {};
    
    try {
      for (const serviceName of this.services.keys()) {
        const key = `health:trends:${serviceName}`;
        const data = await redisClient.lrange(key, 0, Math.floor((hours * 60) / (this.checkInterval / 60000)));
        
        trends[serviceName] = {
          timestamps: [],
          statuses: [],
          latencies: [],
        };

        for (const entry of data) {
          try {
            const parsed = JSON.parse(entry);
            trends[serviceName].timestamps.push(parsed.timestamp);
            trends[serviceName].statuses.push(parsed.status);
            trends[serviceName].latencies.push(parsed.latency);
          } catch {
            // Skip malformed entries
          }
        }
      }
    } catch (error) {
      logger.error('Failed to get health trends', { error });
    }

    return trends;
  }

  /**
   * Store health trend data
   */
  private async storeHealthTrend(serviceName: string, status: HealthStatus): Promise<void> {
    try {
      const key = `health:trends:${serviceName}`;
      const data = JSON.stringify({
        timestamp: Date.now(),
        status: status.status,
        latency: status.latency,
      });

      await redisClient.lpush(key, data);
      await redisClient.ltrim(key, 0, 2880); // Keep 48 hours of data (30sec intervals)
      await redisClient.expire(key, 172800); // 48 hours TTL
    } catch (error) {
      logger.error('Failed to store health trend', { serviceName, error });
    }
  }
}

export const apiHealthMonitorService = new ApiHealthMonitorService();