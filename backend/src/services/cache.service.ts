// @ts-nocheck
import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';
import { handleAsync, handleCacheError, safeAsyncTry } from '@/utils/error-handler';
import { isNotNullOrUndefined } from '@/utils/validation.utils';
import { safeJsonParse, safeJsonStringify } from '@/utils/transform.utils';

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
    const ttlSeconds = ttl || this.defaultTTL;
    const jsonValue = safeJsonStringify(value);

    await safeAsyncTry(
      () => redisClient.setex(key, ttlSeconds, jsonValue),
      undefined,
      `Cache set error for key: ${key}`
    );
  }

  /**
   * Delete cached value(s)
   */
  async del(keys: string | string[]): Promise<void> {
    if (Array.isArray(keys) && keys.length > 0) {
      await safeAsyncTry(
        () => redisClient.del(keys),
        undefined,
        'Cache delete error for array keys'
      );
    } else if (typeof keys === 'string') {
      await safeAsyncTry(
        () => redisClient.del(keys),
        undefined,
        `Cache delete error for key: ${keys}`
      );
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
      `Cache pattern keys lookup error: ${pattern}`
    );

    if (keysError || !keys || keys.length === 0) return;

    const [, delError] = await handleAsync(
      () => redisClient.del(keys),
      `Cache pattern delete error: ${pattern}`
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
      `Cache exists error for key: ${key}`
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
      `Cache TTL error for key: ${key}`
    );

    if (error) return -1;
    return ttl || -1;
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
      'Cache info memory error'
    );

    const [dbSize, dbSizeError] = await handleAsync(
      () => redisClient.dbsize(),
      'Cache dbsize error'
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
    await safeAsyncTry(
      () => redisClient.flushall(),
      undefined,
      'Cache clear error'
    );
  }
}

export const cacheService = new CacheService();
