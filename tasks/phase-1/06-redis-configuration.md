# Task: Redis Configuration and Session Management

**Task ID:** PHASE1-06  
**Priority:** High  
**Estimated Time:** 2 hours  
**Dependencies:** PHASE1-03 (Backend Initialization)

## Objective
Configure Redis for session management, caching, rate limiting, and job queues in the MediaNest application.

## Acceptance Criteria
- [ ] Redis connection established and maintained
- [ ] Session storage implemented
- [ ] Rate limiting functionality working
- [ ] Caching layer operational
- [ ] Bull queue configuration complete
- [ ] Redis health checks implemented

## Detailed Steps

### 1. Create Redis Client Configuration
Create `backend/src/lib/redis/client.ts`:

```typescript
import Redis from 'ioredis'
import { config } from '@/config'
import { logger } from '@/utils/logger'

// Create Redis clients
export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times: number) => {
    if (times > 3) {
      logger.error('Redis connection failed after 3 retries')
      return null
    }
    const delay = Math.min(times * 100, 3000)
    logger.warn(`Retrying Redis connection in ${delay}ms...`)
    return delay
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY'
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true
    }
    return false
  },
})

// Duplicate client for blocking operations (Bull)
export const redisSubscriber = redis.duplicate()

// Event handlers
redis.on('connect', () => {
  logger.info('Redis client connected')
})

redis.on('ready', () => {
  logger.info('Redis client ready')
})

redis.on('error', (err) => {
  logger.error('Redis client error:', err)
})

redis.on('close', () => {
  logger.warn('Redis connection closed')
})

redis.on('reconnecting', (delay: number) => {
  logger.info(`Redis reconnecting in ${delay}ms`)
})

// Helper functions
export async function isRedisConnected(): Promise<boolean> {
  try {
    const result = await redis.ping()
    return result === 'PONG'
  } catch {
    return false
  }
}

export async function getRedisInfo() {
  try {
    const info = await redis.info()
    const lines = info.split('\r\n')
    const stats: Record<string, string> = {}
    
    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':')
        if (key && value) {
          stats[key] = value
        }
      }
    })
    
    return {
      version: stats.redis_version,
      uptime: parseInt(stats.uptime_in_seconds || '0'),
      connectedClients: parseInt(stats.connected_clients || '0'),
      usedMemory: stats.used_memory_human,
      role: stats.role,
    }
  } catch (error) {
    logger.error('Failed to get Redis info:', error)
    return null
  }
}
```

### 2. Create Session Store
Create `backend/src/lib/redis/session-store.ts`:

```typescript
import { redis } from './client'
import { nanoid } from 'nanoid'
import { logger } from '@/utils/logger'

export interface SessionData {
  userId: string
  role: 'user' | 'admin'
  plexId: string
  createdAt: Date
  lastAccessedAt: Date
  ipAddress?: string
  userAgent?: string
}

const SESSION_PREFIX = 'session:'
const SESSION_TTL = 24 * 60 * 60 // 24 hours in seconds

export class SessionStore {
  static async create(data: Omit<SessionData, 'createdAt' | 'lastAccessedAt'>): Promise<string> {
    const sessionId = nanoid(32)
    const sessionData: SessionData = {
      ...data,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    }

    try {
      await redis.setex(
        `${SESSION_PREFIX}${sessionId}`,
        SESSION_TTL,
        JSON.stringify(sessionData)
      )
      
      // Track active sessions per user
      await redis.sadd(`user:sessions:${data.userId}`, sessionId)
      await redis.expire(`user:sessions:${data.userId}`, SESSION_TTL)
      
      logger.info('Session created', { sessionId, userId: data.userId })
      return sessionId
    } catch (error) {
      logger.error('Failed to create session:', error)
      throw error
    }
  }

  static async get(sessionId: string): Promise<SessionData | null> {
    try {
      const data = await redis.get(`${SESSION_PREFIX}${sessionId}`)
      if (!data) return null

      const session = JSON.parse(data) as SessionData
      
      // Update last accessed time
      session.lastAccessedAt = new Date()
      await redis.setex(
        `${SESSION_PREFIX}${sessionId}`,
        SESSION_TTL,
        JSON.stringify(session)
      )

      return session
    } catch (error) {
      logger.error('Failed to get session:', error)
      return null
    }
  }

  static async destroy(sessionId: string): Promise<void> {
    try {
      const session = await this.get(sessionId)
      if (session) {
        await redis.srem(`user:sessions:${session.userId}`, sessionId)
      }
      await redis.del(`${SESSION_PREFIX}${sessionId}`)
      logger.info('Session destroyed', { sessionId })
    } catch (error) {
      logger.error('Failed to destroy session:', error)
    }
  }

  static async destroyAllUserSessions(userId: string): Promise<void> {
    try {
      const sessionIds = await redis.smembers(`user:sessions:${userId}`)
      
      if (sessionIds.length > 0) {
        const pipeline = redis.pipeline()
        sessionIds.forEach(id => {
          pipeline.del(`${SESSION_PREFIX}${id}`)
        })
        pipeline.del(`user:sessions:${userId}`)
        await pipeline.exec()
      }
      
      logger.info('All user sessions destroyed', { userId, count: sessionIds.length })
    } catch (error) {
      logger.error('Failed to destroy user sessions:', error)
    }
  }

  static async extend(sessionId: string): Promise<boolean> {
    try {
      const result = await redis.expire(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL)
      return result === 1
    } catch (error) {
      logger.error('Failed to extend session:', error)
      return false
    }
  }

  static async getActiveSessions(): Promise<number> {
    try {
      const keys = await redis.keys(`${SESSION_PREFIX}*`)
      return keys.length
    } catch (error) {
      logger.error('Failed to count active sessions:', error)
      return 0
    }
  }
}
```

