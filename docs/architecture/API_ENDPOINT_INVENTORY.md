# MediaNest API Endpoint Complete Inventory

**Generated:** 2025-09-09  
**API Version:** v1  
**Base URL:** `/api/v1`  
**Authentication:** JWT Bearer Token (except public endpoints)

## API Architecture Overview

MediaNest implements a **RESTful API architecture** with the following characteristics:
- **Versioned APIs** (`/api/v1/`) for backward compatibility
- **JWT Authentication** with token rotation
- **Role-based Authorization** (USER, ADMIN)
- **Rate Limiting** at multiple levels
- **Comprehensive Error Handling** with correlation IDs
- **Real-time Updates** via WebSocket integration

## Authentication System

### Authentication Flow
```
1. Plex OAuth PIN Generation → 2. User Authorizes at plex.tv/link → 
3. Backend Polls for Authorization → 4. JWT + Remember Token Issued →
5. Token Rotation on Usage → 6. Secure Session Management
```

### Token Types
- **JWT Access Token**: Short-lived (1 hour), auto-rotating
- **Remember Token**: Long-lived (90 days), HTTP-only cookie
- **CSRF Token**: Request validation token

---

## Public Endpoints (No Authentication Required)

### Health & System Status

#### `GET /health`
**Purpose:** Basic system health check for load balancers  
**Response Time:** < 50ms  
**Cache:** No caching

```json
// Success Response
{
  "status": "ok",
  "timestamp": "2025-09-09T15:30:00.000Z"
}
```

#### `GET /metrics`
**Purpose:** Prometheus metrics (protected in production)  
**Authentication:** Bearer token in production  
**Content-Type:** `text/plain; charset=utf-8`

```
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/v1/dashboard",status="200"} 1234
# TYPE process_cpu_usage gauge  
process_cpu_usage 0.45
```

#### `GET /api/v1/health`
**Purpose:** Comprehensive system health with dependencies  
**Cache:** 30 seconds

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-09-09T15:30:00.000Z",
    "version": "2.0.0",
    "uptime": 86400,
    "dependencies": {
      "database": {
        "status": "connected",
        "responseTime": 12
      },
      "redis": {
        "status": "connected", 
        "responseTime": 3
      },
      "externalServices": {
        "plex": "healthy",
        "overseerr": "degraded",
        "uptimeKuma": "healthy"
      }
    }
  }
}
```

### CSRF Protection

#### `POST /api/v1/csrf/token`
**Purpose:** Generate CSRF token for form submissions  
**Rate Limit:** 60 requests per minute per IP

```json
// Request
{
  "intent": "form_submission"
}

// Response
{
  "success": true,
  "data": {
    "token": "csrf_token_here",
    "expiresAt": "2025-09-09T16:30:00.000Z"
  }
}
```

---

## Authentication Endpoints

### Plex OAuth Integration

#### `POST /api/v1/auth/plex/pin`
**Purpose:** Generate Plex OAuth PIN for user authentication  
**Rate Limit:** 10 requests per IP per 5 minutes

```json
// Request
{
  "clientIdentifier": "medianest-web-client"
}

// Response
{
  "success": true,
  "data": {
    "pin": "ABCD",
    "pinId": "pin_uuid",
    "expiresAt": "2025-09-09T15:35:00.000Z",
    "authUrl": "https://plex.tv/link"
  }
}
```

#### `GET /api/v1/auth/plex/status/:pinId`
**Purpose:** Check Plex PIN authorization status  
**Rate Limit:** 30 requests per minute per IP

```json
// Response - Waiting
{
  "success": true,
  "data": {
    "status": "waiting",
    "pinId": "pin_uuid"
  }
}

// Response - Authorized
{
  "success": true,
  "data": {
    "status": "authorized",
    "user": {
      "id": "user_uuid",
      "plexId": "plex_user_id",
      "plexUsername": "username",
      "email": "user@example.com",
      "role": "USER"
    },
    "tokens": {
      "accessToken": "jwt_token",
      "expiresAt": "2025-09-09T16:30:00.000Z"
    }
  }
}
```

#### `POST /api/v1/auth/logout`
**Purpose:** Terminate user session and revoke tokens  
**Authentication:** JWT Required

```json
// Request
{
  "allDevices": false  // Optional: logout from all devices
}

