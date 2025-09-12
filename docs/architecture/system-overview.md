# MediaNest System Overview

## Introduction

MediaNest is an Advanced Media Management Platform built on a modern, scalable microservices architecture. The system provides comprehensive media management capabilities including content discovery, request management, Plex integration, and YouTube downloading with real-time notifications and monitoring.

## System Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        MOBILE[Mobile App]
        API_CLIENT[API Clients]
    end

    subgraph "Load Balancer & Reverse Proxy"
        NGINX[Nginx]
    end

    subgraph "Application Layer"
        EXPRESS[Express.js Server]
        SOCKET[Socket.IO Server]

        subgraph "API Routes"
            AUTH_API[Authentication API]
            MEDIA_API[Media API]
            PLEX_API[Plex API]
            DASHBOARD_API[Dashboard API]
            ADMIN_API[Admin API]
            YOUTUBE_API[YouTube API]
            WEBHOOK_API[Webhooks API]
        end

        subgraph "Controllers"
            AUTH_CTRL[Auth Controller]
            MEDIA_CTRL[Media Controller]
            PLEX_CTRL[Plex Controller]
            DASH_CTRL[Dashboard Controller]
            ADMIN_CTRL[Admin Controller]
            YT_CTRL[YouTube Controller]
        end

        subgraph "Services Layer"
            PLEX_SVC[Plex Service]
            MEDIA_SVC[Media Service]
            AUTH_SVC[Authentication Service]
            CACHE_SVC[Cache Service]
            NOTIF_SVC[Notification Service]
            ENCRYPTION_SVC[Encryption Service]
            YOUTUBE_SVC[YouTube Service]
            WEBHOOK_SVC[Webhook Service]
        end

        subgraph "Middleware"
            AUTH_MW[Authentication]
            VALIDATION_MW[Validation]
            RATE_LIMIT_MW[Rate Limiting]
            ERROR_MW[Error Handling]
            SECURITY_MW[Security Headers]
            PERFORMANCE_MW[Performance Monitoring]
        end
    end

    subgraph "Data Layer"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis Cache)]

        subgraph "Database Models"
            USERS_TBL[Users]
            MEDIA_REQ_TBL[Media Requests]
            YT_DL_TBL[YouTube Downloads]
            SERVICE_STATUS_TBL[Service Status]
            NOTIFICATIONS_TBL[Notifications]
            ERROR_LOGS_TBL[Error Logs]
            SESSIONS_TBL[Sessions]
        end
    end

    subgraph "External Services"
        PLEX_SERVER[Plex Media Server]
        OVERSEERR[Overseerr]
        TMDB[The Movie DB]
        YOUTUBE[YouTube API]
        UPTIME_KUMA[Uptime Kuma]
    end

    subgraph "Monitoring & Observability"
        PROMETHEUS[Prometheus]
        GRAFANA[Grafana]
        OPENTEL[OpenTelemetry]
        SENTRY[Sentry]
    end

    %% Client Connections
    WEB --> NGINX
    MOBILE --> NGINX
    API_CLIENT --> NGINX

    %% Load Balancer
    NGINX --> EXPRESS
    NGINX --> SOCKET

    %% API Flow
    EXPRESS --> AUTH_API
    EXPRESS --> MEDIA_API
    EXPRESS --> PLEX_API
    EXPRESS --> DASHBOARD_API
    EXPRESS --> ADMIN_API
    EXPRESS --> YOUTUBE_API
    EXPRESS --> WEBHOOK_API

    %% Controller Mapping
    AUTH_API --> AUTH_CTRL
    MEDIA_API --> MEDIA_CTRL
    PLEX_API --> PLEX_CTRL
    DASHBOARD_API --> DASH_CTRL
    ADMIN_API --> ADMIN_CTRL
    YOUTUBE_API --> YT_CTRL

    %% Service Layer
    AUTH_CTRL --> AUTH_SVC
    MEDIA_CTRL --> MEDIA_SVC
    PLEX_CTRL --> PLEX_SVC
    DASH_CTRL --> CACHE_SVC
    DASH_CTRL --> NOTIF_SVC
    YT_CTRL --> YOUTUBE_SVC

    %% Middleware Stack
    EXPRESS --> AUTH_MW
    EXPRESS --> VALIDATION_MW
    EXPRESS --> RATE_LIMIT_MW
    EXPRESS --> ERROR_MW
    EXPRESS --> SECURITY_MW
    EXPRESS --> PERFORMANCE_MW

    %% Data Connections
    AUTH_SVC --> POSTGRES
    MEDIA_SVC --> POSTGRES
    PLEX_SVC --> POSTGRES
    NOTIF_SVC --> POSTGRES

    CACHE_SVC --> REDIS
    AUTH_SVC --> REDIS
    RATE_LIMIT_MW --> REDIS

    %% External Integrations
    PLEX_SVC --> PLEX_SERVER
    MEDIA_SVC --> OVERSEERR
    MEDIA_SVC --> TMDB
    YOUTUBE_SVC --> YOUTUBE
    WEBHOOK_SVC --> UPTIME_KUMA

    %% Monitoring
    EXPRESS --> OPENTEL
    EXPRESS --> PROMETHEUS
    OPENTEL --> GRAFANA
    ERROR_MW --> SENTRY

    classDef client fill:#e1f5fe
    classDef api fill:#f3e5f5
    classDef service fill:#e8f5e8
    classDef data fill:#fff3e0
    classDef external fill:#fce4ec
    classDef monitoring fill:#f1f8e9

    class WEB,MOBILE,API_CLIENT client
    class AUTH_API,MEDIA_API,PLEX_API,DASHBOARD_API,ADMIN_API,YOUTUBE_API,WEBHOOK_API api
    class AUTH_SVC,MEDIA_SVC,PLEX_SVC,CACHE_SVC,NOTIF_SVC,ENCRYPTION_SVC,YOUTUBE_SVC,WEBHOOK_SVC service
    class POSTGRES,REDIS data
    class PLEX_SERVER,OVERSEERR,TMDB,YOUTUBE,UPTIME_KUMA external
    class PROMETHEUS,GRAFANA,OPENTEL,SENTRY monitoring
