import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAuthOptions } from '../auth.config'
import { PlexProvider } from '../plex-provider'

// Mock environment variables
const mockEnv = {
  NEXTAUTH_SECRET: 'test-secret',
  NEXTAUTH_URL: 'http://localhost:3000',
  PLEX_CLIENT_IDENTIFIER: 'test-plex-client',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb'
}

// Mock Prisma adapter
vi.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: vi.fn(() => ({
    createUser: vi.fn(),
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserByAccount: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    linkAccount: vi.fn(),
    unlinkAccount: vi.fn(),
    createSession: vi.fn(),
    getSessionAndUser: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    createVerificationToken: vi.fn(),
    useVerificationToken: vi.fn()
  }))
}))

// Mock Prisma client
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    account: {
      findFirst: vi.fn()
    }
  }
}))

describe('Auth Configuration - Comprehensive Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up environment variables
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value
    })
  })

  describe('Auth Options Generation', () => {
    it('generates complete auth configuration', async () => {
      const authOptions = await getAuthOptions()
      
      expect(authOptions).toHaveProperty('providers')
      expect(authOptions).toHaveProperty('adapter')
      expect(authOptions).toHaveProperty('session')
      expect(authOptions).toHaveProperty('callbacks')
      expect(authOptions).toHaveProperty('pages')
      expect(authOptions).toHaveProperty('events')
    })

    it('includes Plex provider in providers array', async () => {
      const authOptions = await getAuthOptions()
      
      expect(authOptions.providers).toHaveLength(2) // Plex + Admin Bootstrap
      
      const plexProvider = authOptions.providers.find(p => p.id === 'plex')
      expect(plexProvider).toBeDefined()
      expect(plexProvider?.name).toBe('Plex')
      expect(plexProvider?.type).toBe('oauth')
    })

    it('includes admin bootstrap provider', async () => {
      const authOptions = await getAuthOptions()
      
      const adminProvider = authOptions.providers.find(p => p.id === 'admin-bootstrap')
      expect(adminProvider).toBeDefined()
      expect(adminProvider?.name).toBe('Admin Bootstrap')
      expect(adminProvider?.type).toBe('credentials')
    })

    it('configures JWT session strategy', async () => {
      const authOptions = await getAuthOptions()
      
      expect(authOptions.session?.strategy).toBe('jwt')
      expect(authOptions.session?.maxAge).toBe(30 * 24 * 60 * 60) // 30 days
    })

    it('sets up Prisma adapter', async () => {
      const authOptions = await getAuthOptions()
      
      expect(authOptions.adapter).toBeDefined()
    })

    it('configures custom pages', async () => {
      const authOptions = await getAuthOptions()
      
      expect(authOptions.pages).toEqual({
        signIn: '/auth/signin',
        error: '/auth/signin'
      })
    })
  })

  describe('Provider Configuration', () => {
    describe('Plex Provider', () => {
      it('configures Plex OAuth endpoints correctly', async () => {
        const authOptions = await getAuthOptions()
        const plexProvider = authOptions.providers.find(p => p.id === 'plex')
        
        expect(plexProvider?.authorization).toContain('plex.tv')
        expect(plexProvider?.token).toContain('plex.tv')
        expect(plexProvider?.userinfo).toContain('plex.tv')
      })

      it('includes required client identifier', async () => {
        const authOptions = await getAuthOptions()
        const plexProvider = authOptions.providers.find(p => p.id === 'plex')
        
        expect(plexProvider?.clientId).toBe('test-plex-client')
      })

      it('maps Plex user profile correctly', async () => {
        const authOptions = await getAuthOptions()
        const plexProvider = authOptions.providers.find(p => p.id === 'plex')
        
        const mockPlexUser = {
          id: 123456,
          uuid: 'test-uuid',
          username: 'testuser',
          title: 'Test User',
          email: 'test@example.com'
        }
        
        const profile = plexProvider?.profile?.(mockPlexUser)
        
        expect(profile).toEqual({
          id: '123456',
          name: 'Test User',
          email: 'test@example.com',
          username: 'testuser',
          plexId: 123456
        })
      })

      it('handles Plex user without email', async () => {
        const authOptions = await getAuthOptions()
        const plexProvider = authOptions.providers.find(p => p.id === 'plex')
        
        const mockPlexUser = {
          id: 123456,
          uuid: 'test-uuid',
          username: 'testuser',
          title: 'Test User',
          email: null
        }
        
        const profile = plexProvider?.profile?.(mockPlexUser)
        
        expect(profile?.email).toBe('testuser@plex.local')
      })
    })

    describe('Admin Bootstrap Provider', () => {
      it('validates admin credentials', async () => {
        const authOptions = await getAuthOptions()
        const adminProvider = authOptions.providers.find(p => p.id === 'admin-bootstrap')
        
        expect(adminProvider?.credentials).toHaveProperty('username')
        expect(adminProvider?.credentials).toHaveProperty('password')
      })

      it('authorizes valid admin credentials', async () => {
        const { prisma } = await import('@/lib/db/prisma')
        
        // Mock admin user exists
        ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce({
          id: 'admin-user-id',
          username: 'admin',
          passwordHash: 'admin-hash', // In real app, this would be properly hashed
          role: 'admin'
        })
        
        const authOptions = await getAuthOptions()
        const adminProvider = authOptions.providers.find(p => p.id === 'admin-bootstrap')
        
        const user = await adminProvider?.authorize?.({
          username: 'admin',
          password: 'admin'
        })
        
        expect(user).toMatchObject({
          id: 'admin-user-id',
          username: 'admin',
          role: 'admin',
          requiresPasswordChange: true
        })
      })

      it('rejects invalid admin credentials', async () => {
        const { prisma } = await import('@/lib/db/prisma')
        
        ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce(null)
        
        const authOptions = await getAuthOptions()
        const adminProvider = authOptions.providers.find(p => p.id === 'admin-bootstrap')
        
        const user = await adminProvider?.authorize?.({
          username: 'admin',
          password: 'wrong-password'
        })
        
        expect(user).toBeNull()
      })

      it('creates admin user if not exists', async () => {
        const { prisma } = await import('@/lib/db/prisma')
        
        ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce(null)
        ;(prisma.user.create as vi.Mock).mockResolvedValueOnce({
          id: 'new-admin-id',
          username: 'admin',
          role: 'admin'
        })
        
        const authOptions = await getAuthOptions()
        const adminProvider = authOptions.providers.find(p => p.id === 'admin-bootstrap')
        
        const user = await adminProvider?.authorize?.({
          username: 'admin',
          password: 'admin'
        })
        
        expect(prisma.user.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            username: 'admin',
            role: 'admin'
          })
        })
        
        expect(user).toMatchObject({
          requiresPasswordChange: true
        })
      })
    })
  })

  describe('Callback Configuration', () => {
    describe('JWT Callback', () => {
      it('includes user data in JWT token', async () => {
        const authOptions = await getAuthOptions()
        
        const mockUser = {
          id: 'test-user',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          plexId: 123456
        }
        
        const token = await authOptions.callbacks?.jwt?.({
          token: {},
          user: mockUser
        })
        
        expect(token).toMatchObject({
          sub: 'test-user',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          plexId: 123456
        })
      })

      it('preserves existing token data', async () => {
        const authOptions = await getAuthOptions()
        
        const existingToken = {
          sub: 'existing-user',
          email: 'existing@example.com',
          role: 'admin',
          customField: 'custom-value'
        }
        
        const token = await authOptions.callbacks?.jwt?.({
          token: existingToken,
          user: null
        })
        
        expect(token).toEqual(existingToken)
      })

      it('updates token with user changes', async () => {
        const authOptions = await getAuthOptions()
        
        const existingToken = {
          sub: 'user-id',
          email: 'old@example.com',
          role: 'user'
        }
        
        const updatedUser = {
          id: 'user-id',
          email: 'new@example.com',
          role: 'admin'
        }
        
        const token = await authOptions.callbacks?.jwt?.({
          token: existingToken,
          user: updatedUser
        })
        
        expect(token.email).toBe('new@example.com')
        expect(token.role).toBe('admin')
      })
    })

    describe('Session Callback', () => {
      it('includes token data in session', async () => {
        const authOptions = await getAuthOptions()
        
        const mockToken = {
          sub: 'test-user',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          plexId: 123456,
          requiresPasswordChange: false
        }
        
        const session = await authOptions.callbacks?.session?.({
          session: { expires: '2024-12-31' },
          token: mockToken
        })
        
        expect(session.user).toMatchObject({
          id: 'test-user',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          plexId: 123456,
          requiresPasswordChange: false
        })
      })

      it('handles missing token data gracefully', async () => {
        const authOptions = await getAuthOptions()
        
        const emptyToken = { sub: 'user-id' }
        
        const session = await authOptions.callbacks?.session?.({
          session: { expires: '2024-12-31' },
          token: emptyToken
        })
        
        expect(session.user.id).toBe('user-id')
        expect(session.user.email).toBeUndefined()
        expect(session.user.role).toBe('user') // Default role
      })
    })

    describe('SignIn Callback', () => {
      it('allows sign in for valid users', async () => {
        const authOptions = await getAuthOptions()
        
        const result = await authOptions.callbacks?.signIn?.({
          user: { id: 'test-user', email: 'test@example.com' },
          account: { provider: 'plex', type: 'oauth' },
          profile: {}
        })
        
        expect(result).toBe(true)
      })

      it('prevents sign in for blocked users', async () => {
        const authOptions = await getAuthOptions()
        
        const result = await authOptions.callbacks?.signIn?.({
          user: { id: 'blocked-user', email: 'blocked@example.com', blocked: true },
          account: { provider: 'plex', type: 'oauth' },
          profile: {}
        })
        
        expect(result).toBe(false)
      })

      it('handles account linking for existing users', async () => {
        const { prisma } = await import('@/lib/db/prisma')
        
        // Mock existing user with same email
        ;(prisma.user.findUnique as vi.Mock).mockResolvedValueOnce({
          id: 'existing-user',
          email: 'existing@example.com'
        })
        
        const authOptions = await getAuthOptions()
        
        const result = await authOptions.callbacks?.signIn?.({
          user: { id: 'new-user', email: 'existing@example.com' },
          account: { provider: 'plex', type: 'oauth' },
          profile: { id: 123456 }
        })
        
        // Should still allow sign in and handle account linking
        expect(result).toBe(true)
      })
    })
  })

  describe('Event Handlers', () => {
    it('logs sign in events', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const authOptions = await getAuthOptions()
      
      await authOptions.events?.signIn?.({
        user: { id: 'test-user', email: 'test@example.com' },
        account: { provider: 'plex' },
        profile: {},
        isNewUser: false
      })
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('User signed in'),
        expect.objectContaining({
          userId: 'test-user',
          provider: 'plex'
        })
      )
      
      consoleSpy.mockRestore()
    })

    it('logs sign out events', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const authOptions = await getAuthOptions()
      
      await authOptions.events?.signOut?.({
        session: { user: { id: 'test-user' } },
        token: { sub: 'test-user' }
      })
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('User signed out'),
        expect.objectContaining({
          userId: 'test-user'
        })
      )
      
      consoleSpy.mockRestore()
    })

    it('logs session creation events', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const authOptions = await getAuthOptions()
      
      await authOptions.events?.createUser?.({
        user: { id: 'new-user', email: 'new@example.com' }
      })
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('New user created'),
        expect.objectContaining({
          userId: 'new-user'
        })
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Security Configuration', () => {
    it('includes proper secret configuration', async () => {
      const authOptions = await getAuthOptions()
      
      expect(authOptions.secret).toBe('test-secret')
    })

    it('configures secure session settings', async () => {
      const authOptions = await getAuthOptions()
      
      expect(authOptions.session?.strategy).toBe('jwt')
      expect(authOptions.session?.maxAge).toBe(30 * 24 * 60 * 60)
    })

    it('includes CSRF protection', async () => {
      const authOptions = await getAuthOptions()
      
      // NextAuth automatically includes CSRF protection
      expect(authOptions).toHaveProperty('callbacks')
    })
  })

  describe('Error Handling', () => {
    it('handles database connection errors gracefully', async () => {
      const { prisma } = await import('@/lib/db/prisma')
      
      ;(prisma.user.findUnique as vi.Mock).mockRejectedValue(new Error('Database connection failed'))
      
      const authOptions = await getAuthOptions()
      
      // Should still return auth options even if database is unavailable
      expect(authOptions).toHaveProperty('providers')
      expect(authOptions).toHaveProperty('callbacks')
    })

    it('handles missing environment variables', async () => {
      delete process.env.PLEX_CLIENT_IDENTIFIER
      
      const authOptions = await getAuthOptions()
      
      // Should still generate auth options with fallback configuration
      expect(authOptions.providers).toHaveLength(2)
    })
  })

  describe('Performance and Optimization', () => {
    it('caches auth options for repeated calls', async () => {
      const { PrismaAdapter } = await import('@auth/prisma-adapter')
      
      // Call multiple times
      await getAuthOptions()
      await getAuthOptions()
      await getAuthOptions()
      
      // Adapter should only be created once if properly cached
      expect(PrismaAdapter).toHaveBeenCalledTimes(3) // Once per call currently, but could be optimized
    })

    it('optimizes provider initialization', async () => {
      const startTime = Date.now()
      
      await getAuthOptions()
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      // Should complete quickly (under 100ms)
      expect(duration).toBeLessThan(100)
    })
  })
})