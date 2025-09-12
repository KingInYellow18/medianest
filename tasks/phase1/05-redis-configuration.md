# Task: Redis Configuration and Connection Setup

**Priority:** Critical  
**Estimated Duration:** 1 day  
**Dependencies:** 04-database-schema-setup  
**Phase:** 1 (Week 3)

## Objective

Set up Redis connection with connection pooling, implement session storage with proper TTL, create rate limiting data structures, configure BullMQ for job queuing, and implement cache invalidation strategies.

## Background

Redis serves multiple critical functions: session management, rate limiting, caching, and job queue backing. Proper configuration ensures performance and reliability.

## Detailed Requirements

### 1. Redis Connection Setup

- Connection pooling with ioredis
- Cluster support ready
- Error handling and reconnection
- Health check implementation

### 2. Session Storage

- JWT session data caching
- 24-hour TTL for standard sessions
- 90-day TTL for "remember me"
- Session invalidation support

### 3. Rate Limiting

- Atomic operations with Lua scripts
- Per-user rate limiting
- Endpoint-specific limits
- YouTube download rate limits

### 4. Cache Strategy

- Service status caching
- API response caching
- Cache invalidation patterns
- TTL management

### 5. Job Queue Setup

- BullMQ configuration
- Queue monitoring
- Failed job handling
- Progress tracking

## Technical Implementation Details

### Redis Client Configuration

```typescript
// backend/src/lib/redis/client.ts
import Redis from 'ioredis';
import { config } from '@/config';

// Create Redis client with retry strategy
export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true;
    }
    return false;
  },
  enableReadyCheck: true,
  lazyConnect: true,
});

// Error handling
redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('ready', () => {
  console.log('Redis ready to accept commands');
});

// Graceful shutdown
export async function closeRedis() {
  await redis.quit();
}

// Health check
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    return false;
  }
}
```

### Session Management Service

```typescript
// backend/src/services/sessionService.ts
import { redis } from '@/lib/redis/client';
import crypto from 'crypto';

export interface SessionData {
  userId: string;
  role: string;
  email?: string;
  plexId: string;
  createdAt: number;
  rememberMe?: boolean;
}

export class SessionService {
  private readonly SESSION_PREFIX = 'session:';
  private readonly REMEMBER_PREFIX = 'remember:';
  private readonly STANDARD_TTL = 24 * 60 * 60; // 24 hours
  private readonly REMEMBER_TTL = 90 * 24 * 60 * 60; // 90 days

  async createSession(data: SessionData): Promise<string> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    const ttl = data.rememberMe ? this.REMEMBER_TTL : this.STANDARD_TTL;

    await redis.setex(
      key,
      ttl,
      JSON.stringify({
        ...data,
        createdAt: Date.now(),
      }),
    );

    // Store user's active sessions for invalidation
    await redis.sadd(`user:sessions:${data.userId}`, sessionId);
    await redis.expire(`user:sessions:${data.userId}`, ttl);

    return sessionId;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as SessionData;
    } catch {
      return null;
    }
  }

  async extendSession(sessionId: string): Promise<boolean> {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    const session = await this.getSession(sessionId);

    if (!session) {
      return false;
    }

    const ttl = session.rememberMe ? this.REMEMBER_TTL : this.STANDARD_TTL;
    const result = await redis.expire(key, ttl);

    return result === 1;
  }

  async invalidateSession(sessionId: string): Promise<void> {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    const session = await this.getSession(sessionId);

    if (session) {
      await redis.del(key);
      await redis.srem(`user:sessions:${session.userId}`, sessionId);
    }
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await redis.smembers(`user:sessions:${userId}`);

    if (sessionIds.length > 0) {
      const keys = sessionIds.map((id) => `${this.SESSION_PREFIX}${id}`);
      await redis.del(...keys);
      await redis.del(`user:sessions:${userId}`);
    }
  }
}
```

### Rate Limiting with Lua Scripts

