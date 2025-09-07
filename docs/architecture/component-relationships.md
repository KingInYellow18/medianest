# MediaNest Component Relationships and Data Flow

## Overview

MediaNest follows a layered architecture with clear separation of concerns and well-defined component relationships. This document outlines the component interactions, data flow patterns, and architectural dependencies throughout the system.

## System Component Hierarchy

### High-Level Component Structure

```
MediaNest System
├── Presentation Layer (Frontend)
│   ├── Pages & Routes
│   ├── Components
│   ├── Contexts & State Management
│   └── API Clients
├── API Layer (Backend)
│   ├── Routes & Controllers
│   ├── Middleware Chain
│   ├── Authentication & Authorization
│   └── WebSocket Handlers
├── Business Logic Layer
│   ├── Services
│   ├── Integration Services
│   ├── Queue Processors
│   └── Event Handlers
├── Data Access Layer
│   ├── Repositories
│   ├── Database Models (Prisma)
│   └── Cache Managers
└── Infrastructure Layer
    ├── Database (PostgreSQL)
    ├── Cache (Redis)
    ├── Message Queue (Bull/BullMQ)
    └── External Service Clients
```

## Frontend Component Relationships

### Component Dependency Graph

```
App Layout
├── AuthProvider (Context)
│   ├── SessionContext
│   └── UserContext
├── QueryClient (React Query)
├── SocketProvider (Socket.IO)
│   └── Real-time Event Handlers
└── Page Components
    ├── Dashboard
    │   ├── ServiceStatusWidget
    │   ├── RecentRequestsWidget
    │   └── SystemHealthWidget
    ├── Media Management
    │   ├── PlexLibraryBrowser
    │   ├── MediaRequestForm
    │   └── RequestHistoryTable
    ├── YouTube Downloads
    │   ├── DownloadForm
    │   ├── ActiveDownloads
    │   └── DownloadHistory
    └── Admin Panel
        ├── UserManagement
        ├── ServiceConfiguration
        └── SystemLogs
```

### Data Flow in Frontend Components

#### Authentication Flow

```typescript
// Authentication Component Relationship
NextAuthProvider
  → useSession()
    → AuthGuard
      → ProtectedRoutes
        → Page Components
          → API Calls with Authorization Headers

// Implementation Pattern
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, status } = useSession();

  if (status === 'loading') return <LoadingSpinner />;
  if (status === 'unauthenticated') return <SignInForm />;

  return (
    <UserContext.Provider value={session.user}>
      {children}
    </UserContext.Provider>
  );
};
```

#### Real-time Data Flow

```typescript
// Socket.IO Integration Pattern
SocketProvider
  → useSocket() Hook
    → Event Listeners
      → State Updates
        → Component Re-renders

// Example: Download Progress Updates
const useDownloadProgress = (downloadId: string) => {
  const socket = useSocket();
  const [progress, setProgress] = useState<DownloadProgress>();

  useEffect(() => {
    socket.on(`download:progress:${downloadId}`, setProgress);
    return () => socket.off(`download:progress:${downloadId}`);
  }, [downloadId, socket]);

  return progress;
};
```

#### State Management Flow

```typescript
// React Query + Context Pattern
QueryClient
  ├── Server State (React Query)
  │   ├── Media Requests
  │   ├── Service Status
  │   └── User Data
  └── Client State (Context/useState)
      ├── UI State
      ├── Form State
      └── Navigation State

// Data Fetching Pattern
const useMediaRequests = (userId: string) => {
  return useQuery({
    queryKey: ['mediaRequests', userId],
    queryFn: () => api.getMediaRequests(userId),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};
```

## Backend Component Relationships

### Request Processing Flow

```
HTTP Request
    ↓
Express Router
    ↓
Middleware Chain
├── Correlation ID Middleware
├── Authentication Middleware
├── Rate Limiting Middleware
├── Validation Middleware
└── Security Headers Middleware
    ↓
Controller Layer
├── Request Validation (Zod)
├── Business Logic Delegation
└── Response Formatting
    ↓
Service Layer
├── Business Logic Processing
├── External Service Integration
├── Database Operations
└── Event Emission
    ↓
Repository Layer
├── Database Queries (Prisma)
├── Cache Operations (Redis)
└── Data Transformation
    ↓
Response/Error Handling
├── Success Response
├── Error Response
└── Logging & Monitoring
```

### Service Layer Architecture

#### Service Dependency Graph

