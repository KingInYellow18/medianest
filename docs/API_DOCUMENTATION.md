# MediaNest API Documentation

## Overview

MediaNest is an advanced media management platform providing comprehensive API endpoints for user authentication, media requests, service integration, and administrative operations. The API uses JWT-based authentication with HTTP-only cookies and implements robust security measures including rate limiting and comprehensive error handling.

## Quick Start

### Base URL
- **Development:** `http://localhost:4000/api/v1`
- **Production:** `https://api.medianest.com/api/v1`

### Authentication
The API primarily uses Plex OAuth for user authentication, with admin bootstrap available for initial setup. Authentication tokens are provided via HTTP-only cookies for security.

```javascript
// Example: Authenticate with Plex
const pin = await fetch('/api/v1/auth/plex/pin', { method: 'POST' });
const { data } = await pin.json();
console.log('Visit:', data.qrUrl, 'PIN:', data.code);

// Poll for authorization every 5 seconds
const checkAuth = setInterval(async () => {
  const status = await fetch(`/api/v1/auth/plex/pin/${data.id}/status`);
  const { data: statusData } = await status.json();
  
  if (statusData.authorized) {
    clearInterval(checkAuth);
    const auth = await fetch('/api/v1/auth/plex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pinId: data.id })
    });
    const authData = await auth.json();
    console.log('Authenticated as:', authData.data.user.name);
  }
}, 5000);
```

## API Reference

### 📋 Complete OpenAPI Specification
For the complete API specification with all endpoints, schemas, and examples, see: [`api-specification.yaml`](./api-specification.yaml)

This OpenAPI 3.0 specification includes:
- All 20+ endpoints with detailed descriptions
- Request/response schemas and examples
- Authentication and security requirements
- Error responses and status codes
- Rate limiting information

### 🔐 Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/auth/plex/pin` | Create Plex OAuth PIN | No |
| `GET` | `/auth/plex/pin/{id}/status` | Check PIN authorization status | No |
| `POST` | `/auth/plex` | Complete Plex OAuth flow | No |
| `POST` | `/auth/admin` | Admin bootstrap (first user only) | No |
| `POST` | `/auth/login` | Password-based login | No |
| `POST` | `/auth/logout` | Logout user | Yes |
| `GET` | `/auth/session` | Get current session info | Yes |
| `POST` | `/auth/change-password` | Change user password | Yes |

### 🎬 Media Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/media/search` | Search for media content | Yes |
| `POST` | `/media/request` | Submit media request | Yes |
| `GET` | `/media/requests` | Get user's media requests | Yes |

### 👑 Admin Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/admin/users` | Get all users | Admin |
| `PATCH` | `/admin/users/{userId}/role` | Update user role | Admin |
| `DELETE` | `/admin/users/{userId}` | Delete user | Admin |
| `GET` | `/admin/stats` | Get system statistics | Admin |

### 📊 Dashboard Endpoints

| Method | Endpoint | Description | Auth Required | Cache |
|--------|----------|-------------|---------------|-------|
| `GET` | `/dashboard/stats` | Get dashboard statistics | Yes | 5 min |
| `GET` | `/dashboard/status` | Get service statuses | Yes | 1 min |
| `GET` | `/dashboard/notifications` | Get notifications | Yes | No cache |

### ❤️ Health Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/health` | Health check | No |
| `GET` | `/services/status` | Service monitoring status | No |

## Code Examples

### JavaScript/Fetch Examples

```javascript
// Search for media
const searchMedia = async (query) => {
  const response = await fetch(`/api/v1/media/search?q=${encodeURIComponent(query)}`, {
    credentials: 'include'
  });
  const data = await response.json();
  return data.success ? data.data : null;
};

// Create media request
const requestMedia = async (title, type, tmdbId) => {
  const response = await fetch('/api/v1/media/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title, mediaType: type, tmdbId })
  });
  return response.json();
};

// Get dashboard stats
const getDashboard = async () => {
  const response = await fetch('/api/v1/dashboard/stats', {
    credentials: 'include'
  });
  return response.json();
};
```

### cURL Examples

```bash
# Create Plex PIN
curl -X POST http://localhost:4000/api/v1/auth/plex/pin \
  -H "Content-Type: application/json" \
  -d '{"deviceName": "MediaNest CLI"}'

# Search media (with auth cookie)
curl "http://localhost:4000/api/v1/media/search?q=Matrix" \
  -b cookies.txt

# Create media request
curl -X POST http://localhost:4000/api/v1/media/request \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title": "The Matrix", "mediaType": "movie"}'
```

### Python Example

```python
import requests

class MediaNestAPI:
    def __init__(self, base_url="http://localhost:4000/api/v1"):
        self.base_url = base_url
        self.session = requests.Session()
    
    def login_with_plex(self):
        # Create PIN
        pin_response = self.session.post(f"{self.base_url}/auth/plex/pin")
        pin_data = pin_response.json()["data"]
        
        print(f"Visit: {pin_data['qrUrl']}")
        input("Press Enter after authorizing...")
        
        # Complete OAuth
        auth_response = self.session.post(
            f"{self.base_url}/auth/plex",
            json={"pinId": pin_data["id"]}
        )
        return auth_response.json()
    
    def search_media(self, query):
        response = self.session.get(
            f"{self.base_url}/media/search",
            params={"q": query}
        )
        return response.json()
```