### 3. Create Rate Limiter
Create `backend/src/lib/redis/rate-limiter.ts`:

```typescript
import { redis } from './client'
import { logger } from '@/utils/logger'

export interface RateLimitOptions {
  points: number // Number of requests
  duration: number // Time window in seconds
  blockDuration?: number // Block duration in seconds when limit exceeded
  keyPrefix?: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfter?: number
}

export class RateLimiter {
  private readonly keyPrefix: string
  private readonly points: number
  private readonly duration: number
  private readonly blockDuration: number

  constructor(options: RateLimitOptions) {
    this.keyPrefix = options.keyPrefix || 'rl'
    this.points = options.points
    this.duration = options.duration
    this.blockDuration = options.blockDuration || 0
  }

  async consume(key: string, points = 1): Promise<RateLimitResult> {
    const fullKey = `${this.keyPrefix}:${key}`
    const blockKey = `${fullKey}:blocked`
    
    try {
      // Check if blocked
      const blocked = await redis.get(blockKey)
      if (blocked) {
        const ttl = await redis.ttl(blockKey)
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + ttl * 1000),
          retryAfter: ttl,
        }
      }

      // Use Lua script for atomic operation
      const luaScript = `
        local key = KEYS[1]
        local points = tonumber(ARGV[1])
        local duration = tonumber(ARGV[2])
        local maxPoints = tonumber(ARGV[3])
        
        local current = redis.call('GET', key)
        if current == false then
          redis.call('SET', key, points)
          redis.call('EXPIRE', key, duration)
          return {maxPoints - points, duration}
        else
          local currentPoints = tonumber(current)
          if currentPoints + points > maxPoints then
            return {maxPoints - currentPoints, redis.call('TTL', key)}
          else
            redis.call('INCRBY', key, points)
            local ttl = redis.call('TTL', key)
            if ttl == -1 then
              redis.call('EXPIRE', key, duration)
              ttl = duration
            end
            return {maxPoints - currentPoints - points, ttl}
          end
        end
      `

      const result = await redis.eval(
        luaScript,
        1,
        fullKey,
        points,
        this.duration,
        this.points
      ) as [number, number]

      const [remaining, ttl] = result

      if (remaining < 0) {
        // Apply block if configured
        if (this.blockDuration > 0) {
          await redis.setex(blockKey, this.blockDuration, '1')
        }

        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + ttl * 1000),
          retryAfter: ttl,
        }
      }

      return {
        allowed: true,
        remaining,
        resetAt: new Date(Date.now() + ttl * 1000),
      }
    } catch (error) {
      logger.error('Rate limiter error:', error)
      // Fail open - allow request on error
      return {
        allowed: true,
        remaining: this.points,
        resetAt: new Date(Date.now() + this.duration * 1000),
      }
    }
  }

  async reset(key: string): Promise<void> {
    const fullKey = `${this.keyPrefix}:${key}`
    const blockKey = `${fullKey}:blocked`
    
    try {
      await redis.del(fullKey, blockKey)
    } catch (error) {
      logger.error('Failed to reset rate limit:', error)
    }
  }

  async getStatus(key: string): Promise<RateLimitResult> {
    const fullKey = `${this.keyPrefix}:${key}`
    const blockKey = `${fullKey}:blocked`
    
    try {
      // Check if blocked
      const blocked = await redis.get(blockKey)
      if (blocked) {
        const ttl = await redis.ttl(blockKey)
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + ttl * 1000),
          retryAfter: ttl,
        }
      }

      const current = await redis.get(fullKey)
      const ttl = await redis.ttl(fullKey)
      
      if (!current) {
        return {
          allowed: true,
          remaining: this.points,
          resetAt: new Date(Date.now() + this.duration * 1000),
        }
      }

      const used = parseInt(current, 10)
      const remaining = Math.max(0, this.points - used)

      return {
        allowed: remaining > 0,
        remaining,
        resetAt: new Date(Date.now() + ttl * 1000),
      }
    } catch (error) {
      logger.error('Failed to get rate limit status:', error)
      return {
        allowed: true,
        remaining: this.points,
        resetAt: new Date(Date.now() + this.duration * 1000),
      }
    }
  }
}

// Pre-configured rate limiters
export const rateLimiters = {
  api: new RateLimiter({
    points: 100,
    duration: 60, // 1 minute
    keyPrefix: 'rl:api',
  }),
  
  auth: new RateLimiter({
    points: 5,
    duration: 900, // 15 minutes
    blockDuration: 900, // Block for 15 minutes
    keyPrefix: 'rl:auth',
  }),
  
  youtube: new RateLimiter({
    points: 5,
    duration: 3600, // 1 hour
    keyPrefix: 'rl:youtube',
  }),
  
  mediaRequest: new RateLimiter({
    points: 20,
    duration: 3600, // 1 hour
    keyPrefix: 'rl:request',
  }),
}
```

