# Task: Rate Limiting Implementation

**Task ID:** PHASE1-09  
**Priority:** High  
**Estimated Time:** 2 hours  
**Dependencies:** PHASE1-06 (Redis Configuration), PHASE1-08 (JWT Middleware)

## Objective
Implement comprehensive rate limiting across all API endpoints to prevent abuse and ensure fair usage of the MediaNest platform.

## Acceptance Criteria
- [ ] Rate limiting applied to all endpoints
- [ ] Different limits for authenticated vs anonymous users
- [ ] Specific limits for sensitive operations
- [ ] Rate limit headers in responses
- [ ] Graceful handling of rate limit violations
- [ ] Admin bypass for rate limits

## Detailed Steps

### 1. Create Rate Limiting Configuration
Create `backend/src/config/rate-limits.ts`:

```typescript
export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  blockDurationMs?: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

export const rateLimitConfigs = {
  // Global API rate limit
  global: {
    anonymous: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30,
    },
    authenticated: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
    },
  },

  // Auth endpoints
  auth: {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
      blockDurationMs: 15 * 60 * 1000, // Block for 15 minutes after limit
    },
    pinCreation: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 3,
    },
    tokenRefresh: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
    },
  },

  // Media requests
  media: {
    search: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30,
    },
    request: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 20,
    },
  },

  // YouTube downloads
  youtube: {
    download: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5,
    },
    status: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60, // 1 per second average
    },
  },

  // Admin operations
  admin: {
    userManagement: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 50,
    },
    systemConfig: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20,
    },
  },
}
```

### 2. Create Enhanced Rate Limiter Middleware
Create `backend/src/middleware/rate-limiter.ts`:

```typescript
import { Request, Response, NextFunction } from 'express'
import { RateLimiter } from '@/lib/redis/rate-limiter'
import { rateLimitConfigs, RateLimitConfig } from '@/config/rate-limits'
import { logger } from '@/utils/logger'

interface RateLimitOptions {
  config: RateLimitConfig
  keyGenerator?: (req: Request) => string
  skipAuth?: boolean
  skipAdmin?: boolean
  onLimitReached?: (req: Request, res: Response) => void
}

/**
 * Create rate limit middleware with specific configuration
 */
export function createRateLimiter(
  name: string,
  options: RateLimitOptions
) {
  const limiter = new RateLimiter({
    points: options.config.maxRequests,
    duration: Math.floor(options.config.windowMs / 1000), // Convert to seconds
    blockDuration: options.config.blockDurationMs ? 
      Math.floor(options.config.blockDurationMs / 1000) : 0,
    keyPrefix: `rl:${name}`,
  })

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip rate limiting for admins if configured
      if (options.skipAdmin && req.user?.role === 'admin') {
        return next()
      }

      // Generate rate limit key
      const key = options.keyGenerator ? 
        options.keyGenerator(req) : 
        req.user?.id || req.ip || 'anonymous'

      // Consume rate limit
      const result = await limiter.consume(key)

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', options.config.maxRequests)
      res.setHeader('X-RateLimit-Remaining', result.remaining)
      res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString())
      res.setHeader('X-RateLimit-Reset-After', Math.ceil(
        (result.resetAt.getTime() - Date.now()) / 1000
      ))

      if (!result.allowed) {
        // Log rate limit violation
        logger.warn('Rate limit exceeded', {
          name,
          key,
          ip: req.ip,
          userId: req.user?.id,
          path: req.path,
          retryAfter: result.retryAfter,
        })

        // Custom handler or default response
        if (options.onLimitReached) {
          return options.onLimitReached(req, res)
        }

        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter)
        }

        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            retryAfter: result.retryAfter,
            resetAt: result.resetAt,
          },
        })
      }

      // Add rate limit info to request
      req.rateLimit = {
        remaining: result.remaining,
        resetAt: result.resetAt,
      }

      next()
    } catch (error) {
      logger.error('Rate limiter error:', error)
      // Fail open - allow request on error
      next()
    }
  }
}

/**
 * Global rate limiter that checks authentication status
 */
export const globalRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const config = req.user ? 
    rateLimitConfigs.global.authenticated : 
    rateLimitConfigs.global.anonymous

  const limiter = createRateLimiter('global', {
    config,
    skipAdmin: true,
  })

  return limiter(req, res, next)
}

/**
 * Auth endpoints rate limiters
 */
export const authRateLimiters = {
  login: createRateLimiter('auth:login', {
    config: rateLimitConfigs.auth.login,
    keyGenerator: (req) => req.body.username || req.ip || 'anonymous',
    onLimitReached: (req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_LOGIN_ATTEMPTS',
          message: 'Too many login attempts. Please try again later.',
          retryAfter: rateLimitConfigs.auth.login.blockDurationMs / 1000,
        },
      })
    },
  }),

  pinCreation: createRateLimiter('auth:pin', {
    config: rateLimitConfigs.auth.pinCreation,
  }),

  tokenRefresh: createRateLimiter('auth:refresh', {
    config: rateLimitConfigs.auth.tokenRefresh,
  }),
}

/**
 * Media endpoints rate limiters
 */
export const mediaRateLimiters = {
  search: createRateLimiter('media:search', {
    config: rateLimitConfigs.media.search,
    skipAdmin: true,
  }),

  request: createRateLimiter('media:request', {
    config: rateLimitConfigs.media.request,
    skipAdmin: true,
  }),
}

/**
 * YouTube endpoints rate limiters
 */
export const youtubeRateLimiters = {
  download: createRateLimiter('youtube:download', {
    config: rateLimitConfigs.youtube.download,
    onLimitReached: (req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'DOWNLOAD_LIMIT_EXCEEDED',
          message: 'Download limit reached. You can download up to 5 playlists per hour.',
          retryAfter: 3600,
        },
      })
    },
  }),

  status: createRateLimiter('youtube:status', {
    config: rateLimitConfigs.youtube.status,
  }),
}

/**
 * Admin endpoints rate limiters
 */
export const adminRateLimiters = {
  userManagement: createRateLimiter('admin:users', {
    config: rateLimitConfigs.admin.userManagement,
  }),

  systemConfig: createRateLimiter('admin:config', {
    config: rateLimitConfigs.admin.systemConfig,
  }),
}

/**
 * Create custom rate limiter from database config
 */
export async function createDynamicRateLimiter(
  name: string,
  configKey: string
) {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: configKey },
    })

    if (!config) {
      throw new Error(`Rate limit config not found: ${configKey}`)
    }

    const { limit, window } = config.value as any

    return createRateLimiter(name, {
      config: {
        windowMs: window * 1000,
        maxRequests: limit,
      },
    })
  } catch (error) {
    logger.error('Failed to create dynamic rate limiter:', error)
    // Return a default limiter
    return createRateLimiter(name, {
      config: {
        windowMs: 60 * 1000,
        maxRequests: 100,
      },
    })
  }
}
```

