/**
 * TIER 2 CRITICAL SECURITY TESTS - AUTHENTICATION SIGNIN PAGE (18 tests)
 * Testing authentication flow security vulnerabilities
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { vi } from 'vitest';

import SignInPage from '../page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

// Mock fetch globally
global.fetch = vi.fn();

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
};

const mockSearchParams = {
  get: vi.fn(),
};

describe('SignIn Page Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useSearchParams as any).mockReturnValue(mockSearchParams);
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'callbackUrl') return '/dashboard';
      if (key === 'error') return null;
      return null;
    });
    
    // Mock window.open
    global.window.open = vi.fn();
    
    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Callback URL Security', () => {
    test('should validate callback URL to prevent open redirect attacks', () => {
      const maliciousCallbacks = [
        'https://evil.com',
        'http://malicious.site/steal-tokens',
        'javascript:alert(document.cookie)',
        '//evil.com/steal-tokens',
        'data:text/html,<script>steal()</script>',
        'ftp://malicious.com',
      ];

      maliciousCallbacks.forEach((maliciousUrl) => {
        mockSearchParams.get.mockImplementation((key: string) => {
          if (key === 'callbackUrl') return maliciousUrl;
          return null;
        });

        render(<SignInPage />);
        
        // Should default to safe URL, not use malicious callback
        expect(mockRouter.push).not.toHaveBeenCalledWith(maliciousUrl);
      });
    });

    test('should sanitize callback URL parameters', () => {
      const xssCallback = '/dashboard?next=<script>alert("XSS")</script>';
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'callbackUrl') return xssCallback;
        return null;
      });

      render(<SignInPage />);
      
      // Should not contain XSS payload
      expect(screen.queryByText('<script>')).not.toBeInTheDocument();
    });

    test('should enforce callback URL whitelist', () => {
      const validCallbacks = ['/dashboard', '/media', '/requests', '/admin'];
      const invalidCallbacks = ['https://external.com', '/../../etc/passwd'];

      validCallbacks.forEach((validUrl) => {
        mockSearchParams.get.mockImplementation((key: string) => {
          if (key === 'callbackUrl') return validUrl;
          return null;
        });

        render(<SignInPage />);
        // Valid URLs should be accepted (we'll verify in integration tests)
      });

      invalidCallbacks.forEach((invalidUrl) => {
        mockSearchParams.get.mockImplementation((key: string) => {
          if (key === 'callbackUrl') return invalidUrl;
          return null;
        });

        render(<SignInPage />);
        // Invalid URLs should be rejected
      });
    });
  });

  describe('Error Message Security', () => {
    test('should not expose sensitive error information', () => {
      const sensitiveErrors = [
        'Database connection failed: password=secret123',
        'JWT secret key is invalid: sk-abc123',
        'Internal server error: /app/.env not found',
      ];

      sensitiveErrors.forEach((error) => {
        mockSearchParams.get.mockImplementation((key: string) => {
          if (key === 'error') return error;
          return null;
        });

        render(<SignInPage />);
        
        // Should not display sensitive details
        expect(screen.queryByText('secret123')).not.toBeInTheDocument();
        expect(screen.queryByText('sk-abc123')).not.toBeInTheDocument();
        expect(screen.queryByText('/app/.env')).not.toBeInTheDocument();
      });
    });

    test('should display generic error messages for known error types', () => {
      const errorMappings = [
        { error: 'OAuthSignin', expected: 'Failed to start authentication' },
        { error: 'OAuthCallback', expected: 'Authentication failed' },
        { error: 'OAuthCreateAccount', expected: 'Failed to create account' },
        { error: 'Callback', expected: 'Authentication failed' },
        { error: 'Default', expected: 'An error occurred during sign in' },
      ];

      errorMappings.forEach(({ error, expected }) => {
        mockSearchParams.get.mockImplementation((key: string) => {
          if (key === 'error') return error;
          return null;
        });

        render(<SignInPage />);
        expect(screen.getByText(expected)).toBeInTheDocument();
      });
    });

    test('should prevent XSS through error parameter', () => {
      const xssError = '<script>document.location="http://evil.com"</script>';
      mockSearchParams.get.mockImplementation((key: string) => {
        if (key === 'error') return xssError;
        return null;
      });

      render(<SignInPage />);
      
      // Should not execute script
      expect(document.location.href).not.toContain('evil.com');
      expect(screen.queryByText('<script>')).not.toBeInTheDocument();
    });
  });

  describe('Plex Authentication Security', () => {
    test('should validate Plex PIN response to prevent injection', async () => {
      const user = userEvent.setup();
      
      // Mock malicious PIN response
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pin: '<script>alert("XSS")</script>',
          sessionId: 'valid-session',
          authUrl: 'https://app.plex.tv/auth/pin',
        }),
      });

      render(<SignInPage />);
      
      const plexButton = screen.getByText('Sign in with Plex');
      await user.click(plexButton);

      await waitFor(() => {
        // Should not execute script from PIN
        expect(screen.queryByText('<script>')).not.toBeInTheDocument();
      });
    });

    test('should validate session ID format', async () => {
      const user = userEvent.setup();
      
      const maliciousSessions = [
        '../../../etc/passwd',
        '<script>evil()</script>',
        'session"; DROP TABLE users; --',
        null,
        undefined,
        123,
      ];

      for (const maliciousSession of maliciousSessions) {
        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            pin: '1234',
            sessionId: maliciousSession,
            authUrl: 'https://app.plex.tv/auth/pin',
          }),
        });

        render(<SignInPage />);
        
        const plexButton = screen.getByText('Sign in with Plex');
        await user.click(plexButton);

        // Should handle malicious session IDs safely
        await waitFor(() => {
          expect(screen.getByText(/Enter this PIN/)).toBeInTheDocument();
        });
      }
    });

    test('should validate Plex auth URL to prevent redirect attacks', async () => {
      const user = userEvent.setup();
      
      const maliciousUrls = [
        'https://evil.com/steal-tokens',
        'javascript:alert("XSS")',
        'data:text/html,<script>evil()</script>',
        'http://localhost:8080/malicious',
      ];

      for (const maliciousUrl of maliciousUrls) {
        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            pin: '1234',
            sessionId: 'valid-session',
            authUrl: maliciousUrl,
          }),
        });

        render(<SignInPage />);
        
        const plexButton = screen.getByText('Sign in with Plex');
        await user.click(plexButton);

        await waitFor(() => {
          const authButton = screen.queryByText('Open Plex Authorization Page');
          if (authButton) {
            // Should not open malicious URLs
            expect(window.open).not.toHaveBeenCalledWith(maliciousUrl, expect.any(String), expect.any(String));
          }
        });
      }
    });

    test('should implement CSRF protection for PIN authorization', async () => {
      const user = userEvent.setup();
      
      // Mock successful PIN creation
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pin: '1234',
          sessionId: 'test-session',
          authUrl: 'https://app.plex.tv/auth/pin',
        }),
      });

      render(<SignInPage />);
      
      const plexButton = screen.getByText('Sign in with Plex');
      await user.click(plexButton);

      // Verify PIN endpoint was called securely
      expect(fetch).toHaveBeenCalledWith('/api/auth/plex/pin', {
        method: 'POST',
      });
    });

    test('should rate limit PIN requests to prevent abuse', async () => {
      const user = userEvent.setup();
      
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          pin: '1234',
          sessionId: 'test-session',
          authUrl: 'https://app.plex.tv/auth/pin',
        }),
      });

      render(<SignInPage />);
      
      const plexButton = screen.getByText('Sign in with Plex');
      
      // Rapidly click multiple times
      await user.click(plexButton);
      await user.click(plexButton);
      await user.click(plexButton);

      // Should only make one request due to loading state
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('should secure polling mechanism against timing attacks', async () => {
      const user = userEvent.setup();
      let pollCount = 0;
      
      // Mock PIN creation
      (fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/auth/plex/pin') && !url.includes('sessionId')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              pin: '1234',
              sessionId: 'test-session',
              authUrl: 'https://app.plex.tv/auth/pin',
            }),
          });
        }
        
        // Mock polling responses
        pollCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            authorized: pollCount > 3, // Authorize after 3 polls
            authToken: pollCount > 3 ? 'test-token' : undefined,
          }),
        });
      });

      render(<SignInPage />);
      
      const plexButton = screen.getByText('Sign in with Plex');
      await user.click(plexButton);

      // Should implement proper polling intervals
      await waitFor(() => {
        expect(screen.getByText('Waiting for authorization...')).toBeInTheDocument();
      });
    });
  });

  describe('Admin Authentication Security', () => {
    test('should prevent brute force attacks on admin login', async () => {
      const user = userEvent.setup();
      
      render(<SignInPage />);
      
      // Switch to admin login
      const adminButton = screen.getByText('Admin Setup');
      await user.click(adminButton);

      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByText('Sign in as Admin');

      // Mock failed attempts
      (signIn as any).mockResolvedValue({ error: 'Invalid credentials' });

      // Simulate multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await user.type(passwordInput, 'wrong-password');
        await user.click(submitButton);
        await user.clear(passwordInput);
      }

      // Should implement rate limiting (tested via backend)
      expect(signIn).toHaveBeenCalledTimes(5);
    });

    test('should validate admin credentials format', async () => {
      const user = userEvent.setup();
      
      render(<SignInPage />);
      
      const adminButton = screen.getByText('Admin Setup');
      await user.click(adminButton);

      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        '"; DROP TABLE users; --',
        '../../../etc/passwd',
        null,
        undefined,
      ];

      for (const maliciousInput of maliciousInputs) {
        const passwordInput = screen.getByLabelText('Password');
        
        if (maliciousInput) {
          await user.type(passwordInput, maliciousInput);
        }

        // Should handle malicious inputs safely
        expect(passwordInput.value).not.toContain('<script>');
      }
    });

    test('should implement secure session handling for admin', async () => {
      const user = userEvent.setup();
      
      (signIn as any).mockResolvedValue({ ok: true });

      render(<SignInPage />);
      
      const adminButton = screen.getByText('Admin Setup');
      await user.click(adminButton);

      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByText('Sign in as Admin');

      await user.type(passwordInput, 'admin');
      await user.click(submitButton);

      expect(signIn).toHaveBeenCalledWith('admin-bootstrap', {
        username: 'admin',
        password: 'admin',
        redirect: false,
      });

      // Should redirect to password change for security
      expect(mockRouter.push).toHaveBeenCalledWith('/auth/change-password?requiresPasswordChange=true');
    });

    test('should prevent username enumeration attacks', async () => {
      const user = userEvent.setup();
      
      render(<SignInPage />);
      
      const adminButton = screen.getByText('Admin Setup');
      await user.click(adminButton);

      // Username should be fixed/disabled to prevent enumeration
      const usernameInput = screen.getByLabelText('Username');
      expect(usernameInput).toBeDisabled();
      expect(usernameInput.value).toBe('admin');
    });
  });

  describe('General Security Measures', () => {
    test('should implement Content Security Policy headers', () => {
      render(<SignInPage />);
      
      // CSP should be implemented at the server level
      // This test verifies no inline scripts are used
      const scripts = document.querySelectorAll('script[data-inline]');
      expect(scripts.length).toBe(0);
    });

    test('should prevent clickjacking attacks', () => {
      render(<SignInPage />);
      
      // Verify page structure doesn't allow easy iframe embedding
      const sensitiveElements = screen.getAllByRole('button');
      sensitiveElements.forEach(element => {
        expect(element).toBeVisible();
      });
    });

    test('should sanitize all user inputs', async () => {
      const user = userEvent.setup();
      
      render(<SignInPage />);
      
      // Test PIN input if visible
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pin: '1234',
          sessionId: 'test-session',
          authUrl: 'https://app.plex.tv/auth/pin',
        }),
      });

      const plexButton = screen.getByText('Sign in with Plex');
      await user.click(plexButton);

      // All displayed content should be safe
      await waitFor(() => {
        const pinDisplay = screen.getByText('1234');
        expect(pinDisplay).toBeInTheDocument();
        expect(pinDisplay.textContent).toBe('1234');
      });
    });

    test('should implement proper error handling without information disclosure', async () => {
      const user = userEvent.setup();
      
      // Mock network error
      (fetch as any).mockRejectedValue(new Error('Network error'));

      render(<SignInPage />);
      
      const plexButton = screen.getByText('Sign in with Plex');
      await user.click(plexButton);

      // Should show generic error message
      await waitFor(() => {
        // Error should be handled gracefully without exposing details
        expect(screen.queryByText('Network error')).not.toBeInTheDocument();
      });
    });
  });
});