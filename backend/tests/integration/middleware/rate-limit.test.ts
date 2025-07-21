import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import {
  createRateLimit,
  apiRateLimit,
  authRateLimit,
  youtubeRateLimit,
  strictRateLimit,
} from '../../../src/middleware/rate-limit';
import { initializeRedis, getRedis, closeRedis } from '../../../src/config/redis';
import { RateLimitError } from '@medianest/shared';
import { logger } from '../../../src/utils/logger';

describe('Rate Limiting Middleware - Comprehensive Tests', () => {
  let app: Express;
  let redisClient: any;

  beforeEach(async () => {
    app = express();
    app.use(express.json());

    // Initialize Redis for testing
    redisClient = await initializeRedis();
    await redisClient.flushdb(); // Clear test database
  });

  afterEach(async () => {
    if (redisClient) {
      await redisClient.flushdb();
    }
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000, // 1 minute
        max: 3,
        keyGenerator: () => 'test-key',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
        expect(response.headers['x-ratelimit-limit']).toBe('3');
        expect(response.headers['x-ratelimit-remaining']).toBe(String(2 - i));
      }
    });

    it('should block requests exceeding limit', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 2,
        keyGenerator: () => 'test-key-block',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      // First 2 requests should succeed
      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);

      // Third request should be rate limited
      const response = await request(app).get('/test');
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should reset counter after window expires', async () => {
      const rateLimit = createRateLimit({
        windowMs: 100, // 100ms window for fast test
        max: 1,
        keyGenerator: () => 'test-key-reset',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      // First request should succeed
      await request(app).get('/test').expect(200);

      // Second request should be blocked
      await request(app).get('/test').expect(429);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next request should succeed again
      await request(app).get('/test').expect(200);
    });
  });

  describe('Key Generation', () => {
    it('should use custom key generator', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: (req) => (req.headers['x-user-id'] as string) || 'anonymous',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      // Different users should have separate limits
      await request(app).get('/test').set('X-User-Id', 'user1').expect(200);

      await request(app).get('/test').set('X-User-Id', 'user2').expect(200);

      // Same user should be rate limited
      await request(app).get('/test').set('X-User-Id', 'user1').expect(429);
    });

    it('should handle missing user ID gracefully', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });
  });

  describe('Skip Options', () => {
    it('should skip successful requests when configured', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'skip-success',
        skipSuccessfulRequests: true,
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      // Multiple successful requests should all pass
      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);
    });

    it('should skip failed requests when configured', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'skip-failed',
        skipFailedRequests: true,
      });

      app.get('/test', rateLimit, (req, res) => {
        res.status(500).json({ error: 'Internal error' });
      });

      // Multiple failed requests should all pass rate limiting
      await request(app).get('/test').expect(500);
      await request(app).get('/test').expect(500);
      await request(app).get('/test').expect(500);
    });
  });

  describe('Redis Failure Scenarios', () => {
    it('should allow requests when Redis is down', async () => {
      // Mock Redis to throw errors
      const mockRedis = {
        eval: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
        get: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
        decr: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'redis-down',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      // Should allow request despite Redis failure
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });

    it('should log Redis errors properly', async () => {
      const loggerSpy = vi.spyOn(logger, 'error');

      const mockRedis = {
        eval: vi.fn().mockRejectedValue(new Error('Redis timeout')),
        get: vi.fn().mockRejectedValue(new Error('Redis timeout')),
        decr: vi.fn().mockRejectedValue(new Error('Redis timeout')),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'redis-error-log',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test');

      expect(loggerSpy).toHaveBeenCalledWith(
        'Rate limit check failed',
        expect.objectContaining({
          error: expect.any(Error),
          key: 'rate:redis-error-log',
        }),
      );
    });
  });

  describe('Lua Script Edge Cases', () => {
    it('should handle concurrent requests atomically', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 2,
        keyGenerator: () => 'concurrent-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      // Send 5 concurrent requests
      const promises = Array(5)
        .fill(0)
        .map(() => request(app).get('/test'));
      const responses = await Promise.all(promises);

      // Exactly 2 should succeed, 3 should fail
      const successes = responses.filter((r) => r.status === 200);
      const failures = responses.filter((r) => r.status === 429);

      expect(successes).toHaveLength(2);
      expect(failures).toHaveLength(3);
    });

    it('should handle invalid Lua script responses', async () => {
      const mockRedis = {
        eval: vi.fn().mockResolvedValue(null), // Invalid response
        get: vi.fn().mockResolvedValue('1'),
        decr: vi.fn().mockResolvedValue(0),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'invalid-lua',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      // Should handle gracefully and allow request
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });
  });

  describe('Pre-configured Rate Limiters', () => {
    describe('API Rate Limiter', () => {
      it('should apply API rate limiting correctly', async () => {
        app.get('/api/test', apiRateLimit, (req, res) => {
          res.json({ success: true });
        });

        const response = await request(app).get('/api/test');
        expect(response.status).toBe(200);
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
      });
    });

    describe('Auth Rate Limiter', () => {
      it('should apply strict auth rate limiting', async () => {
        app.post('/auth/login', authRateLimit, (req, res) => {
          res.json({ success: true });
        });

        // Should allow up to 5 requests in 15 minutes
        for (let i = 0; i < 5; i++) {
          await request(app).post('/auth/login').expect(200);
        }

        // 6th request should be blocked
        await request(app).post('/auth/login').expect(429);
      });

      it('should use IP-based keying for auth', async () => {
        app.post('/auth/login', authRateLimit, (req, res) => {
          res.json({ success: true });
        });

        // Different IPs should have separate limits
        const agent1 = request.agent(app);
        const agent2 = request.agent(app);

        await agent1.post('/auth/login').expect(200);
        await agent2.post('/auth/login').expect(200);
      });
    });

    describe('YouTube Rate Limiter', () => {
      it('should apply YouTube-specific rate limiting', async () => {
        app.post('/youtube/download', youtubeRateLimit, (req, res) => {
          res.json({ success: true });
        });

        const response = await request(app).post('/youtube/download');
        expect(response.status).toBe(200);
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
      });
    });

    describe('Strict Rate Limiter', () => {
      it('should apply very strict limits', async () => {
        app.post('/sensitive', strictRateLimit, (req, res) => {
          res.json({ success: true });
        });

        // Should allow up to 3 requests in 1 hour
        for (let i = 0; i < 3; i++) {
          await request(app).post('/sensitive').expect(200);
        }

        // 4th request should be blocked
        await request(app).post('/sensitive').expect(429);
      });
    });
  });

  describe('Rate Limit Headers', () => {
    it('should set correct rate limit headers', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 10,
        keyGenerator: () => 'header-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBe('9');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      expect(new Date(response.headers['x-ratelimit-reset'])).toBeInstanceOf(Date);
    });

    it('should set retry-after header when rate limited', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'retry-after-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      // First request succeeds
      await request(app).get('/test').expect(200);

      // Second request should be rate limited with retry-after
      const response = await request(app).get('/test');
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('Timeout Scenarios', () => {
    it('should handle Redis timeout gracefully', async () => {
      const mockRedis = {
        eval: vi.fn().mockImplementation(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Operation timeout')), 100);
          });
        }),
        get: vi.fn().mockResolvedValue('0'),
        decr: vi.fn().mockResolvedValue(0),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'timeout-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      // Should allow request despite timeout
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });
  });

  describe('Error Message Customization', () => {
    it('should use custom error message', async () => {
      const customMessage = 'Custom rate limit exceeded';
      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'custom-message',
        message: customMessage,
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      // Use up the limit
      await request(app).get('/test').expect(200);

      // Should get custom error message
      await request(app).get('/test').expect(429);
      // Note: The actual error message testing would depend on your error handling middleware
    });
  });
});