```

## C4 Model Architecture

### Level 1: System Context Diagram

```mermaid
C4Context
    title MediaNest System Context

    Person(user, "MediaNest User", "Content consumer and requester")
    Person(admin, "System Administrator", "Manages system configuration")

    System(medianest, "MediaNest Platform", "Advanced Media Management Platform")

    System_Ext(plex, "Plex Media Server", "Media streaming and library management")
    System_Ext(overseerr, "Overseerr", "Media request management and automation")
    System_Ext(tmdb, "TMDB API", "Movie and TV show metadata service")
    System_Ext(youtube, "YouTube API", "Video information and download service")
    System_Ext(uptime, "Uptime Kuma", "Service monitoring and alerting")

    Rel(user, medianest, "Uses", "Web browser, Mobile app")
    Rel(admin, medianest, "Administers", "Admin dashboard")

    Rel(medianest, plex, "Integrates with", "REST API, OAuth")
    Rel(medianest, overseerr, "Submits requests to", "REST API")
    Rel(medianest, tmdb, "Fetches metadata from", "REST API")
    Rel(medianest, youtube, "Downloads content from", "API")
    Rel(medianest, uptime, "Monitored by", "Webhooks")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")
```

### Level 2: Container Diagram

```mermaid
C4Container
    title MediaNest Container Diagram

    Person(user, "MediaNest User", "Content consumer and requester")

    System_Boundary(medianest, "MediaNest Platform") {
        Container(webapp, "Web Application", "React, Next.js, TypeScript", "Delivers content and media management interface")
        Container(api, "API Application", "Express.js, TypeScript", "Provides REST API endpoints and business logic")
        Container(socketio, "WebSocket Server", "Socket.IO", "Handles real-time communication and notifications")
        Container(nginx, "Reverse Proxy", "Nginx", "SSL termination, load balancing, static content")

        ContainerDb(postgres, "Primary Database", "PostgreSQL", "Stores user data, media requests, system configuration")
        ContainerDb(redis, "Cache & Sessions", "Redis", "Caches data, manages sessions, handles rate limiting")
    }

    System_Ext(plex, "Plex Media Server", "Media streaming platform")
    System_Ext(overseerr, "Overseerr", "Media request automation")
    System_Ext(tmdb, "TMDB API", "Metadata service")
    System_Ext(youtube, "YouTube API", "Video service")

    Container_Ext(monitoring, "Monitoring Stack", "Prometheus, Grafana, Sentry", "System observability")

    Rel(user, nginx, "Uses", "HTTPS")
    Rel(nginx, webapp, "Serves", "Static content")
    Rel(nginx, api, "Proxies to", "HTTP")

    Rel(webapp, api, "Makes API calls to", "REST/HTTP")
    Rel(webapp, socketio, "Connects to", "WebSocket")

    Rel(api, postgres, "Reads/Writes", "SQL/TCP")
    Rel(api, redis, "Caches data", "Redis Protocol")
    Rel(socketio, redis, "Pub/Sub", "Redis Protocol")

    Rel(api, plex, "Integrates", "REST API")
    Rel(api, overseerr, "Submits requests", "REST API")
    Rel(api, tmdb, "Fetches metadata", "REST API")
    Rel(api, youtube, "Downloads content", "API")

    Rel(api, monitoring, "Sends metrics", "HTTP")

    UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
