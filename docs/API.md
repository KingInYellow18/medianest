# MediaNest API Reference

**Version:** 1.0  
**Base URL:** `http://localhost:4000/api/v1`  
**Authentication:** JWT-based authentication using secure httpOnly cookies

## Table of Contents

- [Authentication](#authentication)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)
  - [Health Check](#health-check)
  - [Authentication](#authentication-endpoints)
  - [Dashboard](#dashboard-endpoints)
  - [Media](#media-endpoints)
  - [Plex](#plex-endpoints)
  - [YouTube](#youtube-endpoints)
  - [Error Reporting](#error-reporting-endpoints)
  - [Admin](#admin-endpoints)
  - [Webhooks](#webhooks-endpoints)

## Authentication

Most endpoints require authentication via JWT tokens stored in secure httpOnly cookies. The authentication flow uses Plex OAuth with PIN verification.

### Headers

Authenticated requests automatically include the JWT cookie. No manual header configuration is required when using the frontend API client.

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data specific to the endpoint
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

The API uses standard HTTP status codes and consistent error response formats:

- `400` - Bad Request (validation errors, malformed input)
- `401` - Unauthorized (missing or invalid authentication)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error
- `502` - Bad Gateway (external service error)
- `503` - Service Unavailable (service temporarily down)

## Rate Limiting

- **API Endpoints:** 100 requests per minute per user
- **Authentication:** 10 requests per minute per IP
- **YouTube Downloads:** 5 requests per hour per user

Rate limit headers are included in responses:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)

## Endpoints

### Health Check

#### GET /api/health

Check the health status of the backend service.

**Authentication:** Not required

**Response:**

```json
{
  "status": "healthy",
  "service": "backend",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600
}
```

---

### Authentication Endpoints

#### POST /api/v1/auth/plex/pin

Generate a Plex PIN for OAuth authentication flow.

**Authentication:** Not required

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 123456,
    "code": "ABCD-EFGH-IJKL-MNOP",
    "clientIdentifier": "medianest-client-id",
    "expiresAt": "2025-01-15T12:30:00.000Z",
    "authUrl": "https://app.plex.tv/auth#?clientID=..."
  }
}
```

#### POST /api/v1/auth/plex/verify

Verify Plex PIN and create authenticated session.

**Authentication:** Not required

**Request Body:**

```json
{
  "pinId": 123456,
  "clientIdentifier": "medianest-client-id"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "plexId": "plex-user-id",
      "username": "johndoe",
      "email": "john@example.com",
      "thumb": "https://plex.tv/users/avatar.jpg",
      "role": "user",
      "createdAt": "2025-01-15T12:00:00.000Z"
    }
  }
}
```

#### POST /api/v1/auth/logout

End the current user session.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### GET /api/v1/auth/session

Get current session information.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "plexId": "plex-user-id",
      "username": "johndoe",
      "email": "john@example.com",
      "thumb": "https://plex.tv/users/avatar.jpg",
      "role": "user"
    },
    "expiresAt": "2025-01-16T12:00:00.000Z"
  }
}
```

---

### Dashboard Endpoints

#### GET /api/v1/dashboard/stats

Get dashboard statistics for the authenticated user.

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
    "downloadsInProgress": 2,
    "totalDownloads": 15
  }
}
```

#### GET /api/v1/dashboard/status

Get status of all integrated services.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "services": [
      {
        "name": "plex",
        "displayName": "Plex Media Server",
        "status": "online",
        "responseTime": 123,
        "lastChecked": "2025-01-15T12:00:00.000Z",
        "version": "1.40.0.1234",
        "details": {
          "totalLibraries": 5,
          "totalMedia": 1234
        }
      },
      {
        "name": "overseerr",
        "displayName": "Overseerr",
        "status": "online",
        "responseTime": 89,
        "lastChecked": "2025-01-15T12:00:00.000Z",
        "version": "1.33.2"
      }
    ]
  }
}
```

#### GET /api/v1/dashboard/status/:service

Get status of a specific service.

**Authentication:** Required

**Parameters:**

- `service`: Service name (plex, overseerr, uptime-kuma, youtube-dl)

**Response:**

```json
{
  "success": true,
  "data": {
    "name": "plex",
    "displayName": "Plex Media Server",
    "status": "online",
    "responseTime": 123,
    "lastChecked": "2025-01-15T12:00:00.000Z",
    "version": "1.40.0.1234",
    "details": {
      "totalLibraries": 5,
      "totalMedia": 1234
    }
  }
}
```

#### GET /api/v1/dashboard/notifications

Get user notifications.

**Authentication:** Required

**Query Parameters:**

- `unread`: boolean - Filter only unread notifications
- `limit`: number - Maximum notifications to return (default: 20)
- `offset`: number - Pagination offset (default: 0)

**Response:**

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "request_approved",
        "title": "Media Request Approved",
        "message": "Your request for 'Movie Title' has been approved",
        "read": false,
        "createdAt": "2025-01-15T12:00:00.000Z",
        "metadata": {
          "requestId": "request-uuid",
          "mediaType": "movie",
          "tmdbId": "12345"
        }
      }
    ],
    "pagination": {
      "total": 42,
      "limit": 20,
      "offset": 0
    }
  }
}
```

---

### Media Endpoints

#### GET /api/v1/media/search

Search for media across integrated services.

**Authentication:** Required

**Query Parameters:**

- `q`: string (required) - Search query
- `type`: string - Filter by media type (movie, tv, all) (default: all)
- `page`: number - Page number for pagination (default: 1)
- `limit`: number - Results per page (default: 20, max: 100)

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
        "backdropPath": "/path/to/backdrop.jpg",
        "status": {
          "inPlex": true,
          "requested": false,
          "available": true
        }
      }
    ],
    "pagination": {
      "page": 1,
      "totalPages": 5,
      "totalResults": 89
    }
  }
}
```

