# State Machine Diagrams

## User Authentication State Machine

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    
    Unauthenticated --> LoginProcess : start_login
    LoginProcess --> PlexOAuth : plex_login
    LoginProcess --> ManualLogin : manual_login
    
    PlexOAuth --> PlexRedirect : redirect_to_plex
    PlexRedirect --> PlexCallback : user_approves
    PlexRedirect --> Unauthenticated : user_denies
    
    PlexCallback --> TokenGeneration : oauth_success
    PlexCallback --> LoginError : oauth_failed
    
    ManualLogin --> CredentialValidation : submit_credentials
    CredentialValidation --> TokenGeneration : valid_credentials
    CredentialValidation --> LoginError : invalid_credentials
    
    TokenGeneration --> Authenticated : tokens_created
    LoginError --> Unauthenticated : retry_login
    
    Authenticated --> TokenRefresh : token_near_expiry
    Authenticated --> Logout : user_logout
    Authenticated --> SessionExpired : token_expired
    
    TokenRefresh --> Authenticated : refresh_success
    TokenRefresh --> Unauthenticated : refresh_failed
    
    SessionExpired --> Unauthenticated : cleanup_session
    Logout --> LogoutProcess : start_logout
    LogoutProcess --> Unauthenticated : session_cleared
    
    state LoginProcess {
        [*] --> ValidatingInput
        ValidatingInput --> ProcessingAuth : input_valid
        ValidatingInput --> [*] : input_invalid
        ProcessingAuth --> [*] : auth_complete
    }
    
    state Authenticated {
        [*] --> Active
        Active --> RateLimited : rate_limit_exceeded
        RateLimited --> Active : rate_limit_reset
        Active --> Suspended : account_suspended
        Suspended --> [*] : force_logout
    }
```

## Media Request State Machine

```mermaid
stateDiagram-v2
    [*] --> Draft
    
    Draft --> Validating : submit_request
    Validating --> ValidationFailed : invalid_data
    Validating --> PendingApproval : requires_approval
    Validating --> AutoApproved : auto_approval_enabled
    
    ValidationFailed --> Draft : fix_validation_errors
    
    PendingApproval --> AdminReview : admin_assigned
    AdminReview --> Approved : admin_approves
    AdminReview --> Rejected : admin_rejects
    AdminReview --> RequiresInfo : admin_requests_info
    
    RequiresInfo --> PendingApproval : user_provides_info
    RequiresInfo --> Cancelled : user_cancels
    
    AutoApproved --> Processing : auto_process
    Approved --> Processing : start_processing
    
    Processing --> OverseerrSync : sync_with_overseerr
    OverseerrSync --> QueuedDownload : overseerr_queued
    OverseerrSync --> ProcessingError : overseerr_error
    
    QueuedDownload --> Downloading : download_started
    Downloading --> DownloadComplete : download_finished
    Downloading --> DownloadFailed : download_error
    
    DownloadComplete --> ProcessingMedia : process_files
    ProcessingMedia --> PlexSync : add_to_plex
    PlexSync --> Completed : plex_updated
    PlexSync --> PlexError : plex_sync_failed
    
    DownloadFailed --> RetryQueue : auto_retry
    DownloadFailed --> Failed : max_retries_exceeded
    ProcessingError --> RetryQueue : retry_processing
    PlexError --> Manual : manual_intervention_required
    
    RetryQueue --> Processing : retry_attempt
    Manual --> Completed : manual_resolution
    Manual --> Failed : manual_failure
    
    Rejected --> [*] : cleanup
    Cancelled --> [*] : cleanup
    Completed --> [*] : archive
    Failed --> [*] : archive
    
    state Processing {
        [*] --> ValidatingMedia
        ValidatingMedia --> CheckingAvailability
        CheckingAvailability --> PreparingDownload
        PreparingDownload --> [*]
    }
    
    state Downloading {
        [*] --> Queued
        Queued --> InProgress
        InProgress --> PostProcessing
        PostProcessing --> [*]
    }
