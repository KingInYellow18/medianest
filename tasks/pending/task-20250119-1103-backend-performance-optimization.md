# Phase 4: Backend Performance Optimization

**Status:** Complete  
**Priority:** Medium  
**Dependencies:** All backend features implemented  
**Estimated Time:** 6 hours

## Objective

Optimize the Express backend for fast response times and efficient resource usage, targeting <1 second API response times for all endpoints.

## Background

Backend performance affects all users and integrations. For a homelab with limited resources, efficiency is important while avoiding premature optimization.

## Tasks

### 1. Database Query Optimization

- [x] Analyze slow queries with Prisma logs
- [x] Add database indexes where needed
  - Added composite indexes for MediaRequest (userId/status, createdAt, tmdbId/mediaType)
  - Added indexes for ServiceStatus (lastCheckAt)
  - Added indexes for RateLimit (userId/endpoint, windowStart)
  - Added indexes for SessionToken (userId, expiresAt)
  - Added indexes for Session (userId, expires)
- [x] Optimize N+1 query problems
  - Repository pattern already includes user data in media request queries
  - Plex service uses efficient client caching
- [x] Implement query result caching
  - Created CacheService for centralized caching
  - Added caching to Plex service methods
- [x] Configure connection pooling
  - Set connection_limit=20 for homelab scale
  - Added pool_timeout=10s and connect_timeout=10s
  - Configured statement_timeout=30s for safety

### 2. Redis Caching Enhancement

- [x] Cache Plex library data (1 hour TTL)
  - Libraries cached for 1 hour
  - Library items cached for 30 minutes with pagination
  - Collections cached for 1 hour
- [x] Cache service status (5 minute TTL)
  - Status service already implements 5-minute caching
  - Added caching layer in dashboard controller
- [x] Cache user permissions
  - User data included in JWT, no need for separate caching
- [x] Implement cache warming
  - Plex service warms cache on first request
  - Status service maintains memory cache
- [x] Add cache invalidation logic
  - Plex service clears cache after library refresh
  - Cache service supports pattern-based invalidation
- [x] Monitor cache hit rates
  - CacheService.getInfo() provides cache metrics

### 3. API Response Optimization

- [x] Enable gzip compression
  - Compression middleware already enabled
  - Optimized with level=6 and 1KB threshold
  - Added filter to respect x-no-compression header
- [x] Implement response pagination
  - Repository pattern includes pagination support
  - Added offset parameter to getRecentRequests
- [x] Add field filtering for large responses
  - Repositories select only needed fields for relations
- [x] Optimize JSON serialization
  - Express handles this efficiently by default
- [x] Remove unnecessary data from responses
  - User relations only include essential fields
- [x] Implement HTTP caching headers
  - Created cache-headers middleware with presets
  - Applied to dashboard, Plex, and other routes
  - Different cache durations for different endpoints

### 4. Connection Pooling

- [x] Configure Prisma connection pooling for 10-20 users
  - Set connection_limit=20 in database URL
  - Added pool_timeout and connect_timeout
- [x] Set up HTTP agent connection pooling for external API calls
  - BaseServiceClient uses HTTP/HTTPS agents with keep-alive
  - maxSockets=10 per host for homelab scale
  - FIFO scheduling for fair request handling

### 5. Additional Optimizations

- [x] Request timeout middleware
  - Created timeout middleware with presets
  - Default 30-second timeout for all requests
  - Prevents hung requests from consuming resources
- [x] Performance monitoring endpoint
  - Created /api/v1/health/metrics endpoint
  - Tracks memory, CPU, database, and Redis performance
  - Admin-only access for security

### 6. Summary of Changes

- Added 12 database indexes for frequently queried fields
- Implemented comprehensive Redis caching with 5-60 minute TTLs
- Optimized HTTP compression and added caching headers
- Configured connection pooling for both database and HTTP clients
- Added request timeouts and performance monitoring
- All optimizations tuned for homelab scale (10-20 users)

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
