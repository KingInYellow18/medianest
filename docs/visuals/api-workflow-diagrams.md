# MediaNest API Workflow Diagrams

## 🔌 API Architecture Overview

### API Gateway & Routing Structure

```mermaid
graph TB
    subgraph "Client Applications"
        WEB[Web Frontend<br/>Next.js]
        MOBILE[Mobile App<br/>React Native]
        CLI[CLI Client<br/>Node.js]
        THIRD[Third-party Apps<br/>External Integrations]
    end
    
    subgraph "API Gateway Layer"
        LB[Load Balancer<br/>Traefik/HAProxy]
        RATE[Rate Limiter<br/>Redis-based]
        AUTH[Authentication<br/>JWT Middleware]
        CORS[CORS Handler<br/>Origin Validation]
    end
    
    subgraph "API Routes & Handlers"
        subgraph "Core APIs"
            MEDIA_API[/api/media<br/>Media Management]
            USER_API[/api/users<br/>User Management]  
            AUTH_API[/api/auth<br/>Authentication]
            SEARCH_API[/api/search<br/>Search & Discovery]
        end
        
        subgraph "Integration APIs"
            PLEX_API[/api/integrations/plex<br/>Plex Media Server]
            OVERSEERR_API[/api/integrations/overseerr<br/>Request Management]
            WEBHOOK_API[/api/webhooks<br/>Event Callbacks]
        end
        
        subgraph "System APIs"
            HEALTH_API[/api/health<br/>Health Checks]
            METRICS_API[/api/metrics<br/>System Metrics]
            ADMIN_API[/api/admin<br/>Administration]
        end
    end
    
    subgraph "Business Logic Layer"
        MEDIA_SVC[Media Service]
        USER_SVC[User Service]
        INTEGRATION_SVC[Integration Service]
        NOTIFICATION_SVC[Notification Service]
    end
    
    subgraph "Data Access Layer"
        PG[(PostgreSQL<br/>Primary Data)]
        REDIS[(Redis<br/>Cache + Sessions)]
        S3[Object Storage<br/>Media Files]
    end
    
    %% Client connections
    WEB --> LB
    MOBILE --> LB
    CLI --> LB
    THIRD --> LB
    
    %% Gateway processing
    LB --> RATE
    RATE --> AUTH
    AUTH --> CORS
    
    %% Route distribution
    CORS --> MEDIA_API
    CORS --> USER_API
    CORS --> AUTH_API
    CORS --> SEARCH_API
    CORS --> PLEX_API
    CORS --> OVERSEERR_API
    CORS --> WEBHOOK_API
    CORS --> HEALTH_API
    CORS --> METRICS_API
    CORS --> ADMIN_API
    
    %% Service connections
    MEDIA_API --> MEDIA_SVC
    USER_API --> USER_SVC
    PLEX_API --> INTEGRATION_SVC
    OVERSEERR_API --> INTEGRATION_SVC
    WEBHOOK_API --> NOTIFICATION_SVC
    
    %% Data access
    MEDIA_SVC --> PG
    MEDIA_SVC --> REDIS
    MEDIA_SVC --> S3
    USER_SVC --> PG
    USER_SVC --> REDIS
    INTEGRATION_SVC --> REDIS
    
    %% Styling
    classDef client fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef gateway fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef api fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef service fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef data fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    
    class WEB,MOBILE,CLI,THIRD client
    class LB,RATE,AUTH,CORS gateway
    class MEDIA_API,USER_API,AUTH_API,SEARCH_API,PLEX_API,OVERSEERR_API,WEBHOOK_API,HEALTH_API,METRICS_API,ADMIN_API api
    class MEDIA_SVC,USER_SVC,INTEGRATION_SVC,NOTIFICATION_SVC service
    class PG,REDIS,S3 data
```

## 🔐 Authentication & Authorization Workflows

### JWT Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth API
    participant V as JWT Validator
    participant R as Redis Store
    participant D as Database
    
    Note over C,D: Login Process
    C->>A: POST /api/auth/login<br/>{email, password}
    A->>D: Validate credentials
    D-->>A: User profile + roles
    A->>A: Generate JWT token
    A->>R: Store refresh token
    A-->>C: {token, refreshToken, user}
    
    Note over C,D: Authenticated Request
    C->>V: GET /api/media<br/>Authorization: Bearer {token}
    V->>V: Verify JWT signature
    V->>R: Check token blacklist
    R-->>V: Token valid
    V->>V: Extract user claims
    V-->>C: Request authorized
    
    Note over C,D: Token Refresh
    C->>A: POST /api/auth/refresh<br/>{refreshToken}
    A->>R: Validate refresh token
    R-->>A: Token valid
    A->>A: Generate new JWT
    A-->>C: {token, refreshToken}
    
    Note over C,D: Logout
    C->>A: POST /api/auth/logout<br/>{refreshToken}
    A->>R: Blacklist tokens
    A-->>C: Logout successful
