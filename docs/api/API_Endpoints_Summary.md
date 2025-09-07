# MediaNest API Endpoints Summary

## Endpoint Overview

Total API endpoints identified: **75+ endpoints** across 10 major categories

### Base URLs

- **Health Check**: `GET /health` (public)
- **Metrics**: `GET /metrics` (protected)
- **API Base**: `/api/v1/*` (versioned)
- **Legacy Routes**: `/api/*` (some unversioned routes)

## Authentication Patterns

### 🔓 Public Endpoints (No Authentication)

- `GET /health` - Basic health check
- `POST /api/v1/auth/plex/pin` - Generate Plex PIN
- `GET /api/v1/csrf/token` - Get CSRF token
- `POST /api/v1/csrf/refresh` - Refresh CSRF token
- `POST /api/v1/webhooks/overseerr` - Webhook handler

### 🔒 Protected Endpoints (Authentication Required)

- All `/api/v1/*` routes except auth and public utilities
- JWT tokens via `Authorization: Bearer <token>` header or HTTP-only cookies
- CSRF tokens required for state-changing operations (`X-CSRF-Token` header)

### 👑 Admin-Only Endpoints (Admin Role Required)

- `/api/v1/admin/*` - All admin management endpoints
- `/api/v1/health/metrics` - Performance metrics
- `/api/v1/csrf/stats` - CSRF statistics
- `/api/performance/optimize` - Performance optimization trigger

## Endpoint Categories

### 1. Authentication & Security (8 endpoints)

| Method | Endpoint                    | Description         | Auth Required |
| ------ | --------------------------- | ------------------- | ------------- |
| `POST` | `/api/v1/auth/plex/pin`     | Generate Plex PIN   | ❌            |
| `POST` | `/api/v1/auth/plex/verify`  | Verify Plex PIN     | ❌            |
| `GET`  | `/api/v1/auth/session`      | Get current session | ✅            |
| `POST` | `/api/v1/auth/logout`       | Logout user         | ✅            |
| `POST` | `/api/auth/admin`           | Admin bootstrap     | ❌            |
| `POST` | `/api/auth/login`           | Password login      | ❌            |
| `POST` | `/api/auth/change-password` | Change password     | ✅            |
| `GET`  | `/api/v1/csrf/token`        | Get CSRF token      | ❌            |

### 2. Media Management (6 endpoints)

| Method   | Endpoint                      | Description         | Auth Required |
| -------- | ----------------------------- | ------------------- | ------------- |
| `GET`    | `/api/v1/media/search`        | Search media        | ✅            |
| `GET`    | `/api/v1/media/{type}/{id}`   | Get media details   | ✅            |
| `POST`   | `/api/v1/media/request`       | Request media       | ✅            |
| `GET`    | `/api/v1/media/requests`      | Get user requests   | ✅            |
| `GET`    | `/api/v1/media/requests/{id}` | Get request details | ✅            |
| `DELETE` | `/api/v1/media/requests/{id}` | Delete request      | ✅            |

### 3. Plex Integration (7 endpoints)

| Method | Endpoint                                   | Description        | Auth Required |
| ------ | ------------------------------------------ | ------------------ | ------------- |
| `GET`  | `/api/v1/plex/server`                      | Get server info    | ✅            |
| `GET`  | `/api/v1/plex/libraries`                   | Get libraries      | ✅            |
| `GET`  | `/api/v1/plex/libraries/{key}/items`       | Get library items  | ✅            |
| `GET`  | `/api/v1/plex/search`                      | Search content     | ✅            |
| `GET`  | `/api/v1/plex/recently-added`              | Recently added     | ✅            |
| `GET`  | `/api/v1/plex/libraries/{key}/collections` | Get collections    | ✅            |
| `GET`  | `/api/v1/plex/collections/{key}`           | Collection details | ✅            |

### 4. YouTube Downloads (5 endpoints)

