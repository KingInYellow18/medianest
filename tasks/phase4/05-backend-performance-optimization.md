# Phase 4: Backend Performance Optimization

**Status:** Not Started  
**Priority:** Medium  
**Dependencies:** All backend features implemented  
**Estimated Time:** 6 hours

## Objective

Optimize the Express backend for fast response times and efficient resource usage, targeting <1 second API response times for all endpoints.

## Background

Backend performance affects all users and integrations. For a homelab with limited resources, efficiency is important while avoiding premature optimization.

## Tasks

### 1. Database Query Optimization

- [ ] Analyze slow queries with Prisma logs
- [ ] Add database indexes where needed
- [ ] Optimize N+1 query problems
- [ ] Implement query result caching
- [ ] Use database views for complex queries
- [ ] Configure connection pooling

### 2. Redis Caching Enhancement

- [ ] Cache Plex library data (1 hour TTL)
- [ ] Cache service status (5 minute TTL)
- [ ] Cache user permissions
- [ ] Implement cache warming
- [ ] Add cache invalidation logic
- [ ] Monitor cache hit rates

### 3. API Response Optimization

- [ ] Enable gzip compression
- [ ] Implement response pagination
- [ ] Add field filtering for large responses
- [ ] Optimize JSON serialization
- [ ] Remove unnecessary data from responses
- [ ] Implement HTTP caching headers

### 4. WebSocket Optimization

- [ ] Implement room-based broadcasting
- [ ] Reduce event frequency with throttling
- [ ] Compress WebSocket messages
- [ ] Add connection pooling
- [ ] Optimize event payload sizes
- [ ] Implement acknowledgments

### 5. Background Job Optimization

- [ ] Configure optimal concurrency
- [ ] Implement job batching
- [ ] Add job priority queues
- [ ] Optimize worker memory usage
- [ ] Implement job result caching
- [ ] Monitor queue performance

### 6. Resource Management

- [ ] Implement request timeouts
- [ ] Add memory usage monitoring
- [ ] Configure process clustering
- [ ] Optimize Docker container resources
- [ ] Implement graceful shutdown
- [ ] Add health check optimizations

## Implementation Details

```typescript
// Database indexing
model MediaRequest {
  @@index([userId, status])
  @@index([createdAt])
}

// Redis caching example
async function getPlexLibraries(userId: string) {
  const cacheKey = `plex:libraries:${userId}`;

  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch from Plex
  const libraries = await plexClient.getLibraries();

  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(libraries));

  return libraries;
}

// Response optimization
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6
}));

// Connection pooling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['warn', 'error'],
  // Connection pool settings
  connection_limit: 10,
});
```

## Performance Targets

```yaml
API Response Times:
  - Auth endpoints: <200ms
  - Media search: <500ms
  - Library browse: <300ms (cached)
  - Status endpoints: <100ms
  - YouTube downloads: <200ms

Resource Usage:
  - Memory: <512MB per process
  - CPU: <50% average
  - Database connections: <20
  - Redis memory: <100MB
```

## Testing Requirements

- [ ] Load test with 20 concurrent users
- [ ] Measure response times
- [ ] Monitor memory usage
- [ ] Check cache effectiveness
- [ ] Test under resource constraints
- [ ] Verify optimization impact

## Success Criteria

- [ ] All APIs respond in <1 second
- [ ] Memory usage stays under 512MB
- [ ] Cache hit rate >80%
- [ ] No memory leaks
- [ ] Smooth operation with 20 users
- [ ] Database queries <100ms

## Notes

- Profile before optimizing
- Don't over-optimize for homelab scale
- Consider Docker resource limits
- Monitor after deployment
- Keep code maintainable
