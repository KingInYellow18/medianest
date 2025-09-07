# Task: Plex API Client Implementation

**Priority:** Critical  
**Estimated Duration:** 3 days  
**Dependencies:** Authentication system (Phase 1)  
**Phase:** 2 (Week 5)

## Objective

Create a robust Plex API client that integrates with the Plex Media Server, supporting library browsing, media search, and collection management.

## Background

The Plex API client is the foundation for all Plex-related features in MediaNest. It must handle authentication using the user's Plex token, manage API rate limits, and provide resilient error handling.

## Detailed Requirements

### 1. Base Plex Client Class

```typescript
// backend/src/integrations/plex/plex.client.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { Agent } from 'https';
import { logger } from '@/utils/logger';
import { config } from '@/config';
import { cacheService } from '@/services/cache.service';

export interface PlexServerInfo {
  name: string;
  machineIdentifier: string;
  version: string;
  platform: string;
  updatedAt: number;
}

export interface PlexLibrary {
  key: string;
  type: 'movie' | 'show' | 'music' | 'photo';
  title: string;
  agent: string;
  scanner: string;
  language: string;
  uuid: string;
  updatedAt: number;
  createdAt: number;
}

export interface PlexMediaItem {
  ratingKey: string;
  key: string;
  guid: string;
  type: 'movie' | 'episode' | 'show' | 'season';
  title: string;
  summary?: string;
  year?: number;
  thumb?: string;
  art?: string;
  duration?: number;
  addedAt: number;
  updatedAt: number;
  viewCount?: number;
  lastViewedAt?: number;
}

export class PlexClient {
  private client: AxiosInstance;
  private serverUrl: string;
  private plexToken: string;
  private serverId?: string;

  constructor(serverUrl: string, plexToken: string) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.plexToken = plexToken;

    // Create axios instance with connection pooling
    // NOTE: X-Plex-Token can be sent as header OR query parameter
    this.client = axios.create({
      baseURL: this.serverUrl,
      timeout: 3000, // 3 second timeout
      headers: {
        'X-Plex-Token': plexToken,
        'X-Plex-Client-Identifier': config.plex.clientId,
        'X-Plex-Product': 'MediaNest',
        'X-Plex-Version': '1.0.0',
        Accept: 'application/json',
      },
      httpsAgent: new Agent({
        keepAlive: true,
        maxSockets: 10,
        maxFreeSockets: 5,
        timeout: 3000,
        freeSocketTimeout: 30000,
      }),
    });

    // Add request/response interceptors
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Plex API request', {
          method: config.method,
          url: config.url,
          params: config.params,
        });
        return config;
      },
      (error) => {
        logger.error('Plex API request error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor with comprehensive error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Plex API response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      async (error: AxiosError) => {
        if (error.response) {
          // Server responded with error status
          logger.error('Plex API error response', {
            status: error.response.status,
            data: error.response.data,
            url: error.config?.url,
          });

          // Handle specific Plex error codes
          if (error.response.status === 401) {
            throw new Error('Invalid or expired Plex token');
          } else if (error.response.status === 404) {
            throw new Error('Plex resource not found');
          }
        } else if (error.request) {
          // Request made but no response received
          logger.error('Plex API no response', {
            url: error.config?.url,
            timeout: error.code === 'ECONNABORTED',
            message: error.message,
          });
          throw new Error('Plex server unreachable');
        } else {
          // Error in request setup
          logger.error('Plex API request setup error', {
            message: error.message,
          });
        }
        return Promise.reject(error);
      }
    );
  }

  // Test connection to Plex server
  async testConnection(): Promise<PlexServerInfo> {
    try {
      const response = await this.client.get('/');
      const data = response.data.MediaContainer;

      const serverInfo: PlexServerInfo = {
        name: data.friendlyName,
        machineIdentifier: data.machineIdentifier,
        version: data.version,
        platform: data.platform,
        updatedAt: data.updatedAt,
      };

      this.serverId = data.machineIdentifier;

      // Cache server info
      await cacheService.set(
        `plex:server:${this.serverId}`,
        serverInfo,
        { ttl: 3600 } // 1 hour
      );

      return serverInfo;
    } catch (error) {
      throw new Error(`Failed to connect to Plex server: ${error.message}`);
    }
  }

  // Get all libraries
  async getLibraries(): Promise<PlexLibrary[]> {
    const cacheKey = `plex:libraries:${this.serverId}`;

    // Check cache first
    const cached = await cacheService.get<PlexLibrary[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.client.get('/library/sections');
      const libraries = response.data.MediaContainer.Directory.map((lib: any) => ({
        key: lib.key,
        type: lib.type,
        title: lib.title,
        agent: lib.agent,
        scanner: lib.scanner,
        language: lib.language,
        uuid: lib.uuid,
        updatedAt: lib.updatedAt,
        createdAt: lib.createdAt,
      }));

      // Cache for 5 minutes
      await cacheService.set(cacheKey, libraries, { ttl: 300 });

      return libraries;
    } catch (error) {
      throw new Error(`Failed to fetch libraries: ${error.message}`);
    }
  }

  // Get library items with pagination
  async getLibraryItems(
    libraryKey: string,
    options: {
      offset?: number;
      limit?: number;
      sort?: string;
      includeCollections?: boolean;
    } = {}
  ): Promise<{ items: PlexMediaItem[]; totalSize: number }> {
    const params = new URLSearchParams({
      'X-Plex-Container-Start': String(options.offset || 0),
      'X-Plex-Container-Size': String(options.limit || 50),
      ...(options.sort && { sort: options.sort }),
      ...(options.includeCollections && { includeCollections: '1' }),
    });

    try {
      const response = await this.client.get(`/library/sections/${libraryKey}/all?${params}`);

      const container = response.data.MediaContainer;
      const items = (container.Metadata || []).map(this.mapMediaItem);

      return {
        items,
        totalSize: container.totalSize || 0,
      };
    } catch (error) {
      throw new Error(`Failed to fetch library items: ${error.message}`);
    }
  }

  // Search across all libraries
  async search(
    query: string,
    options: {
      type?: 'movie' | 'show' | 'episode';
      limit?: number;
    } = {}
  ): Promise<PlexMediaItem[]> {
    const params = new URLSearchParams({
      query: encodeURIComponent(query),
      limit: String(options.limit || 20),
      ...(options.type && { type: this.getTypeId(options.type) }),
    });

    try {
      const response = await this.client.get(`/search?${params}`);
      const results = response.data.MediaContainer.Metadata || [];

      return results.map(this.mapMediaItem);
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  // Get collections from a library
  async getCollections(libraryKey: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/library/sections/${libraryKey}/collections`);

      return response.data.MediaContainer.Metadata || [];
    } catch (error) {
      throw new Error(`Failed to fetch collections: ${error.message}`);
    }
  }

  // Get recently added items
  async getRecentlyAdded(
    options: {
      type?: 'movie' | 'show';
      limit?: number;
    } = {}
  ): Promise<PlexMediaItem[]> {
    const params = new URLSearchParams({
      'X-Plex-Container-Start': '0',
      'X-Plex-Container-Size': String(options.limit || 20),
      ...(options.type && { type: this.getTypeId(options.type) }),
    });

    try {
      const response = await this.client.get(`/library/recentlyAdded?${params}`);
      const items = response.data.MediaContainer.Metadata || [];

      return items.map(this.mapMediaItem);
    } catch (error) {
      throw new Error(`Failed to fetch recently added: ${error.message}`);
    }
  }

  // Helper to map Plex metadata to our interface
  private mapMediaItem(item: any): PlexMediaItem {
    return {
      ratingKey: item.ratingKey,
      key: item.key,
      guid: item.guid,
      type: item.type,
      title: item.title,
      summary: item.summary,
      year: item.year,
      thumb: item.thumb,
      art: item.art,
      duration: item.duration,
      addedAt: item.addedAt,
      updatedAt: item.updatedAt,
      viewCount: item.viewCount,
      lastViewedAt: item.lastViewedAt,
    };
  }

  // Helper to get numeric type ID
  private getTypeId(type: string): string {
    const typeMap: Record<string, string> = {
      movie: '1',
      show: '2',
      episode: '4',
    };
    return typeMap[type] || '1';
  }
}
```

### 2. Plex Service Layer

```typescript
// backend/src/services/plex.service.ts
import { PlexClient } from '@/integrations/plex/plex.client';
import { userRepository } from '@/repositories';
import { serviceConfigRepository } from '@/repositories';
import { logger } from '@/utils/logger';
import { AppError } from '@/utils/errors';