```

### Level 3: Component Diagram - API Application

```mermaid
C4Component
    title MediaNest API Application Components

    Container(webapp, "Web Application", "React, Next.js")
    Container(socketio, "WebSocket Server", "Socket.IO")

    Container_Boundary(api, "API Application") {
        Component(router, "API Router", "Express Router", "Routes requests to appropriate controllers")

        Component(auth_ctrl, "Auth Controller", "Express Controller", "Handles authentication and authorization")
        Component(media_ctrl, "Media Controller", "Express Controller", "Manages media requests and searches")
        Component(plex_ctrl, "Plex Controller", "Express Controller", "Handles Plex server integration")
        Component(dashboard_ctrl, "Dashboard Controller", "Express Controller", "Provides system overview and statistics")
        Component(admin_ctrl, "Admin Controller", "Express Controller", "Administrative functions")
        Component(youtube_ctrl, "YouTube Controller", "Express Controller", "YouTube download management")

        Component(auth_svc, "Authentication Service", "Service Class", "JWT token management, OAuth integration")
        Component(media_svc, "Media Service", "Service Class", "Media request business logic")
        Component(plex_svc, "Plex Service", "Service Class", "Plex API integration")
        Component(cache_svc, "Cache Service", "Service Class", "Redis operations and caching")
        Component(notif_svc, "Notification Service", "Service Class", "Real-time notifications")
        Component(health_svc, "Health Service", "Service Class", "System health monitoring")
        Component(youtube_svc, "YouTube Service", "Service Class", "YouTube integration")

        Component(user_repo, "User Repository", "Repository Class", "User data access")
        Component(media_repo, "Media Repository", "Repository Class", "Media request data access")
        Component(youtube_repo, "YouTube Repository", "Repository Class", "YouTube download data access")
        Component(service_repo, "Service Repository", "Repository Class", "Service status data access")

        Component(middleware, "Middleware Stack", "Express Middleware", "Authentication, validation, security, rate limiting")
    }

    ContainerDb(postgres, "Primary Database", "PostgreSQL")
    ContainerDb(redis, "Cache Database", "Redis")
    System_Ext(plex, "Plex Media Server")
    System_Ext(overseerr, "Overseerr")
    System_Ext(tmdb, "TMDB API")
    System_Ext(youtube, "YouTube API")

    Rel(webapp, router, "Makes API calls", "REST/HTTP")
    Rel(socketio, notif_svc, "Sends notifications", "Function calls")

    Rel(router, middleware, "Processes through", "Middleware chain")
    Rel(middleware, auth_ctrl, "Routes to")
    Rel(middleware, media_ctrl, "Routes to")
    Rel(middleware, plex_ctrl, "Routes to")
    Rel(middleware, dashboard_ctrl, "Routes to")
    Rel(middleware, admin_ctrl, "Routes to")
    Rel(middleware, youtube_ctrl, "Routes to")

    Rel(auth_ctrl, auth_svc, "Uses")
    Rel(media_ctrl, media_svc, "Uses")
    Rel(plex_ctrl, plex_svc, "Uses")
    Rel(dashboard_ctrl, cache_svc, "Uses")
    Rel(admin_ctrl, health_svc, "Uses")
    Rel(youtube_ctrl, youtube_svc, "Uses")

    Rel(auth_svc, user_repo, "Uses")
    Rel(media_svc, media_repo, "Uses")
    Rel(youtube_svc, youtube_repo, "Uses")
    Rel(health_svc, service_repo, "Uses")

    Rel(user_repo, postgres, "Reads/Writes", "SQL")
    Rel(media_repo, postgres, "Reads/Writes", "SQL")
    Rel(youtube_repo, postgres, "Reads/Writes", "SQL")
    Rel(service_repo, postgres, "Reads/Writes", "SQL")

    Rel(cache_svc, redis, "Caches", "Redis Protocol")
    Rel(auth_svc, redis, "Stores sessions", "Redis Protocol")

    Rel(plex_svc, plex, "Integrates", "REST API")
    Rel(media_svc, overseerr, "Submits requests", "REST API")
    Rel(media_svc, tmdb, "Fetches metadata", "REST API")
    Rel(youtube_svc, youtube, "Downloads", "API")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## Core Components