#### GET /api/v1/media/:mediaType/:tmdbId

Get detailed information about specific media.

**Authentication:** Required

**Parameters:**

- `mediaType`: movie or tv
- `tmdbId`: TMDB ID of the media

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "movie-12345",
    "tmdbId": "12345",
    "imdbId": "tt1234567",
    "title": "Movie Title",
    "type": "movie",
    "year": 2024,
    "releaseDate": "2024-06-15",
    "runtime": 120,
    "overview": "Detailed movie description...",
    "tagline": "Movie tagline",
    "genres": ["Action", "Adventure"],
    "posterPath": "/path/to/poster.jpg",
    "backdropPath": "/path/to/backdrop.jpg",
    "rating": 8.5,
    "voteCount": 1234,
    "status": {
      "inPlex": true,
      "requested": false,
      "available": true,
      "plexUrl": "plex://movie/12345"
    },
    "cast": [
      {
        "id": "person-123",
        "name": "Actor Name",
        "character": "Character Name",
        "profilePath": "/path/to/profile.jpg"
      }
    ],
    "crew": [
      {
        "id": "person-456",
        "name": "Director Name",
        "job": "Director",
        "department": "Directing",
        "profilePath": "/path/to/profile.jpg"
      }
    ]
  }
}
```

#### POST /api/v1/media/request

Submit a request for new media.

**Authentication:** Required

**Request Body:**

```json
{
  "title": "Movie Title",
  "mediaType": "movie",
  "tmdbId": "12345",
  "overseerrId": "overseerr-request-id"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "request": {
      "id": "uuid",
      "title": "Movie Title",
      "mediaType": "movie",
      "tmdbId": "12345",
      "overseerrId": "overseerr-request-id",
      "status": "pending",
      "userId": "user-uuid",
      "createdAt": "2025-01-15T12:00:00.000Z",
      "updatedAt": "2025-01-15T12:00:00.000Z"
    }
  }
}
```

#### GET /api/v1/media/requests

Get all media requests for the authenticated user.

**Authentication:** Required

**Query Parameters:**

- `status`: string - Filter by status (pending, approved, declined, available)
- `mediaType`: string - Filter by type (movie, tv)
- `page`: number - Page number (default: 1)
- `limit`: number - Results per page (default: 20, max: 100)
- `sort`: string - Sort field (createdAt, updatedAt) (default: createdAt)
- `order`: string - Sort order (asc, desc) (default: desc)

**Response:**

```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "uuid",
        "title": "Movie Title",
        "mediaType": "movie",
        "tmdbId": "12345",
        "overseerrId": "overseerr-request-id",
        "status": "pending",
        "userId": "user-uuid",
        "createdAt": "2025-01-15T12:00:00.000Z",
        "updatedAt": "2025-01-15T12:00:00.000Z",
        "media": {
          "posterPath": "/path/to/poster.jpg",
          "year": 2024,
          "overview": "Movie description..."
        }
      }
    ],
    "pagination": {
      "page": 1,
      "totalPages": 3,
      "totalItems": 42,
      "limit": 20
    }
  }
}
```

#### GET /api/v1/media/requests/:requestId

Get details of a specific media request.

**Authentication:** Required

**Parameters:**

- `requestId`: UUID of the request

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Movie Title",
    "mediaType": "movie",
    "tmdbId": "12345",
    "overseerrId": "overseerr-request-id",
    "status": "pending",
    "userId": "user-uuid",
    "createdAt": "2025-01-15T12:00:00.000Z",
    "updatedAt": "2025-01-15T12:00:00.000Z",
    "statusHistory": [
      {
        "status": "pending",
        "timestamp": "2025-01-15T12:00:00.000Z",
        "comment": "Request submitted"
      }
    ],
    "media": {
      "title": "Movie Title",
      "posterPath": "/path/to/poster.jpg",
      "backdropPath": "/path/to/backdrop.jpg",
      "year": 2024,
      "overview": "Movie description...",
      "genres": ["Action", "Adventure"],
      "runtime": 120,
      "rating": 8.5
    }
  }
}
```

