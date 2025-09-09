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

## Security Implementation

### Authentication & Authorization
- **JWT Security**: Secure token generation and validation
- **Session Management**: Device-specific session handling
- **Password Security**: bcryptjs with salt rounds
- **Rate Limiting**: Intelligent rate limiting per user and endpoint

### API Security
- **CORS**: Configured for production environments
- **Security Headers**: Comprehensive security headers via Helmet
- **Input Validation**: Schema-based validation with sanitization
- **Error Handling**: Secure error responses without information leakage

### Data Protection
- **Encryption**: At-rest and in-transit encryption
- **Secret Management**: Environment-based secret management
- **Database Security**: Connection encryption and access controls
- **Audit Logging**: Comprehensive audit trails for security events