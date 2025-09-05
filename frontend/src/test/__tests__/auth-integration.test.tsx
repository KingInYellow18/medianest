import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../utils'
import SignInPage from '@/app/auth/signin/page'
import ChangePasswordPage from '@/app/auth/change-password/page'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'

// Mock Next.js hooks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/auth/signin',
  useParams: () => ({}),
}))

// Mock NextAuth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('Authentication Integration Tests - End-to-End Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    global.window.open = vi.fn()
  })

  afterEach(() => {
    server.resetHandlers()
  })

  describe('Complete Plex Authentication Flow', () => {
    it('completes full Plex OAuth flow from start to finish', async () => {
      const user = userEvent.setup()
      
      // Mock the sequence of API calls for Plex flow
      let pinSessionId: string | null = null
      
      server.use(
        // PIN creation
        http.post('/api/auth/plex/pin', () => {
          pinSessionId = 'test-session-12345'
          return HttpResponse.json({
            sessionId: pinSessionId,
            pin: '7890',
            authUrl: 'https://app.plex.tv/auth#test-flow',
            expiresIn: 600
          })
        }),
        
        // PIN status check - first unauthorized, then authorized
        http.get('/api/auth/plex/pin', ({ request }) => {
          const url = new URL(request.url)
          const sessionId = url.searchParams.get('sessionId')
          
          if (sessionId === pinSessionId) {
            // Simulate PIN being authorized after first check
            if (Math.random() > 0.5) { // Randomly authorize after some checks
              return HttpResponse.json({
                authorized: true,
                authToken: 'plex-token-authorized'
              })
            } else {
              return HttpResponse.json({
                authorized: false,
                expiresIn: 590
              })
            }
          }
          
          return HttpResponse.json(
            { error: 'Invalid session' },
            { status: 400 }
          )
        }),
        
        // Callback to complete authentication
        http.post('/api/auth/plex/callback', () => {
          return HttpResponse.json({
            success: true,
            user: {
              id: 'plex-user-123',
              email: 'plex.user@example.com',
              username: 'plexuser'
            }
          })
        })
      )
      
      // Start the authentication flow
      renderWithProviders(<SignInPage />)
      
      expect(screen.getByText('Sign in to MediaNest')).toBeInTheDocument()
      
      // Click Plex sign-in button
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      // Should show PIN and start polling
      await waitFor(() => {
        expect(screen.getByText('7890')).toBeInTheDocument()
        expect(screen.getByText('Enter this PIN on the Plex website:')).toBeInTheDocument()
      })
      
      // Verify Plex window was opened
      expect(global.window.open).toHaveBeenCalledWith(
        'https://app.plex.tv/auth#test-flow',
        'plexAuth',
        'width=800,height=600'
      )
      
      // Should show waiting state
      expect(screen.getByText('Waiting for authorization...')).toBeInTheDocument()
      
      // Mock the polling completing with authorization
      server.use(
        http.get('/api/auth/plex/pin', () => {
          return HttpResponse.json({
            authorized: true,
            authToken: 'plex-token-authorized'
          })
        })
      )
      
      // Wait for polling to complete and redirect
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/plex/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authToken: 'plex-token-authorized' })
        })
      }, { timeout: 5000 })
    })

    it('handles Plex authentication errors gracefully', async () => {
      const user = userEvent.setup()
      global.alert = vi.fn()
      
      // Mock PIN creation failure
      server.use(
        http.post('/api/auth/plex/pin', () => {
          return HttpResponse.json(
            { error: 'Plex service unavailable' },
            { status: 503 }
          )
        })
      )
      
      renderWithProviders(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          'Failed to start Plex authentication. Please try again.'
        )
      })
    })

    it('handles PIN expiration during flow', async () => {
      const user = userEvent.setup()
      global.alert = vi.fn()
      
      server.use(
        http.post('/api/auth/plex/pin', () => {
          return HttpResponse.json({
            sessionId: 'expiring-session',
            pin: '1111',
            authUrl: 'https://app.plex.tv/auth#expiring',
            expiresIn: 600
          })
        }),
        
        http.get('/api/auth/plex/pin', () => {
          return HttpResponse.json(
            { error: 'PIN has expired' },
            { status: 400 }
          )
        })
      )
      
      renderWithProviders(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      await waitFor(() => {
        expect(screen.getByText('1111')).toBeInTheDocument()
      })
      
      // Wait for polling to detect expiration
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          'Authentication failed. Please try again.'
        )
      }, { timeout: 3000 })
    })
  })

  describe('Admin Bootstrap Flow', () => {
    it('completes admin setup and password change flow', async () => {
      const user = userEvent.setup()
      const { signIn } = await import('next-auth/react')
      const { useRouter } = await import('next/navigation')
      const mockPush = vi.fn()
      
      // Mock successful admin login
      ;(signIn as vi.Mock).mockResolvedValue({
        ok: true,
        error: null
      })
      ;(useRouter as vi.Mock).mockReturnValue({ push: mockPush })
      
      renderWithProviders(<SignInPage />)
      
      // Switch to admin login
      const adminSetupButton = screen.getByRole('button', { name: /admin setup/i })
      await user.click(adminSetupButton)
      
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      
      // Fill in admin credentials
      const passwordInput = screen.getByLabelText(/password/i)
      await user.type(passwordInput, 'admin')
      
      // Submit admin login
      const submitButton = screen.getByRole('button', { name: /sign in as admin/i })
      await user.click(submitButton)
      
      // Should redirect to change password
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/change-password?requiresPasswordChange=true')
      })
    })

    it('handles admin login failure', async () => {
      const user = userEvent.setup()
      const { signIn } = await import('next-auth/react')
      global.alert = vi.fn()
      
      ;(signIn as vi.Mock).mockResolvedValue({
        ok: false,
        error: 'CredentialsSignin'
      })
      
      renderWithProviders(<SignInPage />)
      
      const adminSetupButton = screen.getByRole('button', { name: /admin setup/i })
      await user.click(adminSetupButton)
      
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in as admin/i })
      
      await user.type(passwordInput, 'wrong-password')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Invalid credentials')
      })
    })
  })

  describe('Password Change Flow', () => {
    it('completes password change for authenticated user', async () => {
      const user = userEvent.setup()
      const { useSession } = await import('next-auth/react')
      
      // Mock authenticated session
      ;(useSession as vi.Mock).mockReturnValue({
        data: {
          user: { id: 'test-user', email: 'test@example.com' },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        status: 'authenticated',
        update: vi.fn()
      })
      
      server.use(
        http.post('/api/auth/change-password', () => {
          return HttpResponse.json({
            success: true,
            message: 'Password changed successfully'
          })
        })
      )
      
      renderWithProviders(<ChangePasswordPage />)
      
      expect(screen.getByText('Change Your Password')).toBeInTheDocument()
      
      // Fill in password change form
      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      
      await user.type(currentPasswordInput, 'admin')
      await user.type(newPasswordInput, 'NewSecurePassword123!')
      await user.type(confirmPasswordInput, 'NewSecurePassword123!')
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /change password/i })
      await user.click(submitButton)
      
      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/password changed successfully/i)).toBeInTheDocument()
      })
    })

    it('handles forced password change scenario', async () => {
      const user = userEvent.setup()
      const { useSession, signOut } = await import('next-auth/react')
      const { useSearchParams } = await import('next/navigation')
      
      // Mock authenticated session requiring password change
      ;(useSession as vi.Mock).mockReturnValue({
        data: {
          user: { id: 'admin-user', requiresPasswordChange: true },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        status: 'authenticated',
        update: vi.fn()
      })
      
      ;(useSearchParams as vi.Mock).mockReturnValue(
        new URLSearchParams('requiresPasswordChange=true')
      )
      
      server.use(
        http.post('/api/auth/change-password', () => {
          return HttpResponse.json({
            success: true,
            message: 'Password changed successfully'
          })
        })
      )
      
      renderWithProviders(<ChangePasswordPage />)
      
      // Should show forced change message
      expect(screen.getByText(/you must change your password/i)).toBeInTheDocument()
      
      // Complete password change
      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      
      await user.type(currentPasswordInput, 'admin')
      await user.type(newPasswordInput, 'NewSecurePassword123!')
      await user.type(confirmPasswordInput, 'NewSecurePassword123!')
      
      const submitButton = screen.getByRole('button', { name: /change password/i })
      await user.click(submitButton)
      
      // Should sign out after successful forced password change
      await waitFor(() => {
        expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/auth/signin' })
      })
    })

    it('validates password strength requirements', async () => {
      const user = userEvent.setup()
      const { useSession } = await import('next-auth/react')
      
      ;(useSession as vi.Mock).mockReturnValue({
        data: {
          user: { id: 'test-user', email: 'test@example.com' },
        },
        status: 'authenticated'
      })
      
      renderWithProviders(<ChangePasswordPage />)
      
      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /change password/i })
      
      // Test weak password
      await user.type(currentPasswordInput, 'admin')
      await user.type(newPasswordInput, '123')
      await user.type(confirmPasswordInput, '123')
      await user.click(submitButton)
      
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
      
      // Test mismatched passwords
      await user.clear(newPasswordInput)
      await user.clear(confirmPasswordInput)
      await user.type(newPasswordInput, 'StrongPassword123!')
      await user.type(confirmPasswordInput, 'DifferentPassword123!')
      await user.click(submitButton)
      
      expect(screen.getByText(/new passwords do not match/i)).toBeInTheDocument()
    })
  })

  describe('Session Management Integration', () => {
    it('handles session expiration during authentication', async () => {
      const user = userEvent.setup()
      const { useSession } = await import('next-auth/react')
      
      // Start with authenticated session
      let sessionStatus = 'authenticated'
      ;(useSession as vi.Mock).mockImplementation(() => ({
        data: sessionStatus === 'authenticated' ? {
          user: { id: 'test-user' }
        } : null,
        status: sessionStatus
      }))
      
      renderWithProviders(<ChangePasswordPage />)
      
      // Simulate session expiration
      sessionStatus = 'unauthenticated'
      
      // Should redirect to signin
      await waitFor(() => {
        const { useRouter } = require('next/navigation')
        expect(useRouter().push).toHaveBeenCalledWith('/auth/signin')
      })
    })

    it('maintains session state across page reloads', async () => {
      const { useSession } = await import('next-auth/react')
      
      // Mock persistent session
      const mockSession = {
        user: { id: 'persistent-user', email: 'user@example.com' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
      
      ;(useSession as vi.Mock).mockReturnValue({
        data: mockSession,
        status: 'authenticated'
      })
      
      const { rerender } = renderWithProviders(<ChangePasswordPage />)
      
      expect(screen.getByText('Change Your Password')).toBeInTheDocument()
      
      // Simulate page reload
      rerender(<ChangePasswordPage />)
      
      // Should still be authenticated
      expect(screen.getByText('Change Your Password')).toBeInTheDocument()
    })
  })

  describe('Error Recovery and User Experience', () => {
    it('allows user to retry failed operations', async () => {
      const user = userEvent.setup()
      global.alert = vi.fn()
      
      // Mock initial failure, then success
      let attemptCount = 0
      server.use(
        http.post('/api/auth/plex/pin', () => {
          attemptCount++
          if (attemptCount === 1) {
            return HttpResponse.json(
              { error: 'Service temporarily unavailable' },
              { status: 503 }
            )
          } else {
            return HttpResponse.json({
              sessionId: 'retry-session',
              pin: '9999',
              authUrl: 'https://app.plex.tv/auth#retry'
            })
          }
        })
      )
      
      renderWithProviders(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      
      // First attempt should fail
      await user.click(plexButton)
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          'Failed to start Plex authentication. Please try again.'
        )
      })
      
      // Retry should succeed
      await user.click(plexButton)
      await waitFor(() => {
        expect(screen.getByText('9999')).toBeInTheDocument()
      })
    })

    it('provides clear feedback for all error states', async () => {
      const user = userEvent.setup()
      
      const errorScenarios = [
        { error: 'OAuthSignin', expected: 'Failed to start authentication' },
        { error: 'OAuthCallback', expected: 'Authentication failed' },
        { error: 'Default', expected: 'An error occurred during sign in' }
      ]
      
      for (const { error, expected } of errorScenarios) {
        const { useSearchParams } = await import('next/navigation')
        ;(useSearchParams as vi.Mock).mockReturnValue(new URLSearchParams(`error=${error}`))
        
        const { unmount } = renderWithProviders(<SignInPage />)
        
        expect(screen.getByText(expected)).toBeInTheDocument()
        
        unmount()
      }
    })
  })

  describe('Cross-Browser and Device Compatibility', () => {
    it('handles popup blockers gracefully', async () => {
      const user = userEvent.setup()
      global.alert = vi.fn()
      
      // Mock popup being blocked
      global.window.open = vi.fn().mockReturnValue(null)
      
      server.use(
        http.post('/api/auth/plex/pin', () => {
          return HttpResponse.json({
            sessionId: 'popup-test',
            pin: '1234',
            authUrl: 'https://app.plex.tv/auth#popup-test'
          })
        })
      )
      
      renderWithProviders(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      await waitFor(() => {
        expect(screen.getByText('1234')).toBeInTheDocument()
      })
      
      // Should still show the PIN and provide manual link
      const reopenButton = screen.getByRole('button', { name: /open plex authorization page/i })
      expect(reopenButton).toBeInTheDocument()
      
      await user.click(reopenButton)
      expect(global.window.open).toHaveBeenCalledTimes(2) // Original + retry
    })
  })

  describe('Performance and Optimization', () => {
    it('optimizes polling frequency to balance UX and server load', async () => {
      const user = userEvent.setup()
      vi.useFakeTimers()
      
      server.use(
        http.post('/api/auth/plex/pin', () => {
          return HttpResponse.json({
            sessionId: 'perf-test',
            pin: '5555',
            authUrl: 'https://app.plex.tv/auth#perf'
          })
        }),
        
        http.get('/api/auth/plex/pin', () => {
          return HttpResponse.json({ authorized: false })
        })
      )
      
      renderWithProviders(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      await waitFor(() => {
        expect(screen.getByText('5555')).toBeInTheDocument()
      })
      
      const fetchSpy = vi.spyOn(global, 'fetch')
      
      // Advance time and count polling requests
      vi.advanceTimersByTime(10000) // 10 seconds
      
      await waitFor(() => {
        const pollCalls = fetchSpy.mock.calls.filter(call => 
          call[0]?.toString().includes('sessionId=perf-test')
        )
        
        // Should poll approximately every 2 seconds (5 calls in 10 seconds)
        expect(pollCalls.length).toBeGreaterThanOrEqual(4)
        expect(pollCalls.length).toBeLessThanOrEqual(6)
      })
      
      vi.useRealTimers()
      fetchSpy.mockRestore()
    })
  })
})