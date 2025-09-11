/**
 * Performance Optimization Service
 *
 * Implements real-time performance monitoring, optimization strategies,
 * and automated performance improvements for MediaNest production deployment.
 *
 * Targets: <200ms API responses, <50ms DB queries, <512MB memory usage
 */

// External dependencies
import { PerformanceMonitor, DatabaseOptimizer, CachingMiddleware } from '@medianest/shared';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

// Internal utilities
import { logger } from '../utils/logger';

// Shared utilities (using barrel exports)

export interface OptimizationConfig {
  enableAutoOptimization: boolean;
  performanceThresholds: {
    slowQueryMs: number;
    highMemoryMB: number;
    slowResponseMs: number;
    lowCacheHitRate: number;
  };
  optimizationStrategies: {
    queryOptimization: boolean;
    memoryManagement: boolean;
    cacheOptimization: boolean;
    connectionPooling: boolean;
  };
}

export interface PerformanceMetrics {
  timestamp: Date;
  apiMetrics: {
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  databaseMetrics: {
    averageQueryTime: number;
    slowQueries: number;
    connectionPoolUsage: number;
    activeConnections: number;
  };
  systemMetrics: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    uptime: number;
  };
  cacheMetrics: {
    hitRate: number;
    totalKeys: number;
    memoryUsage: string;
    evictions: number;
  };
}

export class PerformanceOptimizationService {
  private redis: Redis;
  private prisma: PrismaClient;
  private cachingMiddleware: CachingMiddleware;
  private config: OptimizationConfig;
  private optimizationHistory: Array<{ timestamp: Date; action: string; impact: string }> = [];
  private metricsBuffer: PerformanceMetrics[] = [];

  constructor(
    redis: Redis,
    prisma: PrismaClient,
    cachingMiddleware: CachingMiddleware,
    config: OptimizationConfig,
  ) {
    this.redis = redis;
    this.prisma = prisma;
    this.cachingMiddleware = cachingMiddleware;
    this.config = config;

    this.startPerformanceMonitoring();
  }

  /**
   * Start continuous performance monitoring and optimization
   */
  private startPerformanceMonitoring(): void {
    // Monitor performance every 30 seconds
    setInterval(async () => {
      try {
        const metrics = await this.collectPerformanceMetrics();
        this.metricsBuffer.push(metrics);

        // Keep only last 100 metrics (50 minutes of data)
        if (this.metricsBuffer.length > 100) {
          this.metricsBuffer = this.metricsBuffer.slice(-100);
        }

        if (this.config.enableAutoOptimization) {
          await this.analyzeAndOptimize(metrics);
        }

        // Store metrics in Redis for dashboard
        await this.storeMetricsInRedis(metrics);
      } catch (error) {
        logger.error('Performance monitoring error:', error);
      }
    }, 30000);
  }

  /**
   * Collect comprehensive performance metrics
   */
  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const [apiStats, databaseStats, cacheStats, systemStats] = await Promise.all([
      this.getAPIMetrics(),
      this.getDatabaseMetrics(),
      this.getCacheMetrics(),
      this.getSystemMetrics(),
    ]);

