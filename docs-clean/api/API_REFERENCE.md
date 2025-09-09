# MediaNest API Reference

**Version:** 2.0  
**Last Updated:** September 9, 2025  
**Base URL:** `http://localhost:4000/api/v1`  
**Authentication:** JWT-based with secure httpOnly cookies

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Response Format](#response-format)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Core Endpoints](#core-endpoints)
7. [WebSocket Events](#websocket-events)
8. [Status Codes](#status-codes)

## Overview

The MediaNest API provides a comprehensive REST interface for media management, authentication, and real-time communication. All endpoints follow RESTful conventions with consistent response formats and comprehensive error handling.

### Key Features

- **JWT Authentication:** Secure token-based auth with Plex OAuth integration
- **Real-time Updates:** WebSocket support for live status updates
- **Rate Limiting:** Built-in protection against abuse
- **Error Handling:** Comprehensive error responses with actionable messages
- **Validation:** Strong input validation with detailed feedback

## Authentication

### Plex OAuth Flow

MediaNest uses Plex's PIN-based OAuth system for user authentication:

1. **PIN Generation:** `POST /api/auth/plex/pin`
2. **PIN Validation:** `GET /api/auth/plex/validate`
3. **Session Creation:** Automatic JWT cookie setup on success

```javascript
// Authentication flow example
const authFlow = async () => {
  // Step 1: Request PIN
  const { pin, id } = await fetch('/api/auth/plex/pin', {
    method: 'POST'
  }).then(r => r.json());
  
  // Step 2: User visits plex.tv/link and enters PIN
  
  // Step 3: Poll for authorization
  const pollAuth = async () => {
    const result = await fetch(`/api/auth/plex/validate?id=${id}`);
    return result.json();
  };
  
  // Automatic session cookie set on success
};
```

### Session Management

- **Cookie Name:** `medianest-session`
- **Security:** httpOnly, secure, sameSite=strict
- **Expiration:** 7 days (configurable)
- **Renewal:** Automatic on activity

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Endpoint-specific data
  },
  "meta": {
    "timestamp": "2025-09-09T10:30:00Z",
    "requestId": "req_12345",
    "version": "2.0"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  },
  "meta": {
    "timestamp": "2025-09-09T10:30:00Z",
    "requestId": "req_12345"
  }
}
```

## Error Handling

### Standard HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 502 | Bad Gateway | External service error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Error Codes

```javascript
const ERROR_CODES = {
  // Authentication
  'AUTH_REQUIRED': 'Authentication required',
  'TOKEN_EXPIRED': 'Session token has expired',
  'INVALID_CREDENTIALS': 'Invalid login credentials',
  
  // Validation
  'VALIDATION_ERROR': 'Request validation failed',
  'MISSING_FIELD': 'Required field is missing',
  'INVALID_FORMAT': 'Field format is invalid',
  
  // Rate Limiting
  'RATE_LIMIT_EXCEEDED': 'Too many requests',
  'QUOTA_EXCEEDED': 'User quota exceeded',
  
  // External Services
  'PLEX_UNAVAILABLE': 'Plex server is unavailable',
  'YOUTUBE_QUOTA_EXCEEDED': 'YouTube API quota exceeded',
  
  // System
  'INTERNAL_ERROR': 'Internal server error',
  'SERVICE_UNAVAILABLE': 'Service temporarily unavailable'
};
```

## Rate Limiting

### Limits by Endpoint Category

| Category | Limit | Window |
|----------|-------|--------|
| Authentication | 10 requests | 1 minute |
| API Endpoints | 100 requests | 1 minute |
| Media Requests | 20 requests | 1 hour |
| YouTube Downloads | 5 requests | 1 hour |
| Admin Operations | 50 requests | 1 minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1694284800
X-RateLimit-Retry-After: 60
```

## Core Endpoints

### Health Check

#### `GET /api/health`

Check service health status.

**Authentication:** None required

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 86400,
    "database": "connected",
    "redis": "connected",
    "external_services": {
      "plex": "available",
      "youtube": "available"
    }
  }
}
```

### Authentication Endpoints

#### `POST /api/auth/plex/pin`

Generate Plex authentication PIN.

**Request Body:** None

**Response:**

```json
{
  "success": true,
  "data": {
    "pin": "ABCD",
    "id": "pin_12345",
    "expires_at": "2025-09-09T10:35:00Z",
    "auth_url": "https://plex.tv/link"
  }
}
```

#### `GET /api/auth/plex/validate`

Validate Plex authentication PIN.

**Query Parameters:**
- `id` (string, required): PIN identifier from pin generation

**Response:**

```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "user": {
      "id": "user_12345",
      "username": "john_doe",
      "email": "john@example.com"
    }
  }
}
```

#### `POST /api/auth/logout`

Logout current session.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

### Dashboard Endpoints

#### `GET /api/dashboard/status`

Get real-time service status information.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "services": {
      "plex": {
        "status": "online",
        "response_time": 150,
        "last_check": "2025-09-09T10:30:00Z"
      },
      "overseerr": {
        "status": "online",
        "response_time": 200,
        "last_check": "2025-09-09T10:30:00Z"
      }
    },
    "system": {
      "cpu_usage": 25.5,
      "memory_usage": 512,
      "disk_usage": 75.2
    }
  }
}
```

