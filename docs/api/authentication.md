# Authentication API

The MediaNest Authentication API provides secure authentication through Plex OAuth integration and JWT token management.

## Overview

Authentication in MediaNest is handled through a two-step process:
1. **Plex PIN Generation**: Generate a PIN for Plex OAuth
2. **PIN Verification**: Exchange the PIN for a JWT access token

All authenticated requests must include the JWT token in the `Authorization` header.

## Authentication Endpoints

### Generate Plex PIN

Generate a PIN code for Plex OAuth authentication.

```http
POST /api/v1/auth/plex/pin
```

#### Request

**Headers:**
```
Content-Type: application/json
```

**Body:** None required

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "abcd1234-efgh-5678-ijkl-9012mnop3456",
    "code": "AB2D",
    "url": "https://plex.tv/link",
    "expires_in": 1800,
    "expires_at": "2024-01-01T00:30:00.000Z"
  },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req-pin-123"
  }
}
```

#### Usage Flow

1. Call this endpoint to generate a PIN
2. Direct user to `plex.tv/link` 
3. User enters the 4-digit `code`
4. User authorizes the application
5. Use the `id` to verify the PIN

### Verify Plex PIN

Exchange an authorized Plex PIN for a JWT access token.

```http
POST /api/v1/auth/plex/verify
```

#### Request

**Headers:**
```
Content-Type: application/json
X-CSRF-Token: <csrf-token>
```

**Body:**
```json
{
  "id": "abcd1234-efgh-5678-ijkl-9012mnop3456"
}
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-123",
      "plexUsername": "john_doe",
      "email": "john@example.com",
      "role": "user",
      "avatar": "https://plex.tv/users/avatar.png"
    },
    "expires_in": 86400,
    "expires_at": "2024-01-02T00:00:00.000Z"
  },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req-verify-123"
  }
}
```

#### Error Responses

**Status:** `400 Bad Request`
```json
{
  "success": false,
  "error": {
    "message": "PIN not authorized or expired",
    "code": "PIN_INVALID",
    "statusCode": 400
  }
}
```

**Status:** `429 Too Many Requests`
```json
{
  "success": false,
  "error": {
    "message": "Too many verification attempts",
    "code": "RATE_LIMIT_EXCEEDED",
    "statusCode": 429
  }
}
```

### Get Current Session

Retrieve information about the current authenticated session.

```http
GET /api/v1/auth/session
```

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-123",
      "plexUsername": "john_doe",
      "email": "john@example.com",
      "role": "user",
      "avatar": "https://plex.tv/users/avatar.png",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-01T12:00:00.000Z"
    },
    "session": {
      "id": "session-456",
      "createdAt": "2024-01-01T12:00:00.000Z",
      "expiresAt": "2024-01-02T12:00:00.000Z",
      "lastActivity": "2024-01-01T12:30:00.000Z"
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-session-123"
  }
}
```

### Logout

Invalidate the current session and JWT token.

```http
POST /api/v1/auth/logout
```

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
X-CSRF-Token: <csrf-token>
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out"
  },
  "metadata": {
    "timestamp": "2024-01-01T13:00:00.000Z",
    "requestId": "req-logout-123"
  }
}
```

## Authentication Flow Examples

### Complete Authentication Flow

```javascript
// 1. Generate PIN
const pinResponse = await fetch('/api/v1/auth/plex/pin', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
});

const { data: pin } = await pinResponse.json();

// 2. Direct user to Plex authorization
window.open(`${pin.url}/?clientID=your-client-id&code=${pin.code}`);

// 3. Poll for PIN verification (or handle callback)
const verifyPin = async () => {
  try {
    const verifyResponse = await fetch('/api/v1/auth/plex/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': await getCSRFToken()
      },
      body: JSON.stringify({ id: pin.id })
    });

    const { data: auth } = await verifyResponse.json();
    
    // Store token for future requests
    localStorage.setItem('jwt_token', auth.token);
    
    return auth;
  } catch (error) {
    console.error('Authentication failed:', error);
  }
};

// 4. Use token for authenticated requests
const makeAuthenticatedRequest = async (url, options = {}) => {
  const token = localStorage.getItem('jwt_token');
  
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
};
```

### Python Example

```python
import requests
import time

def authenticate_with_plex():
    # Generate PIN
    pin_response = requests.post('http://localhost:8080/api/v1/auth/plex/pin')
    pin_data = pin_response.json()['data']
    
    print(f"Go to {pin_data['url']} and enter code: {pin_data['code']}")
    
    # Poll for verification
    while True:
        try:
            verify_response = requests.post(
                'http://localhost:8080/api/v1/auth/plex/verify',
                json={'id': pin_data['id']},
                headers={'X-CSRF-Token': get_csrf_token()}
            )
            
            if verify_response.status_code == 200:
                auth_data = verify_response.json()['data']
                return auth_data['token']
                
        except requests.exceptions.RequestException:
            pass
            
        time.sleep(2)  # Poll every 2 seconds

def make_authenticated_request(url, token, **kwargs):
    headers = kwargs.get('headers', {})
    headers['Authorization'] = f'Bearer {token}'
    kwargs['headers'] = headers
    
    return requests.get(url, **kwargs)
```

## JWT Token Details

### Token Structure

MediaNest uses JWT tokens with the following structure:

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user-123",
    "iat": 1704067200,
    "exp": 1704153600,
    "role": "user",
    "plexUsername": "john_doe",
    "sessionId": "session-456"
  }
}
```

### Token Expiration

- **Default Expiration**: 24 hours (86400 seconds)
- **Refresh**: Tokens cannot be refreshed; users must re-authenticate
- **Validation**: Tokens are validated on each request

### Security Considerations

1. **Secure Storage**: Store tokens securely (avoid localStorage for sensitive applications)
2. **HTTPS Only**: Always use HTTPS in production
3. **Token Rotation**: Implement regular re-authentication for long-lived applications
4. **CSRF Protection**: Include CSRF tokens for state-changing operations

## Error Handling

### Common Error Codes

| Code | Description | Status |
|------|-------------|---------|
| `PIN_EXPIRED` | PIN has expired before verification | 400 |
| `PIN_INVALID` | PIN ID not found or invalid | 400 |
| `PIN_NOT_AUTHORIZED` | PIN not authorized by user | 400 |
| `TOKEN_EXPIRED` | JWT token has expired | 401 |
| `TOKEN_INVALID` | JWT token is malformed or invalid | 401 |
| `CSRF_INVALID` | CSRF token invalid or missing | 403 |
| `RATE_LIMIT_EXCEEDED` | Too many authentication attempts | 429 |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "code": "MACHINE_READABLE_CODE",
    "statusCode": 400,
    "details": {
      "field": "Specific field information",
      "constraint": "Validation constraint details"
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req-error-123"
  }
}
```

## Rate Limiting

Authentication endpoints have specific rate limits:

- **PIN Generation**: 10 requests per 10 minutes per IP
- **PIN Verification**: 20 attempts per PIN ID
- **Session Requests**: 100 requests per 15 minutes per user
- **Logout**: 5 requests per minute per user

## Security Best Practices

1. **Environment Variables**: Never hardcode tokens or secrets
2. **Token Validation**: Always validate tokens on the server side
3. **Secure Headers**: Use security headers (CSRF, HTTPS, etc.)
4. **Log Monitoring**: Monitor authentication logs for suspicious activity
5. **Token Cleanup**: Clear tokens on logout and application exit