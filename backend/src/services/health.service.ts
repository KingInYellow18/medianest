import * as fs from 'fs/promises';
import * as os from 'os';
import { performance } from 'perf_hooks';

import axios from 'axios';

import { redisClient } from '@/config/redis';
import { getPrismaClient } from '@/db/prisma';
import { logger } from '@/utils/logger';
import { slaMonitor } from '@/utils/sla-monitor';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  message?: string;
  details?: Record<string, any>;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: HealthCheckResult[];
  system?: {
    cpu: {
      usage: number;
      count: number;
      loadAvg: number[];
    };
    memory: {
      total: string;
      free: string;
      used: string;
      percentage: number;
    };
    disk: {
      total: string;
      free: string;
      used: string;
      percentage: number;
    };
  };
}

export class HealthService {
  private readonly healthChecks: Map<string, () => Promise<HealthCheckResult>>;
  private readonly criticalServices = ['database', 'redis'];

  constructor() {
    this.healthChecks = new Map();
    this.registerDefaultChecks();
  }

  private registerDefaultChecks() {
    // Database health check
    this.registerCheck('database', async () => {
      const start = performance.now();
      try {
        const prisma = getPrismaClient();
        await prisma.$queryRaw`SELECT 1`;
        const responseTime = performance.now() - start;

        // Record response time for SLA monitoring
        slaMonitor.recordResponseTime('database', responseTime);

        // Check for slow queries
        if (responseTime > 1000) {
          return {
            service: 'database',
            status: 'degraded',
            responseTime,
            message: 'Slow database response',
          };
        }

        return {
          service: 'database',
          status: 'healthy',
          responseTime,
          message: 'PostgreSQL is responding normally',
        };
      } catch (error) {
        const responseTime = performance.now() - start;
        logger.error('Database health check failed', { error });
        slaMonitor.recordFailure('database', error.message);
        return {
          service: 'database',
          status: 'unhealthy',
          responseTime,
          message: error.message,
        };
      }
    });

    // Redis health check
    this.registerCheck('redis', async () => {
      const start = performance.now();
      try {
        const pong = await redisClient.ping();
        const responseTime = performance.now() - start;

        // Record response time for SLA monitoring
        slaMonitor.recordResponseTime('redis', responseTime);

        if (pong !== 'PONG') {
          slaMonitor.recordFailure('redis', 'Invalid Redis response');
          return {
            service: 'redis',
            status: 'unhealthy',
            responseTime,
            message: 'Invalid Redis response',
          };
        }

        // Check Redis memory usage
        const info = await redisClient.info('memory');
        const memoryUsed = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0');
        const maxMemory = parseInt(info.match(/maxmemory:(\d+)/)?.[1] || '0');

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (maxMemory > 0 && memoryUsed / maxMemory > 0.9) {
          status = 'degraded';
        }

        return {
          service: 'redis',
          status,
          responseTime,
          message:
            status === 'healthy' ? 'Redis is responding normally' : 'Redis memory usage is high',
          details: {
            memoryUsed: this.formatBytes(memoryUsed),
            maxMemory: maxMemory > 0 ? this.formatBytes(maxMemory) : 'unlimited',
          },
        };
      } catch (error) {
        const responseTime = performance.now() - start;
        logger.error('Redis health check failed', { error });
        slaMonitor.recordFailure('redis', error.message);
        return {
          service: 'redis',
          status: 'unhealthy',
          responseTime,
          message: error.message,
        };
      }
    });

    // External services health check
    this.registerCheck('external_services', async () => {
      const results: Record<string, any> = {};

      // Check Plex
      if (process.env.PLEX_URL) {
        try {
          const start = performance.now();
          const response = await axios.get(`${process.env.PLEX_URL}/identity`, {
            timeout: 5000,
            headers: {
              'X-Plex-Token': process.env.PLEX_TOKEN || '',
            },
          });
          results.plex = {
            status: response.status === 200 ? 'healthy' : 'degraded',
            responseTime: performance.now() - start,
          };
        } catch (error) {
          results.plex = {
            status: 'unhealthy',
            message: 'Plex is not reachable',
          };
        }
      }

      // Check Overseerr
      if (process.env.OVERSEERR_URL) {
        try {
          const start = performance.now();
          const response = await axios.get(`${process.env.OVERSEERR_URL}/api/v1/status`, {
            timeout: 5000,
            headers: {
              'X-Api-Key': process.env.OVERSEERR_API_KEY || '',
            },
          });
          results.overseerr = {
            status: response.status === 200 ? 'healthy' : 'degraded',
            responseTime: performance.now() - start,
          };
        } catch (error) {
          results.overseerr = {
            status: 'unhealthy',
            message: 'Overseerr is not reachable',
          };
        }
      }

      // Check Uptime Kuma
      if (process.env.UPTIME_KUMA_URL) {
        try {
          const start = performance.now();
          const response = await axios.get(
            `${process.env.UPTIME_KUMA_URL}/api/status-page/heartbeat`,
            {
              timeout: 5000,
            },
          );
          results.uptimeKuma = {
            status: response.status === 200 ? 'healthy' : 'degraded',
            responseTime: performance.now() - start,
          };
        } catch (error) {
          results.uptimeKuma = {
            status: 'unhealthy',
            message: 'Uptime Kuma is not reachable',
          };
        }
      }

      // Determine overall status
      const services = Object.values(results);
      const unhealthyCount = services.filter((s: any) => s.status === 'unhealthy').length;
      const degradedCount = services.filter((s: any) => s.status === 'degraded').length;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (unhealthyCount > 0) status = 'degraded';
      if (unhealthyCount === services.length) status = 'unhealthy';

      return {
        service: 'external_services',
        status,
        message: `${services.length - unhealthyCount} of ${services.length} external services are healthy`,
        details: results,
      };
    });

    // Disk space check
    this.registerCheck('disk_space', async () => {
      try {
        const diskInfo = await this.getDiskInfo();
        const usagePercent = (diskInfo.used / diskInfo.total) * 100;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (usagePercent > 80) status = 'degraded';
        if (usagePercent > 95) status = 'unhealthy';

        return {
          service: 'disk_space',
          status,
          message: `Disk usage is at ${usagePercent.toFixed(1)}%`,
          details: {
            total: this.formatBytes(diskInfo.total),
            free: this.formatBytes(diskInfo.free),
            used: this.formatBytes(diskInfo.used),
            percentage: usagePercent.toFixed(1),
          },
        };
      } catch (error) {
        return {
          service: 'disk_space',
          status: 'unhealthy',
          message: 'Failed to check disk space',
        };
      }
    });

    // Memory check
    this.registerCheck('memory', async () => {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const usagePercent = (usedMem / totalMem) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (usagePercent > 80) status = 'degraded';
      if (usagePercent > 95) status = 'unhealthy';

      return {
        service: 'memory',
        status,
        message: `Memory usage is at ${usagePercent.toFixed(1)}%`,
        details: {
          total: this.formatBytes(totalMem),
          free: this.formatBytes(freeMem),
          used: this.formatBytes(usedMem),
          percentage: usagePercent.toFixed(1),
        },
      };
    });

    // CPU check
    this.registerCheck('cpu', async () => {
      const loadAvg = os.loadavg();
      const cpuCount = os.cpus().length;
      const loadPerCpu = loadAvg[0] / cpuCount;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (loadPerCpu > 0.7) status = 'degraded';
      if (loadPerCpu > 0.9) status = 'unhealthy';

      return {
        service: 'cpu',
        status,
        message: `CPU load average is ${loadAvg[0].toFixed(2)}`,
        details: {
          loadAverage: loadAvg,
          cpuCount,
          loadPerCpu: loadPerCpu.toFixed(2),
        },
      };
    });
  }

