# Database Schema and Entity Relationships

## Entity Relationship Diagram

```mermaid
erDiagram
    User {
        string id PK
        string plex_id UK "nullable"
        string plex_username "nullable"
        string email UK
        string name "nullable"
        string role "default: USER"
        string plex_token "nullable"
        string image "nullable"
        boolean requires_password_change "default: false"
        timestamp created_at "default: now()"
        timestamp last_login_at "nullable"
        string status "default: active"
    }

    MediaRequest {
        string id PK
        string user_id FK
        string title
        string media_type
        string tmdb_id "nullable"
        string status "default: pending"
        string overseerr_id "nullable"
        timestamp created_at "default: now()"
        timestamp completed_at "nullable"
    }

    YoutubeDownload {
        string id PK
        string user_id FK
        string playlist_url
        string playlist_title "nullable"
        string status "default: queued"
        json file_paths "nullable"
        string plex_collection_id "nullable"
        timestamp created_at "default: now()"
        timestamp completed_at "nullable"
    }

    ServiceStatus {
        int id PK
        string service_name UK
        string status "nullable"
        int response_time_ms "nullable"
        timestamp last_check_at "nullable"
        decimal uptime_percentage "nullable, 5,2"
    }

    RateLimit {
        int id PK
        string user_id FK
        string endpoint
        int request_count "default: 0"
        timestamp window_start "default: now()"
    }

    ServiceConfig {
        int id PK
        string service_name UK
        string service_url
        string api_key "nullable"
        boolean enabled "default: true"
        json config_data "nullable"
        timestamp updated_at "default: now()"
        string updated_by FK "nullable"
    }

    SessionToken {
        string id PK
        string user_id FK
        string token_hash UK
        timestamp expires_at
        timestamp created_at "default: now()"
        timestamp last_used_at "nullable"
    }

    Account {
        string id PK
        string user_id FK
        string type
        string provider
        string provider_account_id
        text refresh_token "nullable"
        text access_token "nullable"
        int expires_at "nullable"
        string token_type "nullable"
        string scope "nullable"
        text id_token "nullable"
        string session_state "nullable"
    }

    Session {
        string id PK
        string session_token UK
        string user_id FK
        timestamp expires
    }

    VerificationToken {
        string identifier
        string token UK
        timestamp expires
    }

    ErrorLog {
        string id PK
        string correlation_id
        string user_id FK
        string error_code
        string error_message
        text stack_trace "nullable"
        string request_path
        string request_method
        int status_code "nullable"
        json metadata "nullable"
        timestamp created_at "default: now()"
    }

    ServiceMetric {
        string id PK
        string service_name
        string metric_name
        float metric_value
        timestamp timestamp "default: now()"
        json metadata "nullable"
    }

    ServiceIncident {
        string id PK
        string service_name
        string incident_type
        string description
        string severity "default: low"
        string status "default: open"
        timestamp created_at "default: now()"
        timestamp resolved_at "nullable"
        json metadata "nullable"
    }

    Notification {
        string id PK
        string user_id FK
        string type
        string title
        string message
        boolean read "default: false"
        timestamp created_at "default: now()"
        timestamp read_at "nullable"
        json metadata "nullable"
    }

    %% Relationships
    User ||--o{ MediaRequest : "creates"
    User ||--o{ YoutubeDownload : "initiates"
    User ||--o{ RateLimit : "has"
    User ||--o{ SessionToken : "owns"
    User ||--o{ Account : "has"
    User ||--o{ Session : "has"
    User ||--o{ ErrorLog : "generates"
    User ||--o{ Notification : "receives"
    User ||--o{ ServiceConfig : "updates"

    %% Indexes
    MediaRequest }o--|| User : "user_id, status"
    YoutubeDownload }o--|| User : "user_id"
    RateLimit }o--|| User : "user_id, endpoint"
    SessionToken }o--|| User : "user_id, expires_at"
    ErrorLog }o--|| User : "correlation_id, created_at"
    ServiceMetric }o--|| ServiceMetric : "service_name, metric_name"
    ServiceIncident }o--|| ServiceIncident : "service_name, status"
    Notification }o--|| User : "user_id, read"
```

## Database Schema Details

### Core User Management

