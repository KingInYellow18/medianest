# User Journey & Workflow Diagrams

This document outlines the key user journeys and workflows within MediaNest, showing step-by-step processes that users follow to accomplish their goals.

## New User Onboarding Journey

```mermaid
journey
    title MediaNest User Onboarding Journey

    section Discovery
        User finds MediaNest: 5: User
        Reviews documentation: 4: User
        Checks system requirements: 3: User

    section Installation
        Downloads MediaNest: 5: User
        Runs Docker setup: 4: User, Admin
        Configures environment: 3: Admin
        Starts services: 4: Admin

    section First Login
        Visits MediaNest URL: 5: User
        Clicks Plex Login: 5: User
        Authenticates with Plex: 4: User
        Grants permissions: 3: User
        Redirected to dashboard: 5: User

    section Initial Setup
        Explores dashboard: 5: User
        Configures preferences: 4: User
        Connects external services: 3: User, Admin
        Tests media request: 4: User

    section Regular Usage
        Requests new media: 5: User
        Downloads YouTube content: 4: User
        Manages playlists: 4: User
        Monitors downloads: 3: User
        Enjoys content: 5: User
```

## Media Request Workflow

```mermaid
flowchart TD
    subgraph "Media Request User Journey"
        START([User wants new content])

        subgraph "Discovery Phase"
            BROWSE_DASH[Browse Dashboard]
            SEARCH_MEDIA{Search for Media}
            FOUND[Found in Library]
            NOT_FOUND[Not Available]
        end

        subgraph "Request Phase"
            CLICK_REQUEST[Click Request Media]
            SELECT_QUALITY[Select Quality/Format]
            ADD_NOTES[Add Request Notes]
            SUBMIT_REQ[Submit Request]
        end

        subgraph "Processing Phase"
            REQ_QUEUED[Request Queued]
            ADMIN_REVIEW[Admin Review]
            AUTO_APPROVE{Auto-approval Rules}
            MANUAL_APPROVE[Manual Approval]
            REJECTED[Request Rejected]
        end

        subgraph "Fulfillment Phase"
            SEND_TO_ARR[Send to *arr Services]
            DOWNLOAD_START[Download Begins]
            PROGRESS_TRACK[Track Progress]
            QUALITY_CHECK[Quality Verification]
            PLEX_IMPORT[Import to Plex]
        end

        subgraph "Notification Phase"
            NOTIFY_USER[Notify User]
            UPDATE_STATUS[Update Request Status]
            EMAIL_SENT[Email Notification]
            DASHBOARD_UPDATE[Dashboard Refresh]
        end

        subgraph "Completion Phase"
            CONTENT_READY[Content Available]
            USER_WATCHES[User Enjoys Content]
            RATE_CONTENT[Rate & Review]
            REQUEST_MORE[Request More Content]
        end

        START --> BROWSE_DASH
        BROWSE_DASH --> SEARCH_MEDIA

        SEARCH_MEDIA -->|Found| FOUND
        SEARCH_MEDIA -->|Not Found| NOT_FOUND

        FOUND --> USER_WATCHES
        NOT_FOUND --> CLICK_REQUEST

        CLICK_REQUEST --> SELECT_QUALITY
        SELECT_QUALITY --> ADD_NOTES
        ADD_NOTES --> SUBMIT_REQ

        SUBMIT_REQ --> REQ_QUEUED
        REQ_QUEUED --> AUTO_APPROVE

        AUTO_APPROVE -->|Approved| SEND_TO_ARR
        AUTO_APPROVE -->|Requires Review| ADMIN_REVIEW

        ADMIN_REVIEW -->|Approved| MANUAL_APPROVE
        ADMIN_REVIEW -->|Rejected| REJECTED

        MANUAL_APPROVE --> SEND_TO_ARR
        REJECTED --> NOTIFY_USER

        SEND_TO_ARR --> DOWNLOAD_START
        DOWNLOAD_START --> PROGRESS_TRACK
        PROGRESS_TRACK --> QUALITY_CHECK
        QUALITY_CHECK --> PLEX_IMPORT

        PLEX_IMPORT --> UPDATE_STATUS
        UPDATE_STATUS --> NOTIFY_USER
        NOTIFY_USER --> EMAIL_SENT
        EMAIL_SENT --> DASHBOARD_UPDATE

        DASHBOARD_UPDATE --> CONTENT_READY
        CONTENT_READY --> USER_WATCHES
        USER_WATCHES --> RATE_CONTENT
        RATE_CONTENT --> REQUEST_MORE
        REQUEST_MORE --> BROWSE_DASH

        %% Styling
        classDef userAction fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
        classDef systemAction fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
        classDef decision fill:#fff3e0,stroke:#ff9800,stroke-width:2px
        classDef notification fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
        classDef completion fill:#e8f5e8,stroke:#4caf50,stroke-width:3px

        class BROWSE_DASH,CLICK_REQUEST,SELECT_QUALITY,ADD_NOTES,SUBMIT_REQ,USER_WATCHES,RATE_CONTENT,REQUEST_MORE userAction
        class REQ_QUEUED,SEND_TO_ARR,DOWNLOAD_START,PROGRESS_TRACK,QUALITY_CHECK,PLEX_IMPORT systemAction
        class SEARCH_MEDIA,AUTO_APPROVE,ADMIN_REVIEW decision
        class NOTIFY_USER,EMAIL_SENT,DASHBOARD_UPDATE notification
        class CONTENT_READY,FOUND completion
    end
```