### 1. Express.js Application Server

- **Framework**: Express.js 4.21+ with TypeScript
- **Architecture**: RESTful API with versioned endpoints
- **Performance**: Optimized with compression, caching, and connection pooling
- **Security**: Helmet, CORS, rate limiting, and authentication middleware

### 2. Authentication & Authorization

- **Primary**: JWT-based authentication with token rotation
- **OAuth**: Plex OAuth integration for seamless user experience
- **Security Features**:
  - Multi-device session management
  - Token blacklisting and rotation
  - Rate limiting per user and endpoint
  - Device fingerprinting

### 3. Data Persistence Layer

- **Database**: PostgreSQL 15+ with Prisma ORM
- **Cache**: Redis 7+ for session management and performance optimization
- **Connection Management**: Optimized connection pooling and query optimization
- **Backup Strategy**: Automated daily backups with disaster recovery procedures

### 4. Real-time Communication

- **WebSocket**: Socket.IO for real-time notifications and status updates
- **Namespaces**: Organized by feature (media requests, downloads, admin)
- **Authentication**: Socket-level authentication with JWT validation

### 5. External Integrations

- **Plex Media Server**: Direct API integration for library management
- **Overseerr**: Media request management and automation
- **The Movie Database (TMDB)**: Metadata enrichment for media content
- **YouTube API**: Video downloading and playlist management
- **Uptime Kuma**: Service monitoring and health checks

## Technology Stack

### Backend Core

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.6+
- **Framework**: Express.js 4.21
- **ORM**: Prisma 5+
- **Validation**: Zod schemas with custom middleware
- **Testing**: Vitest with comprehensive test suites

### Infrastructure

- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose with environment-specific configurations
- **Reverse Proxy**: Nginx with SSL termination and load balancing
- **Process Management**: PM2 for production process management

### Monitoring & Observability

- **Metrics**: Prometheus with custom business metrics
- **Tracing**: OpenTelemetry for distributed tracing
- **Logging**: Structured logging with correlation IDs
- **Error Tracking**: Sentry for error monitoring and alerting
- **Health Checks**: Multi-tier health checking with dependency validation

## Performance Characteristics

### Response Time Optimization

- **API Routes**: Optimized by frequency of use
- **Caching Strategy**: Multi-tier caching (Redis, HTTP headers, application-level)
- **Database**: Optimized indexes and query patterns
- **Connection Pooling**: Configured for high concurrency

### Scalability Features

- **Horizontal Scaling**: Stateless application design
- **Load Balancing**: Nginx-based load balancing
- **Resource Management**: Memory and CPU optimization
- **Circuit Breakers**: Resilience patterns for external service failures

## Security Architecture Deep Dive

### Zero-Trust Security Model

