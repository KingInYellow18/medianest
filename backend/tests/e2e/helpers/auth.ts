/**
 * Authentication Helper for E2E Tests
 * Provides reusable authentication methods
 */

import { Page, expect } from '@playwright/test';

export class AuthHelper {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string) {
    await this.page.goto('/login');

    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect after successful login
    await this.page.waitForURL((url) => !url.pathname.includes('/login'));

    // Verify authentication token exists
    const authToken = await this.page.evaluate(() => localStorage.getItem('authToken'));
    expect(authToken).toBeTruthy();
  }

  /**
   * Login as admin user
   */
  async loginAsAdmin() {
    await this.login('admin@medianest.local', 'admin123');

    // Verify admin access
    await expect(this.page.getByTestId('admin-menu')).toBeVisible();
  }

  /**
   * Login as regular user
   */
  async loginAsUser() {
    await this.login('user@medianest.local', 'user123');

    // Verify user dashboard access
    await expect(this.page.getByTestId('user-dashboard')).toBeVisible();
  }

  /**
   * Logout current user
   */
  async logout() {
    // Check if user menu exists and click logout
    const userMenu = this.page.getByTestId('user-menu');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await this.page.getByRole('menuitem', { name: 'Logout' }).click();
    }

    // Wait for redirect to login page
    await this.page.waitForURL('**/login');

    // Verify authentication token is removed
    const authToken = await this.page.evaluate(() => localStorage.getItem('authToken'));
    expect(authToken).toBeNull();
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const authToken = await this.page.evaluate(() => localStorage.getItem('authToken'));
    return !!authToken;
  }

  /**
   * Set authentication token directly (for API setup)
   */
  async setAuthToken(token: string) {
    await this.page.evaluate((token) => {
      localStorage.setItem('authToken', token);
    }, token);
  }

  /**
   * Clear all authentication data
   */
  async clearAuth() {
    await this.page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    });

    // Clear cookies
    await this.page.context().clearCookies();
  }

  /**
   * Setup authenticated session via API (faster than UI login)
   */
  async setupAuthenticatedSession(userType: 'admin' | 'user' = 'user') {
    const credentials =
      userType === 'admin'
        ? { email: 'admin@medianest.local', password: 'admin123' }
        : { email: 'user@medianest.local', password: 'user123' };

    // Login via API
    const response = await this.page.request.post('/api/auth/login', {
      data: credentials,
    });

    if (response.ok()) {
      const { token, refreshToken, user } = await response.json();

      // Set tokens in localStorage
      await this.page.evaluate(
        ({ token, refreshToken, user }) => {
          localStorage.setItem('authToken', token);
          localStorage.setItem('refreshToken', refreshToken);
          localStorage.setItem('user', JSON.stringify(user));
        },
        { token, refreshToken, user }
      );

      return { token, refreshToken, user };
    } else {
      throw new Error(`Authentication failed: ${response.status()}`);
    }
  }

  /**
   * Verify admin permissions
   */
  async expectAdminAccess() {
    await expect(this.page.getByTestId('admin-menu')).toBeVisible();

    // Try accessing admin endpoint
    await this.page.goto('/admin/dashboard');
    await expect(this.page.getByTestId('admin-dashboard')).toBeVisible();
  }

  /**
   * Verify user permissions (no admin access)
   */
  async expectUserAccess() {
    await expect(this.page.getByTestId('user-dashboard')).toBeVisible();

    // Verify no admin menu
    await expect(this.page.getByTestId('admin-menu')).not.toBeVisible();

    // Verify admin pages are inaccessible
    await this.page.goto('/admin/dashboard');
    await expect(this.page.getByText('Access Denied')).toBeVisible();
  }

  /**
   * Handle Plex OAuth flow
   */
  async handlePlexOAuth() {
    // Wait for Plex OAuth popup or redirect
    const plexAuthButton = this.page.getByRole('button', { name: 'Connect with Plex' });
    await plexAuthButton.click();

    // Handle OAuth flow (simplified for testing)
    await this.page.waitForURL('**/auth/plex/callback**');

    // Verify Plex connection
    await expect(this.page.getByText('Plex Connected')).toBeVisible();
  }

  /**
   * Wait for authentication state change
   */
  async waitForAuthStateChange() {
    await this.page.waitForFunction(
      () => {
        const token = localStorage.getItem('authToken');
        return token !== null;
      },
      { timeout: 10000 }
    );
  }
}
