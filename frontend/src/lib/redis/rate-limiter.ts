import { getRedisClient } from './redis-client';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  keyPrefix?: string; // Custom key prefix
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until next allowed request
}

// Default rate limit configurations
export const RATE_LIMITS = {
  // General API rate limit: 100 requests per minute
  API: {
    windowMs: 60 * 1000,
    max: 100,
    keyPrefix: 'rate:api:',
  },
  // YouTube download rate limit: 5 downloads per hour
  YOUTUBE_DOWNLOAD: {
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyPrefix: 'rate:youtube:',
  },
  // Auth attempts: 5 per 15 minutes
  AUTH: {
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyPrefix: 'rate:auth:',
  },
  // Media requests: 20 per hour
  MEDIA_REQUEST: {
    windowMs: 60 * 60 * 1000,
    max: 20,
    keyPrefix: 'rate:media:',
  },
};

/**
 * Check rate limit for a given key
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const key = `${config.keyPrefix || 'rate:'}${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Use Lua script for atomic operation
    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local window_start = tonumber(ARGV[2])
      local max_requests = tonumber(ARGV[3])
      local window_ms = tonumber(ARGV[4])
      
      -- Remove old entries
      redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
      
      -- Count current requests in window
      local current_requests = redis.call('ZCARD', key)
      
      if current_requests < max_requests then
        -- Add new request
        redis.call('ZADD', key, now, now)
        redis.call('EXPIRE', key, window_ms / 1000)
        
        return {1, max_requests - current_requests - 1, 0}
      else
        -- Get oldest request time
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local reset_time = oldest[2] and (oldest[2] + window_ms) or (now + window_ms)
        
        return {0, 0, reset_time}
      end
    `;

    const result = (await redis.eval(
      luaScript,
      1,
      key,
      now.toString(),
      windowStart.toString(),
      config.max.toString(),
      config.windowMs.toString()
    )) as [number, number, number];

    const [allowed, remaining, resetTime] = result;
    const resetAt = new Date(resetTime);

    const rateLimitResult: RateLimitResult = {
      allowed: allowed === 1,
      remaining,
      resetAt,
    };

    if (!rateLimitResult.allowed) {
      rateLimitResult.retryAfter = Math.ceil((resetTime - now) / 1000);
    }

    return rateLimitResult;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // On error, allow the request but log it
    return {
      allowed: true,
      remaining: 0,
      resetAt: new Date(now + config.windowMs),
    };
  }
}

/**
 * Reset rate limit for a given key
 */
export async function resetRateLimit(
  identifier: string,
  keyPrefix?: string
): Promise<void> {
  const redis = getRedisClient();
  const key = `${keyPrefix || 'rate:'}${identifier}`;

  try {
    await redis.del(key);
  } catch (error) {
    console.error('Failed to reset rate limit:', error);
  }
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const key = `${config.keyPrefix || 'rate:'}${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Remove old entries
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests
    const currentRequests = await redis.zcard(key);
    const remaining = Math.max(0, config.max - currentRequests);

    // Get reset time
    const oldestEntry = await redis.zrange(key, 0, 0, 'WITHSCORES');
    let resetAt: Date;

    if (oldestEntry.length >= 2) {
      const oldestTime = parseInt(oldestEntry[1]);
      resetAt = new Date(oldestTime + config.windowMs);
    } else {
      resetAt = new Date(now + config.windowMs);
    }

    return {
      allowed: remaining > 0,
      remaining,
      resetAt,
      retryAfter:
        remaining === 0
          ? Math.ceil((resetAt.getTime() - now) / 1000)
          : undefined,
    };
  } catch (error) {
    console.error('Failed to get rate limit status:', error);
    return {
      allowed: true,
      remaining: config.max,
      resetAt: new Date(now + config.windowMs),
    };
  }
}

/**
 * Middleware-style rate limiter for Next.js API routes
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async function rateLimitMiddleware(
    identifier: string
  ): Promise<RateLimitResult> {
    return checkRateLimit(identifier, config);
  };
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.allowed ? '100' : '0',
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
  };

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}
