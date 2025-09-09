# MediaNest REST API Reference

**Version:** 1.0.0  
**Base URL:** `http://localhost:4000/api/v1`  
**Authentication:** JWT-based authentication using secure httpOnly cookies

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Health Check](#health-check)
  - [Authentication](#authentication-endpoints)
  - [Dashboard](#dashboard-endpoints)
  - [Media Management](#media-management-endpoints)
  - [Plex Integration](#plex-integration-endpoints)
  - [Admin Operations](#admin-operations-endpoints)
  - [Services Management](#services-management-endpoints)
  - [Error Reporting](#error-reporting-endpoints)
  - [CSRF Protection](#csrf-protection-endpoints)
  - [System Monitoring](#system-monitoring-endpoints)
- [WebSocket Events](#websocket-events)

## Overview

MediaNest provides a comprehensive REST API for media management, integrating with Plex Media Server, Overseerr, and YouTube-dl. The API follows RESTful principles and uses JSON for all request and response bodies.

### Key Features
- **Plex OAuth Integration** - Secure authentication using Plex.tv accounts
- **Media Discovery** - Search across multiple media sources
- **Request Management** - Submit and track media requests
- **Real-time Updates** - WebSocket support for live updates
- **Admin Controls** - User management and system administration
- **Comprehensive Monitoring** - Health checks and error reporting

## Authentication

MediaNest uses Plex OAuth for user authentication with JWT tokens stored in secure httpOnly cookies.

### Authentication Flow
1. Generate a Plex PIN using `/auth/plex/pin`
2. User authorizes on plex.tv/link
3. Verify PIN and create session using `/auth/plex/verify`
4. JWT token is automatically included in subsequent requests

### Security Features
- **HttpOnly Cookies**: Prevents XSS attacks
- **CSRF Protection**: Token-based CSRF protection
- **Rate Limiting**: Prevents brute force attacks
- **Secure Headers**: Comprehensive security headers

## Response Format

All API responses follow a consistent JSON format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data specific to the endpoint
  },
  "meta": {
    // Optional metadata (pagination, timestamps, etc.)
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional additional error details
  }
}
```

## Error Handling

The API uses standard HTTP status codes with detailed error responses:

| Status Code | Description | Common Error Codes |
|-------------|-------------|-------------------|
| **400** | Bad Request | `VALIDATION_ERROR`, `INVALID_INPUT` |
| **401** | Unauthorized | `UNAUTHORIZED`, `INVALID_TOKEN` |
| **403** | Forbidden | `ACCESS_DENIED`, `INSUFFICIENT_PERMISSIONS` |
| **404** | Not Found | `NOT_FOUND`, `RESOURCE_NOT_FOUND` |
| **409** | Conflict | `DUPLICATE_RESOURCE`, `CONFLICT` |
| **429** | Too Many Requests | `RATE_LIMIT_EXCEEDED` |
| **500** | Internal Server Error | `INTERNAL_ERROR` |
| **502** | Bad Gateway | `EXTERNAL_SERVICE_ERROR`, `PLEX_ERROR` |
| **503** | Service Unavailable | `SERVICE_UNAVAILABLE` |

### Common Error Codes
- `PLEX_UNREACHABLE` - Cannot connect to Plex server
- `PLEX_TIMEOUT` - Plex server connection timeout
- `PIN_NOT_AUTHORIZED` - Plex PIN not yet authorized
- `DATABASE_ERROR` - Database operation failed
- `TOKEN_ERROR` - JWT token generation/validation failed

## Rate Limiting

Rate limits are applied to prevent abuse:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| **General API** | 100 requests | 15 minutes |
| **API Endpoints** | Configurable | Configurable |
| **Authentication** | 10 requests | 15 minutes |

Rate limit headers included in responses:
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - Time when limit resets

## API Endpoints

### Health Check

#### `GET /health`
Simple health check for Docker/load balancers.

**Authentication:** Not required

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

#### `GET /api/health`
Detailed health check with service dependencies.

**Authentication:** Not required

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "backend",
    "timestamp": "2025-01-15T12:00:00.000Z",
    "version": "1.0.0",
    "uptime": 3600,
    "dependencies": {
      "database": "healthy",
      "redis": "healthy",
      "plex": "healthy"
    }
  }
}
```

### Authentication Endpoints

#### `POST /api/v1/auth/plex/pin`
Generate a Plex PIN for OAuth authentication.

**Authentication:** Not required

**Request Body:**
```json
{
  "clientName": "MediaNest" // Optional, defaults to "MediaNest"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123456",
    "code": "ABCD-EFGH-IJKL-MNOP",
    "qrUrl": "https://plex.tv/link/?pin=ABCD-EFGH-IJKL-MNOP",
    "expiresIn": 900
  }
}
```

#### `POST /api/v1/auth/plex/verify`
Verify Plex PIN and create authenticated session.

**Authentication:** Not required  
**CSRF Protection:** Required

**Request Body:**
```json
{
  "pinId": "123456",
  "rememberMe": false // Optional, defaults to false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "role": "user"
    },
    "token": "jwt-access-token",
    "rememberToken": "jwt-refresh-token", // Only if rememberMe: true
    "csrfToken": "csrf-token"
  }
}
```

**Cookies Set:**
- `token` - JWT access token (httpOnly, secure)
- `rememberToken` - JWT refresh token if rememberMe=true (httpOnly, secure, 90-day expiry)

#### `POST /api/v1/auth/logout`
End the current user session.

**Authentication:** Required  
**CSRF Protection:** Required

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### `GET /api/v1/auth/session`
Get current session information.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "role": "user"
    }
  }
}
```

### Dashboard Endpoints

#### `GET /api/v1/dashboard/stats`
Get user dashboard statistics.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRequests": 42,
    "pendingRequests": 5,
    "approvedRequests": 30,
    "completedRequests": 7,
    "recentActivity": [
      {
        "type": "request_submitted",
        "title": "Movie Title",
        "timestamp": "2025-01-15T12:00:00.000Z"
      }
    ]
  }
}
```

#### `GET /api/v1/dashboard/status`
Get system and service status.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "name": "Database",
        "status": "online",
        "responseTime": 15,
        "lastCheck": "2025-01-15T12:00:00.000Z"
      },
      {
        "name": "Redis Cache",
        "status": "online",
        "responseTime": 3,
        "lastCheck": "2025-01-15T12:00:00.000Z"
      },
      {
        "name": "Plex API",
        "status": "online",
        "responseTime": 120,
        "lastCheck": "2025-01-15T12:00:00.000Z"
      }
    ],
    "summary": {
      "total": 3,
      "online": 3,
      "offline": 0,
      "degraded": 0
    }
  }
}
```

### Media Management Endpoints

#### `GET /api/v1/media/search`
Search for media across integrated services.

**Authentication:** Required

**Query Parameters:**
- `query` (required) - Search query string
- `page` (optional) - Page number (default: 1)

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "movie-12345",
        "tmdbId": "12345",
        "title": "Movie Title",
        "type": "movie",
        "year": 2024,
        "overview": "Movie description...",
        "posterPath": "/path/to/poster.jpg",
        "status": {
          "inPlex": true,
          "requested": false,
          "available": true
        }
      }
    ]
  },
  "meta": {
    "query": "inception",
    "page": 1,
    "totalPages": 5
  }
}
```

#### `GET /api/v1/media/:mediaType/:tmdbId`
Get detailed information about specific media.

**Authentication:** Required

**Parameters:**
- `mediaType` - "movie" or "tv"
- `tmdbId` - TMDB ID of the media

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "movie-12345",
    "tmdbId": "12345",
    "title": "Movie Title",
    "type": "movie",
    "year": 2024,
    "overview": "Detailed description...",
    "posterPath": "/path/to/poster.jpg",
    "backdropPath": "/path/to/backdrop.jpg",
    "genres": ["Action", "Adventure"],
    "rating": 8.5,
    "status": {
      "inPlex": true,
      "requested": false,
      "available": true
    }
  }
}
```

#### `POST /api/v1/media/request`
Submit a request for new media.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "Movie Title",
  "mediaType": "movie",
  "tmdbId": "12345",
  "seasons": [1, 2] // Optional, for TV shows
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Movie Title",
    "mediaType": "movie",
    "tmdbId": "12345",
    "status": "pending",
    "userId": "user-uuid",
    "createdAt": "2025-01-15T12:00:00.000Z"
  },
  "meta": {
    "timestamp": "2025-01-15T12:00:00.000Z"
  }
}
```

