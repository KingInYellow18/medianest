# Authentication & Authorization Flow

This document details the comprehensive authentication and authorization system used in MediaNest, including Plex OAuth integration, session management, and security controls.

## Authentication Flow Overview

MediaNest uses a hybrid authentication approach combining Plex OAuth with NextAuth.js for robust, secure user management.

```mermaid
graph TD
    subgraph "Authentication Flow"
        START([User Access MediaNest])

        subgraph "Initial Check"
            CHECK_SESSION{Session Valid?}
            REDIRECT_LOGIN[Redirect to Login]
            ALLOW_ACCESS[Allow Access]
        end

        subgraph "Plex OAuth Flow"
            PLEX_LOGIN[Click Plex Login]
            PLEX_AUTH{Plex OAuth}
            PLEX_CALLBACK[OAuth Callback]
            PLEX_VERIFY[Verify Plex Token]
            PLEX_PROFILE[Fetch Plex Profile]
        end

        subgraph "Session Creation"
            CREATE_USER[Create/Update User]
            CREATE_SESSION[Create Session]
            STORE_TOKENS[Store Auth Tokens]
            SET_COOKIES[Set Secure Cookies]
        end

        subgraph "Authorization"
            CHECK_ROLE{Check User Role}
            APPLY_PERMISSIONS[Apply Permissions]
            ACCESS_GRANTED[Access Granted]
        end

        START --> CHECK_SESSION
        CHECK_SESSION -->|Valid| ALLOW_ACCESS
        CHECK_SESSION -->|Invalid| REDIRECT_LOGIN

        REDIRECT_LOGIN --> PLEX_LOGIN
        PLEX_LOGIN --> PLEX_AUTH
        PLEX_AUTH -->|Success| PLEX_CALLBACK
        PLEX_AUTH -->|Failure| REDIRECT_LOGIN

        PLEX_CALLBACK --> PLEX_VERIFY
        PLEX_VERIFY --> PLEX_PROFILE
        PLEX_PROFILE --> CREATE_USER

        CREATE_USER --> CREATE_SESSION
        CREATE_SESSION --> STORE_TOKENS
        STORE_TOKENS --> SET_COOKIES
        SET_COOKIES --> CHECK_ROLE

        CHECK_ROLE --> APPLY_PERMISSIONS
        APPLY_PERMISSIONS --> ACCESS_GRANTED

        ALLOW_ACCESS --> CHECK_ROLE
    end

    %% Styling
    classDef startEnd fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
    classDef process fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef security fill:#fce4ec,stroke:#e91e63,stroke-width:2px

    class START,ACCESS_GRANTED startEnd
    class PLEX_LOGIN,PLEX_CALLBACK,PLEX_VERIFY,PLEX_PROFILE,CREATE_USER,CREATE_SESSION,STORE_TOKENS,SET_COOKIES,APPLY_PERMISSIONS process
    class CHECK_SESSION,PLEX_AUTH,CHECK_ROLE decision
    class REDIRECT_LOGIN security
```

## Plex OAuth Integration Details

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant N as 🌐 Next.js
    participant NA as 🔐 NextAuth
    participant P as 🎬 Plex Server
    participant DB as 🐘 Database
    participant R as 🔴 Redis

    Note over U,R: Plex OAuth Authentication Flow

    U->>N: 1. Access Protected Route
    N->>NA: 2. Check Session
    NA->>R: 3. Validate Session Cache
    R->>NA: 4. Session Not Found
    NA->>N: 5. Redirect to Login
    N->>U: 6. Show Login Page

    U->>N: 7. Click "Login with Plex"
    N->>NA: 8. Initiate OAuth Flow
    NA->>P: 9. Redirect to Plex OAuth

    Note over P: User authenticates with Plex
    P->>U: 10. Plex Login Form
    U->>P: 11. Enter Credentials
    P->>U: 12. Grant Permission

    P->>NA: 13. OAuth Callback with Code
    NA->>P: 14. Exchange Code for Token
    P->>NA: 15. Access Token + User Info

    NA->>P: 16. Fetch User Profile
    P->>NA: 17. User Profile Data

    NA->>DB: 18. Create/Update User Record
    NA->>R: 19. Store Session Data
    NA->>N: 20. Set Session Cookies
    N->>U: 21. Redirect to Dashboard

    Note over U,R: Subsequent Authenticated Requests
    U->>N: 22. API Request with Session
    N->>NA: 23. Verify Session
    NA->>R: 24. Check Session Cache
    R->>NA: 25. Valid Session Data
    NA->>N: 26. Session Valid
    N->>U: 27. Return Protected Data
