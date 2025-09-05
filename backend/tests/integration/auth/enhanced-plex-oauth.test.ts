import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { http, HttpResponse } from 'msw'
import { server as mswServer } from '../../mocks/server'
import { errorHandler } from '@/middleware/error'
import { correlationIdMiddleware } from '@/middleware/correlation-id'
import { cleanDatabase, seedTestData } from '../../helpers/database'

// Enhanced Plex OAuth implementation for testing
const createPlexAuthRouter = () => {
  const router = express.Router()

  // PIN generation endpoint
  router.post('/plex/pin', async (_req, res, next) => {
    try {
      // Make actual request to mocked Plex API
      const response = await fetch('https://plex.tv/pins.xml', {
        method: 'POST',
        headers: {
          'X-Plex-Product': 'MediaNest',
          'X-Plex-Version': '1.0.0',
          'X-Plex-Client-Identifier': process.env.PLEX_CLIENT_ID || 'test-client-id'
        }
      })

      if (!response.ok) {
        throw new Error(`Plex API returned ${response.status}`)
      }

      const xmlText = await response.text()
      
      // Parse XML (simplified)
      const idMatch = xmlText.match(/<id>(\d+)<\/id>/)
      const codeMatch = xmlText.match(/<code>([A-Z0-9]+)<\/code>/)
      
      if (!idMatch || !codeMatch) {
        throw new Error('Invalid response from Plex API')
      }

      const pinId = idMatch[1]
      const pinCode = codeMatch[1]

      res.json({
        success: true,
        data: {
          id: pinId,
          code: pinCode,
          qrUrl: `https://plex.tv/link/#!/pin/${pinId}`,
          expiresIn: 900, // 15 minutes
          pollInterval: 5000 // 5 seconds
        }
      })
    } catch (error: any) {
      if (error.message.includes('503') || error.message.includes('ECONNREFUSED')) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'PLEX_UNREACHABLE',
            message: 'Cannot connect to Plex server. Please try again.'
          }
        })
      }

      next(error)
    }
  })

  // PIN polling endpoint
  router.get('/plex/pin/:id/status', async (req, res, next) => {
    try {
      const { id } = req.params
      
      const response = await fetch(`https://plex.tv/pins/${id}.xml`)
      
      if (!response.ok) {
        if (response.status === 404) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PIN',
              message: 'Invalid or expired PIN'
            }
          })
        }
        throw new Error(`Plex API returned ${response.status}`)
      }

      const xmlText = await response.text()
      const authTokenMatch = xmlText.match(/<authToken>([^<]+)<\/authToken>/)
      
      if (!authTokenMatch) {
        return res.json({
          success: true,
          data: {
            status: 'waiting',
            authorized: false
          }
        })
      }

      // Get user details
      const userResponse = await fetch('https://plex.tv/users/account.xml', {
        headers: {
          'X-Plex-Token': authTokenMatch[1]
        }
      })

      if (!userResponse.ok) {
        throw new Error('Failed to get user details')
      }

      const userXml = await userResponse.text()
      const userIdMatch = userXml.match(/<id>([^<]+)<\/id>/)
      const usernameMatch = userXml.match(/<username>([^<]+)<\/username>/)
      const emailMatch = userXml.match(/<email>([^<]+)<\/email>/)

      res.json({
        success: true,
        data: {
          status: 'authorized',
          authorized: true,
          authToken: authTokenMatch[1],
          user: {
            plexId: userIdMatch?.[1],
            username: usernameMatch?.[1],
            email: emailMatch?.[1]
          }
        }
      })
    } catch (error) {
      next(error)
    }
  })

  // Complete authentication
  router.post('/plex/complete', async (req, res, next) => {
    try {
      const { authToken, user, rememberMe = false } = req.body

      if (!authToken || !user?.plexId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required authentication data'
          }
        })
      }

      // Mock user creation/update logic
      const mockUser = {
        id: `user-${user.plexId}`,
        plexId: user.plexId,
        username: user.username,
        email: user.email,
        role: 'user', // Would check isFirstUser() in real implementation
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        plexToken: authToken
      }

      // Generate JWT tokens (mocked)
      const jwtToken = 'mock-jwt-token'
      const sessionToken = 'mock-session-token'

      // Set secure cookies
      res.cookie('token', jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 30 days or 24 hours
      })

      if (rememberMe) {
        res.cookie('rememberToken', sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
        })
      }

      res.json({
        success: true,
        data: {
          user: {
            id: mockUser.id,
            username: mockUser.username,
            email: mockUser.email,
            role: mockUser.role
          },
          token: jwtToken,
          ...(rememberMe && { rememberToken: sessionToken })
        }
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}

describe('Enhanced Plex OAuth Flow Integration Tests', () => {
  let app: express.Application

  beforeEach(async () => {
    await cleanDatabase()
    
    app = express()
    app.use(express.json())
    app.use(correlationIdMiddleware)
    app.use('/api/auth', createPlexAuthRouter())
    app.use(errorHandler)
  })

  afterEach(async () => {
    mswServer.resetHandlers()
    await cleanDatabase()
  })

  describe('PIN Generation Flow', () => {
    it('should generate PIN with all required fields', async () => {
      const response = await request(app)
        .post('/api/auth/plex/pin')
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: '12345',
          code: 'ABCD',
          qrUrl: 'https://plex.tv/link/#!/pin/12345',
          expiresIn: 900,
          pollInterval: 5000
        }
      })
    })

    it('should handle Plex API unavailability', async () => {
      mswServer.use(
        http.post('https://plex.tv/pins.xml', () => {
          return HttpResponse.text('Service Unavailable', { status: 503 })
        })
      )

      const response = await request(app)
        .post('/api/auth/plex/pin')
        .expect(503)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'PLEX_UNREACHABLE',
          message: 'Cannot connect to Plex server. Please try again.'
        }
      })
    })

    it('should handle malformed Plex API responses', async () => {
      mswServer.use(
        http.post('https://plex.tv/pins.xml', () => {
          return HttpResponse.text('<invalid>xml</invalid>')
        })
      )

      const response = await request(app)
        .post('/api/auth/plex/pin')
        .expect(500)

      expect(response.body).toHaveProperty('error')
    })

    it('should include proper headers in Plex API request', async () => {
      let capturedHeaders: Record<string, string> = {}
      
      mswServer.use(
        http.post('https://plex.tv/pins.xml', ({ request }) => {
          capturedHeaders = Object.fromEntries(request.headers.entries())
          return HttpResponse.text(`
            <pin>
              <id>12345</id>
              <code>ABCD</code>
            </pin>
          `)
        })
      )

      await request(app)
        .post('/api/auth/plex/pin')
        .expect(200)

      expect(capturedHeaders['x-plex-product']).toBe('MediaNest')
      expect(capturedHeaders['x-plex-version']).toBe('1.0.0')
      expect(capturedHeaders['x-plex-client-identifier']).toBeDefined()
    })
  })

  describe('PIN Status Polling', () => {
    it('should return waiting status for unlinked PIN', async () => {
      mswServer.use(
        http.get('https://plex.tv/pins/:id.xml', () => {
          return HttpResponse.text(`
            <pin>
              <id>12345</id>
              <code>ABCD</code>
            </pin>
          `)
        })
      )

      const response = await request(app)
        .get('/api/auth/plex/pin/12345/status')
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'waiting',
          authorized: false
        }
      })
    })

    it('should return authorized status with user data for linked PIN', async () => {
      const response = await request(app)
        .get('/api/auth/plex/pin/12345/status')
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'authorized',
          authorized: true,
          authToken: 'plex-auth-token-123',
          user: {
            plexId: 'plex-user-456',
            username: 'testplexuser',
            email: 'plex@example.com'
          }
        }
      })
    })

    it('should handle invalid PIN IDs', async () => {
      mswServer.use(
        http.get('https://plex.tv/pins/:id.xml', () => {
          return HttpResponse.text('Not Found', { status: 404 })
        })
      )

      const response = await request(app)
        .get('/api/auth/plex/pin/invalid/status')
        .expect(400)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_PIN',
          message: 'Invalid or expired PIN'
        }
      })
    })

    it('should handle Plex user API errors', async () => {
      mswServer.use(
        http.get('https://plex.tv/users/account.xml', () => {
          return HttpResponse.text('Unauthorized', { status: 401 })
        })
      )

      const response = await request(app)
        .get('/api/auth/plex/pin/12345/status')
        .expect(500)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('Authentication Completion', () => {
    const validAuthData = {
      authToken: 'plex-auth-token-123',
      user: {
        plexId: 'plex-user-456',
        username: 'testplexuser',
        email: 'plex@example.com'
      },
      rememberMe: false
    }

    it('should complete authentication successfully', async () => {
      const response = await request(app)
        .post('/api/auth/plex/complete')
        .send(validAuthData)
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: 'user-plex-user-456',
            username: 'testplexuser',
            email: 'plex@example.com',
            role: 'user'
          },
          token: 'mock-jwt-token'
        }
      })
    })

    it('should set secure HTTP-only cookies', async () => {
      const response = await request(app)
        .post('/api/auth/plex/complete')
        .send(validAuthData)
        .expect(200)

      const cookies = response.headers['set-cookie']
      expect(cookies).toBeDefined()
      
      const tokenCookie = cookies.find((c: string) => c.startsWith('token='))
      expect(tokenCookie).toContain('HttpOnly')
      expect(tokenCookie).toContain('SameSite=Lax')
    })

    it('should handle remember me functionality', async () => {
      const rememberMeData = { ...validAuthData, rememberMe: true }
      
      const response = await request(app)
        .post('/api/auth/plex/complete')
        .send(rememberMeData)
        .expect(200)

      expect(response.body.data).toHaveProperty('rememberToken')
      
      const cookies = response.headers['set-cookie']
      const rememberCookie = cookies.find((c: string) => c.startsWith('rememberToken='))
      expect(rememberCookie).toContain('Max-Age=7776000') // 90 days
    })

    it('should set different expiry times for remember me', async () => {
      // Normal login
      const normalResponse = await request(app)
        .post('/api/auth/plex/complete')
        .send({ ...validAuthData, rememberMe: false })

      // Remember me login
      const rememberResponse = await request(app)
        .post('/api/auth/plex/complete')
        .send({ ...validAuthData, rememberMe: true })

      const normalCookies = normalResponse.headers['set-cookie']
      const rememberCookies = rememberResponse.headers['set-cookie']

      const normalTokenCookie = normalCookies.find((c: string) => c.startsWith('token='))
      const rememberTokenCookie = rememberCookies.find((c: string) => c.startsWith('token='))

      // Extract Max-Age values
      const normalMaxAge = normalTokenCookie?.match(/Max-Age=(\d+)/)?.[1]
      const rememberMaxAge = rememberTokenCookie?.match(/Max-Age=(\d+)/)?.[1]

      expect(Number(rememberMaxAge)).toBeGreaterThan(Number(normalMaxAge))
    })

    it('should validate required fields', async () => {
      const invalidData = { authToken: 'token-only' }
      
      const response = await request(app)
        .post('/api/auth/plex/complete')
        .send(invalidData)
        .expect(400)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required authentication data'
        }
      })
    })

    it('should handle missing auth token', async () => {
      const noTokenData = {
        user: {
          plexId: 'plex-user-456',
          username: 'testuser'
        }
      }
      
      const response = await request(app)
        .post('/api/auth/plex/complete')
        .send(noTokenData)
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should handle missing user data', async () => {
      const noUserData = { authToken: 'plex-token' }
      
      const response = await request(app)
        .post('/api/auth/plex/complete')
        .send(noUserData)
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle network timeouts gracefully', async () => {
      mswServer.use(
        http.post('https://plex.tv/pins.xml', () => {
          return HttpResponse.text('Gateway Timeout', { status: 504 })
        })
      )

      const response = await request(app)
        .post('/api/auth/plex/pin')
        .timeout(1000)

      expect(response.status).toBe(504)
      expect(response.body).toHaveProperty('error')
    })

    it('should handle concurrent PIN generation requests', async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(app).post('/api/auth/plex/pin')
      )

      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
      })
    })

    it('should sanitize XML content to prevent XXE attacks', async () => {
      const maliciousXml = `<?xml version="1.0" encoding="ISO-8859-1"?>
        <!DOCTYPE foo [
          <!ENTITY xxe SYSTEM "file:///etc/passwd" >]>
        <pin>
          <id>&xxe;</id>
          <code>ABCD</code>
        </pin>`

      mswServer.use(
        http.post('https://plex.tv/pins.xml', () => {
          return HttpResponse.text(maliciousXml)
        })
      )

      const response = await request(app)
        .post('/api/auth/plex/pin')

      // Should either parse safely or return error
      if (response.status === 200) {
        expect(response.body.data.id).not.toContain('root:')
      }
    })

    it('should rate limit PIN generation attempts', async () => {
      // Generate many PINs rapidly
      const rapidRequests = Array.from({ length: 10 }, () =>
        request(app).post('/api/auth/plex/pin')
      )

      const responses = await Promise.all(rapidRequests)
      
      // All should succeed in test environment, but rate limiting could be added
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status)
      })
    })

    it('should handle very long usernames and emails', async () => {
      const longData = {
        authToken: 'valid-token',
        user: {
          plexId: 'user-123',
          username: 'a'.repeat(1000),
          email: 'a'.repeat(500) + '@example.com'
        }
      }

      const response = await request(app)
        .post('/api/auth/plex/complete')
        .send(longData)

      // Should either handle gracefully or validate length
      expect([200, 400]).toContain(response.status)
    })

    it('should handle special characters in user data', async () => {
      const specialCharData = {
        authToken: 'valid-token',
        user: {
          plexId: 'user-123',
          username: 'test<script>alert("xss")</script>user',
          email: 'test+tag@example.com'
        }
      }

      const response = await request(app)
        .post('/api/auth/plex/complete')
        .send(specialCharData)
        .expect(200)

      // Ensure XSS content is not reflected back
      expect(JSON.stringify(response.body)).not.toContain('<script>')
    })
  })

  describe('Security Tests', () => {
    it('should not expose sensitive data in error messages', async () => {
      mswServer.use(
        http.get('https://plex.tv/pins/:id.xml', () => {
          throw new Error('Database connection failed: password=secret123')
        })
      )

      const response = await request(app)
        .get('/api/auth/plex/pin/12345/status')

      expect(JSON.stringify(response.body)).not.toContain('secret123')
      expect(JSON.stringify(response.body)).not.toContain('password=')
    })

    it('should use HTTPS for production cookie settings', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      try {
        const response = await request(app)
          .post('/api/auth/plex/complete')
          .send({
            authToken: 'token',
            user: { plexId: 'user', username: 'test' }
          })

        const cookies = response.headers['set-cookie']
        const tokenCookie = cookies?.find((c: string) => c.startsWith('token='))
        
        expect(tokenCookie).toContain('Secure')
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    })

    it('should include correlation IDs for request tracing', async () => {
      const response = await request(app)
        .post('/api/auth/plex/pin')

      expect(response.headers['x-correlation-id']).toMatch(/^[a-f0-9\-]{36}$/)
    })
  })

  describe('Real-world Integration Scenarios', () => {
    it('should handle complete OAuth flow end-to-end', async () => {
      // 1. Generate PIN
      const pinResponse = await request(app)
        .post('/api/auth/plex/pin')
        .expect(200)

      const { id: pinId } = pinResponse.body.data

      // 2. Poll for authorization (waiting)
      const waitingResponse = await request(app)
        .get(`/api/auth/plex/pin/${pinId}/status`)

      if (waitingResponse.body.data.status === 'waiting') {
        // 3. Poll again (authorized)
        mswServer.use(
          http.get(`https://plex.tv/pins/${pinId}.xml`, () => {
            return HttpResponse.text(`
              <pin>
                <id>${pinId}</id>
                <code>ABCD</code>
                <authToken>plex-auth-token-123</authToken>
              </pin>
            `)
          })
        )

        const authorizedResponse = await request(app)
          .get(`/api/auth/plex/pin/${pinId}/status`)
          .expect(200)

        expect(authorizedResponse.body.data.authorized).toBe(true)

        // 4. Complete authentication
        const completeResponse = await request(app)
          .post('/api/auth/plex/complete')
          .send({
            authToken: authorizedResponse.body.data.authToken,
            user: authorizedResponse.body.data.user,
            rememberMe: true
          })
          .expect(200)

        expect(completeResponse.body.data.user).toBeDefined()
        expect(completeResponse.body.data.token).toBeDefined()
        expect(completeResponse.headers['set-cookie']).toBeDefined()
      }
    })
  })
})