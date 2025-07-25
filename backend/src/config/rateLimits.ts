import { RateLimiterOptions } from '@/middleware/rate-limiter';

import { env } from './env';

// Production rate limit configurations
export const rateLimitConfigs = {
  // Global API rate limit
  api: {
    windowMs: env.RATE_LIMIT_API_WINDOW * 1000, // Convert to milliseconds
    max: env.RATE_LIMIT_API_REQUESTS,
    message: 'Too many requests, please try again later.',
  } as RateLimiterOptions,

  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: env.NODE_ENV === 'production' ? 5 : 20,
    message: 'Too many authentication attempts, please try again later.',
    keyGenerator: (req) => `auth:${req.ip}`,
  } as RateLimiterOptions,

  // Media request endpoints
  mediaRequest: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: env.NODE_ENV === 'production' ? 20 : 100,
    message: 'Daily media request limit reached.',
    keyGenerator: (req) => `media-request:${req.user?.id || req.ip}`,
  } as RateLimiterOptions,

  // YouTube download endpoints
  youtubeDownload: {
    windowMs: env.RATE_LIMIT_YOUTUBE_WINDOW * 1000,
    max: env.RATE_LIMIT_YOUTUBE_REQUESTS,
    message: 'YouTube download rate limit exceeded. Please try again later.',
    keyGenerator: (req) => `youtube:${req.user?.id || req.ip}`,
  } as RateLimiterOptions,

  // Search endpoints
  search: {
    windowMs: 60 * 1000, // 1 minute
    max: env.NODE_ENV === 'production' ? 30 : 100,
    message: 'Too many search requests, please slow down.',
    keyGenerator: (req) => `search:${req.user?.id || req.ip}`,
  } as RateLimiterOptions,

  // WebSocket connections
  websocket: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: env.NODE_ENV === 'production' ? 5 : 20,
    message: 'Too many WebSocket connection attempts.',
    keyGenerator: (req) => `ws:${req.ip}`,
  } as RateLimiterOptions,

  // File upload endpoints
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: env.NODE_ENV === 'production' ? 10 : 50,
    message: 'Upload rate limit exceeded.',
    keyGenerator: (req) => `upload:${req.user?.id || req.ip}`,
  } as RateLimiterOptions,

  // Admin endpoints (more lenient)
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: env.NODE_ENV === 'production' ? 100 : 1000,
    message: 'Admin rate limit exceeded.',
    keyGenerator: (req) => `admin:${req.user?.id}`,
  } as RateLimiterOptions,

  // Health check endpoints (very lenient)
  health: {
    windowMs: 60 * 1000, // 1 minute
    max: 1000,
    message: 'Health check rate limit exceeded.',
    keyGenerator: (req) => `health:${req.ip}`,
  } as RateLimiterOptions,
};

// Tiered rate limits based on user role
export const getUserRateLimit = (userRole: string, endpoint: string): RateLimiterOptions => {
  const multipliers = {
    ADMIN: 10,
    PREMIUM: 5,
    USER: 1,
  };

  const baseConfig =
    rateLimitConfigs[endpoint as keyof typeof rateLimitConfigs] || rateLimitConfigs.api;
  const multiplier = multipliers[userRole as keyof typeof multipliers] || 1;

  return {
    ...baseConfig,
    max: baseConfig.max * multiplier,
  };
};

// IP-based blocking for severe abuse
export const blocklistConfig = {
  maxViolations: 10, // Number of rate limit violations before blocking
  blockDuration: 24 * 60 * 60 * 1000, // 24 hours
  cleanupInterval: 60 * 60 * 1000, // Check every hour
};

// Distributed rate limiting configuration for multiple instances
export const distributedRateLimitConfig = {
  // Use Redis for centralized rate limit tracking
  useRedis: true,

  // Sync interval for distributed counters
  syncInterval: 1000, // 1 second

  // Lua script for atomic increment with sliding window
  luaScript: `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    
    -- Clean old entries
    redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
    
    -- Count current entries
    local current = redis.call('ZCARD', key)
    
    if current < limit then
      -- Add new entry
      redis.call('ZADD', key, now, now)
      redis.call('EXPIRE', key, window)
      return {current + 1, limit - current - 1}
    else
      return {current, 0}
    end
  `,
};

// Export rate limit presets for common scenarios
export const rateLimitPresets = {
  strict: {
    windowMs: 60 * 1000,
    max: 10,
  },
  standard: {
    windowMs: 60 * 1000,
    max: 100,
  },
  lenient: {
    windowMs: 60 * 1000,
    max: 1000,
  },
  burst: {
    windowMs: 1000, // 1 second
    max: 10,
  },
};
