# MediaNest Data Flow Architecture

## Overview

This document details the data flow patterns within MediaNest, showing how information moves through the system layers, from client requests to database operations and real-time notifications.

## Core Data Flow Patterns

### 1. Enhanced Request Processing Pipeline

```mermaid
flowchart TD
    subgraph "Client Tier"
        WEB[Web Browser]
        MOBILE[Mobile App]
        API_CLIENT[API Client]
        WEBSOCKET[WebSocket Connection]
    end

    subgraph "Edge & Load Balancing"
        CDN[Content Delivery Network]
        LB[Load Balancer]
        SSL[SSL Termination]
        WAF[Web Application Firewall]
    end

    subgraph "Reverse Proxy Layer"
        NGINX[Nginx Reverse Proxy]
        COMPRESSION[Gzip Compression]
        STATIC[Static File Serving]
    end

    subgraph "Application Security Gateway"
        CORS[CORS Validation]
        SECURITY[Security Headers]
        RATE_LIMIT[Rate Limiting Engine]
        DDoS[DDoS Protection]
    end

    subgraph "Authentication & Authorization"
        AUTH_MW[Authentication Middleware]
        JWT_VALIDATOR[JWT Token Validator]
        OAUTH_HANDLER[OAuth Handler]
        PERM_CHECK[Permission Checker]
    end

    subgraph "Request Processing"
        REQ_VALIDATOR[Request Validator]
        SCHEMA_VALIDATION[Schema Validation]
        CORRELATION[Correlation ID Generator]
        PERF_MONITOR[Performance Monitor]
    end

    subgraph "Application Router"
        API_ROUTER[API Router]
        VERSION_HANDLER[Version Handler]
        ROUTE_MATCHER[Route Matcher]
    end

    subgraph "Controller Layer"
        AUTH_CTRL[Auth Controller]
        MEDIA_CTRL[Media Controller]
        PLEX_CTRL[Plex Controller]
        DASHBOARD_CTRL[Dashboard Controller]
        ADMIN_CTRL[Admin Controller]
        YOUTUBE_CTRL[YouTube Controller]
    end

    subgraph "Business Logic Services"
        AUTH_SVC[Authentication Service]
        MEDIA_SVC[Media Service]
        PLEX_SVC[Plex Service]
        CACHE_SVC[Cache Service]
        NOTIF_SVC[Notification Service]
        HEALTH_SVC[Health Service]
        YOUTUBE_SVC[YouTube Service]
    end

    subgraph "External Integration Layer"
        PLEX_API[Plex API Client]
        OVERSEERR_API[Overseerr API Client]
        TMDB_API[TMDB API Client]
        YOUTUBE_API[YouTube API Client]
        WEBHOOK_HANDLER[Webhook Handler]
    end

    subgraph "Data Access Layer"
        USER_REPO[User Repository]
        MEDIA_REPO[Media Repository]
        YOUTUBE_REPO[YouTube Repository]
        SERVICE_REPO[Service Repository]
        ERROR_REPO[Error Repository]
    end

    subgraph "Data Storage"
        POSTGRES[(PostgreSQL Primary)]
        REDIS[(Redis Cache)]
        FILES[(File Storage)]
    end

    subgraph "Real-time Communication"
        SOCKET_SERVER[Socket.IO Server]
        NOTIFICATION_QUEUE[Notification Queue]
        BG_JOBS[Background Jobs]
    end

    subgraph "Monitoring & Observability"
        METRICS[Metrics Collector]
        LOGS[Log Aggregator]
        TRACING[Distributed Tracing]
        ALERTS[Alert Manager]
    end

    %% Client to Edge
    WEB --> CDN
    MOBILE --> CDN
    API_CLIENT --> CDN
    WEBSOCKET --> SOCKET_SERVER

    %% Edge Processing
    CDN --> LB
    LB --> SSL
    SSL --> WAF
    WAF --> NGINX

    %% Proxy Layer
    NGINX --> COMPRESSION
    COMPRESSION --> STATIC
    STATIC --> CORS

    %% Security Gateway
    CORS --> SECURITY
    SECURITY --> RATE_LIMIT
    RATE_LIMIT --> DDoS
    DDoS --> AUTH_MW

    %% Authentication
    AUTH_MW --> JWT_VALIDATOR
    JWT_VALIDATOR --> OAUTH_HANDLER
    OAUTH_HANDLER --> PERM_CHECK
    PERM_CHECK --> REQ_VALIDATOR

    %% Request Processing
    REQ_VALIDATOR --> SCHEMA_VALIDATION
    SCHEMA_VALIDATION --> CORRELATION
    CORRELATION --> PERF_MONITOR
    PERF_MONITOR --> API_ROUTER

    %% Routing
    API_ROUTER --> VERSION_HANDLER
    VERSION_HANDLER --> ROUTE_MATCHER
    ROUTE_MATCHER --> AUTH_CTRL
    ROUTE_MATCHER --> MEDIA_CTRL
    ROUTE_MATCHER --> PLEX_CTRL
    ROUTE_MATCHER --> DASHBOARD_CTRL
    ROUTE_MATCHER --> ADMIN_CTRL
    ROUTE_MATCHER --> YOUTUBE_CTRL

    %% Controller to Service
    AUTH_CTRL --> AUTH_SVC
    MEDIA_CTRL --> MEDIA_SVC
    PLEX_CTRL --> PLEX_SVC
    DASHBOARD_CTRL --> CACHE_SVC
    ADMIN_CTRL --> HEALTH_SVC
    YOUTUBE_CTRL --> YOUTUBE_SVC

    %% Service to External APIs
    PLEX_SVC --> PLEX_API
    MEDIA_SVC --> OVERSEERR_API
    MEDIA_SVC --> TMDB_API
    YOUTUBE_SVC --> YOUTUBE_API
    HEALTH_SVC --> WEBHOOK_HANDLER

    %% Service to Data Layer
    AUTH_SVC --> USER_REPO
    MEDIA_SVC --> MEDIA_REPO
    YOUTUBE_SVC --> YOUTUBE_REPO
    HEALTH_SVC --> SERVICE_REPO
    NOTIF_SVC --> ERROR_REPO

    %% Repository to Storage
    USER_REPO --> POSTGRES
    MEDIA_REPO --> POSTGRES
    YOUTUBE_REPO --> POSTGRES
    SERVICE_REPO --> POSTGRES
    ERROR_REPO --> POSTGRES

    CACHE_SVC --> REDIS
    AUTH_SVC --> REDIS
    RATE_LIMIT --> REDIS

    YOUTUBE_SVC --> FILES

    %% Real-time Communication
    NOTIF_SVC --> NOTIFICATION_QUEUE
    NOTIFICATION_QUEUE --> SOCKET_SERVER
    SOCKET_SERVER --> WEB

    BG_JOBS --> YOUTUBE_SVC
    BG_JOBS --> MEDIA_SVC

    %% Monitoring
    PERF_MONITOR --> METRICS
    CORRELATION --> LOGS
    API_ROUTER --> TRACING
    HEALTH_SVC --> ALERTS

    classDef clientTier fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef edgeTier fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef securityTier fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    classDef appTier fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef dataTier fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef monitoringTier fill:#fce4ec,stroke:#c2185b,stroke-width:2px

    class WEB,MOBILE,API_CLIENT,WEBSOCKET clientTier
    class CDN,LB,SSL,WAF,NGINX,COMPRESSION,STATIC edgeTier
    class CORS,SECURITY,RATE_LIMIT,DDoS,AUTH_MW,JWT_VALIDATOR,OAUTH_HANDLER,PERM_CHECK securityTier
    class REQ_VALIDATOR,SCHEMA_VALIDATION,CORRELATION,PERF_MONITOR,API_ROUTER,VERSION_HANDLER,ROUTE_MATCHER appTier
    class AUTH_CTRL,MEDIA_CTRL,PLEX_CTRL,DASHBOARD_CTRL,ADMIN_CTRL,YOUTUBE_CTRL appTier
    class AUTH_SVC,MEDIA_SVC,PLEX_SVC,CACHE_SVC,NOTIF_SVC,HEALTH_SVC,YOUTUBE_SVC appTier
    class USER_REPO,MEDIA_REPO,YOUTUBE_REPO,SERVICE_REPO,ERROR_REPO,POSTGRES,REDIS,FILES dataTier
    class METRICS,LOGS,TRACING,ALERTS monitoringTier
```