### 3. Create Rate Limit Status Endpoint
Create `backend/src/controllers/rate-limit.controller.ts`:

```typescript
import { Request, Response } from 'express'
import { RateLimiter } from '@/lib/redis/rate-limiter'
import { logger } from '@/utils/logger'

export class RateLimitController {
  /**
   * GET /api/rate-limits/status
   * Get current rate limit status for the user
   */
  async getStatus(req: Request, res: Response) {
    try {
      const userId = req.user?.id || req.ip || 'anonymous'
      
      // Get status for various limiters
      const limiters = [
        { name: 'global', prefix: 'rl:global' },
        { name: 'media:search', prefix: 'rl:media:search' },
        { name: 'media:request', prefix: 'rl:media:request' },
        { name: 'youtube:download', prefix: 'rl:youtube:download' },
      ]

      const statuses = await Promise.all(
        limiters.map(async ({ name, prefix }) => {
          const limiter = new RateLimiter({
            points: 100, // Default, actual value doesn't matter for status check
            duration: 60,
            keyPrefix: prefix,
          })

          const status = await limiter.getStatus(userId)
          return {
            name,
            ...status,
          }
        })
      )

      res.json({
        success: true,
        data: {
          userId,
          limits: statuses,
        },
      })
    } catch (error) {
      logger.error('Get rate limit status error:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'STATUS_ERROR',
          message: 'Failed to get rate limit status',
        },
      })
    }
  }

  /**
   * DELETE /api/rate-limits/:key
   * Reset rate limit for a specific key (admin only)
   */
  async resetLimit(req: Request, res: Response) {
    try {
      const { key } = req.params
      const { userId } = req.body

      const limiter = new RateLimiter({
        points: 100,
        duration: 60,
        keyPrefix: `rl:${key}`,
      })

      await limiter.reset(userId)

      logger.info('Rate limit reset', {
        key,
        userId,
        resetBy: req.user?.id,
      })

      res.json({
        success: true,
        data: {
          message: 'Rate limit reset successfully',
        },
      })
    } catch (error) {
      logger.error('Reset rate limit error:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'RESET_ERROR',
          message: 'Failed to reset rate limit',
        },
      })
    }
  }
}

export const rateLimitController = new RateLimitController()
```

