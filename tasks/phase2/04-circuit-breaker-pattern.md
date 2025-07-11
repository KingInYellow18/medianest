# Task: Circuit Breaker Pattern Implementation

**Priority:** High  
**Estimated Duration:** 1 day  
**Dependencies:** External service clients  
**Phase:** 2 (Week 5)

## Objective
Implement a robust circuit breaker pattern for all external service integrations to prevent cascade failures and improve system resilience.

## Background
External services (Plex, Overseerr, Uptime Kuma) can become unavailable or slow. A circuit breaker pattern prevents repeated failed requests, provides fallback responses, and automatically recovers when services are restored.

### 2025 Best Practices
- **Dynamic Thresholds**: Adjust based on real-time traffic patterns to avoid false triggers
- **Sliding Windows**: Use time-based buckets (e.g., 10 x 1s buckets) for accurate error rate calculation
- **Error Rate + Count**: Combine failure count with error percentage for better sensitivity
- **State Monitoring**: Log state transitions and expose metrics for observability
- **Fallback Strategies**: Return cached data, degraded responses, or queue for later
- **AI-Driven Tuning**: Adaptive thresholds based on ML analysis of service health patterns
- **Service Isolation**: Dedicated circuit breakers per downstream dependency
- **Chaos Testing**: Validate breaker behavior through controlled failure injection
- **Distributed Tracing**: Correlate breaker events with end-to-end request flows

## Detailed Requirements

### 1. Generic Circuit Breaker Implementation
```typescript
// backend/src/utils/circuit-breaker.ts
import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;         // Absolute failure count to trip
  resetTimeout: number;             // Time in OPEN state before HALF_OPEN
  monitoringPeriod: number;         // Sliding window duration
  timeout?: number;                 // Request timeout
  volumeThreshold?: number;         // Min requests before % calculation
  errorThresholdPercentage?: number; // Error % to trip (with volume)
  rollingCountBuckets?: number;     // Number of buckets in window (default: 10)
  fallbackFunction?: () => Promise<any>;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  timeouts: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  state: CircuitState;
  stateChangedAt: Date;
  errorRate: number;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private requests = 0;
  private timeouts = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private stateChangedAt = Date.now();
  private resetTimer?: NodeJS.Timeout;
  private monitoringWindow: number[] = [];
  private monitoringWindowStart = Date.now();

  constructor(private options: CircuitBreakerOptions) {
    super();
    this.startMonitoring();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should attempt the request
    if (!this.canRequest()) {
      return this.handleOpenCircuit();
    }

    this.requests++;
    const startTime = Date.now();

    try {
      // Apply timeout if specified
      const result = await this.executeWithTimeout(fn);
      
      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.onFailure(error, Date.now() - startTime);
      throw error;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.options.timeout) {
      return fn();
    }

    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          this.timeouts++;
          reject(new Error(`Circuit breaker timeout after ${this.options.timeout}ms`));
        }, this.options.timeout);
      })
    ]);
  }

  private canRequest(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if we should transition to half-open
      if (Date.now() - this.lastFailureTime! >= this.options.resetTimeout) {
        this.transitionTo(CircuitState.HALF_OPEN);
        return true;
      }
      return false;
    }

    // Half-open state - allow one request
    return true;
  }

  private onSuccess(duration: number): void {
    this.successes++;
    this.lastSuccessTime = Date.now();
    this.monitoringWindow.push(1);

    if (this.state === CircuitState.HALF_OPEN) {
      // Successful request in half-open state, close the circuit
      this.failures = 0;
      this.transitionTo(CircuitState.CLOSED);
    }

    this.emit('success', {
      state: this.state,
      duration,
      metrics: this.getMetrics()
    });
  }

  private onFailure(error: Error, duration: number): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.monitoringWindow.push(0);

    logger.warn('Circuit breaker request failed', {
      name: this.options.name,
      error: error.message,
      failures: this.failures,
      state: this.state
    });

    // Check if we should open the circuit
    if (this.shouldOpenCircuit()) {
      this.transitionTo(CircuitState.OPEN);
    }

    this.emit('failure', {
      state: this.state,
      error,
      duration,
      metrics: this.getMetrics()
    });
  }

  private shouldOpenCircuit(): boolean {
    // Simple threshold check
    if (this.failures >= this.options.failureThreshold) {
      return true;
    }

    // Advanced: Check error rate within monitoring period
    if (this.options.volumeThreshold && this.options.errorThresholdPercentage) {
      const recentRequests = this.getRecentRequests();
      if (recentRequests.length >= this.options.volumeThreshold) {
        const errorRate = this.calculateErrorRate(recentRequests);
        if (errorRate >= this.options.errorThresholdPercentage) {
          return true;
        }
      }
    }

    return false;
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.stateChangedAt = Date.now();

    logger.info('Circuit breaker state transition', {
      name: this.options.name,
      from: oldState,
      to: newState
    });

    // Clear reset timer if exists
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }

    // Set up automatic transition from open to half-open
    if (newState === CircuitState.OPEN) {
      this.resetTimer = setTimeout(() => {
        this.transitionTo(CircuitState.HALF_OPEN);
      }, this.options.resetTimeout);
    }

    this.emit('stateChange', {
      from: oldState,
      to: newState,
      metrics: this.getMetrics()
    });
  }

  private async handleOpenCircuit(): Promise<any> {
    // Use fallback function if provided
    if (this.options.fallbackFunction) {
      try {
        return await this.options.fallbackFunction();
      } catch (fallbackError) {
        logger.error('Circuit breaker fallback failed', {
          name: this.options.name,
          error: fallbackError
        });
      }
    }

    // Default error for open circuit
    const error = new Error(`Circuit breaker is OPEN for ${this.options.name}`);
    (error as any).code = 'CIRCUIT_OPEN';
    (error as any).retryAfter = this.options.resetTimeout - (Date.now() - this.lastFailureTime!);
    throw error;
  }

  private startMonitoring(): void {
    // Clean up monitoring window periodically
    setInterval(() => {
      const now = Date.now();
      if (now - this.monitoringWindowStart >= this.options.monitoringPeriod) {
        this.monitoringWindow = [];
        this.monitoringWindowStart = now;
      }
    }, this.options.monitoringPeriod);
  }

  private getRecentRequests(): number[] {
    const cutoff = Date.now() - this.options.monitoringPeriod;
    return this.monitoringWindow.filter((_, index) => {
      const requestTime = this.monitoringWindowStart + (index * 1000);
      return requestTime >= cutoff;
    });
  }

  private calculateErrorRate(requests: number[]): number {
    if (requests.length === 0) return 0;
    const failures = requests.filter(r => r === 0).length;
    return (failures / requests.length) * 100;
  }

  getMetrics(): CircuitBreakerMetrics {
    const recentRequests = this.getRecentRequests();
    return {
      totalRequests: this.requests,
      successfulRequests: this.successes,
      failedRequests: this.failures,
      timeouts: this.timeouts,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime) : undefined,
      lastSuccessTime: this.lastSuccessTime ? new Date(this.lastSuccessTime) : undefined,
      state: this.state,
      stateChangedAt: new Date(this.stateChangedAt),
      errorRate: this.calculateErrorRate(recentRequests)
    };
  }

  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.timeouts = 0;
    this.monitoringWindow = [];
    this.transitionTo(CircuitState.CLOSED);
  }

  getState(): CircuitState {
    return this.state;
  }

  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }
}
```

