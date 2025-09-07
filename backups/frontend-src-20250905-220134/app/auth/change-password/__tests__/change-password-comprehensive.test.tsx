import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { renderWithProviders } from '@/test/utils'
import ChangePasswordPage from '../page'

// Mock Next.js hooks and NextAuth
vi.mock('next/navigation')
vi.mock('next-auth/react')

const mockPush = vi.fn()
const mockUseRouter = useRouter as vi.MockedFunction<typeof useRouter>
const mockUseSearchParams = useSearchParams as vi.MockedFunction<typeof useSearchParams>
const mockUseSession = useSession as vi.MockedFunction<typeof useSession>
const mockSignOut = signOut as vi.MockedFunction<typeof signOut>

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
  
  mockUseSession.mockReturnValue({
    data: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user'
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    },
    status: 'authenticated',
    update: vi.fn()
  })
})

describe('Change Password Page - Comprehensive Testing', () => {
  describe('Authentication and Session Handling', () => {
    it('redirects unauthenticated users', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: vi.fn()
      })
      
      render(<ChangePasswordPage />)
      
      expect(mockPush).toHaveBeenCalledWith('/auth/signin')
    })

    it('shows loading state while session is loading', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
        update: vi.fn()
      })
      
      render(<ChangePasswordPage />)
      
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders form for authenticated users', () => {
      render(<ChangePasswordPage />)
      
      expect(screen.getByText('Change Password')).toBeInTheDocument()
      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('shows required field validation', async () => {
      const user = userEvent.setup()
      
      render(<ChangePasswordPage />)
      
      const submitButton = screen.getByRole('button', { name: /change password/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/current password is required/i)).toBeInTheDocument()
        expect(screen.getByText(/new password is required/i)).toBeInTheDocument()
      })
    })

    it('validates new password strength', async () => {
      const user = userEvent.setup()
      
      render(<ChangePasswordPage />)
      
      const newPasswordInput = screen.getByLabelText(/new password/i)
      await user.type(newPasswordInput, '123')
      
      const submitButton = screen.getByRole('button', { name: /change password/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
      })
    })

    it('validates password confirmation match', async () => {
      const user = userEvent.setup()
      
      render(<ChangePasswordPage />)
      
      const newPasswordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      
      await user.type(newPasswordInput, 'newPassword123!')
      await user.type(confirmPasswordInput, 'differentPassword123!')
      
      const submitButton = screen.getByRole('button', { name: /change password/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
      })
    })

    it('validates against using current password as new password', async () => {
      const user = userEvent.setup()
      
      render(<ChangePasswordPage />)
      
      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      
      await user.type(currentPasswordInput, 'currentPassword123!')
      await user.type(newPasswordInput, 'currentPassword123!')
      await user.type(confirmPasswordInput, 'currentPassword123!')
      
      const submitButton = screen.getByRole('button', { name: /change password/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/new password must be different from current password/i)).toBeInTheDocument()
      })
    })
  })

  describe('Password Strength Requirements', () => {
    const weakPasswords = [
      { password: '12345678', reason: 'no uppercase, special chars' },
      { password: 'password', reason: 'no numbers, uppercase, special chars' },
      { password: 'PASSWORD', reason: 'no lowercase, numbers, special chars' },
      { password: 'Password', reason: 'no numbers, special chars' },
      { password: 'Password123', reason: 'no special chars' },
    ]

    weakPasswords.forEach(({ password, reason }) => {
      it(`rejects weak password: ${reason}`, async () => {
        const user = userEvent.setup()
        
        render(<ChangePasswordPage />)
        
        const newPasswordInput = screen.getByLabelText(/new password/i)
        await user.type(newPasswordInput, password)
        
        const submitButton = screen.getByRole('button', { name: /change password/i })
        await user.click(submitButton)
        
        await waitFor(() => {
          const errorMessage = screen.queryByText(/password must contain/i) || 
                              screen.queryByText(/password must be at least 8 characters/i) ||
                              screen.queryByText(/password is too weak/i)
          expect(errorMessage).toBeInTheDocument()
        })
      })
    })

    it('accepts strong password', async () => {
      const user = userEvent.setup()
      
      render(<ChangePasswordPage />)
      
      const newPasswordInput = screen.getByLabelText(/new password/i)
      await user.type(newPasswordInput, 'StrongPassword123!')
      
      // Should not show password strength error
      await waitFor(() => {
        expect(screen.queryByText(/password must contain/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Password Change Process', () => {
    it('handles successful password change', async () => {
      const user = userEvent.setup()
      
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: 'Password changed successfully'
        })
      }
      
      ;(global.fetch as vi.Mock).mockResolvedValueOnce(mockResponse)
      
      render(<ChangePasswordPage />)
      
      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /change password/i })
      
      await user.type(currentPasswordInput, 'oldPassword123!')
      await user.type(newPasswordInput, 'newPassword123!')
      await user.type(confirmPasswordInput, 'newPassword123!')
      await user.click(submitButton)
      
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'oldPassword123!',
          newPassword: 'newPassword123!'
        })
      })
      
      await waitFor(() => {
        expect(screen.getByText(/password changed successfully/i)).toBeInTheDocument()
      })
    })

    it('handles incorrect current password', async () => {
      const user = userEvent.setup()
      
      const mockResponse = {
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Current password is incorrect'
        })
      }
      
      ;(global.fetch as vi.Mock).mockResolvedValueOnce(mockResponse)
      
      render(<ChangePasswordPage />)
      
      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /change password/i })
      
      await user.type(currentPasswordInput, 'wrongPassword')
      await user.type(newPasswordInput, 'newPassword123!')
      await user.type(confirmPasswordInput, 'newPassword123!')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/current password is incorrect/i)).toBeInTheDocument()
      })
    })

    it('handles server errors gracefully', async () => {
      const user = userEvent.setup()
      
      const mockResponse = {
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          error: 'Internal server error'
        })
      }
      
      ;(global.fetch as vi.Mock).mockResolvedValueOnce(mockResponse)
      
      render(<ChangePasswordPage />)
      
      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /change password/i })
      
      await user.type(currentPasswordInput, 'currentPassword123!')
      await user.type(newPasswordInput, 'newPassword123!')
      await user.type(confirmPasswordInput, 'newPassword123!')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/failed to change password/i)).toBeInTheDocument()
      })
    })

    it('handles network errors', async () => {
      const user = userEvent.setup()
      
      ;(global.fetch as vi.Mock).mockRejectedValueOnce(new Error('Network error'))
      
      render(<ChangePasswordPage />)
      
      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /change password/i })
      
      await user.type(currentPasswordInput, 'currentPassword123!')
      await user.type(newPasswordInput, 'newPassword123!')
      await user.type(confirmPasswordInput, 'newPassword123!')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })
    })
  })

  describe('Loading States and UI Feedback', () => {
    it('shows loading state during password change', async () => {
      const user = userEvent.setup()
      
      let resolvePromise: (value: any) => void
      const promise = new Promise(resolve => { resolvePromise = resolve })
      
      ;(global.fetch as vi.Mock).mockReturnValueOnce(promise)
      
      render(<ChangePasswordPage />)
      
      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /change password/i })
      
      await user.type(currentPasswordInput, 'currentPassword123!')
      await user.type(newPasswordInput, 'newPassword123!')
      await user.type(confirmPasswordInput, 'newPassword123!')
      await user.click(submitButton)
      
      expect(screen.getByText(/changing password.../i)).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
      
      // Resolve promise to clean up
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    })

    it('disables form during submission', async () => {
      const user = userEvent.setup()
      
      let resolvePromise: (value: any) => void
      const promise = new Promise(resolve => { resolvePromise = resolve })
      
      ;(global.fetch as vi.Mock).mockReturnValueOnce(promise)
      
      render(<ChangePasswordPage />)
      
      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /change password/i })
      
      await user.type(currentPasswordInput, 'currentPassword123!')
      await user.type(newPasswordInput, 'newPassword123!')
      await user.type(confirmPasswordInput, 'newPassword123!')
      await user.click(submitButton)
      
      expect(currentPasswordInput).toBeDisabled()
      expect(newPasswordInput).toBeDisabled()
      expect(confirmPasswordInput).toBeDisabled()
      expect(submitButton).toBeDisabled()
      
      // Resolve promise to clean up
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    })
  })

  describe('Force Password Change Scenario', () => {
    it('shows force change message when required', () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams('requiresPasswordChange=true'))
      
      render(<ChangePasswordPage />)
      
      expect(screen.getByText(/you must change your password/i)).toBeInTheDocument()
    })

    it('prevents navigation when password change is required', () => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams('requiresPasswordChange=true'))
      
      render(<ChangePasswordPage />)
      
      // Should not show any navigation links or buttons
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
    })

    it('signs out user after successful forced password change', async () => {
      const user = userEvent.setup()
      
      mockUseSearchParams.mockReturnValue(new URLSearchParams('requiresPasswordChange=true'))
      
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: 'Password changed successfully'
        })
      }
      
      ;(global.fetch as vi.Mock).mockResolvedValueOnce(mockResponse)
      
      render(<ChangePasswordPage />)
      
      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText(/new password/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /change password/i })
      
      await user.type(currentPasswordInput, 'admin')
      await user.type(newPasswordInput, 'newSecurePassword123!')
      await user.type(confirmPasswordInput, 'newSecurePassword123!')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/auth/signin' })
      })
    })
  })

  describe('Password Visibility Toggle', () => {
    it('toggles current password visibility', async () => {
      const user = userEvent.setup()
      
      render(<ChangePasswordPage />)
      
      const currentPasswordInput = screen.getByLabelText(/current password/i) as HTMLInputElement
      const toggleButton = screen.getAllByRole('button', { name: /toggle password visibility/i })[0]
      
      expect(currentPasswordInput.type).toBe('password')
      
      await user.click(toggleButton)
      expect(currentPasswordInput.type).toBe('text')
      
      await user.click(toggleButton)
      expect(currentPasswordInput.type).toBe('password')
    })

    it('toggles new password visibility', async () => {
      const user = userEvent.setup()
      
      render(<ChangePasswordPage />)
      
      const newPasswordInput = screen.getByLabelText(/new password/i) as HTMLInputElement
      const toggleButtons = screen.getAllByRole('button', { name: /toggle password visibility/i })
      const newPasswordToggle = toggleButtons[1]
      
      expect(newPasswordInput.type).toBe('password')
      
      await user.click(newPasswordToggle)
      expect(newPasswordInput.type).toBe('text')
    })

    it('toggles confirm password visibility', async () => {
      const user = userEvent.setup()
      
      render(<ChangePasswordPage />)
      
      const confirmPasswordInput = screen.getByLabelLabel(/confirm new password/i) as HTMLInputElement
      const toggleButtons = screen.getAllByRole('button', { name: /toggle password visibility/i })
      const confirmPasswordToggle = toggleButtons[2]
      
      expect(confirmPasswordInput.type).toBe('password')
      
      await user.click(confirmPasswordToggle)
      expect(confirmPasswordInput.type).toBe('text')
    })
  })

  describe('Accessibility and User Experience', () => {
    it('has proper form labels and ARIA attributes', () => {
      render(<ChangePasswordPage />)
      
      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
      
      const form = screen.getByRole('form')
      expect(form).toBeInTheDocument()
    })

    it('shows password strength indicator', async () => {
      const user = userEvent.setup()
      
      render(<ChangePasswordPage />)
      
      const newPasswordInput = screen.getByLabelText(/new password/i)
      
      // Weak password
      await user.type(newPasswordInput, '123')
      expect(screen.getByText(/weak/i)).toBeInTheDocument()
      
      // Clear and type strong password
      await user.clear(newPasswordInput)
      await user.type(newPasswordInput, 'StrongPassword123!')
      expect(screen.getByText(/strong/i)).toBeInTheDocument()
    })

    it('focuses first input on load', () => {
      render(<ChangePasswordPage />)
      
      const currentPasswordInput = screen.getByLabelText(/current password/i)
      expect(currentPasswordInput).toHaveFocus()
    })

    it('provides helpful placeholder text', () => {
      render(<ChangePasswordPage />)
      
      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText(/new password/i)
      
      expect(currentPasswordInput).toHaveAttribute('placeholder', 'Enter your current password')
      expect(newPasswordInput).toHaveAttribute('placeholder', 'Enter a strong new password')
    })
  })

  describe('Security Considerations', () => {
    it('clears form after successful password change', async () => {
      const user = userEvent.setup()
      
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: 'Password changed successfully'
        })
      }
      
      ;(global.fetch as vi.Mock).mockResolvedValueOnce(mockResponse)
      
      render(<ChangePasswordPage />)
      
      const currentPasswordInput = screen.getByLabelText(/current password/i) as HTMLInputElement
      const newPasswordInput = screen.getByLabelText(/new password/i) as HTMLInputElement
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i) as HTMLInputElement
      const submitButton = screen.getByRole('button', { name: /change password/i })
      
      await user.type(currentPasswordInput, 'currentPassword123!')
      await user.type(newPasswordInput, 'newPassword123!')
      await user.type(confirmPasswordInput, 'newPassword123!')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(currentPasswordInput.value).toBe('')
        expect(newPasswordInput.value).toBe('')
        expect(confirmPasswordInput.value).toBe('')
      })
    })

    it('does not log sensitive data', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const user = userEvent.setup()
      
      render(<ChangePasswordPage />)
      
      const currentPasswordInput = screen.getByLabelText(/current password/i)
      await user.type(currentPasswordInput, 'secretPassword123!')
      
      // Console should not contain the password
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('secretPassword123!'))
      
      consoleSpy.mockRestore()
    })
  })
})