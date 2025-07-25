import { Request, Response } from 'express';

import { getRedis } from '@/config/redis';
import { getPrismaClient } from '@/db/prisma';
import { cacheService } from '@/services/cache.service';
import { healthService } from '@/services/health.service';
import { logger } from '@/utils/logger';
import { slaMonitor } from '@/utils/sla-monitor';

export class HealthController {
  /**
   * Basic health check endpoint for load balancers
   * GET /api/health
   */
  async getHealth(_req: Request, res: Response): Promise<void> {
    try {
      const isLive = await healthService.checkLiveness();

      if (!isLive) {
        res.status(503).json({
          status: 'unhealthy',
          message: 'Service is not responding',
        });
        return;
      }

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Health check failed', { error: errorMessage });
      res.status(503).json({
        status: 'unhealthy',
        message: 'Service unavailable',
      });
    }
  }

  /**
   * Readiness check endpoint for Kubernetes
   * GET /api/health/ready
   */
  async getReadiness(_req: Request, res: Response): Promise<void> {
    try {
      const isReady = await healthService.checkReadiness();

      if (!isReady) {
        res.status(503).json({
          status: 'not_ready',
          message: 'Service is not ready to accept traffic',
        });
        return;
      }

      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Readiness check failed', { error: errorMessage });
      res.status(503).json({
        status: 'not_ready',
        message: errorMessage,
      });
    }
  }

  /**
   * Liveness check endpoint for Kubernetes
   * GET /api/health/live
   */
  async getLiveness(_req: Request, res: Response): Promise<void> {
    try {
      const isLive = await healthService.checkLiveness();

      if (!isLive) {
        res.status(503).json({
          status: 'unhealthy',
          message: 'Service is not responding',
        });
        return;
      }

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Liveness check failed', { error: errorMessage });
      res.status(503).json({
        status: 'unhealthy',
        message: errorMessage,
      });
    }
  }

  /**
   * Detailed health check endpoint with component status
   * GET /api/health/details
   */
  async getDetailedHealth(req: Request, res: Response): Promise<void> {
    try {
      const detailed = req.query.detailed === 'true';
      const health = await healthService.checkHealth(detailed);

      // Set appropriate status code based on health
      let statusCode = 200;
      if (health.status === 'degraded') statusCode = 200; // Still return 200 for degraded
      if (health.status === 'unhealthy') statusCode = 503;

      // Set cache headers
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      });

      res.status(statusCode).json(health);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Detailed health check failed', { error: errorMessage });
      res.status(503).json({
        status: 'unhealthy',
        message: 'Failed to perform health check',
        error: errorMessage,
      });
    }
  }

  async getMetrics(_req: Request, res: Response): Promise<void> {
    try {
      const prisma = getPrismaClient();

      // Get database connection status
      const dbStartTime = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbResponseTime = Date.now() - dbStartTime;

      // Get Redis status
      const redisStartTime = Date.now();
      const redis = getRedis();
      await redis.ping();
      const redisResponseTime = Date.now() - redisStartTime;

      // Get cache metrics
      const cacheInfo = await cacheService.getInfo();

      // Get memory usage
      const memUsage = process.memoryUsage();
      const formatBytes = (bytes: number) => {
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
      };

      // Get CPU usage
      const cpuUsage = process.cpuUsage();

      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: {
          seconds: process.uptime(),
          formatted: this.formatUptime(process.uptime()),
        },
        memory: {
          rss: formatBytes(memUsage.rss),
          heapTotal: formatBytes(memUsage.heapTotal),
          heapUsed: formatBytes(memUsage.heapUsed),
          external: formatBytes(memUsage.external),
          arrayBuffers: formatBytes(memUsage.arrayBuffers),
        },
        cpu: {
          user: cpuUsage.user / 1000000, // Convert to seconds
          system: cpuUsage.system / 1000000,
        },
        database: {
          status: 'connected',
          responseTime: `${dbResponseTime}ms`,
        },
        redis: {
          status: 'connected',
          responseTime: `${redisResponseTime}ms`,
          keyCount: cacheInfo.keyCount,
          memoryUsage: cacheInfo.memoryUsage,
        },
        performance: {
          eventLoopDelay: this.getEventLoopDelay(),
          activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
          activeRequests: (process as any)._getActiveRequests?.()?.length || 0,
        },
      };

      // Set cache headers for metrics endpoint
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      });

      res.json(metrics);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get metrics', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to retrieve metrics',
        message: errorMessage,
      });
    }
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0) parts.push(`${secs}s`);

    return parts.join(' ') || '0s';
  }

  private getEventLoopDelay(): string {
    // This is a simplified version. In production, you might use
    // performance hooks or the perf_hooks module for more accurate measurements
    const start = process.hrtime();
    setImmediate(() => {
      const [_seconds, _nanoseconds] = process.hrtime(start);
      // const delay = seconds * 1000 + nanoseconds / 1000000;
      // Store this somewhere for the next request
    });
    return 'measuring...';
  }

  /**
   * SLA metrics endpoint
   * GET /api/health/sla
   */
  async getSLAMetrics(req: Request, res: Response): Promise<void> {
    try {
      const service = req.query.service as string;

      const metrics = service ? slaMonitor.getServiceMetrics(service) : slaMonitor.getAllMetrics();

      if (!metrics) {
        res.status(404).json({
          error: 'No metrics available for the specified service',
        });
        return;
      }

      res.json({
        timestamp: new Date().toISOString(),
        metrics,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get SLA metrics', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to retrieve SLA metrics',
        message: errorMessage,
      });
    }
  }
}

export const healthController = new HealthController();
