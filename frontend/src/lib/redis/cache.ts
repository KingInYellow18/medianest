import { getRedisClient } from './redis-client';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string; // Custom key prefix
  compress?: boolean; // Whether to compress large values
}

// Default cache configurations
export const CACHE_CONFIG = {
  // Service status cache: 5 minutes
  SERVICE_STATUS: {
    ttl: 5 * 60,
    keyPrefix: 'cache:service:',
  },
  // Plex library cache: 30 minutes
  PLEX_LIBRARY: {
    ttl: 30 * 60,
    keyPrefix: 'cache:plex:',
  },
  // User preferences: 1 hour
  USER_PREFERENCES: {
    ttl: 60 * 60,
    keyPrefix: 'cache:user:pref:',
  },
  // Media metadata: 24 hours
  MEDIA_METADATA: {
    ttl: 24 * 60 * 60,
    keyPrefix: 'cache:media:',
  },
};

/**
 * Set a value in cache
 */
export async function setCache<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  const redis = getRedisClient();
  const fullKey = `${options.keyPrefix || 'cache:'}${key}`;

  try {
    const serialized = JSON.stringify(value);

    if (options.ttl) {
      await redis.setex(fullKey, options.ttl, serialized);
    } else {
      await redis.set(fullKey, serialized);
    }
  } catch (error) {
    console.error('Failed to set cache:', error);
    // Cache failures should not break the application
  }
}

/**
 * Get a value from cache
 */
export async function getCache<T>(
  key: string,
  options: CacheOptions = {}
): Promise<T | null> {
  const redis = getRedisClient();
  const fullKey = `${options.keyPrefix || 'cache:'}${key}`;

  try {
    const value = await redis.get(fullKey);
    if (!value) return null;

    return JSON.parse(value) as T;
  } catch (error) {
    console.error('Failed to get cache:', error);
    return null;
  }
}

/**
 * Delete a value from cache
 */
export async function deleteCache(
  key: string,
  options: CacheOptions = {}
): Promise<void> {
  const redis = getRedisClient();
  const fullKey = `${options.keyPrefix || 'cache:'}${key}`;

  try {
    await redis.del(fullKey);
  } catch (error) {
    console.error('Failed to delete cache:', error);
  }
}

/**
 * Delete multiple cache entries by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  const redis = getRedisClient();

  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;

    return await redis.del(...keys);
  } catch (error) {
    console.error('Failed to delete cache pattern:', error);
    return 0;
  }
}

/**
 * Check if a key exists in cache
 */
export async function cacheExists(
  key: string,
  options: CacheOptions = {}
): Promise<boolean> {
  const redis = getRedisClient();
  const fullKey = `${options.keyPrefix || 'cache:'}${key}`;

  try {
    return (await redis.exists(fullKey)) === 1;
  } catch (error) {
    console.error('Failed to check cache existence:', error);
    return false;
  }
}

/**
 * Get remaining TTL for a cache key
 */
export async function getCacheTTL(
  key: string,
  options: CacheOptions = {}
): Promise<number> {
  const redis = getRedisClient();
  const fullKey = `${options.keyPrefix || 'cache:'}${key}`;

  try {
    return await redis.ttl(fullKey);
  } catch (error) {
    console.error('Failed to get cache TTL:', error);
    return -1;
  }
}

/**
 * Cache wrapper function - get from cache or compute
 */
export async function cacheWrapper<T>(
  key: string,
  compute: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache first
  const cached = await getCache<T>(key, options);
  if (cached !== null) {
    return cached;
  }

  // Compute the value
  const value = await compute();

  // Store in cache for next time
  await setCache(key, value, options);

  return value;
}

/**
 * Invalidate all caches matching a prefix
 */
export async function invalidateCachePrefix(prefix: string): Promise<number> {
  return deleteCachePattern(`${prefix}*`);
}

/**
 * Batch get multiple cache keys
 */
export async function batchGetCache<T>(
  keys: string[],
  options: CacheOptions = {}
): Promise<Map<string, T>> {
  const redis = getRedisClient();
  const result = new Map<string, T>();

  if (keys.length === 0) return result;

  try {
    const fullKeys = keys.map(key => `${options.keyPrefix || 'cache:'}${key}`);
    const values = await redis.mget(...fullKeys);

    keys.forEach((key, index) => {
      const value = values[index];
      if (value) {
        try {
          result.set(key, JSON.parse(value) as T);
        } catch (e) {
          console.error(`Failed to parse cache value for key ${key}:`, e);
        }
      }
    });
  } catch (error) {
    console.error('Failed to batch get cache:', error);
  }

  return result;
}

/**
 * Batch set multiple cache keys
 */
export async function batchSetCache<T>(
  entries: Map<string, T>,
  options: CacheOptions = {}
): Promise<void> {
  const redis = getRedisClient();

  if (entries.size === 0) return;

  try {
    const pipeline = redis.pipeline();

    for (const [key, value] of entries) {
      const fullKey = `${options.keyPrefix || 'cache:'}${key}`;
      const serialized = JSON.stringify(value);

      if (options.ttl) {
        pipeline.setex(fullKey, options.ttl, serialized);
      } else {
        pipeline.set(fullKey, serialized);
      }
    }

    await pipeline.exec();
  } catch (error) {
    console.error('Failed to batch set cache:', error);
  }
}
