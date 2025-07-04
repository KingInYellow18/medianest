import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { errorHandler } from '@/middleware/error'
import { correlationIdMiddleware } from '@/middleware/correlation-id'
import { authRouter } from '../../mocks/auth-router'
import { server as mswServer } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

// Mock repositories
vi.mock('@/repositories', () => ({
  userRepository: {
    findByPlexId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    isFirstUser: vi.fn()
  }
}))

describe('Plex OAuth PIN Flow', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(correlationIdMiddleware)
    app.use('/api/auth', authRouter)
    app.use(errorHandler)
  })

  describe('PIN Generation', () => {
    it('should generate a PIN successfully', async () => {
      const response = await request(app)
        .post('/api/auth/plex/pin')
        .send()

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: '12345',
          code: 'ABCD',
          qrUrl: expect.stringContaining('plex.tv/link'),
          expiresIn: expect.any(Number)
        }
      })
    })

    it('should handle Plex API errors gracefully', async () => {
      // Override MSW handler to return error
      mswServer.use(
        http.post('https://plex.tv/pins.xml', () => {
          return HttpResponse.text('Service Unavailable', { status: 503 })
        })
      )

      const response = await request(app)
        .post('/api/auth/plex/pin')
        .send()

      expect(response.status).toBe(503)
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'PLEX_UNREACHABLE',
          message: 'Cannot connect to Plex server. Please try again.'
        }
      })
    })
  })

  describe('PIN Verification', () => {
    it('should verify PIN and create user successfully', async () => {
      const { userRepository } = await import('@/repositories')
      vi.mocked(userRepository.findByPlexId).mockResolvedValue(null)
      vi.mocked(userRepository.isFirstUser).mockResolvedValue(false)
      vi.mocked(userRepository.create).mockResolvedValue({
        id: 'new-user-id',
        plexId: 'plex-user-456',
        username: 'testplexuser',
        email: 'plex@example.com',
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        plexToken: 'encrypted-token'
      })

      const response = await request(app)
        .post('/api/auth/plex/verify')
        .send({ pinId: '12345' })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: 'new-user-id',
            username: 'testplexuser',
            email: 'plex@example.com',
            role: 'user'
          },
          token: expect.any(String),
          rememberToken: expect.any(String)
        }
      })

      // Verify user creation was called
      expect(userRepository.create).toHaveBeenCalledWith({
        plexId: 'plex-user-456',
        username: 'testplexuser',
        email: 'plex@example.com',
        plexToken: 'plex-auth-token-123',
        role: 'user',
        lastLoginAt: expect.any(Date)
      })
    })

    it('should update existing user on login', async () => {
      const existingUser = {
        id: 'existing-user-id',
        plexId: 'plex-user-456',
        username: 'oldusername',
        email: 'old@example.com',
        role: 'user',
        status: 'active',
        createdAt: new Date('2024-01-01'),
        lastLoginAt: new Date('2024-01-01'),
        plexToken: 'old-token'
      }

      const { userRepository } = await import('@/repositories')
      vi.mocked(userRepository.findByPlexId).mockResolvedValue(existingUser)
      vi.mocked(userRepository.update).mockResolvedValue({
        ...existingUser,
        username: 'testplexuser',
        email: 'plex@example.com',
        plexToken: 'plex-auth-token-123',
        lastLoginAt: new Date()
      })

      const response = await request(app)
        .post('/api/auth/plex/verify')
        .send({ pinId: '12345' })

      expect(response.status).toBe(200)
      expect(userRepository.update).toHaveBeenCalledWith(
        'existing-user-id',
        {
          username: 'testplexuser',
          email: 'plex@example.com',
          plexToken: 'plex-auth-token-123',
          lastLoginAt: expect.any(Date)
        }
      )
    })

    it('should assign admin role to first user', async () => {
      const { userRepository } = await import('@/repositories')
      vi.mocked(userRepository.findByPlexId).mockResolvedValue(null)
      vi.mocked(userRepository.isFirstUser).mockResolvedValue(true)
      vi.mocked(userRepository.create).mockResolvedValue({
        id: 'first-user-id',
        plexId: 'plex-user-456',
        username: 'firstadmin',
        email: 'admin@example.com',
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        plexToken: 'encrypted-token'
      })

      const response = await request(app)
        .post('/api/auth/plex/verify')
        .send({ pinId: '12345' })

      expect(response.status).toBe(200)
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin'
        })
      )
    })

    it('should handle expired PIN', async () => {
      // Override handler to return PIN without auth token
      mswServer.use(
        http.get('https://plex.tv/pins/:id.xml', () => {
          return HttpResponse.text(`
            <pin>
              <id>expired-pin</id>
              <code>XXXX</code>
            </pin>
          `, {
            headers: { 'Content-Type': 'application/xml' }
          })
        })
      )

      const response = await request(app)
        .post('/api/auth/plex/verify')
        .send({ pinId: 'expired-pin' })

      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'PIN_NOT_AUTHORIZED',
          message: expect.stringContaining('not been authorized')
        }
      })
    })

    it('should handle invalid PIN', async () => {
      mswServer.use(
        http.get('https://plex.tv/pins/:id.xml', () => {
          return HttpResponse.text('Not Found', { status: 404 })
        })
      )

      const response = await request(app)
        .post('/api/auth/plex/verify')
        .send({ pinId: 'invalid-pin' })

      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_PIN',
          message: expect.stringContaining('Invalid or expired PIN')
        }
      })
    })

    it('should handle missing PIN ID', async () => {
      const response = await request(app)
        .post('/api/auth/plex/verify')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR'
        }
      })
    })

    it('should set secure cookies', async () => {
      const { userRepository } = await import('@/repositories')
      vi.mocked(userRepository.findByPlexId).mockResolvedValue(null)
      vi.mocked(userRepository.isFirstUser).mockResolvedValue(false)
      vi.mocked(userRepository.create).mockResolvedValue({
        id: 'new-user-id',
        plexId: 'plex-user-456',
        username: 'testplexuser',
        email: 'plex@example.com',
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        plexToken: 'encrypted-token'
      })

      const response = await request(app)
        .post('/api/auth/plex/verify')
        .send({ pinId: '12345' })

      // Check for secure cookie headers
      const cookies = response.headers['set-cookie']
      expect(cookies).toBeDefined()
      expect(cookies).toEqual(expect.arrayContaining([
        expect.stringMatching(/token=.*;.*HttpOnly/),
        expect.stringMatching(/rememberToken=.*;.*HttpOnly/)
      ]))
    })
  })

  describe('Session Management', () => {
    it('should create session token in database', async () => {
      // TODO: Add session token repository mocks and verify creation
      // This would be implemented when session token repository is added
    })

    it('should handle remember me functionality', async () => {
      const { userRepository } = await import('@/repositories')
      vi.mocked(userRepository.findByPlexId).mockResolvedValue({
        id: 'user-id',
        plexId: 'plex-user-456',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        plexToken: 'token'
      })

      const response = await request(app)
        .post('/api/auth/plex/verify')
        .send({ 
          pinId: '12345',
          rememberMe: true 
        })

      expect(response.status).toBe(200)
      
      // Verify remember token has longer expiry
      const rememberTokenCookie = response.headers['set-cookie']
        ?.find((c: string) => c.startsWith('rememberToken='))
      
      expect(rememberTokenCookie).toMatch(/Max-Age=7776000/) // 90 days in seconds
    })
  })
})