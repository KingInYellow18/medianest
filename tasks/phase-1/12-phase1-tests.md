# Task: Phase 1 Test Implementation

**Task ID:** PHASE1-12  
**Priority:** High  
**Estimated Time:** 4 hours  
**Dependencies:** PHASE1-11 (Testing Setup), All other Phase 1 tasks

## Objective
Implement comprehensive tests for all Phase 1 components following the test architecture, ensuring authentication and core infrastructure work reliably.

## Acceptance Criteria
- [ ] Unit tests for all services and utilities
- [ ] Integration tests for auth endpoints
- [ ] Component tests for login UI
- [ ] Security tests for JWT and rate limiting
- [ ] All tests passing with >80% coverage
- [ ] E2E test for complete auth flow

## Test Implementation

### 1. Authentication Service Tests

Create `backend/tests/unit/services/auth.service.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService } from '@/services/auth.service'
import { plexClient } from '@/integrations/plex/client'
import { prisma } from '@/utils/database'
import { SessionStore } from '@/lib/redis/session-store'
import * as crypto from '@/utils/crypto'

vi.mock('@/integrations/plex/client')
vi.mock('@/utils/database')
vi.mock('@/lib/redis/session-store')
vi.mock('@/utils/crypto')

describe('AuthService', () => {
  let authService: AuthService
  
  beforeEach(() => {
    authService = new AuthService()
    vi.clearAllMocks()
  })

  describe('createPlexPin', () => {
    it('should create a PIN successfully', async () => {
      const mockPin = {
        id: 12345,
        code: 'ABCD',
        expiresAt: '2025-01-01T00:00:00Z'
      }
      
      vi.mocked(plexClient.createPin).mockResolvedValue(mockPin)
      
      const result = await authService.createPlexPin()
      
      expect(result).toEqual({
        id: mockPin.id,
        code: mockPin.code,
        expiresAt: mockPin.expiresAt
      })
      expect(plexClient.createPin).toHaveBeenCalledOnce()
    })

    it('should handle PIN creation failure', async () => {
      vi.mocked(plexClient.createPin).mockRejectedValue(new Error('Network error'))
      
      await expect(authService.createPlexPin()).rejects.toThrow('Network error')
    })
  })

  describe('checkPlexPin', () => {
    it('should authenticate user with valid PIN', async () => {
      const mockPin = {
        id: 12345,
        authToken: 'plex-token',
        code: 'ABCD',
        // ... other properties
      }
      
      const mockPlexUser = {
        uuid: 'plex-uuid',
        username: 'testuser',
        email: 'test@example.com',
        id: 123,
        authToken: 'plex-token',
        // ... other properties
      }
      
      vi.mocked(plexClient.checkPin).mockResolvedValue(mockPin as any)
      vi.mocked(plexClient.getUser).mockResolvedValue(mockPlexUser as any)
      vi.mocked(crypto.encrypt).mockReturnValue('encrypted-token')
      
      vi.mocked(prisma.user.upsert).mockResolvedValue({
        id: 'user-id',
        plexId: mockPlexUser.uuid,
        plexUsername: mockPlexUser.username,
        email: mockPlexUser.email,
        role: 'user',
        // ... other properties
      } as any)
      
      vi.mocked(SessionStore.create).mockResolvedValue('session-id')
      
      const result = await authService.checkPlexPin(12345)
      
      expect(result.authorized).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.sessionId).toBe('session-id')
      expect(result.accessToken).toBeDefined()
    })

    it('should return unauthorized for PIN without token', async () => {
      const mockPin = {
        id: 12345,
        authToken: undefined,
        // ... other properties
      }
      
      vi.mocked(plexClient.checkPin).mockResolvedValue(mockPin as any)
      
      const result = await authService.checkPlexPin(12345)
      
      expect(result.authorized).toBe(false)
      expect(plexClient.getUser).not.toHaveBeenCalled()
    })
  })

  describe('adminLogin', () => {
    it('should reject invalid credentials', async () => {
      await expect(
        authService.adminLogin('wrong', 'credentials')
      ).rejects.toThrow('Invalid credentials')
    })

    it('should create admin user on first login', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'admin-id',
        plexId: 'admin-bootstrap',
        plexUsername: 'admin',
        role: 'admin',
        // ... other properties
      } as any)
      
      vi.mocked(SessionStore.create).mockResolvedValue('session-id')
      
      const result = await authService.adminLogin('admin', 'admin')
      
      expect(result.user.role).toBe('admin')
      expect(result.mustChangePassword).toBe(true)
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: 'admin',
          plexId: 'admin-bootstrap'
        })
      })
    })
  })
})
```

