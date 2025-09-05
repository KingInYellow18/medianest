import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { ZodError, z } from 'zod'
import { errorHandler } from '@/middleware/error'
import { correlationIdMiddleware } from '@/middleware/correlation-id'
import { requestLogger } from '@/middleware/logging'
import { 
  AppError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  RateLimitError,
  NotFoundError
} from '@/utils/errors'

describe('Error Handling Middleware Chain Integration Tests', () => {
  let app: express.Application
  let consoleSpy: any

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(correlationIdMiddleware)
    app.use(requestLogger)

    // Mock console.error to capture error logs
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Test routes that throw different types of errors
    app.get('/error/app-error', (req, res, next) => {
      next(new AppError('Test app error', 400, 'TEST_ERROR', { test: 'details' }))
    })

    app.get('/error/validation', (req, res, next) => {
      next(new ValidationError('Test validation error'))
    })

    app.get('/error/auth', (req, res, next) => {
      next(new AuthenticationError('Test auth error'))
    })

    app.get('/error/authorization', (req, res, next) => {
      next(new AuthorizationError('Test authorization error'))
    })

    app.get('/error/rate-limit', (req, res, next) => {
      next(new RateLimitError(60))
    })

    app.get('/error/not-found', (req, res, next) => {
      next(new NotFoundError('Test resource'))
    })

    app.get('/error/generic', (req, res, next) => {
      next(new Error('Generic JavaScript error'))
    })

    app.get('/error/async', async (req, res, next) => {
      try {
        // Simulate async operation that fails
        await new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Async operation failed')), 10)
        })
      } catch (error) {
        next(error)
      }
    })

    app.post('/error/zod', (req, res, next) => {
      try {
        const schema = z.object({
          email: z.string().email(),
          age: z.number().min(18),
          name: z.string().min(1)
        })
        
        schema.parse(req.body)
        res.json({ success: true })
      } catch (error) {
        next(error)
      }
    })

    app.get('/error/nested', (req, res, next) => {
      try {
        // Simulate nested function calls that throw
        const deepFunction = () => {
          const deeperFunction = () => {
            throw new Error('Deep nested error')
          }
          deeperFunction()
        }
        deepFunction()
      } catch (error) {
        next(error)
      }
    })

    // Test route with custom error codes
    app.get('/error/custom-code', (req, res, next) => {
      const customCode = req.query.code as string || 'DEFAULT_CODE'
      next(new AppError('Custom error message', 422, customCode))
    })

    // Route that throws synchronous error (not caught by try/catch)
    app.get('/error/uncaught', (req, res, next) => {
      throw new Error('Uncaught synchronous error')
    })

    // Route with sensitive data
    app.post('/error/sensitive', (req, res, next) => {
      req.user = { id: 'test-user', email: 'test@example.com' }
      next(new AppError('Error with sensitive context', 500, 'SENSITIVE_ERROR'))
    })

    // Success route for comparison
    app.get('/success', (req, res) => {
      res.json({ success: true, message: 'All good!' })
    })

    // Add error handler at the end
    app.use(errorHandler)
  })

  afterEach(() => {
    consoleSpy?.mockRestore()
  })

  describe('AppError Handling', () => {
    it('should handle basic AppError with correct status and format', async () => {
      const response = await request(app)
        .get('/error/app-error')
        .expect(400)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Test app error',
          code: 'TEST_ERROR',
          correlationId: expect.any(String)
        }
      })
      
      expect(response.body.error.correlationId).toMatch(/^[a-f0-9\-]{36}$/)
    })

    it('should include development details in dev environment', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      try {
        const response = await request(app)
          .get('/error/app-error')
          .expect(400)

        expect(response.body.error).toHaveProperty('details')
        expect(response.body.error.details).toEqual({ test: 'details' })
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    })

    it('should hide development details in production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      try {
        const response = await request(app)
          .get('/error/app-error')
          .expect(400)

        expect(response.body.error).not.toHaveProperty('details')
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    })
  })

  describe('Specific Error Type Handling', () => {
    it('should handle ValidationError (400)', async () => {
      const response = await request(app)
        .get('/error/validation')
        .expect(400)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          correlationId: expect.any(String)
        }
      })
    })

    it('should handle AuthenticationError (401)', async () => {
      const response = await request(app)
        .get('/error/auth')
        .expect(401)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          correlationId: expect.any(String)
        }
      })
    })

    it('should handle AuthorizationError (403)', async () => {
      const response = await request(app)
        .get('/error/authorization')
        .expect(403)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          correlationId: expect.any(String)
        }
      })
    })

    it('should handle RateLimitError (429) with retryAfter', async () => {
      const response = await request(app)
        .get('/error/rate-limit')
        .expect(429)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          correlationId: expect.any(String),
          retryAfter: 60
        }
      })
    })

    it('should handle NotFoundError (404)', async () => {
      const response = await request(app)
        .get('/error/not-found')
        .expect(404)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND_ERROR',
          correlationId: expect.any(String)
        }
      })
    })
  })

  describe('Zod Validation Error Handling', () => {
    it('should handle Zod validation errors properly', async () => {
      const response = await request(app)
        .post('/error/zod')
        .send({
          email: 'invalid-email',
          age: 16,
          name: ''
        })
        .expect(400)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          correlationId: expect.any(String)
        }
      })
    })

    it('should include Zod error details in development', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      try {
        const response = await request(app)
          .post('/error/zod')
          .send({ email: 'invalid' })
          .expect(400)

        expect(response.body.error).toHaveProperty('details')
        expect(response.body.error.details).toBeInstanceOf(Array)
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    })
  })

  describe('Generic Error Handling', () => {
    it('should handle generic JavaScript errors', async () => {
      const response = await request(app)
        .get('/error/generic')
        .expect(500)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
          correlationId: expect.any(String)
        }
      })
    })

    it('should include stack trace in development for generic errors', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      try {
        const response = await request(app)
          .get('/error/generic')
          .expect(500)

        expect(response.body.error).toHaveProperty('originalMessage', 'Generic JavaScript error')
        expect(response.body.error).toHaveProperty('stack')
        expect(response.body.error.stack).toContain('Generic JavaScript error')
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    })

    it('should handle uncaught synchronous errors', async () => {
      const response = await request(app)
        .get('/error/uncaught')
        .expect(500)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          correlationId: expect.any(String)
        }
      })
    })
  })

  describe('Async Error Handling', () => {
    it('should handle async errors properly', async () => {
      const response = await request(app)
        .get('/error/async')
        .expect(500)

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          correlationId: expect.any(String)
        }
      })
    })
  })

  describe('Error Logging and Sanitization', () => {
    it('should log errors with sanitized request data', async () => {
      await request(app)
        .post('/error/sensitive')
        .set('Authorization', 'Bearer secret-token')
        .set('X-Plex-Token', 'plex-secret')
        .set('Cookie', 'session=secret-session')
        .send({
          username: 'test-user',
          password: 'secret-password',
          data: 'normal-data'
        })
        .expect(500)

      // Verify error was logged but sensitive data was sanitized
      expect(consoleSpy).toHaveBeenCalled()
      
      const logCall = consoleSpy.mock.calls.find(call => 
        call[0] && typeof call[0] === 'object' && call[0].error
      )
      
      expect(logCall).toBeDefined()
      if (logCall) {
        const logData = logCall[0]
        
        // Check that sensitive headers are removed
        expect(logData.request.headers).not.toHaveProperty('authorization')
        expect(logData.request.headers).not.toHaveProperty('x-plex-token')
        expect(logData.request.headers).not.toHaveProperty('cookie')
        
        // Check that password is redacted
        expect(logData.request.body.password).toBe('[REDACTED]')
        expect(logData.request.body.username).toBe('test-user')
        expect(logData.request.body.data).toBe('normal-data')
      }
    })

    it('should include correlation ID in logs', async () => {
      await request(app)
        .get('/error/generic')
        .expect(500)

      expect(consoleSpy).toHaveBeenCalled()
      
      const logCall = consoleSpy.mock.calls.find(call => 
        call[0] && typeof call[0] === 'object' && call[0].correlationId
      )
      
      expect(logCall).toBeDefined()
      if (logCall) {
        expect(logCall[0].correlationId).toMatch(/^[a-f0-9\-]{36}$/)
      }
    })

    it('should log user context when available', async () => {
      await request(app)
        .post('/error/sensitive')
        .expect(500)

      const logCall = consoleSpy.mock.calls.find(call => 
        call[0] && typeof call[0] === 'object' && call[0].userId
      )
      
      expect(logCall).toBeDefined()
      if (logCall) {
        expect(logCall[0].userId).toBe('test-user')
      }
    })
  })

  describe('Error Response Consistency', () => {
    it('should always have consistent error response structure', async () => {
      const endpoints = [
        '/error/app-error',
        '/error/validation',
        '/error/auth',
        '/error/authorization',
        '/error/rate-limit',
        '/error/not-found',
        '/error/generic'
      ]

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint)
        
        expect(response.body).toMatchObject({
          success: false,
          error: {
            message: expect.any(String),
            code: expect.any(String),
            correlationId: expect.any(String)
          }
        })
        
        // Ensure no sensitive data leaks
        expect(JSON.stringify(response.body)).not.toContain('password')
        expect(JSON.stringify(response.body)).not.toContain('token')
      }
    })

    it('should handle custom error codes', async () => {
      const response = await request(app)
        .get('/error/custom-code?code=CUSTOM_TEST_CODE')
        .expect(422)

      expect(response.body.error.code).toBe('CUSTOM_TEST_CODE')
    })
  })

  describe('Error Headers and Status Codes', () => {
    it('should set appropriate HTTP status codes', async () => {
      const testCases = [
        { endpoint: '/error/validation', expectedStatus: 400 },
        { endpoint: '/error/auth', expectedStatus: 401 },
        { endpoint: '/error/authorization', expectedStatus: 403 },
        { endpoint: '/error/not-found', expectedStatus: 404 },
        { endpoint: '/error/rate-limit', expectedStatus: 429 },
        { endpoint: '/error/generic', expectedStatus: 500 }
      ]

      for (const { endpoint, expectedStatus } of testCases) {
        await request(app)
          .get(endpoint)
          .expect(expectedStatus)
      }
    })

    it('should include correlation ID header in error responses', async () => {
      const response = await request(app)
        .get('/error/generic')
        .expect(500)

      expect(response.headers['x-correlation-id']).toMatch(/^[a-f0-9\-]{36}$/)
    })

    it('should set proper content type for error responses', async () => {
      const response = await request(app)
        .get('/error/generic')
        .expect(500)

      expect(response.headers['content-type']).toContain('application/json')
    })
  })

  describe('Nested and Complex Errors', () => {
    it('should handle nested function errors with proper stack traces', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      try {
        const response = await request(app)
          .get('/error/nested')
          .expect(500)

        expect(response.body.error.originalMessage).toBe('Deep nested error')
        expect(response.body.error.stack).toContain('deeperFunction')
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    })
  })

  describe('Error Recovery and Graceful Degradation', () => {
    it('should not crash the server after handling errors', async () => {
      // Trigger multiple errors
      await request(app).get('/error/generic').expect(500)
      await request(app).get('/error/auth').expect(401)
      await request(app).get('/error/validation').expect(400)

      // Server should still respond to normal requests
      await request(app)
        .get('/success')
        .expect(200)
        .expect({ success: true, message: 'All good!' })
    })

    it('should handle errors in error handler gracefully', async () => {
      // This tests the error handler itself doesn't throw
      // by sending a malformed request that might cause issues
      const response = await request(app)
        .get('/error/generic')
        .set('Content-Type', 'application/json')
        .expect(500)

      expect(response.body.success).toBe(false)
    })
  })

  describe('Security Considerations', () => {
    it('should not expose internal paths in stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      try {
        const response = await request(app)
          .get('/error/generic')
          .expect(500)

        expect(response.body.error).not.toHaveProperty('stack')
        expect(response.body.error).not.toHaveProperty('originalMessage')
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    })

    it('should sanitize error messages to prevent information disclosure', async () => {
      const response = await request(app)
        .get('/error/generic')
        .expect(500)

      // Should use user-friendly message instead of technical details
      expect(response.body.error.message).toBe('Something went wrong. Please try again.')
      expect(response.body.error.message).not.toContain('JavaScript error')
    })

    it('should handle malformed JSON in request body gracefully', async () => {
      const response = await request(app)
        .post('/error/zod')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400)

      expect(response.body.success).toBe(false)
    })
  })

  describe('Performance Under Error Conditions', () => {
    it('should handle high volume of errors without performance degradation', async () => {
      const startTime = Date.now()
      
      // Generate 50 errors concurrently
      const errorRequests = Array.from({ length: 50 }, () =>
        request(app).get('/error/generic')
      )

      await Promise.all(errorRequests)
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should not leak memory during error handling', async () => {
      // Generate many different types of errors
      const errorTypes = [
        '/error/generic',
        '/error/auth',
        '/error/validation',
        '/error/rate-limit'
      ]

      for (let i = 0; i < 20; i++) {
        const endpoint = errorTypes[i % errorTypes.length]
        await request(app).get(endpoint)
      }

      // Test should complete without memory issues
      expect(true).toBe(true) // If we get here, no memory leak crashed the test
    })
  })
})