import { execSync } from 'child_process';

import { Router, Request, Response, NextFunction } from 'express';

import { logger } from '../utils/logger';

const router = Router();

/**
 * Get container statistics for resource monitoring
 */
router.get(
  '/container-stats',
  async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    try {
      // Only allow in non-production environments for security
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Container stats not available in production' });
      }

      const stats = {
        timestamp: new Date().toISOString(),
        cpu_usage: 0,
        memory_usage: 0,
        network_io: 0,
        limits: {
          cpu: 'N/A',
          memory: 'N/A',
        },
      };

      try {
        // Get basic system stats
        const cpuInfo = process.cpuUsage();
        const memoryInfo = process.memoryUsage();

        stats.cpu_usage = (cpuInfo.user + cpuInfo.system) / 1000; // Convert to milliseconds
        stats.memory_usage = memoryInfo.heapUsed;

        // Try to get container limits if available
        try {
          const containerName = process.env.CONTAINER_NAME || 'medianest_app';
          const memoryLimit = execSync(
            `cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null || echo "0"`,
            { encoding: 'utf8' },
          ).trim();
          const cpuQuota = execSync(
            `cat /sys/fs/cgroup/cpu/cpu.cfs_quota_us 2>/dev/null || echo "-1"`,
            { encoding: 'utf8' },
          ).trim();
          const cpuPeriod = execSync(
            `cat /sys/fs/cgroup/cpu/cpu.cfs_period_us 2>/dev/null || echo "100000"`,
            { encoding: 'utf8' },
          ).trim();

          if (parseInt(memoryLimit) > 0) {
            stats.limits.memory = parseInt(memoryLimit).toString();
          }

          if (parseInt(cpuQuota) > 0) {
            stats.limits.cpu = (parseInt(cpuQuota) / parseInt(cpuPeriod)).toString();
          }
        } catch (error) {
          // Container limits not available, use Node.js process info
          logger.debug('Container limits not available, using process info');
        }
      } catch (error: any) {
        logger.error('Error getting system stats:', error);
      }

      return res.json(stats);
    } catch (error: any) {
      logger.error('Container stats endpoint error:', error);
      return res.status(500).json({
        error: 'Failed to get container statistics',
        message: error.message,
      });
    }
  },
);

/**
 * System status endpoint
 */
router.get(
  '/status',
  async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    try {
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      const status = {
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime)}s`,
        memory: {
          rss: memoryUsage.rss,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        nodejs: {
          version: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        environment: process.env.NODE_ENV || 'development',
      };

      return res.json(status);
    } catch (error: any) {
      logger.error('System status endpoint error:', error);
      return res.status(500).json({
        error: 'Failed to get system status',
        message: error.message,
      });
    }
  },
);

export default router;
