# Deployment and Infrastructure Diagrams

## Container Architecture

```mermaid
graph TB
    subgraph "Docker Host Environment"
        subgraph "Load Balancer Layer"
            NGINX[nginx:alpine<br/>Reverse Proxy & SSL]
        end

        subgraph "Application Layer"
            subgraph "Frontend Services"
                NEXT_PROD[medianest-frontend<br/>Next.js Production<br/>Port: 3000]
                NEXT_DEV[medianest-frontend-dev<br/>Next.js Development<br/>Port: 3001]
            end

            subgraph "Backend Services"
                BACKEND_PROD[medianest-backend<br/>Express.js Production<br/>Port: 8080]
                BACKEND_DEV[medianest-backend-dev<br/>Express.js Development<br/>Port: 8081]
                WEBSOCKET[Socket.IO Server<br/>Real-time Communication<br/>Port: 8082]
            end
        end

        subgraph "Data Layer"
            POSTGRES[postgres:15-alpine<br/>Primary Database<br/>Port: 5432]
            REDIS[redis:7-alpine<br/>Cache & Sessions<br/>Port: 6379]
            PGADMIN[pgadmin4<br/>Database Admin<br/>Port: 5050]
        end

        subgraph "Monitoring Stack"
            PROMETHEUS[prometheus<br/>Metrics Collection<br/>Port: 9090]
            GRAFANA[grafana<br/>Dashboards<br/>Port: 3001]
            JAEGER[jaegertracing/all-in-one<br/>Distributed Tracing<br/>Port: 16686]
        end

        subgraph "External Dependencies"
            PLEX[Plex Media Server<br/>External Host]
            OVERSEERR[Overseerr<br/>External Host]
            UPTIME_KUMA[Uptime Kuma<br/>External Host]
        end
    end

    subgraph "Volumes & Storage"
        POSTGRES_DATA[(postgres_data<br/>Database Storage)]
        REDIS_DATA[(redis_data<br/>Cache Storage)]
        MEDIA_STORAGE[(media_downloads<br/>Downloaded Content)]
        LOG_STORAGE[(app_logs<br/>Application Logs)]
        GRAFANA_DATA[(grafana_data<br/>Dashboard Config)]
        PROMETHEUS_DATA[(prometheus_data<br/>Metrics Storage)]
    end

    %% Network Connections
    NGINX --> NEXT_PROD
    NGINX --> NEXT_DEV
    NGINX --> BACKEND_PROD
    NGINX --> BACKEND_DEV
    NGINX --> WEBSOCKET
    NGINX --> GRAFANA

    BACKEND_PROD --> POSTGRES
    BACKEND_DEV --> POSTGRES
    BACKEND_PROD --> REDIS
    BACKEND_DEV --> REDIS

    BACKEND_PROD --> PLEX
    BACKEND_PROD --> OVERSEERR
    BACKEND_PROD --> UPTIME_KUMA

    PROMETHEUS --> BACKEND_PROD
    PROMETHEUS --> POSTGRES
    PROMETHEUS --> REDIS
    GRAFANA --> PROMETHEUS

    BACKEND_PROD --> JAEGER
    WEBSOCKET --> JAEGER

    %% Volume Mounts
    POSTGRES -.-> POSTGRES_DATA
    REDIS -.-> REDIS_DATA
    BACKEND_PROD -.-> MEDIA_STORAGE
    BACKEND_PROD -.-> LOG_STORAGE
    GRAFANA -.-> GRAFANA_DATA
    PROMETHEUS -.-> PROMETHEUS_DATA

    classDef proxy fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef frontend fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef backend fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef database fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef monitoring fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef external fill:#e0f2f1,stroke:#00695c,stroke-width:2px
    classDef storage fill:#f1f8e9,stroke:#558b2f,stroke-width:2px

    class NGINX proxy
    class NEXT_PROD,NEXT_DEV frontend
    class BACKEND_PROD,BACKEND_DEV,WEBSOCKET backend
    class POSTGRES,REDIS,PGADMIN database
    class PROMETHEUS,GRAFANA,JAEGER monitoring
    class PLEX,OVERSEERR,UPTIME_KUMA external
    class POSTGRES_DATA,REDIS_DATA,MEDIA_STORAGE,LOG_STORAGE,GRAFANA_DATA,PROMETHEUS_DATA storage
```

## Multi-Environment Deployment

