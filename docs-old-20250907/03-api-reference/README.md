# API Reference

Complete documentation for MediaNest's RESTful API endpoints.

## Overview

MediaNest provides a comprehensive REST API for managing media, users, and system functionality. All API endpoints require authentication unless otherwise noted.

## Base Configuration

- **Base URL**: `http://localhost:3001/api` (development)
- **Production URL**: Configure based on deployment
- **API Version**: v1
- **Content-Type**: `application/json`
- **Authentication**: Bearer JWT tokens

## Quick Start

```bash
# Get authentication token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3001/api/media/libraries
```

## API Documentation Sections

### Core APIs

- [Authentication API](./authentication-api.md) - Login, logout, token management
- [User Management API](./user-management-api.md) - User profiles and preferences
- [Media API](./media-api.md) - Media libraries, search, metadata

### Integration APIs

- [Plex Integration API](./plex-integration-api.md) - Plex server communication
- [Search API](./search-api.md) - Full-text search across media
- [Admin API](./admin-api.md) - Administrative endpoints

### System APIs

- [Health Check API](./health-api.md) - System status and monitoring
- [Configuration API](./configuration-api.md) - System settings
- [Audit API](./audit-api.md) - Activity logging and tracking

## Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Management

```typescript
// Token structure
interface JWTToken {
  sub: string; // User ID
  email: string; // User email
  role: 'admin' | 'user';
  iat: number; // Issued at
  exp: number; // Expires at
}
```

## Error Handling

All API endpoints follow a consistent error response format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "timestamp": "2025-01-01T12:00:00.000Z",
  "path": "/api/auth/login"
}
```

### Common HTTP Status Codes

| Code | Meaning               | Usage                             |
| ---- | --------------------- | --------------------------------- |
| 200  | OK                    | Successful GET, PUT, PATCH        |
| 201  | Created               | Successful POST                   |
| 204  | No Content            | Successful DELETE                 |
| 400  | Bad Request           | Invalid request data              |
| 401  | Unauthorized          | Missing or invalid authentication |
| 403  | Forbidden             | Insufficient permissions          |
| 404  | Not Found             | Resource not found                |
| 409  | Conflict              | Resource already exists           |
| 422  | Unprocessable Entity  | Validation errors                 |
| 500  | Internal Server Error | Server error                      |
| 503  | Service Unavailable   | External service unavailable      |

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **General endpoints**: 100 requests per minute per IP
- **Authentication endpoints**: 5 requests per minute per IP
- **Search endpoints**: 30 requests per minute per user

Rate limit headers included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

## Request/Response Format

### Standard Request Format

```json
{
  "data": {
    // Request payload
  },
  "metadata": {
    "requestId": "uuid",
    "timestamp": "ISO 8601"
  }
}
```

### Standard Response Format

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasNext": true,
    "hasPrev": false
  },
  "metadata": {
    "requestId": "uuid",
    "timestamp": "ISO 8601",
    "processingTime": "25ms"
  }
}
```

## Pagination

Large datasets are paginated using cursor-based pagination:

```http
GET /api/media/items?limit=20&cursor=eyJpZCI6MTIzfQ==
```

```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "hasNext": true,
    "hasPrev": false,
    "nextCursor": "eyJpZCI6MTQ0fQ==",
    "prevCursor": null
  }
}
```

## Filtering and Sorting

### Query Parameters

```http
# Filtering
GET /api/media/items?type=movie&year=2023&genre=action

# Sorting
GET /api/media/items?sort=title&order=desc

# Full-text search
GET /api/media/search?q=inception&type=movie

# Combined
GET /api/media/items?type=movie&genre=action&sort=rating&order=desc&limit=10
```

### Supported Filter Operations

| Parameter | Description       | Example          |
| --------- | ----------------- | ---------------- |
| `q`       | Full-text search  | `?q=inception`   |
| `type`    | Media type filter | `?type=movie`    |
| `genre`   | Genre filter      | `?genre=action`  |
| `year`    | Year filter       | `?year=2023`     |
| `rating`  | Rating filter     | `?rating=8.5`    |
| `sort`    | Sort field        | `?sort=title`    |
| `order`   | Sort direction    | `?order=desc`    |
| `limit`   | Results limit     | `?limit=50`      |
| `cursor`  | Pagination cursor | `?cursor=abc123` |

## OpenAPI Specification

Complete OpenAPI 3.0 specification available at:

- **Development**: http://localhost:3001/api-docs
- **Swagger UI**: http://localhost:3001/api-docs/ui

## Testing the API

### Using curl

```bash
# Test authentication
curl -X POST http://localhost:3001/api/auth/plex/pin \
  -H "Content-Type: application/json"

# Test with authentication
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/media/libraries
```

### Using Postman

Import the OpenAPI specification into Postman for interactive testing:

1. Download spec from `/api-docs/json`
2. Import into Postman
3. Configure authentication token
4. Test endpoints interactively

### Using HTTPie

```bash
# Install HTTPie
pip install httpie

# Test endpoints
http POST localhost:3001/api/auth/login email=admin@example.com password=password
http GET localhost:3001/api/media/libraries Authorization:"Bearer $TOKEN"
```

## SDK and Client Libraries

### JavaScript/TypeScript

```typescript
import { MediaNestAPI } from '@medianest/api-client';

const client = new MediaNestAPI({
  baseURL: 'http://localhost:3001/api',
  token: 'your-jwt-token',
});

// Use the client
const libraries = await client.media.getLibraries();
const searchResults = await client.search.query('inception');
```

### Python

```python
from medianest_client import MediaNestClient

client = MediaNestClient(
    base_url='http://localhost:3001/api',
    token='your-jwt-token'
)

# Use the client
libraries = client.media.get_libraries()
search_results = client.search.query('inception')
```

## Webhooks

MediaNest supports webhooks for real-time event notifications:

```json
{
  "event": "media.added",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "data": {
    "mediaId": "123",
    "title": "New Movie",
    "type": "movie"
  }
}
```

Available webhook events:

- `media.added` - New media item added
- `media.updated` - Media metadata updated
- `user.created` - New user registered
- `library.refreshed` - Library scan completed

## Related Documentation

- [Implementation Guides](../04-implementation-guides/README.md) - How to implement features
- [Authentication Guide](../07-security/authentication.md) - Detailed auth setup
- [Testing Guide](../05-testing/api-testing.md) - API testing strategies