#### `GET /api/v1/media/requests`
Get user's media requests.

**Authentication:** Required

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `pageSize` (optional) - Items per page (default: 20)
- `status` (optional) - Filter by status
- `mediaType` (optional) - Filter by media type
- `search` (optional) - Search in titles
- `startDate` (optional) - Filter from date
- `endDate` (optional) - Filter to date
- `sortBy` (optional) - Sort field: date, title, status (default: date)
- `sortOrder` (optional) - Sort order: asc, desc (default: desc)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Movie Title",
      "mediaType": "movie",
      "tmdbId": "12345",
      "status": "pending",
      "createdAt": "2025-01-15T12:00:00.000Z"
    }
  ],
  "meta": {
    "totalCount": 42,
    "totalPages": 3,
    "currentPage": 1,
    "timestamp": "2025-01-15T12:00:00.000Z"
  }
}
```

#### `GET /api/v1/media/requests/:requestId`
Get details of a specific media request.

**Authentication:** Required

**Parameters:**
- `requestId` - UUID of the request

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Movie Title",
    "mediaType": "movie",
    "tmdbId": "12345",
    "status": "pending",
    "userId": "user-uuid",
    "createdAt": "2025-01-15T12:00:00.000Z",
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

**Note:** Users can only access their own requests unless they are admin.

#### `DELETE /api/v1/media/requests/:requestId`
Delete a pending media request.

**Authentication:** Required

**Parameters:**
- `requestId` - UUID of the request

**Response:**
```json
{
  "success": true,
  "message": "Request deleted successfully"
}
```

**Note:** Only pending requests can be deleted. Users can only delete their own requests.

### Plex Integration Endpoints

#### `GET /api/v1/plex/server`
Get Plex server information and status.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "My Plex Server",
    "version": "1.40.0.1234",
    "platform": "Linux",
    "machineIdentifier": "server-machine-id",
    "status": "online",
    "libraries": 5
  }
}
```

