# User Journey Flow Diagrams

## User Authentication Journey

```mermaid
graph TD
    START([User Visits MediaNest]) --> CHECK_SESSION{Session Valid?}

    CHECK_SESSION -->|Yes| DASHBOARD[Show Dashboard]
    CHECK_SESSION -->|No| LOGIN_PAGE[Show Login Page]

    LOGIN_PAGE --> PLEX_AUTH[Plex OAuth Login]
    LOGIN_PAGE --> MANUAL_LOGIN[Manual Login Form]

    PLEX_AUTH --> PLEX_REDIRECT[Redirect to Plex]
    PLEX_REDIRECT --> PLEX_APPROVAL{User Approves?}
    PLEX_APPROVAL -->|Yes| PLEX_CALLBACK[OAuth Callback]
    PLEX_APPROVAL -->|No| LOGIN_PAGE

    PLEX_CALLBACK --> CREATE_SESSION[Create JWT Session]
    MANUAL_LOGIN --> VALIDATE_CREDS{Valid Credentials?}
    VALIDATE_CREDS -->|Yes| CREATE_SESSION
    VALIDATE_CREDS -->|No| LOGIN_ERROR[Show Error Message]
    LOGIN_ERROR --> LOGIN_PAGE

    CREATE_SESSION --> SET_COOKIE[Set Session Cookie]
    SET_COOKIE --> DASHBOARD

    DASHBOARD --> USER_ACTIONS[User Actions Available]

    USER_ACTIONS --> MEDIA_REQUEST[Request Media]
    USER_ACTIONS --> YOUTUBE_DL[Download YouTube]
    USER_ACTIONS --> VIEW_STATUS[View Status]
    USER_ACTIONS --> ADMIN_PANEL{Admin User?}

    ADMIN_PANEL -->|Yes| ADMIN_FEATURES[Admin Features]
    ADMIN_PANEL -->|No| USER_FEATURES[User Features]

    LOGOUT[Logout Action] --> CLEAR_SESSION[Clear Session]
    CLEAR_SESSION --> LOGIN_PAGE

    classDef startEnd fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
    classDef process fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef error fill:#ffebee,stroke:#f44336,stroke-width:2px

    class START,LOGOUT startEnd
    class LOGIN_PAGE,PLEX_AUTH,MANUAL_LOGIN,PLEX_REDIRECT,PLEX_CALLBACK,CREATE_SESSION,SET_COOKIE,DASHBOARD,USER_ACTIONS,MEDIA_REQUEST,YOUTUBE_DL,VIEW_STATUS,ADMIN_FEATURES,USER_FEATURES,CLEAR_SESSION process
    class CHECK_SESSION,PLEX_APPROVAL,VALIDATE_CREDS,ADMIN_PANEL decision
    class LOGIN_ERROR error
```

## Media Request Journey

