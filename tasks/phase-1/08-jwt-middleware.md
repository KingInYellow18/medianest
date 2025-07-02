# Task: JWT Middleware and Protected Routes

**Task ID:** PHASE1-08  
**Priority:** High  
**Estimated Time:** 2 hours  
**Dependencies:** PHASE1-07 (Plex OAuth Implementation)

## Objective
Implement JWT authentication middleware, protected route handling, and role-based access control for the MediaNest API.

## Acceptance Criteria
- [ ] JWT validation middleware working
- [ ] Protected routes require valid tokens
- [ ] Role-based access control implemented
- [ ] Token refresh mechanism working
- [ ] Proper error responses for auth failures
- [ ] Request context includes user information

## Detailed Steps

### 1. Create JWT Middleware
Create `backend/src/middleware/auth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '@/config'
import { prisma } from '@/utils/database'
import { logger } from '@/utils/logger'
import { SessionStore } from '@/lib/redis/session-store'

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        role: 'user' | 'admin'
        plexId: string
        username: string
      }
    }
  }
}

interface JwtPayload {
  userId: string
  role: 'user' | 'admin'
  type?: string
  iat?: number
  exp?: number
}

/**
 * Extract JWT token from request
 */
function extractToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Check cookie
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken
  }

  return null
}

/**
 * Verify JWT token and attach user to request
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Extract token
    const token = extractToken(req)
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Authentication required',
        },
      })
    }

    // Verify token
    let payload: JwtPayload
    try {
      payload = jwt.verify(token, config.jwt.secret) as JwtPayload
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Token has expired',
          },
        })
      }
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
        },
      })
    }

    // Check if it's a refresh token being used as access token
    if (payload.type === 'refresh') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'WRONG_TOKEN_TYPE',
          message: 'Invalid token type',
        },
      })
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        plexId: true,
        plexUsername: true,
        role: true,
        status: true,
      },
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      })
    }

    // Check if user is suspended
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'USER_SUSPENDED',
          message: 'Account has been suspended',
        },
      })
    }

    // Attach user to request
    req.user = {
      id: user.id,
      role: user.role,
      plexId: user.plexId,
      username: user.plexUsername,
    }

    next()
  } catch (error) {
    logger.error('Authentication middleware error:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication error',
      },
    })
  }
}

/**
 * Optional authentication - attaches user if token present but doesn't require it
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = extractToken(req)
    
    if (!token) {
      return next()
    }

    // Try to verify token
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload
      
      if (payload.type !== 'refresh') {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: {
            id: true,
            plexId: true,
            plexUsername: true,
            role: true,
            status: true,
          },
        })

        if (user && user.status === 'active') {
          req.user = {
            id: user.id,
            role: user.role,
            plexId: user.plexId,
            username: user.plexUsername,
          }
        }
      }
    } catch {
      // Ignore token errors for optional auth
    }

    next()
  } catch (error) {
    logger.error('Optional auth middleware error:', error)
    next()
  }
}

/**
 * Require specific role
 */
export function requireRole(role: 'admin' | 'user') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      })
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      logger.warn('Access denied', {
        userId: req.user.id,
        requiredRole: role,
        userRole: req.user.role,
        path: req.path,
      })

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      })
    }

    next()
  }
}

/**
 * Require admin role
 */
export const requireAdmin = requireRole('admin')

/**
 * Validate refresh token
 */
export async function validateRefreshToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'Refresh token required',
        },
      })
    }

    // Verify refresh token
    let payload: JwtPayload
    try {
      payload = jwt.verify(refreshToken, config.jwt.secret) as JwtPayload
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid refresh token',
        },
      })
    }

    // Check token type
    if (payload.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'WRONG_TOKEN_TYPE',
          message: 'Invalid token type',
        },
      })
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    })

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found or inactive',
        },
      })
    }

    // Attach user ID to request
    req.body.userId = user.id
    req.body.userRole = user.role

    next()
  } catch (error) {
    logger.error('Refresh token validation error:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'TOKEN_VALIDATION_ERROR',
        message: 'Token validation error',
      },
    })
  }
}

/**
 * Check user permissions for specific resources
 */
export function checkResourceOwnership(resourceType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      })
    }

    // Admins can access all resources
    if (req.user.role === 'admin') {
      return next()
    }

    // Check ownership based on resource type
    const resourceId = req.params.id
    let hasAccess = false

    try {
      switch (resourceType) {
        case 'mediaRequest':
          const request = await prisma.mediaRequest.findUnique({
            where: { id: resourceId },
            select: { userId: true },
          })
          hasAccess = request?.userId === req.user.id
          break

        case 'youtubeDownload':
          const download = await prisma.youTubeDownload.findUnique({
            where: { id: resourceId },
            select: { userId: true },
          })
          hasAccess = download?.userId === req.user.id
          break

        default:
          hasAccess = false
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this resource',
          },
        })
      }

      next()
    } catch (error) {
      logger.error('Resource ownership check error:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'PERMISSION_CHECK_ERROR',
          message: 'Failed to verify permissions',
        },
      })
    }
  }
}
```

