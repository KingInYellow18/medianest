import { RedisService } from './redis.service';
import { logger } from '../utils/logger';

export interface RedisHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime: number;
  memoryUsage?: {
    used: string;
    max: string;
    percentage: number;
  };
  keyCount?: number;
  error?: string;
  uptime?: string;
}

/**
 * Redis Health Check Service
 */
export class RedisHealthService {
  private redisService: RedisService;
  private lastHealthStatus: RedisHealthStatus;

  constructor(redisService: RedisService) {
    this.redisService = redisService;
    this.lastHealthStatus = {
      status: 'unhealthy',
      lastCheck: new Date(),
      responseTime: 0,
    };
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<RedisHealthStatus> {
    const startTime = Date.now();

    try {
      // Test basic connectivity
      const pingResult = await this.redisService.ping();
      const responseTime = Date.now() - startTime;

      if (!pingResult) {
        this.lastHealthStatus = {
          status: 'unhealthy',
          lastCheck: new Date(),
          responseTime,
          error: 'Redis ping failed',
        };
        return this.lastHealthStatus;
      }

      // Get memory and key statistics
      let memoryUsage: RedisHealthStatus['memoryUsage'];
      let keyCount: number | undefined;

      try {
        const memoryStats = await this.redisService.getMemoryStats();
        memoryUsage = {
          used: memoryStats.usedMemory,
          max: memoryStats.maxMemory,
          percentage: memoryStats.memoryUsagePercent,
        };
        keyCount = memoryStats.keyCount;
      } catch (error) {
        logger.warn('Failed to get Redis memory stats during health check', { error });
      }

      // Determine status based on metrics
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (responseTime > 1000) {
        status = 'degraded'; // Slow response
      }

      if (memoryUsage && memoryUsage.percentage > 90) {
        status = 'degraded'; // High memory usage
      }

      if (responseTime > 5000) {
        status = 'unhealthy'; // Very slow response
      }

      this.lastHealthStatus = {
        status,
        lastCheck: new Date(),
        responseTime,
        memoryUsage,
        keyCount,
      };

      // Log degraded or unhealthy status
      if (status !== 'healthy') {
        logger.warn('Redis health check indicates issues', {
          status,
          responseTime,
          memoryUsage,
        });
      }

      return this.lastHealthStatus;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      this.lastHealthStatus = {
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      logger.error('Redis health check failed', {
        error,
        responseTime,
      });

      return this.lastHealthStatus;
    }
  }

  /**
   * Get cached health status without running new check
   */
  getCachedHealthStatus(): RedisHealthStatus {
    return this.lastHealthStatus;
  }

  /**
   * Check if Redis is currently healthy
   */
  async isHealthy(): Promise<boolean> {
    const health = await this.checkHealth();
    return health.status === 'healthy';
  }

  /**
   * Wait for Redis to become healthy with timeout
   */
  async waitForHealthy(
    timeoutMs: number = 30000,
    checkIntervalMs: number = 1000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const isHealthy = await this.isHealthy();
        if (isHealthy) {
          return true;
        }
      } catch (error) {
        logger.debug('Health check failed while waiting', { error });
      }

      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
    }

    return false;
  }

  /**
   * Get detailed Redis metrics for monitoring
   */
  async getDetailedMetrics(): Promise<{
    connection: {
      isConnected: boolean;
      responseTime: number;
    };
    memory: {
      usedMemory: string;
      maxMemory: string;
      memoryUsagePercent: number;
      keyCount: number;
    };
    performance: {
      avgResponseTime: number;
      lastResponseTime: number;
    };
  }> {
    const startTime = Date.now();

    try {
      const [pingResult, memoryStats] = await Promise.all([
        this.redisService.ping(),
        this.redisService.getMemoryStats(),
      ]);

      const responseTime = Date.now() - startTime;

      return {
        connection: {
          isConnected: pingResult,
          responseTime,
        },
        memory: {
          usedMemory: memoryStats.usedMemory,
          maxMemory: memoryStats.maxMemory,
          memoryUsagePercent: memoryStats.memoryUsagePercent,
          keyCount: memoryStats.keyCount,
        },
        performance: {
          avgResponseTime: responseTime, // Could be enhanced with historical data
          lastResponseTime: responseTime,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        connection: {
          isConnected: false,
          responseTime,
        },
        memory: {
          usedMemory: 'unknown',
          maxMemory: 'unknown',
          memoryUsagePercent: 0,
          keyCount: 0,
        },
        performance: {
          avgResponseTime: responseTime,
          lastResponseTime: responseTime,
        },
      };
    }
  }

  /**
   * Cleanup expired keys and optimize Redis
   */
  async performMaintenance(): Promise<{
    deletedKeys: number;
    optimizationPerformed: boolean;
    duration: number;
  }> {
    const startTime = Date.now();

    try {
      logger.info('Starting Redis maintenance');

      // Perform cleanup
      const cleanupResult = await this.redisService.cleanup();

      const duration = Date.now() - startTime;

      logger.info('Redis maintenance completed', {
        deletedKeys: cleanupResult.deletedKeys,
        duration,
      });

      return {
        deletedKeys: cleanupResult.deletedKeys,
        optimizationPerformed: true,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Redis maintenance failed', { error, duration });

      return {
        deletedKeys: 0,
        optimizationPerformed: false,
        duration,
      };
    }
  }
}
