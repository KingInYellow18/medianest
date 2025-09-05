import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export interface PerformanceMetrics {
  requestDuration: number;
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: Date;
  path: string;
  method: string;
  statusCode: number;
  userId?: string;
  correlationId?: string;
}

export interface PerformanceThresholds {
  slow: number; // milliseconds
  very_slow: number; // milliseconds
  memory_warning: number; // bytes
}

/**
 * Performance monitoring and optimization utilities
 */
export class PerformanceMonitor {
  private static metrics: PerformanceMetrics[] = [];
  private static maxMetrics = 1000; // Keep last 1000 requests
  private static thresholds: PerformanceThresholds = {
    slow: 1000, // 1 second
    very_slow: 5000, // 5 seconds
    memory_warning: 100 * 1024 * 1024, // 100MB
  };

  /**
   * Middleware to monitor request performance
   */
  static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();

      // Track response completion
      res.on('finish', () => {
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;

        const metrics: PerformanceMetrics = {
          requestDuration: duration,
          memoryUsage: endMemory,
          timestamp: new Date(),
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          userId: req.user?.id,
          correlationId: req.correlationId,
        };

        // Store metrics
        this.recordMetrics(metrics);

        // Log slow requests
        if (duration > this.thresholds.slow) {
          const level = duration > this.thresholds.very_slow ? 'warn' : 'info';
          logger[level]('Slow request detected', {
            duration: `${duration}ms`,
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            correlationId: req.correlationId,
            memoryDelta: {
              heapUsed: endMemory.heapUsed - startMemory.heapUsed,
              heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            },
          });
        }

        // Log memory warnings
        if (endMemory.heapUsed > this.thresholds.memory_warning) {
          logger.warn('High memory usage detected', {
            heapUsed: `${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(endMemory.heapTotal / 1024 / 1024)}MB`,
            path: req.path,
            correlationId: req.correlationId,
          });
        }
      });

      next();
    };
  }

  /**
   * Record performance metrics
   */
  private static recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only the last N metrics to prevent memory leaks
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Get performance statistics
   */
  static getStats(timeWindowMinutes = 5): {
    totalRequests: number;
    averageResponseTime: number;
    slowRequests: number;
    errorRate: number;
    memoryStats: {
      current: NodeJS.MemoryUsage;
      average: {
        heapUsed: number;
        heapTotal: number;
        external: number;
      };
    };
    topSlowPaths: Array<{ path: string; averageTime: number; count: number }>;
  } {
    const cutoff = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);
    
    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        slowRequests: 0,
        errorRate: 0,
        memoryStats: {
          current: process.memoryUsage(),
          average: { heapUsed: 0, heapTotal: 0, external: 0 },
        },
        topSlowPaths: [],
      };
    }

    // Calculate statistics
    const totalRequests = recentMetrics.length;
    const averageResponseTime = recentMetrics.reduce((sum, m) => sum + m.requestDuration, 0) / totalRequests;
    const slowRequests = recentMetrics.filter(m => m.requestDuration > this.thresholds.slow).length;
    const errorRequests = recentMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = (errorRequests / totalRequests) * 100;

    // Memory statistics
    const avgHeapUsed = recentMetrics.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) / totalRequests;
    const avgHeapTotal = recentMetrics.reduce((sum, m) => sum + m.memoryUsage.heapTotal, 0) / totalRequests;
    const avgExternal = recentMetrics.reduce((sum, m) => sum + m.memoryUsage.external, 0) / totalRequests;

    // Top slow paths
    const pathStats = new Map<string, { totalTime: number; count: number }>();
    recentMetrics.forEach(m => {
      const existing = pathStats.get(m.path) || { totalTime: 0, count: 0 };
      pathStats.set(m.path, {
        totalTime: existing.totalTime + m.requestDuration,
        count: existing.count + 1,
      });
    });

    const topSlowPaths = Array.from(pathStats.entries())
      .map(([path, stats]) => ({
        path,
        averageTime: stats.totalTime / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      slowRequests,
      errorRate: Math.round(errorRate * 100) / 100,
      memoryStats: {
        current: process.memoryUsage(),
        average: {
          heapUsed: Math.round(avgHeapUsed),
          heapTotal: Math.round(avgHeapTotal),
          external: Math.round(avgExternal),
        },
      },
      topSlowPaths,
    };
  }

  /**
   * Get detailed metrics for a specific path
   */
  static getPathMetrics(path: string, timeWindowMinutes = 5): {
    requests: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    percentiles: { p50: number; p95: number; p99: number };
    errorRate: number;
  } {
    const cutoff = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    const pathMetrics = this.metrics
      .filter(m => m.timestamp > cutoff && m.path === path)
      .map(m => ({ duration: m.requestDuration, status: m.statusCode }));

    if (pathMetrics.length === 0) {
      return {
        requests: 0,
        averageTime: 0,
        minTime: 0,
        maxTime: 0,
        percentiles: { p50: 0, p95: 0, p99: 0 },
        errorRate: 0,
      };
    }

    const durations = pathMetrics.map(m => m.duration).sort((a, b) => a - b);
    const errors = pathMetrics.filter(m => m.status >= 400).length;
    
    return {
      requests: pathMetrics.length,
      averageTime: Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length),
      minTime: durations[0],
      maxTime: durations[durations.length - 1],
      percentiles: {
        p50: durations[Math.floor(durations.length * 0.5)],
        p95: durations[Math.floor(durations.length * 0.95)],
        p99: durations[Math.floor(durations.length * 0.99)],
      },
      errorRate: Math.round((errors / pathMetrics.length) * 10000) / 100,
    };
  }

  /**
   * Update performance thresholds
   */
  static updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logger.info('Performance thresholds updated', this.thresholds);
  }

  /**
   * Clear metrics history
   */
  static clearMetrics(): void {
    this.metrics = [];
    logger.info('Performance metrics cleared');
  }

  /**
   * Get current system performance
   */
  static getSystemStats(): {
    memory: NodeJS.MemoryUsage;
    uptime: number;
    loadAverage: number[];
    cpuUsage: NodeJS.CpuUsage;
  } {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      loadAverage: require('os').loadavg(),
      cpuUsage: process.cpuUsage(),
    };
  }

  /**
   * Generate performance report
   */
  static generateReport(timeWindowMinutes = 15): {
    summary: any;
    systemStats: any;
    recommendations: string[];
  } {
    const stats = this.getStats(timeWindowMinutes);
    const systemStats = this.getSystemStats();
    const recommendations: string[] = [];

    // Generate recommendations based on metrics
    if (stats.averageResponseTime > this.thresholds.slow) {
      recommendations.push('Average response time is high. Consider optimizing slow endpoints.');
    }

    if (stats.errorRate > 5) {
      recommendations.push('Error rate is above 5%. Review error logs and fix failing endpoints.');
    }

    if (systemStats.memory.heapUsed > this.thresholds.memory_warning) {
      recommendations.push('Memory usage is high. Consider implementing memory optimization strategies.');
    }

    if (stats.slowRequests / stats.totalRequests > 0.1) {
      recommendations.push('More than 10% of requests are slow. Review database queries and external API calls.');
    }

    return {
      summary: stats,
      systemStats,
      recommendations,
    };
  }
}
