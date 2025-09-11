# MediaNest System Architecture

**Version:** 1.1  
**Date:** January 2025  
**Status:** Active Implementation

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Architecture Principles](#3-architecture-principles)
4. [Component Architecture](#4-component-architecture)
5. [Data Architecture](#5-data-architecture)
6. [API Architecture](#6-api-architecture)
7. [Security Architecture](#7-security-architecture)
8. [Integration Architecture](#8-integration-architecture)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Performance & Scalability](#10-performance--scalability)
11. [Monitoring & Observability](#11-monitoring--observability)
12. [Disaster Recovery](#12-disaster-recovery)

## 1. Executive Summary

MediaNest is a unified web portal that consolidates multiple media management services into a single authenticated interface. The architecture follows a monolithic design pattern optimized for 10-20 concurrent users, leveraging modern web technologies and containerization for easy deployment and maintenance.

### Key Architectural Decisions

- **Monolithic Architecture**: Simplified deployment and maintenance for small user base
- **Container-First Design**: Docker Compose V2 for consistent environments
- **Real-time Communication**: Socket.io for live status updates
- **Secure by Default**: Plex OAuth, rate limiting, and AES-256-GCM encrypted storage
- **Service Resilience**: Circuit breakers with graceful degradation when external services unavailable

### Implementation Status

- **Phase 1 (Core Infrastructure)**: ✅ Complete
- **Phase 2 (External Service Integration)**: ✅ Complete
- **Phase 3 (Dashboard & Media Search UI)**: ✅ Complete
- **Phase 4 (YouTube Integration)**: ⏳ In Progress (Frontend complete, backend pending)
- **Phase 5 (Advanced Features)**: 📋 Planned

## 2. System Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MediaNest System                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     │
│  │   Browser   │     │   Browser   │     │   Browser   │     │
│  │  (Desktop)  │     │  (Mobile)   │     │   (Admin)   │     │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘     │
│         │                    │                    │            │
│         └────────────────────┴────────────────────┘            │
│                              │                                 │
│                    ┌─────────▼─────────┐                      │
│                    │   Nginx Proxy     │                      │
│                    │   (SSL/TLS)       │                      │
│                    └─────────┬─────────┘                      │
│                              │                                 │
│         ┌────────────────────┴────────────────────┐           │
│         │          MediaNest Application          │           │
│         ├─────────────────────────────────────────┤           │
│         │  ┌──────────────┐  ┌────────────────┐  │           │
│         │  │   Next.js    │  │  Express API   │  │           │
│         │  │  (Frontend)  │  │   (Backend)    │  │           │
│         │  └──────┬───────┘  └───────┬────────┘  │           │
│         │         │                   │           │           │
│         │    ┌────▼───────────────────▼────┐     │           │
│         │    │      Shared Services        │     │           │
│         │    │  - Auth (NextAuth.js)       │     │           │
│         │    │  - WebSocket (Socket.io)    │     │           │
│         │    │  - Queue (BullMQ)           │     │           │
│         │    └────────────┬────────────────┘     │           │
│         └─────────────────┼──────────────────────┘           │
│                           │                                   │
│         ┌─────────────────┴──────────────────┐               │
│         │          Data Layer                │               │
│         ├────────────────────────────────────┤               │
│         │  ┌────────────┐  ┌──────────────┐ │               │
│         │  │ PostgreSQL │  │    Redis     │ │               │
│         │  │ (Primary)  │  │ (Cache/Queue)│ │               │
│         │  └────────────┘  └──────────────┘ │               │
│         └────────────────────────────────────┘               │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                    External Services                          │
├───────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   Plex   │  │Overseerr │  │  Uptime  │  │ YouTube  │    │
│  │   API    │  │   API    │  │   Kuma   │  │  (yt-dlp)│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 Request Flow

1. User accesses MediaNest through browser
2. Nginx handles SSL termination and proxies to application
3. Next.js serves initial page and handles client-side routing
4. API requests authenticated via JWT tokens
5. Backend processes requests and integrates with external services
6. Real-time updates delivered via WebSocket connections
7. Background jobs handled by BullMQ processor

## 3. Architecture Principles

### 3.1 Core Principles

1. **Simplicity First**: Optimize for maintainability over complexity
2. **Security by Design**: Authenticate everything, encrypt sensitive data
3. **Graceful Degradation**: Continue operating when external services fail
4. **Performance Conscious**: Cache aggressively, minimize external calls
5. **Developer Friendly**: Clear separation of concerns, comprehensive logging

### 3.2 Design Patterns

- **Repository Pattern**: Abstract data access logic
- **Service Layer**: Business logic separation
- **Dependency Injection**: Loose coupling between components
- **Event-Driven**: WebSocket events for real-time updates
- **Queue-Based Processing**: Asynchronous job handling

## 4. Component Architecture

### 4.1 Frontend Components (Next.js 14 App Router)

```
frontend/src/
├── app/                # Next.js 14 App Directory
│   ├── (auth)/        # Authenticated routes group
│   │   └── dashboard/ # Dashboard page
│   ├── api/           # API route handlers
│   │   └── auth/      # NextAuth.js endpoints
│   ├── auth/          # Auth pages (signin, change-password)
│   ├── media/         # Media browsing page
│   ├── layout.tsx     # Root layout with providers
│   └── page.tsx       # Home page
├── components/
│   ├── dashboard/     # Dashboard components
│   │   ├── cards/     # Service-specific cards (Plex, Overseerr, Uptime Kuma)
│   │   ├── ConnectionStatus.tsx
│   │   ├── ServiceCard.tsx
│   │   ├── StatusIndicator.tsx
│   │   └── QuickActions.tsx
│   ├── media/         # Media components
│   │   ├── MediaGrid.tsx
│   │   ├── MediaCard.tsx
│   │   ├── SearchInput.tsx
│   │   ├── SearchFilters.tsx
│   │   └── RequestButton.tsx
│   ├── providers/     # React context providers
│   └── ui/            # Reusable UI components (shadcn/ui)
├── hooks/             # Custom React hooks
│   ├── useWebSocket.ts
│   ├── useRealtimeStatus.ts
│   ├── useServiceStatus.ts
│   └── useMediaSearch.ts
├── lib/               # Utility functions and API clients
│   ├── api/           # API client functions
│   ├── auth/          # NextAuth configuration
│   ├── db/            # Prisma client
│   ├── queues/        # BullMQ queue configuration
│   ├── redis/         # Redis clients and utilities
│   └── socket.ts      # Socket.io client
└── types/             # TypeScript type definitions
```

### 4.2 Backend Components

```
backend/src/
├── auth/              # Authentication utilities
├── config/            # Configuration files
│   ├── database.ts
│   ├── redis.ts
│   └── queues.ts
├── controllers/        # Request handlers
│   ├── auth.controller.ts
│   ├── dashboard.controller.ts
│   ├── media.controller.ts
│   ├── plex.controller.ts
│   └── youtube.controller.ts
├── db/                # Database utilities
├── integrations/      # External service clients
│   ├── plex/          # Plex API client with circuit breaker
│   ├── overseerr/     # Overseerr API client
│   └── uptime-kuma/   # Uptime Kuma monitoring client
├── jobs/              # Background job processors (minimal)
├── lib/               # Library functions
├── middleware/         # Express middleware
│   ├── auth.ts        # JWT authentication
│   ├── error.ts       # Global error handler
│   ├── logging.ts     # Winston request logging
│   ├── rate-limit.ts  # Redis-based rate limiting
│   └── validate.ts    # Zod schema validation
├── repositories/       # Data access layer
│   ├── base.repository.ts
│   ├── user.repository.ts
│   ├── media-request.repository.ts
│   ├── service-status.repository.ts
│   └── youtube-download.repository.ts
├── routes/            # Route definitions
├── schemas/           # Schema definitions
├── scripts/           # Utility scripts
├── security/          # Security utilities
├── services/           # Business logic layer
│   ├── encryption.service.ts
│   ├── jwt.service.ts
│   ├── overseerr.service.ts
│   ├── plex.service.ts
│   └── status.service.ts
├── socket/            # WebSocket handlers
│   ├── handlers/      # Event handlers
│   └── middleware.ts  # Socket.io authentication
├── __tests__/         # Test files
├── types/             # TypeScript type definitions
├── utils/             # Helper functions
└── validations/       # Zod validation schemas
```

### 4.3 Component Interactions

```mermaid
graph LR
    A[Client] --> B[Next.js Frontend]
    B --> C[API Gateway]
    C --> D[Auth Middleware]
    D --> E[Route Controllers]
    E --> F[Service Layer]
    F --> G[Repository Layer]
    F --> H[Integration Layer]
    G --> I[PostgreSQL]
    G --> J[Redis]
    H --> K[External APIs]
```

## 5. Data Architecture

### 5.1 Database Schema

```sql
-- Users table (from Plex OAuth)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plex_id VARCHAR(255) UNIQUE NOT NULL,
    plex_username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    plex_token TEXT, -- encrypted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active'
);

-- Media requests
CREATE TABLE media_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(500) NOT NULL,
    media_type VARCHAR(50) NOT NULL,
    tmdb_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    overseerr_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- YouTube downloads (user-isolated)
CREATE TABLE youtube_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    playlist_url TEXT NOT NULL,
    playlist_title VARCHAR(500),
    status VARCHAR(50) DEFAULT 'queued',
    file_paths JSONB,
    plex_collection_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    -- Ensure users can only see their own downloads
    CONSTRAINT youtube_downloads_user_isolation
        CHECK (user_id IS NOT NULL)
);

-- Create index for user-specific queries
CREATE INDEX idx_youtube_downloads_user ON youtube_downloads(user_id);

-- Service status cache
CREATE TABLE service_status (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50),
    response_time_ms INTEGER,
    last_check_at TIMESTAMP,
    uptime_percentage DECIMAL(5,2)
);

-- Rate limiting tracking
CREATE TABLE rate_limits (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    endpoint VARCHAR(255),
    request_count INTEGER DEFAULT 0,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service configuration (admin-managed)
CREATE TABLE service_config (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) UNIQUE NOT NULL,
    service_url TEXT NOT NULL,
    api_key TEXT, -- encrypted
    enabled BOOLEAN DEFAULT true,
    config_data JSONB, -- additional service-specific config
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- Session tokens for "remember me" functionality
CREATE TABLE session_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
);
```

### 5.2 Redis Data Structures

```
# Session storage
session:{sessionId} -> {userId, role, expiresAt}

# Rate limiting (atomic with Lua scripts)
rate:api:{userId} -> counter (TTL: 60s)
rate:youtube:{userId} -> counter (TTL: 3600s)
rate:request:{userId} -> counter (TTL: 3600s)

# Job queues (BullMQ)
bull:youtube:waiting -> [job1, job2, ...]
bull:youtube:active -> {jobId: data}
bull:youtube:completed -> {jobId: result}
bull:youtube:stalled -> {jobId: data}

# Service status cache
status:{serviceName} -> {status, lastCheck, uptime, responseTime}

# Remember me tokens (one-time use)
remember:{tokenHash} -> {userId, createdAt, deviceFingerprint}
```

#### Rate Limiting Lua Script

```lua
-- Atomic rate limit check and increment
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current = redis.call('GET', key)

if current and tonumber(current) >= limit then
  return redis.call('TTL', key) -- Return seconds until reset
else
  current = redis.call('INCR', key)
  if current == 1 then
    redis.call('EXPIRE', key, window)
  end
  return 0 -- Success
end
```

## 6. API Architecture

### 6.1 RESTful Endpoints

```
# Authentication
POST   /api/auth/plex        # Plex OAuth callback
POST   /api/auth/admin       # Admin bootstrap login
POST   /api/auth/logout      # Logout
GET    /api/auth/session     # Get current session

# Dashboard
GET    /api/dashboard/status # Get all service statuses
WS     /ws/status           # WebSocket for real-time status

# Media Requests
GET    /api/media/search    # Search for media
POST   /api/media/request   # Submit media request
GET    /api/media/requests  # Get user's requests
GET    /api/media/requests/:id # Get request details

# Plex Integration
GET    /api/plex/libraries  # Get Plex libraries
GET    /api/plex/library/:id/items # Browse library
GET    /api/plex/collections # Get collections

# YouTube Downloads
POST   /api/youtube/download # Submit playlist for download
GET    /api/youtube/downloads # Get user's downloads (filtered by user)
DELETE /api/youtube/downloads/:id # Delete own download only
WS     /ws/youtube/:id      # WebSocket for download progress

# Admin (role-protected)
GET    /api/admin/users     # List all users
PUT    /api/admin/users/:id # Update user (role, status)
DELETE /api/admin/users/:id # Delete user

# Service Configuration (admin only)
GET    /api/admin/services  # Get all service configs
PUT    /api/admin/services/:name # Update service config
POST   /api/admin/services/test # Test service connection

# System Configuration (admin only)
GET    /api/admin/config    # Get system settings
PUT    /api/admin/config    # Update system settings
```

### 6.2 API Response Format

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z",
    "version": "1.0"
  }
}

// Error response
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "limit": 100,
      "window": "60s",
      "retryAfter": 45
    }
  }
}
```

### 6.3 WebSocket Events

```typescript
// Implemented WebSocket events
interface WebSocketEvents {
  // Service status updates
  'service:status': {
    service: string;
    status: 'online' | 'offline' | 'degraded';
    responseTime?: number;
    error?: string;
  };

  // Real-time notifications
  notification: {
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    timestamp: string;
  };

  // Connection events
  connect: void;
  disconnect: void;
  error: { message: string };
}
```

### 6.4 Error Handling Best Practices

For comprehensive error handling implementation, see `/docs/ERROR_HANDLING_LOGGING_STRATEGY.md`.

#### Key Principles

- **User-friendly error messages**: Clear, actionable feedback without technical jargon
- **Correlation ID tracking**: Trace requests across services and logs
- **Circuit breakers**: Prevent cascading failures from external services
- **Graceful degradation**: Maintain core functionality when services fail

#### Error Response Strategy

1. **Client Errors (4xx)**: Clear, actionable messages with error codes
2. **Server Errors (5xx)**: Generic user messages, detailed internal logging
3. **External Service Errors**: Circuit breakers with fallback responses

## 7. Security Architecture

### 7.1 Authentication Flow

**Important Note**: Plex uses a PIN-based OAuth flow rather than standard redirect OAuth. Users must visit plex.tv/link and enter a 4-character code.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Plex
    participant Database

    User->>Frontend: Click "Login with Plex"
    Frontend->>Backend: Request PIN
    Backend->>Plex: POST /pins (generate PIN)
    Plex->>Backend: Return PIN + ID
    Backend->>Frontend: Display PIN
    Frontend->>User: Show PIN & plex.tv/link
    User->>Plex: Enter PIN at plex.tv/link
    loop Poll for authorization
        Backend->>Plex: GET /pins/{id}
        Plex->>Backend: Status (waiting/authorized)
    end
    Plex->>Backend: Return auth token
    Backend->>Database: Store encrypted token
    Backend->>Frontend: Set session + remember token
    Frontend->>User: Redirect to dashboard
```

#### Remember Me Functionality

1. **Token Generation**

   - Generate secure random token on login
   - Hash token before storing in database
   - Set HTTP-only cookie with 90-day expiry

2. **Token Validation**

   - Check remember token if session expired
   - Validate token hash and expiry
   - Regenerate session with fresh expiry
   - Update last_used_at timestamp

3. **Security Measures**
   - Tokens are one-time use (regenerated on each use)
   - Automatic cleanup of expired tokens
   - Revoke all tokens on password change

### 7.2 Security Layers

1. **Network Security**

   - SSL/TLS encryption (Let's Encrypt)
   - Nginx rate limiting
   - CORS configuration

2. **Application Security**

   - JWT token validation
   - CSRF protection
   - Input sanitization
   - SQL injection prevention (Prisma ORM)

3. **Data Security**
   - Encrypted Plex tokens (AES-256)
   - Bcrypt for admin password
   - Secure session management
   - No sensitive data in logs

### 7.3 Role-Based Access Control

#### User Roles

1. **Admin Role**

   - Full system access
   - Service configuration management
   - User management capabilities
   - System settings control
   - First user (admin/admin) automatically gets admin role

2. **User Role**
   - Access to personal dashboard
   - Submit media requests
   - Manage own YouTube downloads
   - Cannot see other users' data
   - Cannot access admin sections

#### Access Control Implementation

```typescript
// Middleware for role checking
export const requireAdmin = async (req, res, next) => {
  const session = await getSession(req);
  if (session?.user?.role !== 'admin') {
    return res.status(403).json({
      error: USER_ERRORS.PERMISSION_DENIED,
    });
  }
  next();
};

// API route protection
router.get('/api/admin/*', requireAdmin);
router.get('/api/youtube/downloads', async (req, res) => {
  // Automatically filter by user ID
  const downloads = await getDownloads({
    userId: req.session.user.id,
  });
  res.json(downloads);
});
```

## 8. Integration Architecture

### 8.1 External Service Integration

```
┌─────────────────────────────────────────────────────┐
│                 Integration Layer                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────┐  Circuit Breaker Pattern         │
│  │   Service   │  ┌──────────────────────┐        │
│  │   Client    ├──┤  Retry with Backoff  │        │
│  └──────┬──────┘  └──────────────────────┘        │
│         │                                          │
│         ├── Plex Client                           │
│         │   - OAuth flow                          │
│         │   - Library browsing                    │
│         │   - Collection management               │
│         │                                          │
│         ├── Overseerr Client                      │
│         │   - Media search                        │
│         │   - Request submission                  │
│         │   - Status webhooks                     │
│         │                                          │
│         ├── Uptime Kuma Client                    │
│         │   - Socket.io connection                │
│         │   - Status polling fallback             │
│         │                                          │
│         └── YouTube Downloader                    │
│             - yt-dlp wrapper                      │
│             - Progress monitoring                 │
│             - File management                     │
└─────────────────────────────────────────────────────┘
```

### 8.2 Service Resilience

#### Circuit Breaker Implementation

All external service clients implement circuit breaker pattern:

````typescript
// Example from plex.client.ts
class PlexClient extends ServiceClient {
  constructor(config: PlexConfig) {
    super({
      serviceName: 'plex',
      baseURL: config.url,
      timeout: 10000,
      circuitBreaker: {
        errorThresholdPercentage: 50,
        resetTimeout: 30000
      }
    });
  }

  // Automatic retry with exponential backoff
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    return retry(operation, {
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 10000
    });
  }
}

#### Connection Pooling for HTTP
```javascript
// HTTP Agent configuration for connection reuse
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10, // per host
  timeout: 60000
});

// Apply to all external API calls
const axiosConfig = {
  httpsAgent,
  timeout: 10000,
  validateStatus: (status) => status < 500
};
````

- **Retry Logic**: Exponential backoff with jitter (1s, 2s, 4s + random)
- **Fallback Behavior**: Return cached data or degraded functionality
- **Health Checks**: Active monitoring every 30s with 3s timeout

## 9. Deployment Architecture

### 9.1 Docker Compose Configuration

```yaml
# docker-compose.yml (Production)
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    ports:
      - '443:443'
      - '80:80'
    depends_on:
      - app

  app:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/medianest?connection_limit=20&pool_timeout=30
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./youtube:/app/youtube:rw
      - uploads:/app/uploads:rw
    secrets:
      - encryption_key
      - nextauth_secret
    user: '1000:1000' # Run as non-root
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=medianest
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
      - POSTGRES_INITDB_ARGS=--encoding=UTF-8
    volumes:
      - postgres_data:/var/lib/postgresql/data
    secrets:
      - db_password

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
  uploads:

secrets:
  db_password:
    file: ./secrets/db_password
  encryption_key:
    file: ./secrets/encryption_key
  nextauth_secret:
    file: ./secrets/nextauth_secret
# Additional environments:
# - docker-compose.dev.yml: Development with hot reload
# - docker-compose.test.yml: Test environment (root and backend specific)
```

#### Frontend Custom Server

The frontend uses a custom server.js to support WebSocket connections with Next.js:

```javascript
// frontend/server.js
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Custom server enables Socket.io integration with Next.js
// Required for real-time status updates and notifications
// Handles both development and production modes
```

#### Socket.io Implementation

WebSocket support is implemented in the Express backend server:

```typescript
// backend/src/socket/index.ts
export const initializeSocket = (server: Server) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  // JWT authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    // Join user-specific room for targeted updates
    socket.on('join:user', (userId: string) => {
      socket.join(`user:${userId}`);
    });

    // Subscribe to service status updates
    socket.on('subscribe:status', () => {
      socket.join('status-updates');
    });

    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });
    });
  });

  return io;
};
```

### 9.2 Environment Configuration

```bash
# .env file structure
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/medianest

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
NEXTAUTH_URL=https://medianest.example.com
NEXTAUTH_SECRET=<generated-secret>
PLEX_CLIENT_ID=<plex-client-id>
PLEX_CLIENT_SECRET=<plex-client-secret>