```typescript
// Service Layer Component Relationships
IntegrationService (Main Orchestrator)
├── PlexService
│   ├── PlexOAuthService
│   ├── PlexLibraryService
│   └── PlexMetadataService
├── OverseerrService
│   ├── RequestManagementService
│   └── StatusSyncService
├── DownloadService
│   ├── YouTubeDownloadService
│   ├── FileManagementService
│   └── PlexCollectionService
├── MonitoringService
│   ├── HealthCheckService
│   ├── ServiceStatusService
│   └── AlertingService
└── UserService
    ├── AuthenticationService
    ├── SessionManagementService
    └── PermissionService

// Example: Media Request Processing Chain
class MediaRequestController {
  constructor(
    private mediaRequestService: MediaRequestService,
    private overseerrService: OverseerrService,
    private plexService: PlexService,
    private notificationService: NotificationService
  ) {}

  async createRequest(req: Request, res: Response): Promise<void> {
    // 1. Validate request
    const requestData = MediaRequestSchema.parse(req.body);

    // 2. Check if media already exists
    const existingMedia = await this.plexService.searchMedia(requestData.title);
    if (existingMedia.length > 0) {
      throw new ConflictError('Media already exists in library');
    }

    // 3. Create local request
    const request = await this.mediaRequestService.createRequest({
      ...requestData,
      userId: req.user.id
    });

    // 4. Submit to Overseerr
    const overseerrRequest = await this.overseerrService.submitRequest(request);

    // 5. Update local request with external ID
    await this.mediaRequestService.updateOverseerrId(
      request.id,
      overseerrRequest.id
    );

    // 6. Notify user
    await this.notificationService.sendRequestConfirmation(request);

    res.json({ success: true, request });
  }
}
```

### Repository Pattern Implementation

#### Data Access Layer

```typescript
// Repository Base Class
abstract class BaseRepository<T, CreateData, UpdateData> {
  constructor(protected prisma: PrismaClient) {}

  abstract findById(id: string): Promise<T | null>;
  abstract create(data: CreateData): Promise<T>;
  abstract update(id: string, data: UpdateData): Promise<T>;
  abstract delete(id: string): Promise<void>;
  abstract findMany(filters?: FilterOptions): Promise<T[]>;
}

// Specific Repository Implementation
class MediaRequestRepository extends BaseRepository<
  MediaRequest,
  CreateMediaRequest,
  UpdateMediaRequest
> {
  async findById(id: string): Promise<MediaRequest | null> {
    return await this.prisma.mediaRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async findPendingByUserId(userId: string): Promise<MediaRequest[]> {
    return await this.prisma.mediaRequest.findMany({
      where: {
        userId,
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: string): Promise<MediaRequest> {
    return await this.prisma.mediaRequest.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'completed' ? new Date() : null,
      },
    });
  }
}
```

## Data Flow Patterns

### 1. Request-Response Pattern

```
Client Request
    ↓
Frontend API Client
    ↓ (HTTP/HTTPS)
Backend API Endpoint
    ↓
Controller Validation
    ↓
Service Business Logic
    ↓
Repository Data Access
    ↓
Database/Cache Query
    ↓
Response Transformation
    ↓
HTTP Response
    ↓
Frontend State Update
    ↓
Component Re-render
```

### 2. Event-Driven Pattern

```
Business Event Trigger
    ↓
Event Emission (Service Layer)
    ↓
Event Handlers Registration
    ↓
Async Processing
├── Database Updates
├── External API Calls
├── Cache Invalidation
└── Real-time Notifications
    ↓
Socket.IO Broadcast
    ↓
Frontend Event Reception
    ↓
UI State Updates
```

### 3. Queue Processing Pattern

```
User Action (e.g., YouTube Download)
    ↓
Job Creation (Controller)
    ↓
Queue System (Bull/BullMQ)
    ↓
Background Worker Processing
├── Process Execution
├── Progress Updates
├── Error Handling
└── Completion Notification
    ↓
Database Status Update
    ↓
WebSocket Progress Broadcast
    ↓
Real-time UI Updates
```

## Component Communication Patterns

### 1. Synchronous Communication

```typescript
// Direct Method Calls
class MediaRequestService {
  constructor(
    private overseerrService: OverseerrService,
    private plexService: PlexService
  ) {}

  async processRequest(requestId: string): Promise<ProcessingResult> {
    // Synchronous service calls
    const request = await this.findById(requestId);
    const overseerrResponse = await this.overseerrService.submit(request);
    const plexSearch = await this.plexService.searchExisting(request.title);

    return {
      overseerrId: overseerrResponse.id,
      alreadyExists: plexSearch.length > 0,
    };
  }
}
```

### 2. Asynchronous Communication

```typescript
// Event-based Async Communication
class DownloadService extends EventEmitter {
  async startDownload(request: YoutubeDownload): Promise<void> {
    // Emit start event
    this.emit('download:started', request);

    // Process asynchronously
    setImmediate(async () => {
      try {
        const result = await this.processDownload(request);
        this.emit('download:completed', { request, result });
      } catch (error) {
        this.emit('download:failed', { request, error });
      }
    });
  }
}

// Event Handlers
class DownloadEventHandler {
  constructor(private downloadService: DownloadService) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.downloadService.on('download:completed', this.handleDownloadComplete.bind(this));
    this.downloadService.on('download:failed', this.handleDownloadFailed.bind(this));
  }

  private async handleDownloadComplete(event: DownloadCompleteEvent): Promise<void> {
    // Update database
    await this.updateDownloadStatus(event.request.id, 'completed');

    // Create Plex collection
    await this.createPlexCollection(event.request);

    // Notify user via WebSocket
    this.socketService.emit(`download:complete:${event.request.userId}`, event);
  }
}
```