### 4. Create Cache Manager
Create `backend/src/lib/redis/cache-manager.ts`:

```typescript
import { redis } from './client'
import { logger } from '@/utils/logger'

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  tags?: string[] // Cache tags for invalidation
}

export class CacheManager {
  private readonly defaultTTL = 300 // 5 minutes

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key)
      if (!data) return null
      
      return JSON.parse(data) as T
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error)
      return null
    }
  }

  async set(key: string, value: any, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || this.defaultTTL
      const data = JSON.stringify(value)
      
      if (ttl > 0) {
        await redis.setex(key, ttl, data)
      } else {
        await redis.set(key, data)
      }

      // Handle tags
      if (options?.tags && options.tags.length > 0) {
        const pipeline = redis.pipeline()
        for (const tag of options.tags) {
          pipeline.sadd(`tag:${tag}`, key)
          pipeline.expire(`tag:${tag}`, ttl)
        }
        await pipeline.exec()
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await redis.del(key)
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error)
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      logger.error(`Cache delete by pattern error for ${pattern}:`, error)
    }
  }

  async deleteByTag(tag: string): Promise<void> {
    try {
      const keys = await redis.smembers(`tag:${tag}`)
      if (keys.length > 0) {
        const pipeline = redis.pipeline()
        keys.forEach(key => pipeline.del(key))
        pipeline.del(`tag:${tag}`)
        await pipeline.exec()
      }
    } catch (error) {
      logger.error(`Cache delete by tag error for ${tag}:`, error)
    }
  }

  async flush(): Promise<void> {
    try {
      await redis.flushdb()
      logger.warn('Cache flushed')
    } catch (error) {
      logger.error('Cache flush error:', error)
    }
  }

  // Cache decorator for methods
  decorator(options?: CacheOptions) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value

      descriptor.value = async function (...args: any[]) {
        const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`
        
        // Try to get from cache
        const cached = await cache.get(cacheKey)
        if (cached) {
          logger.debug(`Cache hit for ${cacheKey}`)
          return cached
        }

        // Execute original method
        const result = await originalMethod.apply(this, args)
        
        // Store in cache
        await cache.set(cacheKey, result, options)
        
        return result
      }

      return descriptor
    }
  }
}

export const cache = new CacheManager()
```

### 5. Create Bull Queue Configuration
Create `backend/src/lib/redis/queues.ts`:

```typescript
import Bull from 'bull'
import { redis, redisSubscriber } from './client'
import { logger } from '@/utils/logger'

export interface QueueOptions {
  defaultJobOptions?: Bull.JobOptions
  limiter?: {
    max: number
    duration: number
  }
}

