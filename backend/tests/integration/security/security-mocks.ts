/**
 * Security Test Mocks
 * Provides mocked dependencies for security testing without external service dependencies
 */

import { vi } from 'vitest';

// Mock Redis client for rate limiting and session management
export const createMockRedis = () => ({
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
  connect: vi.fn().mockResolvedValue(undefined),
  status: 'ready' as const,
  pipeline: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([['OK'], [1], [1]]),
  }),
});

// Mock rate limiter that can simulate different scenarios
export const createMockRateLimit = (options?: { failAfter?: number; path?: string }) => {
  let requestCount = 0;

  return (req: any, res: any, next: any) => {
    requestCount++;

    const { failAfter = 100, path } = options || {};

    // Simulate different rate limits for different paths
    if (path && req.path === path && requestCount > 5) {
      return res.status(429).json({
        error: 'Too Many Requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 900,
      });
    }

    if (requestCount > failAfter) {
      return res.status(429).json({
        error: 'Too Many Requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60,
      });
    }

    next();
  };
};

// Mock database client
export const createMockPrisma = () => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mediaRequest: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $disconnect: vi.fn(),
});

// Setup mocks for security tests
export const setupSecurityMocks = () => {
  const mockRedis = createMockRedis();
  const mockPrisma = createMockPrisma();

  // Mock Redis
  vi.doMock('ioredis', () => ({
    default: vi.fn(() => mockRedis),
    Redis: vi.fn(() => mockRedis),
  }));

  // Mock Prisma
  vi.doMock('@prisma/client', () => ({
    PrismaClient: vi.fn(() => mockPrisma),
  }));

  // Mock rate limiting
  vi.doMock('../../../src/middleware/rate-limit', () => ({
    createRateLimit: vi.fn(() => createMockRateLimit()),
    rateLimitClient: mockRedis,
  }));

  return { mockRedis, mockPrisma };
};

// Reset all security mocks
export const resetSecurityMocks = () => {
  vi.clearAllMocks();
  vi.resetAllMocks();
  vi.resetModules();
};
