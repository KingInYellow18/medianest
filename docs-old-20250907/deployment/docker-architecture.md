# Docker Architecture & Service Topology

This document describes the containerized architecture of MediaNest and how services are orchestrated using Docker Compose.

## Service Architecture Diagram

The following diagram shows the complete Docker service topology:

```mermaid
graph TB
    subgraph "Docker Host Environment"
        subgraph "medianest-network (Bridge Network)"
            subgraph "Application Services"
                APP[medianest-app<br/>Port: 3000, 4000<br/>Node.js Application]
            end

            subgraph "Database Services"
                POSTGRES[medianest-postgres<br/>Port: 5432<br/>PostgreSQL 15]
                REDIS[medianest-redis<br/>Port: 6379<br/>Redis 7]
            end

            subgraph "Reverse Proxy (Optional)"
                NGINX[nginx-proxy<br/>Port: 80, 443<br/>SSL Termination]
            end
        end

        subgraph "Docker Volumes"
            PGDATA[postgres_data<br/>Database Storage]
            REDISDATA[redis_data<br/>Cache Storage]
            UPLOADS[uploads<br/>File Storage]
            YOUTUBE[./youtube<br/>Download Storage]
        end

        subgraph "Host Filesystem"
            CONFIG[./infrastructure/database/<br/>init.sql]
            SSL_CERTS[./infrastructure/nginx/<br/>SSL Certificates]
        end
    end

    subgraph "External Dependencies"
        PLEX_SERVER[Plex Media Server]
        OVERSEERR_API[Overseerr API]
        UPTIME_KUMA[Uptime Kuma]
        YOUTUBE_API[YouTube API]
    end

    %% Internal connections
    APP --> POSTGRES
    APP --> REDIS
    NGINX --> APP

    %% Volume mounts
    POSTGRES -.-> PGDATA
    REDIS -.-> REDISDATA
    APP -.-> UPLOADS
    APP -.-> YOUTUBE
    POSTGRES -.-> CONFIG
    NGINX -.-> SSL_CERTS

    %% External connections
    APP --> PLEX_SERVER
    APP --> OVERSEERR_API
    APP --> UPTIME_KUMA
    APP --> YOUTUBE_API

    %% Styling
    classDef appService fill:#e3f2fd
    classDef dataService fill:#e8f5e8
    classDef proxyService fill:#fff3e0
    classDef volume fill:#f3e5f5
    classDef external fill:#ffebee

    class APP appService
    class POSTGRES,REDIS dataService
    class NGINX proxyService
    class PGDATA,REDISDATA,UPLOADS,YOUTUBE,CONFIG,SSL_CERTS volume
    class PLEX_SERVER,OVERSEERR_API,UPTIME_KUMA,YOUTUBE_API external
```

## Container Specifications

### Application Container (medianest-app)

```mermaid
graph LR
    subgraph "medianest-app Container"
        subgraph "Process Layer"
            FRONTEND[Next.js Frontend<br/>SSR Process]
            BACKEND[Express API<br/>Backend Process]
            WORKER[Background Workers<br/>Job Processing]
        end

        subgraph "Runtime Environment"
            NODEJS[Node.js Runtime]
            NPM[NPM Dependencies]
        end

        subgraph "File System"
            APPCODE[/app<br/>Application Code]
            YOUTUBE_VOL[/app/youtube<br/>Download Storage]
            UPLOADS_VOL[/app/uploads<br/>File Storage]
        end
    end

    FRONTEND --> NODEJS
    BACKEND --> NODEJS
    WORKER --> NODEJS
    NODEJS --> NPM

    FRONTEND --> APPCODE
    BACKEND --> APPCODE
    WORKER --> APPCODE

    WORKER --> YOUTUBE_VOL
    BACKEND --> UPLOADS_VOL
```

### Database Container (medianest-postgres)

```mermaid
graph LR
    subgraph "medianest-postgres Container"
        subgraph "Database Engine"
            PG15[PostgreSQL 15<br/>Alpine Linux]
            INITDB[Database Initialization<br/>Scripts]
        end

        subgraph "Storage"
            PGDATA_INT[/var/lib/postgresql/data<br/>Data Directory]
            INIT_SQL[/docker-entrypoint-initdb.d/<br/>Init Scripts]
        end

        subgraph "Configuration"
            ENV_VARS[Environment Variables<br/>DB Name, User, Password]
            HEALTH_CHECK[Health Check<br/>pg_isready]
        end
    end

    PG15 --> PGDATA_INT
    PG15 --> INIT_SQL
    INITDB --> INIT_SQL
    ENV_VARS --> PG15
    HEALTH_CHECK --> PG15
```

## Service Dependencies & Health Checks

