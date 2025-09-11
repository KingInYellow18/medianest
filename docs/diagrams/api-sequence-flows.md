# API Sequence Diagrams

## Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Express API
    participant Auth as Auth Service
    participant JWT as JWT Service
    participant DB as PostgreSQL
    participant Redis as Redis Cache
    participant Plex as Plex Server

    Note over C,Plex: User Authentication Process
    
    C->>API: POST /api/v1/auth/login
    API->>Auth: validateCredentials()
    Auth->>DB: findUser(email)
    DB-->>Auth: User data
    
    alt Plex OAuth Login
        Auth->>Plex: validateToken(plexToken)
        Plex-->>Auth: User profile
        Auth->>DB: updateOrCreateUser()
    else Manual Login
        Auth->>Auth: verifyPassword(hash)
    end
    
    Auth->>JWT: generateTokens()
    JWT-->>Auth: { accessToken, refreshToken }
    
    Auth->>Redis: storeSession(userId, tokens)
    Auth->>DB: logLoginActivity()
    
    Auth-->>API: Authentication result
    API-->>C: 200 OK + Set-Cookie + JWT

    Note over C,Plex: Protected Request Flow
    
    C->>API: GET /api/v1/dashboard (with JWT)
    API->>Auth: verifyToken(jwt)
    Auth->>Redis: checkTokenBlacklist()
    Redis-->>Auth: Token valid
    Auth->>JWT: validateToken()
    JWT-->>Auth: Decoded payload
    Auth->>DB: getUserPermissions()
    DB-->>Auth: User permissions
    Auth-->>API: Authorized user context
    API->>API: Execute request
    API-->>C: Protected resource data
```

## Media Request API Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Media API
    participant Validator as Input Validator
    participant MediaSvc as Media Service
    participant DB as PostgreSQL
    participant TMDB as TMDB API
    participant Overseerr as Overseerr
    participant Notify as Notification Service
    participant WS as WebSocket

    C->>API: POST /api/v1/media/request
    Note over C,API: Request: { title, mediaType, tmdbId }
    
    API->>Validator: validateRequestSchema()
    Validator-->>API: Validation result
    
    alt Validation Failed
        API-->>C: 400 Bad Request
    else Validation Passed
        API->>MediaSvc: createMediaRequest()
        
        MediaSvc->>TMDB: getMediaDetails(tmdbId)
        TMDB-->>MediaSvc: Media metadata
        
        MediaSvc->>DB: checkExistingRequest()
        DB-->>MediaSvc: Request status
        
        alt Already Requested
            MediaSvc-->>API: Duplicate request error
            API-->>C: 409 Conflict
        else New Request
            MediaSvc->>DB: saveMediaRequest()
            DB-->>MediaSvc: Request ID
            
            MediaSvc->>Overseerr: createRequest(mediaData)
            Overseerr-->>MediaSvc: Overseerr request ID
            
            MediaSvc->>DB: updateOverseerrId()
            
            MediaSvc->>Notify: sendNotification(adminUsers)
            Notify->>WS: emit('newRequest', requestData)
            
            MediaSvc-->>API: Request created
            API-->>C: 201 Created + Request details
        end
    end
```

## YouTube Download API Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as YouTube API
    participant Validator as URL Validator
    participant YTSvc as YouTube Service
    participant Queue as Job Queue
    participant Worker as Download Worker
    participant DB as PostgreSQL
    participant Plex as Plex Server
    participant WS as WebSocket
    participant FS as File System

    C->>API: POST /api/v1/youtube/download
    Note over C,API: Request: { url, quality, addToPlex }
    
    API->>Validator: validateYouTubeUrl()
    Validator-->>API: URL validation result
    
    alt Invalid URL
        API-->>C: 400 Bad Request
    else Valid URL
        API->>YTSvc: analyzeVideo(url)
        YTSvc->>YTSvc: extractVideoInfo()
        YTSvc-->>API: Video metadata
        
        API->>DB: createDownloadRecord()
        DB-->>API: Download ID
        
        API->>Queue: addDownloadJob(downloadId)
        Queue-->>API: Job queued
        
        API-->>C: 202 Accepted + Download ID
        
        Note over Queue,FS: Background Processing
        
        Queue->>Worker: Process download job
        Worker->>DB: updateStatus('downloading')
        Worker->>WS: emit('downloadProgress', { downloadId, status })
        
        Worker->>Worker: downloadVideo()
        Worker->>WS: emit('downloadProgress', { downloadId, progress })
        
        Worker->>FS: saveVideoFile()
        FS-->>Worker: File path
        
        alt Add to Plex
            Worker->>Plex: createCollection()
            Plex-->>Worker: Collection ID
            Worker->>Plex: addToLibrary(filePath)
            Worker->>Plex: triggerScan()
        end
        
        Worker->>DB: updateStatus('completed')
        Worker->>WS: emit('downloadComplete', downloadData)
    end