    return {
      timestamp: new Date(),
      apiMetrics: apiStats,
      databaseMetrics: databaseStats,
      systemMetrics: systemStats,
      cacheMetrics: cacheStats,
    };
  }

  /**
   * Get API performance metrics
   */
  private async getAPIMetrics() {
    const performanceStats = PerformanceMonitor.getStats(5); // Last 5 minutes

    return {
      averageResponseTime: performanceStats.averageResponseTime,
      p95ResponseTime: this.calculateP95(performanceStats),
      errorRate: performanceStats.errorRate,
      throughput: performanceStats.totalRequests / 5, // per minute
    };
  }

  /**
   * Get database performance metrics
   */
  private async getDatabaseMetrics() {
    try {
      // Get connection pool status
      const poolStatus = (await this.prisma.$queryRaw`
        SELECT 
          numbackends as active_connections,
          (SELECT setting FROM pg_settings WHERE name = 'max_connections')::int as max_connections
        FROM pg_stat_database 
        WHERE datname = current_database()
      `) as any[];

      // Get slow query information
      const slowQueries = (await this.prisma.$queryRaw`
        SELECT 
          query,
          mean_exec_time,
          calls,
          total_exec_time
        FROM pg_stat_statements 
        WHERE mean_exec_time > ${this.config.performanceThresholds.slowQueryMs}
        ORDER BY mean_exec_time DESC 
        LIMIT 10
      `) as any[];

      const activeConnections = poolStatus[0]?.active_connections || 0;
      const maxConnections = poolStatus[0]?.max_connections || 100;

      return {
        averageQueryTime: this.calculateAverageQueryTime(slowQueries),
        slowQueries: slowQueries.length,
        connectionPoolUsage: (activeConnections / maxConnections) * 100,
        activeConnections,
      };
    } catch (error) {
      logger.warn('Could not collect database metrics:', error.message);
      return {
        averageQueryTime: 0,
        slowQueries: 0,
        connectionPoolUsage: 0,
        activeConnections: 0,
      };
    }
  }

  /**
   * Get cache performance metrics
   */
  private async getCacheMetrics() {
    try {
      const cacheStats = await this.cachingMiddleware.getCacheStats();
      const redisInfo = await this.redis.info('stats');

      // Parse Redis info for hit/miss statistics
      const hitMatches = redisInfo.match(/keyspace_hits:(\d+)/);
      const missMatches = redisInfo.match(/keyspace_misses:(\d+)/);
      const evictionMatches = redisInfo.match(/evicted_keys:(\d+)/);

      const hits = hitMatches ? parseInt(hitMatches[1]) : 0;
      const misses = missMatches ? parseInt(missMatches[1]) : 0;
      const evictions = evictionMatches ? parseInt(evictionMatches[1]) : 0;

      const hitRate = hits + misses > 0 ? hits / (hits + misses) : 0;

      return {
        hitRate,
        totalKeys: cacheStats.totalKeys,
        memoryUsage: cacheStats.memoryUsage,
        evictions,
      };
    } catch (error) {
      logger.warn('Could not collect cache metrics:', error.message);
      return {
        hitRate: 0,
        totalKeys: 0,
        memoryUsage: 'unknown',
        evictions: 0,
      };
    }
  }

  /**
   * Get system performance metrics
   */
  private getSystemMetrics() {
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
    };
  }

  /**
   * Analyze performance and apply optimizations
   */
  private async analyzeAndOptimize(metrics: PerformanceMetrics): Promise<void> {
    const optimizations: Array<() => Promise<void>> = [];

    // API Response Time Optimization
    if (metrics.apiMetrics.p95ResponseTime > this.config.performanceThresholds.slowResponseMs) {
      optimizations.push(() => this.optimizeSlowEndpoints(metrics));
    }

    // Database Query Optimization
    if (metrics.databaseMetrics.averageQueryTime > this.config.performanceThresholds.slowQueryMs) {
      optimizations.push(() => this.optimizeDatabaseQueries(metrics));
    }

    // Memory Management
    const memoryUsageMB = metrics.systemMetrics.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > this.config.performanceThresholds.highMemoryMB) {
      optimizations.push(() => this.optimizeMemoryUsage(metrics));
    }

    // Cache Performance Optimization
    if (metrics.cacheMetrics.hitRate < this.config.performanceThresholds.lowCacheHitRate) {
      optimizations.push(() => this.optimizeCacheStrategy(metrics));
    }

    // Connection Pool Optimization
    if (metrics.databaseMetrics.connectionPoolUsage > 80) {
      optimizations.push(() => this.optimizeConnectionPool(metrics));
    }

    // Execute optimizations
    for (const optimization of optimizations) {
      try {
        await optimization();
      } catch (error) {
        logger.error('Optimization failed:', error);
      }
    }
  }

  /**
   * Optimize slow API endpoints
   */
  private async optimizeSlowEndpoints(metrics: PerformanceMetrics): Promise<void> {
    logger.info('Optimizing slow API endpoints', {
      p95ResponseTime: metrics.apiMetrics.p95ResponseTime,
      threshold: this.config.performanceThresholds.slowResponseMs,
    });

    // Get slow endpoints from performance monitor
    const slowPaths = PerformanceMonitor.getStats(5).topSlowPaths;

    for (const path of slowPaths.slice(0, 5)) {
      // Top 5 slowest
      if (path.averageTime > this.config.performanceThresholds.slowResponseMs) {
        // Apply caching to slow endpoints
        await this.applyCachingToEndpoint(path.path);

        // Log optimization action
        this.logOptimization(
          'api_caching',
          `Applied caching to ${path.path} (${path.averageTime}ms avg)`,
        );
      }
    }
  }

  /**
   * Optimize database queries
   */
  private async optimizeDatabaseQueries(metrics: PerformanceMetrics): Promise<void> {
    logger.info('Optimizing database queries', {
      averageQueryTime: metrics.databaseMetrics.averageQueryTime,
      slowQueries: metrics.databaseMetrics.slowQueries,
    });

    if (this.config.optimizationStrategies.queryOptimization) {
      try {
        // Analyze table statistics
        await this.prisma.$executeRawUnsafe(DatabaseOptimizer.generateAnalyzeTablesSQL());

        // Update query planner statistics
        await this.prisma.$executeRawUnsafe('ANALYZE;');

        this.logOptimization('database_analyze', 'Updated table statistics for query optimization');
      } catch (error) {
        logger.error('Database optimization failed:', error);
      }
    }
  }

  /**
   * Optimize memory usage
   */
  private async optimizeMemoryUsage(metrics: PerformanceMetrics): Promise<void> {
    const memoryUsageMB = metrics.systemMetrics.memoryUsage.heapUsed / 1024 / 1024;

    logger.info('Optimizing memory usage', {
      currentUsage: `${memoryUsageMB.toFixed(2)}MB`,
      threshold: `${this.config.performanceThresholds.highMemoryMB}MB`,
    });

    if (this.config.optimizationStrategies.memoryManagement) {
      // Force garbage collection
      if (global.gc) {
        global.gc();
        this.logOptimization('memory_gc', `Forced GC, was using ${memoryUsageMB.toFixed(2)}MB`);
      }

      // Clear performance metrics buffer if too large
      if (this.metricsBuffer.length > 50) {
        this.metricsBuffer = this.metricsBuffer.slice(-50);
        this.logOptimization('memory_cleanup', 'Cleared old performance metrics');
      }
    }
  }

  /**
   * Optimize cache strategy
   */
  private async optimizeCacheStrategy(metrics: PerformanceMetrics): Promise<void> {
    logger.info('Optimizing cache strategy', {
      hitRate: `${(metrics.cacheMetrics.hitRate * 100).toFixed(2)}%`,
      threshold: `${(this.config.performanceThresholds.lowCacheHitRate * 100).toFixed(2)}%`,
    });

    if (this.config.optimizationStrategies.cacheOptimization) {
      // Extend TTL for frequently accessed data
      const frequentEndpoints = PerformanceMonitor.getStats(10)
        .topSlowPaths.filter((path) => path.count > 10)
        .slice(0, 3);

      for (const endpoint of frequentEndpoints) {
        await this.extendCacheTTL(endpoint.path);
      }

      this.logOptimization(
        'cache_strategy',
        `Extended TTL for ${frequentEndpoints.length} frequently accessed endpoints`,
      );
    }
  }

  /**
   * Optimize connection pool
   */
  private async optimizeConnectionPool(metrics: PerformanceMetrics): Promise<void> {
    logger.warn('High connection pool usage detected', {
      usage: `${metrics.databaseMetrics.connectionPoolUsage.toFixed(2)}%`,
      activeConnections: metrics.databaseMetrics.activeConnections,
    });

    this.logOptimization(
      'connection_pool_warning',
      `High pool usage: ${metrics.databaseMetrics.connectionPoolUsage.toFixed(2)}%`,
    );
  }

  /**
   * Apply caching to a specific endpoint
   */
  private async applyCachingToEndpoint(endpoint: string): Promise<void> {
    const cacheKey = `auto_cache:${endpoint.replace(/\//g, ':')}`;

    // Set cache configuration for this endpoint
    await this.redis.hset(
      'endpoint_cache_config',
      endpoint,
      JSON.stringify({
        ttl: 300, // 5 minutes
        enabled: true,
        autoOptimized: true,
        timestamp: Date.now(),
      }),
    );

    logger.info('Applied automatic caching', { endpoint, cacheKey });
  }

  /**
   * Extend cache TTL for frequently accessed endpoints
   */
  private async extendCacheTTL(endpoint: string): Promise<void> {
    const config = await this.redis.hget('endpoint_cache_config', endpoint);
    if (config) {
      const parsed = JSON.parse(config);
      parsed.ttl = Math.min(parsed.ttl * 1.5, 3600); // Max 1 hour
      parsed.lastOptimized = Date.now();

      await this.redis.hset('endpoint_cache_config', endpoint, JSON.stringify(parsed));
      logger.info('Extended cache TTL', { endpoint, newTTL: parsed.ttl });
    }
  }

  /**
   * Store metrics in Redis for dashboard consumption
   */
  private async storeMetricsInRedis(metrics: PerformanceMetrics): Promise<void> {
    try {
      const key = `performance_metrics:${Date.now()}`;
      await this.redis.setex(key, 3600, JSON.stringify(metrics)); // 1 hour TTL

      // Keep only recent metrics (last 24 hours)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const keys = await this.redis.keys('performance_metrics:*');

      for (const key of keys) {
        const timestamp = parseInt(key.split(':')[1]);
        if (timestamp < cutoff) {
          await this.redis.del(key);
        }
      }
    } catch (error) {
      logger.error('Failed to store metrics in Redis:', error);
    }
  }

  /**
   * Log optimization action
   */
  private logOptimization(action: string, description: string): void {
    this.optimizationHistory.push({
      timestamp: new Date(),
      action,
      impact: description,
    });

    // Keep only last 100 optimization actions
    if (this.optimizationHistory.length > 100) {
      this.optimizationHistory = this.optimizationHistory.slice(-100);
    }

    logger.info('Performance optimization applied', { action, description });
  }

  /**
   * Get current performance summary
   */
  public async getPerformanceSummary(): Promise<{
    currentMetrics: PerformanceMetrics | null;
    trends: {
      responseTimeTrend: 'improving' | 'degrading' | 'stable';
      memoryTrend: 'improving' | 'degrading' | 'stable';
      cachePerformanceTrend: 'improving' | 'degrading' | 'stable';
    };
    recentOptimizations: Array<{ timestamp: Date; action: string; impact: string }>;
    recommendations: string[];
  }> {
    const currentMetrics = this.metricsBuffer[this.metricsBuffer.length - 1] || null;
    const trends = this.calculatePerformanceTrends();
    const recommendations = this.generatePerformanceRecommendations(currentMetrics);

    return {
      currentMetrics,
      trends,
      recentOptimizations: this.optimizationHistory.slice(-10),
      recommendations,
    };
  }

  /**
   * Calculate performance trends
   */
  private calculatePerformanceTrends() {
    if (this.metricsBuffer.length < 10) {
      return {
        responseTimeTrend: 'stable' as const,
        memoryTrend: 'stable' as const,
        cachePerformanceTrend: 'stable' as const,
      };
    }

    const recent = this.metricsBuffer.slice(-5);
    const older = this.metricsBuffer.slice(-10, -5);

    const recentAvgResponseTime =
      recent.reduce((sum, m) => sum + m.apiMetrics.p95ResponseTime, 0) / recent.length;
    const olderAvgResponseTime =
      older.reduce((sum, m) => sum + m.apiMetrics.p95ResponseTime, 0) / older.length;

    const recentAvgMemory =
      recent.reduce((sum, m) => sum + m.systemMetrics.memoryUsage.heapUsed, 0) / recent.length;
    const olderAvgMemory =
      older.reduce((sum, m) => sum + m.systemMetrics.memoryUsage.heapUsed, 0) / older.length;

    const recentAvgCacheHit =
      recent.reduce((sum, m) => sum + m.cacheMetrics.hitRate, 0) / recent.length;
    const olderAvgCacheHit =
      older.reduce((sum, m) => sum + m.cacheMetrics.hitRate, 0) / older.length;

    const threshold = 0.05; // 5% change threshold

    return {
      responseTimeTrend:
        Math.abs(recentAvgResponseTime - olderAvgResponseTime) / olderAvgResponseTime < threshold
          ? ('stable' as const)
          : recentAvgResponseTime < olderAvgResponseTime
            ? ('improving' as const)
            : ('degrading' as const),

      memoryTrend:
        Math.abs(recentAvgMemory - olderAvgMemory) / olderAvgMemory < threshold
          ? ('stable' as const)
          : recentAvgMemory < olderAvgMemory
            ? ('improving' as const)
            : ('degrading' as const),

      cachePerformanceTrend:
        Math.abs(recentAvgCacheHit - olderAvgCacheHit) / olderAvgCacheHit < threshold
          ? ('stable' as const)
          : recentAvgCacheHit > olderAvgCacheHit
            ? ('improving' as const)
            : ('degrading' as const),
    };
  }

  /**
   * Generate performance recommendations
   */
  private generatePerformanceRecommendations(metrics: PerformanceMetrics | null): string[] {
    if (!metrics) return ['Insufficient data for recommendations'];

    const recommendations: string[] = [];

    // API Response Time recommendations
    if (metrics.apiMetrics.p95ResponseTime > 200) {
      recommendations.push(
        'API response times are above target. Consider implementing response caching and query optimization.',
      );
    }

    // Database performance recommendations
    if (metrics.databaseMetrics.slowQueries > 5) {
      recommendations.push(
        'Multiple slow queries detected. Review database indexes and query optimization.',
      );
    }

    if (metrics.databaseMetrics.connectionPoolUsage > 80) {
      recommendations.push(
        'High database connection pool usage. Consider connection pool tuning or query optimization.',
      );
    }

    // Memory usage recommendations
    const memoryUsageMB = metrics.systemMetrics.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 400) {
      recommendations.push(
        'High memory usage detected. Consider implementing memory optimization strategies.',
      );
    }

    // Cache performance recommendations
    if (metrics.cacheMetrics.hitRate < 0.7) {
      recommendations.push(
        'Cache hit rate is below optimal. Review caching strategy and TTL configuration.',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'All performance metrics are within acceptable ranges. System is performing optimally.',
      );
    }

    return recommendations;
  }

  /**
   * Utility methods
   */
  private calculateP95(stats: any): number {
    // This would need to be implemented based on the actual data structure from PerformanceMonitor
    return stats.averageResponseTime * 1.5; // Approximation
  }

  private calculateAverageQueryTime(slowQueries: any[]): number {
    if (slowQueries.length === 0) return 0;
    return slowQueries.reduce((sum, query) => sum + query.mean_exec_time, 0) / slowQueries.length;
  }
}