#### DELETE /api/v1/media/requests/:requestId

Delete a pending media request.

**Authentication:** Required

**Parameters:**

- `requestId`: UUID of the request

**Response:**

```json
{
  "success": true,
  "message": "Request deleted successfully"
}
```

**Note:** Only pending requests can be deleted. Users can only delete their own requests.

---

### Plex Endpoints

#### GET /api/v1/plex/server

Get Plex server information.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "name": "My Plex Server",
    "version": "1.40.0.1234",
    "platform": "Linux",
    "platformVersion": "Ubuntu 22.04",
    "device": "PC",
    "machineIdentifier": "server-machine-id",
    "size": 15678234567,
    "libraries": 5,
    "users": 12
  }
}
```

#### GET /api/v1/plex/libraries

Get all Plex libraries.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "libraries": [
      {
        "key": "1",
        "title": "Movies",
        "type": "movie",
        "agent": "tv.plex.agents.movie",
        "scanner": "Plex Movie",
        "language": "en",
        "createdAt": "2023-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-15T12:00:00.000Z",
        "scannedAt": "2025-01-15T10:00:00.000Z",
        "contentChangedAt": "2025-01-15T09:00:00.000Z",
        "itemCount": 523
      }
    ]
  }
}
```

#### GET /api/v1/plex/libraries/:libraryKey/items

Get items from a specific Plex library.

**Authentication:** Required

**Parameters:**

- `libraryKey`: Library section key

**Query Parameters:**

- `page`: number - Page number (default: 1)
- `limit`: number - Items per page (default: 50, max: 100)
- `sort`: string - Sort field (addedAt, originallyAvailableAt, lastViewedAt, titleSort)
- `order`: string - Sort order (asc, desc) (default: desc)
- `filter`: string - Filter type (all, unwatched, recentlyAdded)

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "ratingKey": "12345",
        "key": "/library/metadata/12345",
        "guid": "plex://movie/12345",
        "type": "movie",
        "title": "Movie Title",
        "titleSort": "Movie Title",
        "summary": "Movie summary...",
        "year": 2024,
        "thumb": "/library/metadata/12345/thumb",
        "art": "/library/metadata/12345/art",
        "duration": 7200000,
        "originallyAvailableAt": "2024-06-15",
        "addedAt": "2025-01-10T10:00:00.000Z",
        "updatedAt": "2025-01-10T10:00:00.000Z",
        "viewCount": 5,
        "lastViewedAt": "2025-01-14T20:00:00.000Z",
        "contentRating": "PG-13",
        "audienceRating": 8.5,
        "genres": ["Action", "Adventure"],
        "directors": ["Director Name"],
        "actors": ["Actor 1", "Actor 2"]
      }
    ],
    "pagination": {
      "page": 1,
      "totalPages": 11,
      "totalItems": 523,
      "limit": 50
    }
  }
}
```

#### GET /api/v1/plex/search

Search across all Plex libraries.

**Authentication:** Required

**Query Parameters:**

- `q`: string (required) - Search query
- `type`: string - Filter by type (movie, show, episode, all) (default: all)
- `limit`: number - Maximum results (default: 20, max: 100)

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "ratingKey": "12345",
        "type": "movie",
        "title": "Movie Title",
        "year": 2024,
        "thumb": "/library/metadata/12345/thumb",
        "summary": "Movie summary...",
        "library": "Movies",
        "libraryKey": "1"
      }
    ],
    "totalResults": 15
  }
}
```

