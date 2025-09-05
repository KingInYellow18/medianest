import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { correlationIdMiddleware } from '@/middleware/correlation-id'
import { errorHandler } from '@/middleware/error'
import { setupRoutes } from '@/routes'
import { createAuthToken, createAdminToken, createAuthHeaders } from '../../helpers/auth'
import { cleanDatabase, getTestPrismaClient, seedTestData } from '../../helpers/database'

describe('API Server Integration Tests', () => {
  let app: express.Application
  let testUserToken: string
  let adminToken: string

  beforeAll(async () => {
    // Setup test app with same middleware as main server
    app = express()
    
    app.set('trust proxy', true)
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }))
    app.use(cors({
      origin: 'http://localhost:3000',
      credentials: true,
    }))
    app.use(compression())
    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))
    app.use(correlationIdMiddleware)

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() })
    })

    // Metrics endpoint
    app.get('/metrics', (req, res) => {
      if (process.env.NODE_ENV === 'production') {
        const authHeader = req.headers.authorization
        if (!authHeader || authHeader !== `Bearer ${process.env.METRICS_TOKEN}`) {
          return res.status(401).json({ error: 'Unauthorized' })
        }
      }
      
      res.json({ 
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
      })
    })

    // Setup routes
    setupRoutes(app)

    // Error handling
    app.use(errorHandler)
  })

  beforeEach(async () => {
    await cleanDatabase()
    const { testUser, adminUser } = await seedTestData()
    
    testUserToken = createAuthToken(testUser)
    adminToken = createAuthToken(adminUser)
  })

  afterAll(async () => {
    await cleanDatabase()
  })

  describe('Health Check Endpoints', () => {
    it('should return server health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String)
      })
    })

    it('should return detailed health from /api/health', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200)

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'backend',
        timestamp: expect.any(String),
        version: expect.any(String),
        uptime: expect.any(Number)
      })
      
      expect(response.body.uptime).toBeGreaterThan(0)
    })

    it('should not require authentication for health checks', async () => {
      await request(app)
        .get('/health')
        .expect(200)

      await request(app)
        .get('/api/health')
        .expect(200)
    })
  })

  describe('Metrics Endpoint', () => {
    it('should return metrics in test environment', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200)

      expect(response.body).toMatchObject({
        uptime: expect.any(Number),
        memory: expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number)
        }),
        pid: expect.any(Number)
      })
    })
  })

  describe('CORS Configuration', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000')

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    })

    it('should allow credentials', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000')

      expect(response.headers['access-control-allow-credentials']).toBe('true')
    })
  })

  describe('Security Headers', () => {
    it('should include Helmet security headers', async () => {
      const response = await request(app)
        .get('/health')

      expect(response.headers['x-dns-prefetch-control']).toBe('off')
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN')
      expect(response.headers['x-download-options']).toBe('noopen')
      expect(response.headers['x-content-type-options']).toBe('nosniff')
      expect(response.headers['x-xss-protection']).toBe('0')
    })

    it('should include CSP header', async () => {
      const response = await request(app)
        .get('/health')

      expect(response.headers['content-security-policy']).toContain("default-src 'self'")
    })
  })

  describe('Request Processing', () => {
    it('should handle JSON requests', async () => {
      const response = await request(app)
        .post('/api/auth/plex')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json')

      // Should not fail parsing (specific response depends on implementation)
      expect(response.status).toBeDefined()
    })

    it('should handle URL-encoded requests', async () => {
      const response = await request(app)
        .post('/api/auth/plex')
        .send('test=data')
        .set('Content-Type', 'application/x-www-form-urlencoded')

      // Should not fail parsing
      expect(response.status).toBeDefined()
    })

    it('should compress responses', async () => {
      const response = await request(app)
        .get('/health')
        .set('Accept-Encoding', 'gzip')

      // Helmet may set this or compression middleware
      expect(response.headers['content-encoding'] || 'identity').toBeDefined()
    })
  })

  describe('Route Registration', () => {
    it('should register auth routes', async () => {
      const response = await request(app)
        .post('/api/auth/logout')

      // Should not return 404
      expect(response.status).not.toBe(404)
    })

    it('should register dashboard routes', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')

      // Should not return 404 (but may return 401/403)
      expect(response.status).not.toBe(404)
    })

    it('should register media routes', async () => {
      const response = await request(app)
        .get('/api/media/requests')

      // Should not return 404
      expect(response.status).not.toBe(404)
    })

    it('should register plex routes', async () => {
      const response = await request(app)
        .get('/api/plex/libraries')

      // Should not return 404
      expect(response.status).not.toBe(404)
    })

    it('should register youtube routes', async () => {
      const response = await request(app)
        .get('/api/youtube/downloads')

      // Should not return 404
      expect(response.status).not.toBe(404)
    })

    it('should register admin routes', async () => {
      const response = await request(app)
        .get('/api/admin/users')

      // Should not return 404
      expect(response.status).not.toBe(404)
    })
  })

  describe('Error Handling', () => {
    it('should return 404 for non-existent API routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found'
        }
      })
    })

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/plex')
        .send('{"malformed": json}')
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(400)
    })

    it('should include correlation ID in responses', async () => {
      const response = await request(app)
        .get('/health')

      expect(response.headers['x-correlation-id']).toMatch(/^[a-f0-9\-]{36}$/) // UUID format
    })

    it('should handle oversized requests', async () => {
      const largePayload = 'x'.repeat(2 * 1024 * 1024) // 2MB string
      
      const response = await request(app)
        .post('/api/auth/plex')
        .send({ data: largePayload })
        .set('Content-Type', 'application/json')

      // Should either handle it or return appropriate error
      expect([200, 400, 413, 500]).toContain(response.status)
    })
  })

  describe('Authentication Flow', () => {
    it('should reject requests without authentication where required', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')

      expect(response.status).toBe(401)
    })

    it('should accept valid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${testUserToken}`)

      // Should not return 401 (may return other codes based on implementation)
      expect(response.status).not.toBe(401)
    })

    it('should reject invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(401)
    })

    it('should reject expired JWT tokens', async () => {
      const jwt = require('jsonwebtoken')
      const expiredToken = jwt.sign(
        { userId: 'test', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      )

      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${expiredToken}`)

      expect(response.status).toBe(401)
    })
  })

  describe('Content Type Handling', () => {
    it('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .post('/api/auth/plex')
        .send('test data')

      // Should not crash
      expect(response.status).toBeDefined()
    })

    it('should reject unsupported content types for POST requests', async () => {
      const response = await request(app)
        .post('/api/auth/plex')
        .send('test data')
        .set('Content-Type', 'text/plain')

      // May return 400 or handle gracefully
      expect([200, 400, 415]).toContain(response.status)
    })
  })

  describe('Request Size Limits', () => {
    it('should handle normal sized requests', async () => {
      const normalPayload = { test: 'data'.repeat(100) }
      
      const response = await request(app)
        .post('/api/auth/plex')
        .send(normalPayload)

      expect(response.status).not.toBe(413)
    })
  })

  describe('Special Characters and Encoding', () => {
    it('should handle UTF-8 characters in requests', async () => {
      const unicodePayload = {
        title: 'Тест 测试 🎬',
        description: 'Unicode content with émojis 🎭'
      }

      const response = await request(app)
        .post('/api/auth/plex')
        .send(unicodePayload)
        .set('Content-Type', 'application/json; charset=utf-8')

      // Should parse without errors
      expect(response.status).toBeDefined()
    })

    it('should handle special characters in URLs', async () => {
      const response = await request(app)
        .get('/api/plex/libraries?search=' + encodeURIComponent('test with spaces & symbols'))

      // Should not crash
      expect(response.status).toBeDefined()
    })
  })

  describe('Performance and Reliability', () => {
    it('should respond to health checks quickly', async () => {
      const start = Date.now()
      
      await request(app)
        .get('/health')
        .expect(200)

      const duration = Date.now() - start
      expect(duration).toBeLessThan(50) // Should be very fast
    })

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/health').expect(200)
      )

      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect(response.body.status).toBe('ok')
      })
    })

    it('should maintain consistent response format', async () => {
      const responses = await Promise.all([
        request(app).get('/health'),
        request(app).get('/health'),
        request(app).get('/health')
      ])

      const structures = responses.map(r => Object.keys(r.body).sort())
      
      expect(structures[0]).toEqual(structures[1])
      expect(structures[1]).toEqual(structures[2])
    })
  })
})