  registerCheck(name: string, check: () => Promise<HealthCheckResult>) {
    this.healthChecks.set(name, check);
  }

  async checkHealth(detailed: boolean = false): Promise<SystemHealth> {
    const checks: HealthCheckResult[] = [];

    // Run all health checks in parallel
    const checkPromises = Array.from(this.healthChecks.entries()).map(async ([name, check]) => {
      try {
        const result = await check();
        return result;
      } catch (error) {
        logger.error(`Health check ${name} failed`, { error });
        return {
          service: name,
          status: 'unhealthy',
          message: `Health check failed: ${error.message}`,
        };
      }
    });

    const results = await Promise.all(checkPromises);
    checks.push(...results);

    // Determine overall system status
    const unhealthyChecks = checks.filter((c) => c.status === 'unhealthy');
    const degradedChecks = checks.filter((c) => c.status === 'degraded');
    const criticalUnhealthy = unhealthyChecks.filter((c) =>
      this.criticalServices.includes(c.service),
    );

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (degradedChecks.length > 0 || unhealthyChecks.length > 0) {
      overallStatus = 'degraded';
    }
    if (criticalUnhealthy.length > 0) {
      overallStatus = 'unhealthy';
    }

    const health: SystemHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks,
    };

    // Add detailed system information if requested
    if (detailed) {
      const cpuUsage = process.cpuUsage();
      const memUsage = process.memoryUsage();
      const diskInfo = await this.getDiskInfo();

      health.system = {
        cpu: {
          usage: cpuUsage.user + cpuUsage.system,
          count: os.cpus().length,
          loadAvg: os.loadavg(),
        },
        memory: {
          total: this.formatBytes(os.totalmem()),
          free: this.formatBytes(os.freemem()),
          used: this.formatBytes(os.totalmem() - os.freemem()),
          percentage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
        },
        disk: {
          total: this.formatBytes(diskInfo.total),
          free: this.formatBytes(diskInfo.free),
          used: this.formatBytes(diskInfo.used),
          percentage: (diskInfo.used / diskInfo.total) * 100,
        },
      };
    }

    return health;
  }

  async checkReadiness(): Promise<boolean> {
    // Check if critical services are ready
    const criticalChecks = await Promise.all(
      this.criticalServices.map(async (service) => {
        const check = this.healthChecks.get(service);
        if (!check) return false;

        try {
          const result = await check();
          return result.status !== 'unhealthy';
        } catch {
          return false;
        }
      }),
    );

    return criticalChecks.every((ready) => ready);
  }

  async checkLiveness(): Promise<boolean> {
    // Simple liveness check - if the process is running and can respond
    try {
      // Check event loop responsiveness
      const start = Date.now();
      await new Promise((resolve) => setImmediate(resolve));
      const eventLoopDelay = Date.now() - start;

      // If event loop is blocked for more than 1 second, consider unhealthy
      return eventLoopDelay < 1000;
    } catch {
      return false;
    }
  }

  private async getDiskInfo(): Promise<{ total: number; free: number; used: number }> {
    try {
      const stats = await fs.statfs('/');
      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;
      const used = total - free;

      return { total, free, used };
    } catch (error) {
      // Fallback for systems where statfs is not available
      return { total: 0, free: 0, used: 0 };
    }
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
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
}

export const healthService = new HealthService();
