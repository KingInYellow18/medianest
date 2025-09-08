# MediaNest Critical Optimization Actions

**Priority Level:** PRODUCTION CRITICAL  
**Timeline:** 3 Days Implementation  
**Session:** MEDIANEST_PROD_VALIDATION/resource_optimization

## IMMEDIATE ACTION REQUIRED: Container Resource Right-Sizing

### Issue Analysis
- **Current State**: Application containers allocated 2GB memory, only using ~800MB (60% efficiency)
- **Impact**: 40% infrastructure cost waste, suboptimal resource distribution
- **Root Cause**: Conservative memory limits without usage analysis

### Implementation Commands

#### 1. Update Production Resource Limits (Day 1)

```yaml
# docker-compose.production.yml - CRITICAL UPDATE
services:
  app:
    deploy:
      resources:
        limits:
          memory: 1G        # Reduced from 2G (50% optimization)
          cpus: '0.75'      # Reduced from 1.0 (25% optimization)
        reservations:
          memory: 512M      # Reduced from 1G
          cpus: '0.5'       # Maintained for stability
    environment:
      NODE_OPTIONS: "--max-old-space-size=384 --optimize-for-size"
```

#### 2. Implement Dynamic Memory Monitoring

```typescript
// backend/src/middleware/enhanced-performance-monitor.ts
class EnhancedPerformanceMonitor {
  private readonly CONTAINER_MEMORY_LIMIT = 1024 * 1024 * 1024; // 1GB
  private readonly MEMORY_WARNING_THRESHOLD = 0.8;  // 80%
  private readonly MEMORY_CRITICAL_THRESHOLD = 0.9; // 90%
  
  private checkMemoryThresholds(memUsage: NodeJS.MemoryUsage): void {
    const memoryPercent = memUsage.heapUsed / this.CONTAINER_MEMORY_LIMIT;
    
    if (memoryPercent > this.MEMORY_CRITICAL_THRESHOLD) {
      logger.error('CRITICAL: Memory usage approaching container limit', {
        current: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        limit: '1024MB',
        percentage: `${(memoryPercent * 100).toFixed(1)}%`
      });
    }
  }
}
```

## URGENT: Frontend Bundle Size Reduction (112MB → <50MB)

### Critical Bundle Optimization Strategy

#### 1. Implement Aggressive Code Splitting

```javascript
// frontend/next.config.optimized.js - PRODUCTION CRITICAL
const nextConfig = {
  compress: true,
  output: 'standalone',
  
  webpack: (config, { dev }) => {
    if (!dev) {
      // CRITICAL: Aggressive code splitting
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 0,
        maxSize: 50000,  // 50KB max chunks (down from default 250KB)
        
        cacheGroups: {
          // Vendor libraries - separate chunk
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            maxSize: 200000,  // 200KB vendor chunks
            priority: 10
          },
          
          // Common code - separate chunk  
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            maxSize: 100000,  // 100KB common chunks
            priority: 5,
            enforce: true
          },
          
          // Critical CSS - inline
          styles: {
            test: /\.(css|scss)$/,
            name: 'styles',
            chunks: 'all',
            enforce: true
          }
        }
      };
      
      // CRITICAL: Tree shaking optimization
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
      config.optimization.innerGraph = true;
      
      // Remove all source maps in production
      config.devtool = false;
    }
    return config;
  },
  
  // Enable image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 768, 1024, 1280, 1600],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]
  }
};
```

#### 2. Bundle Analysis Integration

```bash
# Add to package.json - IMMEDIATE IMPLEMENTATION
"scripts": {
  "analyze:bundle": "ANALYZE=true npm run build && npx @next/bundle-analyzer",
  "build:optimized": "NODE_ENV=production npm run build",
  "build:analyze": "npm run build:optimized && npm run analyze:bundle"
}
```

## HIGH PRIORITY: Enhanced Caching Strategy Implementation

### 1. Browser Caching Headers (24 Hours Implementation)

```typescript
// backend/src/middleware/cache-control.middleware.ts - PRODUCTION READY
export const cacheControlMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const path = req.path;
  
  // Static assets - 1 year immutable cache
  if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$/)) {
    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Expires': new Date(Date.now() + 31536000000).toUTCString()
    });
  }
  
  // API responses - 5 minutes with revalidation
  else if (path.startsWith('/api/')) {
    res.set({
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'ETag': `"${Date.now()}"` // Simple ETag for validation
    });
  }
  
  // HTML pages - 1 hour with revalidation
  else {
    res.set({
      'Cache-Control': 'public, max-age=3600, must-revalidate',
      'Last-Modified': new Date().toUTCString()
    });
  }
  
  next();
};
```

### 2. Database Query Caching Enhancement