## Error Handling

### Standard Error Response Format

All API errors follow this consistent format:

```json
{
  "success": false,
  "message": "Human-readable error description",
  "error": "MACHINE_READABLE_ERROR_CODE",
  "path": "/api/v1/endpoint",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common HTTP Status Codes

| Code | Description | Common Scenarios |
|------|-------------|------------------|
| `200` | Success | Request completed successfully |
| `201` | Created | Resource created (media requests) |
| `400` | Bad Request | Validation errors, missing fields |
| `401` | Unauthorized | Authentication required/invalid |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Duplicate requests, business logic conflicts |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side errors |
| `503` | Service Unavailable | Disabled features, maintenance |

### Error Code Examples

```javascript
// Comprehensive error handling
const handleApiError = (error, response) => {
  switch (response.status) {
    case 401:
      // Redirect to login
      window.location.href = '/login';
      break;
    case 429:
      const retryAfter = response.headers.get('Retry-After');
      console.error(`Rate limited. Retry in ${retryAfter} seconds`);
      break;
    case 409:
      if (error.error === 'DUPLICATE_REQUEST') {
        alert('You have already requested this item');
      }
      break;
    default:
      console.error('API Error:', error.message);
  }
};
```

## Rate Limiting

The API implements comprehensive rate limiting to ensure fair usage and prevent abuse.

### Rate Limit Headers

Every response includes rate limiting information:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1642248000
Retry-After: 30 (only on 429 responses)
```

### Rate Limits by Endpoint Type

| Endpoint Category | Limit | Window | Scope |
|------------------|-------|--------|-------|
| Authentication | 5 requests | 15 minutes | Per IP |
| Media Search | 60 requests | 1 minute | Per User |
| Media Requests | 10 requests | 1 minute | Per User |
| Dashboard | 30 requests | 1 minute | Per User |
| Admin Operations | 20 requests | 1 minute | Per User |

### Handling Rate Limits

```javascript
const apiCallWithRetry = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
      console.log(`Rate limited. Waiting ${retryAfter} seconds...`);
      
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return apiCallWithRetry(url, options); // Retry
    }
    
    return response;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};
```

## Security

### Authentication Security
- **JWT Tokens:** Signed with HS256, include user context
- **HTTP-Only Cookies:** Prevent XSS attacks
- **Secure Cookies:** HTTPS-only in production
- **Token Rotation:** Automatic rotation for security
- **Session Management:** Database-backed with expiration

### Request Security
- **Input Sanitization:** All inputs sanitized and validated
- **Request Limits:** Size and parameter count limits
- **Timeout Protection:** 30-second default timeouts
- **CORS Configuration:** Restricted to allowed origins

### Security Headers
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
```

### Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

## Database Schema

### Core Models

**User Model:**
- Authentication via Plex OAuth or password
- Role-based access control (admin/user)
- Session tracking and device management

**MediaRequest Model:**
- User-submitted media requests
- Status tracking (pending/processing/completed)
- TMDB integration for metadata

**Service Models:**
- ServiceStatus: Real-time service monitoring
- ServiceConfig: Service configuration management
- ServiceMetric: Performance metrics tracking

### Relationships
- Users have many MediaRequests, SessionTokens, RateLimits
- MediaRequests belong to Users
- Services track status, configuration, and metrics

## Best Practices

### API Usage
1. **Always handle errors gracefully** with proper user feedback
2. **Respect rate limits** and implement backoff strategies
3. **Use HTTPS in production** for secure token transmission
4. **Include User-Agent headers** for request identification
5. **Implement request timeouts** to prevent hanging requests

### Authentication
1. **Store tokens securely** (HTTP-only cookies preferred)
2. **Handle token expiration** with automatic refresh
3. **Clear tokens on logout** from all storage locations
4. **Use CSRF protection** for state-changing operations

### Performance
1. **Leverage caching headers** for dashboard endpoints
2. **Implement pagination** for list endpoints
3. **Use efficient queries** with proper filtering
4. **Monitor response times** and optimize accordingly

## SDK and Client Libraries

### Official JavaScript SDK (Coming Soon)
```javascript
import { MediaNestAPI } from '@medianest/sdk';

const api = new MediaNestAPI({
  baseUrl: 'http://localhost:4000/api/v1',
  credentials: 'include'
});

// Simplified API calls
await api.auth.loginWithPlex();
const results = await api.media.search('The Matrix');
await api.media.request('The Matrix Resurrections', 'movie');
```

### Community Libraries
- **Python:** `python-medianest` (community-maintained)
- **Go:** `go-medianest-client` (community-maintained)
- **Ruby:** `medianest-ruby` (community-maintained)

## Support and Resources

### Documentation
- **API Reference:** [OpenAPI Specification](./api-specification.yaml)
- **Developer Portal:** https://docs.medianest.com
- **GitHub Repository:** https://github.com/medianest/medianest

### Support Channels
- **GitHub Issues:** Bug reports and feature requests
- **Discord Community:** Real-time developer support
- **Email Support:** support@medianest.com

### Contributing
- **API Feedback:** Submit issues or suggestions on GitHub
- **Documentation:** Help improve API documentation
- **Client Libraries:** Contribute SDKs for additional languages

---

**Last Updated:** January 2024  
**API Version:** v1.0  
**OpenAPI Spec Version:** 3.0.3