### 2. Authentication Data Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant R as Auth Route
    participant AC as Auth Controller
    participant AS as Auth Service
    participant JS as JWT Service
    participant UR as User Repository
    participant DB as Database
    participant RC as Redis Cache
    participant SS as Socket Service

    Note over C,SS: User Login Process
    C->>R: POST /api/v1/auth/login {email, password}
    R->>AC: authenticate(credentials)
    AC->>AS: validateCredentials(email, password)
    AS->>UR: findByEmail(email)
    UR->>DB: SELECT * FROM users WHERE email = ?
    DB-->>UR: User record
    UR-->>AS: User object
    AS->>AS: bcrypt.compare(password, user.passwordHash)
    AS->>JS: generateTokenPair(user)
    JS->>JS: Create access & refresh tokens
    JS-->>AS: {accessToken, refreshToken}
    AS->>RC: SET session:{userId} {tokens, metadata}
    AS->>UR: updateLastLoginAt(userId)
    UR->>DB: UPDATE users SET last_login_at = NOW()
    AS-->>AC: {user, tokens, sessionId}
    AC->>SS: notifyUserLogin(userId)
    SS->>SS: Join user to socket rooms
    AC-->>R: Authentication result
    R-->>C: 200 {user, tokens, permissions}

    Note over C,SS: Subsequent Authenticated Requests
    C->>R: GET /api/v1/dashboard (with JWT)
    R->>R: authenticate middleware
    R->>JS: verifyToken(jwt)
    JS->>RC: GET session:{userId}
    RC-->>JS: Session data
    JS-->>R: Valid user context
    R->>AC: getDashboard(user)
    AC-->>R: Dashboard data
    R-->>C: 200 {dashboard}
