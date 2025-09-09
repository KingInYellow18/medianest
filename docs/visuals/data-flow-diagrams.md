# MediaNest Data Flow Diagrams

## 📊 Core Data Flow Patterns

### 1. Media Upload & Processing Flow

```mermaid
flowchart TD
    A[User Uploads Media] --> B{File Validation}
    B -->|Invalid| C[Return Error]
    B -->|Valid| D[Generate Upload URL]
    
    D --> E[Direct Upload to S3]
    E --> F[Update Database Record]
    F --> G[Queue Processing Job]
    
    G --> H[Media Worker Processes File]
    H --> I[Generate Thumbnails]
    H --> J[Extract Metadata]
    H --> K[Create Video Previews]
    
    I --> L[Store Thumbnails in S3]
    J --> M[Update Database Metadata]
    K --> N[Store Previews in S3]
    
    L --> O[Update Processing Status]
    M --> O
    N --> O
    
    O --> P[Send WebSocket Notification]
    P --> Q[Update Frontend UI]
    
    %% Error handling
    H -->|Processing Error| R[Mark as Failed]
    R --> S[Send Error Notification]
    
    %% Styling
    classDef userAction fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef processing fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef storage fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef notification fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef error fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    
    class A,B,D userAction
    class G,H,I,J,K processing
    class E,F,L,M,N storage
    class P,Q notification
    class C,R,S error
```

### 2. User Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as Auth API
    participant R as Redis
    participant D as Database
    participant S as Session Store

    U->>F: Enter Credentials
    F->>A: POST /auth/login
    
    A->>D: Verify User Credentials
    alt Valid Credentials
        D-->>A: User Profile
        A->>R: Generate Session Token
        A->>S: Store Session Data
        A-->>F: JWT Token + User Data
        F->>F: Store Token in LocalStorage
        F-->>U: Redirect to Dashboard
    else Invalid Credentials
        D-->>A: Authentication Failed
        A-->>F: Error Response
        F-->>U: Display Error Message
    end
    
    Note over U,S: Subsequent API Requests
    U->>F: Navigate to Protected Route
    F->>A: GET /api/media (with JWT)
    A->>R: Validate JWT
    alt Valid Token
        R-->>A: Session Valid
        A->>D: Fetch User Data
        D-->>A: User Data
        A-->>F: Protected Resource
        F-->>U: Display Content
    else Invalid/Expired Token
        R-->>A: Session Invalid
        A-->>F: 401 Unauthorized
        F->>F: Clear LocalStorage
        F-->>U: Redirect to Login
    end
```

### 3. Real-time Notification System

```mermaid
graph LR
    subgraph "Event Sources"
        A[Media Upload Complete]
        B[Processing Status Update]
        C[User Activity]
        D[System Alert]
    end
    
    subgraph "Event Processing"
        E[Event Handler]
        F[Permission Check]
        G[Notification Router]
    end
    
    subgraph "Delivery Channels"
        H[WebSocket Connection]
        I[Email Service]
        J[Push Notifications]
        K[Database Log]
    end
    
    subgraph "Client Reception"
        L[Frontend State Update]
        M[Toast Notification]
        N[Live Dashboard Update]
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
    G --> K
    
    H --> L
    L --> M
    L --> N
    
    %% Styling
    classDef eventSrc fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef processing fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px  
    classDef delivery fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef client fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    
    class A,B,C,D eventSrc
    class E,F,G processing
    class H,I,J,K delivery
    class L,M,N client
```

## 🔄 API Request Lifecycle

### Standard API Request Flow

```mermaid
flowchart TD
    A[Client Request] --> B[Load Balancer<br/>Traefik/HAProxy]
    B --> C[Rate Limiting<br/>Express Rate Limit]
    C --> D{Rate Limit OK?}
    D -->|No| E[429 Too Many Requests]
    D -->|Yes| F[CORS Validation]
    F --> G{CORS Valid?}
    G -->|No| H[CORS Error]
    G -->|Yes| I[Security Headers<br/>Helmet.js]
    I --> J[Request Logging<br/>Morgan + Winston]
    J --> K[Authentication Check<br/>JWT Middleware]
    K --> L{Auth Required?}
    L -->|No| M[Route Handler]
    L -->|Yes| N{Valid JWT?}
    N -->|No| O[401 Unauthorized]
    N -->|Yes| P[Authorization Check<br/>Role/Permission]
    P --> Q{Authorized?}
    Q -->|No| R[403 Forbidden] 
    Q -->|Yes| M
    M --> S[Database Query<br/>PostgreSQL]
    S --> T[Response Processing<br/>Data Transform]
    T --> U[Cache Update<br/>Redis]
    U --> V[Response Headers<br/>Security + CORS]
    V --> W[JSON Response]
    W --> X[Client Receives Response]
    
    %% Error handling paths
    E --> X
    H --> X
    O --> X
    R --> X
    
    %% Styling
    classDef middleware fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef security fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    classDef processing fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef data fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef error fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    
    class B,C,F,I,J middleware
    class K,N,P security
    class M,T,V processing
    class S,U data
    class E,H,O,R error
```

## 📁 File Management Data Flow

### File Upload Process

```mermaid
stateDiagram-v2
    [*] --> Uploading: User selects file
    
    Uploading --> Validating: File received
    Validating --> ValidationFailed: Invalid file type/size
    Validating --> Processing: Valid file
    
    ValidationFailed --> [*]: Error returned to user
    
    Processing --> ThumbnailGeneration: Extract metadata
    Processing --> MetadataExtraction: Generate thumbnails
    Processing --> VideoProcessing: Create previews (if video)
    
    ThumbnailGeneration --> Storing: Thumbnails created
    MetadataExtraction --> Storing: Metadata extracted  
    VideoProcessing --> Storing: Previews generated
    
    Storing --> Complete: All assets stored
    Complete --> NotifyUser: Update database
    NotifyUser --> [*]: WebSocket notification sent
    
    Processing --> Failed: Processing error
    Failed --> [*]: Error notification sent