# YouTube Downloads
YOUTUBE_DOWNLOAD_PATH=/app/youtube
YOUTUBE_RATE_LIMIT=5

# Admin Bootstrap (first run only)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin

# Encryption key for service secrets
ENCRYPTION_KEY=<generated-32-byte-key>
```

### 9.3 Service Configuration Management

External service configurations are managed through the admin UI after initial deployment:

1. **Initial Setup**

   - Admin logs in with bootstrap credentials
   - Navigates to Admin → Service Configuration
   - Configures each service URL and API key

2. **Service Configuration UI**

   ```
   ┌─────────────────────────────────────┐
   │     Service Configuration Panel      │
   ├─────────────────────────────────────┤
   │ Plex Server                         │
   │ URL: [___________________]          │
   │ Status: ● Connected                 │
   │                                     │
   │ Overseerr                           │
   │ URL: [___________________]          │
   │ API Key: [****************]        │
   │ Status: ● Connected                 │
   │                                     │
   │ Uptime Kuma                         │
   │ URL: [___________________]          │
   │ Token: [****************]           │
   │ Status: ○ Disconnected              │
   │                                     │
   │ [Test All] [Save Changes]           │
   └─────────────────────────────────────┘
   ```

3. **Configuration Storage**
   - Service URLs and keys stored encrypted in database
   - Configuration changes logged with admin user ID
   - Service health checked on save

### 9.4 Encryption Implementation

```javascript
// lib/crypto.js
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const keyDerivation = (password) => crypto.scryptSync(password, 'salt', 32);

