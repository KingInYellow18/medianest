# MediaNest Data Flow Architecture

## Overview

This document details the data flow patterns within MediaNest, showing how information moves through the system layers, from client requests to database operations and real-time notifications.

## Core Data Flow Patterns

### 1. Request Processing Pipeline

```mermaid
flowchart TD
    subgraph "Client Layer"
        CLIENT[Client Application]
        WEBSOCKET[WebSocket Client]
    end

    subgraph "Load Balancer"
        NGINX[Nginx Load Balancer]
    end

    subgraph "Application Server"
        subgraph "Middleware Stack"
            CORS[CORS Middleware]
            SECURITY[Security Headers]
            RATE_LIMIT[Rate Limiting]
            AUTH[Authentication]
            VALIDATION[Request Validation]
            CORRELATION[Correlation ID]
            PERFORMANCE[Performance Monitoring]
        end

        subgraph "Route Handler"
            ROUTER[Express Router]
            CONTROLLER[Controller Method]
        end

        subgraph "Business Logic"
            SERVICE[Service Layer]
            EXTERNAL[External APIs]
        end

        subgraph "Data Access"
            REPOSITORY[Repository Layer]
            CACHE[Redis Cache]
        end
    end

    subgraph "Data Layer"
        DATABASE[(PostgreSQL)]
    end

    subgraph "Real-time Layer"
        SOCKET_SERVER[Socket.IO Server]
        NOTIFICATION[Notification Service]
    end

    CLIENT -->|HTTP Request| NGINX
    WEBSOCKET -->|WebSocket| SOCKET_SERVER
    NGINX --> CORS
    CORS --> SECURITY
    SECURITY --> RATE_LIMIT
    RATE_LIMIT --> AUTH
    AUTH --> VALIDATION
    VALIDATION --> CORRELATION
    CORRELATION --> PERFORMANCE
    PERFORMANCE --> ROUTER
    ROUTER --> CONTROLLER
    CONTROLLER --> SERVICE
    SERVICE --> EXTERNAL
    SERVICE --> REPOSITORY
    SERVICE --> CACHE
    REPOSITORY --> DATABASE
    SERVICE --> NOTIFICATION
    NOTIFICATION --> SOCKET_SERVER
    SOCKET_SERVER --> CLIENT
    CONTROLLER -->|HTTP Response| CLIENT
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

### 5. YouTube Download Data Flow

```mermaid
flowchart TD
    subgraph "User Interface"
        YT_FORM[YouTube URL Form]
        PROGRESS[Download Progress]
        COMPLETE[Completion Status]
    end

    subgraph "API Processing"
        YT_API[YouTube API Endpoint]
        YT_SERVICE[YouTube Service]
        YT_VALIDATOR[URL Validation]
        QUEUE_SYSTEM[Job Queue System]
    end

    subgraph "Download Processing"
        WORKER[Background Worker]
        YT_DLP[yt-dlp Process]
        FILE_SYSTEM[File System]
        PLEX_COLLECTION[Plex Collection]
    end

    subgraph "Data Tracking"
        YT_TABLE[youtube_downloads table]
        PROGRESS_CACHE[Progress Cache]
        ERROR_LOG[Error Logging]
    end

    subgraph "Notification System"
        PROGRESS_NOTIF[Progress Notifications]
        COMPLETE_NOTIF[Completion Notifications]
        ERROR_NOTIF[Error Notifications]
    end

    YT_FORM --> YT_API
    YT_API --> YT_SERVICE
    YT_SERVICE --> YT_VALIDATOR
    YT_VALIDATOR --> YT_TABLE
    YT_TABLE --> QUEUE_SYSTEM
    QUEUE_SYSTEM --> WORKER
    WORKER --> YT_DLP
    YT_DLP --> FILE_SYSTEM
    FILE_SYSTEM --> PLEX_COLLECTION
    
    WORKER --> PROGRESS_CACHE
    PROGRESS_CACHE --> PROGRESS_NOTIF
    PROGRESS_NOTIF --> PROGRESS
    
    WORKER --> YT_TABLE
    YT_TABLE --> COMPLETE_NOTIF
    COMPLETE_NOTIF --> COMPLETE
    
    WORKER --> ERROR_LOG
    ERROR_LOG --> ERROR_NOTIF
    ERROR_NOTIF --> COMPLETE
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

## Caching Strategy Data Flow

### 1. Multi-level Caching

```mermaid
flowchart TD
    subgraph "Request Flow"
        CLIENT[Client Request]
        L1_CACHE[L1: HTTP Headers]
        L2_CACHE[L2: Application Cache]
        L3_CACHE[L3: Redis Cache]
        DATABASE[(Database)]
    end

    subgraph "Cache Hierarchy"
        BROWSER[Browser Cache]
        CDN[CDN Cache]
        NGINX_CACHE[Nginx Cache]
        REDIS_CACHE[Redis Cache]
        APP_CACHE[Application Cache]
    end

    CLIENT --> BROWSER
    BROWSER --> CDN
    CDN --> NGINX_CACHE
    NGINX_CACHE --> L1_CACHE
    L1_CACHE --> L2_CACHE
    L2_CACHE --> L3_CACHE
    L3_CACHE --> DATABASE

    REDIS_CACHE --> L3_CACHE
    APP_CACHE --> L2_CACHE
```

### 2. Cache Invalidation Patterns

```mermaid
sequenceDiagram
    participant S as Service
    participant RC as Redis Cache
    participant DB as Database
    participant NS as Notification Service

    Note over S,NS: Write-Through Pattern
    S->>DB: UPDATE data
    S->>RC: INVALIDATE cache key
    S->>NS: Notify cache invalidation

    Note over S,NS: Cache-Aside Pattern
    S->>RC: GET cached data
    alt Cache Miss
        S->>DB: SELECT data
        S->>RC: SET cache with TTL
    end

    Note over S,NS: Write-Behind Pattern
    S->>RC: SET data in cache
    S->>NS: Queue database write
    NS->>DB: Async UPDATE data
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