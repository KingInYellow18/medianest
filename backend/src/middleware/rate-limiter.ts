import { Request, Response, NextFunction } from 'express';

// @ts-ignore
import {
  RateLimitError, // @ts-ignore
} from '@medianest/shared';

import { logger } from '@/utils/logger';
import { getRedis } from '@/config/redis';
import { CatchError } from '../types/common';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

// Context7 Pattern: Optimized Rate Limiter with Connection Pooling and Caching
export function rateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, keyGenerator, message } = options;

  // Context7 Pattern: Cache key prefix for better Redis performance
  const keyPrefix = 'rl:';

  return async (req: Request, res: Response, next: NextFunction) => {
    const redis = getRedis();

    // Context7 Pattern: Optimized key generation with prefix
    const key =
      keyPrefix + (keyGenerator ? keyGenerator(req) : `${req.user?.id || req.ip}:${req.path}`);

    try {
      // Context7 Pattern: Use Redis pipeline for atomic operations
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.pttl(key);

      const [incrResult, ttlResult] = await pipeline.exec();

      if (!incrResult || !ttlResult) {
        throw new Error('Redis pipeline failed');
      }

      const current = incrResult[1] as number;
      let ttl = ttlResult[1] as number;

      // Context7 Pattern: Set TTL only for first request to avoid race conditions
      if (current === 1) {
        await redis.pexpire(key, windowMs);
        ttl = windowMs;
      }

      // Context7 Pattern: Batch header setting for performance
      const headers = {
        'X-RateLimit-Limit': max.toString(),
        'X-RateLimit-Remaining': Math.max(0, max - current).toString(),
      };

      if (ttl > 0) {
        headers['X-RateLimit-Reset'] = new Date(Date.now() + ttl).toISOString();
      }

      // Set all headers at once
      Object.entries(headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      if (current > max) {
        // Context7 Pattern: Fast-fail for rate limit exceeded
        const retryAfter = Math.ceil(ttl / 1000);
        res.setHeader('Retry-After', retryAfter.toString());

        // Context7 Pattern: Async logging to avoid blocking response
        setImmediate(() => {
          logger.warn('Rate limit exceeded', {
            key: key.replace(keyPrefix, ''),
            current,
            max,
            path: req.path,
            userId: req.user?.id,
          });
        });

        throw new RateLimitError(retryAfter.toString());
      }

      next();
    } catch (error: CatchError) {
      if (error instanceof RateLimitError) {
        next(error);
      } else {
        logger.error('Rate limiter error', { error, key: key.replace(keyPrefix, '') });
        // Context7 Pattern: Fail-open for availability
        next();
      }
    }
  };
}
