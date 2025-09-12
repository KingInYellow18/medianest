import { test as base, expect } from '@playwright/test';

import { testUsers } from './users.fixture';
import { DashboardPage } from '../pages/dashboard.page';
import { LoginPage } from '../pages/login.page';
import { apiHelpers } from '../utils/api-helpers';

// Extend basic test with authentication fixtures
export const test = base.extend<{
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  authenticatedUser: any;
  adminUser: any;
  regularUser: any;
}>({
  // Login page fixture
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  // Dashboard page fixture
  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },

  // Authenticated regular user fixture
  authenticatedUser: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    // Login with regular user
    const user = testUsers.regularUser;
    await loginPage.loginAndWaitForDashboard(user.email, user.password);

    // Verify authentication
    await expect(page).toHaveURL(/\/dashboard/);

    await use(user);

    // Cleanup - logout
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.logout().catch(() => {
      // Ignore logout errors in cleanup
    });
  },

  // Authenticated admin user fixture
  adminUser: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    // Login with admin user
    const user = testUsers.adminUser;
    await loginPage.loginAndWaitForDashboard(user.email, user.password);

    // Verify authentication and admin access
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify admin privileges by checking admin panel access
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);

    await use(user);

    // Cleanup - logout
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.logout().catch(() => {
      // Ignore logout errors in cleanup
    });
  },

  // Regular user fixture without auto-login
  regularUser: async ({}, use) => {
    await use(testUsers.regularUser);
  },
});

// Authentication helpers
export class AuthFixture {
  /**
   * Login with specific user credentials
   */
  static async loginAs(page: any, userType: 'admin' | 'regular' | 'editor'): Promise<any> {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    let user;
    switch (userType) {
      case 'admin':
        user = testUsers.adminUser;
        break;
      case 'editor':
        user = testUsers.editorUser;
        break;
      case 'regular':
      default:
        user = testUsers.regularUser;
        break;
    }

    await loginPage.loginAndWaitForDashboard(user.email, user.password);
    return user;
  }

  /**
   * Create a new test user via API
   */
  static async createTestUser(userData: {
    name: string;
    email: string;
    password: string;
    role?: 'user' | 'admin' | 'editor';
  }): Promise<any> {
    try {
      const response = await apiHelpers.post('/api/auth/register', {
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role || 'user',
      });

      if (!response.success) {
        throw new Error(`Failed to create user: ${response.error}`);
      }

      return response.data.user;
    } catch (error) {
      console.error('Failed to create test user:', error);
      throw error;
    }
  }

  /**
   * Delete test user via API
   */
  static async deleteTestUser(email: string): Promise<void> {
    try {
      await apiHelpers.delete(`/api/users/${email}`);
    } catch (error) {
      console.error('Failed to delete test user:', error);
      // Don't throw, as this is cleanup
    }
  }

  /**
   * Login via API and get session token
   */
  static async loginViaAPI(email: string, password: string): Promise<string> {
    try {
      const response = await apiHelpers.post('/api/auth/login', {
        email,
        password,
      });

      if (!response.success) {
        throw new Error(`API login failed: ${response.error}`);
      }

      return response.data.token;
    } catch (error) {
      console.error('API login failed:', error);
      throw error;
    }
  }

  /**
   * Set authentication cookie in browser
   */
  static async setAuthCookie(page: any, token: string): Promise<void> {
    await page.context().addCookies([
      {
        name: 'auth-token',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
      },
    ]);
  }

  /**
   * Login via API and set cookie (faster than UI login)
   */
  static async loginViaAPIAndSetCookie(page: any, email: string, password: string): Promise<void> {
    const token = await this.loginViaAPI(email, password);
    await this.setAuthCookie(page, token);

    // Navigate to dashboard to verify authentication
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  }

  /**
   * Logout via API
   */
  static async logoutViaAPI(token: string): Promise<void> {
    try {
      await apiHelpers.post(
        '/api/auth/logout',
        {},
        {
          Authorization: `Bearer ${token}`,
        },
      );
    } catch (error) {
      console.error('API logout failed:', error);
      // Don't throw, as this is cleanup
    }
  }

  /**
   * Clear authentication cookies
   */
  static async clearAuthCookies(page: any): Promise<void> {
    await page.context().clearCookies();
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated(page: any): Promise<boolean> {
    try {
      // Navigate to a protected route
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // If we're on dashboard, user is authenticated
      return page.url().includes('/dashboard');
    } catch {
      return false;
    }
  }

  /**
   * Get current user info via API
   */
  static async getCurrentUser(token: string): Promise<any> {
    try {
      const response = await apiHelpers.get('/api/auth/me', {
        Authorization: `Bearer ${token}`,
      });

      if (!response.success) {
        throw new Error(`Failed to get user info: ${response.error}`);
      }

      return response.data.user;
    } catch (error) {
      console.error('Failed to get current user:', error);
      throw error;
    }
  }

  /**
   * Setup test user with specific permissions
   */
  static async setupTestUserWithPermissions(permissions: string[]): Promise<any> {
    const testUser = {
      name: `Test User ${Date.now()}`,
      email: `testuser${Date.now()}@example.com`,
      password: 'TestPassword123!',
    };

    // Create user
    const user = await this.createTestUser(testUser);

    // Set permissions via API (if your app supports this)
    try {
      await apiHelpers.post(`/api/users/${user.id}/permissions`, {
        permissions,
      });
    } catch (error) {
      console.warn('Failed to set user permissions:', error);
    }

    return { ...user, password: testUser.password };
  }

  /**
   * Wait for authentication state to change
   */
  static async waitForAuthStateChange(
    page: any,
    expectedState: 'authenticated' | 'unauthenticated',
    timeout = 10000,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const isAuth = await this.isAuthenticated(page);

      if (
        (expectedState === 'authenticated' && isAuth) ||
        (expectedState === 'unauthenticated' && !isAuth)
      ) {
        return;
      }

      await page.waitForTimeout(500);
    }

    throw new Error(`Authentication state did not change to ${expectedState} within ${timeout}ms`);
  }
}

// Export the extended test as default
export { expect } from '@playwright/test';