```mermaid
graph TB
    subgraph "Development Environment"
        DEV_LB[Nginx Dev<br/>:80, :443]
        DEV_FRONT[Next.js Dev<br/>:3001<br/>Hot Reload]
        DEV_BACK[Express Dev<br/>:8081<br/>Nodemon]
        DEV_DB[(PostgreSQL Dev<br/>:5432)]
        DEV_CACHE[(Redis Dev<br/>:6379)]

        DEV_LB --> DEV_FRONT
        DEV_LB --> DEV_BACK
        DEV_BACK --> DEV_DB
        DEV_BACK --> DEV_CACHE
    end

    subgraph "Staging Environment"
        STAGE_LB[Nginx Staging<br/>:80, :443]
        STAGE_FRONT[Next.js Staging<br/>:3000<br/>Production Build]
        STAGE_BACK[Express Staging<br/>:8080<br/>PM2 Cluster]
        STAGE_DB[(PostgreSQL Staging<br/>:5432)]
        STAGE_CACHE[(Redis Staging<br/>:6379)]
        STAGE_MONITOR[Monitoring Stack<br/>Prometheus + Grafana]

        STAGE_LB --> STAGE_FRONT
        STAGE_LB --> STAGE_BACK
        STAGE_BACK --> STAGE_DB
        STAGE_BACK --> STAGE_CACHE
        STAGE_BACK --> STAGE_MONITOR
    end

    subgraph "Production Environment"
        PROD_LB[Nginx Production<br/>:80, :443<br/>SSL + Rate Limiting]

        subgraph "Application Cluster"
            PROD_FRONT1[Next.js Instance 1<br/>:3000]
            PROD_FRONT2[Next.js Instance 2<br/>:3000]
            PROD_BACK1[Express Instance 1<br/>:8080]
            PROD_BACK2[Express Instance 2<br/>:8080]
            PROD_WS[Socket.IO Cluster<br/>:8082<br/>Redis Adapter]
        end

        subgraph "Data Cluster"
            PROD_DB_PRIMARY[(PostgreSQL Primary<br/>:5432<br/>Read/Write)]
            PROD_DB_REPLICA[(PostgreSQL Replica<br/>:5433<br/>Read Only)]
            PROD_CACHE_CLUSTER[(Redis Cluster<br/>:6379-6384<br/>3 Master + 3 Slave)]
        end

        subgraph "Monitoring & Observability"
            PROD_PROMETHEUS[Prometheus<br/>:9090<br/>HA Mode]
            PROD_GRAFANA[Grafana<br/>:3001<br/>HA Mode]
            PROD_JAEGER[Jaeger<br/>:16686<br/>Elasticsearch Backend]
            PROD_SENTRY[Sentry<br/>Error Tracking]
        end

        PROD_LB --> PROD_FRONT1
        PROD_LB --> PROD_FRONT2
        PROD_LB --> PROD_BACK1
        PROD_LB --> PROD_BACK2
        PROD_LB --> PROD_WS

        PROD_BACK1 --> PROD_DB_PRIMARY
        PROD_BACK2 --> PROD_DB_PRIMARY
        PROD_BACK1 --> PROD_DB_REPLICA
        PROD_BACK2 --> PROD_DB_REPLICA

        PROD_BACK1 --> PROD_CACHE_CLUSTER
        PROD_BACK2 --> PROD_CACHE_CLUSTER
        PROD_WS --> PROD_CACHE_CLUSTER

        PROD_DB_PRIMARY --> PROD_DB_REPLICA
    end

    subgraph "CI/CD Pipeline"
        GIT[Git Repository<br/>GitHub/GitLab]
        CI[CI/CD System<br/>GitHub Actions]
        REGISTRY[Container Registry<br/>Docker Hub/ECR]

        GIT --> CI
        CI --> REGISTRY
        CI --> DEV_BACK
        CI --> STAGE_BACK
        CI --> PROD_BACK1
        CI --> PROD_BACK2
    end

    classDef dev fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
    classDef staging fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef prod fill:#ffebee,stroke:#f44336,stroke-width:2px
    classDef cicd fill:#e3f2fd,stroke:#2196f3,stroke-width:2px

    class DEV_LB,DEV_FRONT,DEV_BACK,DEV_DB,DEV_CACHE dev
    class STAGE_LB,STAGE_FRONT,STAGE_BACK,STAGE_DB,STAGE_CACHE,STAGE_MONITOR staging
    class PROD_LB,PROD_FRONT1,PROD_FRONT2,PROD_BACK1,PROD_BACK2,PROD_WS,PROD_DB_PRIMARY,PROD_DB_REPLICA,PROD_CACHE_CLUSTER,PROD_PROMETHEUS,PROD_GRAFANA,PROD_JAEGER,PROD_SENTRY prod
    class GIT,CI,REGISTRY cicd
```

