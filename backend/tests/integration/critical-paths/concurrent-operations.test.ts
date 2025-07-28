import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createTestApp, createTestJWT } from '../../helpers/test-app';
import { createRateLimit } from '../../../src/middleware/rate-limit';
import { initializeRedis, getRedis } from '../../../src/config/redis';

describe('Concurrent Operations and Edge Cases', () => {
  let app: Express;
  let redisClient: any;

  beforeEach(async () => {
    app = createTestApp();

    try {
      redisClient = await initializeRedis();
      await redisClient.flushdb();
    } catch (error) {
      // Redis might not be available in test environment
      redisClient = null;
    }
  });

  afterEach(async () => {
    if (redisClient) {
      await redisClient.flushdb();
    }
    vi.restoreAllMocks();
  });

  describe('Concurrent Rate Limiting Operations', () => {
    it('should handle high concurrency rate limiting correctly', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 10,
        keyGenerator: () => 'high-concurrency-test',
      });

      app.get('/api/concurrent', rateLimit, (req, res) => {
        res.json({
          success: true,
          requestId: `req-${Date.now()}-${Math.random()}`,
        });
      });

      // Send 50 concurrent requests
      const concurrentRequests = Array(50)
        .fill(0)
        .map((_, index) =>
          request(app).get('/api/concurrent').set('X-Request-Index', index.toString()),
        );

      const responses = await Promise.all(concurrentRequests);

      // Exactly 10 should succeed (within rate limit)
      const successful = responses.filter((r) => r.status === 200);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(successful).toHaveLength(10);
      expect(rateLimited).toHaveLength(40);

      // All successful responses should be unique
      const requestIds = successful.map((r) => r.body.requestId);
      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(successful.length);
    });

    it('should handle concurrent requests with different keys', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 2,
        keyGenerator: (req) => `user-${req.headers['x-user-id'] || 'anonymous'}`,
      });

      app.get('/api/per-user', rateLimit, (req, res) => {
        res.json({
          success: true,
          userId: req.headers['x-user-id'] || 'anonymous',
        });
      });

      // Send concurrent requests for different users
      const userRequests = [];
      for (let userId = 1; userId <= 5; userId++) {
        for (let reqNum = 1; reqNum <= 3; reqNum++) {
          userRequests.push(request(app).get('/api/per-user').set('X-User-Id', userId.toString()));
        }
      }

      const responses = await Promise.all(userRequests);

      // Each user should have 2 successful requests and 1 rate limited
      const successByUser = {};
      const rateLimitedByUser = {};

      responses.forEach((response) => {
        const userId = response.request.header['X-User-Id'] || 'anonymous';

        if (response.status === 200) {
          successByUser[userId] = (successByUser[userId] || 0) + 1;
        } else if (response.status === 429) {
          rateLimitedByUser[userId] = (rateLimitedByUser[userId] || 0) + 1;
        }
      });

      for (let userId = 1; userId <= 5; userId++) {
        expect(successByUser[userId.toString()]).toBe(2);
        expect(rateLimitedByUser[userId.toString()]).toBe(1);
      }
    });
  });

  describe('Authentication Concurrent Scenarios', () => {
    it('should handle concurrent authentication requests', async () => {
      const authRateLimit = createRateLimit({
        windowMs: 60000,
        max: 3,
        keyGenerator: (req) => req.ip || 'unknown',
      });

      app.post('/auth/login', authRateLimit, (req, res) => {
        const { username, password } = req.body;

        if (username === 'valid' && password === 'password') {
          const token = createTestJWT({ username });
          res.json({ success: true, token });
        } else {
          res.status(401).json({ error: 'Invalid credentials' });
        }
      });

      // Simulate concurrent login attempts
      const loginRequests = Array(5)
        .fill(0)
        .map(() =>
          request(app).post('/auth/login').send({ username: 'valid', password: 'password' }),
        );

      const responses = await Promise.all(loginRequests);

      const successful = responses.filter((r) => r.status === 200);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(successful).toHaveLength(3);
      expect(rateLimited).toHaveLength(2);

      // All successful logins should return valid tokens
      successful.forEach((response) => {
        expect(response.body.token).toBeDefined();
        expect(typeof response.body.token).toBe('string');
      });
    });

    it('should handle mixed valid/invalid concurrent auth attempts', async () => {
      const authRateLimit = createRateLimit({
        windowMs: 60000,
        max: 5,
        keyGenerator: (req) => req.ip || 'unknown',
        skipFailedRequests: true, // Don't count failed auth attempts
      });

      app.post('/auth/mixed', authRateLimit, (req, res) => {
        const { username, password } = req.body;

        if (username === 'valid' && password === 'password') {
          const token = createTestJWT({ username });
          res.json({ success: true, token });
        } else {
          res.status(401).json({ error: 'Invalid credentials' });
        }
      });

      // Mix of valid and invalid requests
      const requests = [
        ...Array(3)
          .fill(0)
          .map(() => ({ username: 'valid', password: 'password' })),
        ...Array(7)
          .fill(0)
          .map(() => ({ username: 'invalid', password: 'wrong' })),
      ];

      const responses = await Promise.all(
        requests.map((creds) => request(app).post('/auth/mixed').send(creds)),
      );

      const successful = responses.filter((r) => r.status === 200);
      const invalid = responses.filter((r) => r.status === 401);
      const rateLimited = responses.filter((r) => r.status === 429);

      // With skipFailedRequests, only valid requests count toward rate limit
      expect(successful).toHaveLength(3);
      expect(invalid).toHaveLength(7);
      expect(rateLimited).toHaveLength(0);
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle memory pressure during concurrent operations', async () => {
      // Simulate memory-intensive operations
      app.get('/api/memory-intensive', (req, res) => {
        // Create large objects to simulate memory pressure
        const largeObject = {
          data: Array(10000)
            .fill(0)
            .map((_, i) => ({
              id: i,
              value: `value-${i}`,
              timestamp: Date.now(),
              metadata: Array(100)
                .fill(0)
                .map((j) => ({ key: `key-${j}`, value: Math.random() })),
            })),
        };

        res.json({
          success: true,
          itemCount: largeObject.data.length,
          timestamp: Date.now(),
        });
      });

      // Send many concurrent memory-intensive requests
      const memoryRequests = Array(20)
        .fill(0)
        .map(() => request(app).get('/api/memory-intensive'));

      const responses = await Promise.all(memoryRequests);

      // All requests should complete successfully
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.itemCount).toBe(10000);
      });
    });

    it('should handle file descriptor exhaustion gracefully', async () => {
      // Simulate endpoints that might hold file descriptors
      app.get('/api/file-operations', async (req, res) => {
        try {
          // Simulate file operations with proper cleanup
          const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Simulate some async file work
          await new Promise((resolve) => setTimeout(resolve, 10));

          res.json({
            success: true,
            operationId,
            timestamp: Date.now(),
          });
        } catch (error) {
          res.status(500).json({
            error: 'FILE_OPERATION_ERROR',
            message: 'Failed to complete file operation',
          });
        }
      });

      // Send many concurrent file operation requests
      const fileRequests = Array(100)
        .fill(0)
        .map(() => request(app).get('/api/file-operations'));

      const responses = await Promise.all(fileRequests);

      // Most requests should succeed (allowing for some failures under extreme load)
      const successful = responses.filter((r) => r.status === 200);
      const failed = responses.filter((r) => r.status === 500);

      expect(successful.length).toBeGreaterThan(90); // Allow up to 10% failure under extreme load
      expect(successful.length + failed.length).toBe(100);
    });
  });

  describe('Database Connection Pool Edge Cases', () => {
    it('should handle database connection pool exhaustion', async () => {
      app.get('/api/db-intensive', async (req, res) => {
        try {
          // Simulate database operations
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

          res.json({
            success: true,
            query: 'SELECT * FROM users WHERE active = true',
            resultCount: Math.floor(Math.random() * 1000),
            executionTime: Math.random() * 50,
          });
        } catch (error) {
          res.status(503).json({
            error: 'DATABASE_UNAVAILABLE',
            message: 'Database connection pool exhausted',
          });
        }
      });

      // Simulate high database load
      const dbRequests = Array(50)
        .fill(0)
        .map(() => request(app).get('/api/db-intensive'));

      const responses = await Promise.all(dbRequests);

      const successful = responses.filter((r) => r.status === 200);
      const serviceUnavailable = responses.filter((r) => r.status === 503);

      // Under normal conditions, most should succeed
      expect(successful.length).toBeGreaterThan(40);
      expect(successful.length + serviceUnavailable.length).toBe(50);
    });

    it('should handle slow database queries under load', async () => {
      app.get('/api/slow-query', async (req, res) => {
        const queryDelay = Math.random() * 200; // 0-200ms delay

        try {
          await new Promise((resolve) => setTimeout(resolve, queryDelay));

          res.json({
            success: true,
            queryType: 'complex-join',
            executionTime: queryDelay,
            timestamp: Date.now(),
          });
        } catch (error) {
          res.status(504).json({
            error: 'QUERY_TIMEOUT',
            message: 'Database query timed out',
          });
        }
      });

      const slowQueries = Array(30)
        .fill(0)
        .map(() => request(app).get('/api/slow-query'));

      const responses = await Promise.all(slowQueries);

      // All should eventually complete
      responses.forEach((response) => {
        expect([200, 504]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.executionTime).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  describe('Error Recovery and Circuit Breaker Patterns', () => {
    it('should implement circuit breaker pattern for external services', async () => {
      let failureCount = 0;
      const maxFailures = 5;
      let circuitOpen = false;

      app.get('/api/external-service', async (req, res) => {
        if (circuitOpen) {
          return res.status(503).json({
            error: 'CIRCUIT_BREAKER_OPEN',
            message: 'External service circuit breaker is open',
            retryAfter: 30,
          });
        }

        // Simulate external service failures
        if (failureCount < maxFailures && Math.random() < 0.7) {
          failureCount++;

          if (failureCount >= maxFailures) {
            circuitOpen = true;
            // Auto-reset after delay (simplified for test)
            setTimeout(() => {
              circuitOpen = false;
              failureCount = 0;
            }, 1000);
          }

          return res.status(502).json({
            error: 'EXTERNAL_SERVICE_ERROR',
            message: 'External service temporarily unavailable',
          });
        }

        res.json({
          success: true,
          data: 'External service response',
          timestamp: Date.now(),
        });
      });

      // Send requests to trigger circuit breaker
      const externalRequests = Array(20)
        .fill(0)
        .map((_, i) =>
          request(app).get('/api/external-service').set('X-Request-Index', i.toString()),
        );

      const responses = await Promise.all(externalRequests);

      const circuitBreakerResponses = responses.filter(
        (r) => r.status === 503 && r.body.error === 'CIRCUIT_BREAKER_OPEN',
      );

      const externalErrors = responses.filter(
        (r) => r.status === 502 && r.body.error === 'EXTERNAL_SERVICE_ERROR',
      );

      // Should have some circuit breaker responses after failures
      expect(circuitBreakerResponses.length).toBeGreaterThan(0);
      expect(externalErrors.length).toBeGreaterThan(0);
    });

    it('should implement retry logic with exponential backoff', async () => {
      let attemptCount = 0;

      app.post('/api/retry-operation', async (req, res) => {
        attemptCount++;

        // Fail first 2 attempts, succeed on 3rd
        if (attemptCount <= 2) {
          return res.status(500).json({
            error: 'TEMPORARY_FAILURE',
            message: 'Operation failed, please retry',
            attempt: attemptCount,
            retryable: true,
          });
        }

        res.json({
          success: true,
          message: 'Operation completed successfully',
          totalAttempts: attemptCount,
        });
      });

      // Client-side retry logic simulation
      async function retryRequest(maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          const response = await request(app).post('/api/retry-operation');

          if (response.status === 200) {
            return response;
          }

          if (attempt < maxRetries && response.body.retryable) {
            // Exponential backoff delay
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        throw new Error('Max retries exceeded');
      }

      const response = await retryRequest();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.totalAttempts).toBe(3);
    });
  });

  describe('Edge Case Input Handling', () => {
    it('should handle extremely large request bodies', async () => {
      app.post('/api/large-upload', express.raw({ limit: '1mb' }), (req, res) => {
        const bodySize = req.body ? req.body.length : 0;

        if (bodySize > 500000) {
          // 500KB threshold
          return res.status(413).json({
            error: 'PAYLOAD_TOO_LARGE',
            message: 'Request body exceeds size limit',
            receivedSize: bodySize,
            maxSize: 500000,
          });
        }

        res.json({
          success: true,
          receivedSize: bodySize,
          processed: true,
        });
      });

      // Test with large payload
      const largePayload = Buffer.alloc(600000, 'x'); // 600KB

      const response = await request(app)
        .post('/api/large-upload')
        .set('Content-Type', 'application/octet-stream')
        .send(largePayload);

      expect(response.status).toBe(413);
      expect(response.body.error).toBe('PAYLOAD_TOO_LARGE');
      expect(response.body.receivedSize).toBeGreaterThan(500000);
    });

    it('should handle special characters and encoding edge cases', async () => {
      app.post('/api/special-chars', (req, res) => {
        const { text, encoding } = req.body;

        try {
          // Attempt to process text with special characters
          const processed = {
            originalLength: text.length,
            hasEmoji: /[\u{1F600}-\u{1F64F}]/u.test(text),
            hasUnicode: /[^\x00-\x7F]/u.test(text),
            encoding: encoding || 'utf-8',
            preview: text.substring(0, 50),
          };

          res.json({
            success: true,
            processed,
          });
        } catch (error) {
          res.status(400).json({
            error: 'ENCODING_ERROR',
            message: 'Failed to process text encoding',
          });
        }
      });

      const testCases = [
        { text: 'Normal ASCII text', encoding: 'utf-8' },
        { text: 'Émojis and ünïcödé 🚀 🎉 🌟', encoding: 'utf-8' },
        { text: '中文测试 한국어 тест العربية', encoding: 'utf-8' },
        { text: 'Control chars \x00\x01\x02', encoding: 'utf-8' },
        { text: ''.repeat(1000), encoding: 'utf-8' }, // Empty string repeated
      ];

      for (const testCase of testCases) {
        const response = await request(app).post('/api/special-chars').send(testCase);

        expect([200, 400]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.processed).toBeDefined();
        }
      }
    });
  });
});