#### GET /api/v1/plex/recently-added

Get recently added items across all libraries.

**Authentication:** Required

**Query Parameters:**

- `limit`: number - Maximum items to return (default: 20, max: 100)
- `type`: string - Filter by type (movie, show, episode, all) (default: all)

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "ratingKey": "12345",
        "type": "movie",
        "title": "Movie Title",
        "year": 2024,
        "thumb": "/library/metadata/12345/thumb",
        "summary": "Movie summary...",
        "addedAt": "2025-01-15T10:00:00.000Z",
        "library": "Movies",
        "libraryKey": "1"
      }
    ]
  }
}
```

---

### YouTube Endpoints

**Note:** These endpoints are currently not implemented (TODO).

#### POST /api/v1/youtube/download

Submit a YouTube playlist for download.

**Authentication:** Required

**Status:** Not Implemented

**Expected Request Body:**

```json
{
  "url": "https://www.youtube.com/playlist?list=PLxxxxxxxx",
  "quality": "best",
  "format": "mp4"
}
```

#### GET /api/v1/youtube/downloads

Get user's YouTube downloads.

**Authentication:** Required

**Status:** Not Implemented

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "downloads": [
      {
        "id": "uuid",
        "url": "https://www.youtube.com/playlist?list=PLxxxxxxxx",
        "title": "Playlist Title",
        "status": "downloading",
        "progress": 45,
        "totalVideos": 10,
        "completedVideos": 4,
        "createdAt": "2025-01-15T12:00:00.000Z",
        "updatedAt": "2025-01-15T12:15:00.000Z"
      }
    ]
  }
}
```

---

### Error Reporting Endpoints

#### POST /api/v1/errors/report

Report errors from the frontend application.

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
        "stack": "Error: Network request failed\n    at fetchMedia...",
        "code": "NETWORK_ERROR",
        "statusCode": 502
      },
      "context": {
        "component": "MediaDetailsPage",
        "mediaId": "12345",
        "userAction": "viewDetails"
      }
    }
  ],
  "timestamp": "2025-01-15T12:00:00.000Z",
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

#### GET /api/v1/errors/recent

Get recent errors (user's own errors, or all errors for admins).

**Authentication:** Required

**Query Parameters:**

- `limit`: number - Maximum errors to return (default: 10, max: 100)

**Response:**

```json
{
  "success": true,
  "data": {
    "errors": [
      {
        "id": "uuid",
        "timestamp": "2025-01-15T12:00:00.000Z",
        "level": "error",
        "message": "Failed to load media details",
        "userId": "user-uuid",
        "username": "johndoe",
        "correlationId": "err_abc123xyz",
        "error": {
          "message": "Network request failed",
          "code": "NETWORK_ERROR",
          "statusCode": 502
        },
        "context": {
          "component": "MediaDetailsPage",
          "mediaId": "12345"
        },
        "userAgent": "Mozilla/5.0...",
        "url": "https://medianest.local/media/movie/12345"
      }
    ]
  }
}
```

---

### Admin Endpoints

All admin endpoints require authentication with admin role.

#### GET /api/v1/admin/users

List all users in the system.

**Authentication:** Required (Admin only)

**Status:** Not Implemented

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "plexId": "plex-user-id",
        "username": "johndoe",
        "email": "john@example.com",
        "role": "user",
        "createdAt": "2025-01-01T00:00:00.000Z",
        "lastLoginAt": "2025-01-15T10:00:00.000Z",
        "requestCount": 15,
        "downloadCount": 8
      }
    ]
  }
}
```

#### GET /api/v1/admin/services

Get all service configurations.

**Authentication:** Required (Admin only)

**Status:** Not Implemented

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "services": [
      {
        "name": "plex",
        "displayName": "Plex Media Server",
        "enabled": true,
        "url": "https://plex.local:32400",
        "configured": true,
        "lastHealthCheck": "2025-01-15T12:00:00.000Z",
        "status": "online"
      }
    ]
  }
}
```

