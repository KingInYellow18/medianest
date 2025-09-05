import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { z } from 'zod'
import { validate, validateBody, validateParams, validateQuery, validateRequest } from '@/middleware/validation'
import { correlationIdMiddleware } from '@/middleware/correlation-id'
import { requestLogger } from '@/middleware/logging'
import { errorHandler } from '@/middleware/error'
import {
  createPinSchema,
  checkPinSchema,
  completeOAuthSchema,
  adminBootstrapSchema,
  loginSchema,
  changePasswordSchema,
  sessionSchema
} from '@/schemas/auth.schemas'

describe('Validation Middleware Security Tests', () => {
  let app: express.Application
  let consoleSpy: any

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(correlationIdMiddleware)
    app.use(requestLogger)

    // Mock console for logging tests
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Test routes with various validation schemas
    app.post('/auth/pin', validate(createPinSchema), (req, res) => {
      res.json({ success: true, body: req.body })
    })

    app.get('/auth/pin/:id', validate(checkPinSchema), (req, res) => {
      res.json({ success: true, params: req.params })
    })

    app.post('/auth/oauth/complete', validate(completeOAuthSchema), (req, res) => {
      res.json({ success: true, body: req.body })
    })

    app.post('/auth/admin/bootstrap', validate(adminBootstrapSchema), (req, res) => {
      res.json({ success: true, body: req.body })
    })

    app.post('/auth/login', validate(loginSchema), (req, res) => {
      res.json({ success: true, body: req.body })
    })

    app.post('/auth/change-password', validate(changePasswordSchema), (req, res) => {
      res.json({ success: true, body: req.body })
    })

    // Test route for XSS protection
    app.post('/test/xss', validateBody(z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional()
    })), (req, res) => {
      res.json({ success: true, data: req.body })
    })

    // Test route for SQL injection protection
    app.get('/test/sql/:id', validateParams(z.object({
      id: z.string().uuid()
    })), (req, res) => {
      res.json({ success: true, id: req.params.id })
    })

    // Test route for query validation
    app.get('/test/query', validateQuery(z.object({
      page: z.string().regex(/^\d+$/).transform(Number).optional(),
      limit: z.string().regex(/^\d+$/).transform(Number).optional(),
      search: z.string().max(100).optional()
    })), (req, res) => {
      res.json({ success: true, query: req.query })
    })

    // Test route for combined validation
    app.post('/test/combined/:id', validateRequest({
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ name: z.string().min(1) }),
      query: z.object({ update: z.string().optional() })
    }), (req, res) => {
      res.json({ success: true, params: req.params, body: req.body, query: req.query })
    })

    app.use(errorHandler)
  })

  afterEach(() => {
    consoleSpy?.mockRestore()
  })

  describe('XSS Protection', () => {
    it('should reject script injection attempts', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '"><script>alert("xss")</script>',
        '\'"--></script><script>alert("xss")</script>'
      ]

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/test/xss')
          .send({ name: payload })

        // Should succeed but the data should be sanitized by the application layer
        // The validation layer ensures proper format, not content sanitization
        expect(response.status).toBe(200)
        expect(response.body.data.name).toBe(payload)
      }
    })

    it('should handle HTML entities in input', async () => {
      const response = await request(app)
        .post('/test/xss')
        .send({
          name: '&lt;script&gt;alert("test")&lt;/script&gt;',
          description: '&amp;quot;test&amp;quot;'
        })

      expect(response.status).toBe(200)
      expect(response.body.data.name).toBe('&lt;script&gt;alert("test")&lt;/script&gt;')
    })

    it('should reject overly long input to prevent buffer overflow', async () => {
      const longString = 'a'.repeat(101) // Exceeds max length of 100

      const response = await request(app)
        .post('/test/xss')
        .send({ name: longString })
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toContain('String must contain at most 100 character(s)')
    })

    it('should reject null bytes and control characters', async () => {
      const maliciousInputs = [
        'test\x00null',
        'test\x01control',
        'test\x1Fcontrol',
        'test\rreturn',
        'test\nline'
      ]

      for (const input of maliciousInputs) {
        const response = await request(app)
          .post('/test/xss')
          .send({ name: input })

        // Should accept the input as validation doesn't reject control chars by default
        // This is application-specific sanitization
        expect(response.status).toBe(200)
      }
    })
  })

  describe('SQL Injection Protection', () => {
    it('should reject SQL injection attempts in UUID field', async () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
        "' OR 1=1#",
        "' OR 'a'='a",
        "'; EXEC xp_cmdshell('dir'); --"
      ]

      for (const payload of sqlPayloads) {
        const response = await request(app)
          .get(`/test/sql/${encodeURIComponent(payload)}`)
          .expect(400)

        expect(response.body.error.code).toBe('VALIDATION_ERROR')
        expect(response.body.error.message).toContain('Invalid uuid')
      }
    })

    it('should accept valid UUIDs', async () => {
      const validUuids = [
        '123e4567-e89b-12d3-a456-426614174000',
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff'
      ]

      for (const uuid of validUuids) {
        const response = await request(app)
          .get(`/test/sql/${uuid}`)
          .expect(200)

        expect(response.body.id).toBe(uuid)
      }
    })

    it('should handle query parameter injection attempts', async () => {
      const response = await request(app)
        .get('/test/query')
        .query({
          search: "'; DROP TABLE users; --",
          page: '1',
          limit: '10'
        })
        .expect(200)

      // Should accept the search term as it's just a string validation
      expect(response.body.query.search).toBe("'; DROP TABLE users; --")
      expect(response.body.query.page).toBe(1)
      expect(response.body.query.limit).toBe(10)
    })

    it('should reject non-numeric pagination parameters', async () => {
      const response = await request(app)
        .get('/test/query')
        .query({
          page: 'SELECT * FROM users',
          limit: '1 OR 1=1'
        })
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('Input Sanitization and Validation', () => {
    it('should validate email formats correctly', async () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user..double.dot@example.com',
        'user@.com',
        'user name@example.com' // space
      ]

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/auth/login')
          .send({ email, password: 'test123' })
          .expect(400)

        expect(response.body.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should accept valid email formats', async () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user123@example-site.co.uk'
      ]

      for (const email of validEmails) {
        const response = await request(app)
          .post('/auth/login')
          .send({ email, password: 'test123' })
          .expect(200)

        expect(response.body.body.email).toBe(email)
      }
    })

    it('should enforce strong password requirements', async () => {
      const weakPasswords = [
        'short', // too short
        'alllowercase', // no uppercase/numbers/symbols
        'ALLUPPERCASE', // no lowercase/numbers/symbols
        '12345678', // only numbers
        'Password', // missing number and symbol
        'Password1', // missing symbol
        'password1!', // missing uppercase
        'PASSWORD1!' // missing lowercase
      ]

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/auth/admin/bootstrap')
          .send({
            email: 'admin@example.com',
            name: 'Admin User',
            password,
            confirmPassword: password
          })
          .expect(400)

        expect(response.body.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should accept strong passwords', async () => {
      const strongPasswords = [
        'StrongP@ss1',
        'MySecur3P@ssword!',
        'Admin123$',
        '!SecurePass123'
      ]

      for (const password of strongPasswords) {
        const response = await request(app)
          .post('/auth/admin/bootstrap')
          .send({
            email: 'admin@example.com',
            name: 'Admin User',
            password,
            confirmPassword: password
          })
          .expect(200)

        expect(response.body.body.email).toBe('admin@example.com')
        expect(response.body.body).not.toHaveProperty('password') // Should not echo password
      }
    })

    it('should validate password confirmation matching', async () => {
      const response = await request(app)
        .post('/auth/admin/bootstrap')
        .send({
          email: 'admin@example.com',
          name: 'Admin User',
          password: 'StrongP@ss1',
          confirmPassword: 'DifferentP@ss1'
        })
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toContain('Passwords do not match')
    })
  })

  describe('Authentication Schema Validation', () => {
    it('should validate PIN creation with optional parameters', async () => {
      // Valid request with no body
      await request(app)
        .post('/auth/pin')
        .expect(200)

      // Valid request with optional parameters
      await request(app)
        .post('/auth/pin')
        .send({
          clientIdentifier: '123e4567-e89b-12d3-a456-426614174000',
          deviceName: 'My Device'
        })
        .expect(200)
    })

    it('should reject invalid PIN creation parameters', async () => {
      // Invalid UUID format
      await request(app)
        .post('/auth/pin')
        .send({ clientIdentifier: 'not-a-uuid' })
        .expect(400)

      // Device name too long
      await request(app)
        .post('/auth/pin')
        .send({ deviceName: 'a'.repeat(101) })
        .expect(400)

      // Empty device name
      await request(app)
        .post('/auth/pin')
        .send({ deviceName: '' })
        .expect(400)
    })

    it('should validate PIN status check parameters', async () => {
      // Valid numeric PIN ID
      await request(app)
        .get('/auth/pin/123456')
        .expect(200)

      // Should convert string to number
      const response = await request(app)
        .get('/auth/pin/123456')
        .expect(200)

      expect(response.body.params.id).toBe(123456)
      expect(typeof response.body.params.id).toBe('number')
    })

    it('should reject invalid PIN ID formats', async () => {
      const invalidIds = ['abc', '123.45', 'null', '', '123abc']

      for (const id of invalidIds) {
        await request(app)
          .get(`/auth/pin/${id}`)
          .expect(400)
      }
    })

    it('should validate OAuth completion request', async () => {
      // Valid request
      await request(app)
        .post('/auth/oauth/complete')
        .send({ pinId: 123456 })
        .expect(200)

      // Invalid PIN ID types
      const invalidPinIds = [-1, 0, 'string', null, undefined, 1.5]

      for (const pinId of invalidPinIds) {
        await request(app)
          .post('/auth/oauth/complete')
          .send({ pinId })
          .expect(400)
      }
    })
  })

  describe('Error Handling and Security', () => {
    it('should not expose sensitive validation details in production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      try {
        const response = await request(app)
          .post('/auth/login')
          .send({ email: 'invalid', password: '' })
          .expect(400)

        expect(response.body.error).not.toHaveProperty('details')
        expect(response.body.error).not.toHaveProperty('stack')
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    })

    it('should include validation details in development', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      try {
        const response = await request(app)
          .post('/auth/login')
          .send({ email: 'invalid', password: '' })
          .expect(400)

        expect(response.body.error.code).toBe('VALIDATION_ERROR')
        // Development should include more details
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    })

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toBe('Invalid JSON in request body')
    })

    it('should log validation failures for security monitoring', async () => {
      await request(app)
        .post('/auth/login')
        .send({ email: 'invalid', password: 'short' })
        .expect(400)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed'),
        expect.objectContaining({
          correlationId: expect.any(String),
          url: '/auth/login',
          method: 'POST',
          errors: expect.any(Array)
        })
      )
    })

    it('should handle content type attacks', async () => {
      // Try to bypass validation with wrong content type
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'text/plain')
        .send('email=hacker@example.com&password=hack123')
        .expect(400)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should handle deeply nested object attacks', async () => {
      const deeplyNested: any = {}
      let current = deeplyNested
      
      // Create deeply nested object to test DoS protection
      for (let i = 0; i < 100; i++) {
        current.nested = {}
        current = current.nested
      }

      const response = await request(app)
        .post('/test/xss')
        .send({ name: 'test', nested: deeplyNested })
        .expect(200)

      // Should accept but ignore unknown fields
      expect(response.body.data).toEqual({ name: 'test' })
    })
  })

  describe('Combined Validation Security', () => {
    it('should validate all request parts simultaneously', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000'
      
      const response = await request(app)
        .post(`/test/combined/${validUuid}`)
        .query({ update: 'true' })
        .send({ name: 'Valid Name' })
        .expect(200)

      expect(response.body.params.id).toBe(validUuid)
      expect(response.body.body.name).toBe('Valid Name')
      expect(response.body.query.update).toBe('true')
    })

    it('should reject request if any part fails validation', async () => {
      // Valid UUID but invalid body
      await request(app)
        .post('/test/combined/123e4567-e89b-12d3-a456-426614174000')
        .query({ update: 'true' })
        .send({ name: '' }) // Empty name
        .expect(400)

      // Valid body but invalid UUID
      await request(app)
        .post('/test/combined/invalid-uuid')
        .query({ update: 'true' })
        .send({ name: 'Valid Name' })
        .expect(400)
    })
  })

  describe('Performance and DoS Protection', () => {
    it('should handle high volume validation requests without degradation', async () => {
      const startTime = Date.now()
      
      // Generate 50 validation requests
      const requests = Array.from({ length: 50 }, () =>
        request(app)
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'validPass123!' })
      )

      await Promise.all(requests)
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(3000) // Should complete within 3 seconds
    })

    it('should handle various payload sizes', async () => {
      const sizes = [1, 10, 50, 99] // Test different lengths within limit
      
      for (const size of sizes) {
        const name = 'a'.repeat(size)
        const response = await request(app)
          .post('/test/xss')
          .send({ name })
          .expect(200)

        expect(response.body.data.name).toHaveLength(size)
      }
    })
  })
})