export class PlexService {
  private clients: Map<string, PlexClient> = new Map();

  async getClientForUser(userId: string): Promise<PlexClient> {
    // Check if we already have a client for this user
    if (this.clients.has(userId)) {
      return this.clients.get(userId)!;
    }

    // Get user's Plex token
    const user = await userRepository.findById(userId);
    if (!user || !user.plexToken) {
      throw new AppError('User not found or missing Plex token', 401);
    }

    // Get Plex server configuration
    const config = await serviceConfigRepository.findByName('plex');
    if (!config || !config.serviceUrl) {
      throw new AppError('Plex server not configured', 500);
    }

    // Create new client
    const client = new PlexClient(config.serviceUrl, user.plexToken);

    // Test connection
    try {
      await client.testConnection();
      this.clients.set(userId, client);
      return client;
    } catch (error) {
      logger.error('Failed to connect to Plex', { userId, error });
      throw new AppError('Failed to connect to Plex server', 503);
    }
  }

  // Clean up idle clients periodically
  cleanupIdleClients(): void {
    // Implementation for cleaning up unused clients
  }
}

export const plexService = new PlexService();
```

### 3. Circuit Breaker Implementation

```typescript
// backend/src/integrations/plex/circuit-breaker.ts
import { logger } from '@/utils/logger';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: number;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime! > this.options.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
      logger.warn('Circuit breaker opened', {
        failureCount: this.failureCount,
        threshold: this.options.failureThreshold,
      });
    }
  }
}
```

### 4. Retry Logic with Exponential Backoff

```typescript
// backend/src/utils/retry.ts
export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < options.maxAttempts) {
        const delay = Math.min(
          options.initialDelay * Math.pow(options.factor, attempt - 1),
          options.maxDelay
        );

        logger.debug('Retrying after delay', { attempt, delay });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

## Technical Implementation Details

### Authentication Methods

- **Primary**: X-Plex-Token header (recommended)
- **Alternative**: X-Plex-Token as query parameter (for legacy compatibility)
- **Security**: Tokens grant full server access - never expose in logs or client-side code
- **Token Scope**: Each token is tied to specific user/device permissions

### Connection Management

- Use HTTP Agent with keep-alive for connection pooling
- Maximum 10 concurrent connections per Plex server
- 3-second timeout for all requests
- Automatic retry with exponential backoff

### Caching Strategy

- Cache server info for 1 hour
- Cache library list for 5 minutes
- Cache search results for 1 minute
- Use Redis for distributed caching

### Error Handling

- Network errors: Retry with backoff
- 401 errors: Invalid or expired token (requires re-authentication)
- 404 errors: Resource not found
- 503 errors: Circuit breaker activates
- All errors logged with context

## Acceptance Criteria

1. ✅ Plex client connects successfully with user token
2. ✅ Libraries can be fetched and cached
3. ✅ Media items retrieved with pagination
4. ✅ Search works across all libraries
5. ✅ Collections accessible from libraries
6. ✅ Circuit breaker prevents cascade failures
7. ✅ Connection pooling improves performance
8. ✅ All errors handled gracefully

## Testing Requirements

1. **Unit Tests:**

   - Client initialization
   - API method functionality
   - Error handling scenarios
   - Circuit breaker behavior

2. **Integration Tests:**
   - Real Plex server connection
   - Authentication flow
   - Data retrieval accuracy
   - Performance under load

## Dependencies

- `axios` - HTTP client
- `https` - Node.js HTTPS agent
- Existing cache service
- User repository for tokens

## References

- [Plex API Documentation](https://www.plexapp.com/developers/docs/)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [HTTP Keep-Alive Best Practices](https://nodejs.org/api/http.html#http_new_agent_options)

## Status

- [ ] Not Started
- [ ] In Progress
- [x] Completed
- [ ] Blocked

## Implementation Summary (MVP)

### What Was Built

1. **Simplified Plex Client** (`backend/src/integrations/plex/plex.client.ts`)

   - Basic authentication with X-Plex-Token
   - Essential endpoints only: server info, libraries, search, browse, recently added
   - 5-second timeout for all requests
   - Simple error handling with user-friendly messages

2. **Plex Service Layer** (`backend/src/services/plex.service.ts`)

   - User token management with encryption
   - Redis caching for performance (1hr server info, 5min libraries, 1min search)
   - Client connection pooling with periodic cleanup
   - Graceful error handling

3. **API Routes** (`backend/src/routes/v1/plex.ts`)
   - GET /api/v1/plex/server - Server information
   - GET /api/v1/plex/libraries - List all libraries
   - GET /api/v1/plex/libraries/:key/items - Browse library with pagination
   - GET /api/v1/plex/search - Search across libraries
   - GET /api/v1/plex/recently-added - Recently added items

### MVP Simplifications

- No complex circuit breaker pattern - just simple retry logic
- Basic HTTP timeout handling instead of advanced connection management
- Simple caching strategy with Redis
- No advanced media metadata processing
- No collection management in MVP (can be added later)

### Test Coverage

- Unit tests for client methods
- Integration tests with MSW mocking
- Focus on critical paths: connection, library access, search
