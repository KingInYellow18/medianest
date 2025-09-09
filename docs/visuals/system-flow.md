# Interactive System Flow Diagrams

This document provides comprehensive, interactive Mermaid diagrams depicting key system flows in MediaNest. These diagrams are designed for MKDocs Material compatibility and include detailed user journeys, authentication flows, and media request processes.

## User Authentication Flow

The authentication flow integrates with Plex OAuth and includes session management with security features:

```mermaid
graph TD
    A[User Access Request] --> B{Already Authenticated?}
    B -->|Yes| C[Check Session Validity]
    B -->|No| D[Redirect to Login]
    
    C --> E{Session Valid?}
    E -->|Yes| F[Access Granted]
    E -->|No| G[Clear Invalid Session]
    
    D --> H[Plex OAuth Login]
    G --> H
    
    H --> I{Plex Authentication}
    I -->|Success| J[Exchange Code for Token]
    I -->|Failure| K[Display Error Message]
    
    J --> L[Validate User Role]
    L --> M{User Authorized?}
    M -->|Yes| N[Create Session Token]
    M -->|No| O[Access Denied]
    
    N --> P[Set Secure Cookies]
    P --> F
    
    K --> Q[Return to Login]
    O --> Q
    
    F --> R[Dashboard Access]
    
    style A fill:#e1f5fe
    style F fill:#c8e6c9
    style R fill:#c8e6c9
    style K fill:#ffcdd2
    style O fill:#ffcdd2
```

## Media Request Processing Flow

This diagram shows the complete flow from user request to media availability in Plex:

```mermaid
graph TB
    A[User Submits Media Request] --> B[Validate Request Data]
    B --> C{Valid Request?}
    C -->|No| D[Return Validation Error]
    C -->|Yes| E[Check Rate Limits]
    
    E --> F{Within Limits?}
    F -->|No| G[Rate Limit Exceeded]
    F -->|Yes| H[Save to Database]
    
    H --> I[Send to Overseerr]
    I --> J{Overseerr Available?}
    J -->|No| K[Queue for Retry]
    J -->|Yes| L[Process in Overseerr]
    
    L --> M{Media Found?}
    M -->|No| N[Manual Review Required]
    M -->|Yes| O[Download Media]
    
    O --> P[Media Downloaded]
    P --> Q[Update Plex Library]
    Q --> R[Send Notification]
    
    K --> S[Retry Background Job]
    S --> I
    
    N --> T[Admin Notification]
    T --> U[Manual Processing]
    
    R --> V[Request Complete]
    
    style A fill:#e1f5fe
    style V fill:#c8e6c9
    style D fill:#ffcdd2
    style G fill:#ffcdd2
    style N fill:#fff3e0
    style T fill:#fff3e0
```

## YouTube Download Workflow

MediaNest supports YouTube playlist downloads with Plex collection integration:

```mermaid
graph LR
    A[YouTube URL Input] --> B[Validate URL Format]
    B --> C{Valid YouTube URL?}
    C -->|No| D[Invalid URL Error]
    C -->|Yes| E[Extract Playlist Info]
    
    E --> F[Create Download Record]
    F --> G[Queue Download Job]
    G --> H[Background Processing]
    
    H --> I[Download Videos]
    I --> J{Download Success?}
    J -->|No| K[Retry Logic]
    J -->|Yes| L[Process Media Files]
    
    L --> M[Create Plex Collection]
    M --> N[Update Collection Metadata]
    N --> O[Refresh Plex Library]
    
    O --> P[Send Completion Notification]
    
    K --> Q{Max Retries?}
    Q -->|No| I
    Q -->|Yes| R[Mark as Failed]
    
    style A fill:#e1f5fe
    style P fill:#c8e6c9
    style D fill:#ffcdd2
    style R fill:#ffcdd2
```

## WebSocket Real-time Communication

Real-time updates for download progress and system status:

```mermaid
sequenceDiagram
    participant C as Client
    participant WS as WebSocket Server
    participant DB as Database
    participant BG as Background Jobs
    
    C->>WS: Connect with Auth Token
    WS->>WS: Validate Token
    WS->>C: Connection Established
    
    C->>WS: Subscribe to Notifications
    WS->>WS: Register Client
    
    BG->>DB: Update Download Status
    DB->>WS: Trigger Status Change
    WS->>C: Send Status Update
    
    BG->>DB: Complete Download
    DB->>WS: Trigger Completion
    WS->>C: Send Completion Notification
    
    C->>WS: Acknowledge Receipt
    WS->>DB: Mark as Read
```

## Admin Dashboard Data Flow

Administrative dashboard showing system metrics and user management:

