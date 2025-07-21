import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createRateLimit } from '../../../src/middleware/rate-limit';
import { getRedis, initializeRedis } from '../../../src/config/redis';
import { logger } from '../../../src/utils/logger';

describe('Redis Timeout and Failure Scenarios', () => {
  let app: Express;
  let originalRedis: any;

  beforeEach(async () => {
    app = express();
    app.use(express.json());

    // Store original Redis client
    try {
      originalRedis = getRedis();
    } catch (error) {
      // Redis might not be initialized yet
      originalRedis = null;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Redis Connection Timeout', () => {
    it('should handle Redis connection timeout gracefully', async () => {
      const mockRedis = {
        eval: vi.fn().mockImplementation(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Connection timeout after 5000ms')), 50);
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
        message: 'Rate limit exceeded',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      // Should allow request despite Redis timeout
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle Redis operation timeout with custom timeout duration', async () => {
      const mockRedis = {
        eval: vi.fn().mockImplementation(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Operation timeout after 10s')), 100);
          });
        }),
        get: vi.fn().mockResolvedValue('0'),
        decr: vi.fn().mockResolvedValue(0),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 5,
        keyGenerator: () => 'custom-timeout-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true, timestamp: Date.now() });
      });

      const start = Date.now();
      const response = await request(app).get('/test');
      const duration = Date.now() - start;

      // Should complete quickly (not wait for full timeout)
      expect(duration).toBeLessThan(1000);
      expect(response.status).toBe(200);
    });
  });

  describe('Redis Network Errors', () => {
    it('should handle Redis network connection failures', async () => {
      const mockRedis = {
        eval: vi.fn().mockRejectedValue(new Error('ECONNREFUSED: Connection refused')),
        get: vi.fn().mockRejectedValue(new Error('ECONNREFUSED: Connection refused')),
        decr: vi.fn().mockRejectedValue(new Error('ECONNREFUSED: Connection refused')),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'network-error-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle Redis DNS resolution failures', async () => {
      const mockRedis = {
        eval: vi.fn().mockRejectedValue(new Error('ENOTFOUND: DNS lookup failed')),
        get: vi.fn().mockRejectedValue(new Error('ENOTFOUND: DNS lookup failed')),
        decr: vi.fn().mockRejectedValue(new Error('ENOTFOUND: DNS lookup failed')),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 2,
        keyGenerator: () => 'dns-error-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
    });
  });

  describe('Redis Authentication Errors', () => {
    it('should handle Redis authentication failures', async () => {
      const mockRedis = {
        eval: vi.fn().mockRejectedValue(new Error('WRONGPASS: Invalid password')),
        get: vi.fn().mockRejectedValue(new Error('WRONGPASS: Invalid password')),
        decr: vi.fn().mockRejectedValue(new Error('WRONGPASS: Invalid password')),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'auth-error-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
    });

    it('should handle Redis ACL permission errors', async () => {
      const mockRedis = {
        eval: vi.fn().mockRejectedValue(new Error('NOPERM: User does not have permission')),
        get: vi.fn().mockRejectedValue(new Error('NOPERM: User does not have permission')),
        decr: vi.fn().mockRejectedValue(new Error('NOPERM: User does not have permission')),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 3,
        keyGenerator: () => 'acl-error-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
    });
  });

  describe('Redis Memory and Resource Errors', () => {
    it('should handle Redis out of memory errors', async () => {
      const mockRedis = {
        eval: vi
          .fn()
          .mockRejectedValue(new Error('OOM: command not allowed when used memory > maxmemory')),
        get: vi
          .fn()
          .mockRejectedValue(new Error('OOM: command not allowed when used memory > maxmemory')),
        decr: vi
          .fn()
          .mockRejectedValue(new Error('OOM: command not allowed when used memory > maxmemory')),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'oom-error-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
    });

    it('should handle Redis max clients exceeded', async () => {
      const mockRedis = {
        eval: vi.fn().mockRejectedValue(new Error('ERR max number of clients reached')),
        get: vi.fn().mockRejectedValue(new Error('ERR max number of clients reached')),
        decr: vi.fn().mockRejectedValue(new Error('ERR max number of clients reached')),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'max-clients-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
    });
  });

  describe('Redis Cluster and Failover Scenarios', () => {
    it('should handle Redis cluster node failures', async () => {
      const mockRedis = {
        eval: vi.fn().mockRejectedValue(new Error('CLUSTERDOWN: Hash slot not served')),
        get: vi.fn().mockRejectedValue(new Error('CLUSTERDOWN: Hash slot not served')),
        decr: vi.fn().mockRejectedValue(new Error('CLUSTERDOWN: Hash slot not served')),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 2,
        keyGenerator: () => 'cluster-down-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
    });

    it('should handle Redis cluster slot migration', async () => {
      const mockRedis = {
        eval: vi.fn().mockRejectedValue(new Error('MOVED 1234 127.0.0.1:7001')),
        get: vi.fn().mockRejectedValue(new Error('MOVED 1234 127.0.0.1:7001')),
        decr: vi.fn().mockRejectedValue(new Error('MOVED 1234 127.0.0.1:7001')),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'slot-migration-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
    });
  });

  describe('Lua Script Execution Errors', () => {
    it('should handle Lua script syntax errors', async () => {
      const mockRedis = {
        eval: vi
          .fn()
          .mockRejectedValue(
            new Error('ERR Error compiling script (new function): user_script:1: syntax error'),
          ),
        get: vi.fn().mockResolvedValue('0'),
        decr: vi.fn().mockResolvedValue(0),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'lua-syntax-error-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
    });

    it('should handle Lua script runtime errors', async () => {
      const mockRedis = {
        eval: vi
          .fn()
          .mockRejectedValue(
            new Error(
              'ERR Error running script (call to f_abc123): @user_script:1: attempt to call a nil value',
            ),
          ),
        get: vi.fn().mockResolvedValue('0'),
        decr: vi.fn().mockResolvedValue(0),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'lua-runtime-error-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
    });

    it('should handle Lua script execution timeout', async () => {
      const mockRedis = {
        eval: vi.fn().mockRejectedValue(new Error('BUSY Redis is busy running a script')),
        get: vi.fn().mockResolvedValue('0'),
        decr: vi.fn().mockResolvedValue(0),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'lua-busy-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
    });
  });

  describe('Partial Redis Failures', () => {
    it('should handle mixed success/failure scenarios', async () => {
      let callCount = 0;
      const mockRedis = {
        eval: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount % 2 === 0) {
            return Promise.reject(new Error('Connection timeout'));
          }
          return Promise.resolve([0, 60]); // Success
        }),
        get: vi.fn().mockResolvedValue('1'),
        decr: vi.fn().mockResolvedValue(0),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 5,
        keyGenerator: (req) => `mixed-failure-${req.path}`,
      });

      app.get('/test1', rateLimit, (req, res) => {
        res.json({ success: true, path: req.path });
      });

      app.get('/test2', rateLimit, (req, res) => {
        res.json({ success: true, path: req.path });
      });

      // First request should succeed (odd call count)
      const response1 = await request(app).get('/test1');
      expect(response1.status).toBe(200);

      // Second request should succeed despite Redis failure (even call count)
      const response2 = await request(app).get('/test2');
      expect(response2.status).toBe(200);
    });

    it('should handle intermittent Redis connectivity', async () => {
      let attempts = 0;
      const mockRedis = {
        eval: vi.fn().mockImplementation(() => {
          attempts++;
          if (attempts <= 2) {
            return Promise.reject(new Error('Connection temporarily unavailable'));
          }
          return Promise.resolve([0, 60]); // Success after failures
        }),
        get: vi.fn().mockResolvedValue('0'),
        decr: vi.fn().mockResolvedValue(0),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'intermittent-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true, attempt: attempts });
      });

      // All requests should succeed despite initial Redis failures
      for (let i = 0; i < 4; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }

      expect(attempts).toBe(4);
    });
  });

  describe('Error Logging and Monitoring', () => {
    it('should log Redis errors with appropriate context', async () => {
      const loggerSpy = vi.spyOn(logger, 'error');

      const mockRedis = {
        eval: vi.fn().mockRejectedValue(new Error('Specific Redis error for logging')),
        get: vi.fn().mockRejectedValue(new Error('Specific Redis error for logging')),
        decr: vi.fn().mockRejectedValue(new Error('Specific Redis error for logging')),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'logging-test-key',
      });

      app.get('/test-logging', rateLimit, (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test-logging');

      expect(loggerSpy).toHaveBeenCalledWith(
        'Rate limit check failed',
        expect.objectContaining({
          error: expect.any(Error),
          key: 'rate:logging-test-key',
        }),
      );

      const logCall = loggerSpy.mock.calls[0];
      expect(logCall[1].error.message).toBe('Specific Redis error for logging');
    });

    it('should distinguish between different types of Redis errors in logs', async () => {
      const loggerSpy = vi.spyOn(logger, 'error');

      const testCases = [
        { error: 'ECONNREFUSED: Connection refused', key: 'connection-error' },
        { error: 'WRONGPASS: Invalid password', key: 'auth-error' },
        { error: 'OOM: command not allowed when used memory > maxmemory', key: 'memory-error' },
        { error: 'Connection timeout after 5000ms', key: 'timeout-error' },
      ];

      for (const testCase of testCases) {
        const mockRedis = {
          eval: vi.fn().mockRejectedValue(new Error(testCase.error)),
          get: vi.fn().mockRejectedValue(new Error(testCase.error)),
          decr: vi.fn().mockRejectedValue(new Error(testCase.error)),
        };

        vi.mocked(getRedis).mockReturnValue(mockRedis as any);

        const rateLimit = createRateLimit({
          windowMs: 60000,
          max: 1,
          keyGenerator: () => testCase.key,
        });

        app.get(`/test-${testCase.key}`, rateLimit, (req, res) => {
          res.json({ success: true });
        });

        await request(app).get(`/test-${testCase.key}`);
      }

      expect(loggerSpy).toHaveBeenCalledTimes(testCases.length);

      testCases.forEach((testCase, index) => {
        const logCall = loggerSpy.mock.calls[index];
        expect(logCall[1].error.message).toBe(testCase.error);
        expect(logCall[1].key).toBe(`rate:${testCase.key}`);
      });
    });
  });

  describe('Graceful Degradation Patterns', () => {
    it('should maintain consistent behavior despite Redis instability', async () => {
      // Simulate unstable Redis with random failures
      const mockRedis = {
        eval: vi.fn().mockImplementation(() => {
          if (Math.random() < 0.5) {
            return Promise.reject(new Error('Random Redis failure'));
          }
          return Promise.resolve([0, 60]);
        }),
        get: vi.fn().mockResolvedValue('0'),
        decr: vi.fn().mockResolvedValue(0),
      };

      vi.mocked(getRedis).mockReturnValue(mockRedis as any);

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'degradation-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true, timestamp: Date.now() });
      });

      // All requests should succeed despite random Redis failures
      const responses = await Promise.all(
        Array(10)
          .fill(0)
          .map(() => request(app).get('/test')),
      );

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should provide fallback rate limiting when Redis is completely unavailable', async () => {
      // Mock complete Redis unavailability
      vi.mocked(getRedis).mockImplementation(() => {
        throw new Error('Redis not initialized. Call initializeRedis() first.');
      });

      const rateLimit = createRateLimit({
        windowMs: 60000,
        max: 1,
        keyGenerator: () => 'fallback-test',
      });

      app.get('/test', rateLimit, (req, res) => {
        res.json({ success: true, fallback: true });
      });

      // Should still allow requests with fallback behavior
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
