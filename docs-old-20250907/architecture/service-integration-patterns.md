# MediaNest Service Integration Patterns

## Overview

MediaNest implements sophisticated service integration patterns to manage external dependencies, ensure resilience, and maintain consistent communication across multiple service boundaries. This document outlines the integration architecture, patterns, and implementation strategies.

## Integration Architecture

### Service Integration Map

```
┌─────────────────────────────────────────────────────────────┐
│                    MediaNest Core                           │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   Frontend      │    │    Backend      │                │
│  │   (Next.js)     │    │  (Express.js)   │                │
│  └─────────────────┘    └─────────────────┘                │
│           │                       │                        │
│           │              ┌────────┴──────────┐             │
│           │              │ Integration Layer │             │
│           │              └────────┬──────────┘             │
│           │                       │                        │
├───────────┼───────────────────────┼────────────────────────┤
│ External Services             Service Integrations         │
│                                   │                        │
│ ┌─────────────────┐      ┌────────┴──────────┐             │
│ │  Plex Media     │◄─────┤  OAuth Provider   │             │
│ │    Server       │      │   + API Client    │             │
│ └─────────────────┘      └───────────────────┘             │
│                                   │                        │
│ ┌─────────────────┐      ┌────────┴──────────┐             │
│ │   Overseerr     │◄─────┤   REST Client     │             │
│ │ Media Requests  │      │  + Webhook Handler│             │
│ └─────────────────┘      └───────────────────┘             │
│                                   │                        │
│ ┌─────────────────┐      ┌────────┴──────────┐             │
│ │  Uptime Kuma    │◄─────┤ Monitoring Client │             │
│ │   Monitoring    │      │ + Status Polling  │             │
│ └─────────────────┘      └───────────────────┘             │
│                                   │                        │
│ ┌─────────────────┐      ┌────────┴──────────┐             │
│ │  YouTube-DL     │◄─────┤  Process Manager  │             │
│ │   Downloader    │      │  + Job Queue      │             │
│ └─────────────────┘      └───────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## Integration Patterns

### 1. Circuit Breaker Pattern

Implements fault tolerance for external service calls using the Opossum library.

```typescript
// Circuit Breaker Configuration
const circuitBreakerConfig = {
  timeout: 3000, // Request timeout
  errorThresholdPercentage: 50, // Error rate threshold
  resetTimeout: 30000, // Reset attempt interval
  rollingCountTimeout: 10000, // Rolling window
  rollingCountBuckets: 10, // Window subdivisions
  volumeThreshold: 10, // Minimum requests for circuit opening
};

// Implementation Example
class PlexIntegration {
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = new CircuitBreaker(this.makeApiCall.bind(this), circuitBreakerConfig);

    // Event handlers
    this.circuitBreaker.on('open', () => {
      logger.warn('Plex service circuit breaker opened');
    });

    this.circuitBreaker.on('close', () => {
      logger.info('Plex service circuit breaker closed');
    });
  }

  async getLibraries(): Promise<PlexLibrary[]> {
    try {
      return await this.circuitBreaker.fire('/library/sections');
    } catch (error) {
      // Fallback or cached response
      return this.getCachedLibraries();
    }
  }
}
```

### 2. Retry Pattern with Exponential Backoff

Implements intelligent retry logic for transient failures.

```typescript
class RetryableHttpClient {
  private async makeRequestWithRetry<T>(
    requestFn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const { maxRetries = 3, baseDelay = 1000, maxDelay = 30000 } = options;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        if (attempt === maxRetries || !this.isRetryableError(error)) {
          throw error;
        }

        const delay = Math.min(
          baseDelay * Math.pow(2, attempt), // Exponential backoff
          maxDelay
        );

        await this.sleep(delay + Math.random() * 1000); // Jitter
      }
    }

    throw new Error('Max retries exceeded');
  }

  private isRetryableError(error: any): boolean {
    // Network errors, timeouts, 5xx status codes
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'TIMEOUT' ||
      (error.response && error.response.status >= 500)
    );
  }
}
```

### 3. Service Registry Pattern

Centralized service configuration and discovery.

```typescript
// Service Registry Configuration
interface ServiceConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retryConfig: RetryOptions;
  circuitBreakerConfig: CircuitBreakerConfig;
  healthCheckPath: string;
  enabled: boolean;
}

class ServiceRegistry {
  private services = new Map<string, ServiceConfig>();

  constructor() {
    this.initializeServices();
  }

