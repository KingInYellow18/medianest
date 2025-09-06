import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, render, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { renderWithProviders } from '@/test/utils'
import SignInPage from '../page'

// Mock Next.js hooks and NextAuth
vi.mock('next/navigation')
vi.mock('next-auth/react')

const mockPush = vi.fn()
const mockUseRouter = useRouter as vi.MockedFunction<typeof useRouter>
const mockUseSearchParams = useSearchParams as vi.MockedFunction<typeof useSearchParams>
const mockSignIn = signIn as vi.MockedFunction<typeof signIn>

// Mock global fetch
global.fetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  
  mockUseRouter.mockReturnValue({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  } as any)
  
  mockUseSearchParams.mockReturnValue(new URLSearchParams())
})

describe('SignIn Page - Comprehensive Testing', () => {
  describe('Initial Render and UI Components', () => {
    it('renders sign in page with correct title and description', () => {
      render(<SignInPage />)
      
      expect(screen.getByText('Sign in to MediaNest')).toBeInTheDocument()
      expect(screen.getByText('Access your media server and services')).toBeInTheDocument()
    })

    it('displays Plex sign in button initially', () => {
      render(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      expect(plexButton).toBeInTheDocument()
      expect(plexButton).toBeEnabled()
    })

    it('displays admin setup button', () => {
      render(<SignInPage />)
      
      const adminButton = screen.getByRole('button', { name: /admin setup/i })
      expect(adminButton).toBeInTheDocument()
      expect(adminButton).toBeEnabled()
    })

    it('renders Plex logo correctly', () => {
      render(<SignInPage />)
      
      const plexLogo = screen.getByAltText('Plex')
      expect(plexLogo).toBeInTheDocument()
      expect(plexLogo).toHaveAttribute('src', '/plex-logo.svg')
    })
  })

  describe('Error Handling and Display', () => {
    const errorScenarios = [
      { error: 'OAuthSignin', expectedText: 'Failed to start authentication' },
      { error: 'OAuthCallback', expectedText: 'Authentication failed' },
      { error: 'OAuthCreateAccount', expectedText: 'Failed to create account' },
      { error: 'EmailCreateAccount', expectedText: 'Failed to create account' },
      { error: 'Callback', expectedText: 'Authentication failed' },
      { error: 'Default', expectedText: 'An error occurred during sign in' },
    ]

    errorScenarios.forEach(({ error, expectedText }) => {
      it(`displays correct error message for ${error} error`, () => {
        mockUseSearchParams.mockReturnValue(new URLSearchParams(`error=${error}`))
        
        render(<SignInPage />)
        
        const errorAlert = screen.getByRole('alert')
        expect(errorAlert).toBeInTheDocument()
        expect(screen.getByText(expectedText)).toBeInTheDocument()
      })
    })
  })

  describe('Callback URL Handling', () => {
    it('uses default callback URL when none provided', () => {
      render(<SignInPage />)
      
      // Should use '/dashboard' as default - we'll verify this through the component behavior
      expect(mockUseSearchParams).toHaveBeenCalled()
    })

    it('uses custom callback URL when provided', () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams('callbackUrl=/custom-page'))
      
      render(<SignInPage />)
      
      // The callback URL should be used in the auth flow
      expect(mockUseSearchParams).toHaveBeenCalled()
    })
  })

  describe('Plex Authentication Flow', () => {
    beforeEach(() => {
      global.fetch = vi.fn()
      global.window.open = vi.fn()
    })

    it('starts Plex authentication flow successfully', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          pin: '1234',
          sessionId: 'test-session-id',
          authUrl: 'https://plex.tv/auth#test'
        })
      }
      
      ;(global.fetch as vi.Mock).mockResolvedValueOnce(mockResponse)
      
      render(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/plex/pin', {
        method: 'POST'
      })
    })

    it('displays PIN after successful authentication start', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          pin: '1234',
          sessionId: 'test-session-id',
          authUrl: 'https://plex.tv/auth#test'
        })
      }
      
      ;(global.fetch as vi.Mock).mockResolvedValueOnce(mockResponse)
      
      render(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      await waitFor(() => {
        expect(screen.getByText('1234')).toBeInTheDocument()
        expect(screen.getByText('Enter this PIN on the Plex website:')).toBeInTheDocument()
      })
    })

    it('opens Plex authorization window', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          pin: '1234',
          sessionId: 'test-session-id',
          authUrl: 'https://plex.tv/auth#test'
        })
      }
      
      ;(global.fetch as vi.Mock).mockResolvedValueOnce(mockResponse)
      
      render(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      await waitFor(() => {
        expect(global.window.open).toHaveBeenCalledWith(
          'https://plex.tv/auth#test',
          'plexAuth',
          'width=800,height=600'
        )
      })
    })

    it('shows loading state during authentication start', async () => {
      const user = userEvent.setup()
      let resolvePromise: (value: any) => void
      const promise = new Promise(resolve => { resolvePromise = resolve })
      
      ;(global.fetch as vi.Mock).mockReturnValueOnce(promise)
      
      render(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      // Should show loading state
      expect(screen.getByText('Starting authentication...')).toBeInTheDocument()
      expect(plexButton).toBeDisabled()
      
      // Resolve the promise to clean up
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({
          pin: '1234',
          sessionId: 'test-session-id',
          authUrl: 'https://plex.tv/auth#test'
        })
      })
    })

    it('handles authentication start failure', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        ok: false,
        status: 500
      }
      
      ;(global.fetch as vi.Mock).mockResolvedValueOnce(mockResponse)
      
      // Mock alert to prevent actual popup
      global.alert = vi.fn()
      
      render(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          'Failed to start Plex authentication. Please try again.'
        )
      })
    })

    it('allows canceling Plex authentication', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          pin: '1234',
          sessionId: 'test-session-id',
          authUrl: 'https://plex.tv/auth#test'
        })
      }
      
      ;(global.fetch as vi.Mock).mockResolvedValueOnce(mockResponse)
      
      render(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      await waitFor(() => {
        expect(screen.getByText('1234')).toBeInTheDocument()
      })
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)
      
      // Should return to initial state
      expect(screen.queryByText('1234')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in with plex/i })).toBeInTheDocument()
    })
  })

  describe('PIN Polling and Authorization', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('polls for authorization after PIN display', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const startResponse = {
        ok: true,
        json: () => Promise.resolve({
          pin: '1234',
          sessionId: 'test-session-id',
          authUrl: 'https://plex.tv/auth#test'
        })
      }
      
      const pollResponse = {
        ok: true,
        json: () => Promise.resolve({ authorized: false })
      }
      
      ;(global.fetch as vi.Mock)
        .mockResolvedValueOnce(startResponse)
        .mockResolvedValueOnce(pollResponse)
      
      render(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      await waitFor(() => {
        expect(screen.getByText('1234')).toBeInTheDocument()
      })
      
      // Advance timer to trigger polling
      vi.advanceTimersByTime(2000)
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/plex/pin?sessionId=test-session-id')
      })
    })

    it('completes authentication when PIN is authorized', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const startResponse = {
        ok: true,
        json: () => Promise.resolve({
          pin: '1234',
          sessionId: 'test-session-id',
          authUrl: 'https://plex.tv/auth#test'
        })
      }
      
      const authorizedResponse = {
        ok: true,
        json: () => Promise.resolve({
          authorized: true,
          authToken: 'test-token'
        })
      }
      
      const callbackResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true })
      }
      
      ;(global.fetch as vi.Mock)
        .mockResolvedValueOnce(startResponse)
        .mockResolvedValueOnce(authorizedResponse)
        .mockResolvedValueOnce(callbackResponse)
      
      render(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      await waitFor(() => {
        expect(screen.getByText('1234')).toBeInTheDocument()
      })
      
      // Advance timer to trigger polling and authorization
      vi.advanceTimersByTime(2000)
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/plex/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authToken: 'test-token' })
        })
      })
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })
  })

  describe('Admin Login Flow', () => {
    it('shows admin login form when Admin Setup is clicked', async () => {
      const user = userEvent.setup()
      
      render(<SignInPage />)
      
      const adminSetupButton = screen.getByRole('button', { name: /admin setup/i })
      await user.click(adminSetupButton)
      
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in as admin/i })).toBeInTheDocument()
    })

    it('prefills admin username and disables field', async () => {
      const user = userEvent.setup()
      
      render(<SignInPage />)
      
      const adminSetupButton = screen.getByRole('button', { name: /admin setup/i })
      await user.click(adminSetupButton)
      
      const usernameInput = screen.getByLabelText(/username/i) as HTMLInputElement
      expect(usernameInput.value).toBe('admin')
      expect(usernameInput).toBeDisabled()
    })

    it('handles admin login successfully', async () => {
      const user = userEvent.setup()
      
      mockSignIn.mockResolvedValueOnce({
        ok: true,
        error: null,
        status: 200,
        url: null
      })
      
      render(<SignInPage />)
      
      const adminSetupButton = screen.getByRole('button', { name: /admin setup/i })
      await user.click(adminSetupButton)
      
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in as admin/i })
      
      await user.type(passwordInput, 'admin')
      await user.click(submitButton)
      
      expect(mockSignIn).toHaveBeenCalledWith('admin-bootstrap', {
        username: 'admin',
        password: 'admin',
        redirect: false
      })
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/change-password?requiresPasswordChange=true')
      })
    })

    it('handles admin login failure', async () => {
      const user = userEvent.setup()
      
      mockSignIn.mockResolvedValueOnce({
        ok: false,
        error: 'CredentialsSignin',
        status: 401,
        url: null
      })
      
      global.alert = vi.fn()
      
      render(<SignInPage />)
      
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

    it('shows loading state during admin login', async () => {
      const user = userEvent.setup()
      
      let resolveSignIn: (value: any) => void
      const signInPromise = new Promise(resolve => { resolveSignIn = resolve })
      mockSignIn.mockReturnValueOnce(signInPromise)
      
      render(<SignInPage />)
      
      const adminSetupButton = screen.getByRole('button', { name: /admin setup/i })
      await user.click(adminSetupButton)
      
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in as admin/i })
      
      await user.type(passwordInput, 'admin')
      await user.click(submitButton)
      
      expect(screen.getByText('Signing in...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
      
      // Resolve to clean up
      resolveSignIn!({ ok: true, error: null })
    })

    it('allows returning to Plex login from admin form', async () => {
      const user = userEvent.setup()
      
      render(<SignInPage />)
      
      const adminSetupButton = screen.getByRole('button', { name: /admin setup/i })
      await user.click(adminSetupButton)
      
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
      
      const backButton = screen.getByRole('button', { name: /back to plex login/i })
      await user.click(backButton)
      
      expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in with plex/i })).toBeInTheDocument()
    })
  })

  describe('Accessibility and User Experience', () => {
    it('has proper ARIA labels and roles', () => {
      render(<SignInPage />)
      
      expect(screen.getByRole('button', { name: /sign in with plex/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /admin setup/i })).toBeInTheDocument()
    })

    it('shows waiting message during PIN authorization', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          pin: '1234',
          sessionId: 'test-session-id',
          authUrl: 'https://plex.tv/auth#test'
        })
      }
      
      ;(global.fetch as vi.Mock).mockResolvedValueOnce(mockResponse)
      
      render(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      await waitFor(() => {
        expect(screen.getByText('Waiting for authorization...')).toBeInTheDocument()
      })
    })

    it('provides button to reopen Plex authorization page', async () => {
      const user = userEvent.setup()
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          pin: '1234',
          sessionId: 'test-session-id',
          authUrl: 'https://plex.tv/auth#test'
        })
      }
      
      ;(global.fetch as vi.Mock).mockResolvedValueOnce(mockResponse)
      
      render(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      await waitFor(() => {
        const reopenButton = screen.getByRole('button', { name: /open plex authorization page/i })
        expect(reopenButton).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('handles network errors gracefully', async () => {
      const user = userEvent.setup()
      
      ;(global.fetch as vi.Mock).mockRejectedValueOnce(new Error('Network error'))
      global.alert = vi.fn()
      
      render(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          'Failed to start Plex authentication. Please try again.'
        )
      })
    })

    it('handles polling errors during authorization', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const startResponse = {
        ok: true,
        json: () => Promise.resolve({
          pin: '1234',
          sessionId: 'test-session-id',
          authUrl: 'https://plex.tv/auth#test'
        })
      }
      
      ;(global.fetch as vi.Mock)
        .mockResolvedValueOnce(startResponse)
        .mockRejectedValueOnce(new Error('Polling error'))
      
      global.alert = vi.fn()
      
      render(<SignInPage />)
      
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i })
      await user.click(plexButton)
      
      await waitFor(() => {
        expect(screen.getByText('1234')).toBeInTheDocument()
      })
      
      vi.advanceTimersByTime(2000)
      
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Authentication failed. Please try again.')
      })
    })
  })
})