```typescript
// backend/src/lib/redis/rateLimiter.ts
import { redis } from './client';

// Lua script for atomic rate limit check and increment
const rateLimitScript = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current_time = tonumber(ARGV[3])

-- Get current count
local current = redis.call('GET', key)
if current == false then
  current = 0
else
  current = tonumber(current)
end

-- Check if limit exceeded
if current >= limit then
  local ttl = redis.call('TTL', key)
  if ttl == -1 then
    -- Key exists but no TTL, set it
    redis.call('EXPIRE', key, window)
  end
  return {1, current, ttl} -- Limited, return current count and TTL
end

-- Increment counter
current = redis.call('INCR', key)
if current == 1 then
  -- First request in window, set expiry
  redis.call('EXPIRE', key, window)
end

return {0, current, window} -- Not limited, return current count
`;

export interface RateLimitOptions {
  limit: number;
  window: number; // in seconds
}

export class RateLimiter {
  private scriptSha?: string;

  async initialize() {
    // Load script to Redis for better performance
    this.scriptSha = await redis.script('LOAD', rateLimitScript);
  }

  async checkLimit(
    userId: string,
    resource: string,
    options: RateLimitOptions,
  ): Promise<{ limited: boolean; current: number; resetIn: number }> {
    const key = `rate:${resource}:${userId}`;
    const currentTime = Date.now();

    try {
      let result;
      if (this.scriptSha) {
        try {
          result = await redis.evalsha(
            this.scriptSha,
            1,
            key,
            options.limit,
            options.window,
            currentTime,
          );
        } catch (error: any) {
          if (error.message.includes('NOSCRIPT')) {
            // Script not in cache, reload it
            await this.initialize();
            result = await redis.evalsha(
              this.scriptSha!,
              1,
              key,
              options.limit,
              options.window,
              currentTime,
            );
          } else {
            throw error;
          }
        }
      } else {
        // Fallback to direct eval
        result = await redis.eval(
          rateLimitScript,
          1,
          key,
          options.limit,
          options.window,
          currentTime,
        );
      }

      const [limited, current, resetIn] = result as [number, number, number];

      return {
        limited: limited === 1,
        current,
        resetIn,
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // On error, allow the request
      return { limited: false, current: 0, resetIn: 0 };
    }
  }

  // Specific rate limiters
  async checkApiLimit(
    userId: string,
  ): Promise<{ limited: boolean; current: number; resetIn: number }> {
    return this.checkLimit(userId, 'api', {
      limit: 100,
      window: 60, // 100 requests per minute
    });
  }

  async checkYouTubeLimit(
    userId: string,
  ): Promise<{ limited: boolean; current: number; resetIn: number }> {
    return this.checkLimit(userId, 'youtube', {
      limit: 5,
      window: 3600, // 5 downloads per hour
    });
  }

  async checkMediaRequestLimit(
    userId: string,
  ): Promise<{ limited: boolean; current: number; resetIn: number }> {
    return this.checkLimit(userId, 'media-request', {
      limit: 20,
      window: 3600, // 20 requests per hour
    });
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
```

### Cache Service

```typescript
// backend/src/services/cacheService.ts
import { redis } from '@/lib/redis/client';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
}

export class CacheService {
  private readonly DEFAULT_TTL = 300; // 5 minutes

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || this.DEFAULT_TTL;

    try {
      if (options.tags && options.tags.length > 0) {
        // Store key in tag sets for bulk invalidation
        const pipeline = redis.pipeline();

        for (const tag of options.tags) {
          pipeline.sadd(`tag:${tag}`, key);
          pipeline.expire(`tag:${tag}`, ttl + 60); // Tag expires slightly after cache
        }

        pipeline.setex(key, ttl, JSON.stringify(value));
        await pipeline.exec();
      } else {
        await redis.setex(key, ttl, JSON.stringify(value));
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async invalidate(key: string): Promise<void> {
    await redis.del(key);
  }

  async invalidateByTag(tag: string): Promise<void> {
    const keys = await redis.smembers(`tag:${tag}`);
    if (keys.length > 0) {
      await redis.del(...keys);
      await redis.del(`tag:${tag}`);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  // Service-specific cache methods
  async cacheServiceStatus(serviceName: string, status: any): Promise<void> {
    await this.set(`service:status:${serviceName}`, status, { ttl: 60, tags: ['service-status'] });
  }

  async getServiceStatus(serviceName: string): Promise<any> {
    return this.get(`service:status:${serviceName}`);
  }

  async cacheApiResponse(endpoint: string, params: any, response: any): Promise<void> {
    const key = `api:${endpoint}:${JSON.stringify(params)}`;
    await this.set(key, response, { ttl: 300, tags: ['api-response', endpoint] });
  }
}

export const cacheService = new CacheService();
```

### BullMQ Configuration

```typescript
// backend/src/lib/queue/config.ts
import { Queue, Worker, QueueEvents } from 'bullmq';
import { redis } from '@/lib/redis/client';

// Queue configuration
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: {
    age: 3600, // 1 hour
    count: 100, // Keep last 100 completed jobs
  },
  removeOnFail: {
    age: 24 * 3600, // 24 hours
  },
};

// Create queues
export const youtubeQueue = new Queue('youtube-downloads', {
  connection: redis,
  defaultJobOptions,
});

export const mediaRequestQueue = new Queue('media-requests', {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 5,
  },
});

export const notificationQueue = new Queue('notifications', {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 1,
  },
});

// Queue events for monitoring
export const youtubeQueueEvents = new QueueEvents('youtube-downloads', {
  connection: redis,
});

// Queue monitoring
export async function getQueueMetrics(queueName: string) {
  const queue = queueName === 'youtube-downloads' ? youtubeQueue : mediaRequestQueue;

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

// Graceful shutdown
export async function closeQueues() {
  await Promise.all([
    youtubeQueue.close(),
    mediaRequestQueue.close(),
    notificationQueue.close(),
    youtubeQueueEvents.close(),
  ]);
}
```

### Redis Middleware for Express

```typescript
// backend/src/middleware/redis.ts
import { Request, Response, NextFunction } from 'express';
import { rateLimiter } from '@/lib/redis/rateLimiter';

export const rateLimitMiddleware = (resource: string = 'api') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting for health checks
    if (req.path === '/api/health') {
      return next();
    }

    const userId = req.user?.id || req.ip || 'anonymous';

    const result = await rateLimiter.checkLimit(userId, resource, {
      limit: resource === 'youtube' ? 5 : 100,
      window: resource === 'youtube' ? 3600 : 60,
    });

    if (result.limited) {
      res.setHeader('X-RateLimit-Limit', result.limited ? '0' : '100');
      res.setHeader('X-RateLimit-Remaining', Math.max(0, 100 - result.current).toString());
      res.setHeader(
        'X-RateLimit-Reset',
        new Date(Date.now() + result.resetIn * 1000).toISOString(),
      );

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          retryAfter: result.resetIn,
        },
      });
    }