  private initializeServices(): void {
    // Plex Service
    this.registerService('plex', {
      name: 'Plex Media Server',
      baseUrl: config.PLEX_SERVER_URL,
      apiKey: config.PLEX_DEFAULT_TOKEN,
      timeout: 5000,
      retryConfig: { maxRetries: 2, baseDelay: 1000 },
      circuitBreakerConfig: { timeout: 3000, errorThresholdPercentage: 50 },
      healthCheckPath: '/status/sessions',
      enabled: config.PLEX_ENABLED,
    });

    // Overseerr Service
    this.registerService('overseerr', {
      name: 'Overseerr',
      baseUrl: config.OVERSEERR_URL,
      apiKey: config.OVERSEERR_API_KEY,
      timeout: 10000,
      retryConfig: { maxRetries: 3, baseDelay: 2000 },
      circuitBreakerConfig: { timeout: 5000, errorThresholdPercentage: 30 },
      healthCheckPath: '/api/v1/status',
      enabled: config.OVERSEERR_ENABLED,
    });
  }

  getService(name: string): ServiceConfig | undefined {
    return this.services.get(name);
  }

  isServiceEnabled(name: string): boolean {
    const service = this.services.get(name);
    return service?.enabled || false;
  }
}
```

### 4. Event-Driven Integration Pattern

Implements event-based communication for loose coupling.

```typescript
// Event System for Service Integration
class ServiceEventEmitter extends EventEmitter {
  // Service health events
  emitServiceUp(serviceName: string): void {
    this.emit('service:up', { service: serviceName, timestamp: new Date() });
  }

  emitServiceDown(serviceName: string, error: Error): void {
    this.emit('service:down', {
      service: serviceName,
      error: error.message,
      timestamp: new Date(),
    });
  }

  // Media events
  emitMediaRequested(request: MediaRequest): void {
    this.emit('media:requested', request);
  }

  emitMediaAvailable(media: MediaItem): void {
    this.emit('media:available', media);
  }

  // Download events
  emitDownloadStarted(download: YoutubeDownload): void {
    this.emit('download:started', download);
  }

  emitDownloadCompleted(download: YoutubeDownload): void {
    this.emit('download:completed', download);
  }
}

// Service Integration Event Handlers
class IntegrationEventHandlers {
  constructor(private eventEmitter: ServiceEventEmitter) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle service status changes
    this.eventEmitter.on('service:down', async (event) => {
      await this.handleServiceDown(event);
    });

    // Handle media availability notifications
    this.eventEmitter.on('media:available', async (media) => {
      await this.notifyPlexOfNewMedia(media);
    });

    // Handle download completion
    this.eventEmitter.on('download:completed', async (download) => {
      await this.createPlexCollection(download);
    });
  }

  private async handleServiceDown(event: ServiceDownEvent): Promise<void> {
    // Log the event
    logger.error(`Service ${event.service} is down: ${event.error}`);

    // Update service status in database
    await this.updateServiceStatus(event.service, 'down', event.error);

    // Send notification to admin users
    await this.notifyAdmins(`Service ${event.service} is unavailable`);

    // Trigger backup procedures if applicable
    if (event.service === 'plex') {
      await this.enablePlexBackupMode();
    }
  }
}
```

### 5. API Gateway Pattern (Internal)

Centralized API management and routing for external service calls.

```typescript
class InternalApiGateway {
  private serviceClients = new Map<string, HttpClient>();
  private requestQueue = new Map<string, RequestQueue>();

  constructor(private serviceRegistry: ServiceRegistry) {
    this.initializeServiceClients();
  }

  async makeServiceCall<T>(
    serviceName: string,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const service = this.serviceRegistry.getService(serviceName);
    if (!service || !service.enabled) {
      throw new ServiceUnavailableError(`Service ${serviceName} is not available`);
    }

    const client = this.serviceClients.get(serviceName);
    if (!client) {
      throw new Error(`No client configured for service ${serviceName}`);
    }

    // Add to request queue if rate limiting is needed
    if (this.shouldRateLimit(serviceName)) {
      await this.queueRequest(serviceName, endpoint);
    }

    try {
      const response = await client.request<T>(endpoint, options);
      this.recordSuccessfulRequest(serviceName);
      return response;
    } catch (error) {
      this.recordFailedRequest(serviceName, error);
      throw error;
    }
  }

