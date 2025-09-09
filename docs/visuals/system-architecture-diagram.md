# MediaNest System Architecture

## High-Level Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        FE[Frontend<br/>Next.js 14<br/>React 18]
        MOB[Mobile App<br/>React Native]
        API_CLIENT[API Client<br/>Third-party]
    end

    subgraph "Load Balancer & Reverse Proxy"
        LB[Traefik / HAProxy<br/>Layer 7 Load Balancer]
        NGINX[Nginx<br/>Static Assets & SSL]
    end

    subgraph "Application Layer"
        subgraph "Backend Services"
            API[Express.js API<br/>Node.js 20<br/>TypeScript]
            WS[WebSocket Server<br/>Socket.IO]
            AUTH[Authentication<br/>JWT + Redis]
        end
        
        subgraph "Processing Services"
            MEDIA[Media Processing<br/>FFmpeg + Sharp]
            QUEUE[Queue System<br/>Redis Bull]
            THUMB[Thumbnail Generator<br/>Sharp/ImageMagick]
        end
    end

    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Primary Database)]
        REDIS[(Redis<br/>Cache + Sessions)]
        S3[Object Storage<br/>S3 Compatible]
    end

    subgraph "External Integrations"
        PLEX[Plex Media Server<br/>API Integration]
        OVERSEERR[Overseerr<br/>Request Management]
        UPTIME[Uptime Kuma<br/>Monitoring]
    end

    subgraph "Infrastructure"
        DOCKER[Docker Swarm<br/>Orchestration]
        MONITOR[Prometheus + Grafana<br/>Monitoring Stack]
        BACKUP[Automated Backups<br/>Database + Media]
    end

    %% Client connections
    FE --> LB
    MOB --> LB
    API_CLIENT --> LB

    %% Load balancer routing
    LB --> API
    LB --> FE
    NGINX --> FE

    %% Internal service communication
    API --> AUTH
    API --> WS
    API --> MEDIA
    API --> QUEUE
    WS --> REDIS

    %% Data connections
    API --> PG
    API --> REDIS
    AUTH --> REDIS
    MEDIA --> S3
    THUMB --> S3

    %% External service integration
    API --> PLEX
    API --> OVERSEERR
    API --> UPTIME

    %% Infrastructure monitoring
    DOCKER --> MONITOR
    API --> MONITOR
    PG --> BACKUP
    S3 --> BACKUP

    %% Styling
    classDef clientLayer fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef appLayer fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef dataLayer fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef infraLayer fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef externalLayer fill:#fce4ec,stroke:#880e4f,stroke-width:2px

    class FE,MOB,API_CLIENT clientLayer
    class API,WS,AUTH,MEDIA,QUEUE,THUMB appLayer
    class PG,REDIS,S3 dataLayer
    class DOCKER,MONITOR,BACKUP infraLayer
    class PLEX,OVERSEERR,UPTIME externalLayer
```

## Architecture Principles

### 🏗️ **Microservices Architecture**
- **Separation of Concerns**: Each service handles a specific domain
- **Independent Scaling**: Services can scale based on load
- **Fault Isolation**: Service failures don't cascade

### 🔒 **Security First**
- **Defense in Depth**: Multiple security layers
- **Principle of Least Privilege**: Minimal required permissions
- **Zero Trust Network**: Verify every connection

### 📈 **Performance & Scalability**
- **Horizontal Scaling**: Add more instances as needed
- **Caching Strategy**: Multi-tier caching with Redis
- **Asynchronous Processing**: Non-blocking operations

### 🔧 **Operational Excellence**
- **Infrastructure as Code**: Docker & Docker Compose
- **Monitoring & Alerting**: Comprehensive observability
- **Automated Recovery**: Self-healing systems

## Component Responsibilities

| Component | Purpose | Technology | Scaling Strategy |
|-----------|---------|------------|------------------|
| **Frontend** | User Interface & Experience | Next.js 14, React 18, TypeScript | CDN + Edge Caching |
| **API Gateway** | Request routing, rate limiting | Express.js, Helmet, CORS | Horizontal (Load Balancer) |
| **Authentication** | User auth, session management | JWT, Redis, bcryptjs | Stateless + Redis clustering |
| **Media Processing** | Video/image processing | FFmpeg, Sharp | Queue-based horizontal |
| **Database** | Data persistence | PostgreSQL 15+ | Read replicas, connection pooling |
| **Cache Layer** | Performance optimization | Redis 7+ | Redis Cluster, persistence |
| **Object Storage** | Media file storage | S3-compatible | Built-in redundancy |

## Data Flow Patterns

### 🔄 **Request-Response Pattern**
```
Client → Load Balancer → API → Database → Response
```

### 📨 **Event-Driven Pattern**
```
API → Queue → Worker → Processing → Notification
```

### 🔄 **Real-time Updates**
```
Backend Event → WebSocket → Client Update
```

## Security Architecture

### 🛡️ **Authentication Flow**
```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth Service
    participant R as Redis
    participant D as Database

    C->>A: Login Request
    A->>D: Verify Credentials
    D-->>A: User Data
    A->>R: Store Session
    A-->>C: JWT Token
    
    Note over C,R: Subsequent requests
    C->>A: API Request + JWT
    A->>R: Validate Session
    R-->>A: Session Valid
    A-->>C: Authorized Response
```

### 🔐 **Data Protection Layers**
1. **Transport**: TLS 1.3 encryption
2. **Application**: Input validation, sanitization
3. **Database**: Encrypted at rest, connection encryption
4. **Session**: Secure JWT tokens, Redis session store

## Performance Characteristics

### ⚡ **Response Time Targets**
- **API Endpoints**: < 100ms (95th percentile)
- **Media Upload**: < 5s for 100MB files
- **Search Queries**: < 50ms
- **Page Load**: < 2s (First Contentful Paint)

### 📊 **Scalability Metrics**
- **Concurrent Users**: 1000+ simultaneous
- **File Storage**: Unlimited (S3 scaling)
- **Database**: 10TB+ with read replicas
- **Processing Queue**: 100+ jobs/minute

## Deployment Architecture

### 🐳 **Docker Swarm Orchestration**
```yaml
Services:
  - medianest-frontend (3 replicas)
  - medianest-backend (3 replicas)  
  - medianest-worker (2 replicas)
  - postgres (1 primary + 2 read replicas)
  - redis (3-node cluster)
  - traefik (2 replicas)
```

### 📈 **Auto-scaling Triggers**
- **CPU Usage**: > 70% for 5 minutes
- **Memory Usage**: > 80% for 3 minutes
- **Queue Depth**: > 100 pending jobs
- **Response Time**: > 200ms average

## Integration Points

### 🔌 **External Services**
- **Plex**: Media library sync, metadata enrichment
- **Overseerr**: Content request management
- **Uptime Kuma**: Infrastructure monitoring
- **Third-party APIs**: Metadata providers (TMDB, TVDB)

### 📡 **Webhook System**
- **Media Events**: Upload, processing completion
- **User Events**: Registration, role changes  
- **System Events**: Health checks, alerts

## Disaster Recovery

### 💾 **Backup Strategy**
- **Database**: Point-in-time recovery (PITR)
- **Media Files**: Incremental backups to secondary storage
- **Configuration**: Version-controlled infrastructure

### 🔄 **Recovery Procedures**
- **RTO (Recovery Time Objective)**: < 15 minutes
- **RPO (Recovery Point Objective)**: < 5 minutes data loss
- **Automated Failover**: Health check-based switching

---

*This architecture supports the MediaNest platform's core mission of providing scalable, secure, and performant media management capabilities.*