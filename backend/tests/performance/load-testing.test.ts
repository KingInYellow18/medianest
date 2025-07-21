import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { TestServerSetup, TestUtils, TEST_CONFIG } from '../helpers/test-setup';
import { UserFactory, PerformanceDataFactory } from '../factories/test-data.factory';
import { JWTService } from '../../src/services/jwt.service';

describe('Load Testing and Performance Tests', () => {
  let app: Express;
  let baseUrl: string;
  let jwtService: JWTService;
  let authHeaders: any;

  beforeAll(async () => {
    // Setup test server
    app = (await import('../../src/app')).default;
    baseUrl = (await TestServerSetup.startTestServer(app)) as string;

    jwtService = new JWTService();

    // Create authenticated user for tests
    const testUser = UserFactory.create();
    const token = jwtService.generateAccessToken({ userId: testUser.id, email: testUser.email });
    authHeaders = { Authorization: `Bearer ${token}` };
  });

  afterAll(async () => {
    await TestServerSetup.stopTestServer();
  });

  describe('API Endpoint Performance', () => {
    it('should handle basic health check load', async () => {
      const concurrency = 100;
      const iterations = 10;

      const { duration, results } = await performLoadTest('/api/v1/health', {
        method: 'GET',
        concurrency,
        iterations,
        timeout: TEST_CONFIG.timeouts.short,
      });

      // Performance assertions
      expect(results.successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(results.averageResponseTime).toBeLessThan(100); // Under 100ms average
      expect(results.maxResponseTime).toBeLessThan(500); // Under 500ms max
      expect(results.requestsPerSecond).toBeGreaterThan(100); // Over 100 RPS
    });

    it('should handle authentication endpoint under load', async () => {
      const concurrency = 50;
      const iterations = 5;

      const authPayload = {
        email: 'test@example.com',
        password: 'testpassword',
      };

      const { results } = await performLoadTest('/api/v1/auth/login', {
        method: 'POST',
        body: authPayload,
        concurrency,
        iterations,
        timeout: TEST_CONFIG.timeouts.default,
      });

      expect(results.successRate).toBeGreaterThan(0.9); // 90% success rate for auth
      expect(results.averageResponseTime).toBeLessThan(200); // Under 200ms for auth
      expect(results.errorRate).toBeLessThan(0.1); // Less than 10% error rate
    });

    it('should handle media endpoint pagination under load', async () => {
      const concurrency = 30;
      const iterations = 10;

      const { results } = await performLoadTest('/api/v1/media', {
        method: 'GET',
        headers: authHeaders,
        query: { page: 1, limit: 20 },
        concurrency,
        iterations,
        timeout: TEST_CONFIG.timeouts.default,
      });

      expect(results.successRate).toBeGreaterThan(0.95);
      expect(results.averageResponseTime).toBeLessThan(300);
      expect(results.p95ResponseTime).toBeLessThan(800); // 95th percentile under 800ms
    });

    it('should handle YouTube endpoint under sustained load', async () => {
      const concurrency = 20;
      const iterations = 15;

      const youtubePayload = {
        url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        quality: '720p',
        format: 'mp4',
      };

      const { results } = await performLoadTest('/api/v1/youtube/download', {
        method: 'POST',
        headers: authHeaders,
        body: youtubePayload,
        concurrency,
        iterations,
        timeout: TEST_CONFIG.timeouts.long,
      });

      expect(results.successRate).toBeGreaterThan(0.85); // Lower threshold for complex operations
      expect(results.averageResponseTime).toBeLessThan(1000);
      expect(results.timeoutRate).toBeLessThan(0.05); // Less than 5% timeouts
    });
  });

  describe('Database Performance Under Load', () => {
    it('should handle concurrent database reads efficiently', async () => {
      const concurrency = 50;
      const iterations = 20;

      const { results } = await performLoadTest('/api/v1/media/requests', {
        method: 'GET',
        headers: authHeaders,
        query: { limit: 50, sortBy: 'createdAt' },
        concurrency,
        iterations,
        timeout: TEST_CONFIG.timeouts.default,
      });

      expect(results.successRate).toBeGreaterThan(0.98);
      expect(results.averageResponseTime).toBeLessThan(150);
      expect(results.databaseQueryTime).toBeLessThan(50); // Database queries under 50ms
    });

    it('should handle concurrent database writes without deadlocks', async () => {
      const concurrency = 10;
      const iterations = 5;

      const mediaRequestPayload = {
        title: 'Test Movie',
        mediaType: 'movie',
        description: 'Load test request',
      };

      const { results } = await performLoadTest('/api/v1/media/request', {
        method: 'POST',
        headers: authHeaders,
        body: mediaRequestPayload,
        concurrency,
        iterations,
        timeout: TEST_CONFIG.timeouts.default,
      });

      expect(results.successRate).toBeGreaterThan(0.9);
      expect(results.deadlockErrors).toBe(0); // No deadlocks
      expect(results.constraintErrors).toBe(0); // No constraint violations
    });
  });

  describe('Cache Performance Under Load', () => {
    it('should maintain cache hit rates under high load', async () => {
      // Pre-warm the cache
      await request(app).get('/api/v1/media/popular').set(authHeaders).expect(200);

      const concurrency = 100;
      const iterations = 10;

      const { results } = await performLoadTest('/api/v1/media/popular', {
        method: 'GET',
        headers: authHeaders,
        concurrency,
        iterations,
        timeout: TEST_CONFIG.timeouts.short,
      });

      expect(results.successRate).toBeGreaterThan(0.99);
      expect(results.averageResponseTime).toBeLessThan(50); // Fast cache responses
      expect(results.cacheHitRate).toBeGreaterThan(0.9); // High cache hit rate
    });

    it('should handle cache invalidation patterns efficiently', async () => {
      const readConcurrency = 50;
      const writeConcurrency = 5;

      // Concurrent reads and cache-invalidating writes
      const readPromises = Array.from({ length: readConcurrency }, () =>
        request(app).get('/api/v1/media/recent').set(authHeaders),
      );

      const writePromises = Array.from({ length: writeConcurrency }, (_, i) =>
        request(app)
          .post('/api/v1/media/request')
          .set(authHeaders)
          .send({
            title: `Cache Test Movie ${i}`,
            mediaType: 'movie',
          }),
      );

      const { duration } = await TestUtils.measurePerformance(async () => {
        return await Promise.all([...readPromises, ...writePromises]);
      });

      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });
  });

  describe('Rate Limiting Performance', () => {
    it('should enforce rate limits consistently under high load', async () => {
      const concurrency = 200; // Exceed rate limit
      const iterations = 1;

      const { results } = await performLoadTest('/api/v1/auth/login', {
        method: 'POST',
        body: { email: 'test@example.com', password: 'wrong' },
        concurrency,
        iterations,
        timeout: TEST_CONFIG.timeouts.short,
        expectErrors: true,
      });

      expect(results.rateLimitedRequests).toBeGreaterThan(0);
      expect(results.status429Count).toBeGreaterThan(0);
      expect(results.averageResponseTime).toBeLessThan(100); // Rate limiting should be fast
    });

    it('should handle rate limit resets correctly', async () => {
      // Hit rate limit
      await performLoadTest('/api/v1/auth/login', {
        method: 'POST',
        body: { email: 'ratelimit@example.com', password: 'test' },
        concurrency: 100,
        iterations: 1,
        expectErrors: true,
      });

      // Wait for rate limit window to reset
      await new Promise((resolve) => setTimeout(resolve, 61000)); // 61 seconds

      // Should be able to make requests again
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ratelimit@example.com', password: 'test' });

      expect(response.status).not.toBe(429);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain stable memory usage under sustained load', async () => {
      const initialMemory = process.memoryUsage();

      // Run sustained load for 30 seconds
      const loadDuration = 30000;
      const concurrency = 20;

      const startTime = Date.now();
      const requests: Promise<any>[] = [];

      while (Date.now() - startTime < loadDuration) {
        for (let i = 0; i < concurrency; i++) {
          requests.push(
            request(app)
              .get('/api/v1/health')
              .timeout(1000)
              .catch(() => {}), // Ignore individual failures
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await Promise.allSettled(requests);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB

      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
      expect(finalMemory.heapUsed).toBeLessThan(500 * 1024 * 1024); // Under 500MB total
    });

    it('should handle file descriptor limits gracefully', async () => {
      const concurrency = 1000; // High concurrency to test FD limits
      const iterations = 1;

      const { results } = await performLoadTest('/api/v1/health', {
        method: 'GET',
        concurrency,
        iterations,
        timeout: TEST_CONFIG.timeouts.short,
        expectErrors: true,
      });

      // Should not crash the server
      expect(results.connectionErrors).toBeLessThan(concurrency * 0.1); // Less than 10% connection errors
    });
  });

  describe('Error Handling Under Load', () => {
    it('should handle cascading failures gracefully', async () => {
      // Simulate service failures
      const concurrency = 50;
      const iterations = 5;

      const { results } = await performLoadTest('/api/v1/plex/libraries', {
        method: 'GET',
        headers: authHeaders,
        concurrency,
        iterations,
        timeout: TEST_CONFIG.timeouts.default,
        expectErrors: true,
      });

      // Server should remain responsive even if external services fail
      expect(results.serverErrors).toBeLessThan(concurrency * iterations);
      expect(results.averageResponseTime).toBeLessThan(1000);
    });

    it('should implement circuit breaker patterns under load', async () => {
      const concurrency = 30;
      const iterations = 10;

      // First, trigger circuit breaker with failing requests
      await performLoadTest('/api/v1/plex/validate', {
        method: 'GET',
        headers: authHeaders,
        concurrency,
        iterations: 5,
        expectErrors: true,
      });

      // Then test that circuit breaker fails fast
      const { results } = await performLoadTest('/api/v1/plex/validate', {
        method: 'GET',
        headers: authHeaders,
        concurrency: 10,
        iterations: 1,
        expectErrors: true,
      });

      expect(results.averageResponseTime).toBeLessThan(100); // Fast failures when circuit is open
    });
  });

  // Helper function for load testing
  async function performLoadTest(
    endpoint: string,
    options: {
      method: string;
      headers?: any;
      body?: any;
      query?: any;
      concurrency: number;
      iterations: number;
      timeout: number;
      expectErrors?: boolean;
    },
  ) {
    const { method, headers, body, query, concurrency, iterations, timeout, expectErrors } =
      options;

    const results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [] as number[],
      errors: [] as string[],
      successRate: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      timeoutRate: 0,
      rateLimitedRequests: 0,
      status429Count: 0,
      serverErrors: 0,
      connectionErrors: 0,
      deadlockErrors: 0,
      constraintErrors: 0,
      databaseQueryTime: 0,
      cacheHitRate: 0,
    };

    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    for (let i = 0; i < iterations; i++) {
      for (let j = 0; j < concurrency; j++) {
        const requestStartTime = Date.now();

        let req =
          request(app)[method.toLowerCase() as keyof request.SuperTest<request.Test>](endpoint);

        if (headers) req = req.set(headers);
        if (body) req = req.send(body);
        if (query) req = req.query(query);

        const promise = req
          .timeout(timeout)
          .then((response) => {
            const responseTime = Date.now() - requestStartTime;
            results.responseTimes.push(responseTime);
            results.successfulRequests++;

            // Check for rate limiting
            if (response.status === 429) {
              results.status429Count++;
              results.rateLimitedRequests++;
            }

            return response;
          })
          .catch((error) => {
            results.failedRequests++;

            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
              results.connectionErrors++;
            } else if (error.status >= 500) {
              results.serverErrors++;
            } else if (error.code === 'ECONNRESET' || error.timeout) {
              results.timeoutRate++;
            }

            results.errors.push(error.message || error.toString());

            if (!expectErrors) {
              throw error;
            }
          });

        promises.push(promise);
      }
    }

    await Promise.allSettled(promises);

    const totalTime = Date.now() - startTime;
    results.totalRequests = concurrency * iterations;
    results.successRate = results.successfulRequests / results.totalRequests;
    results.errorRate = results.failedRequests / results.totalRequests;
    results.requestsPerSecond = results.totalRequests / (totalTime / 1000);

    if (results.responseTimes.length > 0) {
      results.responseTimes.sort((a, b) => a - b);
      results.averageResponseTime =
        results.responseTimes.reduce((a, b) => a + b) / results.responseTimes.length;
      results.maxResponseTime = Math.max(...results.responseTimes);
      results.minResponseTime = Math.min(...results.responseTimes);

      const p95Index = Math.floor(results.responseTimes.length * 0.95);
      const p99Index = Math.floor(results.responseTimes.length * 0.99);
      results.p95ResponseTime = results.responseTimes[p95Index] || 0;
      results.p99ResponseTime = results.responseTimes[p99Index] || 0;
    }

    return {
      duration: totalTime,
      results,
    };
  }
});