### Admin Operations Endpoints

**Note:** All admin endpoints require authentication with admin role.

#### `GET /api/v1/admin/users`
List all users in the system.

**Authentication:** Required (Admin only)

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `pageSize` (optional) - Items per page (default: 20)
- `search` (optional) - Search by username/email
- `role` (optional) - Filter by role
- `sortBy` (optional) - Sort field (default: createdAt)
- `sortOrder` (optional) - Sort order (default: desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "plexUsername": "johndoe",
        "email": "john@example.com",
        "role": "user",
        "createdAt": "2025-01-01T00:00:00.000Z",
        "lastLoginAt": "2025-01-15T10:00:00.000Z",
        "_count": {
          "mediaRequests": 15,
          "youtubeDownloads": 3
        }
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "pageSize": 20,
      "totalPages": 2
    }
  }
}
```

#### `PATCH /api/v1/admin/users/:userId/role`
Update user role.

**Authentication:** Required (Admin only)

**Parameters:**
- `userId` - UUID of the user

**Request Body:**
```json
{
  "role": "admin" // or "user"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "plexUsername": "johndoe",
    "email": "john@example.com",
    "role": "admin"
  }
}
```

#### `DELETE /api/v1/admin/users/:userId`
Delete a user account.

**Authentication:** Required (Admin only)

**Parameters:**
- `userId` - UUID of the user

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Note:** Admins cannot delete their own account.

#### `GET /api/v1/admin/services`
Get all service configurations.

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "serviceName": "plex",
      "serviceUrl": "https://plex.local:32400",
      "enabled": true,
      "updatedAt": "2025-01-15T12:00:00.000Z"
    }
  ]
}
```

#### `GET /api/v1/admin/requests`
Get all media requests across all users.

**Authentication:** Required (Admin only)

**Query Parameters:** Same as user requests endpoint plus:
- `userId` (optional) - Filter by specific user

**Response:** Same format as user requests but includes all users' requests.

