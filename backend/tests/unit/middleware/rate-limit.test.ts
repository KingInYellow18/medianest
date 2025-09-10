import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createRateLimit } from '@/middleware/rate-limit';

// Mock dependencies
vi.mock('@/services/redis.service', () => ({
  redisService: mockRedisService,
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

const mockRedisService = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  del: vi.fn(),
};

describe('Rate Limit Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      ip: '192.168.1.1',
      path: '/api/test',
      method: 'GET',
      user: { id: 'user-123' },
      headers: {},
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic rate limiting', () => {
    it('should allow requests within rate limit', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000, // 1 minute
        max: 10, // 10 requests per minute
      });

      mockRedisService.get.mockResolvedValue('5'); // Current count
      mockRedisService.incr.mockResolvedValue(6);
      mockRedisService.expire.mockResolvedValue(1);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '4');
    });

    it('should block requests exceeding rate limit', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
      });

      mockRedisService.get.mockResolvedValue('10'); // Already at limit
      mockRedisService.incr.mockResolvedValue(11);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: expect.any(Number),
      });
    });

    it('should handle first request in window', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
      });

      mockRedisService.get.mockResolvedValue(null); // No existing key
      mockRedisService.incr.mockResolvedValue(1);
      mockRedisService.expire.mockResolvedValue(1);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedisService.expire).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit:'),
        60
      );
    });

    it('should use IP address as default key', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
      });

      mockRedisService.get.mockResolvedValue('1');
      mockRedisService.incr.mockResolvedValue(2);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRedisService.get).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.1')
      );
    });
  });

  describe('custom key generator', () => {
    it('should use custom key generator', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
        keyGenerator: (req) => `user:${req.user?.id}`,
      });

      mockRedisService.get.mockResolvedValue('3');
      mockRedisService.incr.mockResolvedValue(4);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRedisService.get).toHaveBeenCalledWith(
        expect.stringContaining('user:user-123')
      );
    });

    it('should handle custom key generator errors', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
        keyGenerator: () => {
          throw new Error('Key generator error');
        },
      });

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should allow request on error
    });
  });

  describe('skip function', () => {
    it('should skip rate limiting when skip function returns true', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 1,
        skip: (req) => req.path === '/api/test',
      });

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedisService.get).not.toHaveBeenCalled();
    });

    it('should apply rate limiting when skip function returns false', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
        skip: (req) => req.path === '/api/other',
      });

      mockRedisService.get.mockResolvedValue('5');
      mockRedisService.incr.mockResolvedValue(6);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRedisService.get).toHaveBeenCalled();
    });

    it('should handle skip function errors', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
        skip: () => {
          throw new Error('Skip function error');
        },
      });

      mockRedisService.get.mockResolvedValue('5');
      mockRedisService.incr.mockResolvedValue(6);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should continue on error
    });
  });

  describe('custom message and status', () => {
    it('should use custom message', async () => {
      const customMessage = 'Custom rate limit message';
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 1,
        message: customMessage,
      });

      mockRedisService.get.mockResolvedValue('1');
      mockRedisService.incr.mockResolvedValue(2);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: customMessage,
        })
      );
    });

    it('should use custom status code', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 1,
        statusCode: 503,
      });

      mockRedisService.get.mockResolvedValue('1');
      mockRedisService.incr.mockResolvedValue(2);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
    });

    it('should use custom headers', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
        headers: true,
      });

      mockRedisService.get.mockResolvedValue('3');
      mockRedisService.incr.mockResolvedValue(4);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '6');
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    it('should skip headers when headers option is false', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
        headers: false,
      });

      mockRedisService.get.mockResolvedValue('3');
      mockRedisService.incr.mockResolvedValue(4);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
      });

      mockRedisService.get.mockRejectedValue(new Error('Redis connection error'));

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should allow request on Redis error
    });

    it('should handle Redis incr errors gracefully', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
      });

      mockRedisService.get.mockResolvedValue('5');
      mockRedisService.incr.mockRejectedValue(new Error('Redis incr error'));

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should allow request on Redis error
    });

    it('should handle missing IP address', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
      });

      mockRequest.ip = undefined;

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should allow request when IP is missing
    });

    it('should handle invalid Redis responses', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
      });

      mockRedisService.get.mockResolvedValue('invalid-number');
      mockRedisService.incr.mockResolvedValue(NaN);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should allow request on invalid response
    });
  });

  describe('different window configurations', () => {
    it('should handle short windows (seconds)', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 1000, // 1 second
        max: 5,
      });

      mockRedisService.get.mockResolvedValue('2');
      mockRedisService.incr.mockResolvedValue(3);
      mockRedisService.expire.mockResolvedValue(1);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRedisService.expire).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit:'),
        1
      );
    });

    it('should handle long windows (hours)', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 3600000, // 1 hour
        max: 1000,
      });

      mockRedisService.get.mockResolvedValue('500');
      mockRedisService.incr.mockResolvedValue(501);
      mockRedisService.expire.mockResolvedValue(1);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRedisService.expire).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit:'),
        3600
      );
    });
  });

  describe('key prefixes and namespacing', () => {
    it('should include path in key for endpoint-specific limits', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
        keyGenerator: (req) => `${req.ip}:${req.path}`,
      });

      mockRedisService.get.mockResolvedValue('3');
      mockRedisService.incr.mockResolvedValue(4);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRedisService.get).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.1:/api/test')
      );
    });

    it('should handle user-based rate limiting', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 100,
        keyGenerator: (req) => {
          if (req.user?.id) {
            return `user:${req.user.id}`;
          }
          return `ip:${req.ip}`;
        },
      });

      mockRedisService.get.mockResolvedValue('50');
      mockRedisService.incr.mockResolvedValue(51);

      await rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRedisService.get).toHaveBeenCalledWith(
        expect.stringContaining('user:user-123')
      );
    });
  });

  describe('concurrent requests', () => {
    it('should handle concurrent requests properly', async () => {
      const rateLimiter = createRateLimit({
        windowMs: 60000,
        max: 10,
      });

      // Simulate concurrent requests by making the same call multiple times
      mockRedisService.get.mockResolvedValue('8');
      mockRedisService.incr.mockResolvedValueOnce(9).mockResolvedValueOnce(10);

      const promise1 = rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);
      const promise2 = rateLimiter(mockRequest as Request, mockResponse as Response, mockNext);

      await Promise.all([promise1, promise2]);

      expect(mockRedisService.incr).toHaveBeenCalledTimes(2);
    });
  });
});