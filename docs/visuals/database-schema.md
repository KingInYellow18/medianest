# Database Schema Visualization

This document provides comprehensive visual documentation of the MediaNest database schema, including entity relationships, data flows, and indexing strategies.

## Entity Relationship Diagram

Complete database schema showing all entities and their relationships:

```mermaid
erDiagram
    User ||--o{ MediaRequest : creates
    User ||--o{ YoutubeDownload : initiates
    User ||--o{ RateLimit : has
    User ||--o{ SessionToken : owns
    User ||--o{ Account : links
    User ||--o{ Session : maintains
    User ||--o{ ErrorLog : generates
    User ||--o{ ServiceConfig : updates
    User ||--o{ Notification : receives
    
    User {
        uuid id PK
        string plexId UK
        string plexUsername
        string email UK
        string name
        string role
        string plexToken
        string image
        boolean requiresPasswordChange
        datetime createdAt
        datetime lastLoginAt
        string status
    }
    
    MediaRequest {
        uuid id PK
        uuid userId FK
        string title
        string mediaType
        string tmdbId
        string status
        string overseerrId
        datetime createdAt
        datetime completedAt
    }
    
    YoutubeDownload {
        uuid id PK
        uuid userId FK
        string playlistUrl
        string playlistTitle
        string status
        json filePaths
        string plexCollectionId
        datetime createdAt
        datetime completedAt
    }
    
    ServiceStatus {
        int id PK
        string serviceName UK
        string status
        int responseTimeMs
        datetime lastCheckAt
        decimal uptimePercentage
    }
    
    RateLimit {
        int id PK
        uuid userId FK
        string endpoint
        int requestCount
        datetime windowStart
    }
    
    ServiceConfig {
        int id PK
        string serviceName UK
        string serviceUrl
        string apiKey
        boolean enabled
        json configData
        datetime updatedAt
        uuid updatedBy FK
    }
    
    SessionToken {
        uuid id PK
        uuid userId FK
        string tokenHash UK
        datetime expiresAt
        datetime createdAt
        datetime lastUsedAt
    }
    
    Account {
        uuid id PK
        uuid userId FK
        string type
        string provider
        string providerAccountId
        text refresh_token
        text access_token
        int expires_at
        string token_type
        string scope
        text id_token
        string session_state
    }
    
    Session {
        uuid id PK
        string sessionToken UK
        uuid userId FK
        datetime expires
    }
    
    VerificationToken {
        string identifier PK
        string token UK
        datetime expires
    }
    
    ErrorLog {
        uuid id PK
        string correlationId
        uuid userId FK
        string errorCode
        string errorMessage
        text stackTrace
        string requestPath
        string requestMethod
        int statusCode
        json metadata
        datetime createdAt
    }
    
    ServiceMetric {
        uuid id PK
        string serviceName
        string metricName
        float metricValue
        datetime timestamp
        json metadata
    }
    
    ServiceIncident {
        uuid id PK
        string serviceName
        string incidentType
        string description
        string severity
        string status
        datetime createdAt
        datetime resolvedAt
        json metadata
    }
    
    Notification {
        uuid id PK
        uuid userId FK
        string type
        string title
        string message
        boolean read
        datetime createdAt
        datetime readAt
        json metadata
    }
```

## Data Flow Architecture

Shows how data flows through the system from user interactions to storage:

```mermaid
graph TB
    subgraph "User Layer"
        A[Web Interface]
        B[API Clients]
        C[Mobile Apps]
    end
    
    subgraph "Authentication Layer"
        D[Plex OAuth]
        E[Session Management]
        F[JWT Tokens]
    end
    
    subgraph "Application Layer"
        G[REST API]
        H[WebSocket Server]
        I[Background Jobs]
    end
    
    subgraph "Business Logic"
        J[Media Request Handler]
        K[YouTube Download Manager]
        L[Service Monitor]
        M[Notification System]
    end
    
    subgraph "Data Access Layer"
        N[Prisma ORM]
        O[Redis Cache]
        P[File System]
    end
    
    subgraph "Storage Layer"
        Q[(PostgreSQL)]
        R[(Media Files)]
        S[(Log Files)]
    end
    
    A --> D
    B --> D
    C --> D
    
    D --> E
    E --> F
    
    F --> G
    F --> H
    
    G --> J
    H --> M
    I --> K
    I --> L
    
    J --> N
    K --> N
    L --> N
    M --> N
    
    N --> Q
    N --> O
    K --> P
    
    P --> R
    L --> S
```

