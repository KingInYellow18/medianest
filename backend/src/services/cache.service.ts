import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

export class CacheService {
  private readonly defaultTTL = 300; // 5 minutes default

  /**
   * Get cached value with automatic JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redisClient.get(key);
      if (!cached) return null;
      
      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Set cached value with automatic JSON stringification
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const ttlSeconds = ttl || this.defaultTTL;
      await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error', { key, error });
    }
  }

  /**
   * Delete cached value(s)
   */
  async del(keys: string | string[]): Promise<void> {
    try {
      if (Array.isArray(keys) && keys.length > 0) {
        await redisClient.del(keys);
      } else if (typeof keys === 'string') {
        await redisClient.del(keys);
      }
    } catch (error) {
      logger.error('Cache delete error', { keys, error });
    }
  }

  /**
   * Get or set cache with callback
   */
  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
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
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.debug('Cache invalidated', { pattern, count: keys.length });
      }
    } catch (error) {
      logger.error('Cache pattern invalidation error', { pattern, error });
    }
  }

  /**
   * Get cache info
   */
  async getInfo(): Promise<{
    keyCount: number;
    memoryUsage: string;
  }> {
    try {
      const info = await redisClient.info('memory');
      const dbSize = await redisClient.dbsize();
      
      // Parse memory usage from info
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'unknown';
      
      return {
        keyCount: dbSize,
        memoryUsage,
      };
    } catch (error) {
      logger.error('Cache info error', { error });
      return {
        keyCount: 0,
        memoryUsage: 'unknown',
      };
    }
  }
}

export const cacheService = new CacheService();