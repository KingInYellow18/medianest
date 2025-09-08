import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';
import { AppError } from '@medianest/shared';
import { CatchError } from '../types/common';

// Enhanced rate limiting configuration types
export interface EnhancedRateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  store?: RateLimitStore;
  onLimitReached?: (req: Request, res: Response) => void;
  skip?: (req: Request, res: Response) => boolean;
  requestWasSuccessful?: (req: Request, res: Response) => boolean;
}

export interface RateLimitStore {
  incr(key: string): Promise<{ totalHits: number; resetTime?: Date }>;
  decrement(key: string): Promise<void>;
  resetKey(key: string): Promise<void>;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  totalHits: number;
}

// Redis-based rate limit store
class RedisRateLimitStore implements RateLimitStore {
  constructor(private windowMs: number) {}

  async incr(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
    const redis = getRedis();
    const windowSeconds = Math.ceil(this.windowMs / 1000);

    // Use Lua script for atomic operations
    const luaScript = `
      local key = KEYS[1]
      local window = tonumber(ARGV[1])
      local current = redis.call('INCR', key)
      
      if current == 1 then
        redis.call('EXPIRE', key, window)
      end
      
      local ttl = redis.call('TTL', key)
      return {current, ttl}
    `;

    try {
      const result = (await redis.eval(luaScript, 1, key, windowSeconds)) as [number, number];
      const [totalHits, ttl] = result;

      return {
        totalHits,
        resetTime: ttl > 0 ? new Date(Date.now() + ttl * 1000) : undefined,
      };
    } catch (error: CatchError) {
      logger.error('Redis rate limit incr failed', { error, key });
      throw new AppError('RATE_LIMIT_STORE_ERROR', 'Rate limit store error', 500);
    }
  }

  async decrement(key: string): Promise<void> {
    const redis = getRedis();
    try {
      await redis.decr(key);
    } catch (error: CatchError) {
      logger.error('Redis rate limit decrement failed', { error, key });
    }
  }

  async resetKey(key: string): Promise<void> {
    const redis = getRedis();
    try {
      await redis.del(key);
    } catch (error: CatchError) {
      logger.error('Redis rate limit reset failed', { error, key });
    }
  }
}