### 2. JWT Middleware Tests

Create `backend/tests/unit/middleware/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { authenticate, requireAdmin } from '@/middleware/auth'
import jwt from 'jsonwebtoken'
import { prisma } from '@/utils/database'

vi.mock('jsonwebtoken')
vi.mock('@/utils/database')

describe('Auth Middleware', () => {
  let req: Partial<Request>
  let res: Partial<Response>
  let next: NextFunction

  beforeEach(() => {
    req = {
      headers: {},
      cookies: {}
    }
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    }
    next = vi.fn()
  })

  describe('authenticate', () => {
    it('should authenticate valid JWT token', async () => {
      const token = 'valid-token'
      const payload = { userId: 'user-id', role: 'user' }
      
      req.headers = { authorization: `Bearer ${token}` }
      vi.mocked(jwt.verify).mockReturnValue(payload as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-id',
        plexId: 'plex-id',
        plexUsername: 'testuser',
        role: 'user',
        status: 'active'
      } as any)

      await authenticate(req as Request, res as Response, next)

      expect(req.user).toEqual({
        id: 'user-id',
        role: 'user',
        plexId: 'plex-id',
        username: 'testuser'
      })
      expect(next).toHaveBeenCalled()
    })

    it('should reject expired token', async () => {
      const token = 'expired-token'
      req.headers = { authorization: `Bearer ${token}` }
      
      vi.mocked(jwt.verify).mockImplementation(() => {
        const error = new Error('Token expired')
        error.name = 'TokenExpiredError'
        throw error
      })

      await authenticate(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired'
        }
      })
    })

    it('should reject missing token', async () => {
      await authenticate(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Authentication required'
        }
      })
    })

    it('should reject suspended user', async () => {
      const token = 'valid-token'
      req.headers = { authorization: `Bearer ${token}` }
      
      vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-id', role: 'user' } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-id',
        status: 'suspended'
      } as any)

      await authenticate(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'USER_SUSPENDED',
          message: 'Account has been suspended'
        }
      })
    })
  })

  describe('requireAdmin', () => {
    it('should allow admin users', () => {
      req.user = { id: 'admin-id', role: 'admin', plexId: 'plex-id', username: 'admin' }
      
      requireAdmin(req as Request, res as Response, next)
      
      expect(next).toHaveBeenCalled()
    })

    it('should reject non-admin users', () => {
      req.user = { id: 'user-id', role: 'user', plexId: 'plex-id', username: 'user' }
      
      requireAdmin(req as Request, res as Response, next)
      
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      })
    })
  })
})
```

### 3. Rate Limiter Tests

Create `backend/tests/unit/middleware/rate-limiter.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { createRateLimiter } from '@/middleware/rate-limiter'
import { RateLimiter } from '@/lib/redis/rate-limiter'

vi.mock('@/lib/redis/rate-limiter')

describe('Rate Limiter Middleware', () => {
  let req: Partial<Request>
  let res: Partial<Response>
  let next: NextFunction

  beforeEach(() => {
    req = {
      user: { id: 'user-id', role: 'user' },
      ip: '127.0.0.1'
    } as any
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn()
    }
    next = vi.fn()
  })

  it('should allow request within rate limit', async () => {
    const mockConsume = vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 99,
      resetAt: new Date(Date.now() + 60000)
    })
    
    vi.mocked(RateLimiter).mockImplementation(() => ({
      consume: mockConsume
    } as any))

    const middleware = createRateLimiter('test', {
      config: { windowMs: 60000, maxRequests: 100 }
    })

    await middleware(req as Request, res as Response, next)

    expect(next).toHaveBeenCalled()
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100)
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 99)
  })

  it('should block request exceeding rate limit', async () => {
    const resetAt = new Date(Date.now() + 60000)
    const mockConsume = vi.fn().mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: 60
    })
    
    vi.mocked(RateLimiter).mockImplementation(() => ({
      consume: mockConsume
    } as any))

    const middleware = createRateLimiter('test', {
      config: { windowMs: 60000, maxRequests: 100 }
    })

    await middleware(req as Request, res as Response, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 60)
  })

  it('should skip rate limiting for admin', async () => {
    req.user = { id: 'admin-id', role: 'admin' } as any
    
    const middleware = createRateLimiter('test', {
      config: { windowMs: 60000, maxRequests: 100 },
      skipAdmin: true
    })

    await middleware(req as Request, res as Response, next)

    expect(next).toHaveBeenCalled()
    expect(RateLimiter).not.toHaveBeenCalled()
  })
})
```

### 4. Integration Tests for Auth API