```

### File Access & Security Flow

```mermaid
graph TB
    subgraph "Client Request"
        A[User Requests File<br/>/api/files/123]
    end
    
    subgraph "Authentication Layer"
        B[Verify JWT Token]
        C[Check User Permissions]
        D[Validate File Ownership]
    end
    
    subgraph "File Resolution"
        E[Database Lookup<br/>File Metadata]
        F[Generate Signed URL<br/>S3/Storage]
        G[Apply Access Controls]
    end
    
    subgraph "Response Handling"
        H[Cache Response<br/>Redis TTL]
        I[Security Headers]
        J[Return File URL/Data]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    I --> J
    
    %% Error paths
    B -->|Invalid Token| K[401 Unauthorized]
    C -->|No Permission| L[403 Forbidden]
    D -->|Not Owner| M[404 Not Found]
    E -->|File Not Found| N[404 Not Found]
    
    %% Styling
    classDef auth fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    classDef resolution fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef response fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef error fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    
    class B,C,D auth
    class E,F,G resolution  
    class H,I,J response
    class K,L,M,N error
```

## 🔍 Search & Discovery Flow

### Search Request Processing

```mermaid
flowchart LR
    subgraph "Client Input"
        A[User Search Query<br/>'Marvel movies 2023']
    end
    
    subgraph "Query Processing"
        B[Parse Search Terms]
        C[Apply Filters<br/>Date, Type, etc.]
        D[Permission Filtering<br/>User Access Level]
    end
    
    subgraph "Search Execution"
        E[Database Full-text Search<br/>PostgreSQL FTS]
        F[Elasticsearch Query<br/>Advanced Search]
        G[Metadata Matching<br/>Tags, Categories]
    end
    
    subgraph "Result Processing"
        H[Combine Results]
        I[Rank by Relevance]
        J[Apply Pagination]
        K[Generate Thumbnails URLs]
    end
    
    subgraph "Response"
        L[Cache Results<br/>Redis 5min TTL]
        M[Return JSON Response]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    D --> F  
    D --> G
    E --> H
    F --> H
    G --> H
    H --> I
    I --> J
    J --> K
    K --> L
    L --> M
    
    %% Styling
    classDef input fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef processing fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef search fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef results fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    
    class A input
    class B,C,D processing
    class E,F,G search
    class H,I,J,K,L,M results
```

## 🔗 External Integration Data Flow

### Plex Integration Sync

```mermaid
sequenceDiagram
    participant M as MediaNest
    participant P as Plex Server  
    participant D as Database
    participant C as Cache
    
    Note over M,C: Scheduled Sync Process
    M->>P: GET /library/sections
    P-->>M: Library Sections Data
    
    loop For each library
        M->>P: GET /library/sections/{id}/all
        P-->>M: Media Items
        
        M->>D: Check Existing Records
        D-->>M: Current Records
        
        alt New Media Found
            M->>D: Insert New Records
            M->>C: Cache Metadata
        else Updated Media
            M->>D: Update Records
            M->>C: Update Cache
        else Deleted Media
            M->>D: Mark as Deleted
            M->>C: Remove from Cache
        end
    end
    
    M->>M: Generate Sync Report
    M->>M: Send Webhook Notifications
    
    Note over M,C: Real-time Updates
    P->>M: Webhook: New Media Added
    M->>D: Create Record
    M->>C: Cache New Data
    M->>M: Send WebSocket Update
```

## 💾 Backup & Recovery Data Flow

### Automated Backup Process

```mermaid
graph TD
    A[Scheduled Backup Trigger<br/>Daily 2 AM UTC] --> B{Backup Type}
    
    B -->|Full Backup| C[Database Dump<br/>PostgreSQL pg_dump]
    B -->|Incremental| D[WAL Archive<br/>Point-in-time Recovery]
    
    C --> E[Compress Backup<br/>gzip compression]
    D --> E
    
    E --> F[Encrypt Backup<br/>AES-256 encryption]
    F --> G[Upload to S3<br/>Separate bucket]
    
    G --> H[Update Backup Registry<br/>Track backup metadata]
    H --> I[Verify Backup Integrity<br/>Checksum validation]
    
    I --> J{Verification OK?}
    J -->|Yes| K[Send Success Notification]
    J -->|No| L[Alert Operations Team]
    
    K --> M[Cleanup Old Backups<br/>Retention policy]
    L --> N[Retry Backup Process]
    
    %% Recovery Path
    O[Recovery Request] --> P[Validate Recovery Point]
    P --> Q[Download Backup from S3]
    Q --> R[Decrypt & Decompress]
    R --> S[Restore Database]
    S --> T[Verify Data Integrity]
    T --> U[Switch DNS/Traffic]
    
    %% Styling
    classDef scheduled fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef backup fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef verification fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef recovery fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef error fill:#ffebee,stroke:#d32f2f,stroke-width:2px
    
    class A,B scheduled
    class C,D,E,F,G,H backup
    class I,J,T verification
    class O,P,Q,R,S,U recovery
    class L,N error
```

---

*These data flow diagrams illustrate the core operational patterns within MediaNest, ensuring transparency in system behavior and facilitating debugging and optimization efforts.*