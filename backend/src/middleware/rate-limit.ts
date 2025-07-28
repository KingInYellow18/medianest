import { RateLimitError } from '@medianest/shared';
import { Request, Response, NextFunction } from 'express';

import { getRateLimitConfig } from '../config';
import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

export function createRateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    message = 'Too many requests',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const redis = getRedis();
    const key = `rate:${keyGenerator(req)}`;
    const windowSeconds = Math.ceil(windowMs / 1000);

    try {
      // Lua script for atomic increment and expiry
      const luaScript = `
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local current = redis.call('GET', key)
        
        if current and tonumber(current) >= limit then
          local ttl = redis.call('TTL', key)
          return {1, ttl}
        else
          current = redis.call('INCR', key)
          if current == 1 then
            redis.call('EXPIRE', key, window)
          end
          local ttl = redis.call('TTL', key)
          return {0, ttl}
        end
      `;

      const result = (await redis.eval(luaScript, 1, key, max, windowSeconds)) as [number, number];

      const [blocked, ttl] = result;

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, max - parseInt((await redis.get(key)) || '0')),
      );
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + ttl * 1000).toISOString());

      if (blocked) {
        res.setHeader('Retry-After', ttl);
        throw new RateLimitError(ttl);
      }

      // Store original end function to handle skip options
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalEnd = res.end;
        res.end = function (...args: any[]) {
          const shouldSkip =
            (skipSuccessfulRequests && res.statusCode < 400) ||
            (skipFailedRequests && res.statusCode >= 400);

          if (shouldSkip) {
            // Decrement counter
            redis
              .decr(key)
              .catch((err) => logger.error('Failed to decrement rate limit counter', err));
          }

          return originalEnd.apply(res, args);
        } as any;
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        next(error);
      } else {
        // Redis error - log but allow request
        logger.error('Rate limit check failed', { error, key });
        next();
      }
    }
  };
}

// Default key generator
function defaultKeyGenerator(req: Request): string {
  // Use user ID if authenticated, otherwise use IP
  return req.user?.id || req.ip || 'unknown';
}

// Get configuration once at module load
const rateLimitConfig = getRateLimitConfig();

// Pre-configured rate limiters
export const apiRateLimit = createRateLimit({
  windowMs: rateLimitConfig.api.window,
  max: rateLimitConfig.api.requests,
  message: 'Too many API requests',
});

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes - static value for security
  max: 5, // Fixed for security - not configurable
  keyGenerator: (req) => req.ip || 'unknown',
  message: 'Too many authentication attempts',
});

export const youtubeRateLimit = createRateLimit({
  windowMs: rateLimitConfig.youtube.window,
  max: rateLimitConfig.youtube.requests,
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
  message: 'YouTube download limit exceeded',
});

export const mediaRequestRateLimit = createRateLimit({
  windowMs: rateLimitConfig.media.window,
  max: rateLimitConfig.media.requests,
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
  message: 'Media request limit exceeded',
});

// Strict rate limit for sensitive operations
export const strictRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  keyGenerator: (req) => req.ip || 'unknown',
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  message: 'Too many attempts for this operation',
});