### Media Endpoints

#### `GET /api/media/search`

Search for media across integrated services.

**Authentication:** Required

**Query Parameters:**
- `q` (string, required): Search query
- `type` (string, optional): Media type (movie, tv, music)
- `limit` (integer, optional): Results limit (default: 20, max: 100)

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "tt0111161",
        "title": "The Shawshank Redemption",
        "type": "movie",
        "year": 1994,
        "poster": "https://image.tmdb.org/poster.jpg",
        "available_on": ["plex"],
        "requestable": true
      }
    ],
    "total": 1,
    "page": 1,
    "pages": 1
  }
}
```

#### `POST /api/media/request`

Submit a media request.

**Authentication:** Required

**Request Body:**

```json
{
  "media_id": "tt0111161",
  "media_type": "movie",
  "title": "The Shawshank Redemption",
  "year": 1994
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "request_id": "req_12345",
    "status": "pending",
    "estimated_availability": "2025-09-10T00:00:00Z"
  }
}
```

#### `GET /api/media/requests`

Get user's media requests.

**Authentication:** Required

**Query Parameters:**
- `status` (string, optional): Filter by status (pending, approved, completed)
- `limit` (integer, optional): Results limit (default: 20)
- `offset` (integer, optional): Results offset (default: 0)

**Response:**

```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "req_12345",
        "title": "The Shawshank Redemption",
        "type": "movie",
        "status": "pending",
        "requested_at": "2025-09-09T10:00:00Z",
        "updated_at": "2025-09-09T10:05:00Z"
      }
    ],
    "total": 1,
    "has_more": false
  }
}
```

### YouTube Endpoints

#### `POST /api/youtube/download`

Submit YouTube playlist for download.

**Authentication:** Required

**Request Body:**

```json
{
  "playlist_url": "https://youtube.com/playlist?list=PLxyz123",
  "quality": "720p",
  "format": "mp4"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "download_id": "dl_12345",
    "status": "queued",
    "estimated_completion": "2025-09-09T11:00:00Z",
    "playlist_info": {
      "title": "My Playlist",
      "video_count": 10
    }
  }
}
```

#### `GET /api/youtube/downloads`

Get user's YouTube downloads.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "downloads": [
      {
        "id": "dl_12345",
        "playlist_title": "My Playlist",
        "status": "completed",
        "progress": 100,
        "created_at": "2025-09-09T10:00:00Z",
        "completed_at": "2025-09-09T10:30:00Z"
      }
    ]
  }
}
```

### Admin Endpoints

#### `GET /api/admin/users`

Get all system users (Admin only).

**Authentication:** Required (Admin role)

**Response:**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_12345",
        "username": "john_doe",
        "email": "john@example.com",
        "role": "user",
        "status": "active",
        "created_at": "2025-09-01T10:00:00Z",
        "last_login": "2025-09-09T09:00:00Z"
      }
    ],
    "total": 1
  }
}
```

## WebSocket Events

### Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:4000', {
  withCredentials: true // Include auth cookies
});

socket.on('connect', () => {
  console.log('Connected to MediaNest');
});
```

### Event Types

#### Service Status Updates

```javascript
socket.on('service:status', (data) => {
  console.log('Service status:', data);
  // {
  //   service: 'plex',
  //   status: 'online',
  //   response_time: 150
  // }
});
```

#### Download Progress

```javascript
socket.on('download:progress', (data) => {
  console.log('Download progress:', data);
  // {
  //   download_id: 'dl_12345',
  //   progress: 45,
  //   current_video: 'Video Title',
  //   total_videos: 10
  // }
});
```

#### Notifications

```javascript
socket.on('notification', (data) => {
  console.log('Notification:', data);
  // {
  //   type: 'success',
  //   message: 'Media request approved',
  //   action: 'media_request_approved',
  //   data: { request_id: 'req_12345' }
  // }
});
```

## Status Codes

### Custom Application Codes

```javascript
const APP_STATUS_CODES = {
  // Success (2xx)
  SUCCESS: 200,
  CREATED: 201,
  ACCEPTED: 202,
  
  // Client Errors (4xx)
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  
  // Server Errors (5xx)
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  
  // Custom Errors (6xx)
  EXTERNAL_SERVICE_ERROR: 600,
  QUOTA_EXCEEDED: 601,
  PROCESSING_ERROR: 602
};
```

---

## 📚 Related Documentation

- [WebSocket Events](WEBSOCKET_EVENTS.md) - Detailed WebSocket event documentation
- [Authentication Guide](AUTHENTICATION.md) - Complete authentication flow
- [Error Handling](../development/ERROR_HANDLING.md) - Error handling best practices
- [Rate Limiting](../security/RATE_LIMITING.md) - Rate limiting implementation details

---

**API Documentation Status:** ✅ Complete and Production Ready  
**Last Validation:** September 9, 2025  
**Breaking Changes:** None since v1.0