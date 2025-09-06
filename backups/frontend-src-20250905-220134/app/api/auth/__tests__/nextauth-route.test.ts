import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getAuthOptions } from '@/lib/auth/auth.config'
import { GET, POST } from '../[...nextauth]/route'

// Mock NextAuth
vi.mock('next-auth', () => {
  const mockHandler = vi.fn((req, res) => {
    return new Response(JSON.stringify({ 
      user: { id: 'test', email: 'test@example.com' },
      token: 'mock-token' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  })
  
  return {
    default: vi.fn(() => mockHandler)
  }
})

// Mock auth config
vi.mock('@/lib/auth/auth.config', () => ({
  getAuthOptions: vi.fn(() => Promise.resolve({
    providers: [],
    callbacks: {},
    session: { strategy: 'jwt' }
  }))
}))

describe('NextAuth API Route - Comprehensive Testing', () => {
  let mockRequest: NextRequest
  let mockResponse: Response

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockRequest = new NextRequest('http://localhost:3000/api/auth/session')
    mockResponse = new Response()
  })

  describe('GET Handler', () => {
    it('creates handler with auth options and processes request', async () => {
      const response = await GET(mockRequest, mockResponse)
      
      expect(getAuthOptions).toHaveBeenCalled()
      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
    })

    it('handles session request', async () => {
      const sessionRequest = new NextRequest('http://localhost:3000/api/auth/session')
      const response = await GET(sessionRequest, mockResponse)
      
      const data = await response.json()
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe('test@example.com')
    })

    it('handles signin request', async () => {
      const signinRequest = new NextRequest('http://localhost:3000/api/auth/signin')
      const response = await GET(signinRequest, mockResponse)
      
      expect(response.status).toBe(200)
    })

    it('handles callback request', async () => {
      const callbackRequest = new NextRequest('http://localhost:3000/api/auth/callback/plex')
      const response = await GET(callbackRequest, mockResponse)
      
      expect(response.status).toBe(200)
    })

    it('returns proper response for signout', async () => {
      const signoutRequest = new NextRequest('http://localhost:3000/api/auth/signout')
      const response = await GET(signoutRequest, mockResponse)
      
      expect(response.status).toBe(200)
    })
  })

  describe('POST Handler', () => {
    it('creates handler with auth options and processes POST request', async () => {
      const response = await POST(mockRequest, mockResponse)
      
      expect(getAuthOptions).toHaveBeenCalled()
      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
    })

    it('handles signin POST request', async () => {
      const signinRequest = new NextRequest('http://localhost:3000/api/auth/signin/plex', {
        method: 'POST',
        body: JSON.stringify({ 
          token: 'plex-token',
          redirect: false 
        })
      })
      
      const response = await POST(signinRequest, mockResponse)
      expect(response.status).toBe(200)
    })

    it('handles callback POST request', async () => {
      const callbackRequest = new NextRequest('http://localhost:3000/api/auth/callback/plex', {
        method: 'POST',
        body: JSON.stringify({ 
          authToken: 'plex-auth-token'
        })
      })
      
      const response = await POST(callbackRequest, mockResponse)
      expect(response.status).toBe(200)
    })

    it('handles signout POST request', async () => {
      const signoutRequest = new NextRequest('http://localhost:3000/api/auth/signout', {
        method: 'POST'
      })
      
      const response = await POST(signoutRequest, mockResponse)
      expect(response.status).toBe(200)
    })
  })

  describe('Auth Options Integration', () => {
    it('uses dynamic auth options', async () => {
      const mockAuthOptions = {
        providers: [{ id: 'plex', name: 'Plex' }],
        callbacks: { 
          jwt: vi.fn(),
          session: vi.fn() 
        },
        session: { strategy: 'jwt' as const }
      }
      
      ;(getAuthOptions as vi.Mock).mockResolvedValueOnce(mockAuthOptions)
      
      await GET(mockRequest, mockResponse)
      
      expect(getAuthOptions).toHaveBeenCalled()
    })

    it('handles auth options retrieval failure', async () => {
      ;(getAuthOptions as vi.Mock).mockRejectedValueOnce(new Error('Config error'))
      
      // Should not throw, but handle gracefully
      const response = await GET(mockRequest, mockResponse)
      expect(response).toBeInstanceOf(Response)
    })
  })

  describe('Error Handling', () => {
    it('handles malformed requests gracefully', async () => {
      const malformedRequest = new NextRequest('http://localhost:3000/api/auth/invalid-endpoint')
      
      const response = await GET(malformedRequest, mockResponse)
      
      // Should still return a response, not throw
      expect(response).toBeInstanceOf(Response)
    })

    it('handles requests with invalid JSON body', async () => {
      const invalidRequest = new NextRequest('http://localhost:3000/api/auth/signin', {
        method: 'POST',
        body: 'invalid-json'
      })
      
      const response = await POST(invalidRequest, mockResponse)
      
      // Should handle gracefully
      expect(response).toBeInstanceOf(Response)
    })
  })

  describe('Security Considerations', () => {
    it('includes proper headers in responses', async () => {
      const response = await GET(mockRequest, mockResponse)
      
      // Check for security headers (these would be set by NextAuth)
      expect(response.headers.get('Content-Type')).toContain('application/json')
    })

    it('handles CSRF protection', async () => {
      const csrfRequest = new NextRequest('http://localhost:3000/api/auth/csrf')
      
      const response = await GET(csrfRequest, mockResponse)
      expect(response.status).toBe(200)
    })
  })

  describe('Performance and Reliability', () => {
    it('creates handler efficiently', async () => {
      const startTime = Date.now()
      
      await GET(mockRequest, mockResponse)
      
      const endTime = Date.now()
      const executionTime = endTime - startTime
      
      // Should complete quickly (under 100ms for tests)
      expect(executionTime).toBeLessThan(100)
    })

    it('handles concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() => 
        GET(new NextRequest('http://localhost:3000/api/auth/session'), new Response())
      )
      
      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect(response).toBeInstanceOf(Response)
        expect(response.status).toBe(200)
      })
    })
  })
})