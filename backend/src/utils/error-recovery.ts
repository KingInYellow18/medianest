import { logger } from './logger';
import { CircuitBreakerFactory } from './circuit-breaker';
import IORedis from 'ioredis';

export interface ErrorContext {
  operation: string;
  service?: string;
  correlationId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  attempt?: number;
}

export interface RecoveryAction {
  name: string;
  execute: (error: Error, context: ErrorContext) => Promise<any>;
  shouldExecute: (error: Error, context: ErrorContext) => boolean;
  priority: number;
  maxAttempts?: number;
}

export class ErrorRecoveryManager {
  private recoveryActions = new Map<string, RecoveryAction>();
  private errorHistory = new Map<
    string,
    Array<{ error: Error; context: ErrorContext; timestamp: Date }>
  >();
  private redis?: IORedis;

  constructor(redis?: IORedis) {
    this.redis = redis;
    this.registerDefaultRecoveryActions();
  }

  private registerDefaultRecoveryActions(): void {
    // Database connection recovery
    this.registerRecoveryAction({
      name: 'database-reconnect',
      priority: 10,
      maxAttempts: 3,
      shouldExecute: (error, context) =>
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('database') ||
        context.service === 'database',
      execute: async (_error, context) => {
        logger.info('Attempting database recovery', {
          operation: context.operation,
          attempt: context.attempt,
        });

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Reset circuit breaker if it exists
        const circuitBreaker = CircuitBreakerFactory.get(`${context.service}-db`);
        if (circuitBreaker && circuitBreaker.isOpen) {
          circuitBreaker.reset();
          logger.info('Database circuit breaker reset');
        }

        return { recovered: true, method: 'database-reconnect' };
      },
    });

    // Cache fallback recovery
    this.registerRecoveryAction({
      name: 'cache-fallback',
      priority: 8,
      shouldExecute: (error, context) => context.metadata?.fallbackToCache === true,
      execute: async (_error, context) => {
        if (!this.redis || !context.metadata?.cacheKey) {
          throw new Error('Cache not available for fallback');
        }

        try {
          const cached = await this.redis.get(context.metadata.cacheKey);
          if (cached) {
            logger.info('Successfully recovered using cache fallback', {
              cacheKey: context.metadata.cacheKey,
              operation: context.operation,
            });
            return JSON.parse(cached);
          }
        } catch (cacheError) {
          logger.warn('Cache fallback failed', {
            error: cacheError instanceof Error ? cacheError.message : String(cacheError),
            cacheKey: context.metadata.cacheKey,
          });
        }

        throw new Error('No cached data available for fallback');
      },
    });

    // Default response recovery
    this.registerRecoveryAction({
      name: 'default-response',
      priority: 6,
      shouldExecute: (error, context) => context.metadata?.defaultResponse !== undefined,
      execute: async (_error, context) => {
        logger.info('Using default response for recovery', {
          operation: context.operation,
        });
        return context.metadata?.defaultResponse;
      },
    });

    // Graceful degradation
    this.registerRecoveryAction({
      name: 'graceful-degradation',
      priority: 5,
      shouldExecute: (error, context) => context.metadata?.enableGracefulDegradation === true,
      execute: async (_error, context) => {
        logger.info('Applying graceful degradation', {
          operation: context.operation,
          service: context.service,
        });

        return {
          degraded: true,
          message: 'Service operating in degraded mode',
          availableFeatures: context.metadata?.degradedFeatures || [],
          timestamp: new Date(),
        };
      },
    });

    // Queue for later processing
    this.registerRecoveryAction({
      name: 'queue-for-retry',
      priority: 4,
      shouldExecute: (error, context) =>
        error.name === 'NetworkError' ||
        error.name === 'TimeoutError' ||
        context.metadata?.queueable === true,
      execute: async (error, context) => {
        if (!this.redis) {
          throw new Error('Redis not available for queuing');
        }

        const queueKey = `recovery:queue:${context.service || 'default'}`;
        const queueData = {
          operation: context.operation,
          context,
          error: error.message,
          queuedAt: new Date(),
          retryAfter: Date.now() + (context.metadata?.retryDelay || 30000),
        };

        await this.redis.lpush(queueKey, JSON.stringify(queueData));

        logger.info('Operation queued for later retry', {
          operation: context.operation,
          queueKey,
          retryAfter: queueData.retryAfter,
        });

        return {
          queued: true,
          message: 'Operation queued for later processing',
          estimatedRetryTime: new Date(queueData.retryAfter),
        };
      },
    });

    // Circuit breaker reset recovery
    this.registerRecoveryAction({
      name: 'circuit-breaker-reset',
      priority: 7,
      shouldExecute: (error, context) =>
        error.name === 'CircuitBreakerError' && context.metadata?.allowCircuitBreakerReset === true,
      execute: async (_error, context) => {
        const circuitBreakerName =
          context.metadata?.circuitBreakerName || `${context.service}-circuit-breaker`;

        const circuitBreaker = CircuitBreakerFactory.get(circuitBreakerName);
        if (circuitBreaker) {
          circuitBreaker.reset();
          logger.info('Circuit breaker manually reset for recovery', {
            circuitBreakerName,
            operation: context.operation,
          });

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 1000));

          return {
            circuitBreakerReset: true,
            message: 'Circuit breaker reset, retry available',
          };
        }

        throw new Error('Circuit breaker not found for reset');
      },
    });
  }

  registerRecoveryAction(action: RecoveryAction): void {
    this.recoveryActions.set(action.name, action);
    logger.info(`Registered error recovery action: ${action.name}`, {
      priority: action.priority,
      maxAttempts: action.maxAttempts,
    });
  }

  async executeRecovery(error: Error, context: ErrorContext): Promise<any> {
    // Record error in history
    this.recordError(error, context);

    // Get applicable recovery actions
    const applicableActions = Array.from(this.recoveryActions.values())
      .filter((action) => action.shouldExecute(error, context))
      .sort((a, b) => b.priority - a.priority);

    if (applicableActions.length === 0) {
      logger.warn('No applicable recovery actions found', {
        error: error.message,
        operation: context.operation,
        service: context.service,
      });
      throw error;
    }

    // Try recovery actions in priority order
    for (const action of applicableActions) {
      try {
        // Check attempt limits
        if (action.maxAttempts && context.attempt && context.attempt > action.maxAttempts) {
          logger.warn(`Recovery action ${action.name} exceeded max attempts`, {
            attempts: context.attempt,
            maxAttempts: action.maxAttempts,
          });
          continue;
        }

        logger.info(`Executing recovery action: ${action.name}`, {
          operation: context.operation,
          priority: action.priority,
          attempt: context.attempt || 1,
        });

        const result = await action.execute(error, context);

        logger.info(`Recovery action ${action.name} succeeded`, {
          operation: context.operation,
          result: typeof result,
        });

        // Record successful recovery
        await this.recordSuccessfulRecovery(error, context, action.name, result);

        return result;
      } catch (recoveryError) {
        logger.warn(`Recovery action ${action.name} failed`, {
          originalError: error.message,
          recoveryError:
            recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
          operation: context.operation,
        });

        // Continue to next recovery action
        continue;
      }
    }

    // All recovery actions failed
    logger.error('All recovery actions failed', {
      error: error.message,
      operation: context.operation,
      triedActions: applicableActions.map((a) => a.name),
    });

    throw new Error(
      `Recovery failed after trying ${applicableActions.length} actions: ${error.message}`,
    );
  }

  private recordError(error: Error, context: ErrorContext): void {
    const key = `${context.operation}:${context.service || 'unknown'}`;

    if (!this.errorHistory.has(key)) {
      this.errorHistory.set(key, []);
    }

    const history = this.errorHistory.get(key)!;
    history.push({ error, context, timestamp: new Date() });

    // Keep only last 10 errors per operation/service
    if (history.length > 10) {
      history.shift();
    }
  }

  private async recordSuccessfulRecovery(
    error: Error,
    context: ErrorContext,
    recoveryAction: string,
    result: any,
  ): Promise<void> {
    if (!this.redis) return;

    const recoveryRecord = {
      originalError: error.message,
      context,
      recoveryAction,
      timestamp: new Date(),
      successful: true,
      result: typeof result === 'object' ? 'object' : result,
    };

    const key = `recovery:history:${context.operation}`;
    await this.redis.lpush(key, JSON.stringify(recoveryRecord));
    await this.redis.expire(key, 86400); // Keep for 24 hours
  }

  getErrorHistory(
    operation: string,
    service?: string,
  ): Array<{ error: Error; context: ErrorContext; timestamp: Date }> {
    const key = `${operation}:${service || 'unknown'}`;
    return this.errorHistory.get(key) || [];
  }

  async getRecoveryHistory(operation: string): Promise<any[]> {
    if (!this.redis) return [];

    try {
      const key = `recovery:history:${operation}`;
      const history = await this.redis.lrange(key, 0, -1);
      return history.map((record: string) => JSON.parse(record));
    } catch (error) {
      logger.error('Failed to retrieve recovery history', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // Wrapper for operations with automatic recovery
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    retryOptions?: {
      maxAttempts?: number;
      initialDelay?: number;
      enableRecovery?: boolean;
    },
  ): Promise<T> {
    const options = {
      maxAttempts: 3,
      initialDelay: 1000,
      enableRecovery: true,
      ...retryOptions,
    };

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        // Enhanced context with attempt number
        const _enhancedContext = { ...context, attempt };
        return await operation();
      } catch (error) {
        lastError = error as Error;

        logger.warn(`Operation failed, attempt ${attempt}/${options.maxAttempts}`, {
          operation: context.operation,
          error: lastError.message,
          attempt,
        });

        // Try recovery if enabled and not on last attempt
        if (options.enableRecovery && attempt < options.maxAttempts) {
          try {
            const recoveryResult = await this.executeRecovery(lastError, { ...context, attempt });

            // If recovery returns a result, return it
            if (recoveryResult !== undefined && recoveryResult !== null) {
              return recoveryResult as T;
            }

            // If recovery succeeded but didn't return a result, retry the operation
            logger.info('Recovery succeeded, retrying original operation');
          } catch (recoveryError) {
            logger.warn('Recovery failed, will retry operation', {
              recoveryError:
                recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
            });
          }
        }

        // Wait before retry (except on last attempt)
        if (attempt < options.maxAttempts) {
          const delay = options.initialDelay * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Operation failed after all attempts');
  }

  // Cascade failure prevention
  async checkCascadeRisk(
    operation: string,
    service?: string,
  ): Promise<{
    risk: 'low' | 'medium' | 'high';
    recommendation: string;
    recentErrors: number;
    affectedServices: string[];
  }> {
    const history = this.getErrorHistory(operation, service);
    const recentErrors = history.filter(
      (h) => Date.now() - h.timestamp.getTime() < 300000, // Last 5 minutes
    ).length;

    let risk: 'low' | 'medium' | 'high' = 'low';
    let recommendation = 'Continue normal operations';

    if (recentErrors >= 10) {
      risk = 'high';
      recommendation = 'Consider circuit breaker activation and service isolation';
    } else if (recentErrors >= 5) {
      risk = 'medium';
      recommendation = 'Monitor closely and prepare fallback mechanisms';
    }

    // Check for errors in related services
    const affectedServices = new Set<string>();
    this.errorHistory.forEach((errors, key) => {
      const [_op, svc] = key.split(':');
      if (errors.some((e) => Date.now() - e.timestamp.getTime() < 300000)) {
        if (svc) affectedServices.add(svc);
      }
    });

    return {
      risk,
      recommendation,
      recentErrors,
      affectedServices: Array.from(affectedServices).filter((s) => s !== 'unknown'),
    };
  }

  clearHistory(): void {
    this.errorHistory.clear();
    logger.info('Error recovery history cleared');
  }

  getStats(): {
    totalErrors: number;
    operationsWithErrors: number;
    registeredActions: number;
    recentErrors: number;
  } {
    let totalErrors = 0;
    let recentErrors = 0;
    const fiveMinutesAgo = Date.now() - 300000;

    this.errorHistory.forEach((errors) => {
      totalErrors += errors.length;
      recentErrors += errors.filter((e) => e.timestamp.getTime() > fiveMinutesAgo).length;
    });

    return {
      totalErrors,
      operationsWithErrors: this.errorHistory.size,
      registeredActions: this.recoveryActions.size,
      recentErrors,
    };
  }
}

// Singleton instance
export const errorRecoveryManager = new ErrorRecoveryManager();

// Utility function for wrapping operations with recovery
export async function withRecovery<T>(
  operation: () => Promise<T>,
  context: Omit<ErrorContext, 'timestamp'>,
  options?: {
    maxAttempts?: number;
    initialDelay?: number;
    enableRecovery?: boolean;
  },
): Promise<T> {
  const fullContext: ErrorContext = {
    ...context,
    timestamp: new Date(),
  };

  return errorRecoveryManager.executeWithRecovery(operation, fullContext, options);
}
