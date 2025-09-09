/**
 * Database Performance Monitoring and Metrics
 * Provides real-time performance monitoring and alerting
 */
import { logger } from '../utils/logger';
import { getDatabaseStats } from './database-connection-pool';
import { CatchError } from '../types/common';

interface PerformanceMetrics {
  timestamp: Date;
  connectionPool: {
    totalConnections: number;
    activeConnections: number;
    availableConnections: number;
    poolUtilization: number;
    hitRatio: number;
  };
  queryStats: {
    totalQueries: number;
    slowQueries: number;
    errors: number;
    averageResponseTime: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  system: {
    cpu: number;
    loadAverage: number[];
    uptime: number;
  };
}

interface AlertConfig {
  connectionPoolUtilization: number; // Alert if > 80%
  slowQueryThreshold: number; // Alert if > 1000ms average
  errorRateThreshold: number; // Alert if > 5%
  memoryUsageThreshold: number; // Alert if > 80% of heap
}

class DatabasePerformanceMonitor {
  private static instance: DatabasePerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetricsHistory = 1000; // Keep last 1000 metrics
  private alertConfig: AlertConfig;
  private monitoringInterval?: NodeJS.Timeout;
  private alertCallbacks: ((alert: any) => void)[] = [];
  private isMonitoring = false;

  private constructor() {
    this.alertConfig = {
      connectionPoolUtilization: 80,
      slowQueryThreshold: 1000,
      errorRateThreshold: 5,
      memoryUsageThreshold: 80,
    };
  }

  static getInstance(): DatabasePerformanceMonitor {
    if (!DatabasePerformanceMonitor.instance) {
      DatabasePerformanceMonitor.instance = new DatabasePerformanceMonitor();
    }
    return DatabasePerformanceMonitor.instance;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      logger.warn('Database performance monitoring already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting database performance monitoring', {
      intervalMs,
      alertThresholds: this.alertConfig,
    });

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics().catch((error) => {
        logger.error('Failed to collect performance metrics', { error });
      });
    }, intervalMs);