### 4. Update Route Files with Rate Limiting
Update `backend/src/routes/auth.ts`:

```typescript
import { authRateLimiters } from '@/middleware/rate-limiter'

// Apply rate limiting to auth endpoints
router.post('/plex/pin', authRateLimiters.pinCreation, authController.createPlexPin)
router.post('/plex/check', authController.checkPlexPin)
router.post('/admin', authRateLimiters.login, authController.adminLogin)
router.post('/refresh', authRateLimiters.tokenRefresh, validateRefreshToken, authController.refreshToken)
```

Create `backend/src/routes/media.ts`:

```typescript
import { Router } from 'express'
import { authenticate } from '@/middleware/auth'
import { mediaRateLimiters } from '@/middleware/rate-limiter'
import { mediaController } from '@/controllers/media.controller'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Search endpoints
router.get('/search', mediaRateLimiters.search, mediaController.search)
router.get('/trending', mediaRateLimiters.search, mediaController.getTrending)

// Request endpoints
router.post('/request', mediaRateLimiters.request, mediaController.createRequest)
router.get('/requests', mediaController.getMyRequests)
router.get('/requests/:id', mediaController.getRequest)

export default router
```

### 5. Update Main Application
Update `backend/src/index.ts`:

```typescript
import { globalRateLimiter } from './middleware/rate-limiter'
import rateLimitRouter from './routes/rate-limit'

// Apply global rate limiting before other middleware
app.use(globalRateLimiter)

// ... other middleware ...

// Rate limit status endpoint (authenticated)
app.use('/api/rate-limits', authenticate, rateLimitRouter)
```

### 6. Create Rate Limit Monitoring
Create `backend/src/utils/rate-limit-monitor.ts`:

```typescript
import { redis } from '@/lib/redis/client'
import { logger } from './logger'
import { prisma } from './database'

export class RateLimitMonitor {
  /**
   * Log rate limit violations
   */
  static async logViolation(
    userId: string | null,
    endpoint: string,
    ip: string
  ) {
    try {
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'rate_limit_exceeded',
          entityType: 'endpoint',
          entityId: endpoint,
          ipAddress: ip,
          metadata: {
            endpoint,
            timestamp: new Date().toISOString(),
          },
        },
      })
    } catch (error) {
      logger.error('Failed to log rate limit violation:', error)
    }
  }

  /**
   * Get rate limit statistics
   */
  static async getStatistics(timeWindow: number = 3600) {
    try {
      const cutoff = new Date(Date.now() - timeWindow * 1000)
      
      const violations = await prisma.activityLog.count({
        where: {
          action: 'rate_limit_exceeded',
          createdAt: { gte: cutoff },
        },
      })

      const violationsByEndpoint = await prisma.activityLog.groupBy({
        by: ['entityId'],
        where: {
          action: 'rate_limit_exceeded',
          createdAt: { gte: cutoff },
        },
        _count: true,
      })

      const violationsByUser = await prisma.activityLog.groupBy({
        by: ['userId'],
        where: {
          action: 'rate_limit_exceeded',
          createdAt: { gte: cutoff },
          userId: { not: null },
        },
        _count: true,
      })

      return {
        totalViolations: violations,
        byEndpoint: violationsByEndpoint,
        byUser: violationsByUser,
        timeWindow,
      }
    } catch (error) {
      logger.error('Failed to get rate limit statistics:', error)
      return null
    }
  }

  /**
   * Alert on suspicious activity
   */
  static async checkSuspiciousActivity(userId: string) {
    try {
      const recentViolations = await prisma.activityLog.count({
        where: {
          userId,
          action: 'rate_limit_exceeded',
          createdAt: { gte: new Date(Date.now() - 3600 * 1000) }, // Last hour
        },
      })

      if (recentViolations > 10) {
        logger.warn('Suspicious rate limit activity detected', {
          userId,
          violations: recentViolations,
        })

        // Could trigger additional security measures here
        // e.g., temporary account suspension, email notification, etc.
      }
    } catch (error) {
      logger.error('Failed to check suspicious activity:', error)
    }
  }
}
```

