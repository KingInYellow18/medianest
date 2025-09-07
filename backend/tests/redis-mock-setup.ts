import { vi } from 'vitest';

/**
 * COMPREHENSIVE REDIS MOCK SETUP
 *
 * This file provides a complete Redis mocking strategy that:
 * - Prevents real Redis connections during tests
 * - Provides realistic Redis behavior simulation
 * - Includes proper rate limiting mock responses
 * - Eliminates timeout issues with Redis connections
 */

// Create a rate limiting store that mimics Redis behavior
const rateLimitStore = new Map<string, { value: number; expires: number }>();

// Clean up expired entries
const cleanupExpired = () => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.expires < now) {
      rateLimitStore.delete(key);
    }
  }
};

// Mock Redis client with comprehensive functionality
export const createMockRedis = () => {
  const mockRedis = {
    get: vi.fn().mockImplementation(async (key: string) => {
      cleanupExpired();
      const entry = rateLimitStore.get(key);
      return entry && entry.expires > Date.now() ? entry.value.toString() : null;
    }),

    set: vi.fn().mockImplementation(async (key: string, value: any) => {
      rateLimitStore.set(key, { value, expires: Date.now() + 3600000 }); // 1 hour default
      return 'OK';
    }),

    setex: vi.fn().mockImplementation(async (key: string, ttl: number, value: any) => {
      rateLimitStore.set(key, { value, expires: Date.now() + ttl * 1000 });
      return 'OK';
    }),

    del: vi.fn().mockImplementation(async (...keys: string[]) => {
      let deleted = 0;
      keys.forEach((key) => {
        if (rateLimitStore.delete(key)) deleted++;
      });
      return deleted;
    }),

    exists: vi.fn().mockImplementation(async (...keys: string[]) => {
      cleanupExpired();
      return keys.filter((key) => rateLimitStore.has(key)).length;
    }),

    keys: vi.fn().mockImplementation(async (pattern: string) => {
      cleanupExpired();
      const allKeys = Array.from(rateLimitStore.keys());

      if (pattern === '*') return allKeys;

      // Simple pattern matching for test purposes
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return allKeys.filter((key) => regex.test(key));
    }),

    flushdb: vi.fn().mockImplementation(async () => {
      rateLimitStore.clear();
      return 'OK';
    }),

    flushall: vi.fn().mockImplementation(async () => {
      rateLimitStore.clear();
      return 'OK';
    }),

    quit: vi.fn().mockResolvedValue('OK'),

    disconnect: vi.fn().mockResolvedValue(undefined),

    ping: vi.fn().mockResolvedValue('PONG'),

    connect: vi.fn().mockResolvedValue(undefined),

    ttl: vi.fn().mockImplementation(async (key: string) => {
      const entry = rateLimitStore.get(key);
      if (!entry) return -2; // Key doesn't exist

      const remaining = Math.ceil((entry.expires - Date.now()) / 1000);
      return remaining > 0 ? remaining : -1;
    }),

    // Rate limiting Lua script mock
    eval: vi.fn().mockImplementation(async (script: string, numKeys: number, ...args: any[]) => {
      // Mock the rate limiting lua script behavior
      const key = args[0];
      const limit = parseInt(args[1]);
      const window = parseInt(args[2]);

      cleanupExpired();

      const entry = rateLimitStore.get(key);
      const now = Date.now();

      if (!entry || entry.expires < now) {
        // First request or expired window
        rateLimitStore.set(key, { value: 1, expires: now + window * 1000 });
        return [1, limit, limit - 1, Math.floor((now + window * 1000) / 1000)];
      }

      if (entry.value >= limit) {
        // Limit exceeded
        return [0, limit, 0, Math.floor(entry.expires / 1000)];
      }

      // Increment counter
      entry.value++;
      return [1, limit, limit - entry.value, Math.floor(entry.expires / 1000)];
    }),

    // Event emitter methods
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),

    // Status
    status: 'ready' as const,
  };

  return mockRedis;
};

// Global mock Redis instance
export const globalMockRedis = createMockRedis();

// Reset function for between tests
export const resetMockRedis = () => {
  rateLimitStore.clear();
  vi.clearAllMocks();

  // Reset all mock implementations
  Object.values(globalMockRedis).forEach((mock) => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      (mock as any).mockClear();
    }
  });
};

// Rate limit specific helpers
export const mockRateLimitAllowed = (key: string, limit = 100, remaining = 99) => {
  const resetTime = Math.floor(Date.now() / 1000) + 60;
  globalMockRedis.eval.mockResolvedValueOnce([1, limit, remaining, resetTime]);
};

export const mockRateLimitExceeded = (key: string, limit = 100) => {
  const resetTime = Math.floor(Date.now() / 1000) + 60;
  globalMockRedis.eval.mockResolvedValueOnce([0, limit, 0, resetTime]);
};

// Connection simulation helpers
export const mockRedisConnectionError = () => {
  globalMockRedis.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
  globalMockRedis.ping.mockRejectedValueOnce(new Error('Connection timeout'));
};

export const mockRedisHealthy = () => {
  globalMockRedis.connect.mockResolvedValueOnce(undefined);
  globalMockRedis.ping.mockResolvedValueOnce('PONG');
  globalMockRedis.status = 'ready';
};