### 2. Create Token Service
Create `backend/src/services/token.service.ts`:

```typescript
import jwt from 'jsonwebtoken'
import { config } from '@/config'
import { logger } from '@/utils/logger'

export interface TokenPayload {
  userId: string
  role: 'user' | 'admin'
  type?: 'access' | 'refresh'
}

export class TokenService {
  /**
   * Generate access token
   */
  generateAccessToken(payload: Omit<TokenPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'access' },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    )
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: '7d' }
    )
  }

  /**
   * Generate token pair
   */
  generateTokenPair(userId: string, role: 'user' | 'admin') {
    const payload = { userId, role }
    
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
      expiresIn: 86400, // 24 hours in seconds
    }
  }

  /**
   * Verify token
   */
  verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, config.jwt.secret) as TokenPayload
    } catch (error) {
      logger.debug('Token verification failed:', error.message)
      return null
    }
  }

  /**
   * Decode token without verification
   */
  decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload
    } catch {
      return null
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token)
    if (!decoded || !decoded.exp) return true
    
    return Date.now() >= decoded.exp * 1000
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token)
    if (!decoded || !decoded.exp) return null
    
    return new Date(decoded.exp * 1000)
  }
}

export const tokenService = new TokenService()
```

### 3. Create Token Refresh Endpoint
Update `backend/src/controllers/auth.controller.ts`:

```typescript
/**
 * POST /api/auth/refresh
 * Refresh access token
 */
async refreshToken(req: Request, res: Response) {
  try {
    const { userId, userRole } = req.body // Set by validateRefreshToken middleware
    
    // Generate new token pair
    const tokens = tokenService.generateTokenPair(userId, userRole)
    
    // Log token refresh
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'token_refresh',
        metadata: { userAgent: req.headers['user-agent'] },
      },
    })

    res.json({
      success: true,
      data: tokens,
    })
  } catch (error) {
    logger.error('Token refresh error:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: 'Failed to refresh token',
      },
    })
  }
}
```

### 4. Update Auth Routes
Update `backend/src/routes/auth.ts`:

```typescript
import { validateRefreshToken } from '@/middleware/auth'

// Token refresh
router.post('/refresh', validateRefreshToken, authController.refreshToken)
```

### 5. Create Protected Route Examples
Create `backend/src/routes/user.ts`:

```typescript
import { Router } from 'express'
import { authenticate, requireAdmin } from '@/middleware/auth'
import { userController } from '@/controllers/user.controller'

const router = Router()

// All routes require authentication
router.use(authenticate)

// User routes
router.get('/profile', userController.getProfile)
router.put('/profile', userController.updateProfile)
router.get('/activity', userController.getActivity)

// Admin only routes
router.get('/', requireAdmin, userController.getAllUsers)
router.get('/:id', requireAdmin, userController.getUser)
router.put('/:id', requireAdmin, userController.updateUser)
router.delete('/:id', requireAdmin, userController.deleteUser)

export default router
```

### 6. Create API Error Handler
Create `backend/src/utils/api-error.ts`:

```typescript
export class ApiError extends Error {
  statusCode: number
  code: string
  details?: any

  constructor(
    statusCode: number,
    message: string,
    code: string,
    details?: any
  ) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
    Error.captureStackTrace(this, this.constructor)
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new ApiError(401, message, code)
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new ApiError(403, message, code)
  }

  static notFound(message = 'Not found', code = 'NOT_FOUND') {
    return new ApiError(404, message, code)
  }

  static badRequest(message = 'Bad request', code = 'BAD_REQUEST', details?: any) {
    return new ApiError(400, message, code, details)
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    return new ApiError(500, message, code)
  }
}
```