// Response
{
  "success": true,
  "data": {
    "message": "Successfully logged out",
    "tokensRevoked": 1
  }
}
```

#### `GET /api/v1/auth/session`
**Purpose:** Get current user session information  
**Authentication:** JWT Required  
**Cache:** No caching

```json
// Response
{
  "success": true,
  "data": {
    "user": {
      "id": "user_uuid",
      "email": "user@example.com",
      "role": "USER",
      "plexUsername": "username",
      "lastLoginAt": "2025-09-09T14:00:00.000Z"
    },
    "session": {
      "id": "session_uuid",
      "expiresAt": "2025-09-09T16:30:00.000Z",
      "deviceId": "device_uuid",
      "createdAt": "2025-09-09T15:00:00.000Z"
    }
  }
}
```

---

## Dashboard & Service Status

### Service Status Dashboard

#### `GET /api/v1/dashboard/status`
**Purpose:** Get all external service health status  
**Authentication:** JWT Required  
**Cache:** 60 seconds  
**WebSocket:** Real-time updates via `/ws/status`

```json
{
  "success": true,
  "data": {
    "services": {
      "plex": {
        "name": "Plex Media Server",
        "status": "online",
        "responseTime": 145,
        "lastChecked": "2025-09-09T15:29:30.000Z",
        "uptime": 99.87,
        "url": "https://plex.example.com",
        "version": "1.40.0.7998",
        "features": ["library", "collections", "webhooks"]
      },
      "overseerr": {
        "name": "Overseerr",
        "status": "degraded",
        "responseTime": 2340,
        "lastChecked": "2025-09-09T15:29:45.000Z",
        "uptime": 98.23,
        "url": "https://overseerr.example.com",
        "error": "High response time detected",
        "features": ["requests", "search", "webhooks"]
      },
      "uptimeKuma": {
        "name": "Uptime Kuma",
        "status": "online",
        "responseTime": 89,
        "lastChecked": "2025-09-09T15:29:50.000Z",
        "uptime": 99.95,
        "url": "https://uptime.example.com",
        "features": ["monitoring", "websocket", "alerts"]
      }
    },
    "summary": {
      "totalServices": 3,
      "onlineServices": 2,
      "degradedServices": 1,
      "offlineServices": 0,
      "averageUptime": 99.35
    }
  }
}
```

#### `GET /api/v1/services`
**Purpose:** Get service configuration and capabilities  
**Authentication:** JWT Required  
**Cache:** 5 minutes

```json
{
  "success": true,
  "data": {
    "services": [
      {
        "name": "plex",
        "displayName": "Plex Media Server",
        "enabled": true,
        "configured": true,
        "capabilities": [
          "authentication",
          "library_browsing",
          "collection_management",
          "webhook_support"
        ],
        "endpoints": {
          "libraries": "/api/v1/plex/libraries",
          "search": "/api/v1/plex/search",
          "collections": "/api/v1/plex/collections"
        }
      }
    ]
  }
}
```

---

## Media Management

### Media Search & Discovery

#### `GET /api/v1/media/search`
**Purpose:** Unified media search across external services  
**Authentication:** JWT Required  
**Rate Limit:** 100 requests per hour per user

```bash
# Query Parameters
GET /api/v1/media/search?q=avengers&type=movie&limit=20&page=1
```

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "tmdb_123456",
        "title": "Avengers: Endgame",
        "type": "movie",
        "year": 2019,
        "overview": "Movie description...",
        "poster": "https://image.tmdb.org/poster.jpg",
        "backdrop": "https://image.tmdb.org/backdrop.jpg",
        "genres": ["Action", "Adventure", "Sci-Fi"],
        "rating": 8.4,
        "availability": {
          "plex": {
            "available": true,
            "libraryName": "Movies",
            "addedAt": "2023-05-15T10:00:00.000Z"
          },
          "overseerr": {
            "requestable": false,
            "status": "available"
          }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8
    },
    "sources": ["tmdb", "plex", "overseerr"]
  }
}
```

### Media Request Management

#### `POST /api/v1/media/request`
**Purpose:** Submit media request to Overseerr  
**Authentication:** JWT Required  
**Rate Limit:** 10 requests per hour per user

