/**
 * Authentication Flow Integration Tests
 * Tests complete user authentication workflows including login, logout, token refresh, and error scenarios
 */

import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useApp, useIsAuthenticated } from '../../contexts/OptimizedAppContext';
import {
  renderWithAuth,
  renderWithoutAuth,
  simulateLogin,
  simulateLogout,
} from '../../test-utils/integration-render';
import { mswUtils, mswServer } from '../../test-utils/msw-server';




// Test components to verify authentication state
const AuthStatusComponent = () => {
  const { state } = useApp();
  const isAuthenticated = useIsAuthenticated();

  return (
    <div>
      <div data-testid='auth-status'>{isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid='user-info'>{state.user.email || 'no-user'}</div>
      <div data-testid='user-role'>{state.user.role || 'no-role'}</div>
    </div>
  );
};

const LoginFormComponent = () => {
  const { actions } = useApp();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();
      actions.setUser(data.user);
      actions.setSession({
        id: 'session-123',
        isAuthenticated: true,
        expiresAt: new Date(data.expiresAt),
      });

      // Store token in localStorage (simplified)
      localStorage.setItem('authToken', data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        handleLogin(formData.get('email') as string, formData.get('password') as string);
      }}
    >
      <input type='email' name='email' placeholder='Email' data-testid='email-input' required />
      <input
        type='password'
        name='password'
        placeholder='Password'
        data-testid='password-input'
        required
      />
      <button type='submit' data-testid='login-button' disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && (
        <div data-testid='login-error' role='alert'>
          {error}
        </div>
      )}
    </form>
  );
};

const LogoutButtonComponent = () => {
  const { actions } = useApp();
  const [loading, setLoading] = React.useState(false);

  const handleLogout = async () => {
    setLoading(true);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      actions.logout();
      localStorage.removeItem('authToken');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleLogout} data-testid='logout-button' disabled={loading}>
      {loading ? 'Logging out...' : 'Logout'}
    </button>
  );
};