```

### 3. Media Request Data Flow

```mermaid
flowchart TD
    subgraph "Client Interaction"
        USER[User Interface]
        SEARCH[Media Search]
        REQUEST[Request Submission]
    end

    subgraph "Media Processing Pipeline"
        SEARCH_API[Search API]
        TMDB_API[TMDB Integration]
        REQUEST_API[Request API]
        VALIDATION[Request Validation]
        STORAGE[Database Storage]
        OVERSEERR_INT[Overseerr Integration]
        NOTIFICATION[Notification System]
    end

    subgraph "Data Storage"
        MEDIA_REQ_TABLE[media_requests table]
        USER_TABLE[users table]
        NOTIF_TABLE[notifications table]
    end

    subgraph "Real-time Updates"
        SOCKET_IO[Socket.IO]
        DASHBOARD_UPDATE[Dashboard Updates]
    end

    subgraph "External Services"
        TMDB[(The Movie DB)]
        OVERSEERR[(Overseerr)]
        PLEX[(Plex Server)]
    end

    USER --> SEARCH
    SEARCH --> SEARCH_API
    SEARCH_API --> TMDB_API
    TMDB_API --> TMDB
    TMDB --> TMDB_API
    TMDB_API --> USER

    USER --> REQUEST
    REQUEST --> REQUEST_API
    REQUEST_API --> VALIDATION
    VALIDATION --> STORAGE
    STORAGE --> MEDIA_REQ_TABLE
    STORAGE --> OVERSEERR_INT
    OVERSEERR_INT --> OVERSEERR
    OVERSEERR --> OVERSEERR_INT
    OVERSEERR_INT --> NOTIFICATION
    NOTIFICATION --> NOTIF_TABLE
    NOTIFICATION --> SOCKET_IO
    SOCKET_IO --> DASHBOARD_UPDATE
    DASHBOARD_UPDATE --> USER

    OVERSEERR --> PLEX
    PLEX --> OVERSEERR
```

### 4. Real-time Notification Data Flow

```mermaid
sequenceDiagram
    participant S as Service Layer
    participant NS as Notification Service
    participant RC as Redis Cache
    participant DB as PostgreSQL
    participant SS as Socket Service
    participant WS as WebSocket
    participant C as Client

    Note over S,C: Real-time Notification Flow
    S->>NS: createNotification(userId, type, data)
    NS->>DB: INSERT INTO notifications
    DB-->>NS: Notification ID
    NS->>RC: PUBLISH notification:{userId} {data}
    NS->>SS: emitToUser(userId, 'notification', data)
    SS->>SS: Find user socket connections
    SS->>WS: emit('notification', data)
    WS-->>C: Real-time notification
    NS-->>S: Notification created

    Note over S,C: Batch Notification Processing
    S->>NS: createBulkNotifications(userIds[], data)
    loop For each user
        NS->>DB: INSERT INTO notifications
        NS->>RC: PUBLISH notification:{userId}
        NS->>SS: emitToUser(userId, 'notification', data)
    end
    NS-->>S: Bulk notifications sent

    Note over S,C: Notification History Retrieval
    C->>SS: getNotifications(userId, pagination)
    SS->>DB: SELECT FROM notifications WHERE user_id
    DB-->>SS: Notification records
    SS->>RC: Cache recent notifications
    SS-->>C: Paginated notifications
