/**
 * Comprehensive Redis mock setup for testing
 */
import { vi } from 'vitest';

// Create a comprehensive Redis client mock
export const createRedisMock = () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  setex: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(-1),
  incr: vi.fn().mockResolvedValue(1),
  decr: vi.fn().mockResolvedValue(0),
  lpush: vi.fn().mockResolvedValue(1),
  rpush: vi.fn().mockResolvedValue(1),
  lpop: vi.fn().mockResolvedValue('value'),
  rpop: vi.fn().mockResolvedValue('value'),
  lrange: vi.fn().mockResolvedValue([]),
  hget: vi.fn().mockResolvedValue(null),
  hset: vi.fn().mockResolvedValue(1),
  hdel: vi.fn().mockResolvedValue(1),
  hgetall: vi.fn().mockResolvedValue({}),
  sadd: vi.fn().mockResolvedValue(1),
  srem: vi.fn().mockResolvedValue(1),
  smembers: vi.fn().mockResolvedValue([]),
  zadd: vi.fn().mockResolvedValue(1),
  zrange: vi.fn().mockResolvedValue([]),
  zrem: vi.fn().mockResolvedValue(1),
  eval: vi.fn().mockResolvedValue([1, 5, 4, 3600]), // Rate limit success response
  ping: vi.fn().mockResolvedValue('PONG'),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn().mockResolvedValue('OK'),
  flushdb: vi.fn().mockResolvedValue('OK'),
  flushall: vi.fn().mockResolvedValue('OK'),
  keys: vi.fn().mockResolvedValue([]),
  scan: vi.fn().mockResolvedValue(['0', []]),
  multi: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    setex: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(['OK', 'value']),
  }),
  pipeline: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    setex: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(['OK', 'value']),
  }),
});

// Export the mock instance
export const redisMock = createRedisMock();

// Rate limiting specific mocks
export const rateLimitMocks = {
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 4, reset: 3600 }),
  resetRateLimit: vi.fn().mockResolvedValue(true),
  getRateLimitInfo: vi.fn().mockResolvedValue({ requests: 1, remaining: 4, reset: 3600 }),
};

// Cache specific mocks
export const cacheMocks = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(true),
  del: vi.fn().mockResolvedValue(true),
  clear: vi.fn().mockResolvedValue(true),
  has: vi.fn().mockResolvedValue(false),
};

// Health check mocks
export const healthMocks = {
  checkRedisHealth: vi.fn().mockResolvedValue(true),
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
  checkServiceHealth: vi.fn().mockResolvedValue({ status: 'healthy', uptime: 1000 }),
};
