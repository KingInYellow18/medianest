import { Request, Response, NextFunction } from 'express';
import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';
import { CatchError } from '../types/common';

/**
 * Comprehensive performance monitoring middleware
 * Tracks response times, memory usage, and identifies bottlenecks
 */

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  statusCode: number;
  timestamp: number;
  userId?: string;
  userAgent?: string;
  ip: string;
}

interface EndpointStats {
  count: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  errorCount: number;
  lastUpdated: number;
}

class PerformanceMonitor {
  private readonly METRICS_TTL = 3600; // 1 hour
  private readonly STATS_TTL = 7200; // 2 hours
  private readonly SLOW_REQUEST_THRESHOLD = 1000; // 1 second
  private readonly MEMORY_WARNING_THRESHOLD = 500 * 1024 * 1024; // 500MB

  private requestCounts = new Map<string, number>();
  private responseTimes: number[] = [];
  private memorySnapshots: NodeJS.MemoryUsage[] = [];

  constructor() {
    // Clean up old metrics every 5 minutes
    setInterval(() => this.cleanupMetrics(), 5 * 60 * 1000);

    // Memory monitoring every 30 seconds
    setInterval(() => this.monitorMemory(), 30 * 1000);
  }

  /**
   * Main performance monitoring middleware
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();

      // Track request start
      const requestKey = `${req.method} ${req.route?.path || req.path}`;
      this.requestCounts.set(requestKey, (this.requestCounts.get(requestKey) || 0) + 1);

      // Override res.end to capture metrics
      const originalEnd = res.end;

      res.end = function (this: Response, ...args: any[]) {
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000; // Convert to ms
        const endMemory = process.memoryUsage();

        // Create performance metrics
        const metrics: PerformanceMetrics = {
          endpoint: req.route?.path || req.path,
          method: req.method,
          responseTime,
          memoryUsage: endMemory,
          statusCode: res.statusCode,
          timestamp: Date.now(),
          userId: (req as any).user?.id as string | undefined,
          userAgent: req.get('User-Agent') || undefined,
          ip: req.ip || 'unknown',
        };

        // Log slow requests immediately
        if (responseTime > PerformanceMonitor.prototype.SLOW_REQUEST_THRESHOLD) {
          logger.warn('Slow Request Detected', {
            endpoint: metrics.endpoint,
            method: metrics.method,
            responseTime: `${responseTime.toFixed(2)}ms`,
            statusCode: metrics.statusCode,
            userId: metrics.userId,
            memoryDelta: {
              rss: endMemory.rss - startMemory.rss,
              heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            },
          });
        }

        // Store metrics asynchronously
        setImmediate(() => {
          performanceMonitor
            .recordMetrics(metrics)
            .catch((error) => logger.warn('Failed to record performance metrics', { error }));
        });

        // Call original end method with exact same arguments
        return (originalEnd as any).apply(this, args);
      };

      next();
    };
  }

  /**
   * Record performance metrics to Redis
   */
  async recordMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      const redis = getRedis();

