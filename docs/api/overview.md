# MediaNest API Overview

MediaNest provides a comprehensive RESTful API for managing media requests, Plex integration, and dashboard monitoring. The API follows REST principles with JSON request/response bodies and proper HTTP status codes.

## Base URL

- **Development**: `http://localhost:3000/api` (Next.js dev server)
- **Production**: `https://your-domain.com/api` (Docker Compose with Nginx)
- **Backend Direct**: `http://localhost:4000/api` (Express server, development only)

**Note**: In production Docker Compose deployment, all API requests go through the Nginx reverse proxy at your configured domain.

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
# Development
curl -X POST http://localhost:3000/api/auth/plex/pin \
  -H "Content-Type: application/json"

# Production
curl -X POST https://your-domain.com/api/auth/plex/pin \
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
# Development
curl -X POST http://localhost:3000/api/auth/plex/verify \
  -H "Content-Type: application/json" \
  -d '{"pinId": "12345"}'

# Production
curl -X POST https://your-domain.com/api/auth/plex/verify \
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
# Development
curl http://localhost:3000/api/auth/session \
  -H "Cookie: token=<jwt-token>"

# Production
curl https://your-domain.com/api/auth/session \
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
  "details": ["Title is required", "MediaType must be 'movie' or 'tv'"]
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

- `GET /health` - Simple health check for Docker containers
- `GET /api/health` - Detailed health check with system metrics
- `GET /api/health/readiness` - Kubernetes readiness probe with database/Redis status
- `POST /api/auth/plex/pin` - Generate Plex authentication PIN code
- `GET /api/auth/plex/pin/:id/status` - Check PIN authorization status
- `POST /api/auth/plex` - Complete Plex OAuth flow and create session
- `POST /api/auth/admin` - Admin bootstrap authentication (first user only)
- `POST /api/auth/login` - Password-based authentication (admin users)
- `POST /api/webhooks/*` - External service webhooks (Overseerr, etc.)
- `GET /api/csrf` - Get CSRF protection token

### Protected Endpoints (Authentication Required)

#### Authentication & Session Management

- `GET /api/auth/session` - Get current authenticated user session info
- `POST /api/auth/logout` - Logout user and invalidate session
- `POST /api/auth/change-password` - Change user password (admin users)

#### Dashboard & Analytics

- `GET /api/dashboard/stats` - User-specific dashboard statistics
- `GET /api/dashboard/metrics` - System-wide dashboard metrics (cached 5min)
- `GET /api/dashboard/activity` - Recent system activity feed
- `GET /api/dashboard/notifications` - User notifications (currently empty MVP)
- `GET /api/dashboard/status` - All service health statuses
- `GET /api/dashboard/status/:service` - Specific service health status

#### Media Management

- `GET /api/media/search` - Search media via Overseerr/TMDB integration
- `GET /api/media/:mediaType/:tmdbId` - Get detailed media information
- `POST /api/media/request` - Submit new media request
- `GET /api/media/requests` - Get user's media requests (paginated, filterable)
- `GET /api/media/requests/:requestId` - Get specific request details
- `DELETE /api/media/requests/:requestId` - Delete pending media request
- `GET /api/media/requests/all` - Get all requests (admin only)

#### Plex Integration

- `GET /api/plex/server` - Get Plex server information and status
- `GET /api/plex/libraries` - Get all available Plex media libraries
- `GET /api/plex/libraries/:libraryKey/items` - Get items from specific library (paginated)
- `GET /api/plex/search` - Search across all Plex libraries
- `GET /api/plex/recently-added` - Get recently added items from Plex
- `GET /api/plex/collections/:libraryKey` - Get collections from library
- `GET /api/plex/collections/:collectionKey/details` - Get collection details

#### YouTube Downloads

- `POST /api/youtube/download` - Create new YouTube download job (rate limited: 5/hour)
- `GET /api/youtube/downloads` - Get user's download history (paginated)
- `GET /api/youtube/downloads/:id` - Get specific download details and progress
- `DELETE /api/youtube/downloads/:id` - Cancel/delete download job
- `GET /api/youtube/metadata` - Get video metadata without downloading

### Admin Endpoints (Admin Role Required)

#### User Management

- `GET /api/admin/users` - Get all users (paginated, searchable, sortable)
- `PUT /api/admin/users/:userId/role` - Update user role (user/admin)
- `DELETE /api/admin/users/:userId` - Delete user account (with safeguards)
- `GET /api/admin/stats` - Get comprehensive system statistics

#### Service Management

- `GET /api/admin/services` - Get all service configurations
- `PUT /api/admin/services/:service` - Update service configuration
- `GET /api/admin/logs` - Access system logs (if implemented)
- `POST /api/admin/backup` - Create system backup (if implemented)

For detailed endpoint documentation, see:

- [Authentication Endpoints](endpoints/auth.md) - Plex OAuth, admin bootstrap, session management
- [Dashboard Endpoints](endpoints/dashboard.md) - Statistics, metrics, service status
- [Media Endpoints](endpoints/media.md) - Search, requests, and media management
- [Plex Endpoints](endpoints/plex.md) - Server integration and library access
- [Admin Endpoints](endpoints/admin.md) - User management and system administration
- [YouTube Endpoints](endpoints/youtube.md) - Video downloads and queue management
- [Authentication Flows](authentication-flows.md) - Detailed flow diagrams and security

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
