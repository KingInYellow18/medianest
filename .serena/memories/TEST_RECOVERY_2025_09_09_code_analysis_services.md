# MediaNest Service Layer Analysis - Test Recovery

## Current Service Architecture

### 1. PlexService (`backend/src/services/plex.service.ts`)
**Core Methods:**
- `getClientForUser(userId)` - Get authenticated Plex client for user
- `getServerInfo()` - Retrieve Plex server information
- `getLibraries()` - List all Plex libraries
- `getLibraryItems(libraryId, options)` - Get items from specific library
- `search(query, options)` - Search Plex content
- `getRecentlyAdded()` - Get recently added content
- `refreshLibrary(libraryId)` - Refresh Plex library
- `scanDirectory(libraryId, path)` - Scan specific directory
- `getCollections()` - Get Plex collections
- `getCollectionDetails(collectionId)` - Get collection details
- `createCollection(data)` - Create new collection
- `findYouTubeLibrary()` - Locate YouTube library
- `startCleanupTimer()` - Client cleanup management

**Key Features:**
- Client connection pooling with cleanup
- Redis caching integration (cachePrefix, cacheTTL)
- Per-user authentication tokens
- Library management capabilities

### 2. JwtService (`backend/src/services/jwt.service.ts`)
**Core Methods:**
- `constructor(secret, issuer, audience)` - Initialize JWT service
- `generateAccessToken(payload)` - Create access tokens
- `generateRememberToken(payload)` - Create long-lived tokens
- `verifyToken(token)` - Validate and decode tokens

**Configuration:**
- Uses configurable secret, issuer, audience
- Different token types (access vs remember)
- Token validation with proper error handling

### 3. CacheService (`backend/src/services/cache.service.ts`)
**Core Methods:**
- `get(key)` - Retrieve cached value
- `set(key, value, ttl?)` - Store value with optional TTL
- `del(key)` - Delete cached entry
- `getOrSet(key, fetcher, ttl?)` - Get or compute and cache
- `invalidatePattern(pattern)` - Clear cache by pattern
- `getInfo()` - Cache statistics and health

**Features:**
- Redis-backed caching
- Pattern-based invalidation
- TTL management
- Cache statistics

### 4. IntegrationService (`backend/src/services/integration.service.ts`)
**Interfaces:**
- `ServiceHealthStatus` - Health check structure
- `ServiceIntegrationConfig` - Service configuration

### 5. YouTubeService (`backend/src/services/youtube.service.ts`)
**Interfaces:**
- `VideoMetadata` - Video information structure
- Methods for YouTube content handling

## Additional Services Identified

### Authentication & Security
- `encryption.service.ts` - Data encryption/decryption
- `two-factor.service.ts` - 2FA implementation
- `password-reset.service.ts` - Password reset functionality
- `device-session.service.ts` - Device session management
- `oauth-providers.service.ts` - OAuth integration

### Monitoring & Health
- `health-monitor.service.ts` - System health monitoring
- `api-health-monitor.service.ts` - API health checks
- `redis-health.service.ts` - Redis health monitoring
- `session-analytics.service.ts` - Session analytics

### Infrastructure
- `redis.service.ts` - Redis operations
- `resilience.service.ts` - Circuit breaker, retry logic
- `notification-database.service.ts` - Notification persistence
- `webhook-integration.service.ts` - Webhook handling

### External Integrations
- `overseerr.service.ts` - Overseerr integration
- `plex-auth.service.ts` - Plex authentication
- `socket.service.ts` - WebSocket handling
- `status.service.ts` - Service status management

## Service Dependencies Map

### High-Level Dependencies:
```
Controllers -> Services -> Repositories -> Database
                    -> Integrations -> External APIs
                    -> Cache -> Redis
                    -> Utils -> Logger, Validation
```

### Critical Service Interactions:
1. **AuthController** depends on:
   - JwtService (token generation)
   - PlexService (authentication)
   - EncryptionService (secure storage)
   - CacheService (session caching)

2. **MediaController** depends on:
   - OverseerrService (media requests)
   - PlexService (content search)
   - Repositories (data persistence)

3. **PlexService** depends on:
   - CacheService (response caching)
   - EncryptionService (token storage)
   - PlexClient (API communication)

## Service Interface Evolution

### Potential Breaking Changes:
1. **Constructor signatures** - Services may have new required parameters
2. **Method signatures** - Return types and parameters may have changed
3. **Error handling** - New error types and error codes
4. **Async patterns** - Migration from callbacks to promises/async-await
5. **Configuration** - Environment variables and config structure changes

### New Services Not in Tests:
- resilience-initialization.service.ts
- database-integration-validator.ts
- service-monitoring-database.service.ts
- session-analytics.service.ts
- webhook-integration.service.ts