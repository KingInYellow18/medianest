# MediaNest System Architecture

**Version:** 2.0  
**Date:** September 2025  
**Status:** Active Implementation  
**Tags:** architecture, system-design, monolithic, containers

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Principles](#architecture-principles)
4. [Component Architecture](#component-architecture)
5. [Data Architecture](#data-architecture)
6. [Integration Architecture](#integration-architecture)
7. [Deployment Architecture](#deployment-architecture)
8. [Performance & Scalability](#performance--scalability)
9. [Monitoring & Observability](#monitoring--observability)
10. [Disaster Recovery](#disaster-recovery)

---

## Executive Summary

MediaNest is a unified web portal that consolidates multiple media management services into a single authenticated interface. The architecture follows a **monolithic design pattern** optimized for 10-20 concurrent users, leveraging modern web technologies and containerization for easy deployment and maintenance.

### Key Architectural Decisions

- **Monolithic Architecture**: Simplified deployment and maintenance for small user base
- **Container-First Design**: Docker Compose V2 for consistent environments
- **Real-time Communication**: Socket.io for live status updates
- **Secure by Default**: Plex OAuth, rate limiting, and AES-256-GCM encrypted storage
- **Service Resilience**: Circuit breakers with graceful degradation when external services unavailable

### Implementation Status

| Phase       | Status         | Description                  |
| ----------- | -------------- | ---------------------------- |
| **Phase 1** | ✅ Complete    | Core Infrastructure          |
| **Phase 2** | ✅ Complete    | External Service Integration |
| **Phase 3** | ✅ Complete    | Dashboard & Media Search UI  |
| **Phase 4** | ⏳ In Progress | YouTube Integration          |
| **Phase 5** | 📋 Planned     | Advanced Features            |

---

## System Overview

### High-Level Architecture

```mermaid
graph TB
    subgraph "External Services"
        Plex[Plex Media Server]
        YT[YouTube API]
        TMDB[TMDB API]
        Sonarr[Sonarr]
        Radarr[Radarr]
        Tautulli[Tautulli]
    end

    subgraph "MediaNest Container"
        LB[Nginx Load Balancer]

        subgraph "Application Layer"
            FE[Next.js Frontend]
            API[Express.js API]
        end

        subgraph "Data Layer"
            DB[(PostgreSQL)]
            Cache[(Redis)]
            Files[File Storage]
        end

        subgraph "Services Layer"
            Auth[Authentication Service]
            Media[Media Processing]
            Req[Request Management]
            Socket[WebSocket Service]
        end
    end

    Users --> LB
    LB --> FE
    FE --> API
    API --> Auth
    API --> Media
    API --> Req
    API --> Socket
    API --> DB
    API --> Cache
    Media --> Files

    API --> Plex
    API --> YT
    API --> TMDB
    API --> Sonarr
    API --> Radarr
    API --> Tautulli

    style FE fill:#e1f5fe
    style API fill:#f3e5f5
    style DB fill:#e8f5e8
    style Cache fill:#fff3e0
```

### Core Components

| Component           | Technology       | Purpose                          |
| ------------------- | ---------------- | -------------------------------- |
| **Frontend**        | Next.js 14       | React-based SPA with SSR         |
| **API Server**      | Express.js       | RESTful API with middleware      |
| **Database**        | PostgreSQL 15    | Primary data persistence         |
| **Cache**           | Redis 7          | Session storage & caching        |
| **Authentication**  | NextAuth.js      | Plex OAuth integration           |
| **File Processing** | Node.js + FFmpeg | Media processing pipeline        |
| **Real-time**       | Socket.io        | Live updates & notifications     |
| **Proxy**           | Nginx            | Load balancing & SSL termination |

---

## Architecture Principles

### 1. Simplicity First

- **Monolithic design** for easier debugging and deployment
- **Single database** to avoid distributed system complexity
- **Containerized services** for consistent environments

### 2. Security by Design

- **Zero-trust architecture** with authentication on every request
- **Encrypted storage** for sensitive configuration data
- **Rate limiting** and CSRF protection by default

### 3. Performance Optimization

- **Redis caching** for frequently accessed data
- **Connection pooling** for database efficiency
- **Lazy loading** and code splitting in frontend

### 4. Operational Excellence

- **Health checks** for all services
- **Structured logging** with centralized aggregation
- **Graceful degradation** when external services are unavailable

---

## Component Architecture

### Frontend Architecture (Next.js)

```mermaid
graph TD
    subgraph "Next.js Application"
        Pages[Pages Router]
        Components[React Components]
        Store[State Management]
        API_Client[API Client]
    end

    subgraph "UI Layer"
        Auth_UI[Auth Pages]
        Dashboard[Dashboard]
        Media_UI[Media Management]
        Request_UI[Request System]
        Admin_UI[Admin Panel]
    end

    Pages --> Components
    Components --> Store
    Components --> API_Client

    Pages --> Auth_UI
    Pages --> Dashboard
    Pages --> Media_UI
    Pages --> Request_UI
    Pages --> Admin_UI

    style Components fill:#e3f2fd
    style Store fill:#f1f8e9
    style API_Client fill:#fce4ec
```

#### Key Frontend Patterns

- **Component-based architecture** with reusable UI components
- **Context API** for global state management
- **Custom hooks** for API interactions and business logic
- **Error boundaries** for graceful error handling
- **Responsive design** with Tailwind CSS

### Backend Architecture (Express.js)

```mermaid
graph TD
    subgraph "Express.js Application"
        Router[Express Router]
        Middleware[Middleware Stack]
        Controllers[Route Controllers]
        Services[Business Logic]
        Models[Data Models]
    end

    subgraph "Middleware Stack"
        CORS[CORS Handler]
        Auth_MW[Authentication]
        Rate_Limit[Rate Limiting]
        Validation[Input Validation]
        Error_MW[Error Handler]
    end

    Router --> Middleware
    Middleware --> Controllers
    Controllers --> Services
    Services --> Models

    Middleware --> CORS
    Middleware --> Auth_MW
    Middleware --> Rate_Limit
    Middleware --> Validation
    Middleware --> Error_MW

    style Services fill:#e8f5e8
    style Models fill:#fff3e0
    style Middleware fill:#f3e5f5
```

#### API Design Patterns

- **RESTful endpoints** with consistent naming conventions
- **Middleware-first approach** for cross-cutting concerns
- **Service layer** separation for business logic
- **Repository pattern** for data access abstraction
- **Response envelope** standardization

---

## Data Architecture

### Database Schema Overview

```mermaid
erDiagram
    USER {
        uuid id PK
        string plex_id UK
        string username
        string email
        jsonb preferences
        timestamp created_at
        timestamp updated_at
    }

    SESSION {
        uuid id PK
        uuid user_id FK
        string session_token
        timestamp expires_at
        jsonb metadata
    }

    MEDIA_ITEM {
        uuid id PK
        string plex_id UK
        string title
        string type
        jsonb metadata
        string file_path
        timestamp created_at
    }

    REQUEST {
        uuid id PK
        uuid user_id FK
        uuid media_id FK
        string type
        string status
        jsonb details
        timestamp created_at
    }

    APPROVAL {
        uuid id PK
        uuid request_id FK
        uuid approved_by FK
        string status
        text comments
        timestamp approved_at
    }

    USER ||--o{ SESSION : "has"
    USER ||--o{ REQUEST : "creates"
    MEDIA_ITEM ||--o{ REQUEST : "referenced_by"
    REQUEST ||--o{ APPROVAL : "has"
    USER ||--o{ APPROVAL : "approves"
```

### Data Access Patterns

| Pattern             | Implementation         | Use Case                   |
| ------------------- | ---------------------- | -------------------------- |
| **Repository**      | Prisma ORM             | Data access abstraction    |
| **Active Record**   | Model classes          | Business logic on entities |
| **Query Builder**   | Prisma Query API       | Complex queries            |
| **Connection Pool** | Prisma connection pool | Performance optimization   |
| **Migrations**      | Prisma migrations      | Schema versioning          |

---

## Integration Architecture

### External Service Integration

```mermaid
graph LR
    subgraph "MediaNest Core"
        API[API Gateway]
        Circuit[Circuit Breaker]
        Cache[Response Cache]
    end

    subgraph "External Services"
        Plex[Plex Media Server]
        YT[YouTube API]
        TMDB[TMDB API]
        Sonarr[Sonarr API]
        Radarr[Radarr API]
        Tautulli[Tautulli API]
    end

    API --> Circuit
    Circuit --> Cache

    Cache --> Plex
    Cache --> YT
    Cache --> TMDB
    Cache --> Sonarr
    Cache --> Radarr
    Cache --> Tautulli

    style Circuit fill:#ffebee
    style Cache fill:#e0f2f1
```

### Integration Patterns

- **Circuit Breaker Pattern**: Prevents cascading failures
- **Retry with Exponential Backoff**: Resilient API calls
- **Response Caching**: Reduces external API load
- **Graceful Degradation**: Core functionality remains available
- **Event-driven Architecture**: Webhook processing for real-time updates

---

## Deployment Architecture

### Container Architecture

```mermaid
graph TB
    subgraph "Docker Compose Stack"
        subgraph "Application Services"
            App[medianest-app]
            Worker[medianest-worker]
        end

        subgraph "Infrastructure Services"
            DB[postgresql]
            Cache[redis]
            Proxy[nginx]
        end

        subgraph "Monitoring Stack"
            Prom[prometheus]
            Graf[grafana]
            Alert[alertmanager]
        end
    end

    subgraph "External"
        Storage[Volume Storage]
        Network[Docker Networks]
        Secrets[Docker Secrets]
    end

    App --> DB
    App --> Cache
    Proxy --> App
    Worker --> DB
    Worker --> Cache

    Prom --> App
    Graf --> Prom
    Alert --> Prom

    App --> Storage
    DB --> Storage

    style App fill:#e3f2fd
    style Worker fill:#f1f8e9
    style DB fill:#e8f5e8
    style Cache fill:#fff3e0
```

### Deployment Environments

| Environment     | Purpose                | Configuration                  |
| --------------- | ---------------------- | ------------------------------ |
| **Development** | Local development      | Docker Compose with hot reload |
| **Staging**     | Pre-production testing | Production-like with test data |
| **Production**  | Live system            | Optimized with monitoring      |

---

## Performance & Scalability

### Performance Optimization Strategies

1. **Database Optimization**

   - Connection pooling (10-20 connections)
   - Query optimization with indexes
   - Read replicas for reporting queries

2. **Caching Strategy**

   - Redis for session storage
   - API response caching (5-minute TTL)
   - Static asset caching with CDN

3. **Frontend Optimization**

   - Code splitting and lazy loading
   - Image optimization and WebP support
   - Service worker for offline functionality

4. **API Optimization**
   - Response compression (gzip)
   - Pagination for large datasets
   - Selective field loading

### Scalability Considerations

- **Horizontal scaling**: Load balancer ready
- **Database scaling**: Read replica support
- **Cache scaling**: Redis cluster support
- **Service separation**: Microservice migration path

---

## Monitoring & Observability

### Monitoring Stack

```mermaid
graph TB
    subgraph "Application"
        App[MediaNest App]
        Logs[Application Logs]
        Metrics[Custom Metrics]
    end

    subgraph "Monitoring Infrastructure"
        Prom[Prometheus]
        Graf[Grafana]
        Alert[Alertmanager]
        Loki[Loki]
    end

    subgraph "Dashboards"
        Sys[System Dashboard]
        App_Dash[Application Dashboard]
        Bus[Business Dashboard]
    end

    App --> Logs
    App --> Metrics
    Logs --> Loki
    Metrics --> Prom
    Prom --> Graf
    Prom --> Alert
    Graf --> Sys
    Graf --> App_Dash
    Graf --> Bus

    style Prom fill:#ff9800
    style Graf fill:#f44336
    style Alert fill:#9c27b0
```

### Key Metrics

- **System Metrics**: CPU, Memory, Disk, Network
- **Application Metrics**: Response time, Error rate, Throughput
- **Business Metrics**: Active users, Media requests, API usage
- **External Service Metrics**: Plex availability, API response times

---

## Disaster Recovery

### Backup Strategy

1. **Database Backups**

   - Daily automated backups
   - Point-in-time recovery capability
   - Cross-region backup storage

2. **Configuration Backups**

   - Docker Compose files
   - Environment configurations
   - SSL certificates

3. **Application Data**
   - User preferences and settings
   - Request history and approvals
   - Cached media metadata

### Recovery Procedures

1. **Service Recovery**: Automated container restart
2. **Database Recovery**: Point-in-time restore from backup
3. **Complete System Recovery**: Infrastructure as Code deployment

---

## Next Steps

### Phase 4: YouTube Integration Enhancement

- Complete backend YouTube API integration
- Enhanced media discovery features
- Automated content organization

### Phase 5: Advanced Features

- Machine learning for content recommendations
- Advanced analytics and reporting
- Mobile application development

---

## Related Documentation

- [Security Architecture](security-architecture.md) - Detailed security implementation
- [API Design](api-design.md) - API architecture and patterns
- [Database Design](database-design.md) - Detailed database schema
- [Deployment Guide](../06-deployment/README.md) - Deployment procedures
- [Performance Guide](../11-performance/README.md) - Performance optimization

---

_Last updated: September 2025_  
_Architecture review scheduled: December 2025_
