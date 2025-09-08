# MediaNest Microservices Architecture Strategy

## Executive Summary

This document outlines the comprehensive microservices decomposition strategy for MediaNest, transforming the current monolithic architecture into a scalable, distributed system optimized for 2025 deployment patterns.

## Current Architecture Assessment

### Monolithic Components Analysis
```typescript
// Current MediaNest Monolithic Structure
interface MonolithicArchitecture {
  backend: {
    api: ExpressApplication;
    authentication: AuthMiddleware;
    integrations: IntegrationService;
    websockets: SocketIOServer;
    database: PostgreSQLConnection;
    cache: RedisConnection;
  };
  frontend: {
    nextjs: NextJSApplication;
    components: ReactComponents;
    hooks: CustomHooks;
    api: APIClient;
  };
  shared: {
    types: TypeScriptTypes;
    utilities: SharedUtilities;
    constants: ConfigurationConstants;
  };
}
```

### Identified Decomposition Opportunities
1. **User Management**: Authentication, authorization, profiles
2. **Media Processing**: File upload, encoding, metadata extraction
3. **Integration Hub**: Plex, Overseerr, Uptime Kuma connections
4. **Notification System**: Real-time updates, alerts, webhooks
5. **Analytics Engine**: Metrics collection, reporting, insights
6. **Content Discovery**: Search, recommendations, catalog
7. **Admin Dashboard**: System management, monitoring, configuration

## Target Microservices Architecture

### 1. Service Domain Decomposition