export function encrypt(text) {
  const key = keyDerivation(process.env.ENCRYPTION_KEY);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export function decrypt(data) {
  const key = keyDerivation(process.env.ENCRYPTION_KEY);
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(data.iv, 'hex'));

  decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### 9.5 BullMQ Configuration

````typescript
// backend/src/config/queues.ts
import { Queue, QueueOptions } from 'bullmq';

const defaultQueueOptions: QueueOptions = {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000
    },
    removeOnComplete: {
      age: 3600, // 1 hour
      count: 100
    },
    removeOnFail: {
      age: 86400 // 24 hours
    }
  }
};

// YouTube download queue configuration
export const youtubeDownloadQueue = new Queue('youtube-downloads', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    // Rate limit: 5 downloads per hour per user
    rateLimiterKey: 'youtube-rate-limiter'
  }
});

// Note: Worker implementation pending for Phase 4

## 10. Performance & Scalability

### 10.1 Performance Optimizations

1. **Frontend**
   - Static generation for documentation pages
   - Image lazy loading
   - Code splitting and dynamic imports
   - Service worker for offline support

2. **Backend**
   - Database query optimization (indexes)
   - Redis caching for frequent queries
   - Connection pooling
   - Gzip compression

3. **Caching Strategy**
   - CDN for static assets (1 year)
   - API responses (5 minutes)
   - Service status (60 seconds)
   - Plex library data (10 minutes)