## YouTube Download Workflow

```mermaid
stateDiagram-v2
    [*] --> BrowseDashboard: User accesses MediaNest

    BrowseDashboard --> YouTubeSection: Navigate to YouTube Downloads
    YouTubeSection --> PasteURL: Click "Add Playlist"

    PasteURL --> ValidateURL: Paste YouTube URL
    ValidateURL --> URLValid: Valid playlist/video URL
    ValidateURL --> URLInvalid: Invalid URL

    URLInvalid --> PasteURL: Show error message

    URLValid --> SelectOptions: URL accepted
    SelectOptions --> ConfigureDownload: Choose quality/format

    ConfigureDownload --> SubmitDownload: Click "Start Download"
    SubmitDownload --> QueueJob: Add to download queue

    QueueJob --> ProcessingQueue: Job queued
    ProcessingQueue --> DownloadActive: Worker picks up job

    DownloadActive --> DownloadProgress: Show progress
    DownloadProgress --> DownloadComplete: All files downloaded
    DownloadProgress --> DownloadError: Download fails

    DownloadError --> RetryDownload: Automatic retry
    DownloadError --> MarkFailed: Max retries exceeded
    RetryDownload --> DownloadActive

    DownloadComplete --> ProcessFiles: Organize files
    ProcessFiles --> CreateCollection: Create Plex collection

    CreateCollection --> NotifyUser: Send completion notification
    NotifyUser --> UpdateDashboard: Refresh UI

    UpdateDashboard --> [*]: Process complete
    MarkFailed --> [*]: Download failed

    note right of ValidateURL
        Supports:
        - Individual videos
        - Playlists
        - Channels
        - Custom formats
    end note

    note right of DownloadActive
        Real-time progress:
        - File count
        - Download speed
        - ETA
        - Current file
    end note
```

## Administrator Dashboard Workflow

```mermaid
graph LR
    subgraph "Admin Daily Workflow"
        subgraph "Morning Routine"
            LOGIN[🔑 Admin Login]
            CHECK_DASH[📊 Check Dashboard]
            REVIEW_ALERTS[⚠️ Review Alerts]
            CHECK_HEALTH[🏥 System Health]
        end

        subgraph "Request Management"
            PENDING_REQ[📋 Pending Requests]
            REVIEW_REQ[👁️ Review Details]
            APPROVE_REJ{✅❌ Approve/Reject}
            BATCH_ACTIONS[📦 Batch Operations]
        end

        subgraph "System Monitoring"
            SERVICE_STATUS[🔧 Service Status]
            PERFORMANCE[⚡ Performance Metrics]
            ERROR_LOGS[📝 Error Logs]
            USER_ACTIVITY[👥 User Activity]
        end

        subgraph "Maintenance Tasks"
            UPDATE_CONFIG[⚙️ Update Configuration]
            MANAGE_USERS[👤 User Management]
            BACKUP_CHECK[💾 Backup Status]
            CLEANUP_LOGS[🧹 Log Cleanup]
        end

        subgraph "End of Day"
            GENERATE_REPORTS[📈 Generate Reports]
            SCHEDULE_MAINT[🗓️ Schedule Maintenance]
            SECURITY_REVIEW[🛡️ Security Review]
            LOGOUT[🚪 Logout]
        end
    end

    LOGIN --> CHECK_DASH
    CHECK_DASH --> REVIEW_ALERTS
    REVIEW_ALERTS --> CHECK_HEALTH

    CHECK_HEALTH --> PENDING_REQ
    PENDING_REQ --> REVIEW_REQ
    REVIEW_REQ --> APPROVE_REJ
    APPROVE_REJ --> BATCH_ACTIONS

    BATCH_ACTIONS --> SERVICE_STATUS
    SERVICE_STATUS --> PERFORMANCE
    PERFORMANCE --> ERROR_LOGS
    ERROR_LOGS --> USER_ACTIVITY

    USER_ACTIVITY --> UPDATE_CONFIG
    UPDATE_CONFIG --> MANAGE_USERS
    MANAGE_USERS --> BACKUP_CHECK
    BACKUP_CHECK --> CLEANUP_LOGS

    CLEANUP_LOGS --> GENERATE_REPORTS
    GENERATE_REPORTS --> SCHEDULE_MAINT
    SCHEDULE_MAINT --> SECURITY_REVIEW
    SECURITY_REVIEW --> LOGOUT

    %% Styling
    classDef morning fill:#fff3e0,stroke:#f57c00
    classDef requests fill:#e8f5e8,stroke:#4caf50
    classDef monitoring fill:#e3f2fd,stroke:#2196f3
    classDef maintenance fill:#f3e5f5,stroke:#9c27b0
    classDef endday fill:#ffebee,stroke:#d32f2f

    class LOGIN,CHECK_DASH,REVIEW_ALERTS,CHECK_HEALTH morning
    class PENDING_REQ,REVIEW_REQ,APPROVE_REJ,BATCH_ACTIONS requests
    class SERVICE_STATUS,PERFORMANCE,ERROR_LOGS,USER_ACTIVITY monitoring
    class UPDATE_CONFIG,MANAGE_USERS,BACKUP_CHECK,CLEANUP_LOGS maintenance
    class GENERATE_REPORTS,SCHEDULE_MAINT,SECURITY_REVIEW,LOGOUT endday
```

