import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { CircuitBreaker, CircuitBreakerFactory } from '../../src/utils/circuit-breaker';
import { resilienceService } from '../../src/services/resilience.service';
import { healthMonitor } from '../../src/services/health-monitor.service';
import { errorRecoveryManager } from '../../src/utils/error-recovery';
import { retryWithBackoff } from '../../src/utils/retry';
import IORedis from 'ioredis';

describe('Resilience Integration Tests', () => {
  let mockRedis: IORedis;
  let testApp: any;

  beforeAll(async () => {
    // Setup test Redis instance (mock)
    mockRedis = {
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(1),
      lpush: vi.fn().mockResolvedValue(1),
      lrange: vi.fn().mockResolvedValue([]),
      expire: vi.fn().mockResolvedValue(1),
      info: vi.fn().mockResolvedValue('used_memory_human:10MB'),
      status: 'ready',
      disconnect: vi.fn(),
    } as any;

    // Initialize services with mock Redis
    // Note: In a real test, you'd setup your Express app here
  });

  afterAll(async () => {
    CircuitBreakerFactory.destroyAll();
  });

  describe('Circuit Breaker Integration', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = CircuitBreakerFactory.create('test-service', {
        failureThreshold: 3,
        resetTimeout: 1000,
        monitoringPeriod: 5000,
      });
    });

    afterEach(() => {
      CircuitBreakerFactory.destroy('test-service');
    });

    it('should prevent cascade failures by opening circuit breaker', async () => {
      // Simulate multiple failures
      const failingOperation = vi.fn().mockRejectedValue(new Error('Service unavailable'));

      // First 3 calls should fail and reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          expect((error as Error).message).toBe('Service unavailable');
        }
      }

      // Circuit breaker should be open now
      expect(circuitBreaker.isOpen).toBe(true);

      // Next call should be rejected by circuit breaker
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow(
        'Circuit breaker is OPEN',
      );

      // Original operation shouldn't be called
      expect(failingOperation).toHaveBeenCalledTimes(3);
    });

    it('should transition to half-open and recover after timeout', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Service down'));
      const workingOperation = vi.fn().mockResolvedValue('success');

      // Trigger circuit breaker to open
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.isOpen).toBe(true);

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Next call should transition to half-open
      const result = await circuitBreaker.execute(workingOperation);
      expect(result).toBe('success');
      expect(circuitBreaker.isClosed).toBe(true);
    });

    it('should collect and report circuit breaker metrics', () => {
      const stats = circuitBreaker.getStats();

      expect(stats).toMatchObject({
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        totalRequests: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        nextRetryAt: null,
        errorRate: 0,
      });
    });
  });

  describe('Retry Logic Integration', () => {
    it('should retry operations with exponential backoff', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Still failing'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();

      const result = await retryWithBackoff(operation, {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000,
        factor: 2,
      });

      const endTime = Date.now();

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);

      // Should have taken at least 100ms + 200ms = 300ms due to delays
      expect(endTime - startTime).toBeGreaterThan(250);
    });

    it('should fail after exhausting all retry attempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(
        retryWithBackoff(operation, {
          maxAttempts: 2,
          initialDelay: 50,
          maxDelay: 500,
          factor: 2,
        }),
      ).rejects.toThrow('Persistent failure');

      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Recovery Integration', () => {
    beforeEach(() => {
      errorRecoveryManager.clearHistory();
    });

    it('should execute recovery strategies in priority order', async () => {
      const mockCacheStrategy = vi.fn().mockResolvedValue('cached-data');
      const mockDefaultStrategy = vi.fn().mockResolvedValue('default-data');

      // Register test recovery strategies
      errorRecoveryManager.registerRecoveryAction({
        name: 'test-cache',
        priority: 9,
        shouldExecute: () => true,
        execute: mockCacheStrategy,
      });

      errorRecoveryManager.registerRecoveryAction({
        name: 'test-default',
        priority: 5,
        shouldExecute: () => true,
        execute: mockDefaultStrategy,
      });

      const testError = new Error('Service failure');
      const context = {
        operation: 'test-operation',
        service: 'test-service',
        timestamp: new Date(),
      };

      const result = await errorRecoveryManager.executeRecovery(testError, context);

      expect(result).toBe('cached-data');
      expect(mockCacheStrategy).toHaveBeenCalledWith(testError, context);
      expect(mockDefaultStrategy).not.toHaveBeenCalled();
    });

    it('should track error history and recovery attempts', async () => {
      const testError = new Error('Database connection failed');
      const context = {
        operation: 'user-query',
        service: 'database',
        timestamp: new Date(),
      };

      try {
        await errorRecoveryManager.executeRecovery(testError, context);
      } catch (error) {
        // Expected to fail if no recovery strategies match
      }

      const history = errorRecoveryManager.getErrorHistory('user-query', 'database');
      expect(history).toHaveLength(1);
      expect(history[0].error.message).toBe('Database connection failed');
    });

    it('should detect cascade failure risk', async () => {
      // Simulate multiple errors in short time
      const errors = Array(8)
        .fill(null)
        .map((_, i) => new Error(`Error ${i + 1}`));

      for (const error of errors) {
        try {
          await errorRecoveryManager.executeRecovery(error, {
            operation: 'critical-operation',
            service: 'core-service',
            timestamp: new Date(),
          });
        } catch (e) {
          // Expected failures
        }
      }

      const riskAssessment = await errorRecoveryManager.checkCascadeRisk(
        'critical-operation',
        'core-service',
      );

      expect(riskAssessment.risk).toBe('high');
      expect(riskAssessment.recentErrors).toBe(8);
      expect(riskAssessment.recommendation).toContain('circuit breaker');
    });
  });

  describe('Health Monitoring Integration', () => {
    it('should perform comprehensive system health checks', async () => {
      const healthStatus = await healthMonitor.performSystemHealthCheck();

      expect(healthStatus).toMatchObject({
        overall: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        components: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
            responseTime: expect.any(Number),
            timestamp: expect.any(Date),
          }),
        ]),
        timestamp: expect.any(Date),
        uptime: expect.any(Number),
        version: expect.any(String),
        environment: expect.any(String),
      });
    });

    it('should track performance metrics', () => {
      // Simulate some requests
      healthMonitor.trackRequest(150, false);
      healthMonitor.trackRequest(200, true);
      healthMonitor.trackRequest(100, false);

      const metrics = healthMonitor.getPerformanceMetrics();

      expect(metrics.avgResponseTime).toBeGreaterThan(0);
      expect(metrics.errorRate).toBeGreaterThan(0);
    });
  });

  describe('Service Dependency Integration', () => {
    it('should register and monitor service dependencies', async () => {
      const testDependency = {
        name: 'test-external-api',
        type: 'external-api' as const,
        healthCheckUrl: 'https://api.example.com/health',
        criticalityLevel: 'important' as const,
      };

      resilienceService.registerDependency(testDependency);

      const healthStatus = await resilienceService.getOverallHealthStatus();

      expect(healthStatus.services).toHaveProperty('test-external-api');
    });

    it('should execute operations with circuit breaker protection', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const mockFallback = vi.fn().mockResolvedValue('fallback-result');

      // Register a test service
      resilienceService.registerDependency({
        name: 'protected-service',
        type: 'external-api',
        criticalityLevel: 'critical',
      });

      const result = await resilienceService.executeWithCircuitBreaker(
        'protected-service',
        mockOperation,
        mockFallback,
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalled();
      expect(mockFallback).not.toHaveBeenCalled();
    });
  });

  describe('Graceful Degradation Integration', () => {
    it('should provide fallback responses when services fail', async () => {
      const primaryOperation = vi.fn().mockRejectedValue(new Error('Service down'));
      const fallbackOperation = vi.fn().mockResolvedValue('fallback-data');

      // Simulate graceful degradation
      let result;
      try {
        await primaryOperation();
      } catch (error) {
        result = await fallbackOperation();
      }

      expect(result).toBe('fallback-data');
      expect(fallbackOperation).toHaveBeenCalled();
    });

    it('should queue operations for later processing when appropriate', async () => {
      const testOperation = {
        operation: 'data-sync',
        payload: { userId: 123, data: 'test' },
        timestamp: new Date(),
      };

      // Mock Redis queue operations
      const queueKey = 'recovery:queue:sync-service';

      // Simulate queuing operation
      await mockRedis.lpush(queueKey, JSON.stringify(testOperation));

      expect(mockRedis.lpush).toHaveBeenCalledWith(queueKey, expect.stringContaining('data-sync'));
    });
  });

  describe('End-to-End Resilience Scenarios', () => {
    it('should handle complete service failure with full recovery', async () => {
      // Register a critical service
      resilienceService.registerDependency({
        name: 'critical-db',
        type: 'database',
        criticalityLevel: 'critical',
      });

      const circuitBreaker = CircuitBreakerFactory.get('critical-db-db');
      expect(circuitBreaker).toBeDefined();

      // Simulate service failure
      const failingOperation = vi.fn().mockRejectedValue(new Error('DB connection lost'));

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker!.execute(failingOperation);
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker!.isOpen).toBe(true);

      // Verify health status reflects the failure
      const healthStatus = await healthMonitor.performSystemHealthCheck();
      const circuitBreakerHealth = healthStatus.components.find(
        (c) => c.name === 'circuit-breakers',
      );
      expect(circuitBreakerHealth?.status).not.toBe('healthy');

      // Test recovery
      circuitBreaker!.reset();
      expect(circuitBreaker!.isClosed).toBe(true);
    });

    it('should prevent cascade failures across multiple services', async () => {
      // Register multiple interconnected services
      const services = [
        {
          name: 'user-service',
          type: 'internal-service' as const,
          criticalityLevel: 'critical' as const,
        },
        {
          name: 'auth-service',
          type: 'internal-service' as const,
          criticalityLevel: 'critical' as const,
        },
        {
          name: 'notification-service',
          type: 'external-api' as const,
          criticalityLevel: 'optional' as const,
        },
      ];

      services.forEach((service) => {
        resilienceService.registerDependency(service);
      });

      // Simulate failure in user-service
      const userServiceCB = CircuitBreakerFactory.get('user-service-default');
      const failingOp = vi.fn().mockRejectedValue(new Error('User service down'));

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await userServiceCB!.execute(failingOp);
        } catch (error) {
          // Expected failures
        }
      }

      // Verify cascade risk assessment
      const riskAssessment = await errorRecoveryManager.checkCascadeRisk('user-operation');
      expect(riskAssessment.risk).toBe('medium'); // Should be elevated due to errors
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance under high error rates', async () => {
      const operations = Array(100)
        .fill(null)
        .map((_, i) =>
          i < 80
            ? vi.fn().mockResolvedValue(`success-${i}`)
            : vi.fn().mockRejectedValue(new Error(`error-${i}`)),
        );

      const startTime = Date.now();

      const results = await Promise.allSettled(
        operations.map(async (op, index) => {
          try {
            return await retryWithBackoff(op, {
              maxAttempts: 2,
              initialDelay: 10,
              maxDelay: 100,
              factor: 2,
            });
          } catch (error) {
            return `failed-${index}`;
          }
        }),
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time even with errors
      expect(duration).toBeLessThan(5000); // 5 seconds

      const successCount = results.filter(
        (r) =>
          r.status === 'fulfilled' && typeof r.value === 'string' && r.value.startsWith('success'),
      ).length;

      const errorCount = results.length - successCount;

      expect(successCount).toBe(80);
      expect(errorCount).toBe(20);
    });
  });
});

// Integration test for API endpoints
describe('Resilience API Endpoints', () => {
  // Note: These would need a proper Express app setup in a real test

  it('should return system health status via API', async () => {
    // This would test the actual API endpoint
    // const response = await request(app).get('/api/v1/resilience/health');
    // expect(response.status).toBe(200);
    // expect(response.body.success).toBe(true);
  });

  it('should allow circuit breaker management via API', async () => {
    // This would test circuit breaker control endpoints
    // const response = await request(app)
    //   .post('/api/v1/resilience/circuit-breakers/test/action')
    //   .send({ action: 'reset' });
    // expect(response.status).toBe(200);
  });

  it('should provide comprehensive resilience metrics via API', async () => {
    // This would test the metrics endpoint
    // const response = await request(app).get('/api/v1/resilience/metrics');
    // expect(response.status).toBe(200);
    // expect(response.body.data).toHaveProperty('performance');
    // expect(response.body.data).toHaveProperty('circuitBreakers');
    // expect(response.body.data).toHaveProperty('errorRecovery');
  });
});