| Method   | Endpoint                         | Description          | Auth Required | Rate Limited |
| -------- | -------------------------------- | -------------------- | ------------- | ------------ |
| `POST`   | `/api/v1/youtube/download`       | Create download      | ✅            | ✅ (5/hour)  |
| `GET`    | `/api/v1/youtube/downloads`      | Get downloads        | ✅            | ❌           |
| `GET`    | `/api/v1/youtube/downloads/{id}` | Get download details | ✅            | ❌           |
| `DELETE` | `/api/v1/youtube/downloads/{id}` | Cancel/delete        | ✅            | ❌           |
| `GET`    | `/api/v1/youtube/metadata`       | Get video metadata   | ✅            | ❌           |

### 5. Administration (7 endpoints)

| Method   | Endpoint                        | Description         | Admin Only |
| -------- | ------------------------------- | ------------------- | ---------- |
| `GET`    | `/api/v1/admin/users`           | Get all users       | 👑         |
| `PATCH`  | `/api/v1/admin/users/{id}/role` | Update user role    | 👑         |
| `DELETE` | `/api/v1/admin/users/{id}`      | Delete user         | 👑         |
| `GET`    | `/api/v1/admin/services`        | Get services status | 👑         |
| `GET`    | `/api/v1/admin/stats`           | System statistics   | 👑         |
| `GET`    | `/api/v1/admin/requests`        | All requests        | 👑         |

### 6. Dashboard & Status (6 endpoints)

| Method | Endpoint                             | Description        | Auth Required |
| ------ | ------------------------------------ | ------------------ | ------------- |
| `GET`  | `/api/v1/dashboard/stats`            | Dashboard stats    | ✅            |
| `GET`  | `/api/v1/dashboard/status`           | Service statuses   | ✅            |
| `GET`  | `/api/v1/dashboard/status/{service}` | Specific service   | ✅            |
| `GET`  | `/api/v1/dashboard/notifications`    | User notifications | ✅            |
| `GET`  | `/api/v1/services/status`            | Services overview  | ✅            |
| `GET`  | `/api/v1/simple-health`              | Simple health      | ❌            |

### 7. Health & Monitoring (4 endpoints)

| Method | Endpoint                 | Description         | Auth Required |
| ------ | ------------------------ | ------------------- | ------------- |
| `GET`  | `/health`                | Basic health        | ❌            |
| `GET`  | `/api/health`            | Detailed health     | ❌            |
| `GET`  | `/api/v1/health`         | API health          | ❌            |
| `GET`  | `/api/v1/health/metrics` | Performance metrics | 👑            |

### 8. Performance Monitoring (5 endpoints)

| Method | Endpoint                           | Description          | Admin Only |
| ------ | ---------------------------------- | -------------------- | ---------- |
| `GET`  | `/api/performance/metrics`         | Performance metrics  | ✅         |
| `GET`  | `/api/performance/health`          | Performance health   | ✅         |
| `GET`  | `/api/performance/database`        | Database performance | ✅         |
| `GET`  | `/api/performance/recommendations` | Optimization tips    | ✅         |
| `POST` | `/api/performance/optimize`        | Trigger optimization | 👑         |

### 9. Error Reporting (2 endpoints)

| Method | Endpoint                | Description            | Auth Required |
| ------ | ----------------------- | ---------------------- | ------------- |
| `POST` | `/api/v1/errors/report` | Report frontend errors | ✅            |
| `GET`  | `/api/v1/errors/recent` | Get recent errors      | ✅            |

### 10. Webhooks & Integrations (2 endpoints)

| Method | Endpoint                     | Description           | Auth Required |
| ------ | ---------------------------- | --------------------- | ------------- |
| `POST` | `/api/v1/webhooks/overseerr` | Overseerr webhook     | ❌            |
| `GET`  | `/api/v1/resilience/*`       | Resilience monitoring | ❌            |

## Middleware Analysis

### Security Middleware Stack

1. **Helmet.js** - Security headers (CSP, HSTS, etc.)
2. **CORS** - Cross-origin resource sharing with origin validation
3. **Rate Limiting** - Global (100/15min) and API-specific (50/15min)
4. **Body Parsing** - JSON/URL-encoded with 10MB limits
5. **Compression** - Response compression enabled