### 10.2 Scalability Considerations

While designed for 10-20 users, the architecture supports growth:

1. **Horizontal Scaling**
   - Stateless application design
   - Redis for shared state
   - Load balancer ready

2. **Database Scaling**
   - Read replicas for heavy queries
   - Partitioning for large tables
   - Archive old data

3. **Future Microservices Migration**
   - YouTube downloader as separate service
   - Status monitoring as separate service
   - API gateway for service mesh

## 11. Monitoring & Observability

### 11.1 Logging Strategy

For detailed logging implementation and configuration, see `/docs/ERROR_HANDLING_LOGGING_STRATEGY.md`.

#### Key Components
- **Winston logger**: Multiple transports (Console, File, DailyRotate)
- **Structured JSON logging**: Machine-parsable format for analysis
- **Correlation ID propagation**: Track requests across services
- **Log retention**: 30-day retention with automated cleanup

#### Log Levels
- ERROR: System errors, failed integrations
- WARN: Rate limit violations, service degradation
- INFO: User actions, successful operations
- DEBUG: Detailed execution flow (dev only)

### 11.2 Metrics & Monitoring

1. **Application Metrics**
   - Request rate and latency
   - Error rate by endpoint
   - Active users and sessions
   - Queue depth and processing time

2. **Infrastructure Metrics**
   - CPU and memory usage
   - Disk space (YouTube downloads)
   - Network throughput
   - Database connections