```typescript
interface MediaNestMicroservices {
  // Core Business Services
  userService: UserManagementService;
  mediaService: MediaProcessingService;
  contentService: ContentDiscoveryService;
  
  // Integration Services
  integrationHub: IntegrationOrchestrationService;
  notificationService: NotificationDeliveryService;
  webhookService: WebhookManagementService;
  
  // Platform Services
  authService: AuthenticationAuthorizationService;
  analyticsService: AnalyticsDataService;
  adminService: SystemAdministrationService;
  
  // Infrastructure Services
  apiGateway: APIGatewayService;
  configService: ConfigurationService;
  loggingService: CentralizedLoggingService;
}

// Service Definitions with Clear Boundaries
const MICROSERVICE_CATALOG: ServiceDefinition[] = [
  {
    name: 'user-service',
    domain: 'user-management',
    responsibilities: [
      'User registration and authentication',
      'Profile management',
      'Permission and role management',
      'User preferences and settings'
    ],
    dataOwnership: ['users', 'user_profiles', 'user_sessions', 'user_preferences'],
    apis: {
      rest: '/api/users',
      graphql: '/graphql/users',
      grpc: 'UserService'
    },
    dependencies: ['auth-service', 'notification-service'],
    technology: {
      runtime: 'Node.js',
      framework: 'Fastify',
      database: 'PostgreSQL',
      cache: 'Redis'
    }
  },
  
  {
    name: 'media-service',
    domain: 'media-processing',
    responsibilities: [
      'File upload and validation',
      'Media encoding and transcoding',
      'Metadata extraction and analysis',
      'Thumbnail and preview generation',
      'Storage management and optimization'
    ],
    dataOwnership: ['media_files', 'media_metadata', 'processing_jobs', 'media_artifacts'],
    apis: {
      rest: '/api/media',
      grpc: 'MediaProcessingService',
      events: 'media.events.*'
    },
    dependencies: ['user-service', 'notification-service', 'analytics-service'],
    technology: {
      runtime: 'Node.js',
      framework: 'Express',
      database: 'PostgreSQL + S3',
      queue: 'RabbitMQ',
      processing: 'FFmpeg'
    }
  },
  
  {
    name: 'integration-hub',
    domain: 'third-party-integration',
    responsibilities: [
      'Plex server integration and management',
      'Overseerr request synchronization',
      'Uptime Kuma monitoring integration',
      'External API orchestration',
      'Integration health monitoring'
    ],
    dataOwnership: ['integrations', 'integration_configs', 'sync_states', 'api_tokens'],
    apis: {
      rest: '/api/integrations',
      grpc: 'IntegrationService',
      events: 'integration.events.*'
    },
    dependencies: ['auth-service', 'notification-service'],
    technology: {
      runtime: 'Node.js',
      framework: 'Fastify',
      database: 'PostgreSQL',
      cache: 'Redis',
      scheduler: 'Bull'
    }
  },
  
  {
    name: 'notification-service',
    domain: 'communication',
    responsibilities: [
      'Real-time WebSocket connections',
      'Push notification delivery',
      'Email notification management',
      'Webhook delivery and retry logic',
      'Notification preferences and templates'
    ],
    dataOwnership: ['notifications', 'notification_templates', 'delivery_logs', 'subscriptions'],
    apis: {
      rest: '/api/notifications',
      websocket: '/ws/notifications',
      grpc: 'NotificationService'
    },
    dependencies: ['user-service'],
    technology: {
      runtime: 'Node.js',
      framework: 'Express + Socket.IO',
      database: 'PostgreSQL',
      queue: 'RabbitMQ',
      cache: 'Redis'
    }
  },
  
  {
    name: 'analytics-service',
    domain: 'data-analytics',
    responsibilities: [
      'Event collection and aggregation',
      'Metrics calculation and storage',
      'Report generation and caching',
      'Usage analytics and insights',
      'Performance monitoring'
    ],
    dataOwnership: ['events', 'metrics', 'reports', 'analytics_configs'],
    apis: {
      rest: '/api/analytics',
      grpc: 'AnalyticsService',
      events: 'analytics.events.*'
    },
    dependencies: [],
    technology: {
      runtime: 'Node.js',
      framework: 'Fastify',
      database: 'InfluxDB + PostgreSQL',
      stream: 'Apache Kafka',
      cache: 'Redis'
    }
  },
  
  {
    name: 'content-service',
    domain: 'content-discovery',
    responsibilities: [
      'Content search and indexing',
      'Recommendation engine',
      'Content categorization',
      'Metadata enrichment',
      'Search result ranking'
    ],
    dataOwnership: ['content_index', 'recommendations', 'categories', 'search_analytics'],
    apis: {
      rest: '/api/content',
      graphql: '/graphql/content',
      grpc: 'ContentService'
    },
    dependencies: ['media-service', 'user-service', 'analytics-service'],
    technology: {
      runtime: 'Python',
      framework: 'FastAPI',
      database: 'Elasticsearch + PostgreSQL',
      ml: 'TensorFlow/PyTorch',
      cache: 'Redis'
    }
  },
  
  {
    name: 'admin-service',
    domain: 'system-administration',
    responsibilities: [
      'System configuration management',
      'User and role administration',
      'System health monitoring',
      'Backup and maintenance scheduling',
      'Audit logging and compliance'
    ],
    dataOwnership: ['system_configs', 'audit_logs', 'admin_sessions', 'maintenance_schedules'],
    apis: {
      rest: '/api/admin',
      grpc: 'AdminService'
    },
    dependencies: ['auth-service', 'analytics-service', 'user-service'],
    technology: {
      runtime: 'Node.js',
      framework: 'Express',
      database: 'PostgreSQL',
      monitoring: 'Prometheus + Grafana'
    }
  }
];
```

### 2. Service Communication Patterns

```typescript
// Inter-Service Communication Architecture
interface ServiceCommunication {
  synchronous: {
    restApi: RESTAPIPattern;
    grpc: GRPCPattern;
    graphql: GraphQLFederation;
  };
  asynchronous: {
    eventBus: EventDrivenPattern;
    messageQueue: MessageQueuePattern;
    streaming: StreamProcessingPattern;
  };
  hybrid: {
    cqrs: CommandQuerySeparationPattern;
    saga: SagaOrchestrationPattern;
  };
}

// Service Communication Matrix
const COMMUNICATION_PATTERNS = {
  'user-service -> auth-service': {
    pattern: 'synchronous-grpc',
    latency: 'low',
    consistency: 'strong',
    fallback: 'cache-based'
  },
  
  'media-service -> notification-service': {
    pattern: 'asynchronous-events',
    latency: 'medium',
    consistency: 'eventual',
    events: ['media.uploaded', 'media.processed', 'processing.failed']
  },
  
  'integration-hub -> *': {
    pattern: 'event-driven',
    latency: 'high',
    consistency: 'eventual',
    events: ['integration.sync', 'integration.status', 'external.webhook']
  },
  
  'content-service -> media-service': {
    pattern: 'hybrid-cqrs',
    read: 'direct-query',
    write: 'event-sourcing',
    consistency: 'eventual'
  }
};
```