// Create queue factory
export function createQueue(name: string, options?: QueueOptions): Bull.Queue {
  const queue = new Bull(name, {
    createClient: (type) => {
      switch (type) {
        case 'client':
          return redis
        case 'subscriber':
          return redisSubscriber
        default:
          return redis.duplicate()
      }
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      ...options?.defaultJobOptions,
    },
    ...options,
  })

  // Event handlers
  queue.on('error', (error) => {
    logger.error(`Queue ${name} error:`, error)
  })

  queue.on('waiting', (jobId) => {
    logger.debug(`Job ${jobId} waiting in queue ${name}`)
  })

  queue.on('active', (job) => {
    logger.info(`Job ${job.id} active in queue ${name}`)
  })

  queue.on('completed', (job) => {
    logger.info(`Job ${job.id} completed in queue ${name}`)
  })

  queue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed in queue ${name}:`, err)
  })

  queue.on('stalled', (job) => {
    logger.warn(`Job ${job.id} stalled in queue ${name}`)
  })

  return queue
}

// Pre-configured queues
export const queues = {
  youtube: createQueue('youtube-downloads', {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
    limiter: {
      max: 3, // Max 3 concurrent downloads
      duration: 1000,
    },
  }),

  mediaRequests: createQueue('media-requests', {
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'fixed',
        delay: 3000,
      },
    },
  }),

  notifications: createQueue('notifications', {
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: 50,
    },
  }),
}

// Queue health check
export async function getQueueHealth() {
  const health: Record<string, any> = {}
  
  for (const [name, queue] of Object.entries(queues)) {
    try {
      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ])

      health[name] = {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
        healthy: true,
      }
    } catch (error) {
      health[name] = {
        healthy: false,
        error: error.message,
      }
    }
  }

  return health
}

// Graceful shutdown
export async function closeQueues() {
  logger.info('Closing all queues...')
  
  await Promise.all(
    Object.values(queues).map(queue => queue.close())
  )
  
  logger.info('All queues closed')
}
```

### 6. Create Redis Middleware
Create `backend/src/middleware/redis.ts`:

```typescript
import { Request, Response, NextFunction } from 'express'
import { SessionStore } from '@/lib/redis/session-store'
import { rateLimiters } from '@/lib/redis/rate-limiter'
import { logger } from '@/utils/logger'

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      session?: {
        id: string
        userId: string
        role: 'user' | 'admin'
        plexId: string
      }
      rateLimit?: {
        remaining: number
        resetAt: Date
      }
    }
  }
}

// Session middleware
export async function sessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const sessionId = req.cookies?.sessionId || req.headers['x-session-id']
  
  if (!sessionId) {
    return next()
  }

  try {
    const session = await SessionStore.get(sessionId as string)
    
    if (session) {
      req.session = {
        id: sessionId as string,
        userId: session.userId,
        role: session.role,
        plexId: session.plexId,
      }
      
      // Extend session TTL
      await SessionStore.extend(sessionId as string)
    }
  } catch (error) {
    logger.error('Session middleware error:', error)
  }

  next()
}

// Rate limiting middleware factory
export function rateLimitMiddleware(limiterName: keyof typeof rateLimiters) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const limiter = rateLimiters[limiterName]
    const key = req.session?.userId || req.ip || 'anonymous'
    
    try {
      const result = await limiter.consume(key)
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limiter['points'])
      res.setHeader('X-RateLimit-Remaining', result.remaining)
      res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString())
      
      req.rateLimit = {
        remaining: result.remaining,
        resetAt: result.resetAt,
      }
      
      if (!result.allowed) {
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter)
        }
        
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            retryAfter: result.retryAfter,
            resetAt: result.resetAt,
          },
        })
      }
      
      next()
    } catch (error) {
      logger.error('Rate limit middleware error:', error)
      // Fail open - allow request on error
      next()
    }
  }
}
```

### 7. Update Main Application
Update `backend/src/index.ts` to include Redis middleware:

```typescript
import { sessionMiddleware } from './middleware/redis'
import { redis } from './lib/redis/client'
import { closeQueues } from './lib/redis/queues'

// Add session middleware before routes
app.use(sessionMiddleware)

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully')
  
  // Close Redis connections
  await redis.quit()
  await closeQueues()
  
  process.exit(0)
})
```

## Verification Steps
1. Start Redis container: `docker-compose up -d redis`
2. Run backend: `npm run dev`
3. Check Redis connection in logs
4. Test session creation via API
5. Verify rate limiting with multiple requests
6. Check cache operations
7. Monitor Bull queues with Bull Dashboard (optional)

## Testing Requirements
- [ ] Unit tests for Redis client connection and retry logic
- [ ] Unit tests for SessionStore (create, get, destroy, extend)
- [ ] Unit tests for RateLimiter with various scenarios
- [ ] Unit tests for CacheManager operations
- [ ] Unit tests for Queue configuration and error handling
- [ ] Integration tests for session persistence
- [ ] Integration tests for rate limiting across requests
- [ ] Integration tests for cache invalidation by tags
- [ ] Test Redis failover behavior
- [ ] Performance tests for concurrent operations
- [ ] Test Lua script execution for atomic operations
- [ ] Test coverage should exceed 80% for all Redis modules
- [ ] All tests must pass before marking task complete

## Common Issues & Solutions
- **Connection refused**: Ensure Redis container is running
- **Memory issues**: Configure Redis max memory policy
- **Session not persisting**: Check cookie settings
- **Rate limit not working**: Verify Lua script execution

## Notes
- Redis is configured with AOF persistence in Docker
- Session TTL is 24 hours by default
- Rate limits are per-user when authenticated
- Cache keys should follow naming convention

## Related Documentation
- [Redis Documentation](https://redis.io/documentation)
- [ioredis Documentation](https://github.com/luin/ioredis)
- [Bull Documentation](https://github.com/OptimalBits/bull)