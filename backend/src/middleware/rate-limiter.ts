import { Request, Response, NextFunction } from 'express';

import { RateLimitError } from '@medianest/shared';

import { logger } from '@/utils/logger';
import { getRedis } from '@/config/redis';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

export function rateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, keyGenerator, message } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const redis = getRedis();

    // Generate key based on user ID and endpoint
    const key = keyGenerator
      ? keyGenerator(req)
      : `rate-limit:${req.user?.id || req.ip}:${req.path}`;

    try {
      // Use Redis INCR with TTL
      const current = await redis.incr(key);

      if (current === 1) {
        // First request, set TTL
        await redis.pexpire(key, windowMs);
      }

      // Get TTL for headers
      const ttl = await redis.pttl(key);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current).toString());

      if (ttl > 0) {
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + ttl).toISOString());
      }

      if (current > max) {
        // Rate limit exceeded
        const retryAfter = Math.ceil(ttl / 1000);
        res.setHeader('Retry-After', retryAfter.toString());

        logger.warn('Rate limit exceeded', {
          key,
          current,
          max,
          path: req.path,
          userId: req.user?.id,
        });

        throw new RateLimitError(retryAfter);
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        next(error);
      } else {
        logger.error('Rate limiter error', { error, key });
        // Continue on error
        next();
      }
    }
  };
}
