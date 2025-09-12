import { EventEmitter } from 'events';

import { logger } from './logger';
import { CatchError } from '../types/common';
import { toError } from '../types/error-types';


export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  expectedErrors?: string[];
  halfOpenMaxCalls?: number;
  enableMetrics?: boolean;
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  requests: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  nextAttempt?: Date;
  errorRate: number;
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private nextRetryAt: Date | null = null;
  private halfOpenCalls = 0;
  private monitoringTimer: NodeJS.Timeout | null = null;

  constructor(
    private name: string,
    private options: CircuitBreakerOptions,
  ) {
    super();
    this.startMonitoring();

    // Emit initial state
    this.emit('stateChange', this.state, this.getStats());
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        const error = new Error(`Circuit breaker ${this.name} is OPEN`);
        error.name = 'CircuitBreakerError';
        this.emit('callRejected', error);
        throw error;
      }
    }

    if (
      this.state === CircuitBreakerState.HALF_OPEN &&
      this.halfOpenCalls >= (this.options.halfOpenMaxCalls || 3)
    ) {
      const error = new Error(
        `Circuit breaker is HALF_OPEN and max calls exceeded for ${this.name}`,
      );
      error.name = 'CircuitBreakerError';
      this.emit('callRejected', error);
      throw error;
    }

    this.totalRequests++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenCalls++;
    }

    const startTime = Date.now();

    try {
      const result = await fn();

      const duration = Date.now() - startTime;
      this.onSuccess(duration);

      return result;
    } catch (error: CatchError) {
      const duration = Date.now() - startTime;
      // Convert non-Error objects to Error using type guard
      const errorObj = this.toError(error);
      this.onFailure(errorObj, duration);
      // Re-throw the original error/value
      throw error;
    }
  }

  private onSuccess(duration: number): void {
    this.successCount++;
    this.lastSuccessTime = new Date();

    this.emit('callSucceeded', { duration, state: this.state });

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionToClosed();
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Reset failure count on successful calls only in closed state
      this.failureCount = 0;
    }
  }

  private onFailure(error: Error, duration: number): void {
    this.lastFailureTime = new Date();

    this.emit('callFailed', { error, duration, state: this.state });

    if (this.isExpectedError(error)) {
      logger.debug(`Expected error in circuit breaker ${this.name}`, {
        error: error instanceof Error ? error.message : ('Unknown error' as any),
        state: this.state,
      });
      return; // Don't count expected errors as failures
    }

    // Only count unexpected errors as failures
    this.failureCount++;

    if (this.state === CircuitBreakerState.HALF_OPEN || this.shouldTransitionToOpen()) {
      this.transitionToOpen();
    }
  }

  private isExpectedError(error: Error): boolean {
    if (!this.options.expectedErrors) return false;

    return this.options.expectedErrors.some(
      (expectedError) =>
        (error.message as any)?.includes(expectedError) || error.name === expectedError,
    );
  }

  private shouldTransitionToOpen(): boolean {
    return this.failureCount >= this.options.failureThreshold;
  }

  private shouldAttemptReset(): boolean {
    if (!this.nextRetryAt) return false;
    return Date.now() >= this.nextRetryAt.getTime();
  }

  private transitionToClosed(): void {
    logger.info(`Circuit breaker ${this.name} transitioning to CLOSED state`);

    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.halfOpenCalls = 0;
    this.nextRetryAt = null;

    this.emit('stateChange', this.state, this.getStats());
  }

  private transitionToOpen(): void {
    logger.warn(`Circuit breaker ${this.name} transitioning to OPEN state`, {
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold,
    });

    this.state = CircuitBreakerState.OPEN;
    this.nextRetryAt = new Date(Date.now() + this.options.resetTimeout);
    this.halfOpenCalls = 0;

    this.emit('stateChange', this.state, this.getStats());
  }

  private transitionToHalfOpen(): void {
    logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN state`);

    this.state = CircuitBreakerState.HALF_OPEN;
    this.halfOpenCalls = 0;

    this.emit('stateChange', this.state, this.getStats());
  }

  private startMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.monitoringTimer = setInterval(() => {
      this.emit('metrics', this.getStats());

      // Reset counters for next monitoring period
      if (this.options.enableMetrics !== false) {
        logger.debug(`Circuit breaker ${this.name} metrics`, this.getStats());
      }
    }, this.options.monitoringPeriod);
  }

  getStats(): CircuitBreakerStats {
    const errorRate = this.totalRequests > 0 ? (this.failureCount / this.totalRequests) * 100 : 0;

    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      requests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      ...(this.nextRetryAt ? { nextAttempt: this.nextRetryAt } : {}),
      errorRate: Math.round(errorRate * 100) / 100,
    };
  }

  reset(): void {
    logger.info(`Circuit breaker ${this.name} manually reset`);

    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.totalRequests = 0;
    this.halfOpenCalls = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextRetryAt = null;

    this.emit('stateChange', this.state, this.getStats());
  }

  destroy(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    this.removeAllListeners();
  }

  // Getters
  get isOpen(): boolean {
    return this.state === CircuitBreakerState.OPEN;
  }

  get isClosed(): boolean {
    return this.state === CircuitBreakerState.CLOSED;
  }

  get isHalfOpen(): boolean {
    return this.state === CircuitBreakerState.HALF_OPEN;
  }

  // Manual state controls for testing
  forceOpen(): void {
    logger.warn(`Circuit breaker ${this.name} manually forced to OPEN state`);

    this.state = CircuitBreakerState.OPEN;
    this.nextRetryAt = new Date(Date.now() + this.options.resetTimeout);
    this.halfOpenCalls = 0;

    this.emit('stateChange', this.state, this.getStats());
  }

  forceClosed(): void {
    logger.info(`Circuit breaker ${this.name} manually forced to CLOSED state`);

    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.halfOpenCalls = 0;
    this.nextRetryAt = null;

    this.emit('stateChange', this.state, this.getStats());
  }

  /**
   * Type guard to convert unknown error types to Error instances
   */
  private toError(error: unknown): Error {
    return toError(error);
  }
}

// Circuit breaker factory with common configurations
export class CircuitBreakerFactory {
  private static breakers = new Map<string, CircuitBreaker>();

  static create(name: string, options: Partial<CircuitBreakerOptions> = {}): CircuitBreaker {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const defaultOptions: CircuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000, // 1 minute
      halfOpenMaxCalls: 3,
      enableMetrics: true,
      expectedErrors: ['ENOTFOUND', 'ECONNREFUSED', 'timeout'],
    };

    const circuitBreaker = new CircuitBreaker(name, { ...defaultOptions, ...options });
    this.breakers.set(name, circuitBreaker);

    return circuitBreaker;
  }

  static get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  static getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  static getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }

  static destroy(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.destroy();
      this.breakers.delete(name);
      return true;
    }
    return false;
  }

  static destroyAll(): void {
    this.breakers.forEach((breaker, name) => {
      breaker.destroy();
    });
    this.breakers.clear();
  }

  // Predefined configurations
  static createFastFailing(name: string): CircuitBreaker {
    return this.create(name, {
      failureThreshold: 3,
      resetTimeout: 15000, // 15 seconds
      halfOpenMaxCalls: 2,
    });
  }

  static createTolerant(name: string): CircuitBreaker {
    return this.create(name, {
      failureThreshold: 10,
      resetTimeout: 60000, // 60 seconds
      halfOpenMaxCalls: 5,
    });
  }

  static createDatabase(name: string): CircuitBreaker {
    return this.create(name, {
      failureThreshold: 5,
      resetTimeout: 45000, // 45 seconds
      halfOpenMaxCalls: 2,
      expectedErrors: ['ECONNREFUSED', 'ENOTFOUND', 'timeout', 'ETIMEDOUT'],
    });
  }

  static createExternalAPI(name: string): CircuitBreaker {
    return this.create(name, {
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      halfOpenMaxCalls: 3,
      expectedErrors: ['ENOTFOUND', 'ECONNREFUSED', 'timeout', '5xx', 'rate_limit'],
    });
  }
}
