# Task: Overseerr API Integration

**Priority:** High  
**Estimated Duration:** 2 days  
**Dependencies:** Plex API client  
**Phase:** 2 (Week 6)

## Objective

Integrate with Overseerr API to enable media request functionality, allowing users to search for and request movies/TV shows that aren't currently available in the Plex library.

## Background

Overseerr provides a user-friendly interface for managing Plex media requests. Our integration will proxy search requests, submit new media requests, and track request status through webhooks.

### Key Limitations & Workarounds

- **TV Show Requests**: Overseerr only supports full-season requests to Sonarr, which can fail for currently airing seasons
- **Webhook Integration**: Custom JSON payloads enable real-time status updates and workarounds for incomplete seasons
- **2024 Enhancement**: Third-party solutions monitor TV requests and trigger individual episode searches when season packs are unavailable

## Detailed Requirements

### 1. Overseerr Client Implementation

```typescript
// backend/src/integrations/overseerr/overseerr.client.ts
import axios, { AxiosInstance } from 'axios';
import { logger } from '@/utils/logger';
import { retryWithBackoff } from '@/utils/retry';

export interface OverseerrConfig {
  url: string;
  apiKey: string;
}

export interface MediaSearchResult {
  id: number;
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  imdbId?: string;
  title: string;
  originalTitle?: string;
  releaseDate?: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  genres?: string[];
  status?: string;
  mediaInfo?: {
    status: number; // 1=unknown, 2=pending, 3=processing, 4=partially available, 5=available
    requests?: RequestInfo[];
  };
}

export interface RequestInfo {
  id: number;
  status: number; // 1=pending approval, 2=approved, 3=declined
  media: {
    tmdbId: number;
    tvdbId?: number;
    imdbId?: string;
    status: number;
    type: 'movie' | 'tv';
  };
  requestedBy: {
    id: number;
    email: string;
    username: string;
  };
  modifiedBy?: {
    id: number;
    email: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MediaRequest {
  mediaType: 'movie' | 'tv';
  mediaId: number;
  tvdbId?: number;
  seasons?: number[];
  is4k?: boolean;
  serverId?: number;
  profileId?: number;
  rootFolder?: string;
}

export class OverseerrClient {
  private client: AxiosInstance;

  constructor(private config: OverseerrConfig) {
    this.client = axios.create({
      baseURL: config.url.replace(/\/$/, '') + '/api/v1',
      timeout: 5000,
      headers: {
        'X-Api-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        logger.error('Overseerr API error', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  // Test connection to Overseerr
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/status');
      return response.data.status === 'ok';
    } catch (error) {
      logger.error('Overseerr connection test failed', { error });
      return false;
    }
  }

  // Search for media
  async searchMedia(
    query: string,
    page = 1
  ): Promise<{
    results: MediaSearchResult[];
    totalPages: number;
    totalResults: number;
  }> {
    return retryWithBackoff(
      async () => {
        const response = await this.client.get('/search', {
          params: { query, page },
        });

        return {
          results: response.data.results.map(this.mapSearchResult),
          totalPages: response.data.totalPages,
          totalResults: response.data.totalResults,
        };
      },
      {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        factor: 2,
      }
    );
  }

  // Get media details
  async getMediaDetails(mediaType: 'movie' | 'tv', tmdbId: number): Promise<MediaSearchResult> {
    const response = await this.client.get(`/${mediaType}/${tmdbId}`);
    return this.mapSearchResult(response.data);
  }

  // Submit media request
  async requestMedia(request: MediaRequest): Promise<RequestInfo> {
    try {
      const response = await this.client.post('/request', request);
      return response.data;
    } catch (error) {
      if (error.response?.status === 409) {
        throw new Error('Media already requested');
      }
      throw error;
    }
  }

  // Get user's requests
  async getUserRequests(
    userId: string,
    options: {
      take?: number;
      skip?: number;
      filter?: 'all' | 'pending' | 'approved' | 'processing' | 'available';
      sort?: 'added' | 'modified';
    } = {}
  ): Promise<{
    results: RequestInfo[];
    pageInfo: {
      pages: number;
      pageSize: number;
      results: number;
      page: number;
    };
  }> {
    const response = await this.client.get('/request', {
      params: {
        take: options.take || 20,
        skip: options.skip || 0,
        filter: options.filter || 'all',
        sort: options.sort || 'added',
        requestedBy: userId,
      },
    });

    return response.data;
  }

  // Delete request (if user owns it)
  async deleteRequest(requestId: number): Promise<void> {
    await this.client.delete(`/request/${requestId}`);
  }

  // Update request status (admin only)
  async updateRequestStatus(
    requestId: number,
    status: 'approve' | 'decline'
  ): Promise<RequestInfo> {
    const response = await this.client.post(`/request/${requestId}/${status}`);
    return response.data;
  }

  // Helper to map Overseerr data to our interface
  private mapSearchResult(data: any): MediaSearchResult {
    return {
      id: data.id,
      mediaType: data.mediaType,
      tmdbId: data.tmdbId || data.id,
      imdbId: data.imdbId,
      title: data.title || data.name,
      originalTitle: data.originalTitle || data.originalName,
      releaseDate: data.releaseDate || data.firstAirDate,
      overview: data.overview,
      posterPath: data.posterPath,
      backdropPath: data.backdropPath,
      genres: data.genres?.map((g: any) => g.name),
      status: data.status,
      mediaInfo: data.mediaInfo,
    };
  }
}
```

