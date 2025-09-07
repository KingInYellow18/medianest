import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import {
  CircuitBreaker,
  CircuitBreakerFactory,
  CircuitBreakerStats,
} from '../utils/circuit-breaker';
import { retryWithBackoff, RetryOptions } from '../utils/retry';
import { BullMQAdapter } from 'bull-board/bullMQAdapter';
import { Queue as BullMQQueue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

export interface ResilienceConfig {
  circuitBreaker?: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeout: number;
  };
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    backoffStrategy: 'exponential' | 'linear' | 'constant';
  };
  timeout?: {
    enabled: boolean;
    defaultTimeout: number;
  };
  bulkhead?: {
    enabled: boolean;
    maxConcurrentCalls: number;
  };
  fallback?: {
    enabled: boolean;
    strategy: 'cache' | 'default' | 'queue';
  };
}

export interface HealthCheckResult {
  service: string;
  healthy: boolean;
  responseTime: number;
  timestamp: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ServiceDependency {
  name: string;
  type: 'database' | 'external-api' | 'internal-service' | 'cache' | 'queue';
  healthCheckUrl?: string;
  healthCheckFn?: () => Promise<HealthCheckResult>;
  circuitBreaker?: CircuitBreaker;
  criticalityLevel: 'critical' | 'important' | 'optional';
}

export interface RecoveryStrategy {
  name: string;
  condition: (error: Error, context: any) => boolean;
  action: (error: Error, context: any) => Promise<any>;
  priority: number;
}

export class ResilienceService extends EventEmitter {
  private dependencies = new Map<string, ServiceDependency>();
  private recoveryStrategies: RecoveryStrategy[] = [];
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();
  private deadLetterQueue: BullMQQueue;
  private retryQueue: BullMQQueue;
  private redis: IORedis;
  private isShuttingDown = false;

  constructor(redis?: IORedis) {
    super();
    this.redis = redis || new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

    this.deadLetterQueue = new BullMQQueue('dead-letter', { connection: this.redis });
    this.retryQueue = new BullMQQueue('retry-queue', { connection: this.redis });

    this.setupRetryWorker();
    this.setupGracefulShutdown();
    this.registerDefaultRecoveryStrategies();
  }

  // Service Dependency Management
  registerDependency(dependency: ServiceDependency): void {
    this.dependencies.set(dependency.name, dependency);

    // Create circuit breaker if not provided
    if (!dependency.circuitBreaker) {
      dependency.circuitBreaker = this.createCircuitBreakerForDependency(dependency);
    }

    // Setup health check monitoring
    this.setupHealthCheckMonitoring(dependency);

    logger.info(`Registered service dependency: ${dependency.name}`, {
      type: dependency.type,
      criticalityLevel: dependency.criticalityLevel,
    });

    this.emit('dependencyRegistered', dependency);
  }

  private createCircuitBreakerForDependency(dependency: ServiceDependency): CircuitBreaker {
    switch (dependency.type) {
      case 'database':
        return CircuitBreakerFactory.createDatabase(`${dependency.name}-db`);
      case 'external-api':
        return CircuitBreakerFactory.createExternalAPI(`${dependency.name}-api`);
      default:
        return CircuitBreakerFactory.create(`${dependency.name}-default`);
    }
  }

