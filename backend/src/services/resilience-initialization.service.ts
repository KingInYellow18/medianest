import { logger } from '../utils/logger';
import { resilienceService } from './resilience.service';
import { healthMonitor } from './health-monitor.service';
import { errorRecoveryManager } from '../utils/error-recovery';
import { CircuitBreakerFactory } from '../utils/circuit-breaker';
import {
  getMergedConfig,
  serviceDependencies,
  bulkheadCompartments,
  alertThresholds,
} from '../config/resilience.config';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';

export class ResilienceInitializationService {
  private initialized = false;

  async initialize(prisma?: PrismaClient, redis?: IORedis): Promise<void> {
    if (this.initialized) {
      logger.warn('Resilience system already initialized');
      return;
    }

    logger.info('Initializing resilience system...');

    try {
      // Get configuration
      const config = getMergedConfig();

      // Initialize circuit breakers
      await this.initializeCircuitBreakers(config);

      // Register service dependencies
      await this.registerServiceDependencies(prisma, redis);

      // Setup error recovery strategies
      await this.setupErrorRecovery(redis);

      // Configure health monitoring
      await this.configureHealthMonitoring(prisma, redis);

      // Setup alert system
      await this.setupAlertSystem();

      // Initialize bulkhead compartments
      await this.initializeBulkheadCompartments();

      // Start monitoring
      await this.startMonitoring();

      this.initialized = true;
      logger.info('Resilience system initialization completed successfully');

      // Log system status
      await this.logSystemStatus();
    } catch (error: any) {
      logger.error('Failed to initialize resilience system', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  private async initializeCircuitBreakers(config: any): Promise<void> {
    logger.info('Initializing circuit breakers...');

    for (const [name, options] of Object.entries(config.circuitBreakers)) {
      try {
        const circuitBreaker = CircuitBreakerFactory.create(name, options as any);

        // Setup event listeners for monitoring
        circuitBreaker.on('stateChange', (state, stats) => {
          logger.info(`Circuit breaker ${name} state changed`, {
            circuitBreaker: name,
            newState: state,
            stats,
          });

          // Emit to health monitor for alerting
          healthMonitor.emit('circuitBreakerStateChange', {
            name,
            state,
            stats,
            timestamp: new Date(),
          });
        });

        circuitBreaker.on('callFailed', ({ error, duration, state }) => {
          logger.warn(`Circuit breaker ${name} call failed`, {
            circuitBreaker: name,
            error: error.message as any,
            duration,
            state,
          });
        });

        circuitBreaker.on('callRejected', (error) => {
          logger.warn(`Circuit breaker ${name} rejected call`, {
            circuitBreaker: name,
            error: error.message as any,
          });
        });

        logger.debug(`Initialized circuit breaker: ${name}`, options);
      } catch (error: any) {
        logger.error(`Failed to initialize circuit breaker: ${name}`, {
          error: (error as Error).message,
          options,
        });
      }
    }

    logger.info(`Initialized ${Object.keys(config.circuitBreakers).length} circuit breakers`);
  }

  private async registerServiceDependencies(prisma?: PrismaClient, redis?: IORedis): Promise<void> {
    logger.info('Registering service dependencies...');

    for (const dependency of serviceDependencies) {
      try {
        // Enhanced dependency with actual health check functions
        const enhancedDependency = {
          ...dependency,
          healthCheckFn:
            dependency.healthCheckFn ||
            (await this.createHealthCheckFunction(dependency, prisma, redis)),
        };

        resilienceService.registerDependency(enhancedDependency);
        logger.debug(`Registered service dependency: ${dependency.name}`);
      } catch (error: any) {
        logger.error(`Failed to register service dependency: ${dependency.name}`, {
          error: (error as Error).message,
        });
      }
    }

    logger.info(`Registered ${serviceDependencies.length} service dependencies`);
  }

  private async createHealthCheckFunction(
    dependency: any,
    prisma?: PrismaClient,
    redis?: IORedis,
  ): Promise<() => Promise<any>> {
    switch (dependency.name) {
      case 'database':
        return async () => {
          if (!prisma) {
            throw new Error('Prisma client not available');
          }

          const startTime = Date.now();
          await prisma.$queryRaw`SELECT 1`;
          const responseTime = Date.now() - startTime;

          return {
            service: 'database',
            healthy: true,
            responseTime,
            timestamp: new Date(),
            metadata: {
              connectionState: 'connected',
              responseTime,
            },
          };
        };

      case 'redis-cache':
        return async () => {
          if (!redis) {
            throw new Error('Redis client not available');
          }

          const startTime = Date.now();
          const testKey = `health_check_${Date.now()}`;
          await redis.set(testKey, 'test', 'EX', 5);
          const result = await redis.get(testKey);
          await redis.del(testKey);
          const responseTime = Date.now() - startTime;

          return {
            service: 'redis-cache',
            healthy: result === 'test',
            responseTime,
            timestamp: new Date(),
            metadata: {
              connectionState: redis.status,
              responseTime,
            },
          };
        };

      default:
        // For external APIs with URLs
        return async () => {
          if (!dependency.healthCheckUrl) {
            throw new Error(`No health check configured for ${dependency.name}`);
          }

          const startTime = Date.now();
          const response = await fetch(dependency.healthCheckUrl, {
            method: 'GET',
            timeout: 5000,
          });
          const responseTime = Date.now() - startTime;

          return {
            service: dependency.name,
            healthy: response.ok,
            responseTime,
            timestamp: new Date(),
            metadata: {
              status: response.status,
              statusText: response.statusText,
            },
          };
        };
    }
  }

  private async setupErrorRecovery(redis?: IORedis): Promise<void> {
    logger.info('Setting up error recovery strategies...');

    // Database connection recovery with circuit breaker integration
    errorRecoveryManager.registerRecoveryAction({
      name: 'database-circuit-breaker-recovery',
      priority: 11,
      maxAttempts: 3,
      shouldExecute: (error, context) =>
        context.service === 'database' &&
        ((error.message as any)?.includes('circuit breaker') ||
          error.name === 'CircuitBreakerError'),
      execute: async (error, context) => {
        logger.info('Attempting database circuit breaker recovery');

        // Reset database circuit breaker
        const dbCircuitBreaker = CircuitBreakerFactory.get('database-primary');
        if (dbCircuitBreaker?.isOpen) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
          dbCircuitBreaker.reset();
          logger.info('Database circuit breaker reset for recovery');
        }

        return { recovered: true, method: 'circuit-breaker-reset' };
      },
    });

    // Enhanced cache fallback with Redis integration
    if (redis) {
      errorRecoveryManager.registerRecoveryAction({
        name: 'enhanced-cache-fallback',
        priority: 9,
        shouldExecute: (error, context) =>
          context.metadata?.fallbackToCache === true && context.metadata?.cacheKey,
        execute: async (error, context) => {
          const cacheKey = context.metadata?.cacheKey;

          try {
            // Try primary cache key
            let cached = await redis.get(cacheKey);

            // Try backup cache key if primary fails
            if (!cached && context.metadata?.backupCacheKey) {
              cached = await redis.get(context.metadata.backupCacheKey);
            }

            // Try wildcard cache lookup
            if (!cached) {
              const pattern = `${cacheKey.split(':').slice(0, -1).join(':')}:*`;
              const keys = await redis.keys(pattern);

              if (keys.length > 0) {
                // Get the most recent cache entry
                cached = await redis.get(keys[0]);
              }
            }

            if (cached) {
              logger.info('Enhanced cache fallback successful', {
                cacheKey,
                operation: context.operation,
              });

              return JSON.parse(cached);
            }

            throw new Error('No cached data available');
          } catch (cacheError) {
            logger.warn('Enhanced cache fallback failed', {
              error: (cacheError as Error).message,
              cacheKey,
            });
            throw cacheError;
          }
        },
      });
    }

    // Queue-based recovery with priority handling
    errorRecoveryManager.registerRecoveryAction({
      name: 'priority-queue-recovery',
      priority: 6,
      shouldExecute: (error, context) => context.metadata?.queueable === true,
      execute: async (error, context) => {
        if (!redis) {
          throw new Error('Redis not available for queue recovery');
        }

        const priority = context.metadata?.priority || 'normal';
        const queueKey = `recovery:queue:${priority}:${context.service || 'default'}`;

        const queueData = {
          operation: context.operation,
          context,
          error: error.message as any,
          queuedAt: new Date(),
          priority,
          retryAfter: Date.now() + (context.metadata?.retryDelay || 30000),
          attempts: (context.metadata?.attempts || 0) + 1,
          maxAttempts: context.metadata?.maxRetryAttempts || 3,
        };

        // Add to priority queue
        await redis.zadd(queueKey, queueData.retryAfter, JSON.stringify(queueData));

        logger.info('Operation queued with priority for recovery', {
          operation: context.operation,
          priority,
          queueKey,
          attempts: queueData.attempts,
        });

        return {
          queued: true,
          priority,
          message: `Operation queued for ${priority} priority processing`,
          estimatedRetryTime: new Date(queueData.retryAfter),
          attempts: queueData.attempts,
        };
      },
    });

    logger.info('Error recovery strategies setup completed');
  }

  private async configureHealthMonitoring(prisma?: PrismaClient, redis?: IORedis): Promise<void> {
    logger.info('Configuring health monitoring...');

    // Setup alert rules based on thresholds
    healthMonitor.addAlertRule({
      name: 'high-error-rate',
      condition: (health) => {
        const errorRate = health.metadata?.errorRate || 0;
        return errorRate > alertThresholds.errorRate.warning;
      },
      severity: 'medium',
      cooldownMs: 300000, // 5 minutes
    });

    healthMonitor.addAlertRule({
      name: 'critical-error-rate',
      condition: (health) => {
        const errorRate = health.metadata?.errorRate || 0;
        return errorRate > alertThresholds.errorRate.critical;
      },
      severity: 'critical',
      cooldownMs: 180000, // 3 minutes
    });

    healthMonitor.addAlertRule({
      name: 'high-response-time',
      condition: (health) => health.responseTime > alertThresholds.responseTime.warning,
      severity: 'medium',
      cooldownMs: 600000, // 10 minutes
    });

    healthMonitor.addAlertRule({
      name: 'critical-response-time',
      condition: (health) => health.responseTime > alertThresholds.responseTime.critical,
      severity: 'critical',
      cooldownMs: 300000, // 5 minutes
    });

    // Setup event listeners for cross-system coordination
    healthMonitor.on('criticalAlert', async (alert) => {
      logger.error('Critical health alert triggered', alert);

      // Trigger emergency procedures if needed
      await this.handleCriticalAlert(alert);
    });

    healthMonitor.on('alertTriggered', (alert) => {
      logger.warn('Health alert triggered', {
        rule: alert.rule,
        severity: alert.severity,
        component: alert.component,
      });
    });

    logger.info('Health monitoring configuration completed');
  }

  private async setupAlertSystem(): Promise<void> {
    logger.info('Setting up alert system...');

    // Listen to circuit breaker events
    const circuitBreakers = CircuitBreakerFactory.getAll();
    circuitBreakers.forEach((breaker, name) => {
      breaker.on('stateChange', (state, stats) => {
        if (state === 'OPEN') {
          logger.warn(`Alert: Circuit breaker ${name} opened`, {
            stats,
            timestamp: new Date(),
          });
        }
      });
    });

    // Setup resilience service event listeners
    resilienceService.on('criticalServiceUnhealthy', (dependency, healthResult) => {
      logger.error('Alert: Critical service unhealthy', {
        service: dependency.name,
        healthResult,
        criticalityLevel: dependency.criticalityLevel,
      });
    });

    logger.info('Alert system setup completed');
  }

  private async initializeBulkheadCompartments(): Promise<void> {
    logger.info('Initializing bulkhead compartments...');

    for (const [compartment, config] of Object.entries(bulkheadCompartments)) {
      logger.debug(`Registered bulkhead compartment: ${compartment}`, config);
    }

    logger.info(`Initialized ${Object.keys(bulkheadCompartments).length} bulkhead compartments`);
  }

  private async startMonitoring(): Promise<void> {
    logger.info('Starting resilience monitoring...');

    // Start periodic health checks
    await healthMonitor.performSystemHealthCheck();

    logger.info('Resilience monitoring started');
  }

  private async handleCriticalAlert(alert: any): Promise<void> {
    // Implement critical alert handling
    logger.error('Handling critical alert', alert);

    // Could trigger:
    // - Automatic service restarts
    // - Notification to operations team
    // - Circuit breaker resets
    // - Emergency fallback modes
  }

  private async logSystemStatus(): Promise<void> {
    try {
      const healthStatus = await healthMonitor.performSystemHealthCheck();
      const resilienceStatus = await resilienceService.getOverallHealthStatus();
      const circuitBreakerStats = CircuitBreakerFactory.getAllStats();

      logger.info('Resilience system status', {
        systemHealth: healthStatus.overall,
        servicesHealthy: resilienceStatus.healthy,
        totalCircuitBreakers: Object.keys(circuitBreakerStats).length,
        openCircuitBreakers: Object.values(circuitBreakerStats).filter((s) => s.state === 'OPEN')
          .length,
        components: healthStatus.components.map((c) => ({
          name: c.name,
          status: c.status,
          responseTime: c.responseTime,
        })),
      });
    } catch (error: any) {
      logger.error('Failed to log system status', {
        error: (error as Error).message,
      });
    }
  }

  async getInitializationStatus(): Promise<{
    initialized: boolean;
    components: {
      circuitBreakers: number;
      serviceDependencies: number;
      errorRecoveryStrategies: number;
      healthMonitorRules: number;
    };
    timestamp: Date;
  }> {
    const circuitBreakers = CircuitBreakerFactory.getAll();
    const errorStats = errorRecoveryManager.getStats();

    return {
      initialized: this.initialized,
      components: {
        circuitBreakers: circuitBreakers.size,
        serviceDependencies: serviceDependencies.length,
        errorRecoveryStrategies: errorStats.registeredActions,
        healthMonitorRules: 4, // Based on configured rules
      },
      timestamp: new Date(),
    };
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    logger.info('Shutting down resilience system...');

    try {
      // Stop health monitoring
      healthMonitor.stopHealthMonitoring();

      // Destroy circuit breakers
      CircuitBreakerFactory.destroyAll();

      // Clear error recovery history
      errorRecoveryManager.clearHistory();

      this.initialized = false;

      logger.info('Resilience system shutdown completed');
    } catch (error: any) {
      logger.error('Error during resilience system shutdown', {
        error: (error as Error).message,
      });
    }
  }
}

// Singleton instance
export const resilienceInitialization = new ResilienceInitializationService();