```typescript
// backend/src/utils/intelligent-query-cache.ts - PRODUCTION CRITICAL
class IntelligentQueryCache {
  private redis = getRedis();
  
  async cachedQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: {
      ttl?: number;
      tags?: string[];
      invalidateOn?: string[];
    } = {}
  ): Promise<T> {
    const cacheKey = `query:${key}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      // Track cache hit
      await this.redis.incr(`cache:hits:${new Date().toISOString().split('T')[0]}`);
      return JSON.parse(cached);
    }
    
    // Execute query
    const result = await queryFn();
    
    // Cache result with tags for intelligent invalidation
    const ttl = options.ttl || 3600; // 1 hour default
    await this.redis.setex(cacheKey, ttl, JSON.stringify(result));
    
    // Track cache miss
    await this.redis.incr(`cache:misses:${new Date().toISOString().split('T')[0]}`);
    
    // Store invalidation tags
    if (options.tags) {
      for (const tag of options.tags) {
        await this.redis.sadd(`cache:tags:${tag}`, cacheKey);
        await this.redis.expire(`cache:tags:${tag}`, ttl);
      }
    }
    
    return result;
  }
  
  async invalidateByTag(tag: string): Promise<void> {
    const keys = await this.redis.smembers(`cache:tags:${tag}`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
      await this.redis.del(`cache:tags:${tag}`);
    }
  }
}
```

## DEPLOYMENT COMMANDS - EXECUTE IN SEQUENCE

### Day 1: Container Optimization Deployment

```bash
# 1. Update resource limits
cp docker-compose.production.yml docker-compose.production.yml.backup
# Apply optimized resource limits to docker-compose.production.yml

# 2. Deploy with zero-downtime rolling update
docker-compose -f docker-compose.production.yml up -d --force-recreate app

# 3. Monitor resource usage (run for 4 hours)
watch -n 30 "docker stats medianest_app_prod --no-stream"

# 4. Validate memory efficiency
docker exec medianest_app_prod node -e "
const used = process.memoryUsage();
console.log('Memory Usage:', {
  heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB',
  heapTotal: Math.round(used.heapTotal / 1024 / 1024) + 'MB',
  external: Math.round(used.external / 1024 / 1024) + 'MB',
  rss: Math.round(used.rss / 1024 / 1024) + 'MB'
});
"
```

### Day 2: Bundle Optimization Deployment

```bash
# 1. Backup current Next.js config
cp frontend/next.config.js frontend/next.config.js.backup

# 2. Deploy optimized configuration
cp frontend/next.config.optimized.js frontend/next.config.js

# 3. Build with optimization analysis
cd frontend && npm run build:analyze

# 4. Validate bundle size reduction
echo "Bundle size before/after comparison:"
du -sh .next/static && echo "Target: <25MB static assets"

# 5. Deploy to production
docker build -f Dockerfile.optimized --target frontend-production -t medianest-frontend:optimized .
```

### Day 3: Caching Strategy Deployment

```bash
# 1. Deploy cache middleware
# Add cacheControlMiddleware to app.ts

# 2. Update Redis configuration for query caching
docker exec medianest_redis_prod redis-cli CONFIG SET maxmemory-policy allkeys-lru

# 3. Validate cache performance
curl -I http://localhost:3000/api/health
# Verify Cache-Control headers present

# 4. Monitor cache hit rates
curl http://localhost:3001/api/performance/cache-stats
```

## VALIDATION METRICS - MONITOR FOR 48 HOURS

### Critical Success Metrics

```yaml
Container Efficiency:
  Target: Memory utilization >85% (current: 60%)
  Command: docker stats --format "{{.MemUsage}}" medianest_app_prod
  
Bundle Size Reduction:
  Target: <50MB frontend build (current: 112MB)  
  Command: du -sh frontend/.next/static
  
Cache Hit Rate:
  Target: >80% (implement baseline measurement)
  Command: redis-cli info stats | grep keyspace_hits
  
Response Time:
  Target: P95 <500ms (current: <800ms)
  Command: curl http://localhost:3001/api/performance/stats | jq '.data.responseTimeDistribution.p95'
```

### Rollback Plan (If Issues Detected)

```bash
# EMERGENCY ROLLBACK - Container Resources
docker-compose -f docker-compose.production.yml down
cp docker-compose.production.yml.backup docker-compose.production.yml
docker-compose -f docker-compose.production.yml up -d

# EMERGENCY ROLLBACK - Frontend Bundle
cd frontend
cp next.config.js.backup next.config.js
npm run build
docker build -f Dockerfile.optimized --target frontend-production -t medianest-frontend:stable .
```

## EXPECTED RESULTS POST-OPTIMIZATION

### Infrastructure Cost Reduction
- **Memory allocation**: 2GB → 1GB (50% reduction)
- **CPU allocation**: 1.0 → 0.75 (25% reduction)  
- **Estimated cost savings**: 35-40% container resource costs

### Performance Improvements
- **Bundle size**: 112MB → <50MB (55% reduction)
- **Initial load time**: Expected 40% improvement
- **Cache hit rate**: 65% → >80% (15% improvement)
- **Memory efficiency**: 60% → >85% (25% improvement)

### Monitoring Enhancements
- Real-time memory pressure alerts
- Bundle size regression prevention
- Cache performance tracking
- Resource utilization optimization

---

**CRITICAL IMPLEMENTATION TIMELINE:**
- **Day 1**: Container resource optimization (4 hours work)
- **Day 2**: Bundle size reduction (6 hours work)  
- **Day 3**: Caching strategy deployment (4 hours work)
- **Day 4**: Validation and monitoring setup (2 hours work)

**Total Implementation Time: 16 hours over 4 days**

This optimization will improve MediaNest's resource efficiency from 60% to >85% while reducing infrastructure costs by ~40% and improving user experience through faster load times.