```

### 5. Enhanced YouTube Download Workflow

```mermaid
flowchart TD
    subgraph "User Experience Layer"
        YT_FORM[YouTube URL Form]
        PROGRESS_UI[Real-time Progress UI]
        COMPLETION_UI[Completion Dashboard]
        ERROR_UI[Error Display]
    end

    subgraph "API Gateway Layer"
        YT_ENDPOINT[YouTube API Endpoint]
        AUTH_CHECK[Authentication Check]
        RATE_LIMIT_CHECK[Rate Limit Check]
        INPUT_VALIDATION[Input Validation]
    end

    subgraph "Business Logic Layer"
        YT_SERVICE[YouTube Service]
        URL_PROCESSOR[URL Processor]
        METADATA_EXTRACTOR[Metadata Extractor]
        DUPLICATE_CHECKER[Duplicate Checker]
        QUEUE_MANAGER[Queue Manager]
    end

    subgraph "Background Processing"
        JOB_SCHEDULER[Job Scheduler]
        DOWNLOAD_WORKER[Download Worker Pool]
        YT_DLP_ENGINE[yt-dlp Engine]
        PROGRESS_TRACKER[Progress Tracker]
        QUALITY_SELECTOR[Quality Selector]
        SUBTITLE_PROCESSOR[Subtitle Processor]
    end

    subgraph "File Management"
        TEMP_STORAGE[Temporary Storage]
        FILE_PROCESSOR[File Processor]
        FORMAT_CONVERTER[Format Converter]
        FILE_MOVER[File Mover]
        CLEANUP_SERVICE[Cleanup Service]
    end

    subgraph "Plex Integration"
        COLLECTION_MANAGER[Collection Manager]
        METADATA_UPDATER[Metadata Updater]
        LIBRARY_SCANNER[Library Scanner]
        THUMBNAIL_GENERATOR[Thumbnail Generator]
    end

    subgraph "Data Management"
        DOWNLOAD_REPO[Download Repository]
        PROGRESS_CACHE[Progress Cache]
        METADATA_CACHE[Metadata Cache]
        ERROR_LOGGER[Error Logger]
        AUDIT_LOGGER[Audit Logger]
    end

    subgraph "Notification System"
        NOTIF_ENGINE[Notification Engine]
        WEBSOCKET_NOTIF[WebSocket Notifications]
        EMAIL_NOTIF[Email Notifications]
        WEBHOOK_NOTIF[Webhook Notifications]
    end

    subgraph "Storage Layer"
        POSTGRES_DB[(PostgreSQL)]
        REDIS_CACHE[(Redis Cache)]
        FILE_STORAGE[(File Storage)]
    end

    subgraph "Monitoring & Observability"
        PERF_MONITOR[Performance Monitor]
        ERROR_TRACKER[Error Tracker]
        QUEUE_METRICS[Queue Metrics]
        DOWNLOAD_ANALYTICS[Download Analytics]
    end

    %% User Flow
    YT_FORM --> YT_ENDPOINT

    %% API Gateway
    YT_ENDPOINT --> AUTH_CHECK
    AUTH_CHECK --> RATE_LIMIT_CHECK
    RATE_LIMIT_CHECK --> INPUT_VALIDATION
    INPUT_VALIDATION --> YT_SERVICE

    %% Business Logic
    YT_SERVICE --> URL_PROCESSOR
    URL_PROCESSOR --> METADATA_EXTRACTOR
    METADATA_EXTRACTOR --> DUPLICATE_CHECKER
    DUPLICATE_CHECKER --> QUEUE_MANAGER

    %% Background Processing
    QUEUE_MANAGER --> JOB_SCHEDULER
    JOB_SCHEDULER --> DOWNLOAD_WORKER
    DOWNLOAD_WORKER --> YT_DLP_ENGINE
    YT_DLP_ENGINE --> PROGRESS_TRACKER
    YT_DLP_ENGINE --> QUALITY_SELECTOR
    YT_DLP_ENGINE --> SUBTITLE_PROCESSOR

    %% File Processing
    SUBTITLE_PROCESSOR --> TEMP_STORAGE
    TEMP_STORAGE --> FILE_PROCESSOR
    FILE_PROCESSOR --> FORMAT_CONVERTER
    FORMAT_CONVERTER --> FILE_MOVER
    FILE_MOVER --> CLEANUP_SERVICE

    %% Plex Integration
    FILE_MOVER --> COLLECTION_MANAGER
    COLLECTION_MANAGER --> METADATA_UPDATER
    METADATA_UPDATER --> LIBRARY_SCANNER
    LIBRARY_SCANNER --> THUMBNAIL_GENERATOR

    %% Data Management
    YT_SERVICE --> DOWNLOAD_REPO
    PROGRESS_TRACKER --> PROGRESS_CACHE
    METADATA_EXTRACTOR --> METADATA_CACHE
    DOWNLOAD_WORKER --> ERROR_LOGGER
    YT_SERVICE --> AUDIT_LOGGER

    %% Notifications
    PROGRESS_TRACKER --> NOTIF_ENGINE
    THUMBNAIL_GENERATOR --> NOTIF_ENGINE
    ERROR_LOGGER --> NOTIF_ENGINE
    NOTIF_ENGINE --> WEBSOCKET_NOTIF
    NOTIF_ENGINE --> EMAIL_NOTIF
    NOTIF_ENGINE --> WEBHOOK_NOTIF

    %% UI Updates
    WEBSOCKET_NOTIF --> PROGRESS_UI
    WEBSOCKET_NOTIF --> COMPLETION_UI
    WEBSOCKET_NOTIF --> ERROR_UI

    %% Storage
    DOWNLOAD_REPO --> POSTGRES_DB
    PROGRESS_CACHE --> REDIS_CACHE
    METADATA_CACHE --> REDIS_CACHE
    TEMP_STORAGE --> FILE_STORAGE
    FILE_MOVER --> FILE_STORAGE

    %% Monitoring
    DOWNLOAD_WORKER --> PERF_MONITOR
    ERROR_LOGGER --> ERROR_TRACKER
    QUEUE_MANAGER --> QUEUE_METRICS
    YT_SERVICE --> DOWNLOAD_ANALYTICS

    classDef userLayer fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef apiLayer fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef businessLayer fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef processingLayer fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef storageLayer fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    classDef notificationLayer fill:#fce4ec,stroke:#c2185b,stroke-width:2px

    class YT_FORM,PROGRESS_UI,COMPLETION_UI,ERROR_UI userLayer
    class YT_ENDPOINT,AUTH_CHECK,RATE_LIMIT_CHECK,INPUT_VALIDATION apiLayer
    class YT_SERVICE,URL_PROCESSOR,METADATA_EXTRACTOR,DUPLICATE_CHECKER,QUEUE_MANAGER businessLayer
    class JOB_SCHEDULER,DOWNLOAD_WORKER,YT_DLP_ENGINE,PROGRESS_TRACKER,QUALITY_SELECTOR,SUBTITLE_PROCESSOR processingLayer
    class DOWNLOAD_REPO,PROGRESS_CACHE,METADATA_CACHE,POSTGRES_DB,REDIS_CACHE,FILE_STORAGE storageLayer
    class NOTIF_ENGINE,WEBSOCKET_NOTIF,EMAIL_NOTIF,WEBHOOK_NOTIF notificationLayer
```

## Database Transaction Patterns

### 1. User Authentication Transactions

```mermaid
sequenceDiagram
    participant A as Auth Service
    participant T as Transaction
    participant U as Users Table
    participant S as Sessions Table
    participant R as Rate Limits Table

    A->>T: BEGIN TRANSACTION
    A->>U: UPDATE last_login_at = NOW()
    A->>S: INSERT new session
    A->>R: UPDATE request_count
    T->>T: COMMIT
    Note over A,R: All or nothing - maintains data consistency
```

### 2. Media Request Transactions

```mermaid
sequenceDiagram
    participant M as Media Service
    participant T as Transaction
    participant MR as Media Requests Table
    participant N as Notifications Table
    participant O as Overseerr API

    M->>T: BEGIN TRANSACTION
    M->>MR: INSERT media request
    M->>N: INSERT notification record
    T->>T: COMMIT
    Note over M,O: Database committed before external API
    M->>O: Submit to Overseerr
    Note over M,O: External API failure doesn't affect database