```mermaid
graph TD
    subgraph "User Authentication & Sessions"
        USERS[Users Table<br/>- Primary user data<br/>- Plex integration<br/>- Role-based access]
        SESSIONS[Sessions Table<br/>- NextAuth sessions<br/>- Browser sessions<br/>- Auto-cleanup]
        ACCOUNTS[Accounts Table<br/>- OAuth providers<br/>- Plex accounts<br/>- Token management]
        SESSION_TOKENS[Session Tokens<br/>- JWT tokens<br/>- Device tracking<br/>- Expiration management]
        VERIFY_TOKENS[Verification Tokens<br/>- Email verification<br/>- Password reset<br/>- One-time use]
    end

    subgraph "Security & Rate Limiting"
        RATE_LIMITS[Rate Limits<br/>- Per-user limits<br/>- Endpoint-specific<br/>- Time windows]
        ERROR_LOGS[Error Logs<br/>- Exception tracking<br/>- Correlation IDs<br/>- User context]
    end

    USERS --> SESSIONS
    USERS --> ACCOUNTS
    USERS --> SESSION_TOKENS
    USERS --> RATE_LIMITS
    USERS --> ERROR_LOGS

    classDef userMgmt fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef security fill:#fff3e0,stroke:#f57c00,stroke-width:2px

    class USERS,SESSIONS,ACCOUNTS,SESSION_TOKENS,VERIFY_TOKENS userMgmt
    class RATE_LIMITS,ERROR_LOGS security
```

### Media Management System

```mermaid
graph TD
    subgraph "Media Operations"
        MEDIA_REQ[Media Requests<br/>- TMDB integration<br/>- Overseerr sync<br/>- Status tracking]
        YOUTUBE_DL[YouTube Downloads<br/>- Playlist support<br/>- Plex integration<br/>- File tracking]
        NOTIFICATIONS[Notifications<br/>- Real-time updates<br/>- User preferences<br/>- Read status]
    end

    subgraph "External Service Integration"
        SERVICE_CONFIG[Service Configuration<br/>- API endpoints<br/>- Authentication keys<br/>- Feature toggles]
        SERVICE_STATUS[Service Status<br/>- Health monitoring<br/>- Response times<br/>- Uptime tracking]
        SERVICE_METRICS[Service Metrics<br/>- Performance data<br/>- Historical trends<br/>- Alert thresholds]
        SERVICE_INCIDENTS[Service Incidents<br/>- Issue tracking<br/>- Severity levels<br/>- Resolution status]
    end

    USERS[Users] --> MEDIA_REQ
    USERS --> YOUTUBE_DL
    USERS --> NOTIFICATIONS
    USERS --> SERVICE_CONFIG

    classDef media fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef services fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px

    class MEDIA_REQ,YOUTUBE_DL,NOTIFICATIONS media
    class SERVICE_CONFIG,SERVICE_STATUS,SERVICE_METRICS,SERVICE_INCIDENTS services
```

## Index Strategy

### Performance-Critical Indexes

```mermaid
graph LR
    subgraph "Primary Indexes"
        IDX1[Users: email, plex_id]
        IDX2[MediaRequest: user_id + status]
        IDX3[Sessions: user_id + expires]
        IDX4[RateLimit: user_id + endpoint]
    end

    subgraph "Query Optimization Indexes"
        IDX5[MediaRequest: created_at]
        IDX6[MediaRequest: tmdb_id + media_type]
        IDX7[ServiceStatus: last_check_at]
        IDX8[ErrorLog: correlation_id]
        IDX9[ErrorLog: created_at]
        IDX10[ServiceMetric: service_name + metric_name]
        IDX11[Notification: user_id + read]
    end

    subgraph "Composite Indexes"
        IDX12[SessionToken: user_id + expires_at]
        IDX13[ServiceIncident: service_name + status]
        IDX14[YoutubeDownload: user_id + status]
    end

    classDef primary fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
    classDef optimization fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef composite fill:#fff3e0,stroke:#ff9800,stroke-width:2px

    class IDX1,IDX2,IDX3,IDX4 primary
    class IDX5,IDX6,IDX7,IDX8,IDX9,IDX10,IDX11 optimization
    class IDX12,IDX13,IDX14 composite
```

## Data Flow Patterns

### User Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Login
    Login --> CreateSession : Valid credentials
    Login --> [*] : Invalid credentials

    CreateSession --> ActiveSession : JWT + Cookie
    ActiveSession --> TokenRefresh : Before expiration
    ActiveSession --> Logout : User action
    ActiveSession --> SessionExpired : Timeout

    TokenRefresh --> ActiveSession : New token
    TokenRefresh --> Login : Refresh failed

    SessionExpired --> Login
    Logout --> CleanupSession
    CleanupSession --> [*]
```

### Media Request Lifecycle

```mermaid
stateDiagram-v2
    [*] --> RequestCreated
    RequestCreated --> PendingApproval : Manual approval required
    RequestCreated --> AutoApproved : Auto-approval enabled

    PendingApproval --> Approved : Admin approval
    PendingApproval --> Rejected : Admin rejection

    AutoApproved --> InProgress : Sent to Overseerr
    Approved --> InProgress : Sent to Overseerr

    InProgress --> Downloading : Sonarr/Radarr picks up
    Downloading --> Processing : Download complete
    Processing --> Completed : Added to Plex
    Processing --> Failed : Processing error

    Rejected --> [*]
    Completed --> [*]
    Failed --> PendingApproval : Retry option
```
