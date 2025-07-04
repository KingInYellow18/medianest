import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { createRateLimiter } from '@/middleware/rate-limit'
import Redis from 'ioredis-mock'

describe('Rate Limiting Middleware', () => {
  let redis: Redis
  let req: Partial<Request>
  let res: Partial<Response>
  let next: NextFunction

  beforeEach(() => {
    redis = new Redis()
    req = {
      user: {
        id: 'test-user-id',
        plexId: 'plex-123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        plexToken: null
      },
      path: '/api/test',
      ip: '127.0.0.1'
    }
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn()
    }
    next = vi.fn()
  })

  describe('General API Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const limiter = createRateLimiter(redis, { limit: 5, window: 60 })

      for (let i = 0; i < 5; i++) {
        await limiter(req as Request, res as Response, next)
      }

      expect(next).toHaveBeenCalledTimes(5)
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should block requests exceeding limit', async () => {
      const limiter = createRateLimiter(redis, { limit: 2, window: 60 })

      // First two requests should pass
      await limiter(req as Request, res as Response, next)
      await limiter(req as Request, res as Response, next)
      
      // Third request should be blocked
      await limiter(req as Request, res as Response, next)

      expect(next).toHaveBeenCalledTimes(2)
      expect(next).toHaveBeenLastCalledWith(expect.objectContaining({
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED'
      }))
    })

    it('should reset after window expires', async () => {
      const limiter = createRateLimiter(redis, { limit: 1, window: 1 }) // 1 second window

      // First request should pass
      await limiter(req as Request, res as Response, next)
      expect(next).toHaveBeenCalledTimes(1)

      // Second request should be blocked
      await limiter(req as Request, res as Response, next)
      expect(next).toHaveBeenLastCalledWith(expect.objectContaining({
        statusCode: 429
      }))

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100))

      // Third request should pass
      next.mockClear()
      await limiter(req as Request, res as Response, next)
      expect(next).toHaveBeenCalledTimes(1)
      expect(next).not.toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 429
      }))
    })

    it('should set rate limit headers', async () => {
      const limiter = createRateLimiter(redis, { limit: 100, window: 60 })

      await limiter(req as Request, res as Response, next)

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100')
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String))
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String))
    })

    it('should use IP as fallback for unauthenticated requests', async () => {
      req.user = undefined
      const limiter = createRateLimiter(redis, { limit: 5, window: 60 })

      await limiter(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  describe('YouTube Download Rate Limiting', () => {
    it('should enforce stricter limits for YouTube downloads', async () => {
      const limiter = createRateLimiter(redis, { 
        limit: 5, 
        window: 3600, // 1 hour
        keyPrefix: 'youtube'
      })
      req.path = '/api/youtube/download'

      // Should allow 5 downloads
      for (let i = 0; i < 5; i++) {
        await limiter(req as Request, res as Response, next)
      }

      // 6th download should be blocked
      await limiter(req as Request, res as Response, next)

      expect(next).toHaveBeenCalledTimes(5)
      expect(next).toHaveBeenLastCalledWith(expect.objectContaining({
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED'
      }))
    })

    it('should provide retry-after header for YouTube limits', async () => {
      const limiter = createRateLimiter(redis, { 
        limit: 1, 
        window: 3600,
        keyPrefix: 'youtube'
      })

      // First request passes
      await limiter(req as Request, res as Response, next)
      
      // Second request blocked
      await limiter(req as Request, res as Response, next)

      const error = next.mock.calls[1][0]
      expect(error.retryAfter).toBeGreaterThan(0)
      expect(error.retryAfter).toBeLessThanOrEqual(3600)
    })
  })

  describe('Rate Limit Key Generation', () => {
    it('should create unique keys per user', async () => {
      const limiter = createRateLimiter(redis, { limit: 2, window: 60 })
      
      // User 1
      await limiter(req as Request, res as Response, next)
      await limiter(req as Request, res as Response, next)
      await limiter(req as Request, res as Response, next) // Should be blocked

      // User 2
      req.user!.id = 'different-user-id'
      next.mockClear()
      await limiter(req as Request, res as Response, next)
      
      // User 2's first request should pass
      expect(next).toHaveBeenCalledTimes(1)
      expect(next).not.toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 429
      }))
    })

    it('should create unique keys per endpoint', async () => {
      const limiter = createRateLimiter(redis, { 
        limit: 1, 
        window: 60,
        keyPrefix: 'endpoint'
      })
      
      // Endpoint 1
      req.path = '/api/endpoint1'
      await limiter(req as Request, res as Response, next)
      await limiter(req as Request, res as Response, next) // Should be blocked

      // Endpoint 2
      req.path = '/api/endpoint2'
      next.mockClear()
      await limiter(req as Request, res as Response, next)
      
      // Different endpoint should have its own limit
      expect(next).toHaveBeenCalledTimes(1)
      expect(next).not.toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 429
      }))
    })
  })
})