  private shouldRateLimit(serviceName: string): boolean {
    const limits = this.getRateLimits(serviceName);
    return this.isRateLimitExceeded(serviceName, limits);
  }
}
```

### 6. Health Check Pattern

Comprehensive service health monitoring and status reporting.

```typescript
interface ServiceHealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime: number;
  lastCheck: Date;
  errorMessage?: string;
  uptime?: number;
  metadata?: Record<string, any>;
}

class HealthCheckService {
  private healthCache = new Map<string, ServiceHealthStatus>();
  private checkIntervals = new Map<string, NodeJS.Timeout>();

  constructor(private serviceRegistry: ServiceRegistry) {
    this.initializeHealthChecks();
  }

  private initializeHealthChecks(): void {
    const services = this.serviceRegistry.getAllServices();

    for (const service of services) {
      if (service.enabled) {
        this.startHealthCheck(service.name);
      }
    }
  }

  private startHealthCheck(serviceName: string): void {
    // Perform initial check
    this.performHealthCheck(serviceName);

    // Schedule recurring checks
    const interval = setInterval(
      () => this.performHealthCheck(serviceName),
      30000 // 30 seconds
    );

    this.checkIntervals.set(serviceName, interval);
  }

  private async performHealthCheck(serviceName: string): Promise<void> {
    const service = this.serviceRegistry.getService(serviceName);
    if (!service) return;

    const startTime = Date.now();
    let status: ServiceHealthStatus;

    try {
      // Make health check request
      await this.makeHealthCheckRequest(service);

      status = {
        service: serviceName,
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
      };
    } catch (error: any) {
      status = {
        service: serviceName,
        status: this.determineErrorStatus(error),
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        errorMessage: error.message,
      };
    }

    // Update cache and emit events
    this.healthCache.set(serviceName, status);
    this.emitHealthStatusEvent(status);
  }

  private determineErrorStatus(error: any): 'degraded' | 'unhealthy' {
    // Network timeouts = degraded
    if (error.code === 'TIMEOUT' || error.code === 'ECONNRESET') {
      return 'degraded';
    }

    // Authentication or service errors = unhealthy
    if (error.response?.status === 401 || error.response?.status === 403) {
      return 'unhealthy';
    }

    // 5xx errors = degraded
    if (error.response?.status >= 500) {
      return 'degraded';
    }

    return 'unhealthy';
  }

  getHealthStatus(serviceName: string): ServiceHealthStatus | undefined {
    return this.healthCache.get(serviceName);
  }

  getAllHealthStatuses(): ServiceHealthStatus[] {
    return Array.from(this.healthCache.values());
  }
}
```

## Service-Specific Integration Patterns

### Plex Media Server Integration

#### OAuth Authentication Flow

```typescript
class PlexOAuthService {
  async initiateOAuthFlow(): Promise<{ pinId: string; code: string }> {
    const pinResponse = await this.createPin();
    return {
      pinId: pinResponse.id,
      code: pinResponse.code,
    };
  }

  async pollForToken(pinId: string): Promise<string | null> {
    const response = await this.checkPin(pinId);
    if (response.authToken) {
      await this.validateToken(response.authToken);
      return response.authToken;
    }
    return null;
  }

  private async createPin(): Promise<PlexPin> {
    return await this.httpClient.post('/pins', {
      'X-Plex-Product': config.PLEX_CLIENT_ID,
      'X-Plex-Client-Identifier': config.PLEX_CLIENT_IDENTIFIER,
    });
  }
}
```

#### Library Management

```typescript
class PlexLibraryService {
  async getLibraries(): Promise<PlexLibrary[]> {
    const response = await this.apiGateway.makeServiceCall<PlexLibraryResponse>(
      'plex',
      '/library/sections'
    );

    return response.MediaContainer.Directory.map(this.transformLibrary);
  }

  async searchMedia(query: string, libraryId?: string): Promise<PlexMedia[]> {
    const searchEndpoint = libraryId
      ? `/library/sections/${libraryId}/search?query=${encodeURIComponent(query)}`
      : `/search?query=${encodeURIComponent(query)}`;

    const response = await this.apiGateway.makeServiceCall<PlexSearchResponse>(
      'plex',
      searchEndpoint
    );

    return response.MediaContainer.Metadata || [];
  }
}
```

### Overseerr Integration

#### Media Request Management

```typescript
class OverseerrIntegrationService {
  async submitMediaRequest(request: MediaRequestData): Promise<OverseerrRequest> {
    const overseerrRequest = await this.apiGateway.makeServiceCall<OverseerrRequest>(
      'overseerr',
      '/api/v1/request',
      {
        method: 'POST',
        body: this.transformToOverseerrFormat(request),
      }
    );

    // Store local reference
    await this.mediaRequestRepository.updateOverseerrId(request.id, overseerrRequest.id);

    return overseerrRequest;
  }