### 2. Overseerr Service Layer

```typescript
// backend/src/services/overseerr.service.ts
import { OverseerrClient } from '@/integrations/overseerr/overseerr.client';
import { serviceConfigRepository } from '@/repositories';
import { mediaRequestRepository } from '@/repositories';
import { cacheService } from '@/services/cache.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/utils/errors';
import { socketService } from '@/services/socket.service';

export class OverseerrService {
  private client?: OverseerrClient;
  private isAvailable = false;

  async initialize(): Promise<void> {
    try {
      const config = await serviceConfigRepository.findByName('overseerr');
      if (!config || !config.enabled) {
        logger.warn('Overseerr service is disabled');
        return;
      }

      this.client = new OverseerrClient({
        url: config.serviceUrl,
        apiKey: config.apiKey!,
      });

      this.isAvailable = await this.client.testConnection();
      logger.info('Overseerr service initialized', { available: this.isAvailable });
    } catch (error) {
      logger.error('Failed to initialize Overseerr', { error });
      this.isAvailable = false;
    }
  }

  async searchMedia(query: string, page = 1): Promise<any> {
    this.ensureAvailable();

    // Check cache first
    const cacheKey = `overseerr:search:${query}:${page}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const results = await this.client!.searchMedia(query, page);

      // Cache for 1 minute
      await cacheService.set(cacheKey, results, { ttl: 60 });

      return results;
    } catch (error) {
      logger.error('Media search failed', { query, error });
      throw new AppError('Failed to search media', 503);
    }
  }

  async requestMedia(
    userId: string,
    request: {
      mediaType: 'movie' | 'tv';
      tmdbId: number;
      seasons?: number[];
    }
  ): Promise<any> {
    this.ensureAvailable();

    try {
      // Check if already requested
      const existing = await mediaRequestRepository.findByTmdbId(request.tmdbId, request.mediaType);

      if (existing) {
        throw new AppError('Media already requested', 409);
      }

      // Submit to Overseerr
      const overseerrRequest = await this.client!.requestMedia({
        mediaType: request.mediaType,
        mediaId: request.tmdbId,
        seasons: request.seasons,
      });

      // Save to our database
      const savedRequest = await mediaRequestRepository.create({
        userId,
        tmdbId: request.tmdbId,
        mediaType: request.mediaType,
        title:
          overseerrRequest.media.type === 'movie'
            ? overseerrRequest.media.title
            : overseerrRequest.media.name,
        status: 'pending',
        overseerrId: String(overseerrRequest.id),
      });

      // Notify user via WebSocket
      socketService.emitToUser(userId, 'request:created', savedRequest);

      return savedRequest;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to request media', { userId, request, error });
      throw new AppError('Failed to submit media request', 500);
    }
  }

  async getUserRequests(userId: string, options: any = {}): Promise<any> {
    // Try to get from Overseerr if available
    if (this.isAvailable && this.client) {
      try {
        return await this.client.getUserRequests(userId, options);
      } catch (error) {
        logger.warn('Failed to get requests from Overseerr, falling back to local', { error });
      }
    }

    // Fallback to local database
    return mediaRequestRepository.findByUser(userId, options);
  }

  // Webhook handler for status updates
  async handleWebhook(payload: any): Promise<void> {
    logger.info('Received Overseerr webhook', { type: payload.notification_type });

    // Webhook notification types:
    // - MEDIA_PENDING: New request created
    // - MEDIA_APPROVED: Request approved by admin
    // - MEDIA_AVAILABLE: Media downloaded and available
    // - MEDIA_FAILED: Request failed to process
    // - MEDIA_DECLINED: Request declined by admin

    if (
      payload.notification_type === 'MEDIA_APPROVED' ||
      payload.notification_type === 'MEDIA_AVAILABLE'
    ) {
      const request = await mediaRequestRepository.findByOverseerrId(String(payload.request?.id));

      if (request) {
        const newStatus = payload.notification_type === 'MEDIA_APPROVED' ? 'approved' : 'available';

        await mediaRequestRepository.update(request.id, {
          status: newStatus,
          completedAt: new Date(),
        });

        // Notify user
        socketService.emitToUser(request.userId, 'request:update', {
          requestId: request.id,
          status: newStatus,
          mediaTitle: payload.media?.name || payload.media?.title,
        });
      }
    }
  }

  private ensureAvailable(): void {
    if (!this.isAvailable || !this.client) {
      throw new AppError('Overseerr service unavailable', 503);
    }
  }
}