```

### Role-Based Access Control (RBAC)

```mermaid
graph TB
    subgraph "User Roles"
        GUEST[Guest User<br/>Limited Access]
        USER[Regular User<br/>Personal Media]
        ADMIN[Administrator<br/>Full System Access]
        SUPER[Super Admin<br/>System Management]
    end
    
    subgraph "Permission Matrix"
        subgraph "Media Permissions"
            READ_MEDIA[Read Media]
            UPLOAD_MEDIA[Upload Media]
            DELETE_MEDIA[Delete Media]
            ADMIN_MEDIA[Manage All Media]
        end
        
        subgraph "User Permissions"
            VIEW_PROFILE[View Profile]
            EDIT_PROFILE[Edit Profile]
            MANAGE_USERS[Manage Users]
            SYSTEM_SETTINGS[System Settings]
        end
        
        subgraph "Integration Permissions"
            VIEW_INTEGRATIONS[View Integrations]
            CONFIG_INTEGRATIONS[Configure Integrations]
            MANAGE_WEBHOOKS[Manage Webhooks]
        end
    end
    
    %% Permission assignments
    GUEST --> READ_MEDIA
    GUEST --> VIEW_PROFILE
    
    USER --> READ_MEDIA
    USER --> UPLOAD_MEDIA
    USER --> VIEW_PROFILE
    USER --> EDIT_PROFILE
    USER --> VIEW_INTEGRATIONS
    
    ADMIN --> READ_MEDIA
    ADMIN --> UPLOAD_MEDIA
    ADMIN --> DELETE_MEDIA
    ADMIN --> VIEW_PROFILE
    ADMIN --> EDIT_PROFILE
    ADMIN --> MANAGE_USERS
    ADMIN --> CONFIG_INTEGRATIONS
    ADMIN --> MANAGE_WEBHOOKS
    
    SUPER --> ADMIN_MEDIA
    SUPER --> MANAGE_USERS
    SUPER --> SYSTEM_SETTINGS
    SUPER --> CONFIG_INTEGRATIONS
    SUPER --> MANAGE_WEBHOOKS
    
    %% Styling
    classDef role fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef media fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef user fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef integration fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    
    class GUEST,USER,ADMIN,SUPER role
    class READ_MEDIA,UPLOAD_MEDIA,DELETE_MEDIA,ADMIN_MEDIA media
    class VIEW_PROFILE,EDIT_PROFILE,MANAGE_USERS,SYSTEM_SETTINGS user
    class VIEW_INTEGRATIONS,CONFIG_INTEGRATIONS,MANAGE_WEBHOOKS integration
```

## 📁 Media Management API Workflows

### File Upload Process

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API Gateway
    participant M as Media API
    participant V as File Validator
    participant S as S3 Storage
    participant Q as Queue System
    participant W as Media Worker
    participant D as Database
    participant N as Notification Service
    
    Note over C,N: File Upload Initiation
    C->>A: POST /api/media/upload/initiate<br/>{filename, size, type}
    A->>M: Validate request
    M->>V: Check file constraints
    V-->>M: Validation passed
    M->>S: Generate presigned URL
    S-->>M: Upload URL + fields
    M->>D: Create pending record
    M-->>C: {uploadUrl, uploadId, fields}
    
    Note over C,N: Direct Upload to S3
    C->>S: PUT /upload-path<br/>File binary data
    S-->>C: Upload complete
    C->>M: POST /api/media/upload/complete<br/>{uploadId}
    
    Note over C,N: Processing Pipeline
    M->>D: Update status to 'processing'
    M->>Q: Queue processing job
    Q->>W: Process media file
    W->>S: Download original file
    W->>W: Generate thumbnails
    W->>W: Extract metadata
    W->>W: Create video previews
    W->>S: Upload processed assets
    W->>D: Update media record
    W->>N: Send completion notification
    N-->>C: WebSocket: Processing complete
```

### Media Search & Discovery