```

## Advanced Caching Strategy

### 1. Multi-Tier Caching Architecture

```mermaid
flowchart TD
    subgraph "Client-Side Caching"
        BROWSER_CACHE[Browser Cache]
        LOCAL_STORAGE[Local Storage]
        SESSION_STORAGE[Session Storage]
        SERVICE_WORKER[Service Worker Cache]
    end

    subgraph "Edge Caching"
        CDN_CACHE[CDN Cache]
        EDGE_SERVERS[Edge Servers]
        GEO_CACHE[Geographic Cache]
    end

    subgraph "Reverse Proxy Caching"
        NGINX_CACHE[Nginx Cache]
        STATIC_CACHE[Static File Cache]
        API_CACHE[API Response Cache]
    end

    subgraph "Application Caching"
        MEMORY_CACHE[In-Memory Cache]
        SESSION_CACHE[Session Cache]
        QUERY_CACHE[Query Result Cache]
        COMPUTED_CACHE[Computed Value Cache]
    end

    subgraph "Distributed Caching"
        REDIS_CLUSTER[Redis Cluster]
        REDIS_MASTER[Redis Master]
        REDIS_SLAVES[Redis Slaves]
        REDIS_SENTINEL[Redis Sentinel]
    end

    subgraph "Database Caching"
        QUERY_PLAN_CACHE[Query Plan Cache]
        RESULT_SET_CACHE[Result Set Cache]
        CONNECTION_POOL[Connection Pool]
        PREPARED_STATEMENTS[Prepared Statements Cache]
    end

    subgraph "Smart Cache Management"
        CACHE_WARMER[Cache Warmer]
        CACHE_INVALIDATOR[Cache Invalidator]
        TTL_MANAGER[TTL Manager]
        CACHE_ANALYTICS[Cache Analytics]
    end

    CLIENT[Client Request] --> BROWSER_CACHE
    BROWSER_CACHE --> LOCAL_STORAGE
    LOCAL_STORAGE --> SESSION_STORAGE
    SESSION_STORAGE --> SERVICE_WORKER
    SERVICE_WORKER --> CDN_CACHE

    CDN_CACHE --> EDGE_SERVERS
    EDGE_SERVERS --> GEO_CACHE
    GEO_CACHE --> NGINX_CACHE

    NGINX_CACHE --> STATIC_CACHE
    STATIC_CACHE --> API_CACHE
    API_CACHE --> MEMORY_CACHE

    MEMORY_CACHE --> SESSION_CACHE
    SESSION_CACHE --> QUERY_CACHE
    QUERY_CACHE --> COMPUTED_CACHE
    COMPUTED_CACHE --> REDIS_CLUSTER

    REDIS_CLUSTER --> REDIS_MASTER
    REDIS_MASTER --> REDIS_SLAVES
    REDIS_SLAVES --> REDIS_SENTINEL
    REDIS_SENTINEL --> QUERY_PLAN_CACHE

    QUERY_PLAN_CACHE --> RESULT_SET_CACHE
    RESULT_SET_CACHE --> CONNECTION_POOL
    CONNECTION_POOL --> PREPARED_STATEMENTS
    PREPARED_STATEMENTS --> DATABASE[(Primary Database)]

    %% Cache Management
    CACHE_WARMER --> REDIS_CLUSTER
    CACHE_INVALIDATOR --> REDIS_CLUSTER
    TTL_MANAGER --> REDIS_CLUSTER
    CACHE_ANALYTICS --> REDIS_CLUSTER

    classDef clientCache fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef edgeCache fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef proxyCache fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef appCache fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef distributedCache fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    classDef dbCache fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef management fill:#f1f8e9,stroke:#689f38,stroke-width:2px

    class BROWSER_CACHE,LOCAL_STORAGE,SESSION_STORAGE,SERVICE_WORKER clientCache
    class CDN_CACHE,EDGE_SERVERS,GEO_CACHE edgeCache
    class NGINX_CACHE,STATIC_CACHE,API_CACHE proxyCache
    class MEMORY_CACHE,SESSION_CACHE,QUERY_CACHE,COMPUTED_CACHE appCache
    class REDIS_CLUSTER,REDIS_MASTER,REDIS_SLAVES,REDIS_SENTINEL distributedCache
    class QUERY_PLAN_CACHE,RESULT_SET_CACHE,CONNECTION_POOL,PREPARED_STATEMENTS dbCache
    class CACHE_WARMER,CACHE_INVALIDATOR,TTL_MANAGER,CACHE_ANALYTICS management