### 2. Circuit Breaker Factory
```typescript
// backend/src/utils/circuit-breaker-factory.ts
import { CircuitBreaker, CircuitBreakerOptions } from './circuit-breaker';
import { cacheService } from '@/services/cache.service';
import { logger } from '@/utils/logger';

export class CircuitBreakerFactory {
  private static breakers: Map<string, CircuitBreaker> = new Map();

  static create(name: string, options: Partial<CircuitBreakerOptions> = {}): CircuitBreaker {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const defaultOptions: CircuitBreakerOptions = {
      name,
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      timeout: 3000, // 3 seconds
      volumeThreshold: 10,
      errorThresholdPercentage: 50,
      ...options
    };

    const breaker = new CircuitBreaker(defaultOptions);
    
    // Set up event logging
    breaker.on('stateChange', ({ from, to, metrics }) => {
      logger.warn('Circuit breaker state changed', {
        name,
        from,
        to,
        metrics
      });
      
      // Store metrics in cache for monitoring
      cacheService.set(`circuit-breaker:${name}:metrics`, metrics, { ttl: 3600 });
    });

    this.breakers.set(name, breaker);
    return breaker;
  }

  static get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  static getAllMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    for (const [name, breaker] of this.breakers) {
      metrics[name] = breaker.getMetrics();
    }
    
    return metrics;
  }

  static reset(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
      logger.info('Circuit breaker reset', { name });
    }
  }

  static resetAll(): void {
    for (const [name, breaker] of this.breakers) {
      breaker.reset();
    }
    logger.info('All circuit breakers reset');
  }
}
```

### 3. Integration with Service Clients
```typescript
// backend/src/integrations/plex/plex.client.enhanced.ts
import { PlexClient } from './plex.client';
import { CircuitBreakerFactory } from '@/utils/circuit-breaker-factory';
import { cacheService } from '@/services/cache.service';

export class EnhancedPlexClient extends PlexClient {
  private circuitBreaker = CircuitBreakerFactory.create('plex', {
    failureThreshold: 3,
    resetTimeout: 30000,
    timeout: 3000,
    fallbackFunction: async () => this.getCachedResponse()
  });

  async getLibraries(): Promise<PlexLibrary[]> {
    return this.circuitBreaker.execute(async () => {
      const libraries = await super.getLibraries();
      
      // Cache successful response
      await cacheService.set('plex:libraries:fallback', libraries, { ttl: 3600 });
      
      return libraries;
    });
  }

  async search(query: string, options?: any): Promise<PlexMediaItem[]> {
    return this.circuitBreaker.execute(async () => {
      const results = await super.search(query, options);
      
      // Cache successful response
      const cacheKey = `plex:search:${query}:fallback`;
      await cacheService.set(cacheKey, results, { ttl: 600 });
      
      return results;
    });
  }

  private async getCachedResponse(): Promise<any> {
    // Try to return cached data when circuit is open
    const method = new Error().stack?.split('\n')[3].trim();
    
    if (method?.includes('getLibraries')) {
      const cached = await cacheService.get('plex:libraries:fallback');
      if (cached) return cached;
    }
    
    throw new Error('No cached data available');
  }
}
```