3. **Business Metrics**
   - Media requests per day
   - YouTube downloads per user
   - Service availability percentage
   - User engagement metrics

## 12. Disaster Recovery

### 12.1 Backup Strategy

1. **Database Backups**
   - Daily automated backups
   - 30-day retention
   - Point-in-time recovery

2. **File Backups**
   - YouTube downloads (optional)
   - Configuration files
   - SSL certificates

3. **Recovery Procedures**
   - RTO: 4 hours
   - RPO: 24 hours
   - Documented restore process

### 12.2 High Availability

While not required for current scale:

1. **Future HA Options**
   - Database replication
   - Redis Sentinel
   - Multiple app instances
   - Geographic redundancy

---

## 13. Critical Implementation Considerations

Based on architectural research, the following considerations are critical for successful implementation:

### 13.1 Authentication Complexity
- **Plex OAuth PIN Flow**: Unlike standard OAuth, Plex requires users to visit plex.tv/link and enter a PIN
- **Polling Required**: Backend must poll Plex API for authorization status
- **Token Storage**: Plex tokens don't expire but can be revoked - implement validation checks

### 13.2 WebSocket Limitations
- **No Serverless Support**: Socket.io requires persistent connections - deploy to traditional servers
- **Custom Server Required**: Next.js needs custom server setup for WebSocket support
- **Authentication Challenge**: JWT must be passed during handshake, not in cookies

