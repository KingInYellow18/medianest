import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../plex/pin/route'

// Mock Plex provider functions
vi.mock('@/lib/auth/plex-provider', () => ({
  createPlexPin: vi.fn(() => Promise.resolve({
    id: 12345,
    code: '1234',
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    expiresIn: 600
  })),
  checkPlexPin: vi.fn(() => Promise.resolve({
    authToken: null
  })),
  getPlexHeaders: vi.fn(() => ({
    'X-Plex-Product': 'MediaNest',
    'X-Plex-Version': '1.0.0',
    'X-Plex-Client-Identifier': 'test-client'
  }))
}))

describe('Plex PIN API Route - Comprehensive Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear the active PINs map
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('POST /api/auth/plex/pin - Create PIN', () => {
    it('creates a new PIN successfully', async () => {
      const { createPlexPin, getPlexHeaders } = await import('@/lib/auth/plex-provider')
      
      const request = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('sessionId')
      expect(data).toHaveProperty('pin', '1234')
      expect(data).toHaveProperty('expiresIn', 600)
      expect(data).toHaveProperty('authUrl')
      expect(data.authUrl).toContain('app.plex.tv/auth')
      expect(data.authUrl).toContain('code=1234')

      expect(createPlexPin).toHaveBeenCalled()
      expect(getPlexHeaders).toHaveBeenCalled()
    })

    it('uses custom client identifier from header', async () => {
      const customClientId = 'custom-client-123'
      const request = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST',
        headers: {
          'X-Client-Identifier': customClientId
        }
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const { getPlexHeaders } = await import('@/lib/auth/plex-provider')
      expect(getPlexHeaders).toHaveBeenCalledWith(customClientId)
    })

    it('uses environment client identifier when available', async () => {
      const envClientId = 'env-client-456'
      process.env.PLEX_CLIENT_IDENTIFIER = envClientId

      const request = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST'
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const { getPlexHeaders } = await import('@/lib/auth/plex-provider')
      expect(getPlexHeaders).toHaveBeenCalledWith(envClientId)

      delete process.env.PLEX_CLIENT_IDENTIFIER
    })

    it('generates client identifier when none provided', async () => {
      delete process.env.PLEX_CLIENT_IDENTIFIER

      const request = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST'
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      const { getPlexHeaders } = await import('@/lib/auth/plex-provider')
      expect(getPlexHeaders).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/))
    })

    it('handles Plex API failure gracefully', async () => {
      const { createPlexPin } = await import('@/lib/auth/plex-provider')
      ;(createPlexPin as vi.Mock).mockRejectedValueOnce(new Error('Plex API error'))

      const request = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create authentication PIN')
    })

    it('generates unique session IDs for concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() => 
        new NextRequest('http://localhost:3000/api/auth/plex/pin', { method: 'POST' })
      )

      const responses = await Promise.all(requests.map(req => POST(req)))
      const sessionIds = await Promise.all(responses.map(res => res.json().then(data => data.sessionId)))

      // All session IDs should be unique
      const uniqueSessionIds = new Set(sessionIds)
      expect(uniqueSessionIds.size).toBe(5)
    })
  })

  describe('GET /api/auth/plex/pin - Check PIN Status', () => {
    it('checks PIN status for valid session', async () => {
      const { checkPlexPin } = await import('@/lib/auth/plex-provider')
      
      // First create a PIN
      const createRequest = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST'
      })
      const createResponse = await POST(createRequest)
      const { sessionId } = await createResponse.json()

      // Then check its status
      const checkRequest = new NextRequest(`http://localhost:3000/api/auth/plex/pin?sessionId=${sessionId}`)
      const checkResponse = await GET(checkRequest)
      const data = await checkResponse.json()

      expect(checkResponse.status).toBe(200)
      expect(data).toHaveProperty('authorized', false)
      expect(data).toHaveProperty('expiresIn')
      expect(data.expiresIn).toBeGreaterThan(0)

      expect(checkPlexPin).toHaveBeenCalled()
    })

    it('returns authorized status when PIN is authorized', async () => {
      const { checkPlexPin } = await import('@/lib/auth/plex-provider')
      ;(checkPlexPin as vi.Mock).mockResolvedValueOnce({
        authToken: 'plex-auth-token-123'
      })

      // Create a PIN first
      const createRequest = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST'
      })
      const createResponse = await POST(createRequest)
      const { sessionId } = await createResponse.json()

      // Check status
      const checkRequest = new NextRequest(`http://localhost:3000/api/auth/plex/pin?sessionId=${sessionId}`)
      const checkResponse = await GET(checkRequest)
      const data = await checkResponse.json()

      expect(checkResponse.status).toBe(200)
      expect(data.authorized).toBe(true)
      expect(data.authToken).toBe('plex-auth-token-123')
    })

    it('returns error for invalid session ID', async () => {
      const invalidRequest = new NextRequest('http://localhost:3000/api/auth/plex/pin?sessionId=invalid-session')
      const response = await GET(invalidRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid or expired session')
    })

    it('returns error for missing session ID', async () => {
      const noSessionRequest = new NextRequest('http://localhost:3000/api/auth/plex/pin')
      const response = await GET(noSessionRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid or expired session')
    })

    it('handles expired PIN correctly', async () => {
      // Create a PIN
      const createRequest = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST'
      })
      const createResponse = await POST(createRequest)
      const { sessionId } = await createResponse.json()

      // Fast-forward time to expire the PIN
      vi.advanceTimersByTime(700000) // 700 seconds, more than 600 second expiry

      const checkRequest = new NextRequest(`http://localhost:3000/api/auth/plex/pin?sessionId=${sessionId}`)
      const checkResponse = await GET(checkRequest)
      const data = await checkResponse.json()

      expect(checkResponse.status).toBe(400)
      expect(data.error).toBe('PIN has expired')
    })

    it('handles Plex API failure during status check', async () => {
      const { checkPlexPin } = await import('@/lib/auth/plex-provider')
      ;(checkPlexPin as vi.Mock).mockRejectedValueOnce(new Error('Plex API error'))

      // Create a PIN first
      const createRequest = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST'
      })
      const createResponse = await POST(createRequest)
      const { sessionId } = await createResponse.json()

      // Check status
      const checkRequest = new NextRequest(`http://localhost:3000/api/auth/plex/pin?sessionId=${sessionId}`)
      const checkResponse = await GET(checkRequest)
      const data = await checkResponse.json()

      expect(checkResponse.status).toBe(500)
      expect(data.error).toBe('Failed to check PIN status')
    })

    it('cleans up session after authorization', async () => {
      const { checkPlexPin } = await import('@/lib/auth/plex-provider')
      ;(checkPlexPin as vi.Mock).mockResolvedValueOnce({
        authToken: 'plex-auth-token-123'
      })

      // Create a PIN
      const createRequest = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST'
      })
      const createResponse = await POST(createRequest)
      const { sessionId } = await createResponse.json()

      // Check status (should authorize and clean up)
      const checkRequest = new NextRequest(`http://localhost:3000/api/auth/plex/pin?sessionId=${sessionId}`)
      await GET(checkRequest)

      // Try to check again - should return invalid session
      const secondCheckRequest = new NextRequest(`http://localhost:3000/api/auth/plex/pin?sessionId=${sessionId}`)
      const secondCheckResponse = await GET(secondCheckRequest)
      const data = await secondCheckResponse.json()

      expect(secondCheckResponse.status).toBe(400)
      expect(data.error).toBe('Invalid or expired session')
    })
  })

  describe('PIN Cleanup and Memory Management', () => {
    it('automatically cleans up expired PINs', async () => {
      // Create multiple PINs
      const requests = Array(3).fill(null).map(() => 
        POST(new NextRequest('http://localhost:3000/api/auth/plex/pin', { method: 'POST' }))
      )
      const responses = await Promise.all(requests)
      const sessionIds = await Promise.all(responses.map(res => res.json().then(data => data.sessionId)))

      // Fast-forward time to expire all PINs
      vi.advanceTimersByTime(700000)

      // Create a new PIN (this should trigger cleanup)
      const newPinRequest = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST'
      })
      await POST(newPinRequest)

      // All old sessions should now be invalid
      const checkPromises = sessionIds.map(sessionId => 
        GET(new NextRequest(`http://localhost:3000/api/auth/plex/pin?sessionId=${sessionId}`))
      )
      const checkResponses = await Promise.all(checkPromises)

      checkResponses.forEach(response => {
        expect(response.status).toBe(400)
      })
    })
  })

  describe('Security and Validation', () => {
    it('generates cryptographically valid UUIDs for client identifiers', async () => {
      delete process.env.PLEX_CLIENT_IDENTIFIER

      const request = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST'
      })

      const response = await POST(request)
      expect(response.status).toBe(200)

      // Verify UUID v4 format was used
      const { getPlexHeaders } = await import('@/lib/auth/plex-provider')
      const callArgs = (getPlexHeaders as vi.Mock).mock.calls[0][0]
      expect(callArgs).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })

    it('generates random session IDs', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.sessionId).toMatch(/^[a-z0-9]{20,30}$/)
    })

    it('includes proper security parameters in auth URL', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.authUrl).toContain('context[device][product]=MediaNest')
      expect(data.authUrl).toContain('clientID=')
      expect(data.authUrl).toContain('code=1234')
    })
  })

  describe('Rate Limiting and Abuse Prevention', () => {
    it('handles multiple PIN creation requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        new NextRequest('http://localhost:3000/api/auth/plex/pin', { method: 'POST' })
      )

      const responses = await Promise.all(requests.map(req => POST(req)))

      // All requests should succeed (rate limiting would be handled at middleware level)
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })

  describe('Integration with Plex API', () => {
    it('calls Plex API with correct parameters', async () => {
      const { createPlexPin, getPlexHeaders } = await import('@/lib/auth/plex-provider')
      const clientId = 'test-client-id'

      const request = new NextRequest('http://localhost:3000/api/auth/plex/pin', {
        method: 'POST',
        headers: {
          'X-Client-Identifier': clientId
        }
      })

      await POST(request)

      expect(getPlexHeaders).toHaveBeenCalledWith(clientId)
      expect(createPlexPin).toHaveBeenCalledWith(
        clientId,
        expect.objectContaining({
          'X-Plex-Product': 'MediaNest',
          'X-Plex-Version': '1.0.0',
          'X-Plex-Client-Identifier': 'test-client'
        })
      )
    })
  })
})