Create `backend/tests/integration/auth.integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '@/index'
import { setupTestDatabase, cleanupTestDatabase, resetTestDatabase } from '../helpers/database'
import { mockPlexAPI } from '../mocks/external-services'

describe('Auth API Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  beforeEach(async () => {
    await resetTestDatabase()
  })

  describe('POST /api/auth/plex/pin', () => {
    it('should create a PIN', async () => {
      mockPlexAPI()

      const response = await request(app)
        .post('/api/auth/plex/pin')
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(Number),
          code: expect.any(String),
          expiresAt: expect.any(String),
          authUrl: 'https://app.plex.tv/auth#?'
        }
      })
    })

    it('should handle Plex API errors', async () => {
      // Don't mock - let it fail
      const response = await request(app)
        .post('/api/auth/plex/pin')
        .expect(500)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('PIN_CREATION_FAILED')
    })
  })

  describe('POST /api/auth/plex/check', () => {
    it('should authenticate user with authorized PIN', async () => {
      mockPlexAPI()

      const response = await request(app)
        .post('/api/auth/plex/check')
        .send({ pinId: 12345 })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        data: {
          authorized: true,
          user: {
            id: expect.any(String),
            username: 'testuser',
            email: 'test@example.com',
            role: 'user'
          },
          accessToken: expect.any(String),
          refreshToken: expect.any(String)
        }
      })

      // Check session cookie was set
      const cookies = response.headers['set-cookie']
      expect(cookies).toBeDefined()
      expect(cookies[0]).toMatch(/sessionId=/)
    })
  })

  describe('POST /api/auth/admin', () => {
    it('should login admin with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/admin')
        .send({ username: 'admin', password: 'admin' })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            role: 'admin'
          },
          mustChangePassword: true,
          accessToken: expect.any(String)
        }
      })
    })

    it('should reject invalid admin credentials', async () => {
      const response = await request(app)
        .post('/api/auth/admin')
        .send({ username: 'admin', password: 'wrong' })
        .expect(401)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS')
    })

    it('should enforce rate limiting on login attempts', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/admin')
          .send({ username: 'admin', password: 'wrong' })
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/admin')
        .send({ username: 'admin', password: 'admin' })
        .expect(429)

      expect(response.body.error.code).toBe('TOO_MANY_LOGIN_ATTEMPTS')
      expect(response.headers['retry-after']).toBeDefined()
    })
  })

  describe('Protected Routes', () => {
    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401)

      expect(response.body.error.code).toBe('NO_TOKEN')
    })

    it('should accept requests with valid token', async () => {
      // First login
      mockPlexAPI()
      const loginResponse = await request(app)
        .post('/api/auth/plex/check')
        .send({ pinId: 12345 })

      const token = loginResponse.body.data.accessToken

      // Then access protected route
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })
})
```

### 5. Frontend Component Tests

Create `frontend/tests/unit/components/login.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/auth/login/page'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/hooks/useAuth')
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}))

describe('Login Page', () => {
  it('should render login options', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      isLoading: false
    } as any)

    render(<LoginPage />)

    expect(screen.getByText('Welcome to MediaNest')).toBeInTheDocument()
    expect(screen.getByText('Sign in with Plex')).toBeInTheDocument()
    expect(screen.getByText('Admin login')).toBeInTheDocument()
  })

  it('should handle Plex login', async () => {
    const mockLogin = vi.fn()
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      isLoading: false
    } as any)

    render(<LoginPage />)

    const plexButton = screen.getByText('Sign in with Plex')
    await userEvent.click(plexButton)

    expect(mockLogin).toHaveBeenCalledWith('plex')
  })

  it('should show admin login form', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      isLoading: false
    } as any)

    render(<LoginPage />)

    const adminLink = screen.getByText('Admin login')
    await userEvent.click(adminLink)

    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('should handle admin login submission', async () => {
    const mockLogin = vi.fn()
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      isLoading: false
    } as any)

    render(<LoginPage />)

    // Show admin form
    await userEvent.click(screen.getByText('Admin login'))

    // Fill form
    await userEvent.type(screen.getByLabelText('Username'), 'admin')
    await userEvent.type(screen.getByLabelText('Password'), 'admin')

    // Submit
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(mockLogin).toHaveBeenCalledWith('admin', {
      username: 'admin',
      password: 'admin'
    })
  })

  it('should show loading state', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      isLoading: true
    } as any)

    render(<LoginPage />)

    expect(screen.getByRole('button', { name: /sign in with plex/i })).toBeDisabled()
  })

  it('should display error messages', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Authentication failed'))
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      isLoading: false
    } as any)

    render(<LoginPage />)

    await userEvent.click(screen.getByText('Sign in with Plex'))

    await waitFor(() => {
      expect(screen.getByText('Failed to authenticate with Plex')).toBeInTheDocument()
    })
  })
})
```