```mermaid
graph TD
    USER_LOGIN[User Logged In] --> SEARCH_MEDIA[Search for Media]

    SEARCH_MEDIA --> SEARCH_TYPE{Search Type}
    SEARCH_TYPE -->|Movie| MOVIE_SEARCH[Search Movies via TMDB]
    SEARCH_TYPE -->|TV Show| TV_SEARCH[Search TV Shows via TMDB]

    MOVIE_SEARCH --> DISPLAY_RESULTS[Display Search Results]
    TV_SEARCH --> DISPLAY_RESULTS

    DISPLAY_RESULTS --> SELECT_MEDIA[User Selects Media]
    SELECT_MEDIA --> CHECK_AVAILABILITY{Already Available?}

    CHECK_AVAILABILITY -->|Yes| ALREADY_AVAILABLE[Show "Already Available"]
    CHECK_AVAILABILITY -->|No| REQUEST_FORM[Show Request Form]

    REQUEST_FORM --> QUALITY_SELECT[Select Quality Preferences]
    QUALITY_SELECT --> SUBMIT_REQUEST[Submit Request]

    SUBMIT_REQUEST --> VALIDATE_REQUEST{Valid Request?}
    VALIDATE_REQUEST -->|No| SHOW_ERROR[Show Validation Error]
    SHOW_ERROR --> REQUEST_FORM

    VALIDATE_REQUEST -->|Yes| SAVE_REQUEST[Save to Database]
    SAVE_REQUEST --> NOTIFY_ADMINS[Notify Administrators]
    NOTIFY_ADMINS --> OVERSEERR_SYNC[Sync with Overseerr]

    OVERSEERR_SYNC --> REQUEST_STATUS[Set Status: Pending]
    REQUEST_STATUS --> WEBSOCKET_UPDATE[Send Real-time Update]
    WEBSOCKET_UPDATE --> USER_NOTIFICATION[User Receives Notification]

    USER_NOTIFICATION --> ADMIN_APPROVAL{Admin Approval Required?}
    ADMIN_APPROVAL -->|Yes| WAIT_APPROVAL[Wait for Admin Approval]
    ADMIN_APPROVAL -->|No| AUTO_DOWNLOAD[Automatic Download]

    WAIT_APPROVAL --> ADMIN_REVIEW[Admin Reviews Request]
    ADMIN_REVIEW --> ADMIN_DECISION{Admin Decision}
    ADMIN_DECISION -->|Approve| AUTO_DOWNLOAD
    ADMIN_DECISION -->|Reject| REJECT_REQUEST[Mark as Rejected]

    AUTO_DOWNLOAD --> SONARR_RADARR[Trigger Sonarr/Radarr]
    SONARR_RADARR --> DOWNLOAD_STATUS[Update Download Status]
    DOWNLOAD_STATUS --> PLEX_SCAN[Plex Library Scan]
    PLEX_SCAN --> COMPLETE_REQUEST[Mark Request Complete]

    COMPLETE_REQUEST --> FINAL_NOTIFICATION[Send Completion Notification]
    REJECT_REQUEST --> REJECTION_NOTIFICATION[Send Rejection Notification]

    ALREADY_AVAILABLE --> VIEW_IN_PLEX[Link to Plex]

    classDef user fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
    classDef process fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef external fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef notification fill:#e0f2f1,stroke:#009688,stroke-width:2px
    classDef error fill:#ffebee,stroke:#f44336,stroke-width:2px

    class USER_LOGIN,SELECT_MEDIA,SUBMIT_REQUEST user
    class SEARCH_MEDIA,MOVIE_SEARCH,TV_SEARCH,DISPLAY_RESULTS,REQUEST_FORM,QUALITY_SELECT,SAVE_REQUEST,REQUEST_STATUS,AUTO_DOWNLOAD,DOWNLOAD_STATUS,COMPLETE_REQUEST,VIEW_IN_PLEX process
    class SEARCH_TYPE,CHECK_AVAILABILITY,VALIDATE_REQUEST,ADMIN_APPROVAL,ADMIN_DECISION decision
    class OVERSEERR_SYNC,SONARR_RADARR,PLEX_SCAN external
    class NOTIFY_ADMINS,WEBSOCKET_UPDATE,USER_NOTIFICATION,FINAL_NOTIFICATION,REJECTION_NOTIFICATION notification
    class SHOW_ERROR,REJECT_REQUEST error
```

## YouTube Download Journey

