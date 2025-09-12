// @ts-nocheck
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';

import { CatchError } from '../types/common';
import { CircuitBreakerFactory } from '../utils/circuit-breaker';
import { logger } from '../utils/logger';

import { resilienceService } from './resilience.service';

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  timestamp: Date;
  metadata?: Record<string, any>;
  error?: string;
  uptime?: number;
  lastCheck?: Date;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: ComponentHealth[];
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
}

export interface AlertRule {
  name: string;
  condition: (health: ComponentHealth) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldownMs: number;
  lastTriggered?: Date;
}

export interface PerformanceMetrics {
  avgResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: number;
  activeConnections: number;
}

export class HealthMonitorService extends EventEmitter {
  private components = new Map<string, ComponentHealth>();
  private alertRules: AlertRule[] = [];
  private healthCheckInterval?: NodeJS.Timeout;
  private performanceMetrics: PerformanceMetrics;
  private startTime: Date;
  private requestCount = 0;
  private errorCount = 0;
  private totalResponseTime = 0;

  constructor(
    private prisma?: PrismaClient,
    private redis?: IORedis,
  ) {
    super();
    this.startTime = new Date();
    this.performanceMetrics = this.initializeMetrics();
    this.setupDefaultAlerts();
    this.startHealthMonitoring();
    this.setupPerformanceTracking();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      avgResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      memoryUsage: process.memoryUsage(),
      activeConnections: 0,
    };
  }

  private setupDefaultAlerts(): void {
    // Database connectivity alert
    this.addAlertRule({
      name: 'database-connectivity',
      condition: (health) => health.name === 'database' && health.status === 'unhealthy',
      severity: 'critical',
      cooldownMs: 60000, // 1 minute
    });

    // High response time alert
    this.addAlertRule({
      name: 'high-response-time',
      condition: (health) => health.responseTime > 5000, // 5 seconds
      severity: 'medium',
      cooldownMs: 300000, // 5 minutes
    });

    // Cache connectivity alert
    this.addAlertRule({
      name: 'cache-connectivity',
      condition: (health) => health.name === 'redis' && health.status === 'unhealthy',
      severity: 'high',
      cooldownMs: 120000, // 2 minutes
    });

    // Circuit breaker open alert
    this.addAlertRule({
      name: 'circuit-breaker-open',
      condition: (health) =>
        health.name.includes('circuit-breaker') && health.metadata?.state === 'OPEN',
      severity: 'high',
      cooldownMs: 180000, // 3 minutes
    });
  }

  // Health Check Methods
  async performSystemHealthCheck(): Promise<SystemHealth> {
    const healthChecks = await Promise.allSettled([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkCircuitBreakersHealth(),
      this.checkMemoryHealth(),
      this.checkExternalServicesHealth(),
    ]);

    const components: ComponentHealth[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    healthChecks.forEach((result, index) => {
      const componentNames = [
        'database',
        'redis',
        'circuit-breakers',
        'memory',
        'external-services',
      ];

      if (result.status === 'fulfilled') {
        const component = result.value;
        components.push(component);

        // Update overall status
        if (component.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (component.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } else {
        components.push({
          name: componentNames[index],
          status: 'unhealthy',
          responseTime: 0,
          timestamp: new Date(),
          error: result.reason.message,
        });
        overallStatus = 'unhealthy';
      }
    });

    const systemHealth: SystemHealth = {
      overall: overallStatus,
      components,
      timestamp: new Date(),
      uptime: (Date.now() - this.startTime.getTime()) / 1000,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    // Store components for monitoring
    components.forEach((component) => {
      this.components.set(component.name, component);
      this.checkAlerts(component);
    });

    this.emit('healthCheckCompleted', systemHealth);
    return systemHealth;
  }

  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = performance.now();

    try {
      if (!this.prisma) {
        return {
          name: 'database',
          status: 'degraded',
          responseTime: 0,
          timestamp: new Date(),
          error: 'Database client not configured',
        };
      }

      // Simple query to test connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = performance.now() - startTime;

      return {
        name: 'database',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        timestamp: new Date(),
        metadata: {
          connectionState: 'connected',
        },
      };
    } catch (error: CatchError) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        timestamp: new Date(),
        error: (error as Error).message,
      };
    }
  }

  private async checkRedisHealth(): Promise<ComponentHealth> {
    const startTime = performance.now();

    try {
      if (!this.redis) {
        return {
          name: 'redis',
          status: 'degraded',
          responseTime: 0,
          timestamp: new Date(),
          error: 'Redis client not configured',
        };
      }

      const testKey = `health_check_${Date.now()}`;
      await this.redis.set(testKey, 'test', 'EX', 5);
      const result = await this.redis.get(testKey);
      await this.redis.del(testKey);

      const responseTime = performance.now() - startTime;

      return {
        name: 'redis',
        status: result === 'test' && responseTime < 500 ? 'healthy' : 'degraded',
        responseTime,
        timestamp: new Date(),
        metadata: {
          connectionState: this.redis.status,
          memoryUsage: await this.getRedisMemoryUsage(),
        },
      };
    } catch (error: CatchError) {
      return {
        name: 'redis',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        timestamp: new Date(),
        error: (error as Error).message,
      };
    }
  }

  private async getRedisMemoryUsage(): Promise<string | undefined> {
    try {
      const info = await this.redis?.info('memory');
      const match = info?.match(/used_memory_human:(.+)/);
      return match?.[1]?.trim();
    } catch {
      return undefined;
    }
  }

  private async checkCircuitBreakersHealth(): Promise<ComponentHealth> {
    const startTime = performance.now();

    try {
      const allStats = CircuitBreakerFactory.getAllStats();
      const circuitBreakers = Object.entries(allStats);

      let healthyCount = 0;
      let degradedCount = 0;
      let unhealthyCount = 0;

      const breakerDetails: Record<string, any> = {};

      circuitBreakers.forEach(([name, stats]) => {
        breakerDetails[name] = stats;

        if (stats.state === 'OPEN') {
          unhealthyCount++;
        } else if (stats.errorRate > 10) {
          // More than 10% error rate
          degradedCount++;
        } else {
          healthyCount++;
        }
      });

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (unhealthyCount > 0) {
        status = 'unhealthy';
      } else if (degradedCount > 0) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return {
        name: 'circuit-breakers',
        status,
        responseTime: performance.now() - startTime,
        timestamp: new Date(),
        metadata: {
          totalBreakers: circuitBreakers.length,
          healthyCount,
          degradedCount,
          unhealthyCount,
          breakerDetails,
        },
      };
    } catch (error: CatchError) {
      return {
        name: 'circuit-breakers',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        timestamp: new Date(),
        error: (error as Error).message,
      };
    }
  }

  private async checkMemoryHealth(): Promise<ComponentHealth> {
    const startTime = performance.now();

    try {
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapTotal;
      const usedMemory = memUsage.heapUsed;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (memoryUsagePercent > 90) {
        status = 'unhealthy';
      } else if (memoryUsagePercent > 75) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return {
        name: 'memory',
        status,
        responseTime: performance.now() - startTime,
        timestamp: new Date(),
        metadata: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memUsage.external / 1024 / 1024), // MB
          rss: Math.round(memUsage.rss / 1024 / 1024), // MB
          usagePercent: Math.round(memoryUsagePercent * 100) / 100,
        },
      };
    } catch (error: CatchError) {
      return {
        name: 'memory',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        timestamp: new Date(),
        error: (error as Error).message,
      };
    }
  }

  private async checkExternalServicesHealth(): Promise<ComponentHealth> {
    const startTime = performance.now();

    try {
      const overallHealth = await resilienceService.getOverallHealthStatus();

      const externalServices = Object.values(overallHealth.services);
      const healthyServices = externalServices.filter((s) => s.healthy);
      const unhealthyServices = externalServices.filter((s) => !s.healthy);

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (unhealthyServices.length === 0) {
        status = 'healthy';
      } else if (healthyServices.length > unhealthyServices.length) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        name: 'external-services',
        status,
        responseTime: performance.now() - startTime,
        timestamp: new Date(),
        metadata: {
          totalServices: externalServices.length,
          healthyServices: healthyServices.length,
          unhealthyServices: unhealthyServices.length,
          services: overallHealth.services,
        },
      };
    } catch (error: CatchError) {
      return {
        name: 'external-services',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        timestamp: new Date(),
        error: (error as Error).message,
      };
    }
  }

  // Performance Monitoring
  private setupPerformanceTracking(): void {
    // Update metrics every 10 seconds
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 10000);
  }

  private updatePerformanceMetrics(): void {
    this.performanceMetrics = {
      avgResponseTime: this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
      requestsPerSecond: this.requestCount / 10, // Reset every 10 seconds
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      memoryUsage: process.memoryUsage(),
      activeConnections: this.getActiveConnectionCount(),
    };

    // Reset counters
    this.requestCount = 0;
    this.errorCount = 0;
    this.totalResponseTime = 0;

    this.emit('metricsUpdated', this.performanceMetrics);
  }

  trackRequest(responseTime: number, isError = false): void {
    this.requestCount++;
    this.totalResponseTime += responseTime;

    if (isError) {
      this.errorCount++;
    }
  }

  private getActiveConnectionCount(): number {
    // This would typically be retrieved from your server instance
    // For now, return a placeholder
    return 0;
  }

  // Alert System
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    logger.info(`Added health alert rule: ${rule.name}`, {
      severity: rule.severity,
      cooldownMs: rule.cooldownMs,
    });
  }

  private checkAlerts(component: ComponentHealth): void {
    this.alertRules.forEach((rule) => {
      if (rule.condition(component)) {
        const now = new Date();

        // Check cooldown
        if (rule.lastTriggered && now.getTime() - rule.lastTriggered.getTime() < rule.cooldownMs) {
          return;
        }

        rule.lastTriggered = now;

        const alert = {
          rule: rule.name,
          severity: rule.severity,
          component: component.name,
          message: `Health alert: ${rule.name} triggered for ${component.name}`,
          timestamp: now,
          componentHealth: component,
        };

        logger.warn(`Health alert triggered: ${rule.name}`, alert);
        this.emit('alertTriggered', alert);

        // For critical alerts, also emit to resilience service
        if (rule.severity === 'critical') {
          this.emit('criticalAlert', alert);
        }
      }
    });
  }

  // Health Monitoring Control
  private startHealthMonitoring(): void {
    // Perform initial health check
    this.performSystemHealthCheck();

    // Schedule regular health checks every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performSystemHealthCheck().catch((error: any) => {
        logger.error('Scheduled health check failed', { error });
      });
    }, 30000);
  }

  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  // Getters
  getComponentHealth(componentName: string): ComponentHealth | undefined {
    return this.components.get(componentName);
  }

  getAllComponentsHealth(): ComponentHealth[] {
    return Array.from(this.components.values());
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  getSystemUptime(): number {
    return (Date.now() - this.startTime.getTime()) / 1000;
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitorService();