```

### 2. Intelligent Cache Invalidation System

```mermaid
flowchart TD
    subgraph "Cache Invalidation Triggers"
        DATA_CHANGE[Data Change Event]
        USER_ACTION[User Action]
        SCHEDULED_JOB[Scheduled Job]
        EXTERNAL_EVENT[External Event]
        MANUAL_TRIGGER[Manual Trigger]
    end

    subgraph "Invalidation Strategy Engine"
        STRATEGY_SELECTOR[Strategy Selector]
        PATTERN_MATCHER[Pattern Matcher]
        DEPENDENCY_ANALYZER[Dependency Analyzer]
        IMPACT_CALCULATOR[Impact Calculator]
    end

    subgraph "Invalidation Patterns"
        IMMEDIATE[Immediate Invalidation]
        LAZY[Lazy Invalidation]
        WRITE_THROUGH[Write-Through]
        WRITE_BEHIND[Write-Behind]
        WRITE_AROUND[Write-Around]
        REFRESH_AHEAD[Refresh-Ahead]
    end

    subgraph "Cache Layers"
        L1_BROWSER[Browser Cache]
        L2_CDN[CDN Cache]
        L3_NGINX[Nginx Cache]
        L4_APP[Application Cache]
        L5_REDIS[Redis Cache]
        L6_DB[Database Cache]
    end

    subgraph "Invalidation Mechanisms"
        TAG_BASED[Tag-Based Invalidation]
        TIME_BASED[Time-Based (TTL)]
        EVENT_BASED[Event-Based]
        DEPENDENCY_BASED[Dependency-Based]
        MANUAL_PURGE[Manual Purge]
    end

    subgraph "Notification System"
        CACHE_EVENTS[Cache Events]
        PUB_SUB[Pub/Sub System]
        WEBHOOK_NOTIF[Webhook Notifications]
        REAL_TIME_UPDATES[Real-time Updates]
    end

    subgraph "Monitoring & Analytics"
        HIT_RATE_MONITOR[Hit Rate Monitor]
        MISS_ANALYZER[Miss Analyzer]
        PERFORMANCE_TRACKER[Performance Tracker]
        COST_OPTIMIZER[Cost Optimizer]
    end

    %% Trigger Flow
    DATA_CHANGE --> STRATEGY_SELECTOR
    USER_ACTION --> STRATEGY_SELECTOR
    SCHEDULED_JOB --> STRATEGY_SELECTOR
    EXTERNAL_EVENT --> STRATEGY_SELECTOR
    MANUAL_TRIGGER --> STRATEGY_SELECTOR

    %% Strategy Selection
    STRATEGY_SELECTOR --> PATTERN_MATCHER
    PATTERN_MATCHER --> DEPENDENCY_ANALYZER
    DEPENDENCY_ANALYZER --> IMPACT_CALCULATOR

    %% Pattern Application
    IMPACT_CALCULATOR --> IMMEDIATE
    IMPACT_CALCULATOR --> LAZY
    IMPACT_CALCULATOR --> WRITE_THROUGH
    IMPACT_CALCULATOR --> WRITE_BEHIND
    IMPACT_CALCULATOR --> WRITE_AROUND
    IMPACT_CALCULATOR --> REFRESH_AHEAD

    %% Cache Layer Invalidation
    IMMEDIATE --> L1_BROWSER
    LAZY --> L2_CDN
    WRITE_THROUGH --> L3_NGINX
    WRITE_BEHIND --> L4_APP
    WRITE_AROUND --> L5_REDIS
    REFRESH_AHEAD --> L6_DB

    %% Mechanism Application
    L1_BROWSER --> TAG_BASED
    L2_CDN --> TIME_BASED
    L3_NGINX --> EVENT_BASED
    L4_APP --> DEPENDENCY_BASED
    L5_REDIS --> MANUAL_PURGE

    %% Notification Flow
    TAG_BASED --> CACHE_EVENTS
    TIME_BASED --> PUB_SUB
    EVENT_BASED --> WEBHOOK_NOTIF
    DEPENDENCY_BASED --> REAL_TIME_UPDATES

    %% Monitoring
    L1_BROWSER --> HIT_RATE_MONITOR
    L2_CDN --> MISS_ANALYZER
    L3_NGINX --> PERFORMANCE_TRACKER
    L4_APP --> COST_OPTIMIZER

    classDef trigger fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef strategy fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef pattern fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef cache fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef mechanism fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    classDef notification fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef monitoring fill:#f1f8e9,stroke:#689f38,stroke-width:2px

    class DATA_CHANGE,USER_ACTION,SCHEDULED_JOB,EXTERNAL_EVENT,MANUAL_TRIGGER trigger
    class STRATEGY_SELECTOR,PATTERN_MATCHER,DEPENDENCY_ANALYZER,IMPACT_CALCULATOR strategy
    class IMMEDIATE,LAZY,WRITE_THROUGH,WRITE_BEHIND,WRITE_AROUND,REFRESH_AHEAD pattern
    class L1_BROWSER,L2_CDN,L3_NGINX,L4_APP,L5_REDIS,L6_DB cache
    class TAG_BASED,TIME_BASED,EVENT_BASED,DEPENDENCY_BASED,MANUAL_PURGE mechanism
    class CACHE_EVENTS,PUB_SUB,WEBHOOK_NOTIF,REAL_TIME_UPDATES notification
    class HIT_RATE_MONITOR,MISS_ANALYZER,PERFORMANCE_TRACKER,COST_OPTIMIZER monitoring
