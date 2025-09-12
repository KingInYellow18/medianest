// @ts-nocheck
import { redisClient } from '@/config/redis';
import { handleAsync, handleCacheError, safeAsyncTry } from '@/utils/error-handler';
import { logger } from '@/utils/logger';
import { safeJsonParse, safeJsonStringify } from '@/utils/transform.utils';
import { isNotNullOrUndefined } from '@/utils/validation.utils';

export class CacheService {
  private readonly defaultTTL = 300; // 5 minutes default

  /**
   * Get cached value with automatic JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    const [cached, error] = await handleAsync(() => redisClient.get(key), 'Cache get error');

    if (error || !cached) return null;

    return safeJsonParse<T>(cached, null as T);
  }

  /**
   * Set cached value with automatic JSON stringification
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      const ttlSeconds = ttl || this.defaultTTL;
      const jsonValue = safeJsonStringify(value);

      await safeAsyncTry(
        () => redisClient.setex(key, ttlSeconds, jsonValue),
        undefined,
        `Cache set error for key: ${key}`,
      );
    } catch (error) {
      // Gracefully handle any errors
      logger.debug('Cache set error handled gracefully', { key, error });
    }
  }

  /**
   * Delete cached value(s)
   */
  async del(keys: string | string[]): Promise<void> {
    try {
      if (Array.isArray(keys) && keys.length > 0) {
        await safeAsyncTry(
          () => redisClient.del(keys),
          undefined,
          'Cache delete error for array keys',
        );
      } else if (typeof keys === 'string') {
        await safeAsyncTry(
          () => redisClient.del(keys),
          undefined,
          `Cache delete error for key: ${keys}`,
        );
      }
    } catch (error) {
      // Gracefully handle any errors
      logger.debug('Cache delete error handled gracefully', { keys, error });
    }
  }

  /**
   * Get or set cache with callback
   */
  async getOrSet<T>(key: string, callback: () => Promise<T>, ttl?: number): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // If not in cache, call the callback
    const result = await callback();

    // Store in cache
    await this.set(key, result, ttl);

    return result;
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const [keys, keysError] = await handleAsync(
      () => redisClient.keys(pattern),
      `Cache pattern keys lookup error: ${pattern}`,
    );

    if (keysError || !keys || keys.length === 0) return;

    const [, delError] = await handleAsync(
      () => redisClient.del(keys),
      `Cache pattern delete error: ${pattern}`,
    );

    if (!delError) {
      logger.debug('Cache invalidated', { pattern, count: keys.length });
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const [exists, error] = await handleAsync(
      () => redisClient.exists(key),
      `Cache exists error for key: ${key}`,
    );

    if (error) return false;
    return Boolean(exists);
  }

  /**
   * Get TTL (time to live) for a cache key
   */
  async ttl(key: string): Promise<number> {
    const [ttl, error] = await handleAsync(
      () => redisClient.ttl(key),
      `Cache TTL error for key: ${key}`,
    );

    if (error) return -1;
    return ttl ?? -1;
  }

  /**
   * Ping Redis to check connectivity
   */
  async ping(): Promise<boolean> {
    const [response, error] = await handleAsync(
      () => redisClient.ping(),
      'Cache ping error',
    );

    if (error) return false;
    return response === 'PONG';
  }

  /**
   * Get multiple values by keys
   */
  async mget(keys: string[]): Promise<(any | null)[]> {
    if (keys.length === 0) return [];

    const [values, error] = await handleAsync(
      () => redisClient.mget(keys),
      'Cache mget error',
    );

    if (error || !values) return [];

    return values.map((value) => 
      value !== null ? safeJsonParse(value, null) : null
    );
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValuePairs: Record<string, unknown>, ttl?: number): Promise<void> {
    const entries = Object.entries(keyValuePairs);
    if (entries.length === 0) return;

    const ttlSeconds = ttl || this.defaultTTL;

    try {
      // Set each key-value pair individually with TTL
      await Promise.all(
        entries.map(([key, value]) => 
          safeAsyncTry(
            () => redisClient.setex(key, ttlSeconds, safeJsonStringify(value)),
            undefined,
            `Cache set error for key: ${key}`,
          )
        )
      );
    } catch (error) {
      // Gracefully handle any errors
      logger.debug('Cache mset error handled gracefully', { keyValuePairs, error });
    }
  }

  /**
   * Get cache info
   */
  async getInfo(): Promise<{
    keyCount: number;
    memoryUsage: string;
  }> {
    const [info, infoError] = await handleAsync(
      () => redisClient.info('memory'),
      'Cache info memory error',
    );

    const [dbSize, dbSizeError] = await handleAsync(
      () => redisClient.dbsize(),
      'Cache dbsize error',
    );

    if (infoError || dbSizeError) {
      return { keyCount: 0, memoryUsage: 'unknown' };
    }

    // Parse memory usage from info
    const memoryMatch = info?.match(/used_memory_human:(.+)/);
    const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'unknown';

    return {
      keyCount: dbSize || 0,
      memoryUsage,
    };
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      await safeAsyncTry(() => redisClient.flushall(), undefined, 'Cache clear error');
    } catch (error) {
      // Gracefully handle any errors
      logger.debug('Cache clear error handled gracefully', { error });
    }
  }
}

export const cacheService = new CacheService();
