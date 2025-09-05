import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../plex/callback/route'

// Mock auth config and NextAuth functions
vi.mock('@/lib/auth/auth.config', () => ({
  getAuthOptions: vi.fn(() => Promise.resolve({
    providers: [],
    callbacks: {
      jwt: vi.fn(),
      session: vi.fn()
    }
  }))
}))

// Mock Plex provider
vi.mock('@/lib/auth/plex-provider', () => ({
  getPlexUser: vi.fn(() => Promise.resolve({
    id: 123456,
    uuid: 'test-uuid',
    username: 'testuser',
    title: 'Test User',
    email: 'test@example.com'
  })),
  getPlexHeaders: vi.fn(() => ({
    'X-Plex-Token': 'test-token'
  }))
}))

// Mock Prisma
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }
}))

describe('Plex Callback API Route - Comprehensive Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/auth/plex/callback', () => {
    it('handles successful Plex callback with new user', async () => {
      const { getPlexUser } = await import('@/lib/auth/plex-provider')
      const { prisma } = await import('@/lib/db/prisma')

      // Mock user not found, then created
      ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce(null)
      ;(prisma.user.create as vi.Mock).mockResolvedValueOnce({
        id: 'new-user-id',
        email: 'test@example.com',
        username: 'testuser',
        plexId: 123456,
        role: 'user'
      })

      const request = new NextRequest('http://localhost:3000/api/auth/plex/callback', {
        method: 'POST',
        body: JSON.stringify({
          authToken: 'plex-auth-token-123'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user).toMatchObject({
        id: 'new-user-id',
        email: 'test@example.com',
        username: 'testuser'
      })

      expect(getPlexUser).toHaveBeenCalledWith('plex-auth-token-123')
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          username: 'testuser',
          plexId: 123456,
          plexToken: 'plex-auth-token-123',
          role: 'user'
        }
      })
    })

    it('handles successful callback with existing user', async () => {
      const { getPlexUser } = await import('@/lib/auth/plex-provider')
      const { prisma } = await import('@/lib/db/prisma')

      // Mock existing user found and updated
      ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce({
        id: 'existing-user-id',
        email: 'test@example.com',
        username: 'testuser',
        plexId: 123456,
        role: 'user'
      })
      ;(prisma.user.update as vi.Mock).mockResolvedValueOnce({
        id: 'existing-user-id',
        email: 'test@example.com',
        username: 'testuser',
        plexId: 123456,
        role: 'user'
      })

      const request = new NextRequest('http://localhost:3000/api/auth/plex/callback', {
        method: 'POST',
        body: JSON.stringify({
          authToken: 'plex-auth-token-123'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user.id).toBe('existing-user-id')

      expect(getPlexUser).toHaveBeenCalledWith('plex-auth-token-123')
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { plexId: 123456 },
        data: { plexToken: 'plex-auth-token-123' }
      })
    })

    it('returns error for missing auth token', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/plex/callback', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Auth token is required')
    })

    it('returns error for invalid auth token', async () => {
      const { getPlexUser } = await import('@/lib/auth/plex-provider')
      ;(getPlexUser as vi.Mock).mockRejectedValueOnce(new Error('Invalid token'))

      const request = new NextRequest('http://localhost:3000/api/auth/plex/callback', {
        method: 'POST',
        body: JSON.stringify({
          authToken: 'invalid-token'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid Plex authentication token')
    })

    it('handles database errors gracefully', async () => {
      const { getPlexUser } = await import('@/lib/auth/plex-provider')
      const { prisma } = await import('@/lib/db/prisma')

      ;(prisma.user.findUnique as vi.Mock).mockRejectedValueOnce(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/auth/plex/callback', {
        method: 'POST',
        body: JSON.stringify({
          authToken: 'plex-auth-token-123'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Database error occurred')
    })

    it('handles malformed request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/plex/callback', {
        method: 'POST',
        body: 'invalid-json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request body')
    })

    it('handles Plex user without email', async () => {
      const { getPlexUser } = await import('@/lib/auth/plex-provider')
      const { prisma } = await import('@/lib/db/prisma')

      // Mock Plex user without email
      ;(getPlexUser as vi.Mock).mockResolvedValueOnce({
        id: 123456,
        uuid: 'test-uuid',
        username: 'testuser',
        title: 'Test User',
        email: null
      })

      ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce(null)
      ;(prisma.user.create as vi.Mock).mockResolvedValueOnce({
        id: 'new-user-id',
        email: 'testuser@plex.local',
        username: 'testuser',
        plexId: 123456,
        role: 'user'
      })

      const request = new NextRequest('http://localhost:3000/api/auth/plex/callback', {
        method: 'POST',
        body: JSON.stringify({
          authToken: 'plex-auth-token-123'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user.email).toBe('testuser@plex.local')
    })
  })

  describe('Security and Validation', () => {
    it('validates auth token format', async () => {
      const shortTokenRequest = new NextRequest('http://localhost:3000/api/auth/plex/callback', {
        method: 'POST',
        body: JSON.stringify({
          authToken: 'short'
        })
      })

      const response = await POST(shortTokenRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('token')
    })

    it('does not log sensitive information', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const request = new NextRequest('http://localhost:3000/api/auth/plex/callback', {
        method: 'POST',
        body: JSON.stringify({
          authToken: 'sensitive-auth-token-123'
        })
      })

      await POST(request)

      // Verify sensitive data is not logged
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('sensitive-auth-token-123'))
      expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('sensitive-auth-token-123'))

      consoleSpy.mockRestore()
      errorSpy.mockRestore()
    })

    it('sanitizes user data before database storage', async () => {
      const { getPlexUser } = await import('@/lib/auth/plex-provider')
      const { prisma } = await import('@/lib/db/prisma')

      // Mock Plex user with potentially malicious data
      ;(getPlexUser as vi.Mock).mockResolvedValueOnce({
        id: 123456,
        uuid: 'test-uuid',
        username: '<script>alert("xss")</script>',
        title: 'Test User',
        email: 'test@example.com'
      })

      ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce(null)
      ;(prisma.user.create as vi.Mock).mockResolvedValueOnce({
        id: 'new-user-id',
        email: 'test@example.com',
        username: '&lt;script&gt;alert("xss")&lt;/script&gt;',
        plexId: 123456,
        role: 'user'
      })

      const request = new NextRequest('http://localhost:3000/api/auth/plex/callback', {
        method: 'POST',
        body: JSON.stringify({
          authToken: 'plex-auth-token-123'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      // Verify the create was called with sanitized data
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: expect.not.stringContaining('<script>')
        })
      })
    })
  })

  describe('Edge Cases and Error Recovery', () => {
    it('handles concurrent callback requests for same user', async () => {
      const { getPlexUser } = await import('@/lib/auth/plex-provider')
      const { prisma } = await import('@/lib/db/prisma')

      ;(prisma.user.findUnique as vi.Mock).mockResolvedValue(null)
      ;(prisma.user.create as vi.Mock)
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          plexId: 123456,
          role: 'user'
        })
        .mockRejectedValueOnce(new Error('Unique constraint violation'))

      const requests = [
        new NextRequest('http://localhost:3000/api/auth/plex/callback', {
          method: 'POST',
          body: JSON.stringify({ authToken: 'token-1' })
        }),
        new NextRequest('http://localhost:3000/api/auth/plex/callback', {
          method: 'POST',
          body: JSON.stringify({ authToken: 'token-2' })
        })
      ]

      const responses = await Promise.all(requests.map(req => POST(req)))

      // First should succeed, second should handle the conflict
      expect(responses[0].status).toBe(200)
      expect(responses[1].status).toBe(500) // Or handle as appropriate
    })

    it('handles Plex API rate limiting', async () => {
      const { getPlexUser } = await import('@/lib/auth/plex-provider')
      ;(getPlexUser as vi.Mock).mockRejectedValueOnce(new Error('Rate limit exceeded'))

      const request = new NextRequest('http://localhost:3000/api/auth/plex/callback', {
        method: 'POST',
        body: JSON.stringify({
          authToken: 'plex-auth-token-123'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toContain('rate limit')
    })
  })

  describe('Integration and Data Flow', () => {
    it('maintains data consistency between Plex and database', async () => {
      const { getPlexUser } = await import('@/lib/auth/plex-provider')
      const { prisma } = await import('@/lib/db/prisma')

      const plexUserData = {
        id: 123456,
        uuid: 'test-uuid',
        username: 'testuser',
        title: 'Test User',
        email: 'test@example.com'
      }

      ;(getPlexUser as vi.Mock).mockResolvedValueOnce(plexUserData)
      ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce(null)
      ;(prisma.user.create as vi.Mock).mockResolvedValueOnce({
        id: 'new-user-id',
        email: plexUserData.email,
        username: plexUserData.username,
        plexId: plexUserData.id,
        plexToken: 'plex-auth-token-123',
        role: 'user'
      })

      const request = new NextRequest('http://localhost:3000/api/auth/plex/callback', {
        method: 'POST',
        body: JSON.stringify({
          authToken: 'plex-auth-token-123'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.user.email).toBe(plexUserData.email)
      expect(data.user.username).toBe(plexUserData.username)
      expect(data.user.plexId).toBe(plexUserData.id)
    })
  })
})