```mermaid
graph TD
    USER_AUTH[Authenticated User] --> YT_PAGE[Navigate to YouTube Download]

    YT_PAGE --> PASTE_URL[Paste YouTube URL]
    PASTE_URL --> VALIDATE_URL{Valid YouTube URL?}

    VALIDATE_URL -->|No| URL_ERROR[Show URL Error]
    URL_ERROR --> PASTE_URL

    VALIDATE_URL -->|Yes| DETECT_TYPE{Content Type}
    DETECT_TYPE -->|Single Video| VIDEO_OPTIONS[Show Video Options]
    DETECT_TYPE -->|Playlist| PLAYLIST_OPTIONS[Show Playlist Options]

    VIDEO_OPTIONS --> SELECT_QUALITY[Select Video Quality]
    PLAYLIST_OPTIONS --> SELECT_VIDEOS[Select Videos from Playlist]
    SELECT_VIDEOS --> SELECT_QUALITY

    SELECT_QUALITY --> CHOOSE_FORMAT[Choose Download Format]
    CHOOSE_FORMAT --> PLEX_INTEGRATION{Add to Plex?}

    PLEX_INTEGRATION -->|Yes| SELECT_LIBRARY[Select Plex Library]
    PLEX_INTEGRATION -->|No| START_DOWNLOAD

    SELECT_LIBRARY --> CREATE_COLLECTION[Create Plex Collection]
    CREATE_COLLECTION --> START_DOWNLOAD[Start Download Process]

    START_DOWNLOAD --> QUEUE_JOB[Add to Download Queue]
    QUEUE_JOB --> WEBSOCKET_START[Send Start Notification]
    WEBSOCKET_START --> DOWNLOAD_PROGRESS[Show Progress Bar]

    DOWNLOAD_PROGRESS --> PROCESSING[Video Processing]
    PROCESSING --> PROGRESS_UPDATE[Real-time Progress Updates]
    PROGRESS_UPDATE --> DOWNLOAD_COMPLETE{Download Complete?}

    DOWNLOAD_COMPLETE -->|No| PROGRESS_UPDATE
    DOWNLOAD_COMPLETE -->|Yes| FILE_PROCESSING[Process Downloaded Files]

    FILE_PROCESSING --> METADATA_EXTRACT[Extract Metadata]
    METADATA_EXTRACT --> PLEX_ADD{Add to Plex?}

    PLEX_ADD -->|Yes| MOVE_TO_PLEX[Move Files to Plex Library]
    PLEX_ADD -->|No| STORE_FILES[Store in Downloads Folder]

    MOVE_TO_PLEX --> PLEX_SCAN_LIB[Trigger Plex Library Scan]
    PLEX_SCAN_LIB --> UPDATE_COLLECTION[Update Plex Collection]
    UPDATE_COLLECTION --> COMPLETION_NOTIFY

    STORE_FILES --> COMPLETION_NOTIFY[Send Completion Notification]
    COMPLETION_NOTIFY --> DOWNLOAD_HISTORY[Update Download History]

    DOWNLOAD_HISTORY --> VIEW_RESULTS[Display Download Results]

    classDef user fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
    classDef process fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef plex fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef notification fill:#e0f2f1,stroke:#009688,stroke-width:2px
    classDef error fill:#ffebee,stroke:#f44336,stroke-width:2px
    classDef progress fill:#e8eaf6,stroke:#3f51b5,stroke-width:2px

    class USER_AUTH,PASTE_URL,SELECT_VIDEOS,SELECT_QUALITY,CHOOSE_FORMAT user
    class YT_PAGE,VIDEO_OPTIONS,PLAYLIST_OPTIONS,START_DOWNLOAD,QUEUE_JOB,FILE_PROCESSING,METADATA_EXTRACT,STORE_FILES,DOWNLOAD_HISTORY,VIEW_RESULTS process
    class VALIDATE_URL,DETECT_TYPE,PLEX_INTEGRATION,DOWNLOAD_COMPLETE,PLEX_ADD decision
    class SELECT_LIBRARY,CREATE_COLLECTION,MOVE_TO_PLEX,PLEX_SCAN_LIB,UPDATE_COLLECTION plex
    class WEBSOCKET_START,COMPLETION_NOTIFY notification
    class URL_ERROR error
    class DOWNLOAD_PROGRESS,PROCESSING,PROGRESS_UPDATE progress
```

## Admin Dashboard Journey

