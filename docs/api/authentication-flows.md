# Authentication Flow Diagrams

MediaNest uses multiple authentication methods with detailed flows for different use cases.

## Plex OAuth Flow

The primary authentication method using Plex.tv accounts:

```mermaid
sequenceDiagram
    participant U as User Browser
    participant M as MediaNest Frontend
    participant A as MediaNest API
    participant P as Plex.tv API
    participant DB as Database

    Note over U,DB: Initial Authentication Request
    U->>M: Click "Login with Plex"
    M->>A: POST /auth/plex/pin
    A->>P: Create PIN (X-Plex-Client-Identifier)
    P-->>A: PIN ID, Code, Expires (XML)
    A-->>M: { id, code, qrUrl, expiresIn }
    M-->>U: Show PIN code + QR code

    Note over U,P: User Authorization on Plex.tv
    U->>P: Visit plex.tv/link + Enter PIN
    P-->>U: Authorization page
    U->>P: Authorize MediaNest app
    P-->>U: Authorization confirmed

    Note over M,DB: Polling for Authorization
    loop Every 5 seconds
        M->>A: GET /auth/plex/pin/:id/status
        A->>P: Check PIN status
        P-->>A: Authorization status
        A-->>M: { authorized: true/false }
        break when authorized = true
    end

    Note over M,DB: Complete Authentication
    M->>A: POST /auth/plex (pinId)
    A->>P: Get auth token for PIN
    P-->>A: Plex auth token
    A->>P: Get user profile (/users/account.xml)
    P-->>A: User details (XML)

    A->>DB: Find/Create user by plexId
    DB-->>A: User record
    A->>A: Generate JWT token
    A->>DB: Store session token
    DB-->>A: Session stored

    A-->>M: Set-Cookie: auth-token + user data
    M-->>U: Redirect to dashboard
```

## Admin Bootstrap Flow

First-time admin user creation:

```mermaid
sequenceDiagram
    participant U as Admin User
    participant M as MediaNest Frontend
    participant A as MediaNest API
    participant DB as Database

    Note over U,DB: Admin Bootstrap (First User)
    U->>M: Access /admin/setup
    M->>A: Check if first user
    A->>DB: SELECT COUNT(*) FROM users
    DB-->>A: count = 0
    A-->>M: { isFirstUser: true }

    M-->>U: Show admin setup form
    U->>M: Submit admin details
    M->>A: POST /auth/admin
    A->>A: Validate admin doesn't exist
    A->>A: Hash password (bcrypt)
    A->>DB: Create admin user
    DB-->>A: Admin user created

    A->>A: Generate JWT token
    A->>DB: Store session token
    DB-->>A: Session stored

    A-->>M: Set-Cookie: auth-token + admin data
    M-->>U: Redirect to admin dashboard
```

## Password Login Flow

For admin users with passwords:

```mermaid
sequenceDiagram
    participant U as Admin User
    participant M as MediaNest Frontend
    participant A as MediaNest API
    participant DB as Database

    Note over U,DB: Password Authentication
    U->>M: Enter email/password
    M->>A: POST /auth/login
    A->>DB: Find user by email
    DB-->>A: User record (with passwordHash)

    alt User has password
        A->>A: bcrypt.compare(password, hash)
        A-->>A: Password valid
        A->>DB: Update lastLoginAt
        DB-->>A: Updated

        A->>A: Generate JWT token
        A->>DB: Store session token
        DB-->>A: Session stored

        A-->>M: Set-Cookie: auth-token + user data
        M-->>U: Redirect to dashboard
    else User has no password
        A-->>M: { error: "NO_PASSWORD_SET" }
        M-->>U: "Please use Plex authentication"
    end
```

## Session Validation Flow

How JWT tokens are validated on protected endpoints:

```mermaid
sequenceDiagram
    participant C as Client
    participant M as Auth Middleware
    participant A as API Endpoint
    participant DB as Database
    participant J as JWT Service

    C->>M: Request with Cookie/Header
    M->>M: Extract JWT token

    alt Token exists
        M->>J: Verify JWT signature
        J-->>M: Token valid + payload
        M->>DB: Check session exists
        DB-->>M: Session valid
        M->>DB: Get user details
        DB-->>M: User data
        M->>A: req.user = userData
        A-->>C: Protected resource
    else Token missing/invalid
        M-->>C: 401 Unauthorized
    end
```

