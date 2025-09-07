# MediaNest Performance Guide

**Version:** 4.0 - Comprehensive Performance Strategy  
**Last Updated:** September 7, 2025  
**Scope:** Application Optimization and Performance Monitoring

## Table of Contents

1. [Performance Overview](#performance-overview)
2. [Performance Targets](#performance-targets)
3. [Backend Performance](#backend-performance)
4. [Frontend Performance](#frontend-performance)
5. [Database Optimization](#database-optimization)
6. [Caching Strategy](#caching-strategy)
7. [External Service Optimization](#external-service-optimization)
8. [Monitoring and Profiling](#monitoring-and-profiling)
9. [Load Testing](#load-testing)
10. [Performance Best Practices](#performance-best-practices)

## Performance Overview

### Performance Philosophy

MediaNest performance strategy is built on:

1. **User-Centric Metrics:** Prioritize metrics that impact user experience
2. **Proactive Monitoring:** Identify performance issues before users notice
3. **Continuous Optimization:** Regular performance audits and improvements
4. **Scalable Architecture:** Design for growth and varying load patterns

### Core Performance Principles

- **Speed:** Fast response times for all user interactions
- **Efficiency:** Optimal resource utilization
- **Reliability:** Consistent performance under load
- **Scalability:** Maintain performance as usage grows

## Performance Targets

### Response Time Targets

#### API Response Times

```yaml
Critical Endpoints (95th percentile):
  - Health Check: < 50ms
  - Authentication: < 200ms
  - Dashboard Data: < 300ms
  - Media Search: < 500ms
  - User Preferences: < 150ms

Standard Endpoints (95th percentile):
  - Media Metadata: < 800ms
  - External API Calls: < 2s
  - File Operations: < 1s
  - Database Queries: < 100ms
```

#### Frontend Performance

```yaml
Core Web Vitals:
  - First Contentful Paint (FCP): < 1.5s
  - Largest Contentful Paint (LCP): < 2.5s
  - First Input Delay (FID): < 100ms
  - Cumulative Layout Shift (CLS): < 0.1

Page Load Metrics:
  - Time to Interactive (TTI): < 3s
  - Total Blocking Time (TBT): < 200ms
  - Speed Index: < 2.5s
```

### Throughput Targets

#### Concurrent Users

```yaml
User Capacity:
  - Target Users: 10-20 concurrent
  - Peak Load: 50 concurrent (burst)
  - Response Degradation: < 10% at peak
  - Error Rate: < 1% under normal load
```

#### API Throughput

```yaml
Request Handling:
  - Sustained RPS: 100 requests/second
  - Peak RPS: 300 requests/second
  - Database Connections: < 50% pool utilization
  - Memory Usage: < 70% available memory
```

## Backend Performance

### Node.js Optimization

#### Runtime Configuration

```javascript
// Performance-oriented Node.js settings
process.env.NODE_ENV = 'production';
process.env.UV_THREADPOOL_SIZE = '16'; // Increase thread pool
process.env.NODE_OPTIONS = '--max-old-space-size=2048'; // 2GB heap limit

// Enable production optimizations
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_OPTIONS += ' --enable-source-maps=false';
  process.env.NODE_OPTIONS += ' --no-deprecation';
}
```

#### Express.js Performance

```javascript
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');

const app = express();

// Performance middleware
app.use(
  compression({
    threshold: 1024, // Only compress responses > 1KB
    level: 6, // Compression level (1-9, 6 is balanced)
    memLevel: 8, // Memory usage (1-9, 8 is default)
  })
);

// Security with performance considerations
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for performance if needed
    crossOriginEmbedderPolicy: false,
  })
);

// Disable x-powered-by for security and slight perf gain
app.disable('x-powered-by');

// Trust proxy for accurate client IP (behind nginx)
app.set('trust proxy', 1);
```

### API Optimization

#### Request Processing Pipeline

```javascript
// Optimized middleware stack
app.use(cors(corsOptions)); // CORS handling
app.use(rateLimiter); // Rate limiting first
app.use(compression()); // Compress responses
app.use(express.json({ limit: '1mb' })); // Limit payload size
app.use(authMiddleware); // Authentication
app.use(requestLogger); // Logging last
```

#### Response Optimization

```javascript
// Efficient response handling
class ResponseOptimizer {
  static sendJSON(res, data, statusCode = 200) {
    res
      .status(statusCode)
      .set('Content-Type', 'application/json')
      .set('Cache-Control', 'no-cache')
      .json({
        success: statusCode < 400,
        data,
        timestamp: Date.now(),
      });
  }

  static sendCachedJSON(res, data, maxAge = 300) {
    res
      .status(200)
      .set('Content-Type', 'application/json')
      .set('Cache-Control', `public, max-age=${maxAge}`)
      .set('ETag', generateETag(data))
      .json(data);
  }
}
```

### Asynchronous Processing

#### Background Job Processing

```javascript
const Queue = require('bull');

// Optimized queue configuration
const mediaProcessingQueue = new Queue('media processing', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: true,
  },
  defaultJobOptions: {
    removeOnComplete: 10, // Keep only 10 completed jobs
    removeOnFail: 5, // Keep only 5 failed jobs
    attempts: 3, // Retry failed jobs 3 times
    backoff: 'exponential', // Exponential backoff
  },
});

// Concurrent job processing
mediaProcessingQueue.process(5, async (job) => {
  // Process media metadata
  return await processMediaMetadata(job.data);
});
```

## Frontend Performance

### Next.js Optimization

#### Build Configuration

```javascript
// next.config.js
const nextConfig = {
  // Enable React strict mode
  reactStrictMode: true,

  // Enable SWC minifier (faster than Terser)
  swcMinify: true,

  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Experimental features for performance
  experimental: {
    esmExternals: true,
    serverComponents: true,
  },

  // Bundle analysis
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': path.resolve(__dirname, 'src'),
      };
    }
    return config;
  },
};
```

### Code Splitting and Lazy Loading

#### Dynamic Imports

```javascript
import dynamic from 'next/dynamic';
import { lazy, Suspense } from 'react';

// Dynamic component loading with loading states
const MediaGrid = dynamic(() => import('../components/MediaGrid'), {
  loading: () => <MediaGridSkeleton />,
  ssr: false, // Disable SSR for heavy components
});

const Dashboard = dynamic(() => import('../components/Dashboard'), {
  loading: () => <DashboardSkeleton />,
});

// Route-based code splitting
const SearchPage = lazy(() => import('../pages/search'));
const SettingsPage = lazy(() => import('../pages/settings'));

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Router>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Router>
    </Suspense>
  );
}
```

### State Management Optimization

#### React Query Configuration

```javascript
import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes
      staleTime: 1000 * 60 * 5,
      // Keep in cache for 10 minutes
      cacheTime: 1000 * 60 * 10,
      // Retry failed requests 3 times
      retry: 3,
      // Don't refetch on window focus by default
      refetchOnWindowFocus: false,
      // Use background refetch
      refetchOnMount: 'always',
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});
```

#### Optimized Data Fetching

```javascript
// Efficient data fetching hooks
export function useMediaData(filters = {}) {
  return useQuery({
    queryKey: ['media', filters],
    queryFn: () => fetchMediaData(filters),
    select: (data) => data.items, // Transform data
    enabled: !!filters.query, // Conditional fetching
    keepPreviousData: true, // Smooth transitions
  });
}

// Prefetch critical data
export function usePrefetchCriticalData() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Prefetch dashboard data
    queryClient.prefetchQuery({
      queryKey: ['dashboard'],
      queryFn: fetchDashboardData,
      staleTime: 1000 * 60 * 2, // 2 minutes
    });
  }, []);
}
```

## Database Optimization

### PostgreSQL Performance

#### Connection Pool Optimization

```javascript
// Prisma configuration for performance
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

// Connection pool settings (in DATABASE_URL)
// ?connection_limit=10&pool_timeout=20&socket_timeout=60
```

#### Query Optimization

```javascript
// Optimized queries with proper indexing
class OptimizedQueries {
  static async getUserMedia(userId, filters = {}) {
    return await prisma.media.findMany({
      where: {
        userId,
        ...filters,
      },
      select: {
        id: true,
        title: true,
        thumbnail: true,
        createdAt: true,
        // Only select needed fields
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit results
      skip: filters.offset || 0,
    });
  }

  static async getMediaWithStats(mediaId) {
    // Use transactions for consistency
    return await prisma.$transaction(async (tx) => {
      const media = await tx.media.findUnique({
        where: { id: mediaId },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      });

      const stats = await tx.mediaStats.findUnique({
        where: { mediaId },
      });

      return { media, stats };
    });
  }
}
```

#### Database Indexing Strategy

```sql
-- Critical indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_user_created
ON media(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_search_text
ON media USING gin(to_tsvector('english', title || ' ' || description));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_expires
ON session_tokens(user_id, expires_at)
WHERE expires_at > NOW();

-- Partial index for active sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_sessions
ON session_tokens(user_id)
WHERE expires_at > NOW();
```

## Caching Strategy

### Multi-Layer Caching

#### Layer 1: In-Memory Cache (Node.js)

```javascript
const NodeCache = require('node-cache');

// Application-level cache
const appCache = new NodeCache({
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60, // Check for expired keys every minute
  useClones: false, // Don't clone objects (faster but be careful)
  maxKeys: 1000, // Limit cache size
});

class CacheManager {
  static set(key, value, ttl = 300) {
    return appCache.set(key, value, ttl);
  }

  static get(key) {
    return appCache.get(key);
  }

  static memoize(fn, ttl = 300) {
    return async (...args) => {
      const key = `memoize:${fn.name}:${JSON.stringify(args)}`;
      const cached = this.get(key);

      if (cached !== undefined) {
        return cached;
      }

      const result = await fn(...args);
      this.set(key, result, ttl);
      return result;
    };
  }
}
```

#### Layer 2: Redis Cache

```javascript
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  // Connection pool
  enableOfflineQueue: false,
});

class RedisCache {
  static async get(key) {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  static async set(key, value, ttl = 3600) {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  static async mget(keys) {
    try {
      const values = await redis.mget(keys);
      return values.map((v) => (v ? JSON.parse(v) : null));
    } catch (error) {
      console.error('Redis mget error:', error);
      return new Array(keys.length).fill(null);
    }
  }
}
```

### Cache Strategies

#### Cache-Aside Pattern

```javascript
class MediaService {
  static async getMediaMetadata(mediaId) {
    // Check cache first
    const cacheKey = `media:${mediaId}`;
    let metadata = await RedisCache.get(cacheKey);

    if (!metadata) {
      // Cache miss - fetch from database
      metadata = await prisma.media.findUnique({
        where: { id: mediaId },
        include: { user: true, stats: true },
      });

      if (metadata) {
        // Cache for 1 hour
        await RedisCache.set(cacheKey, metadata, 3600);
      }
    }

    return metadata;
  }

  static async invalidateMediaCache(mediaId) {
    const cacheKey = `media:${mediaId}`;
    await redis.del(cacheKey);
  }
}
```

## External Service Optimization

### Plex API Optimization

#### Connection Pooling

```javascript
const axios = require('axios');

// Optimized Plex client with connection pooling
const plexClient = axios.create({
  timeout: 10000,
  maxRedirects: 3,
  // Connection pooling
  httpAgent: new (require('http').Agent)({
    keepAlive: true,
    maxSockets: 10,
  }),
  httpsAgent: new (require('https').Agent)({
    keepAlive: true,
    maxSockets: 10,
  }),
});

class PlexOptimizer {
  static async batchRequests(requests) {
    // Batch multiple requests with concurrency limit
    const results = [];
    const concurrencyLimit = 5;

    for (let i = 0; i < requests.length; i += concurrencyLimit) {
      const batch = requests.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.allSettled(batch.map((req) => plexClient(req)));
      results.push(...batchResults);
    }

    return results;
  }
}
```

### YouTube API Optimization

#### Quota Management

```javascript
class YouTubeOptimizer {
  static quotaUsed = 0;
  static readonly DAILY_QUOTA_LIMIT = 10000;
  static readonly REQUEST_COSTS = {
    search: 100,
    videos: 1,
    channels: 1
  };

  static async makeRequest(endpoint, params, cost) {
    // Check quota before making request
    if (this.quotaUsed + cost > this.DAILY_QUOTA_LIMIT) {
      throw new Error('YouTube API quota exceeded');
    }

    // Check cache first
    const cacheKey = `youtube:${endpoint}:${JSON.stringify(params)}`;
    let response = await RedisCache.get(cacheKey);

    if (!response) {
      response = await youtube[endpoint].list(params);
      this.quotaUsed += cost;

      // Cache for 1 hour
      await RedisCache.set(cacheKey, response, 3600);
    }

    return response;
  }
}
```

## Monitoring and Profiling

### Performance Monitoring

#### Custom Metrics Collection

```javascript
const client = require('prom-client');

// Performance metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
});

const cacheHitRate = new client.Counter({
  name: 'cache_operations_total',
  help: 'Cache operations total',
  labelNames: ['operation', 'result'], // hit, miss
});
```

### Application Profiling

#### Memory Usage Monitoring

```javascript
function monitorMemoryUsage() {
  setInterval(() => {
    const usage = process.memoryUsage();
    console.log('Memory Usage:', {
      rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
      external: Math.round(usage.external / 1024 / 1024) + 'MB',
    });
  }, 30000); // Every 30 seconds
}
```

## Load Testing

### Artillery.js Configuration

```yaml
# load-test.yml
config:
  target: 'http://localhost:4000'
  phases:
    - duration: 60
      arrivalRate: 5
      name: 'Warm up'
    - duration: 120
      arrivalRate: 10
      name: 'Ramp up load'
    - duration: 300
      arrivalRate: 20
      name: 'Sustained load'
  payload:
    - path: 'users.csv'
      fields:
        - 'username'
        - 'password'

scenarios:
  - name: 'Authentication and dashboard'
    weight: 70
    flow:
      - post:
          url: '/api/v1/auth/login'
          json:
            username: '{{ username }}'
            password: '{{ password }}'
          capture:
            - json: '$.token'
              as: 'authToken'
      - get:
          url: '/api/v1/dashboard'
          headers:
            Authorization: 'Bearer {{ authToken }}'
```

### Performance Testing Strategy

```javascript
// Performance test scenarios
const testScenarios = {
  // Basic load test
  normalLoad: {
    users: 10,
    duration: 300, // 5 minutes
    rampUp: 60, // 1 minute ramp up
  },

  // Stress test
  stressTest: {
    users: 50,
    duration: 600, // 10 minutes
    rampUp: 120, // 2 minute ramp up
  },

  // Spike test
  spikeTest: {
    phases: [
      { users: 5, duration: 300 }, // Normal load
      { users: 50, duration: 60 }, // Sudden spike
      { users: 5, duration: 300 }, // Back to normal
    ],
  },
};
```

## Performance Best Practices

### General Optimization

1. **Enable Gzip Compression**

   - Compress API responses > 1KB
   - Use compression level 6 for balance

2. **Implement Request Caching**

   - Cache GET responses with appropriate TTL
   - Use ETags for conditional requests

3. **Optimize Database Queries**

   - Use proper indexes
   - Limit result sets
   - Avoid N+1 queries

4. **Minimize External API Calls**
   - Batch requests when possible
   - Implement circuit breakers
   - Cache responses aggressively

### Frontend Optimization

1. **Code Splitting**

   - Route-based splitting
   - Component-based splitting
   - Library splitting

2. **Asset Optimization**

   - Optimize images (WebP/AVIF)
   - Minify CSS/JS
   - Use CDN for static assets

3. **Runtime Performance**
   - Avoid unnecessary re-renders
   - Use React.memo for expensive components
   - Implement virtual scrolling for large lists

### Backend Optimization

1. **Response Time**

   - Keep API responses under 200ms
   - Use async/await properly
   - Implement request timeouts

2. **Memory Management**

   - Monitor memory usage
   - Implement garbage collection tuning
   - Use streaming for large datasets

3. **Scalability Patterns**
   - Stateless application design
   - Database connection pooling
   - Load balancing preparation

---

**Note:** This performance guide provides comprehensive optimization strategies for MediaNest. Regular performance audits and monitoring are essential for maintaining optimal performance as the application scales.
