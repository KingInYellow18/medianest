# MediaNest API Overview

MediaNest provides a comprehensive RESTful API for managing media requests, Plex integration, and dashboard monitoring. The API follows REST principles with JSON request/response bodies and proper HTTP status codes.

## Base URL

- **Development**: `http://localhost:3001/api/v1`
- **Production**: `https://api.medianest.io/api/v1`

## Authentication

MediaNest uses **Plex OAuth** for user authentication with JWT tokens for session management.

### Authentication Flow

1. **Generate PIN**: `POST /auth/plex/pin`
   - Returns a PIN code and authorization URL
   - PIN expires in 10 minutes

2. **User Authorization**: 
   - User visits the authorization URL
   - Enters the PIN code on Plex website
   - Authorizes MediaNest application

3. **Verify PIN**: `POST /auth/plex/verify`
   - Verify the PIN and create user session
   - Returns JWT token set in HTTP-only cookie

4. **Authenticated Requests**:
   - JWT token automatically sent with requests via cookies
   - Alternatively, include `Authorization: Bearer <token>` header

### Authentication Examples

#### Generate PIN
```bash
curl -X POST http://localhost:3001/api/v1/auth/plex/pin \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "id": "12345",
  "code": "ABCD",
  "url": "https://app.plex.tv/auth/#!?clientID=...",
  "expires_in": 600
}
```

#### Verify PIN
```bash
curl -X POST http://localhost:3001/api/v1/auth/plex/verify \
  -H "Content-Type: application/json" \
  -d '{"pinId": "12345"}'
```

Response:
```json
{
  "success": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Get Current Session
```bash
curl http://localhost:3001/api/v1/auth/session \
  -H "Cookie: token=<jwt-token>"
```

## API Features

### Rate Limiting
- API endpoints are rate-limited to prevent abuse
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`: Request limit per window
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset time

### Caching
- Static data cached with appropriate cache headers
- Cache times vary by endpoint:
  - Plex server info: Long-term (1 hour)
  - Dashboard stats: Medium-term (5 minutes)
  - Notifications: No cache (real-time)

### Error Handling
All API endpoints return consistent error responses:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "details": ["Additional error details"]
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### Request/Response Format

#### Content Type
- All requests should use `Content-Type: application/json`
- All responses return `application/json`

#### Request Body Example
```json
{
  "title": "The Matrix",
  "mediaType": "movie",
  "tmdbId": "603"
}
```

#### Success Response Example
```json
{
  "id": "req-123",
  "title": "The Matrix",
  "status": "pending",
  "createdAt": "2023-12-01T10:00:00Z"
}
```

#### Error Response Example
```json
{
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    "Title is required",
    "MediaType must be 'movie' or 'tv'"
  ]
}
```

## Security

### CSRF Protection
- CSRF tokens required for state-changing operations
- Tokens provided via `/auth/plex/verify` endpoint
- Include `X-CSRF-Token` header in requests

### CORS
- CORS enabled for allowed origins
- Credentials (cookies) allowed for authenticated requests

### Request Security
- Request body size limited to prevent abuse
- Input validation on all endpoints
- SQL injection protection via parameterized queries
- XSS protection via input sanitization

## Pagination

List endpoints support pagination with query parameters:

- `limit`: Number of items per page (default: 20, max: 100)
- `offset`: Number of items to skip (default: 0)

Example:
```bash
curl "http://localhost:3001/api/v1/media/requests?limit=10&offset=20"
```

Response includes pagination metadata:
```json
{
  "requests": [...],
  "total": 150,
  "hasMore": true
}
```

## Available Endpoints

### Public Endpoints (No Authentication Required)
- `GET /health` - Simple health check for Docker
- `GET /api/health` - Detailed health check with system status
- `POST /api/v1/auth/plex/pin` - Generate Plex authentication PIN
- `POST /api/v1/auth/plex/verify` - Verify PIN and authenticate user
- `POST /api/v1/webhooks/*` - External webhooks (Overseerr, etc.)
- `GET /api/v1/csrf` - Get CSRF token
- `GET /api/v1/resilience/*` - System resilience monitoring

### Protected Endpoints (Authentication Required)
- `GET /api/v1/auth/session` - Get current user session
- `POST /api/v1/auth/logout` - Logout user
- `GET /api/v1/dashboard/*` - Dashboard statistics and status
- `GET /api/v1/media/*` - Media search, requests, and management
- `GET /api/v1/services/*` - External service status and configuration
- `GET /api/v1/plex/*` - Plex server integration and library access
- `POST /api/v1/youtube/*` - YouTube download management
- `GET /api/v1/performance/*` - System performance metrics
- `GET /api/v1/errors/*` - Error reporting and analytics

### Admin Endpoints (Admin Role Required)
- `GET /api/v1/admin/*` - User management and system administration
- `PUT /api/v1/admin/services/*` - Service configuration management
- `GET /api/v1/admin/config` - System configuration access

For detailed endpoint documentation, see:
- [Dashboard Endpoints](endpoints/dashboard.md)
- [Media Endpoints](endpoints/media.md) 
- [Plex Endpoints](endpoints/plex.md)

## WebSocket Events

MediaNest provides real-time updates via WebSocket connections. See [WebSocket Documentation](websocket.md) for details.

## SDK and Tools

### OpenAPI Specification
- Complete OpenAPI 3.0 specification available at `/api/openapi.yaml`
- Use with tools like Swagger UI, Postman, or code generators

### Testing
- Comprehensive test suite ensures API reliability
- Integration tests cover authentication flows
- Rate limiting and error handling tested

## Support

- **Documentation**: `/docs/api/`
- **Issues**: GitHub repository issues
- **OpenAPI Spec**: `/docs/api/openapi.yaml`

## Changelog

### v1.0.0
- Initial API release
- Plex OAuth authentication
- Media search and requests
- Dashboard statistics
- Real-time WebSocket events