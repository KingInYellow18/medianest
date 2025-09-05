import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { metrics } from '@/utils/monitoring';

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}));

describe('SimpleMetrics', () => {
  beforeEach(() => {
    metrics.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    metrics.reset();
  });

  describe('Error tracking', () => {
    it('should increment error counts', () => {
      metrics.incrementError('VALIDATION_ERROR');
      metrics.incrementError('AUTH_ERROR');
      metrics.incrementError('VALIDATION_ERROR');

      const metricsData = metrics.getMetrics();

      expect(metricsData.errors).toEqual({
        VALIDATION_ERROR: 2,
        AUTH_ERROR: 1
      });
    });

    it('should handle multiple different error codes', () => {
      const errorCodes = ['ERROR_A', 'ERROR_B', 'ERROR_C', 'ERROR_A', 'ERROR_B', 'ERROR_A'];
      
      errorCodes.forEach(code => metrics.incrementError(code));

      const metricsData = metrics.getMetrics();

      expect(metricsData.errors).toEqual({
        ERROR_A: 3,
        ERROR_B: 2,
        ERROR_C: 1
      });
    });

    it('should start error counts at zero for new codes', () => {
      metrics.incrementError('NEW_ERROR');

      const metricsData = metrics.getMetrics();

      expect(metricsData.errors.NEW_ERROR).toBe(1);
    });

    it('should handle empty error codes', () => {
      metrics.incrementError('');

      const metricsData = metrics.getMetrics();

      expect(metricsData.errors['']).toBe(1);
    });

    it('should handle special characters in error codes', () => {
      const specialCode = 'ERROR-123_ABC.XYZ';
      metrics.incrementError(specialCode);

      const metricsData = metrics.getMetrics();

      expect(metricsData.errors[specialCode]).toBe(1);
    });
  });

  describe('Request tracking', () => {
    it('should increment request counts', () => {
      metrics.incrementRequest('/api/users');
      metrics.incrementRequest('/api/auth');
      metrics.incrementRequest('/api/users');

      const metricsData = metrics.getMetrics();

      expect(metricsData.requests).toEqual({
        '/api/users': 2,
        '/api/auth': 1
      });
      expect(metricsData.totalRequests).toBe(3);
    });

    it('should handle multiple endpoints', () => {
      const endpoints = ['/api/users', '/api/media', '/api/auth', '/api/users', '/api/health'];
      
      endpoints.forEach(endpoint => metrics.incrementRequest(endpoint));

      const metricsData = metrics.getMetrics();

      expect(metricsData.requests).toEqual({
        '/api/users': 2,
        '/api/media': 1,
        '/api/auth': 1,
        '/api/health': 1
      });
      expect(metricsData.totalRequests).toBe(5);
    });

    it('should handle empty endpoint names', () => {
      metrics.incrementRequest('');

      const metricsData = metrics.getMetrics();

      expect(metricsData.requests['']).toBe(1);
      expect(metricsData.totalRequests).toBe(1);
    });

    it('should calculate total requests correctly', () => {
      metrics.incrementRequest('/endpoint1');
      metrics.incrementRequest('/endpoint2');
      metrics.incrementRequest('/endpoint1');

      const metricsData = metrics.getMetrics();

      expect(metricsData.totalRequests).toBe(3);
    });
  });

  describe('Duration tracking', () => {
    it('should record and calculate average duration', () => {
      metrics.recordDuration(100);
      metrics.recordDuration(200);
      metrics.recordDuration(300);

      const metricsData = metrics.getMetrics();

      expect(metricsData.avgResponseTime).toBe(200); // (100+200+300)/3 = 200
    });

    it('should handle zero duration', () => {
      metrics.recordDuration(0);
      metrics.recordDuration(100);

      const metricsData = metrics.getMetrics();

      expect(metricsData.avgResponseTime).toBe(50); // (0+100)/2 = 50
    });

    it('should handle negative durations', () => {
      metrics.recordDuration(-50);
      metrics.recordDuration(150);

      const metricsData = metrics.getMetrics();

      expect(metricsData.avgResponseTime).toBe(50); // (-50+150)/2 = 50
    });

    it('should round average duration', () => {
      metrics.recordDuration(100);
      metrics.recordDuration(200);
      metrics.recordDuration(201);

      const metricsData = metrics.getMetrics();

      // (100+200+201)/3 = 167.0 rounds to 167
      expect(metricsData.avgResponseTime).toBe(167);
    });

    it('should limit duration array size to 1000', () => {
      // Add more than 1000 durations
      for (let i = 0; i < 1200; i++) {
        metrics.recordDuration(i);
      }

      const metricsData = metrics.getMetrics();

      // Should average the last 1000 durations (200-1199)
      // Sum = (200+201+...+1199) = 1000*699.5 = 699500
      // Average = 699500/1000 = 699.5, rounded to 700
      expect(metricsData.avgResponseTime).toBe(700);
    });

    it('should handle very large durations', () => {
      metrics.recordDuration(1000000);
      metrics.recordDuration(2000000);

      const metricsData = metrics.getMetrics();

      expect(metricsData.avgResponseTime).toBe(1500000);
    });

    it('should return zero average when no durations recorded', () => {
      const metricsData = metrics.getMetrics();

      expect(metricsData.avgResponseTime).toBe(0);
    });
  });

  describe('Comprehensive metrics', () => {
    it('should return complete metrics object', () => {
      metrics.incrementError('ERROR_A');
      metrics.incrementRequest('/api/test');
      metrics.recordDuration(150);

      const metricsData = metrics.getMetrics();

      expect(metricsData).toEqual({
        errors: { ERROR_A: 1 },
        requests: { '/api/test': 1 },
        avgResponseTime: 150,
        totalRequests: 1
      });
    });

    it('should return empty metrics when nothing recorded', () => {
      const metricsData = metrics.getMetrics();

      expect(metricsData).toEqual({
        errors: {},
        requests: {},
        avgResponseTime: 0,
        totalRequests: 0
      });
    });

    it('should handle mixed metric types', () => {
      // Record various metrics
      metrics.incrementError('AUTH_ERROR');
      metrics.incrementError('VALIDATION_ERROR');
      metrics.incrementRequest('/api/users');
      metrics.incrementRequest('/api/auth');
      metrics.incrementRequest('/api/users');
      metrics.recordDuration(100);
      metrics.recordDuration(300);

      const metricsData = metrics.getMetrics();

      expect(metricsData).toEqual({
        errors: {
          AUTH_ERROR: 1,
          VALIDATION_ERROR: 1
        },
        requests: {
          '/api/users': 2,
          '/api/auth': 1
        },
        avgResponseTime: 200,
        totalRequests: 3
      });
    });
  });

  describe('Reset functionality', () => {
    it('should reset all metrics', () => {
      // Add some metrics
      metrics.incrementError('ERROR');
      metrics.incrementRequest('/api/test');
      metrics.recordDuration(150);

      // Verify metrics exist
      let metricsData = metrics.getMetrics();
      expect(metricsData.totalRequests).toBe(1);

      // Reset and verify cleared
      metrics.reset();
      metricsData = metrics.getMetrics();

      expect(metricsData).toEqual({
        errors: {},
        requests: {},
        avgResponseTime: 0,
        totalRequests: 0
      });
    });

    it('should handle multiple resets', () => {
      metrics.incrementError('ERROR');
      metrics.reset();
      metrics.reset(); // Second reset should not cause issues

      const metricsData = metrics.getMetrics();

      expect(metricsData.totalRequests).toBe(0);
    });

    it('should allow new metrics after reset', () => {
      // Add initial metrics
      metrics.incrementRequest('/api/old');
      
      // Reset
      metrics.reset();
      
      // Add new metrics
      metrics.incrementRequest('/api/new');
      metrics.recordDuration(250);

      const metricsData = metrics.getMetrics();

      expect(metricsData).toEqual({
        errors: {},
        requests: { '/api/new': 1 },
        avgResponseTime: 250,
        totalRequests: 1
      });
    });
  });

  describe('Edge cases and performance', () => {
    it('should handle rapid metric updates', () => {
      const startTime = Date.now();
      
      // Rapid updates
      for (let i = 0; i < 1000; i++) {
        metrics.incrementError('RAPID_ERROR');
        metrics.incrementRequest('/api/rapid');
        metrics.recordDuration(i);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);

      const metricsData = metrics.getMetrics();
      expect(metricsData.errors.RAPID_ERROR).toBe(1000);
      expect(metricsData.requests['/api/rapid']).toBe(1000);
      expect(metricsData.totalRequests).toBe(1000);
    });

    it('should handle concurrent metric updates', async () => {
      const promises = [];
      
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            metrics.incrementError(`ERROR_${i % 10}`);
            metrics.incrementRequest(`/api/endpoint_${i % 5}`);
            metrics.recordDuration(i);
          })
        );
      }

      await Promise.all(promises);

      const metricsData = metrics.getMetrics();
      expect(metricsData.totalRequests).toBe(100);
    });
  });
});