```json
// Request
{
  "tmdbId": "123456",
  "mediaType": "movie",
  "title": "Avengers: Endgame",
  "seasons": [1, 2], // For TV shows only
  "priority": "normal" // low, normal, high
}

// Response
{
  "success": true,
  "data": {
    "id": "request_uuid",
    "tmdbId": "123456",
    "title": "Avengers: Endgame",
    "mediaType": "movie",
    "status": "pending",
    "overseerrId": "overseerr_request_id",
    "requestedBy": {
      "id": "user_uuid",
      "username": "username"
    },
    "createdAt": "2025-09-09T15:30:00.000Z",
    "estimatedCompletion": "2025-09-10T02:00:00.000Z"
  }
}
```

#### `GET /api/v1/media/requests`
**Purpose:** Get user's media requests with filtering  
**Authentication:** JWT Required  
**User Isolation:** Automatic filtering by user ID

```bash
# Query Parameters
GET /api/v1/media/requests?status=pending&type=movie&limit=10&page=1&sort=createdAt&order=desc
```

```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "request_uuid",
        "title": "Avengers: Endgame",
        "mediaType": "movie",
        "status": "completed",
        "tmdbId": "123456",
        "overseerrId": "overseerr_123",
        "createdAt": "2025-09-09T10:00:00.000Z",
        "completedAt": "2025-09-09T14:30:00.000Z",
        "processingTime": "4h 30m"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 23,
      "totalPages": 3
    },
    "statistics": {
      "totalRequests": 23,
      "pendingRequests": 3,
      "completedRequests": 18,
      "deniedRequests": 2,
      "averageProcessingTime": "3h 45m"
    }
  }
}
```

#### `GET /api/v1/media/requests/:id`
**Purpose:** Get detailed media request information  
**Authentication:** JWT Required  
**Authorization:** User can only access own requests

```json
{
  "success": true,
  "data": {
    "id": "request_uuid",
    "title": "Avengers: Endgame",
    "overview": "Movie description...",
    "mediaType": "movie",
    "status": "completed",
    "tmdbId": "123456",
    "overseerrId": "overseerr_123",
    "poster": "https://image.tmdb.org/poster.jpg",
    "createdAt": "2025-09-09T10:00:00.000Z",
    "completedAt": "2025-09-09T14:30:00.000Z",
    "statusHistory": [
      {
        "status": "pending",
        "timestamp": "2025-09-09T10:00:00.000Z",
        "note": "Request submitted"
      },
      {
        "status": "approved",
        "timestamp": "2025-09-09T10:15:00.000Z",
        "note": "Auto-approved by system"
      },
      {
        "status": "downloading",
        "timestamp": "2025-09-09T11:00:00.000Z",
        "note": "Download started"
      },
      {
        "status": "completed",
        "timestamp": "2025-09-09T14:30:00.000Z",
        "note": "Added to Plex library"
      }
    ]
  }
}
```

---

## Plex Integration

### Library Management

#### `GET /api/v1/plex/libraries`
**Purpose:** Get all accessible Plex libraries  
**Authentication:** JWT Required  
**Cache:** 10 minutes

```json
{
  "success": true,
  "data": {
    "libraries": [
      {
        "id": "library_1",
        "title": "Movies",
        "type": "movie",
        "itemCount": 1247,
        "totalSize": "4.7TB",
        "lastScanAt": "2025-09-09T06:00:00.000Z",
        "agent": "Plex Movie",
        "language": "en",
        "thumb": "/library/sections/1/composite/1234567890"
      },
      {
        "id": "library_2", 
        "title": "TV Shows",
        "type": "show",
        "itemCount": 89,
        "episodeCount": 3421,
        "totalSize": "2.1TB",
        "lastScanAt": "2025-09-09T06:30:00.000Z",
        "agent": "Plex TV Series",
        "language": "en"
      }
    ],
    "summary": {
      "totalLibraries": 2,
      "totalItems": 1336,
      "totalSize": "6.8TB",
      "lastUpdate": "2025-09-09T06:30:00.000Z"
    }
  }
}
```

#### `GET /api/v1/plex/library/:id/items`
**Purpose:** Browse items in a specific Plex library  
**Authentication:** JWT Required  
**Cache:** 5 minutes