#### `GET /api/v1/admin/stats`
Get system-wide statistics.

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 25,
      "active": 18
    },
    "requests": {
      "total": 156,
      "pending": 12
    },
    "downloads": {
      "total": 89,
      "active": 3
    }
  }
}
```

### Services Management Endpoints

#### `GET /api/v1/services/status`
Get status of all integrated services.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "name": "Database",
        "status": "online",
        "responseTime": 15,
        "lastCheck": "2025-01-15T12:00:00.000Z"
      },
      {
        "name": "Redis Cache",
        "status": "online",
        "responseTime": 3,
        "lastCheck": "2025-01-15T12:00:00.000Z"
      }
    ],
    "timestamp": "2025-01-15T12:00:00.000Z",
    "summary": {
      "total": 4,
      "online": 4,
      "offline": 0,
      "degraded": 0
    }
  }
}
```

### Error Reporting Endpoints

#### `POST /api/v1/errors/report`
Report client-side errors for monitoring.

**Authentication:** Required

**Request Body:**
```json
{
  "errors": [
    {
      "timestamp": "2025-01-15T12:00:00.000Z",
      "level": "error",
      "message": "Failed to load media details",
      "error": {
        "message": "Network request failed",
        "stack": "Error: Network request failed...",
        "code": "NETWORK_ERROR"
      },
      "context": {
        "component": "MediaDetailsPage",
        "mediaId": "12345"
      }
    }
  ],
  "userAgent": "Mozilla/5.0...",
  "url": "https://medianest.local/media/movie/12345"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "received": 1,
    "correlationId": "err_abc123xyz"
  }
}
```

### CSRF Protection Endpoints

#### `GET /api/v1/csrf/token`
Get CSRF token for form submissions.

**Authentication:** Not required

**Response:**
```json
{
  "success": true,
  "data": {
    "csrfToken": "csrf-token-string"
  }
}
```

### System Monitoring Endpoints

#### `GET /api/v1/resilience/status`
Get resilience and circuit breaker status.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "circuitBreakers": [
      {
        "name": "plex-api",
        "state": "closed",
        "failures": 0,
        "successes": 156
      }
    ],
    "healthChecks": {
      "database": "healthy",
      "redis": "healthy"
    }
  }
}
```

#### `GET /api/v1/performance/metrics`
Get performance metrics (admin only).

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "data": {
    "requestsPerMinute": 45,
    "averageResponseTime": 234,
    "errorRate": 0.02,
    "activeConnections": 12
  }
}
```

## WebSocket Events

MediaNest uses Socket.IO for real-time communication. Connect to `/` namespace.

### Connection
```javascript
const socket = io('http://localhost:4000', {
  withCredentials: true
});
```

### Available Namespaces
- `/` - Public namespace
- `/authenticated` - Requires authentication  
- `/admin` - Admin-only namespace
- `/media` - Media-related events
- `/system` - System monitoring events

### Event Types

#### `service:status`
Service status updates
```json
{
  "service": "plex",
  "status": "online",
  "responseTime": 123,
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

#### `request:update`
Media request status changes
```json
{
  "requestId": "uuid",
  "status": "approved",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

#### `user:notification`
User notifications
```json
{
  "type": "request_completed",
  "title": "Media Available",
  "message": "Your requested movie is now available",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

---

## Examples

### Authentication Flow
```bash
# 1. Generate Plex PIN
curl -X POST http://localhost:4000/api/v1/auth/plex/pin

# 2. User authorizes on plex.tv/link

# 3. Verify PIN and get session
curl -X POST http://localhost:4000/api/v1/auth/plex/verify \
  -H "Content-Type: application/json" \
  -d '{"pinId": "123456"}'
```

### Media Search and Request
```bash
# Search for media
curl -X GET "http://localhost:4000/api/v1/media/search?query=inception" \
  -H "Cookie: token=your-jwt-token"

# Request media
curl -X POST http://localhost:4000/api/v1/media/request \
  -H "Content-Type: application/json" \
  -H "Cookie: token=your-jwt-token" \
  -d '{
    "title": "Inception",
    "mediaType": "movie",
    "tmdbId": "27205"
  }'
```

---

## Rate Limits & Performance

- **Concurrent Requests**: Up to 10 concurrent requests per user
- **Request Timeout**: 30 seconds for API calls
- **WebSocket Connections**: Up to 100 per user
- **File Upload**: Maximum 10MB per request

## Security Headers

All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'self'`

---

**Last Updated:** January 15, 2025  
**API Version:** 1.0.0  
**Documentation Version:** 1.0.0