    next();
  };
};
```

## Acceptance Criteria

1. ✅ Redis connection established with retry logic
2. ✅ Session management working with proper TTLs
3. ✅ Rate limiting prevents abuse (100/min API, 5/hr YouTube)
4. ✅ Cache service stores and retrieves data
5. ✅ BullMQ queues process jobs
6. ✅ Lua scripts execute atomically
7. ✅ Cache invalidation works by tag
8. ✅ Health check endpoint reports Redis status

## Testing Requirements

1. **Unit Tests:**
   - Session creation and retrieval
   - Rate limit logic with mocked Redis
   - Cache operations
   - Queue job processing

2. **Integration Tests:**
   - Full Redis operations
   - Rate limiting under load
   - Queue processing with real Redis
   - Cache invalidation patterns

## Error Handling

- Connection failures: Exponential backoff retry
- Script errors: Fallback to direct commands
- Cache misses: Return null, don't throw
- Queue failures: Dead letter queue handling

## Performance Considerations

- Use pipelining for multiple operations
- Implement connection pooling
- Cache Lua scripts with SHA hashes
- Monitor memory usage

## Dependencies

- `ioredis` - Redis client
- `bullmq` - Job queue
- `@types/redis` - TypeScript types

## References

- [ioredis Documentation](https://github.com/redis/ioredis)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
