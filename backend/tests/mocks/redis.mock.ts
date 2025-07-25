import { vi } from 'vitest';

export const createMockRedis = () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(0),
  expire: vi.fn().mockResolvedValue(1),
  flushall: vi.fn().mockResolvedValue('OK'),
  quit: vi.fn().mockResolvedValue('OK'),
  ping: vi.fn().mockResolvedValue('PONG'),
  incr: vi.fn().mockResolvedValue(1),
  decr: vi.fn().mockResolvedValue(0),
  ttl: vi.fn().mockResolvedValue(-1),
  keys: vi.fn().mockResolvedValue([]),
  mget: vi.fn().mockResolvedValue([]),
  mset: vi.fn().mockResolvedValue('OK'),
  hget: vi.fn().mockResolvedValue(null),
  hset: vi.fn().mockResolvedValue(1),
  hgetall: vi.fn().mockResolvedValue({}),
  hdel: vi.fn().mockResolvedValue(1),
  sadd: vi.fn().mockResolvedValue(1),
  srem: vi.fn().mockResolvedValue(1),
  smembers: vi.fn().mockResolvedValue([]),
  sismember: vi.fn().mockResolvedValue(0),
  zadd: vi.fn().mockResolvedValue(1),
  zrem: vi.fn().mockResolvedValue(1),
  zrange: vi.fn().mockResolvedValue([]),
  zscore: vi.fn().mockResolvedValue(null)
});

export const mockRedisHealthy = (mockRedis: ReturnType<typeof createMockRedis>) => {
  mockRedis.ping.mockResolvedValue('PONG');
  mockRedis.get.mockResolvedValue('cached-value');
  mockRedis.set.mockResolvedValue('OK');
};

export const mockRedisUnhealthy = (mockRedis: ReturnType<typeof createMockRedis>) => {
  mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));
  mockRedis.get.mockRejectedValue(new Error('Redis get failed'));
  mockRedis.set.mockRejectedValue(new Error('Redis set failed'));
};

export const mockRedisRateLimit = (mockRedis: ReturnType<typeof createMockRedis>) => {
  let requestCount = 0;
  
  mockRedis.incr.mockImplementation(async (key: string) => {
    requestCount++;
    return requestCount;
  });
  
  mockRedis.expire.mockResolvedValue(1);
  mockRedis.ttl.mockResolvedValue(3600);
  
  return {
    resetCount: () => { requestCount = 0; },
    getCount: () => requestCount
  };
};