```

## Session Management Architecture

```mermaid
graph LR
    subgraph "Session Storage Strategy"
        subgraph "Client Side"
            HTTP_COOKIE[HttpOnly Cookies<br/>Secure, SameSite]
            CSRF_TOKEN[CSRF Token<br/>XSS Protection]
        end

        subgraph "Server Side"
            REDIS_SESSION[Redis Session Store<br/>Fast Access]
            DB_SESSION[Database Session<br/>Persistent Storage]
            JWT_TOKEN[JWT Access Tokens<br/>Stateless Auth]
        end

        subgraph "Security Controls"
            TOKEN_ROTATION[Token Rotation<br/>Refresh Tokens]
            SESSION_EXPIRE[Session Expiration<br/>Configurable TTL]
            DEVICE_TRACKING[Device Tracking<br/>Multi-device Support]
        end
    end

    HTTP_COOKIE --> REDIS_SESSION
    CSRF_TOKEN --> JWT_TOKEN
    REDIS_SESSION --> DB_SESSION
    JWT_TOKEN --> TOKEN_ROTATION
    DB_SESSION --> SESSION_EXPIRE
    TOKEN_ROTATION --> DEVICE_TRACKING

    %% Styling
    classDef clientSide fill:#e1f5fe,stroke:#0277bd
    classDef serverSide fill:#e8f5e8,stroke:#388e3c
    classDef security fill:#ffebee,stroke:#d32f2f

    class HTTP_COOKIE,CSRF_TOKEN clientSide
    class REDIS_SESSION,DB_SESSION,JWT_TOKEN serverSide
    class TOKEN_ROTATION,SESSION_EXPIRE,DEVICE_TRACKING security
```

## Role-Based Access Control (RBAC)

```mermaid
graph TB
    subgraph "User Roles & Permissions"
        subgraph "Roles"
            ADMIN[👑 Administrator<br/>Full System Access]
            MODERATOR[🛡️ Moderator<br/>User Management]
            USER[👤 Standard User<br/>Basic Features]
            GUEST[👥 Guest User<br/>Limited Access]
        end

        subgraph "Permission Matrix"
            subgraph "System Permissions"
                SYS_CONFIG[System Configuration]
                USER_MGMT[User Management]
                SERVICE_CONFIG[Service Configuration]
                SYSTEM_LOGS[System Logs Access]
            end

            subgraph "Media Permissions"
                MEDIA_REQUEST[Request Media]
                MEDIA_DOWNLOAD[Download Content]
                PLAYLIST_MGMT[Playlist Management]
                LIBRARY_ACCESS[Library Access]
            end

            subgraph "API Permissions"
                API_ADMIN[Admin API Endpoints]
                API_USER[User API Endpoints]
                API_READ[Read-only Access]
                API_WRITE[Write Access]
            end
        end

        subgraph "Dynamic Permissions"
            RESOURCE_OWNER[Resource Ownership<br/>Own Content Only]
            TEAM_MEMBER[Team Membership<br/>Shared Access]
            TIME_LIMITED[Time-based Access<br/>Temporary Permissions]
        end
    end

    %% Permission Assignments
    ADMIN --> SYS_CONFIG
    ADMIN --> USER_MGMT
    ADMIN --> SERVICE_CONFIG
    ADMIN --> SYSTEM_LOGS
    ADMIN --> API_ADMIN

    MODERATOR --> USER_MGMT
    MODERATOR --> MEDIA_REQUEST
    MODERATOR --> API_USER
    MODERATOR --> API_WRITE

    USER --> MEDIA_REQUEST
    USER --> MEDIA_DOWNLOAD
    USER --> PLAYLIST_MGMT
    USER --> LIBRARY_ACCESS
    USER --> API_USER
    USER --> API_READ

    GUEST --> LIBRARY_ACCESS
    GUEST --> API_READ

    %% Dynamic Permissions
    USER --> RESOURCE_OWNER
    MODERATOR --> TEAM_MEMBER
    ADMIN --> TIME_LIMITED

    %% Styling
    classDef adminRole fill:#ffebee,stroke:#d32f2f,stroke-width:3px
    classDef modRole fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef userRole fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef guestRole fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef sysPerms fill:#e1f5fe,stroke:#0277bd
    classDef mediaPerms fill:#e8f5e8,stroke:#4caf50
    classDef apiPerms fill:#fff3e0,stroke:#ff9800
    classDef dynamicPerms fill:#f3e5f5,stroke:#9c27b0

    class ADMIN adminRole
    class MODERATOR modRole
    class USER userRole
    class GUEST guestRole
    class SYS_CONFIG,USER_MGMT,SERVICE_CONFIG,SYSTEM_LOGS sysPerms
    class MEDIA_REQUEST,MEDIA_DOWNLOAD,PLAYLIST_MGMT,LIBRARY_ACCESS mediaPerms
    class API_ADMIN,API_USER,API_READ,API_WRITE apiPerms
    class RESOURCE_OWNER,TEAM_MEMBER,TIME_LIMITED dynamicPerms