  private setupHealthCheckMonitoring(dependency: ServiceDependency): void {
    if (!dependency.healthCheckFn && !dependency.healthCheckUrl) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const healthResult = await this.performHealthCheck(dependency);
        this.emit('healthCheckCompleted', healthResult);

        if (!healthResult.healthy && dependency.criticalityLevel === 'critical') {
          this.emit('criticalServiceUnhealthy', dependency, healthResult);
          await this.handleCriticalServiceFailure(dependency, healthResult);
        }
      } catch (error: any) {
        logger.error(`Health check failed for ${dependency.name}`, { error });
      }
    }, 30000); // Every 30 seconds

    this.healthCheckIntervals.set(dependency.name, interval);
  }

  private async performHealthCheck(dependency: ServiceDependency): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      if (dependency.healthCheckFn) {
        return await dependency.healthCheckFn();
      } else if (dependency.healthCheckUrl) {
        const response = await fetch(dependency.healthCheckUrl, {
          method: 'GET',
          timeout: 5000,
        });

        return {
          service: dependency.name,
          healthy: response.ok,
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          metadata: {
            status: response.status,
            statusText: response.statusText,
          },
        };
      }

      throw new Error('No health check method defined');
    } catch (error: any) {
      return {
        service: dependency.name,
        healthy: false,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: (error as Error).message,
      };
    }
  }

  // Circuit Breaker Operations
  async executeWithCircuitBreaker<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallbackFn?: () => Promise<T>,
  ): Promise<T> {
    const dependency = this.dependencies.get(serviceName);
    if (!dependency?.circuitBreaker) {
      logger.warn(`No circuit breaker found for service: ${serviceName}`);
      return operation();
    }

    try {
      return await dependency.circuitBreaker.execute(operation);
    } catch (error: any) {
      this.emit('circuitBreakerTripped', serviceName, error);

      if (fallbackFn) {
        logger.info(`Using fallback for service: ${serviceName}`);
        return fallbackFn();
      }

      throw error;
    }
  }

  // Retry Operations
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    context?: any,
  ): Promise<T> {
    const retryOptions: RetryOptions = {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      factor: 2,
      ...options,
    };

    try {
      return await retryWithBackoff(operation, retryOptions);
    } catch (error: any) {
      await this.handleRetryExhaustion(error as Error, context);
      throw error;
    }
  }

  private async handleRetryExhaustion(error: Error, context?: any): Promise<void> {
    logger.error('Retry attempts exhausted', {
      error: error.message as any,
      context,
    });

    // Add to dead letter queue for manual intervention
    await this.deadLetterQueue.add(
      'retry-exhausted',
      {
        error: error.message as any,
        stack: error.stack as any,
        context,
        timestamp: new Date(),
      },
      {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    this.emit('retryExhausted', error, context);
  }

  // Bulkhead Pattern
  private concurrentCalls = new Map<string, number>();
  private readonly DEFAULT_MAX_CONCURRENT = 10;

  async executeWithBulkhead<T>(
    compartment: string,
    operation: () => Promise<T>,
    maxConcurrent = this.DEFAULT_MAX_CONCURRENT,
  ): Promise<T> {
    const currentCalls = this.concurrentCalls.get(compartment) || 0;

    if (currentCalls >= maxConcurrent) {
      const error = new Error(`Bulkhead limit exceeded for compartment: ${compartment}`);
      error.name = 'BulkheadError';
      throw error;
    }

    this.concurrentCalls.set(compartment, currentCalls + 1);

    try {
      const result = await operation();
      return result;
    } finally {
      const updatedCalls = this.concurrentCalls.get(compartment) || 1;
      this.concurrentCalls.set(compartment, Math.max(0, updatedCalls - 1));
    }
  }

  // Recovery Strategies
  registerRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    this.recoveryStrategies.sort((a, b) => b.priority - a.priority);

    logger.info(`Registered recovery strategy: ${strategy.name}`, {
      priority: strategy.priority,
    });
  }

  private registerDefaultRecoveryStrategies(): void {
    // Database connection recovery
    this.registerRecoveryStrategy({
      name: 'database-reconnect',
      condition: (error) =>
        (error.message as any)?.includes('ECONNREFUSED') ||
        (error.message as any)?.includes('connection'),
      action: async (error, context) => {
        logger.info('Attempting database reconnection...');
        // Implement database reconnection logic
        await this.attemptDatabaseReconnection();
      },
      priority: 10,
    });

    // Cache fallback recovery
    this.registerRecoveryStrategy({
      name: 'cache-fallback',
      condition: (error, context) => context?.fallbackToCache === true,
      action: async (error, context) => {
        logger.info('Falling back to cache...');
        return this.getCachedResponse(context?.cacheKey);
      },
      priority: 8,
    });

    // Queue for later processing
    this.registerRecoveryStrategy({
      name: 'queue-for-retry',
      condition: (error) => error.name === 'NetworkError' || error.name === 'TimeoutError',
      action: async (error, context) => {
        logger.info('Queuing operation for later retry...');
        await this.retryQueue.add('delayed-retry', context, {
          delay: 30000, // 30 seconds
          attempts: 3,
        });
      },
      priority: 5,
    });
  }

  async executeRecoveryStrategies(error: Error, context?: any): Promise<any> {
    for (const strategy of this.recoveryStrategies) {
      if (strategy.condition(error, context)) {
        try {
          logger.info(`Executing recovery strategy: ${strategy.name}`);
          const result = await strategy.action(error, context);
          this.emit('recoveryExecuted', strategy.name, result);
          return result;
        } catch (recoveryError) {
          logger.error(`Recovery strategy ${strategy.name} failed`, {
            originalError: error.message as any,
            recoveryError: (recoveryError as Error).message,
          });
        }
      }
    }

    this.emit('recoveryFailed', error, context);
    throw error;
  }

  // Critical Service Failure Handling
  private async handleCriticalServiceFailure(
    dependency: ServiceDependency,
    healthResult: HealthCheckResult,
  ): Promise<void> {
    logger.error(`Critical service failure detected: ${dependency.name}`, healthResult);

    // Implement escalation procedures
    await this.escalateServiceFailure(dependency, healthResult);

    // Attempt automatic recovery
    await this.attemptServiceRecovery(dependency);

    // Notify operations team
    this.emit('criticalFailure', {
      service: dependency.name,
      healthResult,
      timestamp: new Date(),
      escalated: true,
    });
  }

  private async escalateServiceFailure(
    dependency: ServiceDependency,
    healthResult: HealthCheckResult,
  ): Promise<void> {
    // Add to high-priority queue for immediate attention
    await this.deadLetterQueue.add(
      'critical-failure',
      {
        service: dependency.name,
        healthResult,
        criticalityLevel: dependency.criticalityLevel,
        timestamp: new Date(),
      },
      {
        priority: 1,
        removeOnComplete: 10,
      },
    );
  }

  private async attemptServiceRecovery(dependency: ServiceDependency): Promise<void> {
    // Reset circuit breaker
    dependency.circuitBreaker?.reset();

    // Additional recovery logic based on service type
    switch (dependency.type) {
      case 'database':
        await this.attemptDatabaseReconnection();
        break;
      case 'cache':
        await this.attemptCacheReconnection();
        break;
      default:
        logger.info(`No specific recovery procedure for service type: ${dependency.type}`);
    }
  }

  private async attemptDatabaseReconnection(): Promise<void> {
    // Implement database reconnection logic
    logger.info('Attempting database reconnection...');
    // This would typically involve reinitializing database connections
  }

  private async attemptCacheReconnection(): Promise<void> {
    // Implement cache reconnection logic
    logger.info('Attempting cache reconnection...');
    // This would typically involve reinitializing Redis connections
  }

  private async getCachedResponse(cacheKey?: string): Promise<any> {
    if (!cacheKey) return null;

    try {
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error: any) {
      logger.error('Failed to retrieve cached response', { cacheKey, error });
      return null;
    }
  }

  // Retry Queue Worker
  private setupRetryWorker(): void {
    const worker = new Worker(
      'retry-queue',
      async (job: Job) => {
        logger.info(`Processing retry job: ${job.id}`, job.data);

        try {
          // Execute the retried operation
          await this.executeRetryJob(job.data);
          return { success: true };
        } catch (error: any) {
          logger.error(`Retry job failed: ${job.id}`, { error });
          throw error;
        }
      },
      {
        connection: this.redis,
        concurrency: 5,
      },
    );

    worker.on('failed', (job, err) => {
      logger.error(`Retry worker job failed: ${job?.id}`, { error: err.message });
    });
  }

  private async executeRetryJob(data: any): Promise<void> {
    // Implementation depends on the specific job data structure
    // This is a placeholder for retry job execution
    logger.info('Executing retry job', data);
  }

  // Health Status Aggregation
  async getOverallHealthStatus(): Promise<{
    healthy: boolean;
    services: Record<string, HealthCheckResult>;
    circuitBreakers: Record<string, CircuitBreakerStats>;
    timestamp: Date;
  }> {
    const services: Record<string, HealthCheckResult> = {};
    let overallHealthy = true;

    // Check all registered dependencies
    for (const [name, dependency] of this.dependencies) {
      try {
        const healthResult = await this.performHealthCheck(dependency);
        services[name] = healthResult;

        if (!healthResult.healthy && dependency.criticalityLevel === 'critical') {
          overallHealthy = false;
        }
      } catch (error: any) {
        services[name] = {
          service: name,
          healthy: false,
          responseTime: 0,
          timestamp: new Date(),
          error: (error as Error).message,
        };

        if (dependency.criticalityLevel === 'critical') {
          overallHealthy = false;
        }
      }
    }

    return {
      healthy: overallHealthy,
      services,
      circuitBreakers: CircuitBreakerFactory.getAllStats(),
      timestamp: new Date(),
    };
  }

  // Graceful Shutdown
  private setupGracefulShutdown(): void {
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }

  private async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    logger.info('Graceful shutdown initiated...');

    try {
      // Clear all health check intervals
      this.healthCheckIntervals.forEach((interval) => {
        clearInterval(interval);
      });

      // Close queues
      await this.deadLetterQueue.close();
      await this.retryQueue.close();

      // Destroy all circuit breakers
      CircuitBreakerFactory.destroyAll();

      // Close Redis connection
      this.redis.disconnect();

      logger.info('Graceful shutdown completed');
    } catch (error: any) {
      logger.error('Error during graceful shutdown', { error });
    }

    process.exit(0);
  }
}

// Singleton instance
export const resilienceService = new ResilienceService();