```mermaid
graph TB
    subgraph "Search Request Flow"
        A[Client Search Query<br/>'Marvel movies 2023']
        B[API Gateway<br/>Rate Limiting + Auth]
        C[Search API Handler<br/>/api/search]
    end
    
    subgraph "Query Processing"
        D[Parse Query Parameters<br/>term, filters, pagination]
        E[Apply User Permissions<br/>Filter accessible content]
        F[Build Search Queries<br/>Multiple search strategies]
    end
    
    subgraph "Search Execution"
        G[Full-text Search<br/>PostgreSQL FTS]
        H[Metadata Search<br/>Tags, categories, TMDB]
        I[Similarity Search<br/>Vector embeddings]
        J[External Search<br/>Plex library search]
    end
    
    subgraph "Result Processing"
        K[Combine & Dedupe Results]
        L[Apply Relevance Scoring<br/>Boost recent uploads]
        M[Paginate Results<br/>25 items per page]
        N[Generate Thumbnail URLs<br/>Signed S3 URLs]
    end
    
    subgraph "Response & Caching"
        O[Cache Results<br/>Redis 5min TTL]
        P[Return JSON Response<br/>Standard API format]
    end
    
    A --> B --> C --> D --> E --> F
    F --> G
    F --> H
    F --> I
    F --> J
    G --> K
    H --> K
    I --> K
    J --> K
    K --> L --> M --> N --> O --> P
    
    %% Styling
    classDef request fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef processing fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef search fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef results fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef response fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    
    class A,B,C request
    class D,E,F processing
    class G,H,I,J search
    class K,L,M,N results
    class O,P response
```

## 🔗 Integration API Workflows

### Plex Integration Sync

```mermaid
stateDiagram-v2
    [*] --> CheckConnection: Scheduled sync (every 15min)
    
    CheckConnection --> AuthenticatePlex: Connection healthy
    CheckConnection --> [*]: Connection failed
    
    AuthenticatePlex --> GetLibraries: Authentication successful
    AuthenticatePlex --> [*]: Authentication failed
    
    state "Sync Libraries" as GetLibraries {
        [*] --> FetchSections
        FetchSections --> ProcessSection
        ProcessSection --> FetchSections: More sections
        ProcessSection --> SyncComplete: All sections processed
    }
    
    state "Process Section" as ProcessSection {
        [*] --> GetSectionItems
        GetSectionItems --> CompareWithDB
        CompareWithDB --> CreateNewItems: New items found
        CompareWithDB --> UpdateExistingItems: Updates found
        CompareWithDB --> MarkDeletedItems: Items missing
        CompareWithDB --> NextSection: No changes
        CreateNewItems --> NextSection
        UpdateExistingItems --> NextSection
        MarkDeletedItems --> NextSection
        NextSection --> [*]
    }
    
    GetLibraries --> GenerateReport: Sync completed
    GenerateReport --> SendNotifications: Report generated
    SendNotifications --> CacheResults: Notifications sent
    CacheResults --> [*]: Sync complete
```

### Webhook Event Processing

```mermaid
sequenceDiagram
    participant EXT as External Service<br/>(Plex/Overseerr)
    participant WH as Webhook API
    participant V as Event Validator
    participant P as Event Processor
    participant D as Database
    participant Q as Queue System
    participant N as Notification Service
    participant C as Connected Clients
    
    Note over EXT,C: Webhook Event Reception
    EXT->>WH: POST /api/webhooks/plex<br/>Event payload
    WH->>V: Validate webhook signature
    V->>V: Verify HMAC signature
    V-->>WH: Signature valid
    WH->>P: Process event
    
    Note over EXT,C: Event Processing
    P->>P: Parse event type<br/>(media.scrobble, library.new)
    P->>D: Update relevant records
    
    alt New Media Event
        P->>Q: Queue metadata enrichment
        P->>N: Generate notification
    else User Activity Event  
        P->>D: Update user statistics
        P->>N: Generate activity notification
    else System Event
        P->>D: Log system event
        P->>N: Generate admin notification
    end
    
    Note over EXT,C: Notification Distribution
    N->>C: WebSocket broadcast
    N->>N: Email notifications (if enabled)
    N->>D: Store notification history
    
    WH-->>EXT: 200 OK<br/>Event processed
```

## 📊 API Performance & Monitoring

### Request Lifecycle Monitoring