## Network Architecture

```mermaid
graph TB
    subgraph "Internet"
        USERS[End Users]
        CDN[CloudFlare CDN<br/>Static Assets]
        DNS[DNS Provider<br/>Route 53/CloudFlare]
    end

    subgraph "DMZ (Public Subnet)"
        WAF[Web Application Firewall<br/>CloudFlare/AWS WAF]
        LB[Load Balancer<br/>ALB/Nginx]
        SSL[SSL Termination<br/>Let's Encrypt/ACM]
    end

    subgraph "Private Network (VPC/Docker Network)"
        subgraph "Application Subnet (172.20.0.0/24)"
            FRONTEND[Frontend Services<br/>172.20.0.10-19]
            BACKEND[Backend Services<br/>172.20.0.20-29]
            WEBSOCKET[WebSocket Services<br/>172.20.0.30-39]
        end

        subgraph "Data Subnet (172.20.1.0/24)"
            DATABASE[PostgreSQL Cluster<br/>172.20.1.10-19]
            CACHE[Redis Cluster<br/>172.20.1.20-29]
            BACKUP[Backup Storage<br/>172.20.1.50-59]
        end

        subgraph "Monitoring Subnet (172.20.2.0/24)"
            METRICS[Prometheus<br/>172.20.2.10]
            DASHBOARD[Grafana<br/>172.20.2.20]
            TRACING[Jaeger<br/>172.20.2.30]
            LOGGING[ELK Stack<br/>172.20.2.40-49]
        end

        subgraph "External Integration Subnet (172.20.3.0/24)"
            PLEX_PROXY[Plex Proxy<br/>172.20.3.10]
            OVERSEERR_PROXY[Overseerr Proxy<br/>172.20.3.20]
            API_GATEWAY[External API Gateway<br/>172.20.3.30]
        end
    end

    subgraph "External Services"
        PLEX_EXT[Plex Media Server<br/>External Network]
        OVERSEERR_EXT[Overseerr<br/>External Network]
        TMDB_API[TMDB API<br/>api.themoviedb.org]
        YOUTUBE_API[YouTube API<br/>googleapis.com]
    end

    %% Internet to DMZ
    USERS --> CDN
    USERS --> DNS
    DNS --> WAF
    CDN --> WAF

    %% DMZ to Private
    WAF --> LB
    LB --> SSL
    SSL --> FRONTEND
    SSL --> BACKEND
    SSL --> WEBSOCKET

    %% Internal Application Communication
    FRONTEND --> BACKEND
    BACKEND --> DATABASE
    BACKEND --> CACHE
    WEBSOCKET --> CACHE

    %% Monitoring Connections
    BACKEND --> METRICS
    DATABASE --> METRICS
    CACHE --> METRICS
    METRICS --> DASHBOARD
    BACKEND --> TRACING
    BACKEND --> LOGGING

    %% External Integrations
    BACKEND --> PLEX_PROXY
    BACKEND --> OVERSEERR_PROXY
    BACKEND --> API_GATEWAY

    PLEX_PROXY --> PLEX_EXT
    OVERSEERR_PROXY --> OVERSEERR_EXT
    API_GATEWAY --> TMDB_API
    API_GATEWAY --> YOUTUBE_API

    %% Backup Operations
    DATABASE --> BACKUP

    classDef internet fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef dmz fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef application fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef data fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef monitoring fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef external fill:#e0f2f1,stroke:#00695c,stroke-width:2px

    class USERS,CDN,DNS internet
    class WAF,LB,SSL dmz
    class FRONTEND,BACKEND,WEBSOCKET,PLEX_PROXY,OVERSEERR_PROXY,API_GATEWAY application
    class DATABASE,CACHE,BACKUP data
    class METRICS,DASHBOARD,TRACING,LOGGING monitoring
    class PLEX_EXT,OVERSEERR_EXT,TMDB_API,YOUTUBE_API external
```

## Security Architecture

