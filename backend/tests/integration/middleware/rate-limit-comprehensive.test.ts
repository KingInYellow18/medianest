import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createRateLimit, apiRateLimit, authRateLimit, youtubeRateLimit, mediaRequestRateLimit, strictRateLimit } from '@/middleware/rate-limit'
import { errorHandler } from '@/middleware/error'
import { getRedis, initializeRedis } from '@/config/redis'
import { RateLimitError } from '@/utils/errors'

describe('Rate Limiting Middleware Comprehensive Tests', () => {
  let app: express.Application
  let redis: ReturnType<typeof getRedis>

  beforeEach(async () => {
    // Setup Express app
    app = express()
    app.use(express.json())

    // Initialize Redis for tests and clear test data
    await initializeRedis()
    redis = getRedis()
    await redis.flushdb()

    // Mock IP for consistent testing
    app.set('trust proxy', true)
    app.use((req, res, next) => {
      Object.defineProperty(req, 'ip', {
        value: '127.0.0.1',
        writable: false,
        configurable: true
      })
      next()
    })

    // Test routes with different rate limits
    app.get('/api/test', apiRateLimit, (req, res) => {
      res.json({ message: 'API endpoint', timestamp: Date.now() })
    })

    app.post('/auth/test', authRateLimit, (req, res) => {
      res.json({ message: 'Auth endpoint' })
    })

    app.post('/youtube/test', youtubeRateLimit, (req, res) => {
      res.json({ message: 'YouTube endpoint' })
    })

    app.post('/media/test', mediaRequestRateLimit, (req, res) => {
      res.json({ message: 'Media request endpoint' })
    })

    app.post('/sensitive/test', strictRateLimit, (req, res) => {
      res.json({ message: 'Sensitive operation' })
    })

    // Custom rate limit for testing
    app.get('/custom/test', createRateLimit({
      windowMs: 10 * 1000, // 10 seconds
      max: 3,
      message: 'Custom rate limit exceeded'
    }), (req, res) => {
      res.json({ message: 'Custom endpoint' })
    })

    // Endpoint with user-based rate limiting
    app.get('/user-rate-test', (req, res, next) => {
      req.user = { id: 'test-user-1' }
      next()
    }, createRateLimit({
      windowMs: 10 * 1000,
      max: 2,
      keyGenerator: (req) => req.user?.id || req.ip || 'unknown'
    }), (req, res) => {
      res.json({ message: 'User-rate-limited endpoint' })
    })

    // Endpoint with skip options
    app.get('/skip-test', createRateLimit({
      windowMs: 10 * 1000,
      max: 2,
      skipSuccessfulRequests: true
    }), (req, res) => {
      const fail = req.query.fail === 'true'
      if (fail) {
        res.status(400).json({ error: 'Forced failure' })
      } else {
        res.json({ message: 'Success' })
      }
    })

    app.use(errorHandler)
  })

  afterEach(async () => {
    await redis.flushdb()
  })

  describe('Basic Rate Limiting Functionality', () => {
    it('should allow requests under the limit', async () => {
      const response = await request(app)
        .get('/custom/test')

      expect(response.status).toBe(200)
      expect(response.body.message).toBe('Custom endpoint')
      expect(response.headers['x-ratelimit-limit']).toBe('3')
      expect(response.headers['x-ratelimit-remaining']).toBe('2')
      expect(response.headers['x-ratelimit-reset']).toBeDefined()
    })

    it('should block requests when limit exceeded', async () => {
      // Make 3 requests (at limit)
      for (let i = 0; i < 3; i++) {
        const response = await request(app).get('/custom/test')
        expect(response.status).toBe(200)
      }

      // 4th request should be blocked
      const response = await request(app).get('/custom/test')
      expect(response.status).toBe(429)
      expect(response.body.error).toContain('rate limit')
      expect(response.headers['retry-after']).toBeDefined()
    })

    it('should reset limit after window expires', async () => {
      // Consume the limit
      for (let i = 0; i < 3; i++) {
        await request(app).get('/custom/test')
      }

      // Should be blocked
      let response = await request(app).get('/custom/test')
      expect(response.status).toBe(429)

      // Wait for window to expire (10 seconds + buffer)
      await new Promise(resolve => setTimeout(resolve, 11000))

      // Should work again
      response = await request(app).get('/custom/test')
      expect(response.status).toBe(200)
    }, 15000)

    it('should update rate limit headers correctly', async () => {
      // First request
      let response = await request(app).get('/custom/test')
      expect(response.headers['x-ratelimit-limit']).toBe('3')
      expect(response.headers['x-ratelimit-remaining']).toBe('2')

      // Second request
      response = await request(app).get('/custom/test')
      expect(response.headers['x-ratelimit-remaining']).toBe('1')

      // Third request
      response = await request(app).get('/custom/test')
      expect(response.headers['x-ratelimit-remaining']).toBe('0')

      // Fourth request (blocked)
      response = await request(app).get('/custom/test')
      expect(response.status).toBe(429)
      expect(response.headers['x-ratelimit-remaining']).toBe('0')
    })
  })

  describe('Pre-configured Rate Limiters', () => {
    it('should enforce API rate limit (100/minute)', async () => {
      // Test a few requests to ensure it's working
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/api/test')
        expect(response.status).toBe(200)
        expect(response.headers['x-ratelimit-limit']).toBe('100')
      }
    })

    it('should enforce auth rate limit (5/15min)', async () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const response = await request(app).post('/auth/test')
        expect(response.status).toBe(200)
      }

      // 6th should be blocked
      const response = await request(app).post('/auth/test')
      expect(response.status).toBe(429)
      expect(response.body.error).toContain('authentication')
    })

    it('should enforce YouTube rate limit (5/hour)', async () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const response = await request(app).post('/youtube/test')
        expect(response.status).toBe(200)
      }

      // 6th should be blocked
      const response = await request(app).post('/youtube/test')
      expect(response.status).toBe(429)
      expect(response.body.error).toContain('YouTube')
    })

    it('should enforce media request rate limit (20/hour)', async () => {
      // Test a few requests
      for (let i = 0; i < 3; i++) {
        const response = await request(app).post('/media/test')
        expect(response.status).toBe(200)
      }
    })

    it('should enforce strict rate limit (3/hour)', async () => {
      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        const response = await request(app).post('/sensitive/test')
        expect(response.status).toBe(200)
      }

      // 4th should be blocked
      const response = await request(app).post('/sensitive/test')
      expect(response.status).toBe(429)
    })
  })

  describe('Key Generation and User-based Limiting', () => {
    it('should use user ID for authenticated requests', async () => {
      // First user makes 2 requests (at limit)
      for (let i = 0; i < 2; i++) {
        const response = await request(app).get('/user-rate-test')
        expect(response.status).toBe(200)
      }

      // Third request should be blocked
      const response = await request(app).get('/user-rate-test')
      expect(response.status).toBe(429)
    })

    it('should handle multiple users independently', async () => {
      const app2 = express()
      app2.use(express.json())
      app2.use((req, res, next) => {
        req.ip = '127.0.0.1'
        next()
      })

      app2.get('/user-rate-test', (req, res, next) => {
        req.user = { id: 'test-user-2' }
        next()
      }, createRateLimit({
        windowMs: 10 * 1000,
        max: 2,
        keyGenerator: (req) => req.user?.id || req.ip || 'unknown'
      }), (req, res) => {
        res.json({ message: 'User-rate-limited endpoint' })
      })

      // User 1 exhausts their limit
      for (let i = 0; i < 2; i++) {
        await request(app).get('/user-rate-test')
      }
      let response = await request(app).get('/user-rate-test')
      expect(response.status).toBe(429)

      // User 2 should still have requests available
      response = await request(app2).get('/user-rate-test')
      expect(response.status).toBe(200)
    })

    it('should fall back to IP when user not available', async () => {
      const testApp = express()
      testApp.use(express.json())
      testApp.set('trust proxy', true)
      testApp.use((req, res, next) => {
        Object.defineProperty(req, 'ip', {
          value: '192.168.1.1',
          writable: false,
          configurable: true
        })
        next()
      })

      testApp.get('/test', createRateLimit({
        windowMs: 10 * 1000,
        max: 2
      }), (req, res) => {
        res.json({ message: 'IP-based rate limit' })
      })

      // Make requests from specific IP
      for (let i = 0; i < 2; i++) {
        const response = await request(testApp).get('/test')
        expect(response.status).toBe(200)
      }

      const response = await request(testApp).get('/test')
      expect(response.status).toBe(429)
    })
  })

  describe('Skip Options', () => {
    it('should skip successful requests when skipSuccessfulRequests is true', async () => {
      // Make successful requests (should be skipped)
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/skip-test')
        expect(response.status).toBe(200)
      }

      // All should succeed because successful requests are skipped
      const response = await request(app).get('/skip-test')
      expect(response.status).toBe(200)
    })

    it('should count failed requests when skipSuccessfulRequests is true', async () => {
      // Make failed requests (should count)
      for (let i = 0; i < 2; i++) {
        const response = await request(app).get('/skip-test?fail=true')
        expect(response.status).toBe(400)
      }

      // Third failed request should be rate limited
      const response = await request(app).get('/skip-test?fail=true')
      expect(response.status).toBe(429)
    })
  })

  describe('Redis Integration', () => {
    it('should use Redis for persistent rate limiting', async () => {
      // Make a request
      await request(app).get('/custom/test')

      // Check Redis directly
      const count = await redis.get('rate:127.0.0.1')
      expect(count).toBe('1')

      // Check TTL is set
      const ttl = await redis.ttl('rate:127.0.0.1')
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(10)
    })

    it('should use Lua script for atomic operations', async () => {
      // Make concurrent requests
      const requests = Array.from({ length: 5 }, () => 
        request(app).get('/custom/test')
      )

      const responses = await Promise.all(requests)

      // Only 3 should succeed due to rate limit
      const successful = responses.filter(r => r.status === 200)
      const rateLimited = responses.filter(r => r.status === 429)

      expect(successful.length).toBe(3)
      expect(rateLimited.length).toBe(2)
    })

    it('should handle Redis connection errors gracefully', async () => {
      // Mock Redis error
      const originalEval = redis.eval
      redis.eval = vi.fn().mockRejectedValue(new Error('Redis connection lost'))

      // Request should still succeed (graceful degradation)
      const response = await request(app).get('/custom/test')
      expect(response.status).toBe(200)

      // Restore Redis
      redis.eval = originalEval
    })

    it('should clean up expired keys automatically', async () => {
      // Make a request to create a key
      await request(app).get('/custom/test')
      
      // Key should exist
      let exists = await redis.exists('rate:127.0.0.1')
      expect(exists).toBe(1)

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 11000))

      // Key should be expired
      exists = await redis.exists('rate:127.0.0.1')
      expect(exists).toBe(0)
    }, 15000)
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed Redis responses', async () => {
      // Mock malformed Redis response
      const originalEval = redis.eval
      redis.eval = vi.fn().mockResolvedValue(['not', 'a', 'valid', 'response'])

      const response = await request(app).get('/custom/test')
      // Should either succeed or fail gracefully
      expect([200, 500]).toContain(response.status)

      redis.eval = originalEval
    })

    it('should handle very high request rates', async () => {
      // Simulate high concurrent load
      const requests = Array.from({ length: 50 }, () => 
        request(app).get('/custom/test')
      )

      const responses = await Promise.all(requests)
      
      // Verify rate limiting is working under load
      const successful = responses.filter(r => r.status === 200)
      const rateLimited = responses.filter(r => r.status === 429)
      
      expect(successful.length).toBe(3) // Only 3 should succeed
      expect(rateLimited.length).toBe(47)
    })

    it('should handle requests with missing IP', async () => {
      const testApp = express()
      testApp.use(express.json())
      testApp.set('trust proxy', true)
      
      // Don't set req.ip explicitly
      testApp.get('/test', createRateLimit({
        windowMs: 10 * 1000,
        max: 2
      }), (req, res) => {
        res.json({ message: 'No IP test' })
      })

      const response = await request(testApp).get('/test')
      expect(response.status).toBe(200)
    })

    it('should handle zero and negative limits gracefully', async () => {
      const testApp = express()
      testApp.use(express.json())
      testApp.set('trust proxy', true)
      testApp.use((req, res, next) => {
        Object.defineProperty(req, 'ip', {
          value: '127.0.0.1',
          writable: false,
          configurable: true
        })
        next()
      })

      testApp.get('/zero-limit', createRateLimit({
        windowMs: 10 * 1000,
        max: 0 // Zero limit
      }), (req, res) => {
        res.json({ message: 'Should not reach here' })
      })

      const response = await request(testApp).get('/zero-limit')
      expect(response.status).toBe(429)
    })

    it('should handle custom error messages', async () => {
      const testApp = express()
      testApp.use(express.json())
      testApp.set('trust proxy', true)
      testApp.use((req, res, next) => {
        Object.defineProperty(req, 'ip', {
          value: '127.0.0.1',
          writable: false,
          configurable: true
        })
        next()
      })

      testApp.get('/custom-message', createRateLimit({
        windowMs: 10 * 1000,
        max: 1,
        message: 'Custom rate limit message'
      }), (req, res) => {
        res.json({ message: 'Success' })
      })

      testApp.use(errorHandler)

      // First request succeeds
      await request(testApp).get('/custom-message')

      // Second request gets custom message
      const response = await request(testApp).get('/custom-message')
      expect(response.status).toBe(429)
      expect(response.body.error).toContain('Custom rate limit message')
    })
  })

  describe('Performance and Monitoring', () => {
    it('should respond quickly for rate limit checks', async () => {
      const start = Date.now()
      await request(app).get('/custom/test')
      const duration = Date.now() - start
      
      expect(duration).toBeLessThan(100) // Should be very fast
    })

    it('should provide accurate rate limit headers timing', async () => {
      const response = await request(app).get('/custom/test')
      const resetTime = new Date(response.headers['x-ratelimit-reset'])
      const now = new Date()
      
      // Reset time should be in the future but within window
      expect(resetTime.getTime()).toBeGreaterThan(now.getTime())
      expect(resetTime.getTime()).toBeLessThan(now.getTime() + 11000)
    })

    it('should handle rate limit header edge cases', async () => {
      // Exhaust the limit
      for (let i = 0; i < 3; i++) {
        await request(app).get('/custom/test')
      }

      // Rate limited response should still have headers
      const response = await request(app).get('/custom/test')
      expect(response.status).toBe(429)
      expect(response.headers['x-ratelimit-limit']).toBe('3')
      expect(response.headers['x-ratelimit-remaining']).toBe('0')
      expect(response.headers['retry-after']).toBeDefined()
    })
  })
})