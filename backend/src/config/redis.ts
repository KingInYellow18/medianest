import Redis from 'ioredis';

import { logger } from '../utils/logger';

let redisClient: Redis;

export const initializeRedis = async (): Promise<Redis> => {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    // Test connection
    await redisClient.ping();
  }

  return redisClient;
};

export const getRedis = (): Redis => {
  if (!redisClient) {
    throw new Error('Redis not initialized');
  }
  return redisClient;
};

// Rate limiting Lua script
export const rateLimitScript = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current = redis.call('GET', key)

if current and tonumber(current) >= limit then
  return redis.call('TTL', key)
else
  current = redis.call('INCR', key)
  if current == 1 then
    redis.call('EXPIRE', key, window)
  end
  return 0
end
`;