```mermaid
graph LR
    subgraph "Request Timeline"
        A[Request Start<br/>Timestamp: T0]
        B[Auth Check<br/>T0 + 5ms]
        C[Rate Limit<br/>T0 + 10ms] 
        D[Route Handler<br/>T0 + 15ms]
        E[Database Query<br/>T0 + 25ms]
        F[Response Sent<br/>T0 + 50ms]
    end
    
    subgraph "Metrics Collection"
        G[Response Time<br/>50ms total]
        H[Database Time<br/>15ms query]
        I[Cache Hit Ratio<br/>85% cache hits]
        J[Error Rate<br/>0.1% 5xx errors]
    end
    
    subgraph "Alerting Thresholds"
        K[Response > 200ms<br/>Warning Alert]
        L[Response > 500ms<br/>Critical Alert]
        M[Error Rate > 1%<br/>Critical Alert]
        N[Cache Hit < 70%<br/>Warning Alert]
    end
    
    A --> B --> C --> D --> E --> F
    F --> G --> K
    F --> G --> L
    E --> H
    D --> I --> N
    F --> J --> M
    
    %% Styling
    classDef timeline fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef metrics fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef alerts fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    
    class A,B,C,D,E,F timeline
    class G,H,I,J metrics
    class K,L,M,N alerts
```

### API Rate Limiting Strategy

```mermaid
graph TB
    subgraph "Rate Limiting Tiers"
        ANON[Anonymous Users<br/>10 req/min<br/>100 req/hour]
        AUTH[Authenticated Users<br/>100 req/min<br/>1000 req/hour]
        PREMIUM[Premium Users<br/>500 req/min<br/>10000 req/hour]
        ADMIN[Admin Users<br/>1000 req/min<br/>No hourly limit]
    end
    
    subgraph "Endpoint-Specific Limits"
        UPLOAD[Upload Endpoints<br/>5 req/min<br/>Large file handling]
        SEARCH[Search Endpoints<br/>30 req/min<br/>CPU intensive]
        MEDIA[Media Endpoints<br/>100 req/min<br/>Standard access]
        HEALTH[Health Endpoints<br/>No limit<br/>Monitoring access]
    end
    
    subgraph "Rate Limit Implementation"
        REDIS_STORE[Redis Counter<br/>Sliding window]
        HEADER_INFO[X-RateLimit Headers<br/>Remaining, Reset]
        BACKOFF[Exponential Backoff<br/>429 responses]
    end
    
    ANON --> UPLOAD
    AUTH --> SEARCH
    PREMIUM --> MEDIA
    ADMIN --> HEALTH
    
    UPLOAD --> REDIS_STORE
    SEARCH --> REDIS_STORE
    MEDIA --> REDIS_STORE
    
    REDIS_STORE --> HEADER_INFO
    REDIS_STORE --> BACKOFF
    
    %% Styling
    classDef tier fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef endpoint fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef implementation fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    
    class ANON,AUTH,PREMIUM,ADMIN tier
    class UPLOAD,SEARCH,MEDIA,HEALTH endpoint
    class REDIS_STORE,HEADER_INFO,BACKOFF implementation
```

## 🚨 Error Handling & Recovery

### API Error Response Flow

```mermaid
flowchart TD
    A[API Request] --> B{Request Validation}
    B -->|Invalid| C[400 Bad Request<br/>Validation errors]
    B -->|Valid| D{Authentication}
    D -->|Failed| E[401 Unauthorized<br/>Invalid/missing token]
    D -->|Success| F{Authorization}
    F -->|Forbidden| G[403 Forbidden<br/>Insufficient permissions]
    F -->|Authorized| H[Business Logic]
    H --> I{Database Operation}
    I -->|Connection Error| J[503 Service Unavailable<br/>Database down]
    I -->|Query Error| K[500 Internal Error<br/>Query failed]
    I -->|Success| L{Response Processing}
    L -->|Processing Error| M[500 Internal Error<br/>Response generation failed]
    L -->|Success| N[200 Success<br/>Valid response]
    
    %% Error logging and monitoring
    C --> O[Log Error<br/>Client-side issue]
    E --> P[Log Warning<br/>Authentication attempt]
    G --> Q[Log Warning<br/>Authorization failure]
    J --> R[Log Critical<br/>Service dependency down]
    K --> S[Log Error<br/>Database operation failed]
    M --> T[Log Error<br/>Response processing failed]
    
    %% Styling
    classDef success fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef clientError fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef serverError fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    classDef logging fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    
    class N success
    class C,E,G clientError
    class J,K,M serverError
    class O,P,Q,R,S,T logging
```

---

*These API workflow diagrams provide comprehensive insights into MediaNest's API architecture, ensuring efficient development, debugging, and integration processes.*