    // Collect initial metrics
    this.collectMetrics().catch((error) => {
      logger.error('Failed to collect initial performance metrics', { error });
    });
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    logger.info('Stopped database performance monitoring');
  }

  /**
   * Collect current performance metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = new Date();
      const poolStats = getDatabaseStats();
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const loadAvg = require('os').loadavg();

      // Calculate CPU percentage (simplified)
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / process.uptime() * 100;

      const metrics: PerformanceMetrics = {
        timestamp,
        connectionPool: {
          totalConnections: poolStats.totalPoolSize,
          activeConnections: poolStats.activeConnections,
          availableConnections: poolStats.availableConnections,
          poolUtilization: poolStats.poolUtilization,
          hitRatio: poolStats.hitRatio,
        },
        queryStats: {
          totalQueries: poolStats.totalQueries,
          slowQueries: poolStats.slowQueries,
          errors: poolStats.errors,
          averageResponseTime: this.calculateAverageResponseTime(),
        },
        memory: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
        },
        system: {
          cpu: Math.round(cpuPercent * 100) / 100,
          loadAverage: loadAvg,
          uptime: process.uptime(),
        },
      };

      // Store metrics
      this.metrics.push(metrics);
      if (this.metrics.length > this.maxMetricsHistory) {
        this.metrics.shift();
      }

      // Check for alerts
      this.checkAlerts(metrics);

      // Log periodic summary (every 5 minutes)
      if (this.metrics.length % 10 === 0) {
        this.logPerformanceSummary(metrics);
      }
    } catch (error: CatchError) {
      logger.error('Error collecting performance metrics', { error });
    }
  }

  /**
   * Check alert conditions and trigger alerts
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    const alerts = [];

    // Connection pool utilization
    if (metrics.connectionPool.poolUtilization > this.alertConfig.connectionPoolUtilization) {
      alerts.push({
        type: 'connection_pool_high',
        severity: 'warning',
        message: `Database connection pool utilization is ${metrics.connectionPool.poolUtilization.toFixed(1)}%`,
        value: metrics.connectionPool.poolUtilization,
        threshold: this.alertConfig.connectionPoolUtilization,
        timestamp: metrics.timestamp,
      });
    }

    // Slow query threshold
    if (metrics.queryStats.averageResponseTime > this.alertConfig.slowQueryThreshold) {
      alerts.push({
        type: 'slow_queries',
        severity: 'warning',
        message: `Average query response time is ${metrics.queryStats.averageResponseTime}ms`,
        value: metrics.queryStats.averageResponseTime,
        threshold: this.alertConfig.slowQueryThreshold,
        timestamp: metrics.timestamp,
      });
    }

    // Error rate
    const errorRate = (metrics.queryStats.errors / Math.max(metrics.queryStats.totalQueries, 1)) * 100;
    if (errorRate > this.alertConfig.errorRateThreshold) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'error',
        message: `Database error rate is ${errorRate.toFixed(2)}%`,
        value: errorRate,
        threshold: this.alertConfig.errorRateThreshold,
        timestamp: metrics.timestamp,
      });
    }

    // Memory usage
    const memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
    if (memoryUsagePercent > this.alertConfig.memoryUsageThreshold) {
      alerts.push({
        type: 'high_memory_usage',
        severity: 'warning',
        message: `Memory usage is ${memoryUsagePercent.toFixed(1)}%`,
        value: memoryUsagePercent,
        threshold: this.alertConfig.memoryUsageThreshold,
        timestamp: metrics.timestamp,
      });
    }

    // Trigger alerts
    alerts.forEach(alert => {
      logger.warn('Database performance alert', alert);
      this.triggerAlert(alert);
    });
  }

  /**
   * Trigger alert callbacks
   */
  private triggerAlert(alert: any): void {
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Error in alert callback', { error });
      }
    });
  }

  /**
   * Log performance summary
   */
  private logPerformanceSummary(metrics: PerformanceMetrics): void {
    logger.info('Database performance summary', {
      connectionPool: {
        utilization: `${metrics.connectionPool.poolUtilization.toFixed(1)}%`,
        hitRatio: `${metrics.connectionPool.hitRatio.toFixed(1)}%`,
        active: metrics.connectionPool.activeConnections,
        available: metrics.connectionPool.availableConnections,
      },
      queries: {
        total: metrics.queryStats.totalQueries,
        slow: metrics.queryStats.slowQueries,
        errors: metrics.queryStats.errors,
        avgResponseTime: `${metrics.queryStats.averageResponseTime}ms`,
      },
      system: {
        memoryUsage: `${((metrics.memory.heapUsed / metrics.memory.heapTotal) * 100).toFixed(1)}%`,
        cpu: `${metrics.system.cpu}%`,
        uptime: `${Math.round(metrics.system.uptime / 3600)}h`,
      },
    });
  }

  /**
   * Calculate average response time from recent metrics
   */
  private calculateAverageResponseTime(): number {
    if (this.metrics.length === 0) return 0;

    const recentMetrics = this.metrics.slice(-10); // Last 10 measurements
    const totalTime = recentMetrics.reduce((sum, m) => sum + m.queryStats.averageResponseTime, 0);
    return Math.round(totalTime / recentMetrics.length);
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] ?? null : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(count?: number): PerformanceMetrics[] {
    if (count) {
      return this.metrics.slice(-count);
    }
    return [...this.metrics];
  }

  /**
   * Get performance statistics over time period
   */
  getPerformanceStats(minutes: number = 60): {
    avgPoolUtilization: number;
    avgQueryTime: number;
    totalErrors: number;
    maxMemoryUsage: number;
    periodStart: Date;
    periodEnd: Date;
  } {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    const periodMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime);

    if (periodMetrics.length === 0) {
      return {
        avgPoolUtilization: 0,
        avgQueryTime: 0,
        totalErrors: 0,
        maxMemoryUsage: 0,
        periodStart: new Date(),
        periodEnd: new Date(),
      };
    }

    const avgPoolUtilization = periodMetrics.reduce((sum, m) => sum + m.connectionPool.poolUtilization, 0) / periodMetrics.length;
    const avgQueryTime = periodMetrics.reduce((sum, m) => sum + m.queryStats.averageResponseTime, 0) / periodMetrics.length;
    const totalErrors = periodMetrics.reduce((sum, m) => sum + m.queryStats.errors, 0);
    const maxMemoryUsage = Math.max(...periodMetrics.map(m => (m.memory.heapUsed / m.memory.heapTotal) * 100));

    const firstMetric = periodMetrics[0];
    const lastMetric = periodMetrics[periodMetrics.length - 1];
    
    if (!firstMetric || !lastMetric) {
      return {
        avgPoolUtilization: 0,
        avgQueryTime: 0,
        totalErrors: 0,
        maxMemoryUsage: 0,
        periodStart: new Date(),
        periodEnd: new Date(),
      };
    }

    return {
      avgPoolUtilization: Math.round(avgPoolUtilization * 100) / 100,
      avgQueryTime: Math.round(avgQueryTime * 100) / 100,
      totalErrors,
      maxMemoryUsage: Math.round(maxMemoryUsage * 100) / 100,
      periodStart: firstMetric.timestamp,
      periodEnd: lastMetric.timestamp,
    };
  }

  /**
   * Add alert callback
   */
  onAlert(callback: (alert: any) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Update alert configuration
   */
  updateAlertConfig(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
    logger.info('Updated database performance alert configuration', this.alertConfig);
  }

  /**
   * Generate performance report
   */
  generateReport(hours: number = 24): {
    summary: any;
    alerts: any[];
    trends: any;
    recommendations: string[];
  } {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const reportMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime);

    if (reportMetrics.length === 0) {
      return {
        summary: {},
        alerts: [],
        trends: {},
        recommendations: ['Insufficient data for analysis'],
      };
    }

    const summary = this.getPerformanceStats(hours * 60);
    const recommendations = this.generateRecommendations(reportMetrics);

    // Simple trend analysis
    const trends = {
      poolUtilizationTrend: this.calculateTrend(reportMetrics, 'poolUtilization'),
      queryTimeTrend: this.calculateTrend(reportMetrics, 'averageResponseTime'),
      memoryUsageTrend: this.calculateTrend(reportMetrics, 'memoryUsage'),
    };

    return {
      summary,
      alerts: [], // Would store triggered alerts
      trends,
      recommendations,
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(_metrics: PerformanceMetrics[]): string[] {
    const recommendations: string[] = [];
    const stats = this.getPerformanceStats();

    if (stats.avgPoolUtilization > 70) {
      recommendations.push('Consider increasing database connection pool size');
    }

    if (stats.avgQueryTime > 500) {
      recommendations.push('Review and optimize slow database queries');
    }

    if (stats.totalErrors > 0) {
      recommendations.push('Investigate database errors and implement retry logic');
    }

    if (stats.maxMemoryUsage > 80) {
      recommendations.push('Monitor memory usage and consider optimizing query result caching');
    }

    return recommendations;
  }

  /**
   * Calculate trend direction (simplified)
   */
  private calculateTrend(metrics: PerformanceMetrics[], field: string): 'up' | 'down' | 'stable' {
    if (metrics.length < 2) return 'stable';

    const first = metrics[0];
    const last = metrics[metrics.length - 1];
    
    if (!first || !last) return 'stable';

    let firstValue: number, lastValue: number;

    switch (field) {
      case 'poolUtilization':
        firstValue = first.connectionPool.poolUtilization;
        lastValue = last.connectionPool.poolUtilization;
        break;
      case 'averageResponseTime':
        firstValue = first.queryStats.averageResponseTime;
        lastValue = last.queryStats.averageResponseTime;
        break;
      case 'memoryUsage':
        firstValue = (first.memory.heapUsed / first.memory.heapTotal) * 100;
        lastValue = (last.memory.heapUsed / last.memory.heapTotal) * 100;
        break;
      default:
        return 'stable';
    }

    const difference = lastValue - firstValue;
    const threshold = firstValue * 0.1; // 10% change threshold

    if (difference > threshold) return 'up';
    if (difference < -threshold) return 'down';
    return 'stable';
  }
}

export const databasePerformanceMonitor = DatabasePerformanceMonitor.getInstance();

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production') {
  // Start monitoring after a short delay to allow database pool initialization
  setTimeout(() => {
    databasePerformanceMonitor.startMonitoring(30000); // Every 30 seconds
  }, 5000);

  // Set up alert handler for logging
  databasePerformanceMonitor.onAlert((alert) => {
    logger.warn('Database performance alert triggered', alert);
    
    // In production, you might want to send alerts to monitoring systems
    // like Sentry, PagerDuty, or Slack
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  databasePerformanceMonitor.stopMonitoring();
});

process.on('SIGTERM', () => {
  databasePerformanceMonitor.stopMonitoring();
});
