// @ts-nocheck
/**
 * Performance Monitoring API Routes
 *
 * Provides real-time performance metrics and monitoring endpoints
 * for production performance analysis and optimization.
 *
 * Endpoints:
 * - GET /api/performance/metrics - Current performance metrics
 * - GET /api/performance/health - System health with performance indicators
 * - GET /api/performance/database - Database performance analysis
 * - GET /api/performance/recommendations - Performance optimization recommendations
 * - POST /api/performance/optimize - Trigger automatic optimizations
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
// WAVE 3 AGENT #9: API ROUTES - ENHANCED REDIS CONDITIONAL IMPORT
// Only import Redis if not in test environment or if Redis is explicitly enabled
let Redis: any;
if (
  process.env.NODE_ENV !== 'test' &&
  process.env.SKIP_REDIS !== 'true' &&
  process.env.DISABLE_REDIS !== 'true'
) {
  try {
    Redis = require('ioredis').Redis;
  } catch (error: any) {
    console.warn('Redis not available, continuing without caching:', error.message as any);
  }
}
import { logger } from '../utils/logger';
import { PerformanceMonitor } from '../../../shared/src/utils/performance-monitor';
import { DatabaseOptimizer } from '../../../shared/src/utils/database-optimizations';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// All performance endpoints require authentication
router.use(authMiddleware);

/**
 * Performance query parameters validation
 */