```mermaid
graph TB
    subgraph "Security Perimeter"
        WAF[Web Application Firewall]
        DDP[DDoS Protection]
        SSL[SSL/TLS Termination]
        RATE[Rate Limiting]
    end

    subgraph "Authentication Layer"
        OAUTH[Plex OAuth]
        JWT[JWT Tokens]
        MFA[Multi-Factor Auth]
        SESSION[Session Management]
    end

    subgraph "Authorization Layer"
        RBAC[Role-Based Access Control]
        PERM[Permission System]
        API_KEY[API Key Management]
        DEVICE[Device Registration]
    end

    subgraph "Data Protection"
        ENCRYPT_REST[Encryption at Rest]
        ENCRYPT_TRANSIT[Encryption in Transit]
        SECRET_MGR[Secret Management]
        AUDIT[Audit Logging]
    end

    subgraph "Threat Detection"
        ANOMALY[Anomaly Detection]
        INTRUSION[Intrusion Detection]
        SIEM[SIEM Integration]
        INCIDENT[Incident Response]
    end

    WAF --> OAUTH
    DDP --> JWT
    SSL --> MFA
    RATE --> SESSION

    OAUTH --> RBAC
    JWT --> PERM
    MFA --> API_KEY
    SESSION --> DEVICE

    RBAC --> ENCRYPT_REST
    PERM --> ENCRYPT_TRANSIT
    API_KEY --> SECRET_MGR
    DEVICE --> AUDIT

    ENCRYPT_REST --> ANOMALY
    ENCRYPT_TRANSIT --> INTRUSION
    SECRET_MGR --> SIEM
    AUDIT --> INCIDENT

    style WAF fill:#ffcdd2
    style OAUTH fill:#c8e6c9
    style RBAC fill:#bbdefb
    style ENCRYPT_REST fill:#fff3e0
    style ANOMALY fill:#f3e5f5
```

### Security Implementation Details

#### Authentication & Authorization

- **JWT Security**: Secure token generation and validation with RS256
- **Session Management**: Device-specific session handling with fingerprinting
- **OAuth Integration**: Plex OAuth 2.0 with PKCE flow
- **Rate Limiting**: Intelligent rate limiting per user and endpoint with Redis backing
- **Multi-Device Support**: Session management across multiple devices

#### API Security

- **CORS Policy**: Strict origin validation for production environments
- **Security Headers**: Comprehensive security headers via Helmet.js
  - Content Security Policy (CSP)
  - HTTP Strict Transport Security (HSTS)
  - X-Frame-Options, X-Content-Type-Options
  - Referrer Policy, Permissions Policy
- **Input Validation**: Zod schema validation with sanitization
- **SQL Injection Prevention**: Parameterized queries via Prisma ORM

#### Data Security

- **Encryption at Rest**: AES-256 database encryption
- **Encryption in Transit**: TLS 1.3 for all communications
- **Secret Management**: Environment variables with rotation capabilities
- **Password Hashing**: bcryptjs with configurable salt rounds
- **Token Security**: JWT with short expiration and refresh token rotation

### Data Protection

- **Encryption**: At-rest and in-transit encryption
- **Secret Management**: Environment-based secret management
- **Database Security**: Connection encryption and access controls
- **Audit Logging**: Comprehensive audit trails for security events

## Database Schema Architecture

### Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ MediaRequest : creates
    User ||--o{ YoutubeDownload : initiates
    User ||--o{ SessionToken : has
    User ||--o{ Notification : receives
    User ||--o{ ErrorLog : generates
    User ||--o{ RateLimit : subject_to
    User ||--o{ Account : owns
    User ||--o{ Session : has
    User ||--o{ ServiceConfig : updates

    User {
        uuid id PK
        string plex_id UK
        string plex_username
        string email UK
        string name
        string role
        string plex_token
        string image
        boolean requires_password_change
        datetime created_at
        datetime last_login_at
        string status
    }

    MediaRequest {
        uuid id PK
        uuid user_id FK
        string title
        string media_type
        string tmdb_id
        string status
        string overseerr_id
        datetime created_at
        datetime completed_at
    }

    YoutubeDownload {
        uuid id PK
        uuid user_id FK
        string playlist_url
        string playlist_title
        string status
        json file_paths
        string plex_collection_id
        datetime created_at
        datetime completed_at
    }

    SessionToken {
        uuid id PK
        uuid user_id FK
        string token_hash UK
        datetime expires_at
        datetime created_at
        datetime last_used_at
    }

    Notification {
        uuid id PK
        uuid user_id FK
        string type
        string title
        string message
        boolean read
        datetime created_at
        datetime read_at
        json metadata
    }

    ServiceStatus {
        int id PK
        string service_name UK
        string status
        int response_time_ms
        datetime last_check_at
        decimal uptime_percentage
    }

    ErrorLog {
        uuid id PK
        string correlation_id
        uuid user_id FK
        string error_code
        string error_message
        text stack_trace
        string request_path
        string request_method
        int status_code
        json metadata
        datetime created_at
    }

    ServiceMetric {
        uuid id PK
        string service_name
        string metric_name
        float metric_value
        datetime timestamp
        json metadata
    }

    ServiceIncident {
        uuid id PK
        string service_name
        string incident_type
        string description
        string severity
        string status
        datetime created_at
        datetime resolved_at
        json metadata
    }

    RateLimit {
        int id PK
        uuid user_id FK
        string endpoint
        int request_count
        datetime window_start
    }

    ServiceConfig {
        int id PK
        string service_name UK
        string service_url
        string api_key
        boolean enabled
        json config_data
        datetime updated_at
        uuid updated_by FK
    }

    Account {
        uuid id PK
        uuid user_id FK
        string type
        string provider
        string provider_account_id
        text refresh_token
        text access_token
        int expires_at
        string token_type
        string scope
        text id_token
        string session_state
    }

    Session {
        uuid id PK
        string session_token UK
        uuid user_id FK
        datetime expires
    }

    VerificationToken {
        string identifier
        string token UK
        datetime expires
    }
```

## System Integration Architecture

### External Service Integration Map

```mermaid
graph TB
    subgraph "MediaNest Core"
        CORE[MediaNest Platform]
        API[REST API]
        WS[WebSocket Server]
        BG[Background Jobs]
    end

    subgraph "Media Ecosystem"
        PLEX[Plex Media Server]
        OVERSEERR[Overseerr]
        TMDB[TMDB API]
        YOUTUBE[YouTube API]
    end

    subgraph "Infrastructure Services"
        UPTIME[Uptime Kuma]
        PROMETHEUS[Prometheus]
        GRAFANA[Grafana]
        SENTRY[Sentry]
    end

    subgraph "Authentication"
        PLEX_OAUTH[Plex OAuth]
        JWT_SVC[JWT Service]
    end

    subgraph "Storage Layer"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis)]
        FILES[File Storage]
    end

    %% Core to Media Ecosystem
    API <-->|OAuth Flow| PLEX_OAUTH
    API <-->|Library Management| PLEX
    API <-->|Media Requests| OVERSEERR
    API <-->|Metadata Enrichment| TMDB
    BG <-->|Video Downloads| YOUTUBE

    %% Core to Infrastructure
    API -->|Health Checks| UPTIME
    API -->|Metrics| PROMETHEUS
    PROMETHEUS -->|Visualization| GRAFANA
    API -->|Error Tracking| SENTRY

    %% Authentication Flow
    API -->|Token Management| JWT_SVC
    JWT_SVC -->|Session Storage| REDIS

    %% Data Flow
    API -->|Data Persistence| POSTGRES
    API -->|Caching| REDIS
    BG -->|File Operations| FILES

    %% Real-time Updates
    WS -->|Live Notifications| CORE
    BG -->|Status Updates| WS

    classDef coreSystem fill:#e1f5fe,stroke:#0277bd,stroke-width:3px
    classDef mediaService fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef infrastructure fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef storage fill:#fff3e0,stroke:#f57c00,stroke-width:2px

    class CORE,API,WS,BG coreSystem
    class PLEX,OVERSEERR,TMDB,YOUTUBE,PLEX_OAUTH mediaService
    class UPTIME,PROMETHEUS,GRAFANA,SENTRY infrastructure
    class POSTGRES,REDIS,FILES storage
```