// Enhanced rate limiter factory
export function createEnhancedRateLimit(
  type?: string,
  customOptions?: Partial<EnhancedRateLimitOptions>
) {
  // Default configurations for different types
  const typeConfigs: Record<string, EnhancedRateLimitOptions> = {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      message: 'Too many login attempts, please try again later',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 attempts per hour
      message: 'Too many password reset attempts, please try again later',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    },
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
      message: 'Too many API requests, please try again later',
      skipSuccessfulRequests: false,
      skipFailedRequests: true,
    },
    default: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: 'Too many requests, please try again later',
    },
  };

  const baseConfig = typeConfigs[type || 'default'] || typeConfigs.default;
  const options: EnhancedRateLimitOptions = {
    ...baseConfig,
    ...customOptions,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisRateLimitStore(baseConfig.windowMs),
    keyGenerator: customOptions?.keyGenerator || defaultKeyGenerator,
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if skip function returns true
      if (options.skip && options.skip(req, res)) {
        return next();
      }

      const key = `rate_limit:${type || 'default'}:${options.keyGenerator!(req)}`;
      const store = options.store!;

      // Get current hit count and reset time
      const { totalHits, resetTime } = await store.incr(key);

      // Calculate rate limit info
      const rateLimitInfo: RateLimitInfo = {
        limit: options.max,
        remaining: Math.max(0, options.max - totalHits),
        reset: resetTime || new Date(Date.now() + options.windowMs),
        totalHits,
      };

      // Set rate limit headers
      if (options.standardHeaders !== false) {
        res.setHeader('RateLimit-Limit', rateLimitInfo.limit.toString());
        res.setHeader('RateLimit-Remaining', rateLimitInfo.remaining.toString());
        res.setHeader('RateLimit-Reset', rateLimitInfo.reset.toISOString());
      }

      if (options.legacyHeaders !== false) {
        res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit.toString());
        res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
        res.setHeader(
          'X-RateLimit-Reset',
          Math.ceil(rateLimitInfo.reset.getTime() / 1000).toString()
        );
      }

      // Check if rate limit exceeded
      if (totalHits > options.max) {
        const resetSeconds = Math.ceil((rateLimitInfo.reset.getTime() - Date.now()) / 1000);
        res.setHeader('Retry-After', resetSeconds.toString());

        // Call onLimitReached callback if provided
        if (options.onLimitReached) {
          options.onLimitReached(req, res);
        }

        logger.warn('Rate limit exceeded', {
          type,
          key,
          totalHits,
          limit: options.max,
          ip: req.ip,
          userId: (req as any).user?.id,
          userAgent: req.get('user-agent'),
          path: req.path,
        });

        return res.status(429).json({
          success: false,
          message: options.message,
          error: 'RATE_LIMIT_EXCEEDED',
          retryAfter: resetSeconds,
          limit: rateLimitInfo.limit,
          remaining: 0,
          reset: rateLimitInfo.reset.toISOString(),
        });
      }

      // Store original end function for skip handling
      if (options.skipSuccessfulRequests || options.skipFailedRequests) {
        const originalEnd = res.end.bind(res);

        res.end = function (chunk?: any, encoding?: any): Response<any, Record<string, any>> {
          const wasSuccessful = options.requestWasSuccessful
            ? options.requestWasSuccessful(req, res)
            : res.statusCode < 400;

          const shouldSkip =
            (options.skipSuccessfulRequests && wasSuccessful) ||
            (options.skipFailedRequests && !wasSuccessful);

          if (shouldSkip) {
            store.decrement(key).catch((err) => {
              logger.error('Failed to decrement rate limit counter', { error: err, key });
            });
          }

          return originalEnd(chunk, encoding);
        } as any;
      }

      next();
    } catch (error: CatchError) {
      logger.error('Enhanced rate limit middleware error', { error, type });
      // Continue on error to avoid blocking requests
      next();
    }
  };
}

// Default key generator
function defaultKeyGenerator(req: Request): string {
  // Use user ID if authenticated, otherwise use IP with additional fingerprinting
  const userId = (req as any).user?.id;
  if (userId) {
    return `user:${userId}`;
  }

  // For unauthenticated requests, create a more sophisticated key
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('user-agent') || '';

  // Create a hash of IP + User-Agent for better fingerprinting
  const fingerprint = crypto
    .createHash('sha256')
    .update(ip + userAgent)
    .digest('hex')
    .substring(0, 16);

  return `ip:${ip}:${fingerprint}`;
}

// Pre-configured rate limiters
export const userRateLimit = createEnhancedRateLimit('api', {
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => (req as any).user?.id || defaultKeyGenerator(req),
});

export const strictRateLimit = createEnhancedRateLimit('login', {
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

// Rate limit reset utility
export function createRateLimitReset(type: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!(req as any).user || (req as any).user.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Admin access required',
          error: 'INSUFFICIENT_PERMISSIONS',
        });
        return;
      }

      const { userId, ip } = req.body;

      if (!userId && !ip) {
        res.status(400).json({
          success: false,
          message: 'Either userId or ip must be provided',
          error: 'INVALID_REQUEST',
        });
        return;
      }

      const store = new RedisRateLimitStore(0); // windowMs doesn't matter for reset
      const key = userId ? `rate_limit:${type}:user:${userId}` : `rate_limit:${type}:ip:${ip}`;

      await store.resetKey(key);

      logger.info('Rate limit reset', {
        type,
        key,
        resetBy: (req as any).user.id,
        target: userId ? `user:${userId}` : `ip:${ip}`,
      });

      res.json({
        success: true,
        message: 'Rate limit reset successfully',
        data: {
          type,
          target: userId ? `user:${userId}` : `ip:${ip}`,
        },
      });
    } catch (error: CatchError) {
      logger.error('Rate limit reset error', { error, type });
      next(error);
    }
  };
}

export default createEnhancedRateLimit;
