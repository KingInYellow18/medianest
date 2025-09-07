# Authentication API

_Complete authentication endpoint documentation consolidating multiple authentication guides._

## Overview

MediaNest uses JWT-based authentication with Plex OAuth integration and admin bootstrap functionality. All authentication tokens are stored in secure httpOnly cookies.

## Base Configuration

- **Base URL**: `/api/auth`
- **Authentication Type**: JWT with secure cookies
- **Session Duration**: 30 days (configurable)
- **Rate Limiting**: 5 requests per minute per IP

## Endpoints

### Plex OAuth Authentication

#### POST /api/auth/plex/pin

Initiate Plex OAuth PIN authentication flow.

**Request:**

```json
{}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "pin": "ABCD",
    "id": 12345,
    "expiresAt": "2025-01-01T12:05:00.000Z",
    "authUrl": "https://plex.tv/link"
  }
}
```

#### POST /api/auth/plex/verify

Verify Plex OAuth PIN and complete authentication.

**Request:**

```json
{
  "pinId": 12345
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@plex.tv",
      "username": "plexuser",
      "role": "user",
      "plexId": "123456"
    },
    "expiresAt": "2025-01-31T12:00:00.000Z"
  }
}
```

**Error Responses:**

- `400` - Invalid PIN ID
- `404` - PIN not found or expired
- `409` - PIN not yet authorized
- `503` - Plex service unavailable

### Admin Authentication

#### POST /api/auth/admin/bootstrap

Bootstrap admin account on first run (only available when no admin exists).

**Request:**

```json
{
  "username": "admin",
  "password": "admin"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "admin-uuid",
      "username": "admin",
      "role": "admin",
      "mustChangePassword": true
    },
    "expiresAt": "2025-01-31T12:00:00.000Z"
  }
}
```

#### POST /api/auth/admin/change-password

Change admin password (required after bootstrap).

**Authentication:** Required (admin only)

**Request:**

```json
{
  "currentPassword": "admin",
  "newPassword": "new-secure-password",
  "confirmPassword": "new-secure-password"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Password updated successfully",
    "mustChangePassword": false
  }
}
```

### Session Management

#### GET /api/auth/me

Get current user information from session.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "username": "username",
      "role": "user",
      "plexId": "123456",
      "lastLoginAt": "2025-01-01T12:00:00.000Z"
    }
  }
}
```

#### POST /api/auth/refresh

Refresh authentication token.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "data": {
    "expiresAt": "2025-01-31T12:00:00.000Z",
    "refreshed": true
  }
}
```

#### POST /api/auth/logout

Logout current user and invalidate session.

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

### User Registration

#### POST /api/auth/register

Register new user account (admin only or open registration if enabled).

**Authentication:** Required (admin) or none (if open registration)

**Request:**

```json
{
  "email": "user@example.com",
  "username": "newuser",
  "password": "secure-password",
  "role": "user"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "username": "newuser",
      "role": "user",
      "createdAt": "2025-01-01T12:00:00.000Z"
    }
  }
}
```

## Authentication Flow Examples

### Plex OAuth Flow

```javascript
// Step 1: Request PIN
const pinResponse = await fetch('/api/auth/plex/pin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
});
const { pin, id } = pinResponse.data;

// Step 2: Show PIN to user
console.log(`Please go to https://plex.tv/link and enter: ${pin}`);

// Step 3: Poll for verification
const pollVerification = async () => {
  try {
    const response = await fetch('/api/auth/plex/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinId: id }),
    });

    if (response.success) {
      console.log('Authentication successful!');
      return response.data.user;
    }
  } catch (error) {
    if (error.code === 'PIN_NOT_AUTHORIZED') {
      // Continue polling
      setTimeout(pollVerification, 2000);
    } else {
      console.error('Authentication failed:', error);
    }
  }
};

setTimeout(pollVerification, 2000);
```

### Admin Bootstrap Flow

```javascript
// Check if bootstrap is available
const healthResponse = await fetch('/api/health');
const { adminBootstrapAvailable } = healthResponse.data;

if (adminBootstrapAvailable) {
  // Perform bootstrap
  const response = await fetch('/api/auth/admin/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'admin',
    }),
  });

  if (response.data.user.mustChangePassword) {
    // Redirect to password change
    window.location.href = '/admin/change-password';
  }
}
```

## Security Features

### Cookie Configuration

```typescript
// JWT cookie settings
const cookieOptions = {
  httpOnly: true, // Prevent XSS attacks
  secure: true, // HTTPS only in production
  sameSite: 'strict', // CSRF protection
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/',
};
```

### Rate Limiting

Authentication endpoints are heavily rate-limited:

- **PIN requests**: 5 per 5 minutes per IP
- **PIN verification**: 10 attempts per PIN
- **Login attempts**: 5 per 15 minutes per IP
- **Password changes**: 3 per hour per user

### Security Headers

All authentication responses include security headers:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

## Error Handling

### Common Error Codes

| Code                  | Message                  | Description                        |
| --------------------- | ------------------------ | ---------------------------------- |
| `INVALID_PIN`         | Invalid or expired PIN   | PIN not found or expired           |
| `PIN_NOT_AUTHORIZED`  | PIN not yet authorized   | User hasn't entered PIN yet        |
| `PLEX_UNAVAILABLE`    | Plex service unavailable | Cannot connect to Plex             |
| `ADMIN_EXISTS`        | Admin already exists     | Bootstrap not available            |
| `INVALID_CREDENTIALS` | Invalid credentials      | Wrong username/password            |
| `PASSWORD_TOO_WEAK`   | Password too weak        | Password doesn't meet requirements |
| `RATE_LIMITED`        | Too many requests        | Rate limit exceeded                |
| `UNAUTHORIZED`        | Unauthorized             | Invalid or expired token           |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password",
    "details": {
      "field": "password",
      "attemptsRemaining": 3
    }
  },
  "timestamp": "2025-01-01T12:00:00.000Z",
  "path": "/api/auth/login"
}
```

## Testing

### Unit Test Examples

```typescript
describe('Authentication API', () => {
  it('should generate Plex PIN', async () => {
    const response = await request(app).post('/api/auth/plex/pin').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.pin).toMatch(/^[A-Z0-9]{4}$/);
    expect(response.body.data.id).toBeGreaterThan(0);
  });

  it('should verify Plex PIN', async () => {
    const pinResponse = await request(app).post('/api/auth/plex/pin');

    // Mock Plex API response
    mockPlexAPI.verifyPin.mockResolvedValue({
      authToken: 'plex-token',
      user: { id: 123, email: 'test@plex.tv' },
    });

    const response = await request(app)
      .post('/api/auth/plex/verify')
      .send({ pinId: pinResponse.body.data.id })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe('test@plex.tv');
  });
});
```

## Related Documentation

- [Security Guide](../../07-security/authentication.md) - Detailed security implementation
- [User Management API](./user-management-api.md) - User profile management
- [Admin API](./admin-api.md) - Administrative functions
- [Implementation Guide](../../04-implementation-guides/authentication.md) - How to implement auth features