const performanceQuerySchema = z.object({
  timeWindow: z.string().optional().default('5'),
  detailed: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

/**
 * GET /api/performance/metrics
 * Get current system performance metrics
 */
router.get(
  '/metrics',
  validateRequest({ query: performanceQuerySchema }),
  async (req: Request, res: Response) => {
    try {
      const { timeWindow, detailed } = req.query as { timeWindow: string; detailed: boolean };
      const timeWindowMinutes = parseInt(timeWindow) || 5;

      // Get performance statistics
      const performanceStats = PerformanceMonitor.getStats(timeWindowMinutes);
      const systemStats = PerformanceMonitor.getSystemStats();

      // Get cache metrics if Redis is available - WAVE 3 AGENT #9 FIX
      let cacheMetrics = null;
      try {
        const redis = req.app.get('redis') as Redis;
        if (redis && process.env.NODE_ENV !== 'test' && process.env.SKIP_REDIS !== 'true') {
          const info = await redis.info('memory');
          const keyspace = await redis.info('keyspace');
          const stats = await redis.info('stats');

          // Parse Redis info
          const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
          const hitMatches = stats.match(/keyspace_hits:(\d+)/);
          const missMatches = stats.match(/keyspace_misses:(\d+)/);
          const dbMatch = keyspace.match(/db0:keys=(\d+)/);

          const hits = hitMatches ? parseInt(hitMatches[1]) : 0;
          const misses = missMatches ? parseInt(missMatches[1]) : 0;

          cacheMetrics = {
            memoryUsage: memoryMatch ? memoryMatch[1] : 'unknown',
            totalKeys: dbMatch ? parseInt(dbMatch[1]) : 0,
            hitRate: hits + misses > 0 ? hits / (hits + misses) : 0,
            operations: hits + misses,
          };
        }
      } catch (error: any) {
        logger.warn('Could not fetch cache metrics:', error.message as any);
      }

      // Get database connection info
      let databaseMetrics = null;
      try {
        const prisma = req.app.get('prisma') as PrismaClient;
        if (prisma) {
          const connectionInfo = (await prisma.$queryRaw`
          SELECT 
            count(*) as total_connections,
            count(*) filter (where state = 'active') as active_connections,
            current_setting('max_connections')::int as max_connections
          FROM pg_stat_activity 
          WHERE pid <> pg_backend_pid()
        `) as any[];

          const conn = connectionInfo[0];
          databaseMetrics = {
            totalConnections: parseInt(conn.total_connections),
            activeConnections: parseInt(conn.active_connections),
            maxConnections: parseInt(conn.max_connections),
            connectionUsage: conn.total_connections / conn.max_connections,
          };
        }
      } catch (error: any) {
        logger.warn('Could not fetch database metrics:', error.message as any);
      }

      const response: any = {
        timestamp: new Date().toISOString(),
        timeWindow: `${timeWindowMinutes} minutes`,
        performance: performanceStats,
        system: {
          memory: {
            heapUsed: `${Math.round(systemStats.memory.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(systemStats.memory.heapTotal / 1024 / 1024)}MB`,
            external: `${Math.round(systemStats.memory.external / 1024 / 1024)}MB`,
            rss: `${Math.round(systemStats.memory.rss / 1024 / 1024)}MB`,
          },
          uptime: `${Math.round(systemStats.uptime)}s`,
          loadAverage: systemStats.loadAverage,
          cpuUsage: {
            user: systemStats.cpuUsage.user,
            system: systemStats.cpuUsage.system,
          },
        },
      };

      if (cacheMetrics) {
        response.cache = cacheMetrics;
      }

      if (databaseMetrics) {
        response.database = databaseMetrics;
      }

      // Add detailed endpoint breakdown if requested
      if (detailed) {
        const endpointPaths = performanceStats.topSlowPaths.slice(0, 10);
        response.endpoints = endpointPaths.map((endpoint) => ({
          path: endpoint.path,
          averageTime: `${endpoint.averageTime}ms`,
          requestCount: endpoint.count,
          metrics: PerformanceMonitor.getPathMetrics(endpoint.path, timeWindowMinutes),
        }));
      }

      res.json(response);
    } catch (error: any) {
      logger.error('Failed to get performance metrics:', error);
      res.status(500).json({
        error: 'Failed to retrieve performance metrics',
        details: process.env.NODE_ENV === 'development' ? (error.message as any) : undefined,
      });
    }
  },
);

/**
 * GET /api/performance/health
 * Get system health with performance indicators
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const performanceStats = PerformanceMonitor.getStats(5);
    const systemStats = PerformanceMonitor.getSystemStats();

    // Define health thresholds
    const thresholds = {
      responseTime: 1000, // 1 second
      errorRate: 0.05, // 5%
      memoryUsage: 0.8, // 80% of heap
      cpuThreshold: 0.9, // Not directly measurable, but we can check load
    };

    // Calculate health scores (0-100)
    const responseTimeScore = Math.max(
      0,
      100 - (performanceStats.averageResponseTime / thresholds.responseTime) * 100,
    );
    const errorRateScore = Math.max(
      0,
      100 - (performanceStats.errorRate / thresholds.errorRate) * 100,
    );
    const memoryScore = Math.max(
      0,
      100 - (systemStats.memory.heapUsed / systemStats.memory.heapTotal) * 100,
    );

    // Overall health score
    const healthScore = Math.round((responseTimeScore + errorRateScore + memoryScore) / 3);

    // Determine health status
    let status: 'healthy' | 'warning' | 'critical';
    if (healthScore >= 80) {
      status = 'healthy';
    } else if (healthScore >= 60) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    // Generate health issues
    const issues: string[] = [];
    if (performanceStats.averageResponseTime > thresholds.responseTime) {
      issues.push(`High response time: ${performanceStats.averageResponseTime}ms`);
    }
    if (performanceStats.errorRate > thresholds.errorRate) {
      issues.push(`High error rate: ${(performanceStats.errorRate * 100).toFixed(2)}%`);
    }
    if (systemStats.memory.heapUsed / systemStats.memory.heapTotal > thresholds.memoryUsage) {
      issues.push(
        `High memory usage: ${Math.round((systemStats.memory.heapUsed / systemStats.memory.heapTotal) * 100)}%`,
      );
    }

    const response = {
      status,
      healthScore,
      timestamp: new Date().toISOString(),
      uptime: systemStats.uptime,
      issues,
      metrics: {
        responseTime: {
          current: performanceStats.averageResponseTime,
          threshold: thresholds.responseTime,
          score: Math.round(responseTimeScore),
        },
        errorRate: {
          current: performanceStats.errorRate,
          threshold: thresholds.errorRate,
          score: Math.round(errorRateScore),
        },
        memory: {
          current: systemStats.memory.heapUsed / systemStats.memory.heapTotal,
          threshold: thresholds.memoryUsage,
          score: Math.round(memoryScore),
        },
        requests: {
          total: performanceStats.totalRequests,
          slowRequests: performanceStats.slowRequests,
        },
      },
      recommendations:
        issues.length > 0
          ? [
              'Monitor system performance closely',
              'Consider scaling resources if issues persist',
              'Review application logs for errors',
            ]
          : ['System performance is optimal', 'Continue current monitoring practices'],
    };

    // Set appropriate HTTP status based on health
    const httpStatus = status === 'healthy' ? 200 : status === 'warning' ? 200 : 503;
    res.status(httpStatus).json(response);
  } catch (error: any) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'critical',
      error: 'Health check system failure',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/performance/database
 * Get database performance analysis
 */
router.get('/database', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.get('prisma') as PrismaClient;
    if (!prisma) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Get connection pool status
    const connectionStats = (await prisma.$queryRaw`
      SELECT 
        count(*) as total_connections,
        count(*) filter (where state = 'active') as active_connections,
        count(*) filter (where state = 'idle') as idle_connections,
        current_setting('max_connections')::int as max_connections,
        current_setting('shared_buffers') as shared_buffers
      FROM pg_stat_activity 
      WHERE pid <> pg_backend_pid()
    `) as any[];

    // Get database size information
    const dbSize = (await prisma.$queryRaw`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        pg_database_size(current_database()) as database_size_bytes
    `) as any[];

    // Get table sizes
    const tableSizes = (await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10
    `) as any[];

    // Try to get query statistics if pg_stat_statements is available
    let queryStats = null;
    try {
      const extensionCheck = (await prisma.$queryRaw`
        SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') as enabled
      `) as any[];

      if (extensionCheck[0].enabled) {
        queryStats = (await prisma.$queryRaw`
          SELECT 
            count(*) as total_queries,
            avg(mean_exec_time) as avg_execution_time,
            max(mean_exec_time) as max_execution_time,
            count(*) filter (where mean_exec_time > 100) as slow_queries
          FROM pg_stat_statements
        `) as any[];
      }
    } catch (error: any) {
      // pg_stat_statements not available
      logger.debug('pg_stat_statements not available:', error.message as any);
    }

    const conn = connectionStats[0];
    const dbInfo = dbSize[0];

    const response = {
      timestamp: new Date().toISOString(),
      connection: {
        total: parseInt(conn.total_connections),
        active: parseInt(conn.active_connections),
        idle: parseInt(conn.idle_connections),
        max: parseInt(conn.max_connections),
        usage: ((conn.total_connections / conn.max_connections) * 100).toFixed(2) + '%',
      },
      database: {
        size: dbInfo.database_size,
        sizeBytes: parseInt(dbInfo.database_size_bytes),
        sharedBuffers: conn.shared_buffers,
      },
      tables: tableSizes.map((table: any) => ({
        schema: table.schemaname,
        name: table.tablename,
        size: table.total_size,
        sizeBytes: parseInt(table.size_bytes),
      })),
      queries: queryStats
        ? {
            total: parseInt(queryStats[0].total_queries),
            avgExecutionTime: parseFloat(queryStats[0].avg_execution_time).toFixed(2) + 'ms',
            maxExecutionTime: parseFloat(queryStats[0].max_execution_time).toFixed(2) + 'ms',
            slowQueries: parseInt(queryStats[0].slow_queries),
          }
        : null,
      recommendations: [],
    };

    // Generate recommendations
    const connectionUsage = conn.total_connections / conn.max_connections;
    if (connectionUsage > 0.8) {
      response.recommendations.push(
        'High connection usage detected. Consider connection pooling optimization.',
      );
    }
    if (queryStats && queryStats[0].slow_queries > 5) {
      response.recommendations.push(
        'Multiple slow queries detected. Review query performance and indexing.',
      );
    }
    if (response.recommendations.length === 0) {
      response.recommendations.push('Database performance is within acceptable parameters.');
    }

    res.json(response);
  } catch (error: any) {
    logger.error('Database performance analysis failed:', error);
    res.status(500).json({
      error: 'Failed to analyze database performance',
      details: process.env.NODE_ENV === 'development' ? (error.message as any) : undefined,
    });
  }
});

/**
 * GET /api/performance/recommendations
 * Get performance optimization recommendations
 */
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const performanceStats = PerformanceMonitor.getStats(15); // 15 minute window
    const systemStats = PerformanceMonitor.getSystemStats();

    // Generate comprehensive recommendations
    const recommendations = PerformanceMonitor.generateReport(15).recommendations;

    // Add specific recommendations based on current metrics
    const customRecommendations: Array<{
      category: string;
      priority: 'low' | 'medium' | 'high';
      title: string;
      description: string;
      impact: string;
      implementation: string;
    }> = [];

    // Response time recommendations
    if (performanceStats.averageResponseTime > 500) {
      customRecommendations.push({
        category: 'API Performance',
        priority: 'high',
        title: 'High API Response Times',
        description: `Average response time is ${performanceStats.averageResponseTime}ms, above the 200ms target.`,
        impact: 'Poor user experience, reduced application performance',
        implementation:
          'Implement response caching, optimize database queries, add CDN for static assets',
      });
    }

    // Memory usage recommendations
    const memoryUsageMB = systemStats.memory.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 400) {
      customRecommendations.push({
        category: 'Memory Management',
        priority: 'high',
        title: 'High Memory Usage',
        description: `Current memory usage is ${memoryUsageMB.toFixed(2)}MB, approaching the 512MB target.`,
        impact: 'Risk of memory leaks, potential application crashes',
        implementation:
          'Implement memory profiling, optimize object creation, enable garbage collection monitoring',
      });
    }

    // Error rate recommendations
    if (performanceStats.errorRate > 2) {
      customRecommendations.push({
        category: 'Error Handling',
        priority: 'medium',
        title: 'Elevated Error Rate',
        description: `Current error rate is ${performanceStats.errorRate.toFixed(2)}%, above the 1% target.`,
        impact: 'Reduced application reliability, poor user experience',
        implementation:
          'Review error logs, improve input validation, enhance error handling patterns',
      });
    }

    // Slow requests recommendations
    const slowRequestRate = performanceStats.slowRequests / performanceStats.totalRequests;
    if (slowRequestRate > 0.1) {
      customRecommendations.push({
        category: 'Request Optimization',
        priority: 'medium',
        title: 'High Slow Request Rate',
        description: `${(slowRequestRate * 100).toFixed(2)}% of requests are slow (>1s), above the 10% threshold.`,
        impact: 'Poor perceived performance, user dissatisfaction',
        implementation:
          'Implement request timeouts, optimize slow endpoints, add performance monitoring',
      });
    }

    // Add positive recommendations if performance is good
    if (customRecommendations.length === 0) {
      customRecommendations.push({
        category: 'Performance',
        priority: 'low',
        title: 'Optimal Performance',
        description: 'All performance metrics are within target ranges.',
        impact: 'Good user experience, stable application performance',
        implementation: 'Continue current monitoring and optimization practices',
      });
    }

    const response = {
      timestamp: new Date().toISOString(),
      summary: {
        totalRecommendations: customRecommendations.length,
        highPriority: customRecommendations.filter((r) => r.priority === 'high').length,
        mediumPriority: customRecommendations.filter((r) => r.priority === 'medium').length,
        lowPriority: customRecommendations.filter((r) => r.priority === 'low').length,
      },
      currentMetrics: {
        responseTime: performanceStats.averageResponseTime,
        errorRate: performanceStats.errorRate,
        memoryUsage: memoryUsageMB,
        slowRequestRate: slowRequestRate,
      },
      recommendations: customRecommendations,
      quickWins: [
        'Enable response compression for API endpoints',
        'Implement Redis caching for frequently accessed data',
        'Optimize database indexes for common queries',
        'Enable connection pooling for external services',
      ],
      monitoringAdvice: [
        'Set up automated performance alerts',
        'Implement application performance monitoring (APM)',
        'Create performance budgets for key metrics',
        'Regular performance testing in CI/CD pipeline',
      ],
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Failed to generate recommendations:', error);
    res.status(500).json({
      error: 'Failed to generate performance recommendations',
      details: process.env.NODE_ENV === 'development' ? (error.message as any) : undefined,
    });
  }
});

/**
 * POST /api/performance/optimize
 * Trigger automatic performance optimizations
 */
router.post('/optimize', async (req: Request, res: Response) => {
  // Only allow admin users to trigger optimizations
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const optimizations: Array<{ action: string; result: string }> = [];

    // Clear performance metrics cache
    PerformanceMonitor.clearMetrics();
    optimizations.push({
      action: 'Clear performance metrics cache',
      result: 'Performance metrics history cleared',
    });

    // Force garbage collection if available
    if (global.gc) {
      const beforeMemory = process.memoryUsage().heapUsed;
      global.gc();
      const afterMemory = process.memoryUsage().heapUsed;
      const freedMemory = beforeMemory - afterMemory;

      optimizations.push({
        action: 'Force garbage collection',
        result: `Freed ${(freedMemory / 1024 / 1024).toFixed(2)}MB of memory`,
      });
    }

    // Update database statistics
    try {
      const prisma = req.app.get('prisma') as PrismaClient;
      if (prisma) {
        await prisma.$executeRawUnsafe('ANALYZE;');
        optimizations.push({
          action: 'Update database statistics',
          result: 'Database query planner statistics updated',
        });
      }
    } catch (error: any) {
      optimizations.push({
        action: 'Update database statistics',
        result: `Failed: ${error.message as any}`,
      });
    }

    // Clear Redis cache if requested
    const clearCache = req.body?.clearCache === true;
    if (clearCache) {
      try {
        const redis = req.app.get('redis') as Redis;
        if (redis) {
          const deletedKeys = await redis.flushdb();
          optimizations.push({
            action: 'Clear Redis cache',
            result: 'All cached data cleared',
          });
        }
      } catch (error: any) {
        optimizations.push({
          action: 'Clear Redis cache',
          result: `Failed: ${error.message as any}`,
        });
      }
    }

    logger.info('Manual performance optimization triggered', {
      userId: req.user?.id,
      optimizations: optimizations.length,
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      optimizations,
      message: `${optimizations.length} optimization actions completed`,
    });
  } catch (error: any) {
    logger.error('Manual optimization failed:', error);
    res.status(500).json({
      error: 'Optimization process failed',
      details: process.env.NODE_ENV === 'development' ? (error.message as any) : undefined,
    });
  }
});

export { router as performanceRoutes };
