import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within, getByRole } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils';
import SignInPage from '@/app/auth/signin/page';
import ChangePasswordPage from '@/app/auth/change-password/page';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

// Enhanced mocks with comprehensive coverage
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
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Authentication Integration Tests - Enhanced End-to-End Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    global.window.open = vi.fn();
    global.alert = vi.fn();
  });

  afterEach(() => {
    server.resetHandlers();
    // Clean up any timers or intervals
    vi.clearAllTimers();
  });

  describe('Complete Plex Authentication Flow with Advanced Scenarios', () => {
    it('completes full Plex OAuth flow with comprehensive validation', async () => {
      const user = userEvent.setup();

      // Mock the sequence of API calls with realistic timing
      let pinSessionId: string | null = null;
      let pollCount = 0;

      server.use(
        // PIN creation with validation
        http.post('/api/auth/plex/pin', async ({ request }) => {
          const body = await request.json();
          pinSessionId = 'test-session-12345';

          return HttpResponse.json({
            sessionId: pinSessionId,
            pin: '7890',
            authUrl: 'https://app.plex.tv/auth#test-flow',
            expiresIn: 600,
            createdAt: new Date().toISOString(),
          });
        }),

        // PIN status check with realistic authorization flow
        http.get('/api/auth/plex/pin', ({ request }) => {
          const url = new URL(request.url);
          const sessionId = url.searchParams.get('sessionId');

          if (sessionId === pinSessionId) {
            pollCount++;

            // Simulate realistic authorization timing
            if (pollCount >= 3) {
              // Authorize after 3rd poll
              return HttpResponse.json({
                authorized: true,
                authToken: 'plex-token-authorized-12345',
                user: {
                  id: 'plex-user-123',
                  username: 'testuser',
                  email: 'test@plex.tv',
                },
              });
            } else {
              return HttpResponse.json({
                authorized: false,
                expiresIn: 600 - pollCount * 2, // Decreasing expiry
                pollCount,
              });
            }
          }

          return HttpResponse.json({ error: 'Invalid session ID' }, { status: 400 });
        }),

        // Enhanced callback with user data validation
        http.post('/api/auth/plex/callback', async ({ request }) => {
          const body = await request.json();

          if (body.authToken === 'plex-token-authorized-12345') {
            return HttpResponse.json({
              success: true,
              user: {
                id: 'plex-user-123',
                email: 'test@plex.tv',
                username: 'testuser',
                avatar: 'https://plex.tv/avatar.jpg',
              },
              session: {
                accessToken: 'session-token-abc123',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              },
            });
          }

          return HttpResponse.json({ error: 'Invalid auth token' }, { status: 401 });
        }),
      );

      // Start the authentication flow
      renderWithProviders(<SignInPage />);

      // Verify initial page state
      expect(screen.getByText('Sign in to MediaNest')).toBeInTheDocument();
      expect(screen.getByText('Access your media server and services')).toBeInTheDocument();

      // Verify Plex button is accessible
      const plexButton = screen.getByRole('button', { name: /sign in with plex/i });
      expect(plexButton).toBeInTheDocument();
      expect(plexButton).not.toBeDisabled();

      // Start Plex authentication
      await user.click(plexButton);

      // Verify loading state
      expect(screen.getByText('Starting authentication...')).toBeInTheDocument();
      expect(plexButton).toBeDisabled();

      // Wait for PIN display
      await waitFor(
        () => {
          expect(screen.getByText('7890')).toBeInTheDocument();
          expect(screen.getByText('Enter this PIN on the Plex website:')).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Verify Plex window was opened with correct parameters
      expect(global.window.open).toHaveBeenCalledWith(
        'https://app.plex.tv/auth#test-flow',
        'plexAuth',
        'width=800,height=600',
      );

      // Verify waiting state elements
      expect(screen.getByText('Waiting for authorization...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /open plex authorization page/i }),
      ).toBeInTheDocument();

      // Wait for polling to complete and authorization
      await waitFor(
        () => {
          expect(global.fetch).toHaveBeenCalledWith('/api/auth/plex/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              authToken: 'plex-token-authorized-12345',
              sessionId: 'test-session-12345',
            }),
          });
        },
        { timeout: 10000 },
      );

      // Verify successful completion
      const { useRouter } = await import('next/navigation');
      const mockPush = useRouter().push;
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('handles complex error scenarios with proper user feedback', async () => {
      const user = userEvent.setup();

      const errorScenarios = [
        {
          name: 'Network timeout during PIN creation',
          handler: http.post('/api/auth/plex/pin', () => {
            return HttpResponse.json({ error: 'Network timeout' }, { status: 408 });
          }),
          expectedAlert: 'Failed to start Plex authentication. Please try again.',
        },
        {
          name: 'Server overload',
          handler: http.post('/api/auth/plex/pin', () => {
            return HttpResponse.json(
              { error: 'Server overloaded', retryAfter: 60 },
              { status: 503 },
            );
          }),
          expectedAlert: 'Failed to start Plex authentication. Please try again.',
        },
        {
          name: 'Invalid response format',
          handler: http.post('/api/auth/plex/pin', () => {
            return HttpResponse.json({ invalidData: true });
          }),
          expectedAlert: 'Failed to start Plex authentication. Please try again.',
        },
      ];

      for (const scenario of errorScenarios) {
        const { unmount } = renderWithProviders(<SignInPage />);
        server.use(scenario.handler);

        const plexButton = screen.getByRole('button', { name: /sign in with plex/i });
        await user.click(plexButton);

        await waitFor(
          () => {
            expect(global.alert).toHaveBeenCalledWith(scenario.expectedAlert);
          },
          { timeout: 5000 },
        );

        // Verify button returns to normal state
        expect(plexButton).not.toBeDisabled();
        expect(screen.queryByText('Starting authentication...')).not.toBeInTheDocument();

        unmount();
        server.resetHandlers();
        vi.clearAllMocks();
      }
    });

    it('handles PIN expiration with retry mechanism', async () => {
      const user = userEvent.setup();
      vi.useFakeTimers();

      server.use(
        http.post('/api/auth/plex/pin', () => {
          return HttpResponse.json({
            sessionId: 'expiring-session',
            pin: '1111',
            authUrl: 'https://app.plex.tv/auth#expiring',
            expiresIn: 10, // Short expiry for testing
          });
        }),

        http.get('/api/auth/plex/pin', () => {
          return HttpResponse.json(
            { error: 'PIN has expired', code: 'PIN_EXPIRED' },
            { status: 400 },
          );
        }),
      );

      renderWithProviders(<SignInPage />);

      const plexButton = screen.getByRole('button', { name: /sign in with plex/i });
      await user.click(plexButton);

      await waitFor(() => {
        expect(screen.getByText('1111')).toBeInTheDocument();
      });

      // Fast-forward to trigger expiration
      vi.advanceTimersByTime(15000);

      await waitFor(
        () => {
          expect(global.alert).toHaveBeenCalledWith('Authentication failed. Please try again.');
        },
        { timeout: 3000 },
      );

      // Should return to initial state for retry
      expect(screen.queryByText('1111')).not.toBeInTheDocument();
      expect(plexButton).not.toBeDisabled();

      vi.useRealTimers();
    });

    it('handles popup blocker scenarios gracefully', async () => {
      const user = userEvent.setup();

      // Mock popup being blocked
      global.window.open = vi.fn().mockReturnValue(null);

      server.use(
        http.post('/api/auth/plex/pin', () => {
          return HttpResponse.json({
            sessionId: 'popup-blocked-session',
            pin: '9999',
            authUrl: 'https://app.plex.tv/auth#popup-blocked',
          });
        }),
      );

      renderWithProviders(<SignInPage />);

      const plexButton = screen.getByRole('button', { name: /sign in with plex/i });
      await user.click(plexButton);

      await waitFor(() => {
        expect(screen.getByText('9999')).toBeInTheDocument();
      });

      // Should still show PIN and provide manual link
      const reopenButton = screen.getByRole('button', { name: /open plex authorization page/i });
      expect(reopenButton).toBeInTheDocument();

      // Test manual reopen
      await user.click(reopenButton);
      expect(global.window.open).toHaveBeenCalledTimes(2); // Original + manual retry

      // Should show helpful message about popup blockers
      expect(screen.getByText(/if the Plex page didn't open/i)).toBeInTheDocument();
    });
  });

  describe('Enhanced Admin Bootstrap Flow', () => {
    it('completes admin setup with comprehensive validation', async () => {
      const user = userEvent.setup();
      const { signIn } = await import('next-auth/react');
      const { useRouter } = await import('next/navigation');
      const mockPush = vi.fn();

      (signIn as vi.Mock).mockResolvedValue({
        ok: true,
        error: null,
        url: '/auth/change-password?requiresPasswordChange=true',
      });
      (useRouter as vi.Mock).mockReturnValue({ push: mockPush });

      renderWithProviders(<SignInPage />);

      // Test admin setup button accessibility
      const adminSetupButton = screen.getByRole('button', { name: /admin setup/i });
      expect(adminSetupButton).toHaveAttribute('type', 'button');

      await user.click(adminSetupButton);

      // Verify form elements are properly labeled and accessible
      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in as admin/i });

      expect(usernameInput).toHaveValue('admin');
      expect(usernameInput).toBeDisabled();
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toBeRequired();

      // Test form validation
      await user.click(submitButton);

      // Should require password
      expect(passwordInput).toBeInvalid();

      // Fill in password
      await user.type(passwordInput, 'admin');

      // Verify loading state during submission
      await user.click(submitButton);

      expect(screen.getByText('Signing in...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Verify authentication call
      await waitFor(() => {
        expect(signIn).toHaveBeenCalledWith('admin-bootstrap', {
          username: 'admin',
          password: 'admin',
          redirect: false,
        });
      });

      // Should redirect to password change
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/change-password?requiresPasswordChange=true');
      });
    });

    it('handles admin security scenarios', async () => {
      const user = userEvent.setup();
      const { signIn } = await import('next-auth/react');

      const securityScenarios = [
        {
          name: 'Invalid credentials',
          mockResponse: { ok: false, error: 'CredentialsSignin' },
          expectedAlert: 'Invalid credentials',
        },
        {
          name: 'Account locked',
          mockResponse: { ok: false, error: 'AccountLocked' },
          expectedAlert: 'Account is temporarily locked',
        },
        {
          name: 'Too many attempts',
          mockResponse: { ok: false, error: 'TooManyAttempts' },
          expectedAlert: 'Too many login attempts. Please try again later.',
        },
      ];

      for (const scenario of securityScenarios) {
        const { unmount } = renderWithProviders(<SignInPage />);

        (signIn as vi.Mock).mockResolvedValue(scenario.mockResponse);

        const adminSetupButton = screen.getByRole('button', { name: /admin setup/i });
        await user.click(adminSetupButton);

        const passwordInput = screen.getByLabelText(/password/i);
        const submitButton = screen.getByRole('button', { name: /sign in as admin/i });

        await user.type(passwordInput, 'wrong-password');
        await user.click(submitButton);

        await waitFor(() => {
          expect(global.alert).toHaveBeenCalledWith(scenario.expectedAlert);
        });

        // Should remain in admin form
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
        expect(submitButton).not.toBeDisabled();

        unmount();
        vi.clearAllMocks();
      }
    });

    it('provides accessibility support for admin form', async () => {
      const user = userEvent.setup();

      renderWithProviders(<SignInPage />);

      const adminSetupButton = screen.getByRole('button', { name: /admin setup/i });
      await user.click(adminSetupButton);

      // Test keyboard navigation
      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in as admin/i });
      const backButton = screen.getByRole('button', { name: /back to plex login/i });

      // Tab order should be logical
      await user.tab();
      expect(usernameInput).toHaveFocus();

      await user.tab();
      expect(passwordInput).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();

      await user.tab();
      expect(backButton).toHaveFocus();

      // Test form submission with Enter key
      passwordInput.focus();
      await user.type(passwordInput, 'admin');
      await user.keyboard('{Enter}');

      // Should trigger form submission
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });
  });

  describe('Enhanced Password Change Flow', () => {
    it('handles forced password change with security validation', async () => {
      const user = userEvent.setup();
      const { useSession, signOut } = await import('next-auth/react');
      const { useSearchParams } = await import('next/navigation');

      (useSession as vi.Mock).mockReturnValue({
        data: {
          user: {
            id: 'admin-user',
            requiresPasswordChange: true,
            lastPasswordChange: null,
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        status: 'authenticated',
        update: vi.fn(),
      });
      (useSearchParams as vi.Mock).mockReturnValue(
        new URLSearchParams('requiresPasswordChange=true'),
      );

      server.use(
        http.post('/api/auth/change-password', async ({ request }) => {
          const body = await request.json();

          // Validate password requirements
          if (body.newPassword.length < 8) {
            return HttpResponse.json(
              { error: 'Password must be at least 8 characters' },
              { status: 400 },
            );
          }

          if (body.currentPassword !== 'admin') {
            return HttpResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
          }

          return HttpResponse.json({
            success: true,
            message: 'Password changed successfully',
          });
        }),
      );

      renderWithProviders(<ChangePasswordPage />);

      // Verify forced change messaging
      expect(screen.getByText(/you must change your password/i)).toBeInTheDocument();
      expect(screen.getByText(/this is required for security/i)).toBeInTheDocument();

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);
      const submitButton = screen.getByRole('button', { name: /change password/i });

      // Test validation scenarios
      await user.type(currentPasswordInput, 'admin');
      await user.type(newPasswordInput, '123'); // Too short
      await user.type(confirmPasswordInput, '123');
      await user.click(submitButton);

      // Should show client-side validation
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();

      // Test mismatched passwords
      await user.clear(newPasswordInput);
      await user.clear(confirmPasswordInput);
      await user.type(newPasswordInput, 'NewPassword123!');
      await user.type(confirmPasswordInput, 'DifferentPassword123!');
      await user.click(submitButton);

      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();

      // Test successful change
      await user.clear(confirmPasswordInput);
      await user.type(confirmPasswordInput, 'NewPassword123!');
      await user.click(submitButton);

      // Should show loading state
      expect(screen.getByText('Changing password...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Should sign out after successful forced change
      await waitFor(() => {
        expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/auth/signin' });
      });
    });

    it('provides real-time password strength feedback', async () => {
      const user = userEvent.setup();
      const { useSession } = await import('next-auth/react');

      (useSession as vi.Mock).mockReturnValue({
        data: {
          user: { id: 'test-user', email: 'test@example.com' },
        },
        status: 'authenticated',
      });

      renderWithProviders(<ChangePasswordPage />);

      const newPasswordInput = screen.getByLabelText(/new password/i);

      // Test password strength indicators
      await user.type(newPasswordInput, '123');
      expect(screen.getByText(/weak/i)).toBeInTheDocument();
      expect(screen.getByText(/use at least 8 characters/i)).toBeInTheDocument();

      await user.clear(newPasswordInput);
      await user.type(newPasswordInput, 'password123');
      expect(screen.getByText(/fair/i)).toBeInTheDocument();
      expect(screen.getByText(/add special characters/i)).toBeInTheDocument();

      await user.clear(newPasswordInput);
      await user.type(newPasswordInput, 'Password123!');
      expect(screen.getByText(/strong/i)).toBeInTheDocument();
      expect(screen.getByText(/great password/i)).toBeInTheDocument();
    });
  });

  describe('Session Management and Security', () => {
    it('handles session expiration during authentication flows', async () => {
      const user = userEvent.setup();
      const { useSession } = await import('next-auth/react');

      let sessionStatus = 'authenticated';
      (useSession as vi.Mock).mockImplementation(() => ({
        data:
          sessionStatus === 'authenticated'
            ? {
                user: { id: 'test-user' },
              }
            : null,
        status: sessionStatus,
      }));

      renderWithProviders(<ChangePasswordPage />);

      // Start filling form
      const currentPasswordInput = screen.getByLabelText(/current password/i);
      await user.type(currentPasswordInput, 'admin');

      // Simulate session expiration
      sessionStatus = 'unauthenticated';

      // Should redirect to signin
      await waitFor(() => {
        const { useRouter } = require('next/navigation');
        expect(useRouter().push).toHaveBeenCalledWith('/auth/signin');
      });
    });

    it('implements CSRF protection', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('/api/auth/plex/pin', ({ request }) => {
          const csrfToken = request.headers.get('X-CSRF-Token');

          if (!csrfToken) {
            return HttpResponse.json({ error: 'CSRF token missing' }, { status: 403 });
          }

          return HttpResponse.json({
            sessionId: 'csrf-protected-session',
            pin: '4321',
            authUrl: 'https://app.plex.tv/auth#csrf',
          });
        }),
      );

      // Mock CSRF token in meta tag
      const metaElement = document.createElement('meta');
      metaElement.name = 'csrf-token';
      metaElement.content = 'test-csrf-token';
      document.head.appendChild(metaElement);

      renderWithProviders(<SignInPage />);

      const plexButton = screen.getByRole('button', { name: /sign in with plex/i });
      await user.click(plexButton);

      await waitFor(() => {
        expect(screen.getByText('4321')).toBeInTheDocument();
      });

      // Clean up
      document.head.removeChild(metaElement);
    });
  });

  describe('Performance and Optimization', () => {
    it('optimizes polling frequency for better UX and server load', async () => {
      const user = userEvent.setup();
      vi.useFakeTimers();

      let pollCount = 0;
      server.use(
        http.post('/api/auth/plex/pin', () => {
          return HttpResponse.json({
            sessionId: 'perf-test',
            pin: '5555',
            authUrl: 'https://app.plex.tv/auth#perf',
          });
        }),

        http.get('/api/auth/plex/pin', () => {
          pollCount++;
          return HttpResponse.json({
            authorized: false,
            pollInterval: pollCount < 5 ? 2000 : 5000, // Adaptive polling
          });
        }),
      );

      renderWithProviders(<SignInPage />);

      const plexButton = screen.getByRole('button', { name: /sign in with plex/i });
      await user.click(plexButton);

      await waitFor(() => {
        expect(screen.getByText('5555')).toBeInTheDocument();
      });

      const fetchSpy = vi.spyOn(global, 'fetch');

      // Test adaptive polling intervals
      vi.advanceTimersByTime(10000); // 10 seconds

      await waitFor(() => {
        const pollCalls = fetchSpy.mock.calls.filter((call) =>
          call[0]?.toString().includes('sessionId=perf-test'),
        );

        // Should have appropriate number of polls with adaptive timing
        expect(pollCalls.length).toBeGreaterThanOrEqual(3);
        expect(pollCalls.length).toBeLessThanOrEqual(7);
      });

      vi.useRealTimers();
      fetchSpy.mockRestore();
    });

    it('implements proper cleanup for memory leaks prevention', async () => {
      const user = userEvent.setup();

      const { unmount } = renderWithProviders(<SignInPage />);

      const plexButton = screen.getByRole('button', { name: /sign in with plex/i });
      await user.click(plexButton);

      // Unmount component while authentication is in progress
      unmount();

      // Should not cause memory leaks or errors
      expect(() => {
        // Trigger potential cleanup issues
        vi.advanceTimersByTime(10000);
      }).not.toThrow();
    });
  });
});