```mermaid
graph TD
    ADMIN_LOGIN[Admin User Login] --> ADMIN_DASHBOARD[Admin Dashboard]

    ADMIN_DASHBOARD --> ADMIN_SECTIONS{Admin Sections}

    ADMIN_SECTIONS --> USER_MGMT[User Management]
    ADMIN_SECTIONS --> SERVICE_MGMT[Service Management]
    ADMIN_SECTIONS --> SYSTEM_MONITOR[System Monitoring]
    ADMIN_SECTIONS --> REQUEST_MGMT[Request Management]
    ADMIN_SECTIONS --> SETTINGS[System Settings]

    USER_MGMT --> LIST_USERS[List All Users]
    LIST_USERS --> USER_ACTIONS{User Actions}
    USER_ACTIONS --> EDIT_USER[Edit User Details]
    USER_ACTIONS --> DELETE_USER[Delete User]
    USER_ACTIONS --> RESET_PASSWORD[Reset Password]
    USER_ACTIONS --> CHANGE_ROLE[Change User Role]

    SERVICE_MGMT --> SERVICE_STATUS[View Service Status]
    SERVICE_STATUS --> SERVICE_ACTIONS{Service Actions}
    SERVICE_ACTIONS --> CONFIG_SERVICE[Configure Service]
    SERVICE_ACTIONS --> TEST_CONNECTION[Test Connection]
    SERVICE_ACTIONS --> RESTART_SERVICE[Restart Service]

    SYSTEM_MONITOR --> METRICS_DASH[Metrics Dashboard]
    METRICS_DASH --> PERFORMANCE_GRAPHS[Performance Graphs]
    PERFORMANCE_GRAPHS --> ERROR_LOGS[View Error Logs]
    ERROR_LOGS --> ALERT_CONFIG[Configure Alerts]

    REQUEST_MGMT --> PENDING_REQUESTS[View Pending Requests]
    PENDING_REQUESTS --> REQUEST_ACTIONS{Request Actions}
    REQUEST_ACTIONS --> APPROVE_REQUEST[Approve Request]
    REQUEST_ACTIONS --> REJECT_REQUEST[Reject Request]
    REQUEST_ACTIONS --> MODIFY_REQUEST[Modify Request]

    SETTINGS --> GENERAL_SETTINGS[General Settings]
    GENERAL_SETTINGS --> API_KEYS[Manage API Keys]
    API_KEYS --> INTEGRATION_CONFIG[Integration Configuration]
    INTEGRATION_CONFIG --> BACKUP_SETTINGS[Backup Settings]

    APPROVE_REQUEST --> UPDATE_OVERSEERR[Update Overseerr]
    REJECT_REQUEST --> NOTIFY_USER[Notify User]

    CONFIG_SERVICE --> SAVE_CONFIG[Save Configuration]
    SAVE_CONFIG --> RESTART_REQUIRED{Restart Required?}
    RESTART_REQUIRED -->|Yes| RESTART_SERVICE
    RESTART_REQUIRED -->|No| CONFIG_COMPLETE[Configuration Complete]

    classDef admin fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
    classDef section fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef action fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef decision fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef notification fill:#e0f2f1,stroke:#009688,stroke-width:2px
    classDef monitoring fill:#e8eaf6,stroke:#3f51b5,stroke-width:2px

    class ADMIN_LOGIN,ADMIN_DASHBOARD admin
    class USER_MGMT,SERVICE_MGMT,SYSTEM_MONITOR,REQUEST_MGMT,SETTINGS section
    class LIST_USERS,EDIT_USER,DELETE_USER,RESET_PASSWORD,CHANGE_ROLE,CONFIG_SERVICE,TEST_CONNECTION,RESTART_SERVICE,APPROVE_REQUEST,REJECT_REQUEST,MODIFY_REQUEST,GENERAL_SETTINGS,API_KEYS,INTEGRATION_CONFIG,BACKUP_SETTINGS,SAVE_CONFIG action
    class ADMIN_SECTIONS,USER_ACTIONS,SERVICE_ACTIONS,REQUEST_ACTIONS,RESTART_REQUIRED decision
    class UPDATE_OVERSEERR,NOTIFY_USER,CONFIG_COMPLETE notification
    class SERVICE_STATUS,METRICS_DASH,PERFORMANCE_GRAPHS,ERROR_LOGS,ALERT_CONFIG,PENDING_REQUESTS monitoring
```