## Indexing Strategy Visualization

Database performance optimization through strategic indexing:

```mermaid
graph LR
    subgraph "Primary Indexes"
        A[User.id] --> A1[Unique Constraint]
        B[MediaRequest.id] --> B1[Unique Constraint]
        C[YoutubeDownload.id] --> C1[Unique Constraint]
    end
    
    subgraph "Unique Indexes"
        D[User.email] --> D1[Email Uniqueness]
        E[User.plexId] --> E1[Plex Integration]
        F[ServiceStatus.serviceName] --> F1[Service Identification]
    end
    
    subgraph "Performance Indexes"
        G[MediaRequest.userId_status] --> G1[Request Filtering]
        H[MediaRequest.createdAt] --> H1[Time-based Queries]
        I[MediaRequest.tmdbId_mediaType] --> I1[Media Lookups]
        J[RateLimit.userId_endpoint] --> J1[Rate Limiting]
        K[SessionToken.expiresAt] --> K1[Session Cleanup]
        L[ErrorLog.correlationId] --> L1[Error Tracking]
    end
    
    subgraph "Analytics Indexes"
        M[ServiceMetric.serviceName_metricName] --> M1[Metric Queries]
        N[ServiceMetric.timestamp] --> N1[Time Series]
        O[ServiceIncident.serviceName_status] --> O1[Incident Management]
        P[Notification.userId_read] --> P1[User Notifications]
    end
```

## Query Performance Patterns

Optimized query patterns for common operations:

```mermaid
graph TD
    A[User Dashboard Query] --> B{Cache Hit?}
    B -->|Yes| C[Return Cached Data]
    B -->|No| D[Execute Query Plan]
    
    D --> E[Join User + MediaRequest]
    E --> F[Filter by Status Index]
    F --> G[Order by Created Date]
    G --> H[Limit Results]
    
    H --> I[Cache Results]
    I --> J[Return Data]
    
    K[Service Health Check] --> L[Single Table Query]
    L --> M[Use Service Name Index]
    M --> N[Return Status]
    
    O[Error Correlation Query] --> P[Use Correlation ID Index]
    P --> Q[Join User Table]
    Q --> R[Return Error Context]
    
    style C fill:#c8e6c9
    style I fill:#fff3e0
    style N fill:#c8e6c9
    style R fill:#c8e6c9
```

## Data Lifecycle Management

How data flows through its lifecycle in the system:

```mermaid
stateDiagram-v2
    [*] --> Created : User Action
    
    state "Media Request Lifecycle" as MRL {
        Created --> Pending : Validation
        Pending --> Processing : Overseerr
        Processing --> Downloaded : Success
        Processing --> Failed : Error
        Downloaded --> Available : Plex Update
        Failed --> Retry : Auto Retry
        Retry --> Processing : Reprocess
        Failed --> Manual : Max Retries
        Manual --> Processing : Admin Action
        Available --> [*] : Complete
    }
    
    state "User Session Lifecycle" as USL {
        [*] --> Active : Login
        Active --> Refreshed : Token Refresh
        Refreshed --> Active : Continue
        Active --> Expired : Timeout
        Expired --> [*] : Cleanup
        Active --> Revoked : Logout
        Revoked --> [*] : Cleanup
    }
    
    state "Service Health Lifecycle" as SHL {
        [*] --> Monitoring : Health Check
        Monitoring --> Healthy : Pass
        Monitoring --> Degraded : Partial Failure
        Monitoring --> Down : Complete Failure
        Healthy --> Monitoring : Next Check
        Degraded --> Healthy : Recovery
        Degraded --> Down : Escalation
        Down --> Degraded : Partial Recovery
        Down --> Healthy : Full Recovery
    }
```