### 13.3 Database Optimization
- **Connection Pooling**: Set `connection_limit=20` for 10-20 users
- **PgBouncer Option**: Consider external pooler if scaling beyond initial user base
- **Query Performance**: Use Prisma's `select` and `include` to minimize data transfer

### 13.4 File System Security
- **User Isolation**: Enforce at application level, not filesystem level
- **Directory Structure**: `/app/uploads/{userId}/` with 700 permissions
- **Docker User**: Run as non-root (1000:1000) with minimal capabilities

### 13.5 External Service Integration
- **Circuit Breakers**: Essential for all external APIs to prevent cascading failures
- **Connection Pooling**: Use HTTP agents with `keepAlive: true` and `maxSockets: 10`
- **Graceful Degradation**: Cache last known good states for service outages

### 13.6 Performance Bottlenecks
- **Redis Lua Scripts**: Required for atomic rate limiting operations
- **YouTube Downloads**: Limit concurrent downloads to prevent resource exhaustion
- **WebSocket Scaling**: Consider Redis adapter for multi-instance deployments

## Appendices

### A. Technology Versions

#### Frontend (package.json versions)
- Node.js: 20.x LTS
- Next.js: 14.2.30
- React: 18.x
- TypeScript: 5.x
- Prisma Client: 6.11.1
- Socket.io Client: 4.7.5
- NextAuth.js: 4.24.7
- Tailwind CSS: 3.4.1
- Vitest: 1.6.1
- Zod: 3.24.1
- BullMQ: 5.1.2