### 3. Data Management Strategy

```typescript
// Database Per Service Pattern
interface ServiceDataStrategy {
  services: {
    'user-service': {
      primary: 'PostgreSQL',
      schemas: ['users', 'profiles', 'sessions'],
      replication: 'master-slave',
      backup: 'continuous'
    },
    
    'media-service': {
      primary: 'PostgreSQL',
      fileStorage: 'S3-compatible',
      schemas: ['media_files', 'metadata', 'jobs'],
      partitioning: 'by-date',
      archival: 'cold-storage'
    },
    
    'analytics-service': {
      timeSeries: 'InfluxDB',
      relational: 'PostgreSQL',
      streaming: 'Kafka',
      retention: 'tiered-storage'
    },
    
    'content-service': {
      search: 'Elasticsearch',
      graph: 'Neo4j',
      cache: 'Redis',
      ml: 'Vector-database'
    }
  };
  
  crossCuttingConcerns: {
    distributedTransactions: 'Saga-pattern';
    eventSourcing: 'Event-store';
    caching: 'Multi-layer-cache';
    search: 'Federated-search';
  };
}
```

## Service Implementation Details

### 1. User Management Service

```typescript
// User Service Implementation
class UserManagementService {
  private userRepository: UserRepository;
  private authClient: AuthServiceClient;
  private eventBus: EventBus;
  
  constructor() {
    this.userRepository = new PostgreSQLUserRepository();
    this.authClient = new GRPCAuthClient();
    this.eventBus = new RabbitMQEventBus();
  }
  
  async createUser(userData: CreateUserRequest): Promise<User> {
    // Validate user data
    const validation = await this.validateUserData(userData);
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }
    
    // Check for existing user
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictError('User already exists');
    }
    
    // Create user with transaction
    const user = await this.userRepository.transaction(async (tx) => {
      const newUser = await this.userRepository.create(userData, tx);
      
      // Create auth profile
      await this.authClient.createAuthProfile({
        userId: newUser.id,
        email: newUser.email,
        passwordHash: userData.passwordHash
      });
      
      // Initialize user preferences
      await this.userRepository.createPreferences(newUser.id, {
        theme: 'system',
        notifications: true,
        language: 'en'
      }, tx);
      
      return newUser;
    });
    
    // Publish user created event
    await this.eventBus.publish(new UserCreatedEvent({
      userId: user.id,
      email: user.email,
      timestamp: new Date(),
      correlationId: userData.correlationId
    }));
    
    return user;
  }
  
  async getUserById(userId: string): Promise<User | null> {
    // Check cache first
    const cached = await this.cache.get(`user:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Fetch from database
    const user = await this.userRepository.findById(userId);
    
    if (user) {
      // Cache for 15 minutes
      await this.cache.setex(`user:${userId}`, 900, JSON.stringify(user));
    }
    
    return user;
  }
  
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    const updatedUser = await this.userRepository.updateProfile(userId, updates);
    
    // Invalidate cache
    await this.cache.del(`user:${userId}`);
    
    // Publish update event
    await this.eventBus.publish(new UserProfileUpdatedEvent({
      userId,
      changes: updates,
      timestamp: new Date()
    }));
    
    return updatedUser;
  }
}
```

### 2. Media Processing Service

```typescript
// Media Processing Service with Job Queue
class MediaProcessingService {
  private mediaRepository: MediaRepository;
  private jobQueue: JobQueue;
  private storageService: StorageService;
  private eventBus: EventBus;
  
  constructor() {
    this.mediaRepository = new PostgreSQLMediaRepository();
    this.jobQueue = new BullJobQueue('media-processing');
    this.storageService = new S3StorageService();
    this.eventBus = new RabbitMQEventBus();
    
    this.setupJobProcessors();
  }
  
