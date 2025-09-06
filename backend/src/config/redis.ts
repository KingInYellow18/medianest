import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { getRedisConfig } from './index';

let redisClient: Redis;

export const initializeRedis = async (): Promise<Redis> => {
  if (!redisClient) {
    // Skip Redis initialization in test environment
    if (process.env.NODE_ENV === 'test') {
      const mockClient = {
        ping: () => Promise.resolve('PONG'),
        on: () => {},
        disconnect: () => Promise.resolve(),
        quit: () => Promise.resolve(),
      } as any as Redis;
      redisClient = mockClient;
      return redisClient;
    }

    const redisConfig = getRedisConfig();

    // Create Redis client with centralized configuration
    if ('url' in redisConfig && redisConfig.url) {
      redisClient = new Redis(redisConfig.url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: true,
      });
    } else {
      redisClient = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        username: redisConfig.username,
        db: redisConfig.db,
        tls: redisConfig.tls,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: true,
      });
    }

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully', {
        host: redisConfig.host || 'URL-based',
        port: redisConfig.port || 'URL-based',
        db: redisConfig.db || 0,
      });
    });

    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', {
        error: err.message,
        host: redisConfig.host || 'URL-based',
        port: redisConfig.port || 'URL-based',
      });
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready for commands');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    // Test connection
    try {
      await redisClient.ping();
      logger.info('Redis ping successful');
    } catch (error) {
      logger.error('Redis ping failed:', error);
      throw error;
    }
  }

  return redisClient;
};

export const getRedis = (): Redis => {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call initializeRedis() first.');
  }
  return redisClient;
};

/**
 * Export redisClient for backwards compatibility
 */
export { redisClient };

/**
 * Close Redis connection gracefully
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
};

/**
 * Health check for Redis
 */
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    const redis = getRedis();
    await redis.ping();
    return true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
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

/**
 * Execute rate limiting check using Lua script
 */
export const checkRateLimit = async (
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter?: number }> => {
  try {
    const redis = getRedis();
    const result = (await redis.eval(rateLimitScript, 1, key, limit, windowSeconds)) as number;

    if (result === 0) {
      return { allowed: true };
    } else {
      return { allowed: false, retryAfter: result };
    }
  } catch (error) {
    logger.error('Rate limit check failed:', error);
    // Allow request on error to avoid blocking users
    return { allowed: true };
  }
};