export const overseerrService = new OverseerrService();
```

### 3. Request Queue for Offline Periods

```typescript
// backend/src/jobs/media-request.queue.ts
import Bull from 'bull';
import { overseerrService } from '@/services/overseerr.service';
import { mediaRequestRepository } from '@/repositories';
import { logger } from '@/utils/logger';

export const mediaRequestQueue = new Bull('media-requests', {
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

// Process queued requests
mediaRequestQueue.process(async (job) => {
  const { userId, request } = job.data;

  try {
    logger.info('Processing queued media request', { userId, request });

    const result = await overseerrService.requestMedia(userId, request);

    return result;
  } catch (error) {
    logger.error('Failed to process media request', { error, jobId: job.id });

    // Retry with exponential backoff
    if (job.attemptsMade < 5) {
      throw error; // Bull will retry
    }

    // Mark as failed after max retries
    await mediaRequestRepository.update(request.id, {
      status: 'failed',
      error: error.message,
    });
  }
});

// Queue request when Overseerr is down
export async function queueMediaRequest(userId: string, request: any): Promise<void> {
  await mediaRequestQueue.add(
    { userId, request },
    {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );
}
```

### 4. Webhook Endpoint

```typescript
// backend/src/routes/v1/webhooks.ts
import { Router } from 'express';
import { overseerrService } from '@/services/overseerr.service';
import { logger } from '@/utils/logger';

const router = Router();

// Overseerr webhook endpoint
router.post('/overseerr', async (req, res) => {
  try {
    // Verify webhook signature if configured
    const signature = req.headers['x-overseerr-signature'];
    // TODO: Implement signature verification

    logger.info('Received Overseerr webhook', {
      type: req.body.notification_type,
      media: req.body.media,
    });

    await overseerrService.handleWebhook(req.body);

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Webhook processing failed', { error });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
```

### 5. TV Show Episode Workaround (Optional Enhancement)

```typescript
// backend/src/jobs/tv-episode-monitor.job.ts
import { overseerrService } from '@/services/overseerr.service';
import { sonarrService } from '@/services/sonarr.service';
import { logger } from '@/utils/logger';

// Monitor TV show requests for incomplete seasons
export async function monitorTVRequests(): Promise<void> {
  // This addresses the limitation where Overseerr only sends
  // full-season requests to Sonarr, which fail for airing seasons

  const pendingTVRequests = await mediaRequestRepository.findPendingTV();

  for (const request of pendingTVRequests) {
    try {
      // Check if Sonarr found the season pack
      const hasSeasonPack = await sonarrService.checkSeasonAvailability(
        request.tmdbId,
        request.season
      );

      if (!hasSeasonPack && request.createdAt < Date.now() - 24 * 60 * 60 * 1000) {
        // After 24 hours, trigger individual episode searches
        logger.info('Triggering individual episode searches', {
          tmdbId: request.tmdbId,
          season: request.season,
        });

        await sonarrService.searchIndividualEpisodes(request.tmdbId, request.season);
      }
    } catch (error) {
      logger.error('Failed to monitor TV request', { request, error });
    }
  }
}

// Run every hour
setInterval(monitorTVRequests, 60 * 60 * 1000);
```

## Technical Implementation Details

### Error Handling Strategy

- **503 Service Unavailable**: Queue requests for later processing
- **409 Conflict**: Media already requested
- **401 Unauthorized**: Invalid API key
- **429 Rate Limited**: Implement exponential backoff

### Graceful Degradation

1. If Overseerr is down:
   - Queue new requests in Bull
   - Show cached search results
   - Display local request history
2. Automatic retry with exponential backoff
3. User notification when service restored

### Caching Strategy

- Search results: 1 minute
- Media details: 5 minutes
- Request status: No cache (real-time)

## Acceptance Criteria

1. ✅ Overseerr client connects with API key
2. ✅ Media search returns TMDB results
3. ✅ Requests submitted successfully
4. ✅ Request status tracked via webhooks
5. ✅ Queue system handles offline periods
6. ✅ User notifications for status changes
7. ✅ Graceful degradation when unavailable
8. ✅ Error messages are user-friendly

## Testing Requirements

1. **Unit Tests:**
   - Client methods
   - Service layer logic
   - Queue processing
   - Webhook handling

2. **Integration Tests:**
   - Real Overseerr connection
   - Request submission flow
   - Webhook processing
   - Offline queue behavior

## Dependencies

- `axios` - HTTP client
- `bull` - Job queue
- Existing cache service
- Media request repository

## References

- [Overseerr API Documentation](https://docs.overseerr.dev/using-overseerr/api)
- [TMDB API](https://developers.themoviedb.org/3)
- [Webhook Best Practices](https://webhooks.dev/)

## Status

- [ ] Not Started
- [ ] In Progress
- [x] Completed
- [ ] Blocked

## Implementation Summary (MVP)

### What Was Built

1. **Simplified Overseerr Client** (`backend/src/integrations/overseerr/overseerr.client.ts`)
   - Basic API client with essential endpoints
   - Search media functionality
   - Submit media requests
   - Get user requests with pagination
   - Simple error handling with retry

2. **Overseerr Service Layer** (`backend/src/services/overseerr.service.ts`)
   - Service initialization with availability checking
   - Media search with caching (1 minute)
   - Request submission with duplicate checking
   - Webhook handling for status updates
   - Graceful degradation when service unavailable

3. **API Routes** (`backend/src/routes/v1/media.ts`)
   - GET /api/v1/media/search - Search for media
   - GET /api/v1/media/:mediaType/:tmdbId - Get media details
   - POST /api/v1/media/request - Submit media request
   - GET /api/v1/media/requests - Get user's requests
   - GET /api/v1/media/requests/:id - Get request details
   - DELETE /api/v1/media/requests/:id - Delete pending request

4. **Webhook Endpoint** (`backend/src/routes/v1/webhooks.ts`)
   - POST /api/v1/webhooks/overseerr - Receive status updates

### MVP Simplifications

- No complex TV episode workarounds
- Basic queue system - no advanced offline handling
- Simple webhook processing without signature verification (add in production)
- No profile/server selection for requests
- User requests stored locally for better filtering

### Test Coverage

- Unit tests for client methods
- Integration tests with MSW mocking
- Webhook handling tests
- Error scenario coverage
