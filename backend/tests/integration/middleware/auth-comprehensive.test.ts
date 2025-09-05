import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'
import { requireRole, requireAdmin, requireUser, optionalAuth } from '@/middleware/auth'
import { errorHandler } from '@/middleware/error'
import { UserRepository } from '@/repositories/user.repository'
import { SessionTokenRepository } from '@/repositories/session-token.repository'
import { getTestPrismaClient, cleanDatabase } from '../../helpers/database'
import { createAuthToken, createExpiredToken, createInvalidToken } from '../../helpers/auth'
import { AuthenticationError, AuthorizationError } from '@/utils/errors'
import { verifyToken } from '@/utils/jwt'

describe('Authentication Middleware Comprehensive Tests', () => {
  let app: express.Application
  let prisma: ReturnType<typeof getTestPrismaClient>
  let userRepository: UserRepository
  let sessionTokenRepository: SessionTokenRepository
  let testUser: any
  let adminUser: any
  let inactiveUser: any

  beforeEach(async () => {
    // Setup Express app
    app = express()
    app.use(express.json())

    // Setup repositories
    prisma = getTestPrismaClient()
    userRepository = new UserRepository(prisma)
    sessionTokenRepository = new SessionTokenRepository(prisma)

    // Create a custom auth middleware that uses our test repositories
    const testAuthMiddleware = () => {
      return async (req: Request, _res: Response, next: NextFunction) => {
        try {
          // Extract token from Authorization header or cookie
          let token: string | null = null

          const authHeader = req.headers.authorization
          if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7)
          } else if (req.cookies['auth-token']) {
            token = req.cookies['auth-token']
          }

          if (!token) {
            throw new AuthenticationError('Authentication required')
          }

          // Verify JWT token
          const payload = verifyToken(token)

          // Verify user still exists and is active
          const user = await userRepository.findById(payload.userId)
          if (!user || user.status !== 'active') {
            throw new AuthenticationError('User not found or inactive')
          }

          // Verify session token exists and is valid
          const sessionToken = await sessionTokenRepository.validate(token)
          if (!sessionToken) {
            throw new AuthenticationError('Invalid session')
          }

          // Attach user info to request
          req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            plexId: user.plexId || undefined,
            plexUsername: user.plexUsername,
          }
          req.token = token

          next()
        } catch (error) {
          next(error)
        }
      }
    }

    // Clean database and create test data
    await cleanDatabase()
    
    // Create test users
    testUser = await userRepository.create({
      plexId: 'test-user-plex-id',
      plexUsername: 'testuser',
      email: 'test@example.com',
      role: 'user',
      status: 'active'
    })

    adminUser = await userRepository.create({
      plexId: 'admin-user-plex-id',
      plexUsername: 'adminuser',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active'
    })

    inactiveUser = await userRepository.create({
      plexId: 'inactive-user-plex-id',
      plexUsername: 'inactiveuser',
      email: 'inactive@example.com',
      role: 'user',
      status: 'inactive'
    })

    // Don't create session tokens in beforeEach - let individual tests create them as needed

    // Setup test routes
    app.get('/public', (req, res) => {
      res.json({ message: 'public endpoint', user: req.user || null })
    })

    app.get('/protected', testAuthMiddleware(), (req, res) => {
      res.json({ message: 'protected endpoint', user: req.user })
    })

    app.get('/admin-only', testAuthMiddleware(), requireAdmin(), (req, res) => {
      res.json({ message: 'admin only endpoint', user: req.user })
    })

    app.get('/user-role', testAuthMiddleware(), requireUser(), (req, res) => {
      res.json({ message: 'user role endpoint', user: req.user })
    })

    app.get('/admin-or-moderator', testAuthMiddleware(), requireRole('admin', 'moderator'), (req, res) => {
      res.json({ message: 'admin or moderator endpoint', user: req.user })
    })

    app.get('/optional-auth', optionalAuth(), (req, res) => {
      res.json({ message: 'optional auth endpoint', user: req.user || null })
    })

    // Add error handler
    app.use(errorHandler)
  })

  afterEach(async () => {
    await cleanDatabase()
  })

  describe('authMiddleware()', () => {
    describe('Token Extraction', () => {
      it('should authenticate with Bearer token in Authorization header', async () => {
        const token = createAuthToken(testUser)
        
        await sessionTokenRepository.create({
          userId: testUser.id,
          hashedToken: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(response.body.user).toMatchObject({
          id: testUser.id,
          email: 'test@example.com',
          role: 'user'
        })
      })

      it('should authenticate with cookie', async () => {
        const token = createAuthToken(testUser)
        
        await sessionTokenRepository.create({
          userId: testUser.id,
          hashedToken: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        const response = await request(app)
          .get('/protected')
          .set('Cookie', `auth-token=${token}`)

        expect(response.status).toBe(200)
        expect(response.body.user.id).toBe(testUser.id)
      })

      it('should reject request with no token', async () => {
        const response = await request(app)
          .get('/protected')

        expect(response.status).toBe(401)
        expect(response.body.error).toBe('Authentication required')
      })

      it('should reject malformed Authorization header', async () => {
        const response = await request(app)
          .get('/protected')
          .set('Authorization', 'Invalid token format')

        expect(response.status).toBe(401)
        expect(response.body.error).toBe('Authentication required')
      })

      it('should prioritize Authorization header over cookie', async () => {
        const validToken = createAuthToken(testUser)
        const invalidToken = 'invalid-token'
        
        await sessionTokenRepository.create({
          userId: testUser.id,
          hashedToken: validToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${validToken}`)
          .set('Cookie', `auth-token=${invalidToken}`)

        expect(response.status).toBe(200)
      })
    })

    describe('Token Validation', () => {
      it('should reject expired JWT token', async () => {
        const expiredToken = createExpiredToken()

        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${expiredToken}`)

        expect(response.status).toBe(401)
        expect(response.body.error).toContain('Token expired')
      })

      it('should reject invalid JWT token', async () => {
        const invalidToken = createInvalidToken()

        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${invalidToken}`)

        expect(response.status).toBe(401)
      })

      it('should reject JWT with invalid signature', async () => {
        const validToken = createAuthToken(testUser)
        const tamperedToken = validToken + 'tampered'

        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${tamperedToken}`)

        expect(response.status).toBe(401)
      })
    })

    describe('User Validation', () => {
      it('should reject token for non-existent user', async () => {
        const token = createAuthToken({ id: 'non-existent-user-id' })

        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(401)
        expect(response.body.error).toBe('User not found or inactive')
      })

      it('should reject token for inactive user', async () => {
        const token = createAuthToken(inactiveUser)

        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(401)
        expect(response.body.error).toBe('User not found or inactive')
      })

      it('should reject when user status changes during session', async () => {
        const token = createAuthToken(testUser)
        
        await sessionTokenRepository.create({
          userId: testUser.id,
          hashedToken: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        // User becomes inactive
        await userRepository.update(testUser.id, { status: 'inactive' })

        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(401)
        expect(response.body.error).toBe('User not found or inactive')
      })
    })

    describe('Session Validation', () => {
      it('should reject token without valid session record', async () => {
        const token = createAuthToken(testUser)
        // Don't create session record in database

        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(401)
        expect(response.body.error).toBe('Invalid session')
      })

      it('should reject expired session token', async () => {
        const token = createAuthToken(testUser)
        
        // Create expired session
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        
        await sessionTokenRepository.create({
          userId: testUser.id,
          hashedToken: token,
          expiresAt: yesterday
        })

        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(401)
        expect(response.body.error).toBe('Invalid session')
      })
    })

    describe('Request Context', () => {
      it('should attach complete user info to request', async () => {
        const token = createAuthToken(testUser)
        
        await sessionTokenRepository.create({
          userId: testUser.id,
          hashedToken: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(response.body.user).toEqual({
          id: testUser.id,
          email: testUser.email,
          name: testUser.name,
          role: testUser.role,
          plexId: testUser.plexId,
          plexUsername: testUser.plexUsername
        })
      })

      it('should attach token to request context', async () => {
        const token = createAuthToken(testUser)
        
        await sessionTokenRepository.create({
          userId: testUser.id,
          hashedToken: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        // Add test route to check token
        app.get('/check-token', testAuthMiddleware(), (req, res) => {
          res.json({ hasToken: !!req.token, tokenLength: req.token?.length })
        })

        const response = await request(app)
          .get('/check-token')
          .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(response.body.hasToken).toBe(true)
        expect(response.body.tokenLength).toBeGreaterThan(0)
      })
    })
  })

  describe('Role-based Authorization', () => {
    describe('requireAdmin()', () => {
      it('should allow admin users', async () => {
        const token = createAuthToken(adminUser)
        
        await sessionTokenRepository.create({
          userId: adminUser.id,
          hashedToken: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        const response = await request(app)
          .get('/admin-only')
          .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
        expect(response.body.message).toBe('admin only endpoint')
      })

      it('should reject regular users', async () => {
        const token = createAuthToken(testUser)
        
        await sessionTokenRepository.create({
          userId: testUser.id,
          hashedToken: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        const response = await request(app)
          .get('/admin-only')
          .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('Required role: admin or ADMIN')
      })

      it('should require authentication first', async () => {
        const response = await request(app)
          .get('/admin-only')

        expect(response.status).toBe(401)
        expect(response.body.error).toBe('Authentication required')
      })
    })

    describe('requireUser()', () => {
      it('should allow user role', async () => {
        const token = createAuthToken(testUser)
        
        await sessionTokenRepository.create({
          userId: testUser.id,
          hashedToken: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        const response = await request(app)
          .get('/user-role')
          .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
      })

      it('should allow admin role', async () => {
        const token = createAuthToken(adminUser)
        
        await sessionTokenRepository.create({
          userId: adminUser.id,
          hashedToken: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        const response = await request(app)
          .get('/user-role')
          .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
      })
    })

    describe('requireRole() with multiple roles', () => {
      it('should allow admin for admin-or-moderator endpoint', async () => {
        const token = createAuthToken(adminUser)
        
        await sessionTokenRepository.create({
          userId: adminUser.id,
          hashedToken: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        const response = await request(app)
          .get('/admin-or-moderator')
          .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(200)
      })

      it('should reject user for admin-or-moderator endpoint', async () => {
        const token = createAuthToken(testUser)
        
        await sessionTokenRepository.create({
          userId: testUser.id,
          hashedToken: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })

        const response = await request(app)
          .get('/admin-or-moderator')
          .set('Authorization', `Bearer ${token}`)

        expect(response.status).toBe(403)
        expect(response.body.error).toContain('Required role: admin or moderator')
      })
    })
  })

  describe('optionalAuth()', () => {
    it('should work without token', async () => {
      const response = await request(app)
        .get('/optional-auth')

      expect(response.status).toBe(200)
      expect(response.body.user).toBeNull()
      expect(response.body.message).toBe('optional auth endpoint')
    })

    it('should attach user when valid token provided', async () => {
      const token = createAuthToken(testUser)
      
      await sessionTokenRepository.create({
        userId: testUser.id,
        hashedToken: token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      })

      const response = await request(app)
        .get('/optional-auth')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.user).toMatchObject({
        id: testUser.id,
        email: testUser.email
      })
    })

    it('should continue without user when invalid token provided', async () => {
      const response = await request(app)
        .get('/optional-auth')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(200)
      expect(response.body.user).toBeNull()
    })

    it('should continue when user is inactive', async () => {
      const token = createAuthToken(inactiveUser)

      const response = await request(app)
        .get('/optional-auth')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.user).toBeNull()
    })

    it('should handle expired tokens gracefully', async () => {
      const expiredToken = createExpiredToken()

      const response = await request(app)
        .get('/optional-auth')
        .set('Authorization', `Bearer ${expiredToken}`)

      expect(response.status).toBe(200)
      expect(response.body.user).toBeNull()
    })
  })

  describe('Security Edge Cases', () => {
    it('should handle very long tokens', async () => {
      const longToken = 'a'.repeat(10000)

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${longToken}`)

      expect(response.status).toBe(401)
    })

    it('should handle empty Bearer token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer ')

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Authentication required')
    })

    it('should handle whitespace-only token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer    ')

      expect(response.status).toBe(401)
    })

    it('should handle null bytes in token', async () => {
      const tokenWithNull = 'valid-start\x00malicious-end'

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${tokenWithNull}`)

      expect(response.status).toBe(401)
    })

    it('should handle concurrent authentication requests', async () => {
      const token = createAuthToken(testUser)
      
      await sessionTokenRepository.create({
        userId: testUser.id,
        hashedToken: token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      })

      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${token}`)
      )

      const responses = await Promise.all(requests)

      responses.forEach(response => {
        expect(response.status).toBe(200)
        expect(response.body.user.id).toBe(testUser.id)
      })
    })

    it('should handle role changes during session', async () => {
      const token = createAuthToken(testUser)
      
      await sessionTokenRepository.create({
        userId: testUser.id,
        hashedToken: token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      })

      // First request as user should work
      let response = await request(app)
        .get('/user-role')
        .set('Authorization', `Bearer ${token}`)
      expect(response.status).toBe(200)

      // Promote user to admin
      await userRepository.update(testUser.id, { role: 'admin' })

      // Second request should now work for admin endpoint
      response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${token}`)
      expect(response.status).toBe(200)
    })
  })

  describe('Performance and Error Handling', () => {
    it('should respond quickly for valid requests', async () => {
      const token = createAuthToken(testUser)
      
      await sessionTokenRepository.create({
        userId: testUser.id,
        hashedToken: token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      })

      const start = Date.now()
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)

      const duration = Date.now() - start
      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(500) // Should respond in under 500ms
    })

    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      const originalFindById = userRepository.findById
      userRepository.findById = vi.fn().mockRejectedValue(new Error('Database connection lost'))

      const token = createAuthToken(testUser)

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(500)

      // Restore original method
      userRepository.findById = originalFindById
    })

    it('should not expose internal error details', async () => {
      // Use invalid token to trigger internal error
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer completely-invalid-jwt-token')

      expect(response.status).toBe(401)
      expect(response.body.error).toBeDefined()
      // Should not expose JWT internals
      expect(response.body.error).not.toContain('JsonWebTokenError')
      expect(response.body.error).not.toContain('signature')
    })
  })
})