## Database Security Model

Security layers and access controls:

```mermaid
graph TB
    subgraph "Application Security"
        A[Connection Pooling]
        B[Query Parameterization]
        C[ORM Security]
    end
    
    subgraph "Database Security"
        D[Row Level Security]
        E[Column Encryption]
        F[Audit Logging]
    end
    
    subgraph "Access Control"
        G[User Roles]
        H[Permission Matrix]
        I[API Rate Limiting]
    end
    
    subgraph "Data Protection"
        J[Backup Encryption]
        K[Data Masking]
        L[Retention Policies]
    end
    
    A --> D
    B --> E
    C --> F
    
    G --> H
    H --> I
    
    D --> J
    E --> K
    F --> L
```

## Schema Migration Strategy

Version control and migration approach:

```mermaid
timeline
    title Database Schema Evolution
    
    section v1.0.0
        Initial Schema : User Management
                      : Basic Media Requests
                      : Service Status
    
    section v1.1.0
        OAuth Integration : Account Model
                          : Session Model
                          : Verification Tokens
    
    section v1.2.0
        Enhanced Monitoring : Error Logging
                           : Service Metrics
                           : Service Incidents
    
    section v1.3.0
        User Experience : Notifications
                       : YouTube Downloads
                       : Performance Indexes
    
    section v2.0.0
        Analytics Platform : Advanced Metrics
                          : Historical Data
                          : Reporting Tables
```

## Performance Monitoring Dashboard

Key metrics for database health monitoring:

```mermaid
graph LR
    subgraph "Performance Metrics"
        A[Query Response Time] --> A1[< 100ms Target]
        B[Connection Pool Usage] --> B1[< 80% Utilization]
        C[Index Hit Ratio] --> C1[> 99% Hit Rate]
        D[Cache Hit Ratio] --> D1[> 95% Hit Rate]
    end
    
    subgraph "Health Indicators"
        E[Dead Locks] --> E1[Zero Tolerance]
        F[Failed Connections] --> F1[< 1% Error Rate]
        G[Long Running Queries] --> G1[< 5 Second Limit]
        H[Disk Usage] --> H1[< 85% Capacity]
    end
    
    subgraph "Alert Thresholds"
        A1 --> I[Yellow Alert]
        B1 --> I
        E1 --> J[Red Alert]
        F1 --> J
        G1 --> K[Critical Alert]
        H1 --> K
    end
```

## Backup and Recovery Architecture

Data protection and disaster recovery strategy:

```mermaid
graph TB
    subgraph "Production Database"
        A[(Primary DB)] --> B[Continuous WAL]
        B --> C[Streaming Replication]
    end
    
    subgraph "High Availability"
        C --> D[(Standby DB)]
        D --> E[Read Replicas]
        E --> F[Load Balancing]
    end
    
    subgraph "Backup Strategy"
        B --> G[Daily Full Backup]
        B --> H[Hourly Incremental]
        G --> I[Encrypted Storage]
        H --> I
    end
    
    subgraph "Recovery Options"
        I --> J[Point-in-Time Recovery]
        I --> K[Full System Restore]
        I --> L[Selective Restore]
    end
    
    subgraph "Testing"
        J --> M[Monthly DR Tests]
        K --> M
        L --> M
        M --> N[Recovery Validation]
    end
```

## Database Connection Architecture

Connection management and pooling strategy:

```mermaid
graph TD
    subgraph "Application Tier"
        A[Web Server 1]
        B[Web Server 2]
        C[Background Jobs]
        D[Admin Interface]
    end
    
    subgraph "Connection Pool"
        E[PgBouncer]
        F[Connection Pooling]
        G[Load Balancing]
    end
    
    subgraph "Database Tier"
        H[(Primary DB)]
        I[(Replica 1)]
        J[(Replica 2)]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
    
    E --> F
    F --> G
    
    G --> H
    G --> I
    G --> J
    
    H --> K[Write Operations]
    I --> L[Read Operations]
    J --> L
```

This comprehensive database documentation ensures optimal performance, security, and maintainability of the MediaNest data layer.