describe('Authentication Flow Integration Tests', () => {
  beforeEach(() => {
    mswUtils.resetMockState();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Initial Authentication State', () => {
    it('should render unauthenticated state by default', () => {
      renderWithoutAuth(<AuthStatusComponent />);

      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('no-user');
      expect(screen.getByTestId('user-role')).toHaveTextContent('no-role');
    });

    it('should render authenticated state when user is pre-authenticated', () => {
      renderWithAuth(<AuthStatusComponent />);

      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('test@medianest.com');
      expect(screen.getByTestId('user-role')).toHaveTextContent('user');
    });

    it('should render admin role correctly', () => {
      renderWithAuth(<AuthStatusComponent />, 'admin');

      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('admin@medianest.com');
      expect(screen.getByTestId('user-role')).toHaveTextContent('admin');
    });
  });

  describe('Login Flow', () => {
    it('should handle successful login with valid credentials', async () => {
      const { user } = renderWithoutAuth(
        <div>
          <LoginFormComponent />
          <AuthStatusComponent />
        </div>,
      );

      // Initially not authenticated
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');

      // Fill in login form
      await user.type(screen.getByTestId('email-input'), 'test@medianest.com');
      await user.type(screen.getByTestId('password-input'), 'password123');

      // Submit form
      await user.click(screen.getByTestId('login-button'));

      // Should show loading state
      expect(screen.getByTestId('login-button')).toHaveTextContent('Logging in...');
      expect(screen.getByTestId('login-button')).toBeDisabled();

      // Wait for authentication to complete
      await waitFor(
        () => {
          expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
        },
        { timeout: 3000 },
      );

      // Should show user info
      expect(screen.getByTestId('user-info')).toHaveTextContent('test@medianest.com');
      expect(screen.getByTestId('user-role')).toHaveTextContent('user');

      // Token should be stored
      expect(localStorage.getItem('authToken')).toBeTruthy();
    });

    it('should handle login with invalid credentials', async () => {
      const { user } = renderWithoutAuth(<LoginFormComponent />);

      await user.type(screen.getByTestId('email-input'), 'invalid@test.com');
      await user.type(screen.getByTestId('password-input'), 'wrongpassword');
      await user.click(screen.getByTestId('login-button'));

      // Should show loading state
      expect(screen.getByTestId('login-button')).toHaveTextContent('Logging in...');

      // Wait for error to appear
      await waitFor(
        () => {
          expect(screen.getByTestId('login-error')).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      expect(screen.getByTestId('login-error')).toHaveTextContent('Invalid credentials');
      expect(screen.getByTestId('login-button')).toHaveTextContent('Login');
      expect(screen.getByTestId('login-button')).not.toBeDisabled();
    });

    it('should handle network errors during login', async () => {
      const { user } = renderWithoutAuth(<LoginFormComponent />);

      await user.type(screen.getByTestId('email-input'), 'network-error@test.com');
      await user.type(screen.getByTestId('password-input'), 'password');
      await user.click(screen.getByTestId('login-button'));

      await waitFor(
        () => {
          expect(screen.getByTestId('login-error')).toHaveTextContent('Network timeout');
        },
        { timeout: 3000 },
      );
    });

    it('should prevent multiple concurrent login attempts', async () => {
      const { user } = renderWithoutAuth(<LoginFormComponent />);

      await user.type(screen.getByTestId('email-input'), 'test@medianest.com');
      await user.type(screen.getByTestId('password-input'), 'password123');

      // Click login button multiple times quickly
      await user.click(screen.getByTestId('login-button'));
      await user.click(screen.getByTestId('login-button'));
      await user.click(screen.getByTestId('login-button'));

      // Button should be disabled after first click
      expect(screen.getByTestId('login-button')).toBeDisabled();
      expect(screen.getByTestId('login-button')).toHaveTextContent('Logging in...');
    });
  });

  describe('Logout Flow', () => {
    it('should handle successful logout', async () => {
      const { user } = renderWithAuth(
        <div>
          <LogoutButtonComponent />
          <AuthStatusComponent />
        </div>,
      );

      // Initially authenticated
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('test@medianest.com');

      // Click logout
      await user.click(screen.getByTestId('logout-button'));

      // Should show loading state
      expect(screen.getByTestId('logout-button')).toHaveTextContent('Logging out...');

      // Wait for logout to complete
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
      });

      expect(screen.getByTestId('user-info')).toHaveTextContent('no-user');
      expect(screen.getByTestId('user-role')).toHaveTextContent('no-role');
    });

    it('should handle logout even when API fails', async () => {
      // Mock logout endpoint to fail
      mswServer.use(
        http.post('/api/auth/logout', () => {
          return HttpResponse.json({ message: 'Server error' }, { status: 500 });
        }),
      );

      const { user } = renderWithAuth(
        <div>
          <LogoutButtonComponent />
          <AuthStatusComponent />
        </div>,
      );

      // Click logout
      await user.click(screen.getByTestId('logout-button'));

      // Should still clear local state even if API fails
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
      });

      expect(screen.getByTestId('user-info')).toHaveTextContent('no-user');
    });
  });

  describe('Token Refresh Flow', () => {
    const TokenRefreshComponent = () => {
      const { actions } = useApp();
      const [refreshing, setRefreshing] = React.useState(false);
      const [error, setError] = React.useState<string | null>(null);

      const handleRefresh = async () => {
        setRefreshing(true);
        setError(null);

        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message);
          }

          const data = await response.json();
          actions.setUser(data.user);
          actions.setSession({
            id: 'session-123',
            isAuthenticated: true,
            expiresAt: new Date(data.expiresAt),
          });

          localStorage.setItem('authToken', data.token);
        } catch (err: any) {
          setError(err.message);
          actions.logout();
        } finally {
          setRefreshing(false);
        }
      };

      return (
        <div>
          <button onClick={handleRefresh} data-testid='refresh-button' disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh Token'}
          </button>
          {error && (
            <div data-testid='refresh-error' role='alert'>
              {error}
            </div>
          )}
        </div>
      );
    };

    it('should handle successful token refresh', async () => {
      localStorage.setItem('authToken', 'existing-token');

      const { user } = renderWithAuth(
        <div>
          <TokenRefreshComponent />
          <AuthStatusComponent />
        </div>,
      );

      // Should be authenticated initially
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');

      // Click refresh
      await user.click(screen.getByTestId('refresh-button'));

      // Should show refreshing state
      expect(screen.getByTestId('refresh-button')).toHaveTextContent('Refreshing...');

      // Should remain authenticated after refresh
      await waitFor(() => {
        expect(screen.getByTestId('refresh-button')).toHaveTextContent('Refresh Token');
      });

      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(localStorage.getItem('authToken')).toBeTruthy();
      expect(localStorage.getItem('authToken')).toContain('refreshed-token');
    });

    it('should handle invalid token during refresh', async () => {
      localStorage.setItem('authToken', 'invalid-token');

      const { user } = renderWithAuth(
        <div>
          <TokenRefreshComponent />
          <AuthStatusComponent />
        </div>,
      );

      // Click refresh with invalid token
      await user.click(screen.getByTestId('refresh-button'));

      await waitFor(() => {
        expect(screen.getByTestId('refresh-error')).toBeInTheDocument();
      });

      // Should logout user and show error
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('refresh-error')).toHaveTextContent(/unauthorized/i);
    });
  });

  describe('Session Management', () => {
    it('should handle expired session tokens', async () => {
      // Create an expired session
      const expiredDate = new Date(Date.now() - 3600000); // 1 hour ago

      const { rerender } = renderWithAuth(<AuthStatusComponent />, 'user', {
        initialAppState: {
          session: {
            id: 'session-123',
            isAuthenticated: true,
            expiresAt: expiredDate,
          },
        },
      });

      // Should detect expired session
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });

    it('should maintain session state across component re-renders', () => {
      const { rerender } = renderWithAuth(<AuthStatusComponent />);

      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');

      // Re-render component
      rerender(<AuthStatusComponent />);

      // Should maintain authentication state
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent('test@medianest.com');
    });
  });

  describe('Authentication Error Boundaries', () => {
    it('should handle authentication failures gracefully', async () => {
      // Mock all auth endpoints to fail
      mswServer.use(
        http.post('/api/auth/login', () => {
          return HttpResponse.json({ message: 'Service temporarily unavailable' }, { status: 503 });
        }),
      );

      const { user } = renderWithoutAuth(<LoginFormComponent />);

      await user.type(screen.getByTestId('email-input'), 'test@medianest.com');
      await user.type(screen.getByTestId('password-input'), 'password123');
      await user.click(screen.getByTestId('login-button'));

      await waitFor(() => {
        expect(screen.getByTestId('login-error')).toHaveTextContent(
          'Service temporarily unavailable',
        );
      });

      // Should allow retry
      expect(screen.getByTestId('login-button')).not.toBeDisabled();
    });

    it('should handle concurrent authentication state changes', async () => {
      const { user } = renderWithoutAuth(
        <div>
          <LoginFormComponent />
          <AuthStatusComponent />
        </div>,
      );

      // Start login process
      await user.type(screen.getByTestId('email-input'), 'test@medianest.com');
      await user.type(screen.getByTestId('password-input'), 'password123');
      await user.click(screen.getByTestId('login-button'));

      // Should handle rapid state changes correctly
      await waitFor(
        () => {
          expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
        },
        { timeout: 3000 },
      );
    });
  });
});
