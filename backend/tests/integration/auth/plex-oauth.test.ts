import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { errorHandler } from '@/middleware/error'
import { correlationIdMiddleware } from '@/middleware/correlation-id'
import authRoutes from '@/routes/v1/auth'
import { server as mswServer } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import { 
  authorizePlexPin, 
  simulatePlexDown,
  resetMockHandlers 
} from '../../helpers/external-services'

// Mock repositories
vi.mock('@/repositories', () => ({
  userRepository: {
    findByPlexId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    isFirstUser: vi.fn()
  }
}))

// Mock services
vi.mock('@/services/encryption.service', () => ({
  encryptionService: {
    encrypt: vi.fn((value) => Promise.resolve(`encrypted-${value}`)),
    decrypt: vi.fn((value) => Promise.resolve(value.replace('encrypted-', '')))
  }
}))

vi.mock('@/services/jwt.service', () => ({
  jwtService: {
    generateAccessToken: vi.fn(() => 'test-jwt-token'),
    generateRememberToken: vi.fn(() => 'test-remember-token'),
    verifyToken: vi.fn()
  }
}))

// Mock config
vi.mock('@/config', () => ({
  config: {
    plex: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret'
    },
    jwt: {
      secret: 'test-secret',
      issuer: 'medianest',
      audience: 'medianest-users'
    }
  }
}))

describe('Plex OAuth PIN Flow', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use(correlationIdMiddleware)
    app.use('/api/v1/auth', authRoutes)
    app.use(errorHandler)
    
    // Reset all mocks
    vi.clearAllMocks()
    resetMockHandlers()
  })

  describe('PIN Generation', () => {
    it('should generate a PIN successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send()

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: '12345',
          code: 'ABCD',
          qrUrl: expect.stringContaining('plex.tv/link'),
          expiresIn: 900
        }
      })
    })

    it('should handle Plex API errors gracefully', async () => {
      // Simulate Plex being down
      simulatePlexDown()

      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
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
      const { jwtService } = await import('@/services/jwt.service')
      
      // Setup mocks
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
        plexToken: 'encrypted-plex-auth-token-123'
      })

      // Authorize the PIN
      authorizePlexPin('12345', 'plex-auth-token-123')

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
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
          token: 'test-jwt-token',
          rememberToken: null
        }
      })

      // Verify user creation was called
      expect(userRepository.create).toHaveBeenCalledWith({
        plexId: 'plex-user-456',
        username: 'testplexuser',
        email: 'plex@example.com',
        plexToken: 'encrypted-plex-auth-token-123',
        role: 'user',
        lastLoginAt: expect.any(Date)
      })
      
      // Verify JWT generation
      expect(jwtService.generateAccessToken).toHaveBeenCalledWith({
        userId: 'new-user-id',
        role: 'user'
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
        plexToken: 'encrypted-plex-auth-token-123',
        lastLoginAt: new Date()
      })

      // Authorize the PIN
      authorizePlexPin('12345', 'plex-auth-token-123')

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ pinId: '12345' })

      expect(response.status).toBe(200)
      expect(userRepository.update).toHaveBeenCalledWith(
        'existing-user-id',
        {
          username: 'testplexuser',
          email: 'plex@example.com',
          plexToken: 'encrypted-plex-auth-token-123',
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

      // Authorize the PIN
      authorizePlexPin('12345', 'plex-auth-token-123')

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ pinId: '12345' })

      expect(response.status).toBe(200)
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin'
        })
      )
    })

    it('should handle expired PIN', async () => {
      // Don't authorize the PIN - it will not have an auth token

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ pinId: '12345' })

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
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
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
        .post('/api/v1/auth/plex/verify')
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

      // Authorize the PIN
      authorizePlexPin('12345', 'plex-auth-token-123')

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ pinId: '12345' })

      // Check for secure cookie headers
      const cookies = response.headers['set-cookie']
      expect(cookies).toBeDefined()
      expect(cookies).toEqual(expect.arrayContaining([
        expect.stringMatching(/token=.*;.*HttpOnly/)
      ]))
    })
  })

  describe('Session Management', () => {
    it('should handle remember me functionality', async () => {
      const { userRepository } = await import('@/repositories')
      const { jwtService } = await import('@/services/jwt.service')
      
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

      // Authorize the PIN
      authorizePlexPin('12345', 'plex-auth-token-123')

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ 
          pinId: '12345',
          rememberMe: true 
        })

      expect(response.status).toBe(200)
      
      // Verify remember token generation
      expect(jwtService.generateRememberToken).toHaveBeenCalledWith({
        userId: 'user-id',
        role: 'user'
      })
      
      // Verify remember token in response
      expect(response.body.data.rememberToken).toBe('test-remember-token')
      
      // Verify remember token cookie
      const rememberTokenCookie = response.headers['set-cookie']
        ?.find((c: string) => c.startsWith('rememberToken='))
      
      expect(rememberTokenCookie).toBeDefined()
      expect(rememberTokenCookie).toMatch(/Max-Age=7776000/) // 90 days in seconds
    })
  })
})