  private setupJobProcessors(): void {
    this.jobQueue.process('analyze-media', 5, this.processMediaAnalysis.bind(this));
    this.jobQueue.process('generate-thumbnails', 3, this.generateThumbnails.bind(this));
    this.jobQueue.process('extract-metadata', 2, this.extractMetadata.bind(this));
  }
  
  async uploadMedia(file: UploadedFile, userId: string): Promise<MediaFile> {
    // Validate file
    const validation = await this.validateMediaFile(file);
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }
    
    // Store file
    const storedFile = await this.storageService.store(file, {
      bucket: 'media-uploads',
      path: `users/${userId}/originals/${file.name}`,
      metadata: {
        userId,
        originalName: file.name,
        uploadTimestamp: new Date().toISOString()
      }
    });
    
    // Create media record
    const mediaFile = await this.mediaRepository.create({
      id: uuidv4(),
      userId,
      originalName: file.name,
      fileName: storedFile.fileName,
      filePath: storedFile.path,
      fileSize: file.size,
      mimeType: file.mimeType,
      status: 'uploaded',
      uploadedAt: new Date()
    });
    
    // Queue processing jobs
    await Promise.all([
      this.jobQueue.add('analyze-media', { mediaId: mediaFile.id }, {
        priority: 10,
        delay: 0,
        attempts: 3,
        backoff: 'exponential'
      }),
      this.jobQueue.add('extract-metadata', { mediaId: mediaFile.id }, {
        priority: 8,
        delay: 1000,
        attempts: 2
      }),
      this.jobQueue.add('generate-thumbnails', { mediaId: mediaFile.id }, {
        priority: 5,
        delay: 2000,
        attempts: 3
      })
    ]);
    
    // Publish upload event
    await this.eventBus.publish(new MediaUploadedEvent({
      mediaId: mediaFile.id,
      userId,
      fileName: file.name,
      fileSize: file.size,
      timestamp: new Date()
    }));
    
    return mediaFile;
  }
  
  private async processMediaAnalysis(job: Job): Promise<void> {
    const { mediaId } = job.data;
    
    try {
      const mediaFile = await this.mediaRepository.findById(mediaId);
      if (!mediaFile) {
        throw new Error('Media file not found');
      }
      
      // Update job progress
      await job.progress(10);
      
      // Analyze media properties
      const analysis = await this.analyzeMedia(mediaFile.filePath);
      await job.progress(50);
      
      // Store analysis results
      await this.mediaRepository.updateAnalysis(mediaId, analysis);
      await job.progress(80);
      
      // Update status
      await this.mediaRepository.updateStatus(mediaId, 'analyzed');
      await job.progress(100);
      
      // Publish analysis complete event
      await this.eventBus.publish(new MediaAnalysisCompletedEvent({
        mediaId,
        analysis,
        timestamp: new Date()
      }));
      
    } catch (error) {
      // Update status to failed
      await this.mediaRepository.updateStatus(mediaId, 'analysis_failed');
      
      // Publish failure event
      await this.eventBus.publish(new MediaProcessingFailedEvent({
        mediaId,
        step: 'analysis',
        error: error.message,
        timestamp: new Date()
      }));
      
      throw error;
    }
  }
  
  private async analyzeMedia(filePath: string): Promise<MediaAnalysis> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        
        const analysis: MediaAnalysis = {
          duration: metadata.format.duration,
          bitrate: metadata.format.bit_rate,
          fileSize: metadata.format.size,
          streams: metadata.streams.map(stream => ({
            type: stream.codec_type,
            codec: stream.codec_name,
            bitrate: stream.bit_rate,
            resolution: stream.codec_type === 'video' 
              ? `${stream.width}x${stream.height}` 
              : undefined
          })),
          format: metadata.format.format_name
        };
        
        resolve(analysis);
      });
    });
  }
}
```

### 3. Integration Hub Service

```typescript
// Integration Hub with Circuit Breaker Pattern
class IntegrationHubService {
  private integrationRepository: IntegrationRepository;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private scheduler: JobScheduler;
  private eventBus: EventBus;
  
  constructor() {
    this.integrationRepository = new PostgreSQLIntegrationRepository();
    this.scheduler = new BullJobScheduler();
    this.eventBus = new RabbitMQEventBus();
    
    this.setupCircuitBreakers();
    this.setupScheduledSyncs();
  }
  