## User Support & Troubleshooting Journey

```mermaid
journey
    title User Support Journey

    section Issue Discovery
        User encounters problem: 2: User
        Checks documentation: 3: User
        Searches FAQ: 3: User
        Problem persists: 2: User

    section Self-Service
        Checks system status: 4: User
        Reviews error messages: 3: User
        Tries basic troubleshooting: 3: User
        Restarts services: 2: User

    section Community Help
        Posts in forum: 3: User
        Community responds: 4: Community
        Tries suggested solutions: 3: User
        Solution found or escalated: 4: User, Community

    section Professional Support
        Creates support ticket: 3: User, Admin
        Admin investigates: 4: Admin
        Solution implemented: 5: Admin
        Issue resolved: 5: User, Admin

    section Follow-up
        Updates documentation: 4: Admin
        Shares solution: 4: Community
        Prevents future issues: 5: Admin
        User satisfaction: 5: User
```

## Mobile Access Patterns (Future Implementation)

```mermaid
graph TD
    subgraph "Mobile User Journey"
        MOBILE_ACCESS[📱 Access via Mobile]
        PWA_INSTALL{Install PWA?}
        BROWSER_USE[Use Mobile Browser]
        INSTALL_PWA[Install Progressive Web App]

        subgraph "Mobile Features"
            DASH_MOBILE[Mobile Dashboard]
            REQUEST_MOBILE[Request Media on Mobile]
            DOWNLOAD_MOBILE[Download Management]
            NOTIFICATIONS[Push Notifications]
        end

        subgraph "Offline Capabilities"
            CACHE_CONTENT[Cache Critical Content]
            OFFLINE_QUEUE[Queue Actions Offline]
            SYNC_ONLINE[Sync When Online]
        end

        MOBILE_ACCESS --> PWA_INSTALL
        PWA_INSTALL -->|Yes| INSTALL_PWA
        PWA_INSTALL -->|No| BROWSER_USE

        INSTALL_PWA --> DASH_MOBILE
        BROWSER_USE --> DASH_MOBILE

        DASH_MOBILE --> REQUEST_MOBILE
        DASH_MOBILE --> DOWNLOAD_MOBILE
        DASH_MOBILE --> NOTIFICATIONS

        REQUEST_MOBILE --> CACHE_CONTENT
        DOWNLOAD_MOBILE --> OFFLINE_QUEUE
        NOTIFICATIONS --> SYNC_ONLINE

        %% Styling
        classDef mobile fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
        classDef feature fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
        classDef offline fill:#fff3e0,stroke:#f57c00,stroke-width:2px

        class MOBILE_ACCESS,INSTALL_PWA,BROWSER_USE mobile
        class DASH_MOBILE,REQUEST_MOBILE,DOWNLOAD_MOBILE,NOTIFICATIONS feature
        class CACHE_CONTENT,OFFLINE_QUEUE,SYNC_ONLINE offline
    end
```

These user journey diagrams help understand the complete user experience within MediaNest, from initial onboarding through daily usage patterns. Each journey is designed to be intuitive while providing powerful media management capabilities.