### Authentication Middleware

1. **JWT Authentication** (`authenticate`)
   - Validates JWT tokens from cookies or Authorization header
   - Sets `req.user` with authenticated user data
   - Handles token refresh automatically

2. **Admin Authorization** (`requireAdmin`)
   - Validates user role is 'admin'
   - Applied after authentication middleware
   - Returns 403 for insufficient permissions

3. **Optional Authentication** (`optionalAuth`)
   - Allows both authenticated and anonymous access
   - Used for CSRF token generation

### Validation Middleware

1. **Request Validation** (`validate`)
   - Zod schema validation for request body/query/params
   - Sanitizes input data
   - Returns 400 for validation errors

2. **CSRF Protection**
   - Token generation and validation
   - Required for state-changing operations
   - Separate tokens per session

### Caching Middleware

1. **Cache Headers** - Multiple preset configurations:
   - `apiLong`: 1 hour cache
   - `apiMedium`: 5 minutes cache
   - `apiShort`: 30 seconds cache
   - `userData`: 5 minutes user-specific cache

### Logging & Monitoring

1. **Correlation ID** - Request tracking across services
2. **Request Logger** - Structured logging with Winston
3. **Performance Monitor** - Response time tracking
4. **Error Handler** - Centralized error processing

## Response Patterns

### Success Response Format

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "pagination": {
    // For paginated responses
    "page": 1,
    "totalPages": 10,
    "totalItems": 100
  }
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": "Additional details (dev only)"
  },
  "correlationId": "abc-123-def"
}
```

## WebSocket Namespaces

### Real-time Event Support

- `/` - General public events
- `/authenticated` - User-specific events
- `/admin` - Admin-only events
- `/media` - Media-related updates
- `/system` - System status changes

### Event Types

- `download:progress` - YouTube download progress
- `request:updated` - Media request status changes
- `system:notification` - System-wide notifications
- `admin:alert` - Administrative alerts

## API Versioning Strategy

- **Current Version**: v1
- **Base Path**: `/api/v1/`
- **Legacy Support**: Some unversioned routes in `/api/`
- **Future Versions**: Planned `/api/v2/` structure in place

## Rate Limiting Configuration

| Endpoint Category | Limit        | Window     | Scope     |
| ----------------- | ------------ | ---------- | --------- |
| Global            | 100 requests | 15 minutes | Per IP    |
| API Routes        | 50 requests  | 15 minutes | Per IP    |
| Login Attempts    | 5 attempts   | 15 minutes | Per IP    |
| YouTube Downloads | 5 downloads  | 1 hour     | Per User  |
| Email Operations  | 3 requests   | 1 hour     | Per Email |

## Content Types & Formats

### Request Formats

- `application/json` - Primary format
- `application/x-www-form-urlencoded` - Form data
- `multipart/form-data` - File uploads (if applicable)

### Response Formats

- `application/json` - Standard API responses
- `text/xml` - Some Plex integration responses
- `text/plain` - Simple health checks

## Error Codes Reference

| HTTP Status | Error Code            | Description                |
| ----------- | --------------------- | -------------------------- |
| 400         | `VALIDATION_ERROR`    | Request validation failed  |
| 401         | `UNAUTHORIZED`        | Authentication required    |
| 401         | `INVALID_CREDENTIALS` | Invalid login credentials  |
| 403         | `FORBIDDEN`           | Insufficient permissions   |
| 404         | `NOT_FOUND`           | Resource not found         |
| 429         | `RATE_LIMIT_EXCEEDED` | Too many requests          |
| 503         | `PLEX_UNREACHABLE`    | Plex server unavailable    |
| 503         | `DATABASE_ERROR`      | Database connection failed |
| 500         | `INTERNAL_ERROR`      | Unexpected server error    |

This comprehensive analysis covers all identified endpoints, their authentication requirements, middleware usage patterns, and provides a complete reference for API integration and development.