```bash
# Query Parameters  
GET /api/v1/plex/library/1/items?limit=50&page=1&sort=addedAt&order=desc&search=avengers
```

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "plex_item_123",
        "title": "Avengers: Endgame",
        "type": "movie",
        "year": 2019,
        "summary": "Movie description...",
        "rating": 8.4,
        "duration": 181,
        "addedAt": "2025-08-15T10:00:00.000Z",
        "updatedAt": "2025-08-15T10:05:00.000Z",
        "thumb": "/library/metadata/123/thumb/1234567890",
        "art": "/library/metadata/123/art/1234567890",
        "genres": ["Action", "Adventure", "Sci-Fi"],
        "directors": ["Anthony Russo", "Joe Russo"],
        "writers": ["Christopher Markus", "Stephen McFeely"],
        "studio": "Marvel Studios",
        "contentRating": "PG-13",
        "media": [
          {
            "videoResolution": "4k",
            "videoCodec": "hevc",
            "audioChannels": 6,
            "audioCodec": "dts",
            "container": "mkv",
            "size": 12456789012
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1247,
      "totalPages": 25
    }
  }
}
```

#### `GET /api/v1/plex/collections`
**Purpose:** Get all Plex collections  
**Authentication:** JWT Required  
**Cache:** 10 minutes

```json
{
  "success": true,
  "data": {
    "collections": [
      {
        "id": "collection_123",
        "title": "Marvel Cinematic Universe",
        "summary": "All MCU movies in chronological order",
        "itemCount": 28,
        "thumb": "/library/collections/123/composite/1234567890",
        "addedAt": "2025-01-15T10:00:00.000Z",
        "updatedAt": "2025-09-01T14:30:00.000Z"
      }
    ]
  }
}
```

#### `POST /api/v1/plex/collections`
**Purpose:** Create new Plex collection  
**Authentication:** JWT Required  
**Rate Limit:** 5 requests per hour per user

```json
// Request
{
  "title": "YouTube Music Collection",
  "summary": "Downloaded music from YouTube",
  "items": ["plex_item_1", "plex_item_2"]
}

// Response
{
  "success": true,
  "data": {
    "id": "collection_456",
    "title": "YouTube Music Collection",
    "summary": "Downloaded music from YouTube",
    "itemCount": 2,
    "createdAt": "2025-09-09T15:30:00.000Z"
  }
}
```

---

## YouTube Integration (Phase 4 - Implementation Pending)

### Download Management

#### `POST /api/v1/youtube/download`
**Purpose:** Queue YouTube playlist/video for download  
**Authentication:** JWT Required  
**Rate Limit:** 5 downloads per hour per user  
**User Isolation:** All downloads are user-specific

```json
// Request
{
  "url": "https://www.youtube.com/playlist?list=PLxxx",
  "quality": "best", // best, worst, 720p, 480p, audio_only
  "format": "mp4", // mp4, webm, mp3
  "createPlexCollection": true,
  "collectionName": "My YouTube Playlist"
}

