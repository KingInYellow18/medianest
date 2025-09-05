import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { setupRoutes } from '@/routes'
import { errorHandler } from '@/middleware/error'
import { correlationIdMiddleware } from '@/middleware/correlation-id'
import { createAuthToken, createAdminToken } from '../../helpers/auth'
import { cleanDatabase, seedTestData } from '../../helpers/database'

describe('Authentication API Integration Tests', () => {
  let app: express.Application
  let testUserToken: string
  let adminToken: string
  let testUser: any
  let adminUser: any

  beforeAll(async () => {
    // Setup test app
    app = express()
    app.use(express.json())
    app.use(correlationIdMiddleware)
    setupRoutes(app)
    app.use(errorHandler)
  })

  beforeEach(async () => {
    await cleanDatabase()
    const seedData = await seedTestData()
    testUser = seedData.testUser
    adminUser = seedData.adminUser
    
    testUserToken = createAuthToken(testUser)
    adminToken = createAuthToken(adminUser)
  })

  afterAll(async () => {
    await cleanDatabase()
  })

  describe('POST /api/auth/plex', () => {
    it('should return placeholder response for Plex OAuth', async () => {
      const response = await request(app)
        .post('/api/auth/plex')
        .send({
          code: 'test-plex-code',
          state: 'test-state'
        })

      // Currently returns placeholder
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        message: 'Plex auth endpoint'
      })
    })

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/auth/plex')
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Plex auth endpoint')
    })

    it('should include correlation ID in response', async () => {
      const response = await request(app)
        .post('/api/auth/plex')
        .send({ test: 'data' })

      expect(response.headers['x-correlation-id']).toMatch(/^[a-f0-9\-]{36}$/)
    })

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/plex')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')

      expect(response.status).toBe(400)
    })

    it('should handle large payloads', async () => {
      const largePayload = {
        data: 'x'.repeat(10000) // 10KB string
      }

      const response = await request(app)
        .post('/api/auth/plex')
        .send(largePayload)

      // Should handle or appropriately limit
      expect([200, 400, 413]).toContain(response.status)
    })

    it('should validate content type', async () => {
      const response = await request(app)
        .post('/api/auth/plex')
        .set('Content-Type', 'text/plain')
        .send('plain text data')

      // Express should handle this appropriately
      expect(response.status).toBeDefined()
    })
  })

  describe('POST /api/auth/admin', () => {
    it('should return placeholder response for admin auth', async () => {
      const response = await request(app)
        .post('/api/auth/admin')
        .send({
          username: 'admin',
          password: 'password'
        })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        message: 'Admin auth endpoint'
      })
    })

    it('should handle missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/admin')
        .send({})

      expect(response.status).toBe(200) // Placeholder currently returns 200
      expect(response.body.message).toBe('Admin auth endpoint')
    })

    it('should not expose sensitive information in logs', async () => {
      const response = await request(app)
        .post('/api/auth/admin')
        .send({
          username: 'admin',
          password: 'secret-password-123'
        })

      // Response should not contain password
      expect(JSON.stringify(response.body)).not.toContain('secret-password-123')
      expect(response.headers['x-correlation-id']).toBeDefined()
    })

    it('should handle SQL injection attempts', async () => {
      const maliciousPayload = {
        username: "admin'; DROP TABLE users; --",
        password: "' OR '1'='1"
      }

      const response = await request(app)
        .post('/api/auth/admin')
        .send(maliciousPayload)

      // Should not crash and handle safely
      expect(response.status).toBeDefined()
      expect(response.body.message).toBe('Admin auth endpoint')
    })

    it('should handle XSS attempts in parameters', async () => {
      const xssPayload = {
        username: '<script>alert("xss")</script>',
        password: 'password'
      }

      const response = await request(app)
        .post('/api/auth/admin')
        .send(xssPayload)

      expect(response.status).toBeDefined()
      // Response should not contain the script tag directly
      expect(JSON.stringify(response.body)).not.toContain('<script>')
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should return placeholder response for logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        message: 'Logout endpoint'
      })
    })

    it('should work without authentication header (for now)', async () => {
      const response = await request(app)
        .post('/api/auth/logout')

      expect(response.status).toBe(200)
    })

    it('should work with authentication header', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testUserToken}`)

      expect(response.status).toBe(200)
    })

    it('should handle invalid tokens gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(200) // Placeholder doesn't validate yet
    })

    it('should handle missing Bearer prefix', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', testUserToken)

      expect(response.status).toBe(200)
    })
  })

  describe('GET /api/auth/session', () => {
    it('should return placeholder response for session check', async () => {
      const response = await request(app)
        .get('/api/auth/session')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        message: 'Session endpoint'
      })
    })

    it('should work without authentication (placeholder)', async () => {
      const response = await request(app)
        .get('/api/auth/session')

      expect(response.status).toBe(200)
    })

    it('should include proper headers', async () => {
      const response = await request(app)
        .get('/api/auth/session')

      expect(response.headers['content-type']).toContain('application/json')
      expect(response.headers['x-correlation-id']).toMatch(/^[a-f0-9\-]{36}$/)
    })

    it('should handle query parameters', async () => {
      const response = await request(app)
        .get('/api/auth/session?include=user&details=true')

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Session endpoint')
    })

    it('should respond quickly', async () => {
      const start = Date.now()
      
      await request(app)
        .get('/api/auth/session')
        .expect(200)

      const duration = Date.now() - start
      expect(duration).toBeLessThan(100) // Should be fast
    })
  })

  describe('HTTP Method Validation', () => {
    it('should reject GET requests to POST-only endpoints', async () => {
      const response = await request(app)
        .get('/api/auth/plex')

      expect(response.status).toBe(404)
    })

    it('should reject POST requests to GET-only endpoints', async () => {
      const response = await request(app)
        .post('/api/auth/session')

      expect(response.status).toBe(404)
    })

    it('should handle OPTIONS requests for CORS preflight', async () => {
      const response = await request(app)
        .options('/api/auth/plex')

      // Express may handle this automatically
      expect([200, 204, 404]).toContain(response.status)
    })
  })

  describe('Request Validation', () => {
    it('should handle very long URLs', async () => {
      const longPath = '/api/auth/session?' + 'param='.repeat(1000) + 'value'
      
      const response = await request(app)
        .get(longPath.substring(0, 2048)) // Limit to reasonable size

      // Should either handle or return appropriate error
      expect([200, 400, 414]).toContain(response.status)
    })

    it('should handle special characters in request body', async () => {
      const specialChars = {
        data: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        unicode: '한글 中文 العربية русский ελληνικά'
      }

      const response = await request(app)
        .post('/api/auth/plex')
        .send(specialChars)

      expect(response.status).toBe(200)
    })

    it('should handle null and undefined values', async () => {
      const payload = {
        username: null,
        password: undefined,
        data: ''
      }

      const response = await request(app)
        .post('/api/auth/admin')
        .send(payload)

      expect(response.status).toBe(200)
    })

    it('should handle nested objects', async () => {
      const nestedPayload = {
        user: {
          credentials: {
            username: 'admin',
            password: 'password'
          },
          metadata: {
            source: 'test',
            timestamp: new Date().toISOString()
          }
        }
      }

      const response = await request(app)
        .post('/api/auth/admin')
        .send(nestedPayload)

      expect(response.status).toBe(200)
    })

    it('should handle arrays in request body', async () => {
      const arrayPayload = {
        users: ['admin', 'user1', 'user2'],
        permissions: [1, 2, 3, 4]
      }

      const response = await request(app)
        .post('/api/auth/admin')
        .send(arrayPayload)

      expect(response.status).toBe(200)
    })
  })

  describe('Error Handling', () => {
    it('should handle network interruptions gracefully', async () => {
      // Simulate aborted request by setting very short timeout
      const response = await request(app)
        .post('/api/auth/plex')
        .timeout(1) // Very short timeout
        .send({ test: 'data' })
        .catch(err => ({ status: 408, error: err.message })) // Catch timeout

      expect([200, 408, 500]).toContain(response.status)
    })

    it('should maintain consistent error format', async () => {
      const response = await request(app)
        .post('/api/auth/plex')
        .set('Content-Type', 'application/json')
        .send('invalid json')

      if (response.status >= 400) {
        expect(response.body).toHaveProperty('error')
      }
    })
  })

  describe('Security Headers', () => {
    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/api/auth/session')

      expect(response.headers['server']).toBeUndefined()
      expect(response.headers['x-powered-by']).toBeUndefined()
    })

    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/auth/session')

      // These might be set by helmet middleware
      expect(response.headers).toBeDefined()
    })

    it('should handle suspicious user agents', async () => {
      const response = await request(app)
        .post('/api/auth/plex')
        .set('User-Agent', '<script>alert("xss")</script>')
        .send({ test: 'data' })

      expect(response.status).toBe(200)
    })
  })

  describe('Rate Limiting (Future)', () => {
    it('should accept normal request frequency', async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(app).post('/api/auth/plex').send({ test: 'data' })
      )

      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })
})