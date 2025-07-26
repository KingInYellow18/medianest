# Authentication API

MediaNest implements secure JWT-based authentication with Plex OAuth integration for seamless user management.

## 🔐 Authentication Overview

### Supported Authentication Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| **Plex OAuth** | Primary authentication via Plex account | Main user authentication |
| **JWT Tokens** | Stateless session management | API access and session persistence |
| **Refresh Tokens** | Secure token renewal | Long-term authentication |

### Security Features

- **JWT with 7-day expiration** - Secure, stateless authentication
- **Refresh token rotation** - Enhanced security for long-term sessions
- **Rate limiting** - 100 requests per 15 minutes per IP
- **CORS protection** - Configurable origin restrictions
- **Input validation** - Zod schema validation for all inputs

## 🚀 API Endpoints

### Authentication Endpoints

#### `POST /auth/plex/login`

Initiate Plex OAuth authentication flow.

**Request Body:**
```json
{
  "plexToken": "string"  // Plex authentication token
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "role": "user|admin",
      "plexId": "string",
      "avatar": "string|null",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-01T00:00:00.000Z"
    },
    "tokens": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token",
      "expiresIn": 604800,
      "tokenType": "Bearer"
    }
  }
}
```

**Error Responses:**
```json
// 401 - Invalid Plex token
{
  "success": false,
  "error": {
    "code": "INVALID_PLEX_TOKEN",
    "message": "Invalid Plex authentication token"
  }
}

// 403 - Account disabled
{
  "success": false,
  "error": {
    "code": "ACCOUNT_DISABLED",
    "message": "User account has been disabled"
  }
}

// 429 - Rate limit exceeded
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many login attempts. Please try again later."
  }
}
```

**Example Usage:**
```typescript
// Frontend authentication
const authenticateWithPlex = async (plexToken: string) => {
  try {
    const response = await fetch('/api/auth/plex/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plexToken }),
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const { data } = await response.json();
    
    // Store tokens securely
    localStorage.setItem('accessToken', data.tokens.accessToken);
    localStorage.setItem('refreshToken', data.tokens.refreshToken);
    
    return data.user;
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};
```

#### `POST /auth/refresh`

Refresh expired access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "string"  // Valid refresh token
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-token",
    "refreshToken": "new-refresh-token",
    "expiresIn": 604800,
    "tokenType": "Bearer"
  }
}
```

**Error Responses:**
```json
// 401 - Invalid or expired refresh token
{
  "success": false,
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "Invalid or expired refresh token"
  }
}
```

**Example Usage:**
```typescript
// Automatic token refresh
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    // Refresh token invalid, redirect to login
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
    return;
  }

  const { data } = await response.json();
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
};
```

#### `POST /auth/logout`

Invalidate current session and refresh token.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Example Usage:**
```typescript
// Secure logout
const logout = async () => {
  const accessToken = localStorage.getItem('accessToken');
  
  if (accessToken) {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  }

  // Clear local storage
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  
  // Redirect to login
  window.location.href = '/login';
};
```

#### `GET /auth/me`

Get current authenticated user information.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "role": "user|admin",
      "plexId": "string",
      "avatar": "string|null",
      "preferences": {
        "theme": "light|dark|system",
        "notifications": boolean,
        "language": "string"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Responses:**
```json
// 401 - Invalid or expired token
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired authentication token"
  }
}
```

### User Management Endpoints

#### `PUT /auth/me`

Update current user profile.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Request Body:**
```json
{
  "username": "string",           // Optional
  "email": "string",              // Optional
  "preferences": {                // Optional
    "theme": "light|dark|system",
    "notifications": boolean,
    "language": "string"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "updated-username",
      "email": "updated-email",
      "role": "user|admin",
      "preferences": {
        "theme": "dark",
        "notifications": true,
        "language": "en"
      },
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Validation Errors:**
```json
// 400 - Validation error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

#### `DELETE /auth/me`

Delete current user account (soft delete).

**Headers:**
```
Authorization: Bearer <access-token>
```

**Request Body:**
```json
{
  "confirmation": "DELETE_MY_ACCOUNT"  // Required confirmation
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

## 🔒 Authentication Middleware

### JWT Verification

All protected routes use JWT middleware for authentication:

```typescript
// Authentication middleware example
const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authentication token required'
        }
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    
    // Attach user to request
    req.user = await getUserById(decoded.userId);
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token expired'
        }
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      }
    });
  }
};
```

### Role-Based Access Control

```typescript
// Admin-only middleware
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Admin access required'
      }
    });
  }
  next();
};

// Usage in routes
app.get('/admin/users', authenticateJWT, requireAdmin, getUsersHandler);
```

## 🔧 Frontend Integration

### React Authentication Hook

```typescript
// useAuth hook for React applications
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const { data } = await response.json();
        setUser(data.user);
      } else {
        // Token invalid, try refresh
        await refreshAccessToken();
        await checkAuthStatus();
      }
    } catch (error) {
      console.error('Auth check error:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (plexToken: string) => {
    const userData = await authenticateWithPlex(plexToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    window.location.href = '/login';
  };

  return {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin'
  };
};
```

### Axios Interceptor for Token Management

```typescript
// Automatic token refresh with Axios
const setupAxiosInterceptors = () => {
  // Request interceptor to add auth header
  axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response interceptor to handle token refresh
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          await refreshAccessToken();
          
          // Retry original request with new token
          const token = localStorage.getItem('accessToken');
          originalRequest.headers.Authorization = `Bearer ${token}`;
          
          return axios(originalRequest);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );
};
```

## 🔐 Security Considerations

### Token Security

1. **Short-lived Access Tokens**: 7-day expiration reduces exposure
2. **Refresh Token Rotation**: New refresh token issued on each refresh
3. **Secure Storage**: Use httpOnly cookies for production
4. **XSS Protection**: Sanitize all user inputs

### Rate Limiting

```typescript
// Rate limiting configuration
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/auth/plex/login', authRateLimit);
```

### CORS Configuration

```typescript
// CORS settings for authentication
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

## 📊 Error Handling

### Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_PLEX_TOKEN` | 401 | Plex authentication token is invalid |
| `ACCOUNT_DISABLED` | 403 | User account has been disabled |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many authentication attempts |
| `MISSING_TOKEN` | 401 | No authentication token provided |
| `TOKEN_EXPIRED` | 401 | JWT token has expired |
| `INVALID_TOKEN` | 401 | JWT token is malformed or invalid |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token is invalid or expired |
| `USER_NOT_FOUND` | 401 | User associated with token not found |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required permissions |
| `VALIDATION_ERROR` | 400 | Request validation failed |

### Global Error Handler

```typescript
// Express error handler for authentication
const authErrorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Auth error:', error);

  if (error instanceof jwt.JsonWebTokenError) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      }
    });
  }

  if (error instanceof jwt.TokenExpiredError) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token expired'
      }
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  });
};
```

---

**Next**: [Media Management API](media.md) →