  private setupCircuitBreakers(): void {
    const services = ['plex', 'overseerr', 'uptime-kuma'];
    
    services.forEach(service => {
      this.circuitBreakers.set(service, new CircuitBreaker({
        name: `${service}-circuit-breaker`,
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 60000,
        fallbackFunction: () => this.getFallbackData(service)
      }));
    });
  }
  
  async syncPlexLibraries(integrationId: string): Promise<SyncResult> {
    const integration = await this.integrationRepository.findById(integrationId);
    if (!integration || integration.service !== 'plex') {
      throw new NotFoundError('Plex integration not found');
    }
    
    const circuitBreaker = this.circuitBreakers.get('plex')!;
    
    try {
      const result = await circuitBreaker.execute(async () => {
        const plexClient = new PlexApiClient({
          serverUrl: integration.config.serverUrl,
          token: integration.config.token
        });
        
        // Fetch libraries from Plex
        const libraries = await plexClient.getLibraries();
        
        // Store sync results
        const syncResult = await this.integrationRepository.updateSyncData(
          integrationId,
          {
            libraries,
            lastSync: new Date(),
            status: 'success'
          }
        );
        
        return syncResult;
      });
      
      // Publish sync success event
      await this.eventBus.publish(new IntegrationSyncCompletedEvent({
        integrationId,
        service: 'plex',
        timestamp: new Date(),
        libraryCount: result.libraries?.length || 0
      }));
      
      return result;
      
    } catch (error) {
      // Update integration status
      await this.integrationRepository.updateStatus(integrationId, 'sync_failed');
      
      // Publish sync failure event
      await this.eventBus.publish(new IntegrationSyncFailedEvent({
        integrationId,
        service: 'plex',
        error: error.message,
        timestamp: new Date()
      }));
      
      throw error;
    }
  }
  
