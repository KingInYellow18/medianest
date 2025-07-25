# MediaNest Backend Integration Architecture Diagram

## System Architecture Overview

```mermaid
graph TB
    %% External Layer
    Internet([Internet]) --> LB[Load Balancer/CDN]
    LB --> Nginx[Nginx Reverse Proxy<br/>Port 80/443]

    %% Frontend Network
    subgraph "Frontend Network (172.21.0.0/24)"
        Nginx --> Frontend[Frontend Service<br/>Next.js:3000]
        Nginx --> |WebSocket| Backend
        Nginx --> |API Calls| Backend
    end

    %% Backend Network
    subgraph "Backend Network (172.20.0.0/24)"
        Backend[Backend Service<br/>Express.js:4000]
        PostgreSQL[(PostgreSQL:5432<br/>Database)]
        Redis[(Redis:6379<br/>Cache/Queue)]

        Backend --> PostgreSQL
        Backend --> Redis
        Backend --> |Socket.IO| Frontend
    end

    %% External Services
    subgraph "External Services"
        Plex[Plex Media Server]
        Overseerr[Overseerr]
        UptimeKuma[Uptime Kuma]
        YouTube[YouTube/yt-dlp]
    end

    Backend --> |API| Plex
    Backend --> |API| Overseerr
    Backend --> |API| UptimeKuma
    Backend --> |Download| YouTube

    %% Storage
    subgraph "Persistent Storage"
        PostgresData[PostgreSQL Data]
        RedisData[Redis Data]
        Uploads[App Uploads]
        Downloads[YouTube Downloads]
        Logs[Application Logs]
        Backups[Automated Backups]
    end

    PostgreSQL --> PostgresData
    Redis --> RedisData
    Backend --> Uploads
    Backend --> Downloads
    Backend --> Logs
    PostgresData --> Backups
    RedisData --> Backups

    %% Monitoring
    subgraph "Monitoring & Observability"
        Prometheus[Prometheus Metrics]
        HealthChecks[Health Endpoints]
        Winston[Winston Logging]
    end

    Backend --> Prometheus
    Backend --> HealthChecks
    Backend --> Winston
```

## Container Communication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant N as Nginx
    participant F as Frontend
    participant B as Backend
    participant DB as PostgreSQL
    participant R as Redis
    participant P as Plex

    %% Authentication Flow
    C->>N: HTTPS Request (443)
    N->>F: Proxy to Frontend (3000)
    F->>N: API Request
    N->>B: Proxy to Backend (4000)
    B->>DB: User Lookup
    DB-->>B: User Data
    B->>P: Plex OAuth
    P-->>B: Auth Response
    B->>R: Cache Session
    B-->>N: JWT Token
    N-->>C: Authenticated Response

    %% Real-time Updates
    C->>N: WebSocket Connection
    N->>B: Socket.IO Proxy
    B-->>C: Real-time Events
```

## Service Dependency Graph

```mermaid
graph TD
    %% Infrastructure Layer
    Docker[Docker Engine] --> Compose[Docker Compose]
    Compose --> Network1[backend-network]
    Compose --> Network2[frontend-network]
    Compose --> Secrets[Docker Secrets]

    %% Data Layer
    Network1 --> PostgreSQL
    Network1 --> Redis
    PostgreSQL --> |Depends on| Secrets
    Redis --> |Depends on| Secrets

    %% Application Layer
    Backend --> |Depends on| PostgreSQL
    Backend --> |Depends on| Redis
    Backend --> |Uses| Secrets
    Network1 --> Backend
    Network2 --> Backend

    %% Presentation Layer
    Frontend --> |Depends on| Backend
    Network2 --> Frontend

    %% Gateway Layer
    Nginx --> |Depends on| Frontend
    Nginx --> |Depends on| Backend
    Network2 --> Nginx

    %% External Dependencies
    Backend -.->|Optional| Plex
    Backend -.->|Optional| Overseerr
    Backend -.->|Optional| UptimeKuma

    style PostgreSQL fill:#336791,stroke:#fff,color:#fff
    style Redis fill:#D82C20,stroke:#fff,color:#fff
    style Backend fill:#68BD45,stroke:#fff,color:#fff
    style Frontend fill:#61DAFB,stroke:#000,color:#000
    style Nginx fill:#269539,stroke:#fff,color:#fff
```

## Security Architecture

```mermaid
graph LR
    %% Request Flow
    Client[Client Request] --> WAF[Web Application Firewall]
    WAF --> RateLimit[Rate Limiting<br/>Nginx + Redis]
    RateLimit --> CORS[CORS Validation]
    CORS --> Auth[JWT Authentication]
    Auth --> Authorization[Role Authorization]
    Authorization --> API[API Endpoint]

    %% Security Layers
    subgraph "Security Controls"
        SSL[TLS 1.2/1.3]
        Headers[Security Headers]
        CSP[Content Security Policy]
        HSTS[HSTS Headers]
    end

    %% Rate Limiting Zones
    subgraph "Rate Limiting"
        APILimit[API: 100req/min]
        AuthLimit[Auth: 5req/min]
        YouTubeLimit[YouTube: 5req/hour]
        StaticLimit[Static: 200req/min]
    end

    RateLimit --> APILimit
    RateLimit --> AuthLimit
    RateLimit --> YouTubeLimit
    RateLimit --> StaticLimit