```

## YouTube Download State Machine

```mermaid
stateDiagram-v2
    [*] --> URLInput
    
    URLInput --> URLValidation : url_submitted
    URLValidation --> URLValid : valid_youtube_url
    URLValidation --> URLInvalid : invalid_url
    
    URLInvalid --> URLInput : retry_input
    
    URLValid --> ContentAnalysis : analyze_content
    ContentAnalysis --> SingleVideo : single_video_detected
    ContentAnalysis --> Playlist : playlist_detected
    ContentAnalysis --> AnalysisError : analysis_failed
    
    AnalysisError --> URLInput : retry_analysis
    
    SingleVideo --> QualitySelection : show_quality_options
    Playlist --> PlaylistSelection : show_playlist_options
    PlaylistSelection --> QualitySelection : videos_selected
    
    QualitySelection --> PlexOptions : quality_selected
    PlexOptions --> QueuedDownload : options_configured
    
    QueuedDownload --> Downloading : start_download
    
    Downloading --> ProgressTracking : download_started
    ProgressTracking --> DownloadComplete : download_finished
    ProgressTracking --> DownloadError : download_failed
    ProgressTracking --> DownloadPaused : user_pauses
    
    DownloadPaused --> ProgressTracking : user_resumes
    DownloadPaused --> DownloadCancelled : user_cancels
    
    DownloadError --> RetryDownload : auto_retry
    DownloadError --> DownloadFailed : max_retries_exceeded
    
    RetryDownload --> Downloading : retry_attempt
    
    DownloadComplete --> FileProcessing : process_files
    FileProcessing --> MetadataExtraction : extract_metadata
    MetadataExtraction --> PlexIntegration : add_to_plex
    MetadataExtraction --> FileStorage : store_locally
    
    PlexIntegration --> PlexProcessing : plex_integration_enabled
    PlexProcessing --> PlexComplete : plex_scan_complete
    PlexProcessing --> PlexError : plex_integration_failed
    
    FileStorage --> StorageComplete : files_organized
    
    PlexComplete --> Completed : mark_complete
    StorageComplete --> Completed : mark_complete
    PlexError --> ManualIntervention : manual_plex_fix
    ManualIntervention --> Completed : manual_resolution
    
    DownloadCancelled --> [*] : cleanup_files
    DownloadFailed --> [*] : cleanup_partial_files
    Completed --> [*] : archive_record
    
    state Downloading {
        [*] --> Initializing
        Initializing --> Fetching
        Fetching --> Processing
        Processing --> Finalizing
        Finalizing --> [*]
    }
    
    state PlexIntegration {
        [*] --> CreatingCollection
        CreatingCollection --> MovingFiles
        MovingFiles --> TriggeringScan
        TriggeringScan --> UpdatingMetadata
        UpdatingMetadata --> [*]
    }
```

## Service Health State Machine

```mermaid
stateDiagram-v2
    [*] --> Initializing
    
    Initializing --> HealthCheck : start_monitoring
    HealthCheck --> Healthy : service_responsive
    HealthCheck --> Unhealthy : service_unresponsive
    HealthCheck --> Unknown : check_timeout
    
    Healthy --> HealthCheck : periodic_check
    Healthy --> Degraded : performance_issues
    Healthy --> Maintenance : planned_maintenance
    
    Degraded --> Healthy : performance_restored
    Degraded --> Unhealthy : service_fails
    Degraded --> HealthCheck : continue_monitoring
    
    Unhealthy --> Recovery : attempt_recovery
    Unhealthy --> HealthCheck : retry_check
    
    Recovery --> Healthy : recovery_successful
    Recovery --> Failed : recovery_failed
    Recovery --> Unhealthy : recovery_timeout
    
    Failed --> ManualIntervention : escalate_issue
    Failed --> HealthCheck : scheduled_retry
    
    ManualIntervention --> Healthy : manual_fix_successful
    ManualIntervention --> Failed : manual_fix_failed
    
    Maintenance --> Healthy : maintenance_complete
    Maintenance --> Failed : maintenance_failed
    
    Unknown --> HealthCheck : retry_check
    
    state HealthCheck {
        [*] --> ConnectivityTest
        ConnectivityTest --> ResponseTimeTest
        ResponseTimeTest --> FunctionalityTest
        FunctionalityTest --> [*]
    }
    
    state Recovery {
        [*] --> AutoRestart
        AutoRestart --> ConfigValidation
        ConfigValidation --> ConnectionRetry
        ConnectionRetry --> [*]
    }