### 7. Create Frontend Rate Limit Handler
Create `frontend/src/utils/rate-limit-handler.ts`:

```typescript
interface RateLimitInfo {
  limit: number
  remaining: number
  resetAt: Date
  retryAfter?: number
}

export class RateLimitHandler {
  private static limits: Map<string, RateLimitInfo> = new Map()

  /**
   * Update rate limit info from response headers
   */
  static updateFromHeaders(endpoint: string, headers: any) {
    const limit = parseInt(headers['x-ratelimit-limit'] || '0')
    const remaining = parseInt(headers['x-ratelimit-remaining'] || '0')
    const resetAt = headers['x-ratelimit-reset'] ? 
      new Date(headers['x-ratelimit-reset']) : null

    if (limit && resetAt) {
      this.limits.set(endpoint, {
        limit,
        remaining,
        resetAt,
      })
    }
  }

  /**
   * Get rate limit info for endpoint
   */
  static getLimit(endpoint: string): RateLimitInfo | null {
    return this.limits.get(endpoint) || null
  }

  /**
   * Check if endpoint is rate limited
   */
  static isLimited(endpoint: string): boolean {
    const info = this.getLimit(endpoint)
    return info ? info.remaining === 0 : false
  }

  /**
   * Get time until reset
   */
  static getResetTime(endpoint: string): number {
    const info = this.getLimit(endpoint)
    if (!info) return 0

    const now = Date.now()
    const resetTime = info.resetAt.getTime()
    return Math.max(0, Math.ceil((resetTime - now) / 1000))
  }

  /**
   * Format rate limit message
   */
  static formatMessage(endpoint: string): string {
    const info = this.getLimit(endpoint)
    if (!info) return ''

    if (info.remaining === 0) {
      const resetIn = this.getResetTime(endpoint)
      return `Rate limit exceeded. Try again in ${resetIn} seconds.`
    }

    return `${info.remaining} requests remaining.`
  }
}
```

### 8. Create Rate Limit Dashboard Component
Create `frontend/src/components/rate-limit-status.tsx`:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'

interface RateLimitStatus {
  name: string
  allowed: boolean
  remaining: number
  resetAt: string
}

export function RateLimitStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['rateLimits'],
    queryFn: async () => {
      const response = await apiClient.get('/api/rate-limits/status')
      return response.data.data
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  if (isLoading || !data) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-3">API Rate Limits</h3>
      <div className="space-y-2">
        {data.limits.map((limit: RateLimitStatus) => (
          <div key={limit.name} className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {limit.name}
            </span>
            <div className="flex items-center space-x-2">
              <span className={`text-sm ${
                limit.remaining === 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {limit.remaining} remaining
              </span>
              {limit.remaining === 0 && (
                <span className="text-xs text-gray-500">
                  Resets {formatDistanceToNow(new Date(limit.resetAt), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Verification Steps
1. Make multiple requests to test rate limiting
2. Verify rate limit headers in responses
3. Test hitting rate limits - should get 429 response
4. Test authenticated vs anonymous limits
5. Test admin bypass functionality
6. Check rate limit reset after time window
7. Test custom error messages for specific endpoints

## Testing Requirements
- [ ] Unit tests for rate limit middleware
- [ ] Unit tests for rate limit store operations
- [ ] Integration tests for rate limiting across endpoints
- [ ] Test authenticated vs anonymous rate limits
- [ ] Test admin bypass functionality
- [ ] Test rate limit headers in responses
- [ ] Test 429 response format and retry-after header
- [ ] Test rate limit reset after time window
- [ ] Test concurrent request handling
- [ ] Performance tests under high load
- [ ] Test Redis failure fallback behavior
- [ ] Test custom rate limits for specific endpoints
- [ ] Test coverage should exceed 80% for rate limiting module
- [ ] All tests must pass before marking task complete

## Common Issues & Solutions
- **Redis connection errors**: Ensure Redis is running
- **Headers not showing**: Check middleware order
- **Limits not working**: Verify Redis key format
- **Admin still limited**: Check skip conditions

## Notes
- Rate limits are per-user when authenticated
- Anonymous users share limits by IP
- Admins bypass most rate limits
- Critical endpoints have stricter limits

## Related Documentation
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
- [Redis Documentation](https://redis.io/documentation)
- [API Security Guide](/docs/SECURITY_ARCHITECTURE_STRATEGY.md)