/**
 * COMPREHENSIVE REDIS MOCKING INFRASTRUCTURE
 * 
 * Fixes Redis connection timeouts and mocking failures across all tests.
 * Provides consistent Redis mock behavior for all test environments.
 */

import { vi } from 'vitest';

/**
 * Create a comprehensive Redis mock that handles all Redis operations
 */
export const createRedisMock = () => {
  const mockRedis = {
    // Connection methods
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),
    ping: vi.fn().mockResolvedValue('PONG'),
    
    // Basic operations
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-1),
    
    // String operations
    incr: vi.fn().mockResolvedValue(1),
    incrby: vi.fn().mockResolvedValue(1),
    decr: vi.fn().mockResolvedValue(-1),
    decrby: vi.fn().mockResolvedValue(-1),
    append: vi.fn().mockResolvedValue(1),
    strlen: vi.fn().mockResolvedValue(0),
    
    // Hash operations
    hget: vi.fn().mockResolvedValue(null),
    hset: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue({}),
    hdel: vi.fn().mockResolvedValue(1),
    hexists: vi.fn().mockResolvedValue(0),
    hkeys: vi.fn().mockResolvedValue([]),
    hvals: vi.fn().mockResolvedValue([]),
    hlen: vi.fn().mockResolvedValue(0),
    
    // Set operations
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    sismember: vi.fn().mockResolvedValue(0),
    scard: vi.fn().mockResolvedValue(0),
    
    // List operations
    lpush: vi.fn().mockResolvedValue(1),
    rpush: vi.fn().mockResolvedValue(1),
    lpop: vi.fn().mockResolvedValue(null),
    rpop: vi.fn().mockResolvedValue(null),
    llen: vi.fn().mockResolvedValue(0),
    lrange: vi.fn().mockResolvedValue([]),
    
    // Sorted set operations
    zadd: vi.fn().mockResolvedValue(1),
    zrem: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
    zcard: vi.fn().mockResolvedValue(0),
    zscore: vi.fn().mockResolvedValue(null),
    
    // Key operations
    keys: vi.fn().mockResolvedValue([]),
    scan: vi.fn().mockResolvedValue(['0', []]),
    type: vi.fn().mockResolvedValue('none'),
    
    // Database operations
    flushdb: vi.fn().mockResolvedValue('OK'),
    flushall: vi.fn().mockResolvedValue('OK'),
    select: vi.fn().mockResolvedValue('OK'),
    
    // Transaction operations
    multi: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
    discard: vi.fn().mockResolvedValue('OK'),
    watch: vi.fn().mockResolvedValue('OK'),
    unwatch: vi.fn().mockResolvedValue('OK'),
    
    // Pipeline operations
    pipeline: vi.fn().mockReturnThis(),
    
    // Lua scripting
    eval: vi.fn().mockResolvedValue([1, 100, 99, Math.floor(Date.now() / 1000) + 60]),
    evalsha: vi.fn().mockResolvedValue([1, 100, 99, Math.floor(Date.now() / 1000) + 60]),
    script: {
      load: vi.fn().mockResolvedValue('sha1hash'),
      exists: vi.fn().mockResolvedValue([1]),
      flush: vi.fn().mockResolvedValue('OK'),
    },
    
    // Event emitter methods
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    
    // Connection status
    status: 'ready' as const,
    readyState: 'ready',
    connected: true,
    
    // Options and configuration
    options: {
      host: 'localhost',
      port: 6380,
      db: 15,
    },
    
    // Rate limiting support (for rate limiting tests)
    rateLimitScript: vi.fn().mockResolvedValue([1, 100, 99, Math.floor(Date.now() / 1000) + 60]),
  };

  return mockRedis;
};

/**
 * Global Redis mock instance
 */
export const mockRedisInstance = createRedisMock();

/**
 * Mock Redis client factory
 */
export const mockCreateRedisClient = vi.fn(() => mockRedisInstance);

/**
 * Setup Redis mocks - call this in test setup files
 */
export function setupRedisMocks() {
  // Mock ioredis
  vi.mock('ioredis', () => ({
    default: vi.fn(() => createRedisMock()),
    Redis: vi.fn(() => createRedisMock()),
  }));

  // Mock redis (node-redis)
  vi.mock('redis', () => ({
    createClient: mockCreateRedisClient,
  }));

  // Reset mock data before each test
  return {
    mockRedis: mockRedisInstance,
    resetMocks: () => {
      vi.clearAllMocks();
      // Reset any stored data
      mockRedisInstance.get.mockResolvedValue(null);
      mockRedisInstance.hgetall.mockResolvedValue({});
      mockRedisInstance.smembers.mockResolvedValue([]);
      mockRedisInstance.keys.mockResolvedValue([]);
    },
  };
}

/**
 * Rate limiting mock helpers
 */
export const rateLimitMockHelpers = {
  // Mock rate limit exceeded
  mockRateLimitExceeded: () => {
    mockRedisInstance.eval.mockResolvedValue([0, 100, 0, Math.floor(Date.now() / 1000) + 60]);
  },
  
  // Mock rate limit OK
  mockRateLimitOk: () => {
    mockRedisInstance.eval.mockResolvedValue([1, 100, 99, Math.floor(Date.now() / 1000) + 60]);
  },
  
  // Mock rate limit near limit
  mockRateLimitNearLimit: () => {
    mockRedisInstance.eval.mockResolvedValue([1, 100, 5, Math.floor(Date.now() / 1000) + 60]);
  },
};

/**
 * Cache mock helpers
 */
export const cacheMockHelpers = {
  // Mock cache hit
  mockCacheHit: (key: string, value: string) => {
    mockRedisInstance.get.mockImplementation((k) => 
      k === key ? Promise.resolve(value) : Promise.resolve(null)
    );
  },
  
  // Mock cache miss
  mockCacheMiss: () => {
    mockRedisInstance.get.mockResolvedValue(null);
  },
  
  // Mock cache set
  mockCacheSet: () => {
    mockRedisInstance.set.mockResolvedValue('OK');
    mockRedisInstance.setex.mockResolvedValue('OK');
  },
};

/**
 * Session mock helpers
 */
export const sessionMockHelpers = {
  // Mock session data
  mockSessionData: (sessionId: string, data: Record<string, any>) => {
    mockRedisInstance.hgetall.mockImplementation((key) =>
      key === `session:${sessionId}` ? Promise.resolve(data) : Promise.resolve({})
    );
  },
  
  // Mock session deletion
  mockSessionDelete: () => {
    mockRedisInstance.del.mockResolvedValue(1);
  },
};