#### GET /api/v1/admin/requests

Get all media requests across all users.

**Authentication:** Required (Admin only)

**Query Parameters:**

- `status`: string - Filter by status
- `userId`: string - Filter by user
- `page`: number - Page number (default: 1)
- `limit`: number - Results per page (default: 20)

**Response:**

```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "uuid",
        "title": "Movie Title",
        "mediaType": "movie",
        "tmdbId": "12345",
        "status": "pending",
        "userId": "user-uuid",
        "user": {
          "username": "johndoe",
          "email": "john@example.com"
        },
        "createdAt": "2025-01-15T12:00:00.000Z",
        "updatedAt": "2025-01-15T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "totalPages": 5,
      "totalItems": 89,
      "limit": 20
    }
  }
}
```

---

### Webhooks Endpoints

#### POST /api/v1/webhooks/overseerr

Receive webhook notifications from Overseerr.

**Authentication:** Not required (TODO: Implement signature verification)

**Request Body:** Overseerr webhook payload (varies by event type)

**Response:**

```json
{
  "success": true,
  "message": "Webhook processed"
}
```

**Note:** Signature verification should be implemented to ensure webhooks are from Overseerr.

---

## WebSocket Events

MediaNest uses Socket.io for real-time updates. Connect to the WebSocket server at the same host on port 4000.

### Connection

```javascript
const socket = io('http://localhost:4000', {
  withCredentials: true,
});
```

### Events

#### service:status

Real-time service status updates

```json
{
  "service": "plex",
  "status": "online",
  "responseTime": 123,
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

#### request:update

Media request status changes

```json
{
  "requestId": "uuid",
  "status": "approved",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

#### download:progress

YouTube download progress updates

```json
{
  "downloadId": "uuid",
  "progress": 75,
  "completedVideos": 7,
  "totalVideos": 10,
  "currentVideo": "Video Title"
}
```

#### user:notification

User-specific notifications

```json
{
  "id": "uuid",
  "type": "request_completed",
  "title": "Media Available",
  "message": "Your requested movie is now available",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

---

## Status Codes Reference

### Success Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `204 No Content` - Request succeeded with no response body

### Client Error Codes

- `400 Bad Request` - Invalid request format or parameters
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `422 Unprocessable Entity` - Validation failed
- `429 Too Many Requests` - Rate limit exceeded

### Server Error Codes

- `500 Internal Server Error` - Unexpected server error
- `502 Bad Gateway` - External service error
- `503 Service Unavailable` - Service temporarily unavailable

---

## Common Error Codes

- `UNAUTHORIZED` - Missing or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Input validation failed
- `DUPLICATE_RESOURCE` - Resource already exists
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `EXTERNAL_SERVICE_ERROR` - External service failure
- `INTERNAL_ERROR` - Unexpected server error

---

## SDK Integration

### JavaScript/TypeScript

```typescript
// Using the API client
import { MediaNestAPI } from '@medianest/frontend/lib/api';

const api = new MediaNestAPI({
  baseURL: 'http://localhost:4000/api/v1',
});

// Search for media
const results = await api.media.search({
  q: 'Breaking Bad',
  type: 'tv',
});

// Submit a request
const request = await api.media.createRequest({
  title: 'Breaking Bad',
  mediaType: 'tv',
  tmdbId: '1396',
});
```

### cURL Examples

```bash
# Get Plex PIN
curl -X POST http://localhost:4000/api/v1/auth/plex/pin

# Search media (authenticated)
curl -X GET "http://localhost:4000/api/v1/media/search?q=inception" \
  -H "Cookie: medianest_session=your-session-cookie"

# Submit media request
curl -X POST http://localhost:4000/api/v1/media/request \
  -H "Content-Type: application/json" \
  -H "Cookie: medianest_session=your-session-cookie" \
  -d '{
    "title": "Inception",
    "mediaType": "movie",
    "tmdbId": "27205"
  }'
```

---

## Changelog

### Version 1.0.0 (2025-01-15)

- Initial API documentation
- Complete endpoints for auth, dashboard, media, and Plex
- WebSocket event documentation
- Rate limiting implementation
- Error handling standardization

### Upcoming Features

- YouTube download endpoints implementation
- Admin user management endpoints
- Service configuration endpoints
- OpenAPI/Swagger specification
- Webhook signature verification
- Pagination for all list endpoints
- Response envelope standardization