```mermaid
graph TB
    subgraph "Defense in Depth Layers"
        subgraph "Perimeter Security"
            FIREWALL[Network Firewall<br/>iptables/ufw]
            WAF[Web Application Firewall<br/>ModSecurity/CloudFlare]
            DDOS[DDoS Protection<br/>CloudFlare/AWS Shield]
            RATE_LIMIT[Rate Limiting<br/>nginx/express-rate-limit]
        end

        subgraph "Application Security"
            AUTH[Authentication Layer<br/>JWT + OAuth]
            AUTHZ[Authorization Layer<br/>RBAC + ABAC]
            INPUT_VAL[Input Validation<br/>Zod Schemas]
            CSRF[CSRF Protection<br/>Double Submit Cookie]
            XSS[XSS Protection<br/>Content Security Policy]
            CORS[CORS Configuration<br/>Origin Validation]
        end

        subgraph "Data Security"
            ENCRYPTION[Encryption at Rest<br/>AES-256]
            TLS[Encryption in Transit<br/>TLS 1.3]
            SECRET_MGMT[Secret Management<br/>Vault/AWS Secrets]
            DB_SECURITY[Database Security<br/>SSL + Row Level Security]
            KEY_ROTATION[Key Rotation<br/>Automated Rotation]
        end

        subgraph "Infrastructure Security"
            CONTAINER_SEC[Container Security<br/>Distroless Images]
            NETWORK_SEG[Network Segmentation<br/>Docker Networks]
            LEAST_PRIVILEGE[Least Privilege<br/>Non-root Containers]
            SECURITY_SCAN[Security Scanning<br/>Snyk/Trivy]
            COMPLIANCE[Compliance<br/>CIS Benchmarks]
        end

        subgraph "Monitoring & Response"
            SIEM[Security Monitoring<br/>ELK + SIEM]
            INTRUSION[Intrusion Detection<br/>Fail2ban]
            AUDIT_LOG[Audit Logging<br/>Structured Logs]
            INCIDENT[Incident Response<br/>Automated Alerts]
            FORENSICS[Digital Forensics<br/>Log Retention]
        end
    end

    subgraph "Security Controls Flow"
        USER[External User] --> FIREWALL
        FIREWALL --> WAF
        WAF --> DDOS
        DDOS --> RATE_LIMIT
        RATE_LIMIT --> AUTH
        AUTH --> AUTHZ
        AUTHZ --> INPUT_VAL
        INPUT_VAL --> CSRF
        CSRF --> XSS
        XSS --> CORS
        CORS --> APPLICATION[Application Logic]

        APPLICATION --> ENCRYPTION
        APPLICATION --> TLS
        APPLICATION --> SECRET_MGMT
        APPLICATION --> DB_SECURITY

        SECRET_MGMT --> KEY_ROTATION

        APPLICATION --> CONTAINER_SEC
        CONTAINER_SEC --> NETWORK_SEG
        NETWORK_SEG --> LEAST_PRIVILEGE
        LEAST_PRIVILEGE --> SECURITY_SCAN
        SECURITY_SCAN --> COMPLIANCE

        APPLICATION --> SIEM
        SIEM --> INTRUSION
        INTRUSION --> AUDIT_LOG
        AUDIT_LOG --> INCIDENT
        INCIDENT --> FORENSICS
    end

    classDef perimeter fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    classDef application fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef data fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef infrastructure fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef monitoring fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px

    class FIREWALL,WAF,DDOS,RATE_LIMIT perimeter
    class AUTH,AUTHZ,INPUT_VAL,CSRF,XSS,CORS application
    class ENCRYPTION,TLS,SECRET_MGMT,DB_SECURITY,KEY_ROTATION data
    class CONTAINER_SEC,NETWORK_SEG,LEAST_PRIVILEGE,SECURITY_SCAN,COMPLIANCE infrastructure
    class SIEM,INTRUSION,AUDIT_LOG,INCIDENT,FORENSICS monitoring
```

## Scalability Architecture