### 6. E2E Test for Complete Auth Flow

Create `tests/e2e/auth.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('complete Plex authentication flow', async ({ page }) => {
    // Start at login page
    await page.goto('/auth/login')
    
    // Click Plex login
    await page.click('text=Sign in with Plex')
    
    // Should show PIN
    await expect(page.locator('text=Enter this code at plex.tv/link')).toBeVisible()
    await expect(page.locator('[data-testid="pin-code"]')).toContainText(/[A-Z0-9]{4}/)
    
    // Mock successful PIN verification
    await page.route('**/api/auth/plex/check', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            authorized: true,
            user: {
              id: 'test-user',
              username: 'testuser',
              email: 'test@example.com',
              role: 'user'
            },
            accessToken: 'test-token',
            refreshToken: 'test-refresh'
          }
        })
      })
    })
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 })
    
    // Verify user is logged in
    await expect(page.locator('text=Welcome, testuser')).toBeVisible()
  })

  test('admin login flow', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Click admin login
    await page.click('text=Admin login')
    
    // Fill credentials
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'admin')
    
    // Submit
    await page.click('button[type="submit"]')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    
    // Should show password change prompt
    await expect(page.locator('text=Please change your password')).toBeVisible()
  })

  test('protected route redirects to login', async ({ page }) => {
    // Try to access dashboard without auth
    await page.goto('/dashboard')
    
    // Should redirect to login
    await expect(page).toHaveURL('/auth/login')
  })

  test('rate limiting on failed login attempts', async ({ page }) => {
    await page.goto('/auth/login')
    await page.click('text=Admin login')
    
    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await page.fill('input[name="username"]', 'admin')
      await page.fill('input[name="password"]', 'wrong')
      await page.click('button[type="submit"]')
      await page.waitForTimeout(100)
    }
    
    // 6th attempt should show rate limit error
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'admin')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=Too many login attempts')).toBeVisible()
  })
})
```

### 7. Security-Focused Tests

Create `backend/tests/integration/security.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '@/index'
import jwt from 'jsonwebtoken'

describe('Security Tests', () => {
  describe('JWT Security', () => {
    it('should reject malformed tokens', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer malformed-token')
        .expect(401)

      expect(response.body.error.code).toBe('INVALID_TOKEN')
    })

    it('should reject tokens with invalid signature', async () => {
      const fakeToken = jwt.sign(
        { userId: 'fake-user', role: 'admin' },
        'wrong-secret'
      )

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(401)

      expect(response.body.error.code).toBe('INVALID_TOKEN')
    })

    it('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: 'user-id', role: 'user' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      )

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401)

      expect(response.body.error.code).toBe('TOKEN_EXPIRED')
    })
  })

  describe('Input Validation', () => {
    it('should sanitize input to prevent XSS', async () => {
      const response = await request(app)
        .post('/api/auth/admin')
        .send({
          username: '<script>alert("xss")</script>',
          password: 'test'
        })
        .expect(401)

      // Should not reflect script tag in response
      expect(response.text).not.toContain('<script>')
    })

    it('should validate input types', async () => {
      const response = await request(app)
        .post('/api/auth/plex/check')
        .send({ pinId: 'not-a-number' })
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('CORS and Headers', () => {
    it('should set security headers', async () => {
      const response = await request(app)
        .get('/api/health')

      expect(response.headers['x-content-type-options']).toBe('nosniff')
      expect(response.headers['x-frame-options']).toBe('DENY')
      expect(response.headers['x-xss-protection']).toBe('1; mode=block')
    })

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
      expect(response.headers['access-control-allow-credentials']).toBe('true')
    })
  })
})
```

## Verification Steps
1. Run all unit tests: `npm run test:unit`
2. Run integration tests: `npm run test:integration`
3. Check coverage: `npm run test:coverage`
4. Run E2E tests: `npm run test:e2e`
5. Verify all tests pass
6. Check coverage meets thresholds (>80%)

## Common Issues & Solutions
- **Mock not working**: Check vi.mock is before imports
- **Async test timeout**: Increase timeout in test config
- **Database connection**: Ensure test containers are running
- **E2E flakiness**: Add appropriate waits and retries

## Notes
- Tests follow AAA pattern (Arrange, Act, Assert)
- Each test is independent and isolated
- Security tests verify all auth requirements
- E2E tests cover critical user paths only

## Related Documentation
- [Test Architecture](/test_architecture.md)
- [Testing Best Practices](https://vitest.dev/guide/)
- [Testing Library](https://testing-library.com/)