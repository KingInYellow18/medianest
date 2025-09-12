import { beforeAll, afterAll, vi } from 'vitest';

import type { Request, Response, NextFunction } from 'express';

/**
 * Security Test Runner Setup
 * Provides mocked dependencies for security tests that don't require actual Redis/Database connections
 */

// Mock Redis client for rate limiting tests
export const mockRedisClient = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  del: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(-1),
  exists: vi.fn().mockResolvedValue(0),
  keys: vi.fn().mockResolvedValue([]),
  flushall: vi.fn().mockResolvedValue('OK'),
  quit: vi.fn().mockResolvedValue('OK'),
  disconnect: vi.fn().mockResolvedValue(undefined),
  status: 'ready',
  connect: vi.fn().mockResolvedValue(undefined),
};

// Mock rate limiter for security tests
// Context7 Pattern: Properly typed middleware function
export const mockRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // Simulate rate limit check
  const rateLimitKey = `rate_limit:${req.ip}:${req.path}`;
  const currentCount = 1; // Mock current request count

  if (req.path === '/api/auth/login' && currentCount > 5) {
    return res.status(429).json({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 900, // 15 minutes
    });
  }

  if (currentCount > 100) {
    return res.status(429).json({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
    });
  }

  next();
};

// Setup security test environment
beforeAll(async () => {
  // Mock ioredis for all security tests
  vi.mock('ioredis', () => ({
    default: vi.fn(() => mockRedisClient),
    Redis: vi.fn(() => mockRedisClient),
  }));

  // Mock rate limiting middleware
  vi.mock('../../src/middleware/rate-limit', async () => {
    const actual = await vi.importActual('../../src/middleware/rate-limit');
    return {
      ...actual,
      createRateLimit: vi.fn(() => mockRateLimit),
      rateLimitClient: mockRedisClient,
    };
  });

  // Set security environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-security-jwt-secret-key-must-be-32-chars-minimum';
  process.env.ENCRYPTION_KEY = 'test-security-encryption-key-32-chars-min';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/security_test_db';
  process.env.REDIS_URL = 'redis://localhost:6379';
});

afterAll(async () => {
  // Reset all mocks
  vi.clearAllMocks();
  vi.resetAllMocks();
});

export { mockRedisClient as rateLimitClient };
