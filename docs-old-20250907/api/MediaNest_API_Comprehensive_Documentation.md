# MediaNest API Comprehensive Documentation

## Overview

MediaNest provides a comprehensive REST API for media management, Plex integration, YouTube downloading, and system administration. The API is organized around RESTful endpoints with consistent response formats and authentication patterns.

**Base URL**: `http://localhost:4000/api/v1`  
**Authentication**: JWT tokens via cookies or Authorization header  
**API Version**: v1

## Table of Contents

1. [Authentication](#authentication)
2. [Media Management](#media-management)
3. [Plex Integration](#plex-integration)
4. [YouTube Downloads](#youtube-downloads)
5. [Administration](#administration)
6. [Health & Monitoring](#health--monitoring)
7. [WebSocket Events](#websocket-events)
8. [Error Handling](#error-handling)

## Authentication

### Authentication Overview

MediaNest supports multiple authentication methods:

- **Plex OAuth**: Primary authentication method using Plex.tv accounts
- **Password-based**: For admin bootstrap and fallback authentication
- **Session Management**: JWT tokens with refresh capabilities
- **CSRF Protection**: Cross-site request forgery protection

### Authentication Endpoints

#### Generate Plex PIN

```http
POST /api/v1/auth/plex/pin
Content-Type: application/json

{
  "clientName": "MediaNest" // optional
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "id": "12345",
    "code": "ABCD1234",
    "qrUrl": "https://plex.tv/link/?pin=ABCD1234",
    "expiresIn": 900
  }
}
```

#### Verify Plex PIN

```http
POST /api/v1/auth/plex/verify
Content-Type: application/json
X-CSRF-Token: <csrf_token>

{
  "pinId": "12345",
  "rememberMe": false
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-123",
      "username": "plex_user",
      "email": "user@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "rememberToken": "eyJhbGciOiJIUzI1NiIs...",
    "csrfToken": "csrf-token-here"
  }
}
```

#### Admin Bootstrap Login

```http
POST /api/auth/admin
Content-Type: application/json

{
  "email": "admin@medianest.com",
  "password": "secure_password",
  "name": "Admin User"
}
```

#### Password Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@medianest.com",
  "password": "secure_password",
  "rememberMe": true
}
```

#### Get Current Session

```http
GET /api/v1/auth/session
Authorization: Bearer <token>
```

**Response**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-123",
      "username": "plex_user",
      "email": "user@example.com",
      "role": "user"
    }
  }
}
```

#### Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer <token>
X-CSRF-Token: <csrf_token>
```

### Password Management

#### Request Password Reset

```http
POST /api/auth/password-reset/request

{
  "email": "user@example.com"
}
```

#### Verify Reset Token

```http
POST /api/auth/password-reset/verify

{
  "token": "reset_token",
  "tokenId": "token_id"
}
```

#### Complete Password Reset

```http
POST /api/auth/password-reset/confirm

{
  "token": "reset_token",
  "newPassword": "new_secure_password"
}
```

## Media Management

### Media Search

```http
GET /api/v1/media/search?query=avengers&type=movie&page=1&limit=20
Authorization: Bearer <token>
```

**Response**:

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "123",
        "title": "Avengers: Endgame",
        "type": "movie",
        "year": 2019,
        "poster": "https://image.tmdb.org/...",
        "overview": "Movie description..."
      }
    ],
    "pagination": {
      "page": 1,
      "totalPages": 5,
      "totalResults": 100
    }
  }
}
```

### Get Media Details

```http
GET /api/v1/media/movie/123
Authorization: Bearer <token>
```

**Response**:

```json
{
  "success": true,
  "data": {
    "id": "123",
    "title": "Avengers: Endgame",
    "type": "movie",
    "year": 2019,
    "runtime": 181,
    "genres": ["Action", "Adventure", "Drama"],
    "cast": [...],
    "crew": [...],
    "availability": {
      "plex": true,
      "requested": false
    }
  }
}
```

### Request Media

```http
POST /api/v1/media/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "tmdbId": "123",
  "mediaType": "movie",
  "quality": "1080p",
  "comment": "Please add this movie"
}
```

### Get User Requests

```http
GET /api/v1/media/requests?status=pending&page=1&limit=10
Authorization: Bearer <token>
```

### Get Request Details

```http
GET /api/v1/media/requests/req-123
Authorization: Bearer <token>
```

### Delete Request

```http
DELETE /api/v1/media/requests/req-123
Authorization: Bearer <token>
```

## Plex Integration

### Get Server Information

```http
GET /api/v1/plex/server
Authorization: Bearer <token>
Cache-Control: max-age=3600
```

**Response**:

```json
{
  "success": true,
  "data": {
    "name": "My Plex Server",
    "version": "1.25.3.5409",
    "platform": "Linux",
    "machineIdentifier": "abc123",
    "libraries": 5,
    "users": 3
  }
}
```

### Get Libraries

```http
GET /api/v1/plex/libraries
Authorization: Bearer <token>
```

**Response**:

```json
{
  "success": true,
  "data": {
    "libraries": [
      {
        "key": "1",
        "title": "Movies",
        "type": "movie",
        "count": 1250
      },
      {
        "key": "2",
        "title": "TV Shows",
        "type": "show",
        "count": 180
      }
    ]
  }
}
```

### Get Library Items

```http
GET /api/v1/plex/libraries/1/items?page=1&limit=50&sort=addedAt:desc
Authorization: Bearer <token>
```

### Search Plex Content

```http
GET /api/v1/plex/search?query=batman&limit=20
Authorization: Bearer <token>
```

### Get Recently Added

```http
GET /api/v1/plex/recently-added?limit=20
Authorization: Bearer <token>
```

### Get Collections

```http
GET /api/v1/plex/libraries/1/collections
Authorization: Bearer <token>
```

### Get Collection Details

```http
GET /api/v1/plex/collections/col-123
Authorization: Bearer <token>
```

## YouTube Downloads

### Create Download

```http
POST /api/v1/youtube/download
Authorization: Bearer <token>
Content-Type: application/json
Rate-Limit: 5 requests per hour

{
  "url": "https://www.youtube.com/watch?v=example",
  "quality": "720p",
  "format": "mp4",
  "downloadPath": "/downloads/youtube"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "id": "dl-123",
    "url": "https://www.youtube.com/watch?v=example",
    "title": "Video Title",
    "status": "queued",
    "quality": "720p",
    "format": "mp4",
    "createdAt": "2023-01-01T00:00:00Z"
  }
}
```

### Get Downloads

```http
GET /api/v1/youtube/downloads?status=completed&page=1&limit=20
Authorization: Bearer <token>
```

### Get Download Details

```http
GET /api/v1/youtube/downloads/dl-123
Authorization: Bearer <token>
```

### Cancel/Delete Download

```http
DELETE /api/v1/youtube/downloads/dl-123
Authorization: Bearer <token>
```

### Get Video Metadata

```http
GET /api/v1/youtube/metadata?url=https://www.youtube.com/watch?v=example
Authorization: Bearer <token>
```

## Administration

### Get Users

```http
GET /api/v1/admin/users?page=1&limit=50&role=all
Authorization: Bearer <admin_token>
```

**Response**:

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-123",
        "email": "user@example.com",
        "name": "John Doe",
        "role": "user",
        "plexUsername": "johndoe",
        "createdAt": "2023-01-01T00:00:00Z",
        "lastLoginAt": "2023-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "totalPages": 3,
      "totalUsers": 25
    }
  }
}
```

### Update User Role

```http
PATCH /api/v1/admin/users/user-123/role
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "role": "admin"
}
```

### Delete User

```http
DELETE /api/v1/admin/users/user-123
Authorization: Bearer <admin_token>
```

### Get Services Status

```http
GET /api/v1/admin/services
Authorization: Bearer <admin_token>
```

### Get System Statistics

```http
GET /api/v1/admin/stats
Authorization: Bearer <admin_token>
```

**Response**:

```json
{
  "success": true,
  "data": {
    "users": {
      "total": 25,
      "active": 18,
      "admins": 2
    },
    "requests": {
      "pending": 5,
      "approved": 120,
      "denied": 8
    },
    "downloads": {
      "total": 350,
      "active": 3,
      "completed": 340,
      "failed": 7
    },
    "system": {
      "uptime": 86400,
      "memory": "245MB",
      "cpu": "15%"
    }
  }
}
```

### Get All Requests (Admin)

```http
GET /api/v1/admin/requests?status=pending&page=1&limit=20
Authorization: Bearer <admin_token>
```

## Health & Monitoring

### Basic Health Check

```http
GET /health
```

**Response**:

```json
{
  "status": "ok",
  "timestamp": "2023-01-01T00:00:00Z"
}
```

### Detailed Health Check

```http
GET /api/v1/health
```

**Response**:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "database": "online",
      "redis": "online",
      "plex": "online"
    },
    "timestamp": "2023-01-01T00:00:00Z"
  }
}
```

### Performance Metrics (Admin Only)

```http
GET /api/v1/health/metrics
Authorization: Bearer <admin_token>
```

### Service Status

```http
GET /api/v1/services/status
Authorization: Bearer <token>
```

### Dashboard Statistics

```http
GET /api/v1/dashboard/stats
Authorization: Bearer <token>
Cache-Control: max-age=300
```

### Dashboard Service Status

```http
GET /api/v1/dashboard/status
Authorization: Bearer <token>
```

### Get Notifications

```http
GET /api/v1/dashboard/notifications
Authorization: Bearer <token>
```

## Performance Monitoring

### Get Performance Metrics

```http
GET /api/performance/metrics?timeWindow=5&detailed=true
Authorization: Bearer <token>
```

### Get System Health

```http
GET /api/performance/health
Authorization: Bearer <token>
```

### Get Database Performance

```http
GET /api/performance/database
Authorization: Bearer <token>
```

### Get Performance Recommendations

```http
GET /api/performance/recommendations
Authorization: Bearer <token>
```

### Trigger Performance Optimization (Admin Only)

```http
POST /api/performance/optimize
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "clearCache": false
}
```

## CSRF Protection

### Get CSRF Token

```http
GET /api/v1/csrf/token
```

### Refresh CSRF Token

```http
POST /api/v1/csrf/refresh
```

### Get CSRF Statistics (Admin Only)

```http
GET /api/v1/csrf/stats
Authorization: Bearer <admin_token>
```

## Webhooks

### Overseerr Webhook

```http
POST /api/v1/webhooks/overseerr
Content-Type: application/json

{
  "notification_type": "MEDIA_APPROVED",
  "media": {
    "tmdbId": "123",
    "title": "Movie Title"
  }
}
```

## Error Reporting

### Report Frontend Errors

```http
POST /api/v1/errors/report
Authorization: Bearer <token>
Content-Type: application/json

{
  "errors": [
    {
      "timestamp": "2023-01-01T00:00:00Z",
      "level": "error",
      "message": "API request failed",
      "error": {
        "message": "Network error",
        "stack": "Error stack trace...",
        "code": "NETWORK_ERROR",
        "statusCode": 500
      },
      "context": {
        "component": "MediaSearch",
        "props": {...}
      }
    }
  ],
  "timestamp": "2023-01-01T00:00:00Z",
  "userAgent": "Mozilla/5.0...",
  "url": "/search?query=test"
}
```

### Get Recent Errors

```http
GET /api/v1/errors/recent?limit=10
Authorization: Bearer <token>
```

## WebSocket Events

MediaNest provides real-time updates via WebSocket connections on multiple namespaces:

### Namespaces

- `/` - General public events
- `/authenticated` - Authenticated user events
- `/admin` - Admin-only events
- `/media` - Media-related events
- `/system` - System status events

### Event Types

#### Download Progress

```javascript
socket.on('download:progress', (data) => {
  console.log(data);
  // {
  //   id: 'dl-123',
  //   progress: 45,
  //   status: 'downloading',
  //   speed: '1.2 MB/s',
  //   eta: '5m 30s'
  // }
});
```

#### Request Status Updates

```javascript
socket.on('request:updated', (data) => {
  console.log(data);
  // {
  //   id: 'req-123',
  //   status: 'approved',
  //   mediaTitle: 'Movie Title',
  //   updatedBy: 'admin'
  // }
});
```

#### System Notifications

```javascript
socket.on('system:notification', (data) => {
  console.log(data);
  // {
  //   type: 'info',
  //   title: 'System Update',
  //   message: 'New version available',
  //   timestamp: '2023-01-01T00:00:00Z'
  // }
});
```

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details (dev mode only)"
  },
  "correlationId": "abc123"
}
```

### Common Error Codes

| Code                  | Status | Description                |
| --------------------- | ------ | -------------------------- |
| `VALIDATION_ERROR`    | 400    | Request validation failed  |
| `UNAUTHORIZED`        | 401    | Authentication required    |
| `FORBIDDEN`           | 403    | Insufficient permissions   |
| `NOT_FOUND`           | 404    | Resource not found         |
| `RATE_LIMIT_EXCEEDED` | 429    | Too many requests          |
| `PLEX_UNREACHABLE`    | 503    | Plex server unavailable    |
| `DATABASE_ERROR`      | 503    | Database connection failed |
| `INTERNAL_ERROR`      | 500    | Unexpected server error    |

### Rate Limiting

- **Global**: 100 requests/15min (1000 in development)
- **API**: 50 requests/15min (500 in development)
- **Login**: 5 attempts/15min per IP
- **YouTube Downloads**: 5 downloads/hour per user
- **Password Reset**: 3 attempts/hour per email

### Authentication Middleware

#### Required Headers

- `Authorization: Bearer <token>` or session cookies
- `X-CSRF-Token: <csrf_token>` (for state-changing operations)
- `X-Correlation-ID: <id>` (optional, for request tracking)

### Caching Strategy

- **API Long**: 1 hour cache (server info, libraries)
- **API Medium**: 5 minutes cache (search results, recent items)
- **API Short**: 30 seconds cache (service status)
- **User Data**: 5 minutes cache (user-specific data)

### Pagination

Standard pagination format for list endpoints:

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "totalPages": 10,
      "totalItems": 250,
      "itemsPerPage": 25,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

Query parameters:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

## Security Features

- **JWT Authentication** with secure HTTP-only cookies
- **CSRF Protection** for state-changing operations
- **Rate Limiting** per IP and user
- **Input Validation** using Zod schemas
- **SQL Injection Prevention** via Prisma ORM
- **XSS Protection** through input sanitization
- **Security Headers** (HSTS, CSP, etc.)
- **Correlation IDs** for request tracking
- **Audit Logging** for security events

## Development Tools

### Environment Variables

- `NODE_ENV`: Environment mode (development/production/test)
- `FRONTEND_URL`: Frontend URL for CORS
- `PLEX_ENABLED`: Enable Plex integration
- `REDIS_ENABLED`: Enable Redis caching
- `LOG_LEVEL`: Logging level (debug/info/warn/error)

### Testing Endpoints

Available only in development mode:

- `GET /api/test/health` - Test health endpoint
- `POST /api/test/reset` - Reset test data
- `GET /api/test/performance` - Performance testing utilities