```mermaid
graph TB
    subgraph "Load Balancing Tier"
        GLOBAL_LB[Global Load Balancer<br/>CloudFlare/Route 53]
        REGIONAL_LB[Regional Load Balancer<br/>ALB/NLB]
        APP_LB[Application Load Balancer<br/>Nginx/HAProxy]
    end

    subgraph "Auto-Scaling Groups"
        subgraph "Frontend Scaling"
            FRONTEND_ASG[Frontend Auto Scaling Group]
            FRONTEND_1[Frontend Instance 1]
            FRONTEND_2[Frontend Instance 2]
            FRONTEND_N[Frontend Instance N]

            FRONTEND_ASG --> FRONTEND_1
            FRONTEND_ASG --> FRONTEND_2
            FRONTEND_ASG --> FRONTEND_N
        end

        subgraph "Backend Scaling"
            BACKEND_ASG[Backend Auto Scaling Group]
            BACKEND_1[Backend Instance 1]
            BACKEND_2[Backend Instance 2]
            BACKEND_N[Backend Instance N]

            BACKEND_ASG --> BACKEND_1
            BACKEND_ASG --> BACKEND_2
            BACKEND_ASG --> BACKEND_N
        end

        subgraph "Worker Scaling"
            WORKER_ASG[Worker Auto Scaling Group]
            WORKER_1[Download Worker 1]
            WORKER_2[Download Worker 2]
            WORKER_N[Download Worker N]

            WORKER_ASG --> WORKER_1
            WORKER_ASG --> WORKER_2
            WORKER_ASG --> WORKER_N
        end
    end

    subgraph "Data Tier Scaling"
        subgraph "Database Scaling"
            DB_CLUSTER[PostgreSQL Cluster]
            DB_PRIMARY[Primary (Write)]
            DB_REPLICA_1[Read Replica 1]
            DB_REPLICA_2[Read Replica 2]
            DB_REPLICA_N[Read Replica N]

            DB_CLUSTER --> DB_PRIMARY
            DB_CLUSTER --> DB_REPLICA_1
            DB_CLUSTER --> DB_REPLICA_2
            DB_CLUSTER --> DB_REPLICA_N
        end

        subgraph "Cache Scaling"
            REDIS_CLUSTER[Redis Cluster]
            REDIS_SHARD_1[Redis Shard 1<br/>Master + Slave]
            REDIS_SHARD_2[Redis Shard 2<br/>Master + Slave]
            REDIS_SHARD_N[Redis Shard N<br/>Master + Slave]

            REDIS_CLUSTER --> REDIS_SHARD_1
            REDIS_CLUSTER --> REDIS_SHARD_2
            REDIS_CLUSTER --> REDIS_SHARD_N
        end
    end

    subgraph "Message Queue Scaling"
        QUEUE_CLUSTER[Queue Cluster<br/>Redis/RabbitMQ]
        QUEUE_1[Queue Instance 1]
        QUEUE_2[Queue Instance 2]
        QUEUE_N[Queue Instance N]

        QUEUE_CLUSTER --> QUEUE_1
        QUEUE_CLUSTER --> QUEUE_2
        QUEUE_CLUSTER --> QUEUE_N
    end

    subgraph "Monitoring Scaling"
        METRICS_CLUSTER[Metrics Cluster]
        PROMETHEUS_1[Prometheus 1]
        PROMETHEUS_2[Prometheus 2]
        GRAFANA_HA[Grafana HA]

        METRICS_CLUSTER --> PROMETHEUS_1
        METRICS_CLUSTER --> PROMETHEUS_2
        METRICS_CLUSTER --> GRAFANA_HA
    end

    %% Traffic Flow
    GLOBAL_LB --> REGIONAL_LB
    REGIONAL_LB --> APP_LB

    APP_LB --> FRONTEND_ASG
    APP_LB --> BACKEND_ASG

    BACKEND_ASG --> DB_CLUSTER
    BACKEND_ASG --> REDIS_CLUSTER
    BACKEND_ASG --> QUEUE_CLUSTER

    WORKER_ASG --> QUEUE_CLUSTER
    WORKER_ASG --> DB_CLUSTER

    %% Monitoring Connections
    FRONTEND_ASG --> METRICS_CLUSTER
    BACKEND_ASG --> METRICS_CLUSTER
    WORKER_ASG --> METRICS_CLUSTER
    DB_CLUSTER --> METRICS_CLUSTER

    %% Auto-scaling Triggers
    METRICS_CLUSTER -.-> FRONTEND_ASG
    METRICS_CLUSTER -.-> BACKEND_ASG
    METRICS_CLUSTER -.-> WORKER_ASG

    classDef loadbalancer fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef frontend fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef backend fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef data fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef queue fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef monitoring fill:#e0f2f1,stroke:#00695c,stroke-width:2px

    class GLOBAL_LB,REGIONAL_LB,APP_LB loadbalancer
    class FRONTEND_ASG,FRONTEND_1,FRONTEND_2,FRONTEND_N frontend
    class BACKEND_ASG,BACKEND_1,BACKEND_2,BACKEND_N,WORKER_ASG,WORKER_1,WORKER_2,WORKER_N backend
    class DB_CLUSTER,DB_PRIMARY,DB_REPLICA_1,DB_REPLICA_2,DB_REPLICA_N,REDIS_CLUSTER,REDIS_SHARD_1,REDIS_SHARD_2,REDIS_SHARD_N data
    class QUEUE_CLUSTER,QUEUE_1,QUEUE_2,QUEUE_N queue
    class METRICS_CLUSTER,PROMETHEUS_1,PROMETHEUS_2,GRAFANA_HA monitoring
```