```mermaid
graph TD
    subgraph "Service Startup Sequence"
        START([Docker Compose Up])

        subgraph "Phase 1: Data Services"
            POSTGRES_START[Start PostgreSQL]
            REDIS_START[Start Redis]
            POSTGRES_HEALTH{PostgreSQL Health Check}
            REDIS_HEALTH{Redis Health Check}
        end

        subgraph "Phase 2: Application Services"
            APP_START[Start MediaNest App]
            APP_READY[Application Ready]
        end

        subgraph "Phase 3: Proxy Services"
            NGINX_START[Start Nginx Proxy]
            SSL_SETUP[SSL Certificate Setup]
        end
    end

    START --> POSTGRES_START
    START --> REDIS_START

    POSTGRES_START --> POSTGRES_HEALTH
    REDIS_START --> REDIS_HEALTH

    POSTGRES_HEALTH -->|Healthy| APP_START
    REDIS_HEALTH -->|Healthy| APP_START

    APP_START --> APP_READY
    APP_READY --> NGINX_START
    NGINX_START --> SSL_SETUP

    POSTGRES_HEALTH -->|Unhealthy| POSTGRES_START
    REDIS_HEALTH -->|Unhealthy| REDIS_START
```

## Network Configuration

```mermaid
graph LR
    subgraph "Host Network Interface"
        HOST_ETH[eth0<br/>Host IP]
    end

    subgraph "Docker Bridge Network (medianest-network)"
        BRIDGE_GW[Gateway<br/>172.18.0.1]

        subgraph "Container Network Interfaces"
            APP_NET[medianest-app<br/>172.18.0.2]
            PG_NET[medianest-postgres<br/>172.18.0.3]
            REDIS_NET[medianest-redis<br/>172.18.0.4]
        end
    end

    subgraph "Port Mappings"
        HOST_3000[Host:3000] --> APP_NET
        HOST_4000[Host:4000] --> APP_NET
        HOST_5432[Host:5432] --> PG_NET
        HOST_6379[Host:6379] --> REDIS_NET
    end

    HOST_ETH --> BRIDGE_GW
    BRIDGE_GW --> APP_NET
    BRIDGE_GW --> PG_NET
    BRIDGE_GW --> REDIS_NET
```

## Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        subgraph "Network Security"
            FIREWALL[Host Firewall<br/>iptables/ufw]
            DOCKER_NET[Docker Network Isolation]
        end

        subgraph "Container Security"
            USER_MAPPING[User Mapping<br/>1000:1000]
            READ_ONLY[Read-Only Filesystems]
            SECRETS[Environment Secrets]
        end

        subgraph "Application Security"
            TLS[TLS Termination<br/>Nginx Proxy]
            AUTH[JWT Authentication]
            RATE_LIMIT[Rate Limiting]
        end

        subgraph "Data Security"
            DB_AUTH[Database Authentication]
            ENCRYPTION[Data Encryption at Rest]
            BACKUP_ENCRYPT[Encrypted Backups]
        end
    end

    FIREWALL --> DOCKER_NET
    DOCKER_NET --> USER_MAPPING
    USER_MAPPING --> READ_ONLY
    READ_ONLY --> SECRETS

    SECRETS --> TLS
    TLS --> AUTH
    AUTH --> RATE_LIMIT

    RATE_LIMIT --> DB_AUTH
    DB_AUTH --> ENCRYPTION
    ENCRYPTION --> BACKUP_ENCRYPT
```

## Deployment Modes

### Development Mode

```mermaid
graph LR
    subgraph "Development Deployment"
        DEV_COMPOSE[docker-compose.dev.yml]
        HOT_RELOAD[Hot Reload Enabled]
        DEBUG_PORTS[Debug Ports Exposed]
        DEV_VOLUMES[Source Code Volumes]
    end

    DEV_COMPOSE --> HOT_RELOAD
    DEV_COMPOSE --> DEBUG_PORTS
    DEV_COMPOSE --> DEV_VOLUMES
```

### Production Mode

```mermaid
graph LR
    subgraph "Production Deployment"
        PROD_COMPOSE[docker-compose.prod.yml]
        OPTIMIZED[Production Optimizations]
        SSL_ENABLED[SSL/TLS Enabled]
        MONITORING[Health Monitoring]
        BACKUP_JOBS[Automated Backups]
    end

    PROD_COMPOSE --> OPTIMIZED
    PROD_COMPOSE --> SSL_ENABLED
    PROD_COMPOSE --> MONITORING
    PROD_COMPOSE --> BACKUP_JOBS
```

## Resource Allocation

```mermaid
pie title Container Resource Allocation
    "MediaNest App" : 60
    "PostgreSQL" : 25
    "Redis" : 10
    "Nginx Proxy" : 5
```

This architecture ensures scalable, secure, and maintainable deployment of MediaNest using modern containerization best practices.