### 3. Pub/Sub Pattern with Redis

```typescript
// Publisher
class EventPublisher {
  constructor(private redis: Redis) {}

  async publishEvent(channel: string, event: any): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(event));
  }
}

// Subscriber
class EventSubscriber {
  constructor(private redis: Redis) {
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    this.redis.subscribe('media:events', 'download:events', 'system:events');

    this.redis.on('message', (channel: string, message: string) => {
      const event = JSON.parse(message);
      this.handleEvent(channel, event);
    });
  }

  private async handleEvent(channel: string, event: any): Promise<void> {
    switch (channel) {
      case 'media:events':
        await this.handleMediaEvent(event);
        break;
      case 'download:events':
        await this.handleDownloadEvent(event);
        break;
    }
  }
}
```

## Dependency Injection and Inversion of Control

### Service Container Pattern

```typescript
// Service Container for Dependency Management
class ServiceContainer {
  private services = new Map<string, any>();
  private singletons = new Map<string, any>();

  register<T>(name: string, factory: () => T, singleton = false): void {
    this.services.set(name, { factory, singleton });
  }

  resolve<T>(name: string): T {
    const serviceConfig = this.services.get(name);
    if (!serviceConfig) {
      throw new Error(`Service ${name} not registered`);
    }

    if (serviceConfig.singleton) {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, serviceConfig.factory());
      }
      return this.singletons.get(name);
    }

    return serviceConfig.factory();
  }
}

// Service Registration
const container = new ServiceContainer();

// Register services
container.register('prisma', () => new PrismaClient(), true);
container.register('redis', () => new Redis(config.REDIS_URL), true);
container.register(
  'mediaRequestRepo',
  () => new MediaRequestRepository(container.resolve('prisma'))
);
container.register(
  'mediaRequestService',
  () =>
    new MediaRequestService(
      container.resolve('mediaRequestRepo'),
      container.resolve('overseerrService')
    )
);
```

## Error Propagation and Handling

### Error Flow Pattern

```typescript
// Error Boundaries in Component Hierarchy
Database Error
    ↓
Repository Layer (Catch & Transform)
    ↓
Service Layer (Business Logic Error Handling)
    ↓
Controller Layer (HTTP Error Response)
    ↓
Middleware Error Handler
    ↓
Structured Error Response
    ↓
Frontend Error Handling
    ↓
User Feedback/Retry Logic

// Implementation Example
class ErrorHandler {
  static async handleAsync(
    fn: (...args: any[]) => Promise<any>
  ): Promise<(...args: any[]) => Promise<any>> {
    return async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        // Transform and log error
        const transformedError = this.transformError(error);
        logger.error('Service error occurred', {
          error: transformedError,
          args: args.length > 0 ? args[0] : undefined
        });
        throw transformedError;
      }
    };
  }

  private static transformError(error: any): AppError {
    if (error instanceof PrismaClientKnownRequestError) {
      return new DatabaseError('Database operation failed', error.code);
    }

    if (error.response?.status) {
      return new ExternalServiceError(
        'External service error',
        error.response.status,
        error.response.data
      );
    }

    return new InternalError('An unexpected error occurred');
  }
}
```

## Performance Optimization Patterns

### Caching Layer Integration

```typescript
// Multi-level Caching Strategy
class CacheManager {
  constructor(
    private redis: Redis,
    private memoryCache: NodeCache
  ) {}

  async get<T>(key: string): Promise<T | null> {
    // L1: Memory cache
    const memoryResult = this.memoryCache.get<T>(key);
    if (memoryResult) return memoryResult;

    // L2: Redis cache
    const redisResult = await this.redis.get(key);
    if (redisResult) {
      const parsed = JSON.parse(redisResult);
      this.memoryCache.set(key, parsed, 300); // 5 min TTL
      return parsed;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl = 3600): Promise<void> {
    // Set in both layers
    this.memoryCache.set(key, value, Math.min(ttl, 300));
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
}

// Service with Caching
class MediaService {
  constructor(
    private mediaRepo: MediaRepository,
    private cache: CacheManager
  ) {}

  async getMedia(id: string): Promise<Media | null> {
    const cacheKey = `media:${id}`;

    // Try cache first
    const cached = await this.cache.get<Media>(cacheKey);
    if (cached) return cached;

    // Fallback to database
    const media = await this.mediaRepo.findById(id);
    if (media) {
      await this.cache.set(cacheKey, media, 1800); // 30 min cache
    }

    return media;
  }
}
```

This comprehensive component relationship and data flow documentation provides a clear understanding of how MediaNest's components interact, communicate, and process data throughout the system architecture.
