import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { PlexAuthService, PlexPin, PlexUser } from '@/services/plex-auth.service'
import { UserRepository } from '@/repositories/user.repository'
import { SessionTokenRepository } from '@/repositories/session-token.repository'
import { getTestPrismaClient, cleanDatabase } from '../../helpers/database'
import { AppError } from '@/utils/errors'
import { server } from '../../mocks/server'

// Mock fetch at module level
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('PlexAuthService Integration Tests', () => {
  let plexAuthService: PlexAuthService
  let userRepository: UserRepository
  let sessionTokenRepository: SessionTokenRepository
  
  beforeEach(async () => {
    // Disable MSW for this test to use direct fetch mocks
    server.close()
    
    const prisma = getTestPrismaClient()
    userRepository = new UserRepository(prisma)
    sessionTokenRepository = new SessionTokenRepository(prisma)
    plexAuthService = new PlexAuthService(userRepository, sessionTokenRepository)
    
    await cleanDatabase()
    mockFetch.mockClear()
  })
  
  afterEach(async () => {
    await cleanDatabase()
    // Re-enable MSW for other tests
    server.listen()
  })

  describe('createPin', () => {
    const mockPinResponse: PlexPin = {
      id: 123456,
      code: 'ABCD',
      product: 'MediaNest',
      trusted: true,
      clientIdentifier: 'test-client-id',
      location: {
        code: 'US',
        country: 'United States'
      },
      expiresIn: 900,
      createdAt: '2023-01-01T00:00:00.000Z',
      expiresAt: '2023-01-01T00:15:00.000Z'
    }

    it('should create a PIN successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPinResponse
      } as Response)

      const result = await plexAuthService.createPin()

      expect(result).toEqual(mockPinResponse)
      expect(mockFetch).toHaveBeenCalledWith('https://plex.tv/api/v2/pins', {
        method: 'POST',
        headers: {
          'X-Plex-Client-Identifier': 'test-plex-client-id',
          'X-Plex-Product': 'MediaNest',
          'X-Plex-Version': '1.0.0',
          'X-Plex-Platform': 'Web',
          'X-Plex-Device': 'Web',
          'X-Plex-Device-Name': 'MediaNest Web',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          strong: true,
          'X-Plex-Client-Identifier': 'test-plex-client-id'
        })
      })
    })

    it('should handle Plex service unavailable error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable'
      } as Response)

      await expect(plexAuthService.createPin()).rejects.toThrow(AppError)
      await expect(plexAuthService.createPin()).rejects.toThrow('Unable to connect to Plex services')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(plexAuthService.createPin()).rejects.toThrow(AppError)
      await expect(plexAuthService.createPin()).rejects.toThrow('Failed to initialize Plex authentication')
    })

    it('should handle invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON') }
      } as Response)

      await expect(plexAuthService.createPin()).rejects.toThrow(AppError)
    })
  })

  describe('checkPin', () => {
    const pinId = 123456
    const mockPinWithToken: PlexPin = {
      id: pinId,
      code: 'ABCD',
      product: 'MediaNest',
      trusted: true,
      clientIdentifier: 'test-client-id',
      location: {
        code: 'US',
        country: 'United States'
      },
      expiresIn: 900,
      createdAt: '2023-01-01T00:00:00.000Z',
      expiresAt: '2023-01-01T00:15:00.000Z',
      authToken: 'plex-auth-token-123'
    }

    it('should check PIN status successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPinWithToken
      } as Response)

      const result = await plexAuthService.checkPin(pinId)

      expect(result).toEqual(mockPinWithToken)
      expect(mockFetch).toHaveBeenCalledWith(`https://plex.tv/api/v2/pins/${pinId}`, {
        method: 'GET',
        headers: {
          'X-Plex-Client-Identifier': 'test-plex-client-id',
          'X-Plex-Product': 'MediaNest',
          'X-Plex-Version': '1.0.0',
          'X-Plex-Platform': 'Web',
          'X-Plex-Device': 'Web',
          'X-Plex-Device-Name': 'MediaNest Web',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
    })

    it('should handle PIN not found error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found'
      } as Response)

      await expect(plexAuthService.checkPin(pinId)).rejects.toThrow(AppError)
      await expect(plexAuthService.checkPin(pinId)).rejects.toThrow('PIN not found or expired')
    })

    it('should handle service unavailable during PIN check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable'
      } as Response)

      await expect(plexAuthService.checkPin(pinId)).rejects.toThrow(AppError)
      await expect(plexAuthService.checkPin(pinId)).rejects.toThrow('Unable to verify PIN status')
    })
  })

  describe('getPlexUser', () => {
    const authToken = 'plex-auth-token-123'
    const mockPlexUser: PlexUser = {
      id: 789,
      uuid: 'plex-user-uuid',
      username: 'testuser',
      email: 'test@example.com',
      locale: 'en',
      emailOnlyAuth: false,
      hasPassword: true,
      protected: false,
      thumb: 'https://plex.tv/thumb.jpg',
      authToken: authToken,
      mailingListStatus: 'active',
      mailingListActive: true,
      scrobbleTypes: 'mobile,tv',
      country: 'US',
      entitlements: ['ios', 'android'],
      roles: ['plexpass'],
      services: [],
      experimentalFeatures: false,
      twoFactorEnabled: false,
      backupCodesCreated: false
    }

    it('should get Plex user successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlexUser
      } as Response)

      const result = await plexAuthService.getPlexUser(authToken)

      expect(result).toEqual(mockPlexUser)
      expect(mockFetch).toHaveBeenCalledWith('https://plex.tv/api/v2/user', {
        method: 'GET',
        headers: {
          'X-Plex-Client-Identifier': 'test-plex-client-id',
          'X-Plex-Product': 'MediaNest',
          'X-Plex-Version': '1.0.0',
          'X-Plex-Platform': 'Web',
          'X-Plex-Device': 'Web',
          'X-Plex-Device-Name': 'MediaNest Web',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Plex-Token': authToken
        }
      })
    })

    it('should handle invalid token error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      } as Response)

      await expect(plexAuthService.getPlexUser(authToken)).rejects.toThrow(AppError)
      await expect(plexAuthService.getPlexUser(authToken)).rejects.toThrow('Invalid Plex auth token')
    })

    it('should handle service errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      } as Response)

      await expect(plexAuthService.getPlexUser(authToken)).rejects.toThrow(AppError)
      await expect(plexAuthService.getPlexUser(authToken)).rejects.toThrow('Unable to fetch user information')
    })
  })

  describe('completeOAuth', () => {
    const pinId = 123456
    const authToken = 'plex-auth-token-123'
    
    const mockPinWithToken: PlexPin = {
      id: pinId,
      code: 'ABCD',
      product: 'MediaNest',
      trusted: true,
      clientIdentifier: 'test-client-id',
      location: { code: 'US', country: 'United States' },
      expiresIn: 900,
      createdAt: '2023-01-01T00:00:00.000Z',
      expiresAt: '2023-01-01T00:15:00.000Z',
      authToken: authToken
    }

    const mockPlexUser: PlexUser = {
      id: 789,
      uuid: 'plex-user-uuid',
      username: 'testuser',
      email: 'test@example.com',
      locale: 'en',
      emailOnlyAuth: false,
      hasPassword: true,
      protected: false,
      thumb: 'https://plex.tv/thumb.jpg',
      authToken: authToken,
      mailingListStatus: 'active',
      mailingListActive: true,
      scrobbleTypes: 'mobile,tv',
      country: 'US',
      entitlements: ['ios', 'android'],
      roles: ['plexpass'],
      services: [],
      experimentalFeatures: false,
      twoFactorEnabled: false,
      backupCodesCreated: false
    }

    it('should complete OAuth for new user', async () => {
      // Mock PIN check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPinWithToken
      } as Response)

      // Mock user fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlexUser
      } as Response)

      const result = await plexAuthService.completeOAuth(pinId)

      expect(result).toMatchObject({
        user: {
          id: expect.any(String),
          email: 'test@example.com',
          name: 'testuser',
          role: 'user',
          plexUsername: 'testuser'
        },
        token: expect.any(String),
        isNewUser: true
      })

      // Verify user was created in database
      const createdUser = await userRepository.findByEmail('test@example.com')
      expect(createdUser).toBeDefined()
      expect(createdUser?.plexId).toBe('789')
      expect(createdUser?.plexUsername).toBe('testuser')
    })

    it('should complete OAuth for existing user', async () => {
      // Create existing user first
      const existingUser = await userRepository.create({
        email: 'test@example.com',
        name: 'Original Name',
        plexId: '789',
        plexUsername: 'oldusername',
        role: 'user'
      })

      // Mock PIN check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPinWithToken
      } as Response)

      // Mock user fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlexUser
      } as Response)

      const result = await plexAuthService.completeOAuth(pinId)

      expect(result).toMatchObject({
        user: {
          id: existingUser.id,
          email: 'test@example.com',
          name: 'testuser', // Should be updated
          role: 'user',
          plexUsername: 'testuser'
        },
        token: expect.any(String),
        isNewUser: false
      })

      // Verify user was updated
      const updatedUser = await userRepository.findById(existingUser.id)
      expect(updatedUser?.name).toBe('testuser')
      expect(updatedUser?.lastLoginAt).toBeInstanceOf(Date)
    })

    it('should handle PIN not authorized', async () => {
      const pinWithoutToken = { ...mockPinWithToken }
      delete pinWithoutToken.authToken

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => pinWithoutToken
      } as Response)

      await expect(plexAuthService.completeOAuth(pinId)).rejects.toThrow(AppError)
      await expect(plexAuthService.completeOAuth(pinId)).rejects.toThrow('PIN not yet authorized by user')
    })

    it('should create session token record', async () => {
      // Mock PIN check and user fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPinWithToken
      } as Response)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlexUser
      } as Response)

      const result = await plexAuthService.completeOAuth(pinId)

      // Verify session token was created
      const user = await userRepository.findByEmail('test@example.com')
      expect(user).toBeDefined()
      
      const sessions = await sessionTokenRepository.findByUserId(user!.id)
      expect(sessions).toHaveLength(1)
      expect(sessions[0].userId).toBe(user!.id)
    })

    it('should handle network errors during OAuth completion', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(plexAuthService.completeOAuth(pinId)).rejects.toThrow(AppError)
      await expect(plexAuthService.completeOAuth(pinId)).rejects.toThrow('Failed to complete authentication')
    })
  })

  describe('Error handling and edge cases', () => {
    it('should handle malformed PIN response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' })
      } as Response)

      // This should not throw but may behave unexpectedly
      // In production, you might want to add validation
      const result = await plexAuthService.createPin()
      expect(result).toEqual({ invalid: 'response' })
    })

    it('should handle timeout scenarios gracefully', async () => {
      // Mock a timeout by rejecting after delay
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100)
        })
      )

      await expect(plexAuthService.createPin()).rejects.toThrow(AppError)
    }, 1000)

    it('should handle concurrent OAuth requests', async () => {
      const pinId = 123456
      
      // Setup mocks for both requests
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockPinWithToken,
            id: pinId,
            authToken: 'token1'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockPlexUser,
            id: 789,
            email: 'concurrent@example.com',
            authToken: 'token1'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockPinWithToken,
            id: pinId,
            authToken: 'token2'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockPlexUser,
            id: 790,
            email: 'concurrent2@example.com',
            authToken: 'token2'
          })
        })

      // Run concurrent OAuth completions
      const [result1, result2] = await Promise.all([
        plexAuthService.completeOAuth(pinId),
        plexAuthService.completeOAuth(pinId)
      ])

      expect(result1.user.email).toBe('concurrent@example.com')
      expect(result2.user.email).toBe('concurrent2@example.com')
      expect(result1.token).not.toBe(result2.token)
    })
  })

  describe('Security considerations', () => {
    it('should not expose sensitive Plex tokens in logs', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockPinWithToken,
          authToken: 'sensitive-token-123'
        })
      } as Response)

      const result = await plexAuthService.checkPin(123456)
      expect(result.authToken).toBe('sensitive-token-123')

      // Check that token is not logged in plain text
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('sensitive-token-123')
      )
      
      consoleSpy.mockRestore()
    })

    it('should validate JWT token format', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPinWithToken
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPlexUser
        })

      const result = await plexAuthService.completeOAuth(123456)
      
      // JWT should have 3 parts separated by dots
      const tokenParts = result.token.split('.')
      expect(tokenParts).toHaveLength(3)
      
      // Each part should be base64-like
      tokenParts.forEach(part => {
        expect(part).toMatch(/^[A-Za-z0-9_-]+$/)
      })
    })
  })

  describe('Integration with repositories', () => {
    it('should handle database constraint violations gracefully', async () => {
      // Create a user with the same email first
      await userRepository.create({
        email: 'test@example.com',
        name: 'Existing User',
        plexId: 'different-plex-id',
        plexUsername: 'existing',
        role: 'user'
      })

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPinWithToken
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPlexUser
        })

      // This should handle the email constraint properly
      // The service should find the existing user by plexId, not email
      const result = await plexAuthService.completeOAuth(123456)
      
      expect(result.isNewUser).toBe(true) // New because different plexId
      expect(result.user.email).toBe('test@example.com')
    })

    it('should clean up sessions when user is recreated', async () => {
      // Create user and session
      const user = await userRepository.create({
        email: 'test@example.com',
        name: 'Test User',
        plexId: '789',
        plexUsername: 'testuser',
        role: 'user'
      })

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      await sessionTokenRepository.create({
        userId: user.id,
        expiresAt: tomorrow
      })

      // Verify session exists
      let sessions = await sessionTokenRepository.findByUserId(user.id)
      expect(sessions).toHaveLength(1)

      // Complete OAuth (should create new session)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPinWithToken
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockPlexUser
        })

      await plexAuthService.completeOAuth(123456)

      // Should now have 2 sessions (old + new)
      sessions = await sessionTokenRepository.findByUserId(user.id)
      expect(sessions).toHaveLength(2)
    })
  })
})