// Response
{
  "success": true,
  "data": {
    "id": "download_uuid",
    "playlistUrl": "https://www.youtube.com/playlist?list=PLxxx",
    "playlistTitle": "My Awesome Playlist",
    "videoCount": 25,
    "estimatedSize": "2.4GB",
    "status": "queued",
    "queuePosition": 2,
    "estimatedCompletion": "2025-09-09T17:45:00.000Z",
    "options": {
      "quality": "best",
      "format": "mp4",
      "createPlexCollection": true,
      "collectionName": "My YouTube Playlist"
    },
    "createdAt": "2025-09-09T15:30:00.000Z"
  }
}
```

#### `GET /api/v1/youtube/downloads`
**Purpose:** Get user's YouTube downloads  
**Authentication:** JWT Required  
**User Isolation:** Automatic filtering by user ID

```bash
# Query Parameters
GET /api/v1/youtube/downloads?status=completed&limit=10&page=1&sort=createdAt&order=desc
```

```json
{
  "success": true,
  "data": {
    "downloads": [
      {
        "id": "download_uuid",
        "playlistUrl": "https://www.youtube.com/playlist?list=PLxxx",
        "playlistTitle": "My Awesome Playlist",
        "status": "completed",
        "progress": 100,
        "videoCount": 25,
        "completedVideos": 25,
        "totalSize": "2.1GB",
        "downloadPath": "/downloads/user_uuid/playlist_name",
        "plexCollectionId": "collection_789",
        "createdAt": "2025-09-09T15:30:00.000Z",
        "startedAt": "2025-09-09T15:35:00.000Z",
        "completedAt": "2025-09-09T16:45:00.000Z",
        "processingTime": "1h 10m"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 12,
      "totalPages": 2
    },
    "statistics": {
      "totalDownloads": 12,
      "queuedDownloads": 1,
      "activeDownloads": 0,
      "completedDownloads": 10,
      "failedDownloads": 1,
      "totalSize": "15.7GB"
    }
  }
}
```

#### `GET /api/v1/youtube/downloads/:id`
**Purpose:** Get detailed download information with progress  
**Authentication:** JWT Required  
**Authorization:** User can only access own downloads

```json
{
  "success": true,
  "data": {
    "id": "download_uuid",
    "playlistUrl": "https://www.youtube.com/playlist?list=PLxxx",
    "playlistTitle": "My Awesome Playlist",
    "status": "downloading",
    "progress": 67,
    "videoCount": 25,
    "completedVideos": 17,
    "currentVideo": {
      "title": "Amazing Song #18",
      "url": "https://www.youtube.com/watch?v=xxx",
      "progress": 45,
      "eta": "2m 30s"
    },
    "videos": [
      {
        "id": "video_1",
        "title": "Amazing Song #1",
        "url": "https://www.youtube.com/watch?v=xxx",
        "status": "completed",
        "filename": "01 - Amazing Song #1.mp4",
        "size": 89456123,
        "duration": "3:45"
      }
    ],
    "options": {
      "quality": "best",
      "format": "mp4",
      "createPlexCollection": true,
      "collectionName": "My YouTube Playlist"
    },
    "downloadPath": "/downloads/user_uuid/playlist_name",
    "plexCollectionId": "collection_789",
    "createdAt": "2025-09-09T15:30:00.000Z",
    "startedAt": "2025-09-09T15:35:00.000Z",
    "eta": "25m 15s"
  }
}
```

#### `DELETE /api/v1/youtube/downloads/:id`
**Purpose:** Cancel/delete YouTube download  
**Authentication:** JWT Required  
**Authorization:** User can only delete own downloads

```json
// Response
{
  "success": true,
  "data": {
    "id": "download_uuid",
    "status": "cancelled",
    "message": "Download cancelled and files cleaned up",
    "filesDeleted": true,
    "plexCollectionRemoved": true
  }
}
```

---

## Admin Panel (ADMIN Role Required)

### User Management

#### `GET /api/v1/admin/users`
**Purpose:** Get all system users  
**Authentication:** JWT Required  
**Authorization:** ADMIN role only

```bash
# Query Parameters
GET /api/v1/admin/users?role=USER&status=active&limit=50&page=1&sort=lastLoginAt&order=desc
```

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_uuid",
        "email": "user@example.com",
        "plexUsername": "username",
        "role": "USER",
        "status": "active",
        "createdAt": "2025-08-01T10:00:00.000Z",
        "lastLoginAt": "2025-09-09T14:30:00.000Z",
        "statistics": {
          "mediaRequests": 15,
          "youtubeDownloads": 8,
          "totalDownloadSize": "4.2GB",
          "lastActivity": "2025-09-09T15:00:00.000Z"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 12,
      "totalPages": 1
    },
    "summary": {
      "totalUsers": 12,
      "activeUsers": 10,
      "adminUsers": 2,
      "userUsers": 10
    }
  }
}
```

#### `PUT /api/v1/admin/users/:id`
**Purpose:** Update user role and status  
**Authentication:** JWT Required  
**Authorization:** ADMIN role only

```json
// Request
{
  "role": "ADMIN", // USER, ADMIN
  "status": "active", // active, inactive, suspended
  "requiresPasswordChange": false
}

// Response
{
  "success": true,
  "data": {
    "id": "user_uuid",
    "email": "user@example.com",
    "role": "ADMIN",
    "status": "active",
    "requiresPasswordChange": false,
    "updatedAt": "2025-09-09T15:30:00.000Z",
    "updatedBy": "admin_uuid"
  }
}
```

#### `DELETE /api/v1/admin/users/:id`
**Purpose:** Delete user and all associated data  
**Authentication:** JWT Required  
**Authorization:** ADMIN role only

```json
// Response
{
  "success": true,
  "data": {
    "id": "user_uuid",
    "message": "User and all associated data deleted",
    "deletedRecords": {
      "mediaRequests": 15,
      "youtubeDownloads": 8,
      "sessionTokens": 3,
      "errorLogs": 45
    },
    "deletedAt": "2025-09-09T15:30:00.000Z"
  }
}
```

### Service Configuration

#### `GET /api/v1/admin/services`
**Purpose:** Get all service configurations  
**Authentication:** JWT Required  
**Authorization:** ADMIN role only

```json
{
  "success": true,
  "data": {
    "services": [
      {
        "name": "plex",
        "displayName": "Plex Media Server",
        "enabled": true,
        "configured": true,
        "url": "https://plex.example.com",
        "status": "online",
        "lastChecked": "2025-09-09T15:29:30.000Z",
        "capabilities": ["library", "collections", "webhooks"],
        "updatedAt": "2025-09-01T10:00:00.000Z",
        "updatedBy": "admin@example.com"
      }
    ]
  }
}
```

#### `PUT /api/v1/admin/services/:name`
**Purpose:** Update service configuration  
**Authentication:** JWT Required  
**Authorization:** ADMIN role only

```json
// Request
{
  "enabled": true,
  "url": "https://plex.example.com",
  "apiKey": "encrypted_api_key", // Will be encrypted server-side
  "configData": {
    "webhookUrl": "https://medianest.example.com/webhooks/plex",
    "librarySync": true,
    "autoCreateCollections": false
  }
}

// Response
{
  "success": true,
  "data": {
    "name": "plex",
    "enabled": true,
    "url": "https://plex.example.com",
    "configured": true,
    "configData": {
      "webhookUrl": "https://medianest.example.com/webhooks/plex",
      "librarySync": true,
      "autoCreateCollections": false
    },
    "updatedAt": "2025-09-09T15:30:00.000Z",
    "updatedBy": "admin_uuid",
    "connectionTest": {
      "status": "success",
      "responseTime": 145,
      "version": "1.40.0.7998"
    }
  }
}
```

#### `POST /api/v1/admin/services/test`
**Purpose:** Test service connection with configuration  
**Authentication:** JWT Required  
**Authorization:** ADMIN role only

```json
// Request
{
  "serviceName": "plex",
  "url": "https://plex.example.com",
  "apiKey": "test_api_key"
}

// Response - Success
{
  "success": true,
  "data": {
    "serviceName": "plex",
    "status": "success",
    "responseTime": 145,
    "version": "1.40.0.7998",
    "features": ["library", "collections", "webhooks"],
    "message": "Connection successful"
  }
}

// Response - Error
{
  "success": false,
  "error": {
    "code": "SERVICE_CONNECTION_FAILED",
    "message": "Unable to connect to Plex server",
    "details": {
      "serviceName": "plex",
      "url": "https://plex.example.com",
      "error": "Connection timeout after 10 seconds",
      "suggestions": [
        "Check if the URL is correct",
        "Verify API key is valid",
        "Ensure Plex server is running"
      ]
    }
  }
}
```

### System Configuration

#### `GET /api/v1/admin/config`
**Purpose:** Get system configuration settings  
**Authentication:** JWT Required  
**Authorization:** ADMIN role only

```json
{
  "success": true,
  "data": {
    "system": {
      "version": "2.0.0",
      "environment": "production",
      "uptime": 86400,
      "nodeVersion": "20.10.0"
    },
    "features": {
      "userRegistration": false,
      "guestAccess": false,
      "youtubeDownloads": true,
      "mediaRequests": true
    },
    "limits": {
      "maxUsers": 20,
      "youtubeDownloadsPerUser": 5,
      "mediaRequestsPerUser": 10,
      "maxDownloadSize": "10GB"
    },
    "security": {
      "jwtExpiration": "1h",
      "rememberTokenExpiration": "90d",
      "rateLimiting": true,
      "corsEnabled": true
    }
  }
}
```

#### `PUT /api/v1/admin/config`
**Purpose:** Update system configuration  
**Authentication:** JWT Required  
**Authorization:** ADMIN role only

```json
// Request
{
  "features": {
    "userRegistration": false,
    "youtubeDownloads": true
  },
  "limits": {
    "youtubeDownloadsPerUser": 10,
    "maxDownloadSize": "20GB"
  }
}

// Response
{
  "success": true,
  "data": {
    "updated": [
      "features.youtubeDownloads",
      "limits.youtubeDownloadsPerUser",
      "limits.maxDownloadSize"
    ],
    "updatedAt": "2025-09-09T15:30:00.000Z",
    "updatedBy": "admin_uuid"
  }
}
```

---

## WebSocket Events

### Real-time Event System

MediaNest implements comprehensive WebSocket support with multiple namespaces:

#### Connection URLs
- **Public:** `ws://localhost:3001/`
- **Authenticated:** `ws://localhost:3001/authenticated`
- **Admin:** `ws://localhost:3001/admin`
- **Media:** `ws://localhost:3001/media`

#### Event Types

**Service Status Events**
```json
// Event: 'service:status'
{
  "service": "plex",
  "status": "online", // online, offline, degraded
  "responseTime": 145,
  "timestamp": "2025-09-09T15:30:00.000Z",
  "previousStatus": "offline"
}
```

**Download Progress Events** (Phase 4)
```json
// Event: 'download:progress'  
{
  "downloadId": "download_uuid",
  "progress": 67,
  "currentVideo": "Amazing Song #18",
  "eta": "15m 30s",
  "speed": "2.1MB/s"
}
```

**Media Request Updates**
```json
// Event: 'media:request:update'
{
  "requestId": "request_uuid",
  "status": "completed",
  "title": "Avengers: Endgame",
  "completedAt": "2025-09-09T15:30:00.000Z"
}
```

**System Notifications**
```json
// Event: 'notification'
{
  "id": "notification_uuid", 
  "type": "info", // info, success, warning, error
  "title": "Service Status Update",
  "message": "Plex server is back online",
  "timestamp": "2025-09-09T15:30:00.000Z",
  "userId": "user_uuid" // null for broadcast
}
```

---

## Error Handling & Response Formats

### Standard Response Format

```json
// Success Response
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2025-09-09T15:30:00.000Z",
    "version": "v1",
    "requestId": "req_uuid"
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "limit": 100,
      "window": "60s",
      "retryAfter": 45,
      "endpoint": "/api/v1/media/search"
    }
  },
  "meta": {
    "timestamp": "2025-09-09T15:30:00.000Z",
    "requestId": "req_uuid",
    "correlationId": "corr_uuid"
  }
}
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AUTHENTICATION_REQUIRED` | JWT token missing or invalid | 401 |
| `AUTHORIZATION_DENIED` | Insufficient permissions | 403 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `VALIDATION_ERROR` | Request validation failed | 400 |
| `RESOURCE_NOT_FOUND` | Requested resource not found | 404 |
| `SERVICE_UNAVAILABLE` | External service unreachable | 503 |
| `INTERNAL_ERROR` | Unexpected server error | 500 |
| `USER_NOT_FOUND` | User account not found | 404 |
| `DOWNLOAD_LIMIT_EXCEEDED` | YouTube download limit reached | 429 |
| `PLEX_CONNECTION_FAILED` | Cannot connect to Plex server | 503 |

### Rate Limiting

| Endpoint Pattern | Limit | Window | Scope |
|------------------|-------|--------|-------|
| `/api/v1/auth/plex/pin` | 10 requests | 5 minutes | IP address |
| `/api/v1/media/search` | 100 requests | 1 hour | User ID |
| `/api/v1/media/request` | 10 requests | 1 hour | User ID |
| `/api/v1/youtube/download` | 5 requests | 1 hour | User ID |
| `/api/v1/admin/*` | 200 requests | 1 hour | User ID |
| Global API limit | 1000 requests | 15 minutes | IP address |

---

## Summary

MediaNest's API provides comprehensive functionality across:

**✅ Implemented Features:**
- Complete authentication system with Plex OAuth
- Real-time service status monitoring
- Media search and request management
- Plex library integration
- Role-based admin panel
- WebSocket real-time updates

**🚧 Implementation Pending (Phase 4):**
- YouTube download endpoints
- Background job processing
- File management system

**Key API Characteristics:**
- **RESTful Design** with consistent response formats
- **JWT Authentication** with automatic token rotation  
- **Role-based Authorization** with user data isolation
- **Comprehensive Error Handling** with correlation IDs
- **Rate Limiting** at multiple levels for security
- **Real-time Updates** via WebSocket integration
- **External Service Integration** with circuit breaker patterns

The API architecture successfully balances **security, performance, and usability** while maintaining clear separation between public, authenticated, and admin-only endpoints.