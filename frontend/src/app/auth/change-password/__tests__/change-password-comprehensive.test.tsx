import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ChangePasswordPage from '../page';

// Mock Next.js hooks and NextAuth
vi.mock('next/navigation');
vi.mock('next-auth/react');

const mockPush = vi.fn();
const mockUpdate = vi.fn();
const mockUseRouter = useRouter as vi.MockedFunction<typeof useRouter>;
const mockUseSession = useSession as vi.MockedFunction<typeof useSession>;

beforeEach(() => {
  vi.clearAllMocks();

  // Mock fetch with proper vi.fn()
  global.fetch = vi.fn();

  mockUseRouter.mockReturnValue({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  } as any);

  mockUseSession.mockReturnValue({
    data: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        requiresPasswordChange: true,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    status: 'authenticated',
    update: mockUpdate,
  });
});

describe('Change Password Page - Comprehensive Testing', () => {
  describe('Component Rendering', () => {
    it('renders change password form with correct title and description', () => {
      render(<ChangePasswordPage />);

      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
      expect(
        screen.getByText('You must change your password before continuing'),
      ).toBeInTheDocument();
    });

    it('renders all form fields with correct labels', () => {
      render(<ChangePasswordPage />);

      expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();
    });

    it('shows helpful text for password requirements', () => {
      render(<ChangePasswordPage />);

      expect(screen.getByText('Default: admin')).toBeInTheDocument();
      expect(screen.getByText('Must be at least 8 characters long')).toBeInTheDocument();
    });

    it('redirects users who do not require password change', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            requiresPasswordChange: false,
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        status: 'authenticated',
        update: mockUpdate,
      });

      render(<ChangePasswordPage />);

      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('returns null for users who do not require password change', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            requiresPasswordChange: false,
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        status: 'authenticated',
        update: mockUpdate,
      });

      const { container } = render(<ChangePasswordPage />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Form Validation', () => {
    it('validates that passwords match', async () => {
      const user = userEvent.setup();

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Change Password' });

      await user.type(currentPasswordInput, 'admin');
      await user.type(newPasswordInput, 'newPassword123!');
      await user.type(confirmPasswordInput, 'differentPassword123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('New passwords do not match')).toBeInTheDocument();
      });
    });

    it('validates minimum password length', async () => {
      const user = userEvent.setup();

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Change Password' });

      await user.type(currentPasswordInput, 'admin');
      await user.type(newPasswordInput, '123');
      await user.type(confirmPasswordInput, '123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters long')).toBeInTheDocument();
      });
    });

    it('allows valid password change', async () => {
      const user = userEvent.setup();

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');

      await user.type(currentPasswordInput, 'admin');
      await user.type(newPasswordInput, 'newPassword123!');
      await user.type(confirmPasswordInput, 'newPassword123!');

      // Should not show validation errors
      expect(screen.queryByText('New passwords do not match')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Password must be at least 8 characters long'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Password Change Process', () => {
    it('handles successful password change', async () => {
      const user = userEvent.setup();

      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            message: 'Password changed successfully',
          }),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Change Password' });

      await user.type(currentPasswordInput, 'admin');
      await user.type(newPasswordInput, 'newPassword123!');
      await user.type(confirmPasswordInput, 'newPassword123!');
      await user.click(submitButton);

      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'admin',
          newPassword: 'newPassword123!',
        }),
      });

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({ requiresPasswordChange: false });
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('handles API errors', async () => {
      const user = userEvent.setup();

      const mockResponse = {
        ok: false,
        json: () =>
          Promise.resolve({
            error: 'Current password is incorrect',
          }),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Change Password' });

      await user.type(currentPasswordInput, 'wrongPassword');
      await user.type(newPasswordInput, 'newPassword123!');
      await user.type(confirmPasswordInput, 'newPassword123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Current password is incorrect')).toBeInTheDocument();
      });
    });

    it('handles network errors', async () => {
      const user = userEvent.setup();

      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Change Password' });

      await user.type(currentPasswordInput, 'admin');
      await user.type(newPasswordInput, 'newPassword123!');
      await user.type(confirmPasswordInput, 'newPassword123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('handles generic API error without specific message', async () => {
      const user = userEvent.setup();

      const mockResponse = {
        ok: false,
        json: () => Promise.resolve({}),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Change Password' });

      await user.type(currentPasswordInput, 'admin');
      await user.type(newPasswordInput, 'newPassword123!');
      await user.type(confirmPasswordInput, 'newPassword123!');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to change password')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States and UI Feedback', () => {
    it('shows loading state during password change', async () => {
      const user = userEvent.setup();

      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(global.fetch).mockReturnValueOnce(promise as any);

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Change Password' });

      await user.type(currentPasswordInput, 'admin');
      await user.type(newPasswordInput, 'newPassword123!');
      await user.type(confirmPasswordInput, 'newPassword123!');
      await user.click(submitButton);

      expect(screen.getByText('Changing password...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Resolve promise to clean up
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    it('disables submit button during loading', async () => {
      const user = userEvent.setup();

      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(global.fetch).mockReturnValueOnce(promise as any);

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Change Password' });

      await user.type(currentPasswordInput, 'admin');
      await user.type(newPasswordInput, 'newPassword123!');
      await user.type(confirmPasswordInput, 'newPassword123!');
      await user.click(submitButton);

      expect(submitButton).toBeDisabled();

      // Resolve promise to clean up
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    it('shows loading icon during password change', async () => {
      const user = userEvent.setup();

      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(global.fetch).mockReturnValueOnce(promise as any);

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Change Password' });

      await user.type(currentPasswordInput, 'admin');
      await user.type(newPasswordInput, 'newPassword123!');
      await user.type(confirmPasswordInput, 'newPassword123!');
      await user.click(submitButton);

      // Check for the presence of the loading spinner (Loader2 component)
      expect(submitButton.querySelector('svg')).toBeInTheDocument();

      // Resolve promise to clean up
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });
  });

  describe('Form Interaction', () => {
    it('allows typing in all form fields', async () => {
      const user = userEvent.setup();

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password') as HTMLInputElement;
      const newPasswordInput = screen.getByLabelText('New Password') as HTMLInputElement;
      const confirmPasswordInput = screen.getByLabelText(
        'Confirm New Password',
      ) as HTMLInputElement;

      await user.type(currentPasswordInput, 'admin');
      await user.type(newPasswordInput, 'newPassword123!');
      await user.type(confirmPasswordInput, 'newPassword123!');

      expect(currentPasswordInput.value).toBe('admin');
      expect(newPasswordInput.value).toBe('newPassword123!');
      expect(confirmPasswordInput.value).toBe('newPassword123!');
    });

    it('clears error message when form is resubmitted', async () => {
      const user = userEvent.setup();

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Change Password' });

      // First submission with mismatched passwords
      await user.type(currentPasswordInput, 'admin');
      await user.type(newPasswordInput, 'newPassword123!');
      await user.type(confirmPasswordInput, 'differentPassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('New passwords do not match')).toBeInTheDocument();
      });

      // Clear and retry with correct passwords
      await user.clear(confirmPasswordInput);
      await user.type(confirmPasswordInput, 'newPassword123!');
      await user.click(submitButton);

      // Error should be cleared
      expect(screen.queryByText('New passwords do not match')).not.toBeInTheDocument();
    });

    it('validates form data before submission', async () => {
      const user = userEvent.setup();

      render(<ChangePasswordPage />);

      const submitButton = screen.getByRole('button', { name: 'Change Password' });

      // Try to submit empty form - should prevent submission due to required fields
      await user.click(submitButton);

      // No API call should be made
      expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
    });

    it('handles required field validation', async () => {
      const user = userEvent.setup();

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');

      expect(currentPasswordInput).toHaveAttribute('required');
      expect(newPasswordInput).toHaveAttribute('required');
      expect(confirmPasswordInput).toHaveAttribute('required');
    });
  });

  describe('Accessibility', () => {
    it('has proper form structure', () => {
      render(<ChangePasswordPage />);

      // Check for form element by tag since it doesn't have role="form" by default
      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    it('has proper label associations', () => {
      render(<ChangePasswordPage />);

      expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
    });

    it('shows error alerts with proper ARIA roles', async () => {
      const user = userEvent.setup();

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Change Password' });

      await user.type(currentPasswordInput, 'admin');
      await user.type(newPasswordInput, 'newPassword123!');
      await user.type(confirmPasswordInput, 'different');
      await user.click(submitButton);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent('New passwords do not match');
      });
    });

    it('provides helpful placeholder text', () => {
      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');

      expect(currentPasswordInput).toHaveAttribute('placeholder', 'Enter current password');
      expect(newPasswordInput).toHaveAttribute('placeholder', 'Enter new password');
      expect(confirmPasswordInput).toHaveAttribute('placeholder', 'Confirm new password');
    });
  });

  describe('Edge Cases', () => {
    it('handles session without user object', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'authenticated',
        update: mockUpdate,
      });

      const { container } = render(<ChangePasswordPage />);

      // Should render the form even without user data in session
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
    });

    it('handles undefined session data', () => {
      mockUseSession.mockReturnValue({
        data: undefined,
        status: 'authenticated',
        update: mockUpdate,
      });

      render(<ChangePasswordPage />);

      // Should render the form
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
    });

    it('handles very long passwords', async () => {
      const user = userEvent.setup();

      render(<ChangePasswordPage />);

      const newPasswordInput = screen.getByLabelText('New Password');
      const veryLongPassword = 'a'.repeat(100) + '123!';

      await user.type(newPasswordInput, veryLongPassword);

      expect((newPasswordInput as HTMLInputElement).value).toBe(veryLongPassword);
    });

    it('handles special characters in passwords', async () => {
      const user = userEvent.setup();

      render(<ChangePasswordPage />);

      const currentPasswordInput = screen.getByLabelText('Current Password');
      const newPasswordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');

      // Use a simpler special character password to avoid userEvent parsing issues
      const specialPassword = 'Password123!@#$%^&*()';

      await user.type(currentPasswordInput, 'admin');
      await user.type(newPasswordInput, specialPassword);
      await user.type(confirmPasswordInput, specialPassword);

      expect((newPasswordInput as HTMLInputElement).value).toBe(specialPassword);
      expect((confirmPasswordInput as HTMLInputElement).value).toBe(specialPassword);
    });
  });
});