```

## Error Handling Data Flow

### 1. Error Propagation

```mermaid
flowchart TD
    subgraph "Error Sources"
        DB_ERROR[Database Error]
        API_ERROR[External API Error]
        VALIDATION_ERROR[Validation Error]
        AUTH_ERROR[Authentication Error]
    end

    subgraph "Error Handling"
        ERROR_MW[Error Middleware]
        ERROR_SERVICE[Error Service]
        ERROR_LOGGER[Error Logger]
        ERROR_TRACKER[Error Tracker]
    end

    subgraph "Error Storage"
        ERROR_LOG_TABLE[error_logs table]
        SENTRY[Sentry]
        LOG_FILES[Log Files]
    end

    subgraph "Error Response"
        CLIENT_ERROR[Client Error Response]
        ADMIN_ALERT[Admin Alert]
        MONITORING[Monitoring Alert]
    end

    DB_ERROR --> ERROR_MW
    API_ERROR --> ERROR_MW
    VALIDATION_ERROR --> ERROR_MW
    AUTH_ERROR --> ERROR_MW

    ERROR_MW --> ERROR_SERVICE
    ERROR_SERVICE --> ERROR_LOGGER
    ERROR_SERVICE --> ERROR_TRACKER

    ERROR_LOGGER --> ERROR_LOG_TABLE
    ERROR_LOGGER --> LOG_FILES
    ERROR_TRACKER --> SENTRY

    ERROR_SERVICE --> CLIENT_ERROR
    ERROR_SERVICE --> ADMIN_ALERT
    ERROR_TRACKER --> MONITORING
```

### 2. Circuit Breaker Pattern

```mermaid
stateDiagram-v2
    [*] --> Closed
    Closed --> Open : Failure threshold exceeded
    Open --> HalfOpen : Timeout period elapsed
    HalfOpen --> Closed : Success threshold met
    HalfOpen --> Open : Any failure occurs

    state Closed {
        [*] --> Normal
        Normal --> CountingFailures : Request fails
        CountingFailures --> Normal : Request succeeds
        CountingFailures --> [*] : Threshold reached
    }

    state Open {
        [*] --> Blocking
        Blocking --> [*] : All requests rejected
    }

    state HalfOpen {
        [*] --> Testing
        Testing --> [*] : Limited requests allowed
    }
```

## Performance Monitoring Data Flow

### 1. Metrics Collection

```mermaid
flowchart LR
    subgraph "Application Metrics"
        REQUEST_COUNTER[Request Counter]
        RESPONSE_TIME[Response Time]
        ERROR_RATE[Error Rate]
        ACTIVE_CONNECTIONS[Active Connections]
    end

    subgraph "Business Metrics"
        USER_SESSIONS[User Sessions]
        MEDIA_REQUESTS[Media Requests]
        DOWNLOAD_JOBS[Download Jobs]
        API_USAGE[API Usage]
    end

    subgraph "System Metrics"
        CPU_USAGE[CPU Usage]
        MEMORY_USAGE[Memory Usage]
        DISK_IO[Disk I/O]
        NETWORK_IO[Network I/O]
    end

    subgraph "Monitoring Stack"
        PROMETHEUS[Prometheus]
        GRAFANA[Grafana]
        ALERTMANAGER[Alert Manager]
    end

    REQUEST_COUNTER --> PROMETHEUS
    RESPONSE_TIME --> PROMETHEUS
    ERROR_RATE --> PROMETHEUS
    ACTIVE_CONNECTIONS --> PROMETHEUS

    USER_SESSIONS --> PROMETHEUS
    MEDIA_REQUESTS --> PROMETHEUS
    DOWNLOAD_JOBS --> PROMETHEUS
    API_USAGE --> PROMETHEUS

    CPU_USAGE --> PROMETHEUS
    MEMORY_USAGE --> PROMETHEUS
    DISK_IO --> PROMETHEUS
    NETWORK_IO --> PROMETHEUS

    PROMETHEUS --> GRAFANA
    PROMETHEUS --> ALERTMANAGER
```

## Advanced Data Flow Patterns

### 1. Event-Driven Architecture Pattern

```mermaid
flowchart TD
    subgraph "Event Sources"
        USER_ACTION[User Actions]
        SYSTEM_EVENT[System Events]
        EXTERNAL_EVENT[External Events]
        SCHEDULED_EVENT[Scheduled Events]
    end

    subgraph "Event Bus"
        EVENT_ROUTER[Event Router]
        EVENT_STORE[Event Store]
        EVENT_REPLAY[Event Replay]
    end

    subgraph "Event Processors"
        AUTH_PROCESSOR[Auth Event Processor]
        MEDIA_PROCESSOR[Media Event Processor]
        NOTIF_PROCESSOR[Notification Processor]
        AUDIT_PROCESSOR[Audit Event Processor]
        METRICS_PROCESSOR[Metrics Processor]
    end

    subgraph "State Management"
        READ_MODELS[Read Models]
        PROJECTIONS[Event Projections]
        SNAPSHOTS[State Snapshots]
    end

    subgraph "Side Effects"
        NOTIFICATIONS[Push Notifications]
        WEBHOOKS[Webhook Calls]
        EMAIL_ALERTS[Email Alerts]
        EXTERNAL_API[External API Calls]
    end

    USER_ACTION --> EVENT_ROUTER
    SYSTEM_EVENT --> EVENT_ROUTER
    EXTERNAL_EVENT --> EVENT_ROUTER
    SCHEDULED_EVENT --> EVENT_ROUTER

    EVENT_ROUTER --> EVENT_STORE
    EVENT_STORE --> AUTH_PROCESSOR
    EVENT_STORE --> MEDIA_PROCESSOR
    EVENT_STORE --> NOTIF_PROCESSOR
    EVENT_STORE --> AUDIT_PROCESSOR
    EVENT_STORE --> METRICS_PROCESSOR

    AUTH_PROCESSOR --> READ_MODELS
    MEDIA_PROCESSOR --> PROJECTIONS
    NOTIF_PROCESSOR --> SNAPSHOTS

    NOTIF_PROCESSOR --> NOTIFICATIONS
    AUDIT_PROCESSOR --> WEBHOOKS
    METRICS_PROCESSOR --> EMAIL_ALERTS
    MEDIA_PROCESSOR --> EXTERNAL_API

    EVENT_STORE --> EVENT_REPLAY
    EVENT_REPLAY --> PROJECTIONS

    classDef eventSource fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef eventBus fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef processor fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef state fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef sideEffect fill:#ffebee,stroke:#d32f2f,stroke-width:2px

    class USER_ACTION,SYSTEM_EVENT,EXTERNAL_EVENT,SCHEDULED_EVENT eventSource
    class EVENT_ROUTER,EVENT_STORE,EVENT_REPLAY eventBus
    class AUTH_PROCESSOR,MEDIA_PROCESSOR,NOTIF_PROCESSOR,AUDIT_PROCESSOR,METRICS_PROCESSOR processor
    class READ_MODELS,PROJECTIONS,SNAPSHOTS state
    class NOTIFICATIONS,WEBHOOKS,EMAIL_ALERTS,EXTERNAL_API sideEffect
