# MediaNest API Documentation

This directory contains comprehensive documentation for the MediaNest API, including endpoint specifications, authentication patterns, and middleware analysis.

## Documentation Files

### 📋 [API Endpoints Summary](./API_Endpoints_Summary.md)

Quick reference guide to all 75+ API endpoints with authentication requirements, rate limiting, and categorization.

**Key Features:**

- Complete endpoint inventory across 10 categories
- Authentication pattern analysis (Public, Protected, Admin-only)
- Rate limiting configuration details
- Response format standards

### 📖 [Comprehensive API Documentation](./MediaNest_API_Comprehensive_Documentation.md)

Detailed documentation with request/response examples, authentication flows, and usage patterns.

**Includes:**

- Complete endpoint documentation with examples
- Authentication and security workflows
- WebSocket event specifications
- Error handling patterns
- Development and testing guidelines

### 🔧 [OpenAPI/Swagger Specification](./openapi.yaml)

Machine-readable API specification following OpenAPI 3.0.3 standard.

**Features:**

- Complete API schema definitions
- Request/response models
- Authentication security schemes
- Interactive documentation support
- Code generation compatibility

### 🛡️ [Middleware Analysis](./Middleware_Analysis.md)

In-depth analysis of the middleware stack, security patterns, and performance considerations.

**Coverage:**

- Middleware execution order and configuration
- Security implementation details
- Rate limiting strategies
- Performance impact analysis
- Usage patterns by endpoint type

## API Overview

**MediaNest API v1** provides comprehensive media management capabilities including:

- 🔐 **Authentication**: Plex OAuth + password-based admin authentication
- 🎬 **Media Management**: Search, request, and track media content
- 📺 **Plex Integration**: Browse libraries, search content, view collections
- 📹 **YouTube Downloads**: Download videos with progress tracking
- 👨‍💼 **Administration**: User management and system monitoring
- 📊 **Monitoring**: Health checks, performance metrics, and analytics

## Quick Start

### Base URL

```
Production: https://api.medianest.app/api/v1
Development: http://localhost:4000/api/v1
```

### Authentication

```bash
# Get Plex PIN
curl -X POST http://localhost:4000/api/v1/auth/plex/pin

# Verify PIN after authorization
curl -X POST http://localhost:4000/api/v1/auth/plex/verify \
  -H "Content-Type: application/json" \
  -d '{"pinId": "12345"}'

# Access protected endpoints
curl -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/v1/media/search?query=avengers
```

### Common Endpoints

- **Health Check**: `GET /health`
- **Search Media**: `GET /api/v1/media/search?query=movie_name`
- **Request Media**: `POST /api/v1/media/request`
- **Browse Plex**: `GET /api/v1/plex/libraries`
- **Dashboard Stats**: `GET /api/v1/dashboard/stats`

## API Categories

| Category            | Endpoints | Description                                     |
| ------------------- | --------- | ----------------------------------------------- |
| Authentication      | 8         | User login, session management, CSRF protection |
| Media Management    | 6         | Search, request, and track media content        |
| Plex Integration    | 7         | Browse Plex server content and collections      |
| YouTube Downloads   | 5         | Download and manage YouTube videos              |
| Administration      | 7         | User and system management (admin only)         |
| Health & Monitoring | 9         | Service health and performance metrics          |
| Dashboard           | 6         | User dashboard data and notifications           |
| Error Reporting     | 2         | Frontend error tracking and analysis            |
| Webhooks            | 2         | External service integrations                   |
| Security            | 3         | CSRF tokens and security features               |

## Security Features

- **JWT Authentication** with HTTP-only cookies
- **CSRF Protection** for state-changing operations
- **Rate Limiting** (Global: 100/15min, API: 50/15min)
- **Input Validation** with Zod schemas
- **CORS Configuration** with origin validation
- **Security Headers** (CSP, HSTS, etc.)
- **Audit Logging** with correlation IDs

## Rate Limiting

| Endpoint Type     | Limit        | Window     |
| ----------------- | ------------ | ---------- |
| Global            | 100 requests | 15 minutes |
| API Endpoints     | 50 requests  | 15 minutes |
| Login Attempts    | 5 attempts   | 15 minutes |
| YouTube Downloads | 5 downloads  | 1 hour     |
| Email Operations  | 3 requests   | 1 hour     |

## Response Format

### Success Response

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

### Error Response

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

## WebSocket Support

Real-time updates available via Socket.IO on multiple namespaces:

- `/` - Public events
- `/authenticated` - User-specific events
- `/admin` - Admin events
- `/media` - Media updates
- `/system` - System notifications

## Development Tools

### Interactive API Documentation

Access the interactive Swagger UI at:

```
http://localhost:4000/api/docs
```

### Testing Endpoints

```bash
# Health check
curl http://localhost:4000/health

# API health with details
curl http://localhost:4000/api/health

# Performance metrics (admin only)
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:4000/api/v1/health/metrics
```

### Environment Configuration

Key environment variables:

- `NODE_ENV`: Environment mode
- `FRONTEND_URL`: Frontend URL for CORS
- `PLEX_ENABLED`: Enable Plex integration
- `REDIS_ENABLED`: Enable Redis caching
- `LOG_LEVEL`: Logging verbosity

## Contributing

When adding new endpoints:

1. Follow existing naming conventions
2. Add comprehensive validation schemas
3. Include proper authentication middleware
4. Update OpenAPI specification
5. Add rate limiting if appropriate
6. Include audit logging for sensitive operations
7. Write comprehensive tests

## Support

- **API Issues**: Check correlation IDs in error responses
- **Authentication**: Verify token expiration and CSRF tokens
- **Rate Limiting**: Check response headers for limit status
- **Performance**: Monitor `/api/performance/metrics` endpoint

For development support, refer to the detailed middleware analysis and comprehensive documentation files.