#### Backend (package.json versions)
- Node.js: 20.x LTS
- Express: 4.18.2
- TypeScript: 5.3.3
- Prisma: 5.18.0
- Socket.io: 4.6.1
- BullMQ: 5.1.2
- Winston: 3.11.0
- Zod: 3.22.4
- Redis Client: 4.6.12
- bcrypt: 5.1.1
- jsonwebtoken: 9.0.2

#### Infrastructure
- PostgreSQL: 15.x
- Redis: 7.x
- Docker: 24.x with Compose V2
- Nginx: 1.25.x
- yt-dlp: Latest version (for future YouTube integration)

### B. Development Setup

#### Quick Start
```bash
# Clone and install
git clone https://github.com/yourusername/medianest.git
cd medianest
npm install

# Generate security keys
npm run generate-secrets

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Database setup
npm run db:generate
npm run db:migrate

# Start development servers
npm run dev  # Starts both frontend (3000) and backend (4000)
````

#### Testing

```bash
# Run all tests across workspaces
npm test

# Backend tests with test database
cd backend && ./run-tests.sh

# Frontend tests
cd frontend && npm test

# Vitest UI for debugging
cd backend && npm run test:ui
cd frontend && npm run test:ui
```

See `/docs/DEVELOPMENT.md` for detailed setup instructions.

### C. API Documentation

See `/docs/API.md` for detailed API specifications.

### D. Implementation Strategies

- `/docs/ERROR_HANDLING_LOGGING_STRATEGY.md` - Error handling and logging implementation
- `/docs/future/SECURITY_STRATEGY.md` - Security implementation details (coming soon)
- `/docs/future/PERFORMANCE_STRATEGY.md` - Performance optimization guide (coming soon)

### E. Security Checklist

- [x] All containers run as non-root users (1000:1000)
- [x] Secrets stored in environment variables (Docker secrets for production)
- [x] API keys encrypted with AES-256-GCM before database storage
- [x] Rate limiting implemented with Redis Lua scripts
- [x] Circuit breakers configured for all external services
- [x] Session tokens with secure httpOnly cookies
- [x] WebSocket connections authenticated with JWT
- [ ] File uploads isolated by user ID (pending YouTube implementation)
- [x] HTTPS configuration ready (Nginx)
- [x] Input validation on all endpoints with Zod

### F. Current Implementation Gaps

1. **YouTube Download Feature** (Phase 4)

   - ✅ Database schema ready
   - ✅ API routes registered
   - ✅ Queue configuration exists
   - ✅ Frontend components fully implemented
   - ❌ Backend controller implementation
   - ❌ Worker implementation
   - ❌ yt-dlp integration

2. **Admin UI** (Phase 5)

   - API endpoints exist
   - Missing: Frontend admin components
   - Missing: Service configuration UI

3. **Advanced Monitoring**

   - Basic metrics collection implemented
   - Missing: Prometheus integration
   - Missing: Grafana dashboards

4. **Documentation**
   - Architecture documentation current
   - Missing: API documentation
   - Missing: User documentation