```

### 2. CQRS (Command Query Responsibility Segregation) Pattern

```mermaid
flowchart LR
    subgraph "Command Side (Write)"
        CMD_API[Command API]
        CMD_HANDLERS[Command Handlers]
        DOMAIN_MODELS[Domain Models]
        EVENT_SOURCING[Event Sourcing]
        WRITE_DB[(Write Database)]
    end

    subgraph "Query Side (Read)"
        QUERY_API[Query API]
        QUERY_HANDLERS[Query Handlers]
        READ_MODELS[Read Models]
        MATERIALIZED_VIEWS[Materialized Views]
        READ_DB[(Read Database)]
    end

    subgraph "Event Stream"
        EVENT_BUS[Event Bus]
        EVENT_PROJECTOR[Event Projector]
    end

    subgraph "Client Applications"
        WEB_APP[Web Application]
        MOBILE_APP[Mobile App]
        API_CLIENTS[API Clients]
    end

    %% Command Flow
    WEB_APP -->|Commands| CMD_API
    MOBILE_APP -->|Commands| CMD_API
    API_CLIENTS -->|Commands| CMD_API

    CMD_API --> CMD_HANDLERS
    CMD_HANDLERS --> DOMAIN_MODELS
    DOMAIN_MODELS --> EVENT_SOURCING
    EVENT_SOURCING --> WRITE_DB

    %% Event Flow
    EVENT_SOURCING --> EVENT_BUS
    EVENT_BUS --> EVENT_PROJECTOR
    EVENT_PROJECTOR --> read_MODELS
    read_MODELS --> MATERIALIZED_VIEWS
    MATERIALIZED_VIEWS --> READ_DB

    %% Query Flow
    WEB_APP -->|Queries| QUERY_API
    MOBILE_APP -->|Queries| QUERY_API
    API_CLIENTS -->|Queries| QUERY_API

    QUERY_API --> QUERY_HANDLERS
    QUERY_HANDLERS --> READ_DB

    classDef command fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    classDef query fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef event fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef client fill:#e3f2fd,stroke:#1976d2,stroke-width:2px

    class CMD_API,CMD_HANDLERS,DOMAIN_MODELS,EVENT_SOURCING,WRITE_DB command
    class QUERY_API,QUERY_HANDLERS,READ_MODELS,MATERIALIZED_VIEWS,READ_DB query
    class EVENT_BUS,EVENT_PROJECTOR event
    class WEB_APP,MOBILE_APP,API_CLIENTS client
```

## Data Consistency Patterns

### 1. Eventual Consistency for External APIs

```mermaid
sequenceDiagram
    participant MS as Media Service
    participant DB as Database
    participant OS as Overseerr Service
    participant PS as Plex Service
    participant NS as Notification Service

    Note over MS,NS: Eventual Consistency Pattern
    MS->>DB: Store media request (COMMITTED)
    MS->>OS: Submit to Overseerr (ASYNC)
    alt Overseerr Success
        OS-->>MS: Request accepted
        MS->>DB: Update status = 'submitted'
        MS->>NS: Notify user of submission
    else Overseerr Failure
        OS-->>MS: Request failed
        MS->>DB: Update status = 'failed'
        MS->>NS: Notify user of failure
    end

    Note over MS,NS: Plex Integration (Eventual)
    OS->>PS: Media downloaded
    PS->>OS: Confirm addition
    OS->>MS: Webhook notification
    MS->>DB: Update status = 'completed'
    MS->>NS: Notify user of completion
```

### 2. Strong Consistency for Critical Operations

```mermaid
sequenceDiagram
    participant AS as Auth Service
    participant DB as Database
    participant RC as Redis Cache
    participant SS as Socket Service

    Note over AS,SS: Strong Consistency for Authentication
    AS->>DB: BEGIN TRANSACTION
    AS->>DB: UPDATE user last_login
    AS->>DB: INSERT session token
    AS->>DB: UPDATE rate limits
    AS->>DB: COMMIT TRANSACTION

    Note over AS,SS: Cache updates after DB commit
    AS->>RC: Cache user session
    AS->>RC: Cache rate limit data
    AS->>SS: Update user socket rooms

    Note over AS,SS: All operations must succeed together
```