  async setupIntegrationWebhook(integrationId: string, webhookConfig: WebhookConfig): Promise<Webhook> {
    const integration = await this.integrationRepository.findById(integrationId);
    if (!integration) {
      throw new NotFoundError('Integration not found');
    }
    
    // Generate webhook URL and secret
    const webhookId = uuidv4();
    const webhookSecret = this.generateWebhookSecret();
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/webhooks/${webhookId}`;
    
    // Store webhook configuration
    const webhook = await this.integrationRepository.createWebhook({
      id: webhookId,
      integrationId,
      url: webhookUrl,
      secret: webhookSecret,
      events: webhookConfig.events,
      active: true,
      createdAt: new Date()
    });
    
    // Configure webhook in external service
    await this.configureExternalWebhook(integration, webhookUrl, webhookConfig);
    
    // Publish webhook created event
    await this.eventBus.publish(new WebhookCreatedEvent({
      webhookId,
      integrationId,
      service: integration.service,
      timestamp: new Date()
    }));
    
    return webhook;
  }
}
```

## Service Deployment Strategy

### 1. Container Orchestration

```yaml
# Kubernetes Deployment for User Service
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: medianest
  labels:
    app: user-service
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/path: "/metrics"
        prometheus.io/port: "3001"
    spec:
      containers:
      - name: user-service
        image: medianest/user-service:1.0.0
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 3001
          name: metrics
        - containerPort: 50051
          name: grpc
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: user-service-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: user-service-config
              key: redis-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: user-service-secrets
              key: jwt-secret
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: app-logs
          mountPath: /app/logs
      volumes:
      - name: app-logs
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: medianest
  labels:
    app: user-service
spec:
  selector:
    app: user-service
  ports:
  - name: http
    port: 3000
    targetPort: 3000
  - name: grpc
    port: 50051
    targetPort: 50051
  type: ClusterIP
```

### 2. Service Mesh Integration

```yaml
# Istio Service Mesh Configuration
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: user-service
  namespace: medianest
spec:
  hosts:
  - user-service
  http:
  - match:
    - uri:
        prefix: "/api/users"
    route:
    - destination:
        host: user-service
        port:
          number: 3000
    fault:
      delay:
        percentage:
          value: 0.1
        fixedDelay: 100ms
    retries:
      attempts: 3
      perTryTimeout: 2s
      retryOn: gateway-error,connect-failure,refused-stream
---
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: user-service
  namespace: medianest
spec:
  host: user-service
  trafficPolicy:
    loadBalancer:
      simple: LEAST_CONN
    circuitBreaker:
      consecutiveErrors: 3
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 10
        maxRequestsPerConnection: 2
```

## Migration Strategy

### 1. Strangler Fig Pattern

```typescript
// Gradual Migration with Routing
class MigrationRouter {
  private routes: MigrationRoute[] = [
    {
      path: '/api/users',
      legacy: 'medianest-monolith',
      microservice: 'user-service',
      migrationPercentage: 25, // Start with 25% of traffic
      rollbackEnabled: true
    },
    {
      path: '/api/media/upload',
      legacy: 'medianest-monolith',
      microservice: 'media-service',
      migrationPercentage: 10, // Conservative start
      rollbackEnabled: true
    }
  ];
  
  async routeRequest(request: Request): Promise<Response> {
    const route = this.findRoute(request.path);
    
    if (!route) {
      return this.forwardToLegacy(request);
    }
    
    // Determine routing based on migration percentage
    const shouldUseMicroservice = this.shouldRouteTo(
      'microservice',
      route.migrationPercentage,
      request
    );
    
    if (shouldUseMicroservice) {
      try {
        const response = await this.forwardToMicroservice(request, route.microservice);
        
        // Compare responses for validation (shadow testing)
        if (process.env.NODE_ENV !== 'production') {
          this.compareWithLegacy(request, response);
        }
        
        return response;
      } catch (error) {
        // Fallback to legacy on error
        logger.error('Microservice request failed, falling back to legacy', {
          path: request.path,
          service: route.microservice,
          error: error.message
        });
        
        return this.forwardToLegacy(request);
      }
    } else {
      return this.forwardToLegacy(request);
    }
  }
}
```

### 2. Data Migration Strategy

```typescript
// Database Migration with Zero Downtime
class DatabaseMigrationService {
  async migrateUserData(): Promise<void> {
    // Phase 1: Create new service database
    await this.createUserServiceSchema();
    
    // Phase 2: Initial data migration
    await this.copyHistoricalData('users', 'user-service-db');
    
    // Phase 3: Setup dual writes
    await this.enableDualWrites('users');
    
    // Phase 4: Validate data consistency
    const validation = await this.validateDataConsistency('users');
    if (!validation.consistent) {
      throw new Error('Data consistency validation failed');
    }
    
    // Phase 5: Switch reads to new service
    await this.switchReadsToMicroservice('user-service');
    
    // Phase 6: Stop dual writes
    await this.disableDualWrites('users');
    
    // Phase 7: Cleanup legacy data (after validation period)
    // await this.cleanupLegacyData('users'); // Run manually after verification
  }
  
  private async enableDualWrites(table: string): Promise<void> {
    // Add trigger to legacy database to replicate changes
    const trigger = `
      CREATE OR REPLACE FUNCTION replicate_${table}_changes()
      RETURNS trigger AS $$
      BEGIN
        -- Send change to message queue for microservice processing
        PERFORM pg_notify('${table}_changes', row_to_json(NEW)::text);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      CREATE TRIGGER ${table}_replication_trigger
        AFTER INSERT OR UPDATE ON ${table}
        FOR EACH ROW
        EXECUTE FUNCTION replicate_${table}_changes();
    `;
    
    await this.legacyDb.query(trigger);
  }
}
```

## Service Testing Strategy

### 1. Contract Testing

```typescript
// API Contract Tests with Pact
import { Pact } from '@pact-foundation/pact';

describe('User Service Contract', () => {
  const provider = new Pact({
    consumer: 'media-service',
    provider: 'user-service',
    port: 1234
  });
  
  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());
  
  describe('GET /users/:id', () => {
    beforeEach(() => {
      return provider.addInteraction({
        state: 'user exists',
        uponReceiving: 'a request for user details',
        withRequest: {
          method: 'GET',
          path: '/api/users/123',
          headers: {
            'Authorization': 'Bearer token'
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            id: '123',
            email: 'user@example.com',
            name: 'Test User',
            createdAt: '2023-01-01T00:00:00Z'
          }
        }
      });
    });
    
    it('should return user details', async () => {
      const userService = new UserServiceClient('http://localhost:1234');
      const user = await userService.getUserById('123');
      
      expect(user.id).toBe('123');
      expect(user.email).toBe('user@example.com');
    });
  });
});
```

### 2. Integration Testing

```typescript
// End-to-End Integration Tests
class MicroservicesIntegrationTest {
  private testEnvironment: TestEnvironment;
  
  async setupTestEnvironment(): Promise<void> {
    this.testEnvironment = new TestEnvironment({
      services: [
        'user-service',
        'media-service',
        'notification-service',
        'integration-hub'
      ],
      databases: {
        'user-service': 'postgresql://test-user-db',
        'media-service': 'postgresql://test-media-db'
      },
      messageQueues: {
        'rabbitmq': 'amqp://test-rabbitmq'
      }
    });
    
    await this.testEnvironment.start();
  }
  
  async testUserMediaWorkflow(): Promise<void> {
    // 1. Create user
    const user = await this.userService.createUser({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User'
    });
    
    // 2. Upload media
    const mediaFile = await this.mediaService.uploadMedia({
      file: this.createTestFile(),
      userId: user.id
    });
    
    // 3. Wait for processing events
    const processingEvents = await this.eventBus.waitForEvents([
      'media.uploaded',
      'media.analyzed',
      'thumbnails.generated'
    ], 30000);
    
    expect(processingEvents).toHaveLength(3);
    
    // 4. Verify notifications were sent
    const notifications = await this.notificationService.getNotifications(user.id);
    expect(notifications).toContainEqual(
      expect.objectContaining({
        type: 'media_processed',
        mediaId: mediaFile.id
      })
    );
  }
}
```

## Monitoring & Observability

### 1. Service Metrics

```typescript
// Microservice Metrics Collection
class ServiceMetrics {
  private registry = new prometheus.Registry();
  
  private requestCount = new prometheus.Counter({
    name: 'service_requests_total',
    help: 'Total number of requests',
    labelNames: ['service', 'method', 'endpoint', 'status'],
    registers: [this.registry]
  });
  
  private requestDuration = new prometheus.Histogram({
    name: 'service_request_duration_seconds',
    help: 'Request duration in seconds',
    labelNames: ['service', 'method', 'endpoint'],
    buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5],
    registers: [this.registry]
  });
  
  private serviceHealth = new prometheus.Gauge({
    name: 'service_health',
    help: 'Service health status (1=healthy, 0=unhealthy)',
    labelNames: ['service'],
    registers: [this.registry]
  });
  
  recordRequest(service: string, method: string, endpoint: string, status: number, duration: number): void {
    this.requestCount.inc({
      service,
      method,
      endpoint,
      status: status.toString()
    });
    
    this.requestDuration.observe({
      service,
      method,
      endpoint
    }, duration / 1000);
  }
  
  updateServiceHealth(service: string, healthy: boolean): void {
    this.serviceHealth.set({ service }, healthy ? 1 : 0);
  }
  
  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
```

### 2. Distributed Tracing

```typescript
// OpenTelemetry Tracing Setup
class DistributedTracing {
  private tracer: Tracer;
  
  constructor(serviceName: string) {
    const sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0'
      }),
      instrumentations: [
        new HttpInstrumentation(),
        new ExpressInstrumentation(),
        new IORedisInstrumentation(),
        new AmqplibInstrumentation()
      ],
      traceExporter: new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger:14268/api/traces'
      })
    });
    
    sdk.start();
    this.tracer = trace.getTracer(serviceName);
  }
  
  async traceServiceCall<T>(
    operationName: string,
    operation: (span: Span) => Promise<T>,
    attributes: Record<string, string> = {}
  ): Promise<T> {
    return this.tracer.startActiveSpan(operationName, { attributes }, async (span) => {
      try {
        const result = await operation(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

This comprehensive microservices strategy transforms MediaNest into a scalable, maintainable, and resilient distributed system ready for enterprise deployment and future growth.