### 7. Create Frontend Auth Interceptor
Update `frontend/src/lib/api-client.ts`:

```typescript
import axios from 'axios'
import { tokenService } from '@/services/token.service'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Token refresh promise to prevent multiple refresh calls
let refreshPromise: Promise<any> | null = null

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Add correlation ID
    config.headers['x-correlation-id'] = `web-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Handle 401 errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      // Token expired error
      if (error.response.data?.error?.code === 'TOKEN_EXPIRED') {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken()
        }

        try {
          await refreshPromise
          refreshPromise = null
          
          // Retry original request
          const token = localStorage.getItem('accessToken')
          originalRequest.headers.Authorization = `Bearer ${token}`
          return apiClient(originalRequest)
        } catch (refreshError) {
          // Refresh failed, redirect to login
          window.location.href = '/auth/login'
          return Promise.reject(refreshError)
        }
      }

      // Other auth errors - redirect to login
      window.location.href = '/auth/login'
    }

    return Promise.reject(error)
  }
)

async function refreshAccessToken() {
  try {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      throw new Error('No refresh token')
    }

    const response = await apiClient.post('/api/auth/refresh', {
      refreshToken,
    })

    const { accessToken, refreshToken: newRefreshToken } = response.data.data
    
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', newRefreshToken)
    
    return response.data.data
  } catch (error) {
    // Clear tokens on refresh failure
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    throw error
  }
}
```

### 8. Create Frontend Token Service
Create `frontend/src/services/token.service.ts`:

```typescript
interface TokenPayload {
  userId: string
  role: 'user' | 'admin'
  type?: string
  exp?: number
}

export class TokenService {
  decodeToken(token: string): TokenPayload | null {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      return JSON.parse(jsonPayload)
    } catch {
      return null
    }
  }

  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token)
    if (!decoded || !decoded.exp) return true
    
    return Date.now() >= decoded.exp * 1000
  }

  getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token)
    if (!decoded || !decoded.exp) return null
    
    return new Date(decoded.exp * 1000)
  }

  getStoredToken(): string | null {
    return localStorage.getItem('accessToken')
  }

  getStoredRefreshToken(): string | null {
    return localStorage.getItem('refreshToken')
  }

  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
  }

  clearTokens() {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }
}

export const tokenService = new TokenService()
```

### 9. Update Main Application Routes
Update `backend/src/index.ts`:

```typescript
import authRouter from './routes/auth'
import userRouter from './routes/user'
import { authenticate } from './middleware/auth'

// Public routes
app.use('/api/auth', authRouter)
app.use('/api/health', healthRouter)

// Protected routes
app.use('/api/users', userRouter)

// Add more protected routes here
// app.use('/api/media', authenticate, mediaRouter)
// app.use('/api/youtube', authenticate, youtubeRouter)
// app.use('/api/admin', authenticate, requireAdmin, adminRouter)
```

## Verification Steps
1. Test JWT generation on login
2. Test protected endpoint without token - should return 401
3. Test protected endpoint with valid token - should succeed
4. Test admin endpoint with user token - should return 403
5. Test token expiration handling
6. Test token refresh flow
7. Test concurrent requests with expired token

## Testing Requirements
- [ ] Unit tests for JWT service (sign, verify, decode)
- [ ] Unit tests for authentication middleware
- [ ] Unit tests for role-based access control
- [ ] Integration tests for protected routes
- [ ] Test token expiration scenarios
- [ ] Test refresh token rotation
- [ ] Test concurrent refresh token requests
- [ ] Test malformed JWT handling
- [ ] Test JWT with invalid signatures
- [ ] Performance tests for JWT verification
- [ ] Test JWT claims validation
- [ ] Test coverage should exceed 80% for auth middleware
- [ ] All tests must pass before marking task complete

## Common Issues & Solutions
- **Token not found**: Check Authorization header format
- **Token expired immediately**: Verify server time sync
- **Refresh loop**: Ensure refresh endpoint excluded from auth
- **CORS issues**: Add credentials to axios config

## Notes
- Tokens stored in localStorage for persistence
- Refresh tokens have longer expiry (7 days)
- Admin users can access all endpoints
- Token refresh is automatic on 401 responses

## Related Documentation
- [JWT Documentation](https://jwt.io/)
- [Express Middleware](https://expressjs.com/en/guide/using-middleware.html)
- [Authentication Architecture](/docs/AUTHENTICATION_ARCHITECTURE.md)