```mermaid
graph TD
    A[Admin Dashboard Request] --> B[Verify Admin Role]
    B --> C{Admin Authorized?}
    C -->|No| D[Access Denied]
    C -->|Yes| E[Gather System Metrics]
    
    E --> F[Service Status Check]
    E --> G[User Activity Stats]
    E --> H[Media Request Stats]
    E --> I[System Performance]
    
    F --> J[Combine Dashboard Data]
    G --> J
    H --> J
    I --> J
    
    J --> K[Apply Data Filters]
    K --> L[Format for Display]
    L --> M[Send to Client]
    
    M --> N[Real-time Updates]
    N --> O[WebSocket Push]
    O --> P[Dashboard Auto-refresh]
    
    style A fill:#e1f5fe
    style D fill:#ffcdd2
    style P fill:#c8e6c9
```

## Service Health Monitoring Flow

Continuous monitoring of external services and system health:

```mermaid
graph TB
    subgraph "Health Check Cycle"
        A[Scheduled Health Check] --> B[Check Plex Server]
        B --> C[Check Overseerr]
        C --> D[Check Database]
        D --> E[Check Redis Cache]
        E --> F[Check File System]
    end
    
    F --> G[Aggregate Results]
    G --> H{All Services OK?}
    
    H -->|Yes| I[Update Status: Healthy]
    H -->|No| J[Identify Failed Services]
    
    J --> K[Log Incident]
    K --> L[Send Alert]
    L --> M[Update Dashboard]
    
    I --> N[Store Metrics]
    M --> N
    
    N --> O[Calculate Uptime]
    O --> P[Update Performance Metrics]
    P --> Q[Schedule Next Check]
    
    style I fill:#c8e6c9
    style J fill:#ffcdd2
    style L fill:#ff9800
```

## Error Handling and Recovery

Comprehensive error handling with logging and recovery mechanisms:

```mermaid
graph LR
    A[System Error Occurs] --> B[Capture Error Context]
    B --> C[Generate Correlation ID]
    C --> D[Log to Database]
    
    D --> E{Critical Error?}
    E -->|Yes| F[Immediate Alert]
    E -->|No| G[Standard Logging]
    
    F --> H[Admin Notification]
    G --> I[Error Analytics]
    
    H --> J[Incident Response]
    I --> K[Pattern Detection]
    
    J --> L{Auto-recoverable?}
    L -->|Yes| M[Automatic Recovery]
    L -->|No| N[Manual Intervention]
    
    M --> O[Verify Recovery]
    O --> P{Recovery Success?}
    P -->|Yes| Q[Log Resolution]
    P -->|No| N
    
    N --> R[Escalation Process]
    Q --> S[Update Metrics]
    
    style F fill:#ff5722
    style M fill:#4caf50
    style Q fill:#c8e6c9
```

## API Rate Limiting Flow

Protect APIs with intelligent rate limiting and user management:

```mermaid
graph TD
    A[API Request Received] --> B[Extract User Identity]
    B --> C[Check Rate Limit Cache]
    
    C --> D{Limit Exceeded?}
    D -->|Yes| E[Return 429 Too Many Requests]
    D -->|No| F[Increment Request Counter]
    
    F --> G[Process API Request]
    G --> H{Request Success?}
    H -->|Yes| I[Return Response]
    H -->|No| J[Handle API Error]
    
    J --> K[Log Error Details]
    K --> L[Return Error Response]
    
    I --> M[Update Request Metrics]
    L --> M
    
    M --> N[Cleanup Expired Limits]
    
    style E fill:#ffcdd2
    style I fill:#c8e6c9
    style J fill:#ff9800
```

## Diagram Interaction Notes

These diagrams support the following interactive features in MKDocs Material:

1. **Click Navigation**: Click on nodes to jump to relevant documentation sections
2. **Zoom and Pan**: Use mouse/touch to explore detailed flows
3. **Responsive Design**: Diagrams adapt to different screen sizes
4. **Print Optimization**: High-quality rendering for documentation exports
5. **Accessibility**: Screen reader compatible with proper alt text

## Technical Implementation

- **Mermaid Version**: 10.x compatible
- **Theme Integration**: Uses Material Design color palette
- **Performance**: Lazy loading for complex diagrams
- **Validation**: Automated syntax checking in CI/CD pipeline

## Diagram Maintenance

- Update diagrams when system architecture changes
- Validate syntax with `mermaid-cli` in pre-commit hooks
- Review quarterly for accuracy and relevance
- Coordinate updates with code changes through GitOps workflow

For detailed implementation of each flow, refer to the corresponding API documentation and technical specifications.