import { vi } from 'vitest'
import type { Session, User } from 'next-auth'

// Mock NextAuth.js types and functions
export const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
}

export const mockAdminUser: User = {
  id: 'test-admin-id',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin',
}

export const mockSession: Session = {
  user: mockUser,
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
}

export const mockAdminSession: Session = {
  user: mockAdminUser,
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
}

// Mock session hook variants
export const createMockUseSession = (session: Session | null = null, status: string = 'unauthenticated') => 
  vi.fn(() => ({
    data: session,
    status,
    update: vi.fn(),
  }))

// Common mock implementations
export const mockSignIn = vi.fn()
export const mockSignOut = vi.fn()
export const mockGetSession = vi.fn()

export const nextAuthMocks = {
  useSession: createMockUseSession(),
  signIn: mockSignIn,
  signOut: mockSignOut,
  getSession: mockGetSession,
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}