```

## User Session State Machine

```mermaid
stateDiagram-v2
    [*] --> NoSession
    
    NoSession --> CreatingSession : login_successful
    CreatingSession --> Active : session_created
    CreatingSession --> CreationFailed : session_creation_error
    
    CreationFailed --> NoSession : retry_login
    
    Active --> TokenValidation : validate_token
    TokenValidation --> Active : token_valid
    TokenValidation --> RefreshingToken : token_expired
    TokenValidation --> Invalid : token_invalid
    
    RefreshingToken --> Active : refresh_successful
    RefreshingToken --> Invalid : refresh_failed
    
    Active --> Inactive : user_inactive
    Inactive --> Active : user_activity_detected
    Inactive --> ExpiredInactive : inactivity_timeout
    
    Active --> RateLimited : rate_limit_triggered
    RateLimited --> Active : rate_limit_cleared
    
    Active --> Suspended : account_suspended
    Suspended --> Invalid : force_logout
    
    Active --> LoggingOut : user_logout
    LoggingOut --> NoSession : session_destroyed
    
    Invalid --> NoSession : cleanup_session
    ExpiredInactive --> NoSession : cleanup_expired_session
    
    state Active {
        [*] --> Normal
        Normal --> DeviceValidation : validate_device
        DeviceValidation --> Normal : device_valid
        DeviceValidation --> DeviceBlocked : device_invalid
        DeviceBlocked --> [*] : block_session
        
        Normal --> PermissionCheck : check_permissions
        PermissionCheck --> Normal : permissions_valid
        PermissionCheck --> PermissionDenied : insufficient_permissions
        PermissionDenied --> [*] : restrict_access
    }
```

## WebSocket Connection State Machine

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    
    Disconnected --> Connecting : initiate_connection
    Connecting --> Authenticating : connection_established
    Connecting --> ConnectionFailed : connection_error
    
    ConnectionFailed --> Reconnecting : auto_reconnect
    ConnectionFailed --> Disconnected : max_retries_exceeded
    
    Reconnecting --> Connecting : retry_connection
    Reconnecting --> Disconnected : reconnect_cancelled
    
    Authenticating --> Connected : auth_successful
    Authenticating --> AuthFailed : auth_failed
    
    AuthFailed --> Disconnected : invalid_credentials
    
    Connected --> RoomJoining : join_rooms
    RoomJoining --> Active : rooms_joined
    
    Active --> MessageReceiving : incoming_message
    Active --> MessageSending : outgoing_message
    Active --> PingPong : heartbeat_check
    
    MessageReceiving --> Active : message_processed
    MessageSending --> Active : message_sent
    
    PingPong --> Active : ping_successful
    PingPong --> ConnectionLost : ping_timeout
    
    ConnectionLost --> Reconnecting : attempt_reconnect
    ConnectionLost --> Disconnected : reconnect_disabled
    
    Active --> Disconnecting : user_disconnect
    Active --> ForceDisconnect : server_disconnect
    
    Disconnecting --> Disconnected : graceful_disconnect
    ForceDisconnect --> Disconnected : forced_disconnect
    
    state Active {
        [*] --> Idle
        Idle --> Processing : event_received
        Processing --> Broadcasting : broadcast_event
        Broadcasting --> Idle : broadcast_complete
        
        Idle --> RateLimited : rate_limit_exceeded
        RateLimited --> Idle : rate_limit_reset
    }
    
    state Reconnecting {
        [*] --> BackoffDelay
        BackoffDelay --> RetryAttempt
        RetryAttempt --> [*]
    }
```