      // Store individual metric
      const metricsKey = `perf_metrics:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      await redis.setex(metricsKey, this.METRICS_TTL, JSON.stringify(metrics));

      // Update endpoint statistics
      await this.updateEndpointStats(metrics);

      // Track response time distribution
      this.responseTimes.push(metrics.responseTime);
      if (this.responseTimes.length > 1000) {
        this.responseTimes = this.responseTimes.slice(-500); // Keep last 500
      }
    } catch (error: CatchError) {
      logger.warn('Failed to record performance metrics', { error });
    }
  }

  /**
   * Update endpoint statistics
   */
  private async updateEndpointStats(metrics: PerformanceMetrics): Promise<void> {
    try {
      const redis = getRedis();
      const statsKey = `endpoint_stats:${metrics.method}:${metrics.endpoint}`;

      const existingStats = await redis.get(statsKey);
      const stats: EndpointStats = existingStats
        ? JSON.parse(existingStats)
        : {
            count: 0,
            totalTime: 0,
            averageTime: 0,
            minTime: Infinity,
            maxTime: 0,
            errorCount: 0,
            lastUpdated: Date.now(),
          };

      // Update statistics
      stats.count++;
      stats.totalTime += metrics.responseTime;
      stats.averageTime = stats.totalTime / stats.count;
      stats.minTime = Math.min(stats.minTime, metrics.responseTime);
      stats.maxTime = Math.max(stats.maxTime, metrics.responseTime);

      if (metrics.statusCode >= 400) {
        stats.errorCount++;
      }

      stats.lastUpdated = Date.now();

      // Store updated stats
      await redis.setex(statsKey, this.STATS_TTL, JSON.stringify(stats));
    } catch (error: CatchError) {
      logger.warn('Failed to update endpoint stats', { error });
    }
  }

  /**
   * Get performance statistics for all endpoints
   */
  async getPerformanceStats(): Promise<{
    overview: {
      totalRequests: number;
      averageResponseTime: number;
      slowRequests: number;
      errorRate: number;
      memoryUsage: NodeJS.MemoryUsage;
    };
    endpoints: Record<string, EndpointStats>;
    topSlowest: Array<{ endpoint: string; averageTime: number }>;
    responseTimeDistribution: {
      p50: number;
      p90: number;
      p95: number;
      p99: number;
    };
  }> {
    try {
      const redis = getRedis();

      // Get all endpoint stats
      const pattern = 'endpoint_stats:*';
      const keys = await redis.keys(pattern);

      const endpointStats: Record<string, EndpointStats> = {};
      let totalRequests = 0;
      let totalTime = 0;
      let slowRequests = 0;
      let totalErrors = 0;

      for (const key of keys) {
        const statsData = await redis.get(key);
        if (statsData) {
          const stats = JSON.parse(statsData) as EndpointStats;
          const endpointName = key.replace('endpoint_stats:', '');

          endpointStats[endpointName] = stats;
          totalRequests += stats.count;
          totalTime += stats.totalTime;
          totalErrors += stats.errorCount;

          // Count requests over threshold as slow
          if (stats.averageTime > this.SLOW_REQUEST_THRESHOLD) {
            slowRequests += stats.count;
          }
        }
      }

      // Calculate response time percentiles
      const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
      const responseTimeDistribution = {
        p50: this.getPercentile(sortedTimes, 50),
        p90: this.getPercentile(sortedTimes, 90),
        p95: this.getPercentile(sortedTimes, 95),
        p99: this.getPercentile(sortedTimes, 99),
      };

      // Find top slowest endpoints
      const topSlowest = Object.entries(endpointStats)
        .map(([endpoint, stats]) => ({ endpoint, averageTime: stats.averageTime }))
        .sort((a, b) => b.averageTime - a.averageTime)
        .slice(0, 10);

      return {
        overview: {
          totalRequests,
          averageResponseTime: totalRequests > 0 ? totalTime / totalRequests : 0,
          slowRequests,
          errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
          memoryUsage: process.memoryUsage(),
        },
        endpoints: endpointStats,
        topSlowest,
        responseTimeDistribution,
      };
    } catch (error: CatchError) {
      logger.error('Failed to get performance stats', { error });
      throw error;
    }
  }

  /**
   * Get recent performance metrics
   */
  async getRecentMetrics(limit = 100): Promise<PerformanceMetrics[]> {
    try {
      const redis = getRedis();
      const pattern = 'perf_metrics:*';
      const keys = await redis.keys(pattern);

      // Sort keys by timestamp (embedded in key)
      const sortedKeys = keys
        .sort((a, b) => {
          const timestampA = parseInt(a.split(':')[1]);
          const timestampB = parseInt(b.split(':')[1]);
          return timestampB - timestampA;
        })
        .slice(0, limit);

      const metrics: PerformanceMetrics[] = [];

      for (const key of sortedKeys) {
        const metricData = await redis.get(key);
        if (metricData) {
          metrics.push(JSON.parse(metricData));
        }
      }

      return metrics;
    } catch (error: CatchError) {
      logger.error('Failed to get recent metrics', { error });
      return [];
    }
  }

  /**
   * Monitor system memory usage
   */
  private monitorMemory(): void {
    const memUsage = process.memoryUsage();
    this.memorySnapshots.push(memUsage);

    // Keep last 100 snapshots
    if (this.memorySnapshots.length > 100) {
      this.memorySnapshots = this.memorySnapshots.slice(-50);
    }

    // Warn on high memory usage
    if (memUsage.heapUsed > this.MEMORY_WARNING_THRESHOLD) {
      logger.warn('High Memory Usage Detected', {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      });
    }
  }

  /**
   * Clean up old metrics
   */
  private async cleanupMetrics(): Promise<void> {
    try {
      const redis = getRedis();
      const pattern = 'perf_metrics:*';
      const keys = await redis.keys(pattern);

      const cutoffTime = Date.now() - this.METRICS_TTL * 1000;
      const expiredKeys: string[] = [];

      for (const key of keys) {
        const timestamp = parseInt(key.split(':')[1]);
        if (timestamp < cutoffTime) {
          expiredKeys.push(key);
        }
      }

      if (expiredKeys.length > 0) {
        await redis.del(...expiredKeys);
        logger.info('Cleaned up expired performance metrics', { count: expiredKeys.length });
      }
    } catch (error: CatchError) {
      logger.warn('Failed to clean up metrics', { error });
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Get real-time system metrics
   */
  getSystemMetrics(): {
    memory: NodeJS.MemoryUsage;
    uptime: number;
    loadAverage: number[];
    cpuUsage: NodeJS.CpuUsage;
    requestCounts: Record<string, number>;
  } {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      loadAverage: require('os').loadavg(),
      cpuUsage: process.cpuUsage(),
      requestCounts: Object.fromEntries(this.requestCounts),
    };
  }

  /**
   * Reset all metrics
   */
  async reset(): Promise<void> {
    try {
      const redis = getRedis();

      // Clear metrics from Redis
      const metricsKeys = await redis.keys('perf_metrics:*');
      const statsKeys = await redis.keys('endpoint_stats:*');

      const allKeys = [...metricsKeys, ...statsKeys];
      if (allKeys.length > 0) {
        await redis.del(...allKeys);
      }

      // Reset local state
      this.requestCounts.clear();
      this.responseTimes = [];
      this.memorySnapshots = [];

      logger.info('Performance metrics reset');
    } catch (error: CatchError) {
      logger.error('Failed to reset metrics', { error });
    }
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Express middleware for performance monitoring
 */
export const performanceMiddleware = performanceMonitor.middleware();

/**
 * Route handler for performance stats endpoint
 */
export async function getPerformanceStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await performanceMonitor.getPerformanceStats();

    res.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
        system: performanceMonitor.getSystemMetrics(),
      },
    });
  } catch (error: CatchError) {
    logger.error('Failed to get performance stats', { error });
    res.status(500).json({
      success: false,
      error: 'STATS_ERROR',
      message: 'Failed to retrieve performance statistics',
    });
  }
}

/**
 * Route handler for recent metrics endpoint
 */
export async function getRecentMetrics(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const metrics = await performanceMonitor.getRecentMetrics(limit);

    res.json({
      success: true,
      data: metrics,
      meta: {
        count: metrics.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: CatchError) {
    logger.error('Failed to get recent metrics', { error });
    res.status(500).json({
      success: false,
      error: 'METRICS_ERROR',
      message: 'Failed to retrieve recent metrics',
    });
  }
}
