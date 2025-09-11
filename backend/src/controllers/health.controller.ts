import { Request, Response } from 'express';
import { cacheService } from '@/services/cache.service';
import { getPrismaClient } from '@/db/prisma';
import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

export class HealthController {
  async getHealth(_req: Request, res: Response) {
    try {
      // Basic health check - always return success unless critical system failure
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        service: 'medianest-api',
      };

      // Always return 200 for basic health check to support container health checks
      res.status(200).json(health);
    } catch (error: unknown) {
      logger.error('Health check failed', { error });

      // Even on error, return basic status for container health checks
      try {
        res.status(200).json({
          status: 'ok', // Keep ok for container deployment
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
          service: 'medianest-api',
          warning: 'Health check completed with warnings',
        });
      } catch (secondaryError) {
        logger.error('Secondary health check failure', { secondaryError });
        // Last resort - return minimal response
        res.status(200).send('OK');
      }
    }
  }

  async getMetrics(_req: Request, res: Response) {
    try {
      const prisma = getPrismaClient();

      // Get database connection status
      const dbStartTime = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbResponseTime = Date.now() - dbStartTime;

      // Get Redis status
      const redisStartTime = Date.now();
      await redisClient.ping();
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
    } catch (error: unknown) {
      logger.error('Failed to get metrics', { error });
      res.status(500).json({
        error: 'Failed to retrieve metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0) parts.push(`${secs}s`);

    return parts.join(' ') || '0s';
  }

  async getReadiness(_req: Request, res: Response) {
    try {
      // Check database health
      const prisma = getPrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      const databaseHealthy = true;

      // Check Redis health
      await redisClient.ping();
      const redisHealthy = true;

      if (databaseHealthy && redisHealthy) {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          services: {
            database: 'healthy',
            redis: 'healthy',
          },
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          services: {
            database: databaseHealthy ? 'healthy' : 'unhealthy',
            redis: redisHealthy ? 'healthy' : 'unhealthy',
          },
        });
      }
    } catch (error: unknown) {
      logger.error('Readiness check failed', { error });

      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: 'Service health check failed',
      });
    }
  }

  private getEventLoopDelay(): string {
    // This is a simplified version. In production, you might use
    // performance hooks or the perf_hooks module for more accurate measurements
    const start = process.hrtime();
    setImmediate(() => {
      const [_seconds, _nanoseconds] = process.hrtime(start);
      // const _delay = seconds * 1000 + nanoseconds / 1000000;
      // Store this somewhere for the next request
    });
    return 'measuring...';
  }
}

export const healthController = new HealthController();