```

## Admin Dashboard API Flow

```mermaid
sequenceDiagram
    participant Admin as Admin Client
    participant API as Admin API
    participant Auth as Auth Middleware
    participant AdminSvc as Admin Service
    participant DB as PostgreSQL
    participant Cache as Redis Cache
    participant Monitor as System Monitor
    participant External as External Services

    Admin->>API: GET /api/v1/admin/dashboard
    API->>Auth: checkAdminRole()
    Auth-->>API: Admin authorized
    
    API->>AdminSvc: getDashboardData()
    
    par Concurrent Data Fetching
        AdminSvc->>DB: getUserStatistics()
        and AdminSvc->>DB: getMediaRequestStats()
        and AdminSvc->>Cache: getSystemMetrics()
        and AdminSvc->>Monitor: getServiceHealth()
    end
    
    DB-->>AdminSvc: User stats
    DB-->>AdminSvc: Request stats
    Cache-->>AdminSvc: Cached metrics
    Monitor-->>AdminSvc: Health status
    
    AdminSvc->>AdminSvc: aggregateData()
    AdminSvc-->>API: Dashboard data
    API-->>Admin: 200 OK + Dashboard JSON

    Note over Admin,External: Service Management Flow
    
    Admin->>API: PUT /api/v1/admin/services/plex
    Note over Admin,API: Update service config
    
    API->>Auth: checkAdminRole()
    API->>AdminSvc: updateServiceConfig()
    
    AdminSvc->>DB: saveServiceConfig()
    AdminSvc->>Cache: invalidateServiceCache()
    AdminSvc->>External: testConnection()
    
    alt Connection Successful
        External-->>AdminSvc: Health check OK
        AdminSvc->>DB: updateServiceStatus('healthy')
        AdminSvc-->>API: Config updated
        API-->>Admin: 200 OK
    else Connection Failed
        External-->>AdminSvc: Connection error
        AdminSvc->>DB: updateServiceStatus('unhealthy')
        AdminSvc-->>API: Config error
        API-->>Admin: 500 Service Error
    end
```

## Error Handling Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Express API
    participant MW as Error Middleware
    participant Logger as Winston Logger
    participant DB as PostgreSQL
    participant Sentry as Error Tracking
    participant Monitor as Alert System

    C->>API: Any API Request
    API->>API: Process request
    
    alt Request Succeeds
        API-->>C: Success response
    else Error Occurs
        API->>MW: Error thrown/passed
        
        MW->>Logger: logError(error, context)
        Logger->>Logger: structuredLog()
        
        MW->>DB: saveErrorLog(correlationId)
        
        alt Critical Error
            MW->>Sentry: captureException()
            MW->>Monitor: triggerAlert()
        end
        
        MW->>MW: sanitizeErrorResponse()
        MW-->>C: Error response (safe)
    end

    Note over MW,Monitor: Error Response Examples
    Note over MW: 400: Validation errors
    Note over MW: 401: Authentication errors  
    Note over MW: 403: Authorization errors
    Note over MW: 404: Resource not found
    Note over MW: 429: Rate limit exceeded
    Note over MW: 500: Internal server errors
```

## Rate Limiting Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Express API
    participant RateLimit as Rate Limiter
    participant Redis as Redis Cache
    participant DB as PostgreSQL

    C->>API: API Request
    API->>RateLimit: checkRateLimit()
    
    RateLimit->>Redis: getRateLimitData(userId, endpoint)
    Redis-->>RateLimit: Current request count
    
    RateLimit->>RateLimit: calculateRateLimit()
    
    alt Under Rate Limit
        RateLimit->>Redis: incrementRequestCount()
        RateLimit-->>API: Allow request
        API->>API: Process request normally
        API-->>C: Normal response
    else Rate Limit Exceeded
        RateLimit->>DB: logRateLimitViolation()
        RateLimit-->>API: Rate limit exceeded
        API-->>C: 429 Too Many Requests
        Note over C: Headers: X-Rate-Limit-Remaining: 0
        Note over C: Headers: Retry-After: 60
    end
    
    Note over RateLimit,Redis: Rate Limit Windows
    Note over RateLimit: General API: 100 req/hour
    Note over RateLimit: Auth endpoints: 10 req/hour
    Note over RateLimit: Download endpoints: 5 req/hour
    Note over RateLimit: Admin endpoints: 200 req/hour
```

## WebSocket Real-time Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant WS as Socket.IO Server
    participant Auth as Socket Auth
    participant Room as Room Manager
    participant Event as Event Handler
    participant DB as PostgreSQL

    C->>WS: Connect with JWT
    WS->>Auth: authenticateSocket(token)
    Auth-->>WS: User context
    
    WS->>Room: joinUserRoom(userId)
    Room-->>WS: Room joined
    
    WS-->>C: Connection established
    
    Note over C,DB: Real-time Events
    
    Event->>DB: Media request status change
    DB-->>Event: Updated record
    
    Event->>WS: emit('mediaRequestUpdate', data)
    WS->>Room: broadcastToUser(userId, event)
    Room->>C: Event delivered
    
    par Other Real-time Events
        Event->>WS: emit('downloadProgress')
        and Event->>WS: emit('serviceStatus')
        and Event->>WS: emit('systemAlert')
        and Event->>WS: emit('newNotification')
    end
    
    WS->>Room: broadcastToRooms()
    Room->>C: Multiple events delivered
    
    C->>WS: disconnect
    WS->>Room: leaveAllRooms(socketId)
    WS->>WS: cleanup(socketId)
```