import * as dns from 'dns/promises';
import * as net from 'net';
import { performance } from 'perf_hooks';

import axios, { AxiosRequestConfig } from 'axios';

import { HealthCheckResult } from '@/services/health.service';

export interface HealthCheckConfig {
  timeout?: number;
  retries?: number;
  interval?: number;
}

export class HealthChecker {
  private readonly defaultConfig: HealthCheckConfig = {
    timeout: 5000,
    retries: 1,
    interval: 1000,
  };

  constructor(private config: HealthCheckConfig = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * HTTP health check
   */
  async checkHttp(url: string, options?: AxiosRequestConfig): Promise<HealthCheckResult> {
    const start = performance.now();
    const service = new URL(url).hostname;

    try {
      const response = await axios({
        url,
        method: 'GET',
        timeout: this.config.timeout,
        validateStatus: (status) => status < 500,
        ...options,
      });

      const responseTime = performance.now() - start;

      if (response.status >= 200 && response.status < 300) {
        return {
          service,
          status: 'healthy',
          responseTime,
          message: `HTTP ${response.status} OK`,
        };
      } else if (response.status >= 400 && response.status < 500) {
        return {
          service,
          status: 'degraded',
          responseTime,
          message: `HTTP ${response.status} Client Error`,
        };
      } else {
        return {
          service,
          status: 'unhealthy',
          responseTime,
          message: `HTTP ${response.status} Server Error`,
        };
      }
    } catch (error) {
      return {
        service,
        status: 'unhealthy',
        responseTime: performance.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * TCP port health check
   */
  async checkTcp(host: string, port: number, serviceName?: string): Promise<HealthCheckResult> {
    const start = performance.now();
    const service = serviceName || `${host}:${port}`;

    return new Promise((resolve) => {
      const socket = new net.Socket();

      socket.setTimeout(this.config.timeout || 5000);

      socket.on('connect', () => {
        socket.destroy();
        resolve({
          service,
          status: 'healthy',
          responseTime: performance.now() - start,
          message: `TCP connection successful`,
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          service,
          status: 'unhealthy',
          responseTime: performance.now() - start,
          message: 'Connection timeout',
        });
      });

      socket.on('error', (error) => {
        resolve({
          service,
          status: 'unhealthy',
          responseTime: performance.now() - start,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      });

      socket.connect(port, host);
    });
  }

  /**
   * DNS health check
   */
  async checkDns(hostname: string): Promise<HealthCheckResult> {
    const start = performance.now();

    try {
      const addresses = await dns.resolve4(hostname);
      const responseTime = performance.now() - start;

      if (addresses.length > 0) {
        return {
          service: `DNS:${hostname}`,
          status: 'healthy',
          responseTime,
          message: `Resolved to ${addresses.length} addresses`,
          details: { addresses },
        };
      } else {
        return {
          service: `DNS:${hostname}`,
          status: 'unhealthy',
          responseTime,
          message: 'No addresses resolved',
        };
      }
    } catch (error) {
      return {
        service: `DNS:${hostname}`,
        status: 'unhealthy',
        responseTime: performance.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process health check
   */
  async checkProcess(pid?: number): Promise<HealthCheckResult> {
    const targetPid = pid || process.pid;

    try {
      // Check if process exists
      process.kill(targetPid, 0);

      // Get process info
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      return {
        service: `Process:${targetPid}`,
        status: 'healthy',
        message: 'Process is running',
        details: {
          pid: targetPid,
          uptime: process.uptime(),
          memory: {
            rss: this.formatBytes(memUsage.rss),
            heapTotal: this.formatBytes(memUsage.heapTotal),
            heapUsed: this.formatBytes(memUsage.heapUsed),
          },
          cpu: {
            user: (cpuUsage.user / 1000000).toFixed(2) + 's',
            system: (cpuUsage.system / 1000000).toFixed(2) + 's',
          },
        },
      };
    } catch (error) {
      return {
        service: `Process:${targetPid}`,
        status: 'unhealthy',
        message: 'Process not found or not accessible',
      };
    }
  }

  /**
   * Custom health check with retry logic
   */
  async checkWithRetry(
    checkFn: () => Promise<HealthCheckResult>,
    retries?: number,
  ): Promise<HealthCheckResult> {
    const maxRetries = retries || this.config.retries || 1;
    let lastResult: HealthCheckResult;

    for (let i = 0; i < maxRetries; i++) {
      lastResult = await checkFn();

      if (lastResult.status === 'healthy') {
        return lastResult;
      }

      // Wait before retry (except on last attempt)
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, this.config.interval));
      }
    }

    return lastResult!;
  }

  /**
   * Composite health check
   */
  async checkMultiple(checks: Array<() => Promise<HealthCheckResult>>): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    results: HealthCheckResult[];
  }> {
    const results = await Promise.all(checks.map((check) => check()));

    const unhealthyCount = results.filter((r) => r.status === 'unhealthy').length;
    const degradedCount = results.filter((r) => r.status === 'degraded').length;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (degradedCount > 0 || unhealthyCount > 0) {
      status = 'degraded';
    }
    if (unhealthyCount === results.length) {
      status = 'unhealthy';
    }

    return { status, results };
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
}

/**
 * Circuit breaker for health checks
 */
export class HealthCheckCircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly halfOpenAttempts: number = 3,
  ) {}

  async execute<T>(operation: () => Promise<T>, fallback?: () => T): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else if (fallback) {
        return fallback();
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === 'half-open') {
      this.failures--;
      if (this.failures <= 0) {
        this.failures = 0;
        this.state = 'closed';
      }
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Health check scheduler
 */
export class HealthCheckScheduler {
  private intervals: Map<string, NodeJS.Timer> = new Map();

  schedule(name: string, check: () => Promise<void>, intervalMs: number) {
    // Clear existing interval if any
    this.unschedule(name);

    // Schedule new interval
    const interval = setInterval(async () => {
      try {
        await check();
      } catch (error) {
        console.error(`Health check ${name} failed:`, error);
      }
    }, intervalMs);

    this.intervals.set(name, interval);
  }

  unschedule(name: string) {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
  }

  unscheduleAll() {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }
}

// Export singleton instances
export const healthChecker = new HealthChecker();
export const healthScheduler = new HealthCheckScheduler();