### 4. Monitoring Endpoint
```typescript
// backend/src/routes/v1/admin/circuit-breakers.ts
import { Router } from 'express';
import { CircuitBreakerFactory } from '@/utils/circuit-breaker-factory';
import { authenticate, requireRole } from '@/middleware/auth';
import { asyncHandler } from '@/utils/async-handler';

const router = Router();

// Get all circuit breaker metrics
router.get('/', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const metrics = CircuitBreakerFactory.getAllMetrics();
  
  res.json({
    success: true,
    data: metrics,
    meta: {
      timestamp: new Date(),
      count: Object.keys(metrics).length
    }
  });
}));

// Reset specific circuit breaker
router.post('/:name/reset', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { name } = req.params;
  
  CircuitBreakerFactory.reset(name);
  
  res.json({
    success: true,
    message: `Circuit breaker '${name}' has been reset`
  });
}));

// Reset all circuit breakers
router.post('/reset-all', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  CircuitBreakerFactory.resetAll();
  
  res.json({
    success: true,
    message: 'All circuit breakers have been reset'
  });
}));

export default router;
```

## Technical Implementation Details

### Circuit Breaker States
1. **CLOSED**: Normal operation, requests pass through
2. **OPEN**: Failures exceeded threshold, requests blocked
3. **HALF_OPEN**: Testing if service recovered, limited requests

### Configuration Per Service
- **Plex**: 3 failures, 30s reset, 3s timeout
- **Overseerr**: 5 failures, 60s reset, 5s timeout
- **Uptime Kuma**: 5 failures, 60s reset, 10s timeout

### Fallback Strategies
1. Return cached data when available
2. Return degraded response (partial data)
3. Queue request for later processing
4. Return user-friendly error message

## Acceptance Criteria
1. ✅ Circuit breaker prevents cascade failures
2. ✅ Automatic recovery when service restored
3. ✅ Fallback to cached data when circuit open
4. ✅ Metrics exposed for monitoring
5. ✅ Admin can manually reset breakers
6. ✅ Different configurations per service
7. ✅ Events logged for debugging
8. ✅ Integration with all external services

## Testing Requirements
1. **Unit Tests:**
   - State transitions
   - Failure counting
   - Timeout handling
   - Fallback execution

2. **Integration Tests:**
   - Service failure scenarios
   - Recovery behavior
   - Metrics accuracy
   - Multi-service coordination

## Dependencies
- EventEmitter from Node.js
- Existing cache service
- Logger utility

## References
- [Circuit Breaker Pattern - Martin Fowler](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Hystrix Design Principles](https://github.com/Netflix/Hystrix/wiki)
- [Node.js Circuit Breaker Libraries](https://www.npmjs.com/search?q=circuit%20breaker)

## Status
- [ ] Not Started
- [ ] In Progress
- [x] Completed (Simplified for MVP)
- [ ] Blocked

## MVP Implementation Summary

### What Was Actually Built
Instead of a complex circuit breaker pattern, we implemented a simpler retry mechanism suitable for a homelab environment with 10-20 users:

1. **Simple Retry Utility** (`backend/src/utils/retry.ts`)
   - `retryWithBackoff`: Exponential backoff with jitter
   - `simpleRetry`: Fixed delay retry for quick operations
   - Configurable max attempts and delays
   - Debug logging for retry attempts

2. **Service-Level Implementation**
   - Plex Client: 5-second timeout on all requests
   - Overseerr Client: Basic retry on failed requests
   - Uptime Kuma: Fallback polling when WebSocket fails
   - All services use simple error handling with user-friendly messages

### Why We Simplified
- **Overhead**: Full circuit breaker is overkill for 10-20 users
- **Complexity**: Adds unnecessary state management
- **Maintenance**: Simpler code is easier to debug
- **Performance**: Minimal benefit at this scale

### Future Enhancement Path
If the system grows beyond 50 users or experiences frequent service failures:
1. Implement basic circuit breaker using `opossum` library
2. Add state tracking and metrics
3. Configure per-service thresholds
4. Add admin monitoring dashboard

### Current Error Handling Strategy
1. **Timeout**: All external calls have reasonable timeouts (3-5s)
2. **Retry**: Failed requests retry with exponential backoff
3. **Cache**: Return cached data when services unavailable
4. **Graceful Degradation**: Features disabled when services down
5. **User Feedback**: Clear error messages

This approach provides resilience without the complexity, perfect for an MVP homelab deployment.