# MediaNest System Architecture Overview

## Overview

MediaNest is a unified web portal for managing Plex media server and related services. The system follows a modern microservices-inspired architecture with a monorepo structure, providing seamless integration between media management, authentication, and external service orchestration.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MediaNest System                         │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)     │  Backend (Express.js)           │
│  ├── React UI           │  ├── REST API                   │
│  ├── NextAuth           │  ├── Socket.IO                  │
│  ├── TailwindCSS        │  ├── Authentication             │
│  └── Socket.IO Client   │  └── Integration Services       │
├─────────────────────────────────────────────────────────────┤
│              Infrastructure & Data Layer                    │
│  ├── PostgreSQL (Primary Database)                        │
│  ├── Redis (Caching & Sessions)                           │
│  ├── Bull/BullMQ (Job Queue)                              │
│  └── Docker Compose (Container Orchestration)             │
├─────────────────────────────────────────────────────────────┤
│                External Integrations                       │
│  ├── Plex Media Server                                    │
│  ├── Overseerr (Media Requests)                          │
│  ├── Uptime Kuma (Monitoring)                            │
│  └── YouTube-dl (Download Management)                     │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend Layer (Next.js 15.5.2)

- **Framework**: Next.js with React 19.1.1
- **UI**: TailwindCSS with custom components
- **Authentication**: NextAuth.js v4.24.7 with Plex OAuth
- **State Management**: TanStack React Query v5.87.1
- **Real-time**: Socket.IO client for live updates
- **Build**: Production-ready with bundle analysis

### 2. Backend Layer (Node.js/Express)

- **Framework**: Express.js v5.1.0 with TypeScript
- **Architecture**: Layered architecture with services, controllers, and repositories
- **Authentication**: JWT + Session-based with device management
- **Real-time**: Socket.IO server with namespaced connections
- **Security**: Helmet, CORS, rate limiting, and CSP headers
- **Monitoring**: OpenTelemetry with Jaeger tracing

### 3. Data Layer

- **Primary Database**: PostgreSQL 15 with Prisma ORM
- **Cache**: Redis 7 for sessions, queue management, and caching
- **Queue**: Bull/BullMQ for async job processing
- **Storage**: File system with Docker volumes

### 4. Infrastructure

- **Containerization**: Docker with multi-service composition
- **Networking**: Bridge network with service discovery
- **Volumes**: Persistent storage for database, cache, and uploads
- **Health Checks**: Comprehensive service health monitoring

## Architecture Patterns

### 1. Monorepo Structure

```
medianest/
├── backend/           # Express.js API server
├── frontend/          # Next.js web application
├── shared/            # Shared utilities and types (referenced)
├── docs/              # Documentation
├── infrastructure/    # Docker and deployment configs
└── docker-compose.yml # Service orchestration
```

### 2. Layered Backend Architecture

```
┌──────────────────┐
│   Routes/API     │ ← Express routes and API endpoints
├──────────────────┤
│   Controllers    │ ← Request handling and validation
├──────────────────┤
│   Services       │ ← Business logic and orchestration
├──────────────────┤
│   Repositories   │ ← Data access abstraction
├──────────────────┤
│   Database       │ ← Prisma ORM + PostgreSQL
└──────────────────┘
```

### 3. Security Architecture

- **Authentication Flow**: Plex OAuth → JWT tokens → Session management
- **Authorization**: Role-based with admin/user distinction
- **Security Headers**: CSP, HSTS, and security middleware
- **Rate Limiting**: API-specific and global rate limiting
- **Input Validation**: Zod schema validation throughout

### 4. Integration Architecture

- **Service Discovery**: Environment-based configuration
- **Resilience**: Circuit breakers (Opossum) and retry logic
- **Health Monitoring**: Comprehensive service status tracking
- **External APIs**: Plex, Overseerr, Uptime Kuma integrations

## Key Architectural Decisions

### Technology Choices

1. **Next.js + Express**: Separate concerns with SSR frontend and dedicated API
2. **PostgreSQL**: Reliable ACID compliance for media metadata
3. **Prisma ORM**: Type-safe database operations with migrations
4. **Socket.IO**: Real-time updates for media processing status
5. **Redis**: High-performance caching and session storage
6. **Docker Compose**: Development and production consistency

### Design Patterns

1. **Repository Pattern**: Clean data access abstraction
2. **Service Layer**: Business logic separation
3. **Middleware Chain**: Request processing pipeline
4. **Event-Driven**: Socket.IO for real-time communication
5. **Configuration Management**: Environment-based with validation

### Scalability Considerations

1. **Horizontal Scaling**: Stateless backend design
2. **Database Optimization**: Indexes on critical query paths
3. **Caching Strategy**: Redis for frequent data access
4. **Queue Management**: Async processing for heavy operations
5. **Resource Limits**: Memory and connection pooling

## Performance Characteristics

### Database Performance

- **Connection Pooling**: Configured for optimal concurrency
- **Query Optimization**: Strategic indexing on user, media, and time-based queries
- **Migration Strategy**: Prisma-managed schema evolution

### Caching Strategy

- **Redis Usage**: Sessions, rate limiting, and query caching
- **Memory Management**: LRU eviction with 256MB limit
- **Cache Invalidation**: Event-driven cache updates

### Network Optimization

- **Compression**: Gzip compression for API responses
- **CDN Ready**: Static asset optimization
- **Connection Management**: Keep-alive and connection reuse

## Monitoring and Observability

### Health Checks

- **Service Health**: Database, Redis, and external service monitoring
- **Metrics Endpoint**: Prometheus-compatible metrics
- **Error Tracking**: Structured logging with correlation IDs

### Logging Strategy

- **Structured Logging**: JSON format with correlation tracking
- **Log Rotation**: Daily rotation with retention policies
- **Error Correlation**: Request tracing throughout the system

### Performance Monitoring

- **OpenTelemetry**: Distributed tracing with Jaeger
- **Metrics Collection**: Custom metrics for business logic
- **Health Dashboards**: Service status visualization

## Security Architecture

### Authentication & Authorization

- **Plex OAuth**: Primary authentication method
- **JWT Tokens**: Stateless authentication with refresh
- **Session Management**: Redis-backed session storage
- **Role-Based Access**: Admin and user role separation

### Security Measures

- **Input Validation**: Zod schema validation
- **SQL Injection Prevention**: Prisma ORM parameterized queries
- **XSS Protection**: Content Security Policy headers
- **CSRF Protection**: SameSite cookies and CSRF tokens
- **Rate Limiting**: API endpoint protection

## Future Considerations

### Scalability Roadmap

1. **Microservice Migration**: Service decomposition strategy
2. **Database Sharding**: User-based partitioning
3. **CDN Integration**: Static asset distribution
4. **Load Balancing**: Multiple backend instance support

### Technology Evolution

1. **Monitoring Enhancement**: APM integration
2. **CI/CD Pipeline**: Automated deployment pipeline
3. **Testing Strategy**: Enhanced test coverage and E2E testing
4. **Documentation**: API documentation with OpenAPI/Swagger

This architecture provides a robust foundation for media management while maintaining flexibility for future enhancements and scaling requirements.