```

## API Authentication Middleware

```mermaid
flowchart TD
    subgraph "API Request Flow"
        START([Incoming API Request])

        subgraph "Authentication Layer"
            CHECK_HEADERS{Check Auth Headers}
            EXTRACT_TOKEN[Extract Bearer Token]
            SESSION_COOKIE[Check Session Cookie]
            API_KEY[Check API Key Header]
        end

        subgraph "Token Validation"
            VALIDATE_JWT{Validate JWT Token}
            VERIFY_SESSION{Verify Session}
            CHECK_API_KEY{Validate API Key}
            DECODE_TOKEN[Decode & Verify Token]
        end

        subgraph "User Context"
            LOAD_USER[Load User from Database]
            CHECK_STATUS{User Active?}
            LOAD_ROLES[Load User Roles & Permissions]
            CREATE_CONTEXT[Create Request Context]
        end

        subgraph "Authorization"
            CHECK_PERMS{Check Permissions}
            RATE_LIMIT{Check Rate Limits}
            APPLY_CONTEXT[Apply User Context]
        end

        subgraph "Response"
            PROCEED[Proceed to Route Handler]
            UNAUTHORIZED[Return 401 Unauthorized]
            FORBIDDEN[Return 403 Forbidden]
            RATE_LIMITED[Return 429 Too Many Requests]
        end

        START --> CHECK_HEADERS

        CHECK_HEADERS -->|Bearer Token| EXTRACT_TOKEN
        CHECK_HEADERS -->|Session Cookie| SESSION_COOKIE
        CHECK_HEADERS -->|API Key| API_KEY
        CHECK_HEADERS -->|No Auth| UNAUTHORIZED

        EXTRACT_TOKEN --> VALIDATE_JWT
        SESSION_COOKIE --> VERIFY_SESSION
        API_KEY --> CHECK_API_KEY

        VALIDATE_JWT -->|Valid| DECODE_TOKEN
        VALIDATE_JWT -->|Invalid| UNAUTHORIZED
        VERIFY_SESSION -->|Valid| LOAD_USER
        VERIFY_SESSION -->|Invalid| UNAUTHORIZED
        CHECK_API_KEY -->|Valid| LOAD_USER
        CHECK_API_KEY -->|Invalid| UNAUTHORIZED

        DECODE_TOKEN --> LOAD_USER
        LOAD_USER --> CHECK_STATUS

        CHECK_STATUS -->|Active| LOAD_ROLES
        CHECK_STATUS -->|Inactive| FORBIDDEN

        LOAD_ROLES --> CREATE_CONTEXT
        CREATE_CONTEXT --> CHECK_PERMS

        CHECK_PERMS -->|Authorized| RATE_LIMIT
        CHECK_PERMS -->|Not Authorized| FORBIDDEN

        RATE_LIMIT -->|Within Limits| APPLY_CONTEXT
        RATE_LIMIT -->|Exceeded| RATE_LIMITED

        APPLY_CONTEXT --> PROCEED

        %% Styling
        classDef startEnd fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
        classDef process fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
        classDef decision fill:#fff3e0,stroke:#ff9800,stroke-width:2px
        classDef error fill:#ffebee,stroke:#d32f2f,stroke-width:2px
        classDef success fill:#e8f5e8,stroke:#4caf50,stroke-width:2px

        class START,PROCEED startEnd
        class EXTRACT_TOKEN,SESSION_COOKIE,API_KEY,DECODE_TOKEN,LOAD_USER,LOAD_ROLES,CREATE_CONTEXT,APPLY_CONTEXT process
        class CHECK_HEADERS,VALIDATE_JWT,VERIFY_SESSION,CHECK_API_KEY,CHECK_STATUS,CHECK_PERMS,RATE_LIMIT decision
        class UNAUTHORIZED,FORBIDDEN,RATE_LIMITED error
    end
```

## Security Implementation Details

### Token Security

- **JWT Tokens**: Short-lived access tokens (15 minutes)
- **Refresh Tokens**: Long-lived refresh tokens (7 days)
- **Token Rotation**: Automatic token refresh on API calls
- **Secure Storage**: HttpOnly cookies with SameSite=Strict

### Session Security

- **Redis Backing**: Fast session lookup and invalidation
- **Database Persistence**: Long-term session tracking
- **Device Fingerprinting**: Track user devices and locations
- **Concurrent Session Limits**: Configurable max sessions per user

### API Security

- **Rate Limiting**: Per-user and per-endpoint rate limits
- **CSRF Protection**: Double-submit cookie pattern
- **CORS Configuration**: Strict origin validation
- **Request Signing**: HMAC signature for sensitive operations

### Audit & Monitoring

- **Authentication Events**: All auth events logged
- **Failed Attempts**: Brute force detection
- **Session Analytics**: Login patterns and anomaly detection
- **Security Alerts**: Real-time security event notifications

This comprehensive authentication system ensures MediaNest maintains enterprise-level security while providing a smooth user experience for media management workflows.
