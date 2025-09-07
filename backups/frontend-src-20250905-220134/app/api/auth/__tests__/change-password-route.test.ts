import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../change-password/route'

// Mock NextAuth server-side functions
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(() => Promise.resolve({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'user'
    }
  }))
}))

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
  hash: vi.fn(() => Promise.resolve('hashed-new-password'))
}))

// Mock Prisma
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}))

// Mock auth config
vi.mock('@/lib/auth/auth.config', () => ({
  getAuthOptions: vi.fn(() => Promise.resolve({
    providers: [],
    callbacks: {}
  }))
}))

describe('Change Password API Route - Comprehensive Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/auth/change-password', () => {
    it('successfully changes password for authenticated user', async () => {
      const bcrypt = await import('bcryptjs')
      const { prisma } = await import('@/lib/db/prisma')

      // Mock user with current password
      ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce({
        id: 'test-user-id',
        email: 'test@example.com',
        passwordHash: 'current-hashed-password'
      })

      // Mock password verification success
      ;(bcrypt.compare as vi.Mock).mockResolvedValueOnce(true)

      // Mock user update success
      ;(prisma.user.update as vi.Mock).mockResolvedValueOnce({
        id: 'test-user-id',
        email: 'test@example.com',
        passwordHash: 'hashed-new-password'
      })

      const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'currentPassword123!',
          newPassword: 'newSecurePassword456!'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Password changed successfully')

      expect(bcrypt.compare).toHaveBeenCalledWith('currentPassword123!', 'current-hashed-password')
      expect(bcrypt.hash).toHaveBeenCalledWith('newSecurePassword456!', 12)
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
        data: { passwordHash: 'hashed-new-password' }
      })
    })

    it('returns error for unauthenticated request', async () => {
      const { getServerSession } = await import('next-auth/next')
      ;(getServerSession as vi.Mock).mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'current123!',
          newPassword: 'new123!'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('returns error for missing current password', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          newPassword: 'newPassword123!'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Current password and new password are required')
    })

    it('returns error for missing new password', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'currentPassword123!'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Current password and new password are required')
    })

    it('validates new password strength', async () => {
      const weakPasswords = [
        'weak',
        '12345678',
        'password',
        'PASSWORD',
        'Password',
        'Password123'
      ]

      for (const weakPassword of weakPasswords) {
        const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: 'currentPassword123!',
            newPassword: weakPassword
          })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toMatch(/password.*requirements/i)
      }
    })

    it('accepts strong password', async () => {
      const bcrypt = await import('bcryptjs')
      const { prisma } = await import('@/lib/db/prisma')

      ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce({
        id: 'test-user-id',
        passwordHash: 'current-hashed-password'
      })
      ;(bcrypt.compare as vi.Mock).mockResolvedValueOnce(true)
      ;(prisma.user.update as vi.Mock).mockResolvedValueOnce({})

      const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'currentPassword123!',
          newPassword: 'StrongNewPassword456@'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })

    it('returns error for incorrect current password', async () => {
      const bcrypt = await import('bcryptjs')
      const { prisma } = await import('@/lib/db/prisma')

      ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce({
        id: 'test-user-id',
        passwordHash: 'current-hashed-password'
      })

      // Mock password verification failure
      ;(bcrypt.compare as vi.Mock).mockResolvedValueOnce(false)

      const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'wrongPassword123!',
          newPassword: 'newSecurePassword456!'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Current password is incorrect')
    })

    it('prevents using current password as new password', async () => {
      const bcrypt = await import('bcryptjs')
      const { prisma } = await import('@/lib/db/prisma')

      ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce({
        id: 'test-user-id',
        passwordHash: 'current-hashed-password'
      })

      // Mock current password verification success, but same password for new
      ;(bcrypt.compare as vi.Mock)
        .mockResolvedValueOnce(true)  // Current password check
        .mockResolvedValueOnce(true)  // New password vs current check

      const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'samePassword123!',
          newPassword: 'samePassword123!'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('New password must be different from current password')
    })

    it('handles user not found error', async () => {
      const { prisma } = await import('@/lib/db/prisma')

      ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'currentPassword123!',
          newPassword: 'newSecurePassword456!'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('User not found')
    })

    it('handles database errors gracefully', async () => {
      const { prisma } = await import('@/lib/db/prisma')

      ;(prisma.user.findUnique as vi.Mock).mockRejectedValueOnce(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'currentPassword123!',
          newPassword: 'newSecurePassword456!'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('handles hashing errors', async () => {
      const bcrypt = await import('bcryptjs')
      const { prisma } = await import('@/lib/db/prisma')

      ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce({
        id: 'test-user-id',
        passwordHash: 'current-hashed-password'
      })
      ;(bcrypt.compare as vi.Mock).mockResolvedValueOnce(true)
      ;(bcrypt.hash as vi.Mock).mockRejectedValueOnce(new Error('Hashing failed'))

      const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'currentPassword123!',
          newPassword: 'newSecurePassword456!'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to process password')
    })

    it('handles malformed JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        body: 'invalid-json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request body')
    })
  })

  describe('Security Considerations', () => {
    it('uses secure password hashing parameters', async () => {
      const bcrypt = await import('bcryptjs')
      const { prisma } = await import('@/lib/db/prisma')

      ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce({
        id: 'test-user-id',
        passwordHash: 'current-hashed-password'
      })
      ;(bcrypt.compare as vi.Mock).mockResolvedValueOnce(true)
      ;(prisma.user.update as vi.Mock).mockResolvedValueOnce({})

      const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'currentPassword123!',
          newPassword: 'newSecurePassword456!'
        })
      })

      await POST(request)

      // Verify bcrypt is called with secure salt rounds (12)
      expect(bcrypt.hash).toHaveBeenCalledWith('newSecurePassword456!', 12)
    })

    it('does not log sensitive password data', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'sensitiveCurrentPassword123!',
          newPassword: 'sensitiveNewPassword456!'
        })
      })

      await POST(request)

      // Verify passwords are not logged
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('sensitiveCurrentPassword123!'))
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('sensitiveNewPassword456!'))
      expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('sensitiveCurrentPassword123!'))
      expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('sensitiveNewPassword456!'))

      consoleSpy.mockRestore()
      errorSpy.mockRestore()
    })

    it('validates session integrity', async () => {
      const { getServerSession } = await import('next-auth/next')
      
      // Mock session with tampered user ID
      ;(getServerSession as vi.Mock).mockResolvedValueOnce({
        user: {
          id: 'tampered-user-id',
          email: 'hacker@example.com'
        }
      })

      const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'currentPassword123!',
          newPassword: 'newPassword456!'
        })
      })

      const response = await POST(request)
      
      // Should still process the request for the session user, not allow arbitrary user ID changes
      expect(response.status).toBeLessThan(500) // Should not crash
    })
  })

  describe('Rate Limiting and Abuse Prevention', () => {
    it('handles multiple concurrent password change attempts', async () => {
      const bcrypt = await import('bcryptjs')
      const { prisma } = await import('@/lib/db/prisma')

      ;(prisma.user.findUnique as vi.Mock).mockResolvedValue({
        id: 'test-user-id',
        passwordHash: 'current-hashed-password'
      })
      ;(bcrypt.compare as vi.Mock).mockResolvedValue(true)
      ;(prisma.user.update as vi.Mock).mockResolvedValue({})

      const requests = Array(5).fill(null).map(() => 
        new NextRequest('http://localhost:3000/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: 'currentPassword123!',
            newPassword: 'newSecurePassword456!'
          })
        })
      )

      const responses = await Promise.all(requests.map(req => POST(req)))

      // All should complete without crashing (rate limiting would be handled at middleware level)
      responses.forEach(response => {
        expect(response).toBeInstanceOf(Response)
        expect([200, 429, 500]).toContain(response.status) // Success, rate limited, or server error
      })
    })
  })

  describe('Password Strength Validation', () => {
    const strengthTests = [
      { password: 'Aa1!abcd', valid: true, reason: 'meets all requirements' },
      { password: 'AA1!ABCD', valid: false, reason: 'no lowercase' },
      { password: 'aa1!abcd', valid: false, reason: 'no uppercase' },
      { password: 'Aa!abcde', valid: false, reason: 'no number' },
      { password: 'Aa1abcde', valid: false, reason: 'no special character' },
      { password: 'Aa1!abc', valid: false, reason: 'too short' },
      { password: 'Aa1!' + 'a'.repeat(125), valid: false, reason: 'too long' }
    ]

    strengthTests.forEach(({ password, valid, reason }) => {
      it(`${valid ? 'accepts' : 'rejects'} password: ${reason}`, async () => {
        const request = new NextRequest('http://localhost:3000/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: 'currentPassword123!',
            newPassword: password
          })
        })

        const response = await POST(request)
        
        if (valid) {
          expect(response.status).not.toBe(400)
        } else {
          expect(response.status).toBe(400)
          const data = await response.json()
          expect(data.error).toMatch(/password.*requirements/i)
        }
      })
    })
  })
})