```

## Data Flow Architecture

```mermaid
graph TB
    %% User Interactions
    User[User Interface] --> |HTTPS| Nginx

    %% API Gateway
    Nginx --> |/api/v1/*| Backend
    Nginx --> |/_next/*| Frontend
    Nginx --> |WebSocket| Backend

    %% Backend Processing
    subgraph "Backend Services"
        AuthController[Auth Controller]
        MediaController[Media Controller]
        YouTubeController[YouTube Controller]
        DashboardController[Dashboard Controller]

        AuthService[Auth Service]
        PlexService[Plex Service]
        YouTubeService[YouTube Service]
        CacheService[Cache Service]
    end

    Backend --> AuthController
    Backend --> MediaController
    Backend --> YouTubeController
    Backend --> DashboardController

    AuthController --> AuthService
    MediaController --> PlexService
    YouTubeController --> YouTubeService
    DashboardController --> CacheService

    %% Data Persistence
    AuthService --> PostgreSQL
    PlexService --> PostgreSQL
    YouTubeService --> PostgreSQL
    CacheService --> Redis

    %% External Integrations
    PlexService --> |API| Plex
    MediaController --> |API| Overseerr
    DashboardController --> |API| UptimeKuma
    YouTubeService --> |CLI| YouTubeDL

    %% Real-time Updates
    Backend --> |Socket.IO| WebSocket[WebSocket Events]
    WebSocket --> |Status Updates| User
    WebSocket --> |Progress Updates| User
    WebSocket --> |Notifications| User
```

## Deployment Architecture

```mermaid
graph TB
    %% Deployment Pipeline
    Git[Git Repository] --> CI[CI/CD Pipeline]
    CI --> Build[Docker Build]
    Build --> Registry[Docker Registry]
    Registry --> Deploy[Production Deploy]

    %% Production Environment
    subgraph "Production Infrastructure"
        LoadBalancer[Load Balancer]

        subgraph "Docker Swarm/Compose"
            NginxService[Nginx Service<br/>Replicas: 1]
            BackendService[Backend Service<br/>Replicas: 1-3]
            FrontendService[Frontend Service<br/>Replicas: 1-2]
            PostgresService[PostgreSQL Service<br/>Replicas: 1]
            RedisService[Redis Service<br/>Replicas: 1]
        end

        subgraph "Storage"
            PostgresVolume[PostgreSQL Volume]
            RedisVolume[Redis Volume]
            UploadsVolume[Uploads Volume]
            DownloadsVolume[Downloads Volume]
            LogsVolume[Logs Volume]
            BackupsVolume[Backups Volume]
        end

        subgraph "Monitoring"
            HealthChecks[Health Checks]
            Metrics[Metrics Collection]
            Alerting[Alerting System]
        end
    end

    Deploy --> LoadBalancer
    LoadBalancer --> NginxService

    PostgresService --> PostgresVolume
    RedisService --> RedisVolume
    BackendService --> UploadsVolume
    BackendService --> DownloadsVolume
    BackendService --> LogsVolume

    BackendService --> HealthChecks
    BackendService --> Metrics
    Metrics --> Alerting
```

## Network Security Model

```mermaid
graph TB
    %% External Network
    Internet --> Firewall[Host Firewall<br/>Ports: 80, 443, 22]
    Firewall --> Host[Docker Host]

    %% Docker Networks
    Host --> Bridge[Docker Bridge]
    Bridge --> FrontendNet[frontend-network<br/>172.21.0.0/24]
    Bridge --> BackendNet[backend-network<br/>172.20.0.0/24]

    %% Network Isolation
    subgraph "Frontend Network"
        FrontendContainer[Frontend Container]
        NginxContainer[Nginx Container]
    end

    subgraph "Backend Network"
        BackendContainer[Backend Container]
        PostgresContainer[PostgreSQL Container]
        RedisContainer[Redis Container]
    end

    FrontendNet --> FrontendContainer
    FrontendNet --> NginxContainer
    FrontendNet --> BackendContainer

    BackendNet --> BackendContainer
    BackendNet --> PostgresContainer
    BackendNet --> RedisContainer

    %% Security Controls
    subgraph "Security Controls"
        NoNewPrivileges[no-new-privileges:true]
        CapDrop[capabilities: DROP ALL]
        NonRoot[User: nodejs:1001]
        SecretsMount[Secrets: Read-only]
        ResourceLimits[Resource Limits]
    end

    BackendContainer --> NoNewPrivileges
    BackendContainer --> CapDrop
    BackendContainer --> NonRoot
    BackendContainer --> SecretsMount
    BackendContainer --> ResourceLimits
```

## Integration Points Summary

| Component                 | Integration Point | Protocol            | Security        |
| ------------------------- | ----------------- | ------------------- | --------------- |
| **Nginx ↔ Backend**      | Port 4000         | HTTP/WebSocket      | TLS Termination |
| **Backend ↔ PostgreSQL** | Port 5432         | PostgreSQL Protocol | Docker Secrets  |
| **Backend ↔ Redis**      | Port 6379         | Redis Protocol      | Password Auth   |
| **Backend ↔ Plex**       | External API      | HTTPS               | OAuth 2.0       |
| **Backend ↔ Frontend**   | Socket.IO         | WebSocket           | CORS + JWT      |
| **Nginx ↔ Frontend**     | Port 3000         | HTTP                | Reverse Proxy   |

## Performance Characteristics

| Service        | Resource Limits | Health Check   | Startup Time |
| -------------- | --------------- | -------------- | ------------ |
| **Backend**    | 1 CPU, 1GB RAM  | /api/health    | 60 seconds   |
| **PostgreSQL** | 1 CPU, 1GB RAM  | pg_isready     | 30 seconds   |
| **Redis**      | 0.5 CPU, 512MB  | redis-cli ping | 20 seconds   |
| **Frontend**   | 0.5 CPU, 512MB  | HTTP check     | 45 seconds   |
| **Nginx**      | 1 CPU, 256MB    | stub_status    | 30 seconds   |

This architecture provides a comprehensive, production-ready backend integration with proper security, monitoring, and scalability considerations.