  async syncRequestStatus(): Promise<void> {
    const pendingRequests = await this.mediaRequestRepository.findPending();

    for (const request of pendingRequests) {
      if (request.overseerrId) {
        const overseerrStatus = await this.getOverseerrRequestStatus(request.overseerrId);

        if (overseerrStatus !== request.status) {
          await this.updateLocalRequestStatus(request.id, overseerrStatus);
        }
      }
    }
  }
}
```

### YouTube Download Integration

#### Process Management Pattern

```typescript
class YouTubeDownloadService {
  private activeDownloads = new Map<string, ChildProcess>();

  async startDownload(downloadRequest: YoutubeDownload): Promise<void> {
    const command = this.buildYtDlpCommand(downloadRequest);
    const process = spawn('yt-dlp', command.args, command.options);

    this.activeDownloads.set(downloadRequest.id, process);

    // Handle process events
    process.on('exit', (code) => {
      this.handleDownloadComplete(downloadRequest.id, code);
    });

    process.on('error', (error) => {
      this.handleDownloadError(downloadRequest.id, error);
    });

    // Parse progress from stdout
    process.stdout?.on('data', (data) => {
      this.parseProgressUpdate(downloadRequest.id, data.toString());
    });
  }

  private async handleDownloadComplete(downloadId: string, exitCode: number | null): Promise<void> {
    this.activeDownloads.delete(downloadId);

    if (exitCode === 0) {
      const download = await this.downloadRepository.findById(downloadId);
      if (download) {
        await this.moveFilesToPlexLibrary(download);
        await this.createPlexCollection(download);
      }
    } else {
      await this.markDownloadFailed(downloadId, `Process exited with code ${exitCode}`);
    }
  }
}
```

## Error Handling and Resilience Patterns

### Graceful Degradation

```typescript
class ServiceFallbackHandler {
  async getMediaWithFallback(mediaId: string): Promise<MediaItem | null> {
    try {
      // Primary: Get from Plex
      return await this.plexService.getMedia(mediaId);
    } catch (error) {
      logger.warn('Plex unavailable, trying Overseerr', { error });

      try {
        // Secondary: Get from Overseerr
        return await this.overseerrService.getMedia(mediaId);
      } catch (fallbackError) {
        logger.warn('Overseerr unavailable, using cache', { fallbackError });

        // Tertiary: Get from cache
        return await this.getCachedMedia(mediaId);
      }
    }
  }
}
```

### Bulkhead Pattern

```typescript
class ServiceBulkhead {
  private executorPools = new Map<string, ThreadPool>();

  constructor() {
    // Separate thread pools for different service types
    this.executorPools.set('plex', new ThreadPool(5)); // Media operations
    this.executorPools.set('downloads', new ThreadPool(2)); // Download operations
    this.executorPools.set('monitoring', new ThreadPool(3)); // Health checks
  }

  async executeWithBulkhead<T>(serviceType: string, operation: () => Promise<T>): Promise<T> {
    const pool = this.executorPools.get(serviceType);
    if (!pool) {
      throw new Error(`No bulkhead configured for ${serviceType}`);
    }

    return await pool.execute(operation);
  }
}
```

## Integration Testing Patterns

### Contract Testing

```typescript
describe('Plex Integration Contract', () => {
  test('should match expected API response format', async () => {
    const mockResponse = {
      MediaContainer: {
        Directory: [
          {
            key: '1',
            title: 'Movies',
            type: 'movie',
          },
        ],
      },
    };

    // Mock the external service
    plexApiMock.onGet('/library/sections').reply(200, mockResponse);

    const libraries = await plexService.getLibraries();

    expect(libraries).toMatchSchema(PlexLibrarySchema);
    expect(libraries[0]).toHaveProperty('id', '1');
  });
});
```

### Integration Test with MSW

```typescript
const server = setupServer(
  rest.get(`${config.PLEX_SERVER_URL}/library/sections`, (req, res, ctx) => {
    return res(ctx.json(mockPlexLibrariesResponse));
  }),

  rest.post(`${config.OVERSEERR_URL}/api/v1/request`, (req, res, ctx) => {
    return res(ctx.json(mockOverseerrRequestResponse));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

These service integration patterns provide MediaNest with a robust, resilient, and maintainable approach to external service management while ensuring system reliability and performance.