## Multi-Device Session Management

How sessions are handled across devices:

```mermaid
graph TD
    A[User Login] --> B{Remember Me?}
    B -->|Yes| C[30-day token]
    B -->|No| D[24-hour token]

    C --> E[Store in session_tokens table]
    D --> E

    E --> F[Multiple active sessions]
    F --> G{Logout action}

    G -->|Single device| H[Delete current session]
    G -->|All devices| I[Delete all user sessions]

    H --> J[Token invalidated]
    I --> K[All tokens invalidated]

    style C fill:#e1f5fe
    style D fill:#fff3e0
    style I fill:#ffebee
```

## Error Handling Flows

Authentication error scenarios:

```mermaid
flowchart TD
    A[Authentication Request] --> B{Request Type}

    B -->|Plex PIN| C{Plex Service}
    C -->|Available| D[Generate PIN]
    C -->|Unavailable| E[502 Service Unavailable]

    B -->|PIN Verify| F{PIN Status}
    F -->|Not Authorized| G[400 PIN Not Authorized]
    F -->|Expired| H[400 PIN Expired]
    F -->|Authorized| I[Complete Auth]

    B -->|Password Login| J{User Exists}
    J -->|No| K[401 Invalid Credentials]
    J -->|Yes| L{Has Password}
    L -->|No| M[400 No Password Set]
    L -->|Yes| N{Password Valid}
    N -->|No| O[401 Invalid Credentials]
    N -->|Yes| P[Login Success]

    I --> Q{User Creation}
    Q -->|Success| R[Auth Success]
    Q -->|DB Error| S[503 Database Error]

    style E fill:#ffcdd2
    style G fill:#ffcdd2
    style H fill:#ffcdd2
    style K fill:#ffcdd2
    style M fill:#ffe0b2
    style O fill:#ffcdd2
    style S fill:#ffcdd2
    style R fill:#c8e6c9
    style P fill:#c8e6c9
    style D fill:#c8e6c9
```

## Rate Limiting Flow

How authentication rate limiting works:

```mermaid
sequenceDiagram
    participant C as Client
    participant R as Rate Limiter
    participant A as Auth Endpoint
    participant Cache as Redis Cache

    C->>R: Authentication request
    R->>Cache: Check rate limit key
    Cache-->>R: Current count + TTL

    alt Under limit
        R->>Cache: Increment counter
        Cache-->>R: Updated count
        R->>A: Process request
        A-->>C: Success/Error response
        Note over C: X-RateLimit-* headers
    else Over limit
        R-->>C: 429 Too Many Requests
        Note over C: Retry-After header
    end
```

## Session Cleanup Flow

Automatic session management:

```mermaid
graph LR
    A[Cron Job] --> B[Check Expired Sessions]
    B --> C[Delete Expired Tokens]
    C --> D[Update User Last Seen]

    E[User Logout] --> F{All Sessions?}
    F -->|Yes| G[Delete All User Sessions]
    F -->|No| H[Delete Current Session]

    I[Password Change] --> J[Invalidate All Sessions]
    J --> K[Force Re-authentication]

    style A fill:#e3f2fd
    style E fill:#fff3e0
    style I fill:#ffebee
```

## Security Considerations

### Token Security

- JWT tokens stored in HTTP-only cookies
- Secure flag set in production
- SameSite protection against CSRF
- Configurable expiration times

### Session Management

- Database-backed session validation
- Immediate invalidation on logout
- Cleanup of expired sessions
- Multi-device session tracking

### Rate Limiting

- Per-IP limits on auth endpoints
- Exponential backoff on failures
- Distributed rate limiting via Redis
- Bypass for trusted sources

### Audit Logging

- All auth events logged
- Failed login attempt tracking
- Session creation/destruction events
- Admin action audit trail
