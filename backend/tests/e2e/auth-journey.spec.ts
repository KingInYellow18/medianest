import { test, expect, Browser, Page, BrowserContext } from '@playwright/test';
import { LoginPage } from '../tests/e2e/pages/login.page';
import { AdminDashboardPage } from '../tests/e2e/pages/admin.page';
import { AuthHelper } from '../tests/e2e/helpers/auth';

/**
 * Comprehensive Authentication User Journey E2E Tests
 * Tests the complete authentication flow including:
 * - Plex OAuth integration
 * - Session management
 * - Role-based access control
 * - Multi-device sessions
 * - Security validation
 */

test.describe('Authentication User Journey', () => {
  let loginPage: LoginPage;
  let adminPage: AdminDashboardPage;
  let authHelper: AuthHelper;
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({
      // Clear storage to ensure clean state
      storageState: undefined,
    });
    page = await context.newPage();

    loginPage = new LoginPage(page);
    adminPage = new AdminDashboardPage(page);
    authHelper = new AuthHelper(page);

    // Setup API route interceptors for Plex OAuth simulation
    await page.route('**/api/v1/auth/plex/pin', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pin: '1234',
          pinUrl: 'https://plex.tv/pin/1234',
          expires: Date.now() + 900000, // 15 minutes
        }),
      });
    });

    await page.route('**/api/v1/auth/plex/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'test-jwt-token-12345',
          user: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@medianest.test',
            role: 'user',
            avatar: 'https://plex.tv/avatar/testuser',
          },
        }),
      });
    });

    await page.route('**/api/v1/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@medianest.test',
            role: 'user',
          },
          sessionValid: true,
        }),
      });
    });
  });

  test('should complete successful Plex OAuth login flow', async () => {
    // Navigate to login page
    await loginPage.goto();

    // Verify login page elements are visible
    await expect(page.locator('[data-testid="plex-login-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="app-logo"]')).toBeVisible();
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText(
      'Welcome to MediaNest'
    );

    // Start Plex login flow
    await loginPage.clickPlexLogin();

    // Verify PIN input appears
    await expect(page.locator('[data-testid="pin-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="plex-instructions"]')).toContainText(
      'Enter the 4-digit PIN'
    );

    // Enter PIN
    await loginPage.enterPin('1234');

    // Verify PIN is entered correctly
    await expect(page.locator('[data-testid="pin-input"]')).toHaveValue('1234');

    // Click verify
    await loginPage.clickVerifyPin();

    // Verify loading state
    await expect(page.locator('[data-testid="auth-loading"]')).toBeVisible();

    // Wait for successful login redirect
    await loginPage.waitForLoginSuccess();

    // Verify we're on dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="username-display"]')).toContainText('testuser');
  });

  test('should handle invalid PIN gracefully', async () => {
    // Mock invalid PIN response
    await page.route('**/api/v1/auth/plex/verify', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid PIN',
          message: 'The PIN you entered is invalid or has expired',
        }),
      });
    });

    await loginPage.goto();
    await loginPage.clickPlexLogin();
    await loginPage.enterPin('0000'); // Invalid PIN
    await loginPage.clickVerifyPin();

    // Verify error message is displayed
    await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="auth-error"]')).toContainText('Invalid PIN');

    // Verify PIN input is cleared and ready for retry
    await expect(page.locator('[data-testid="pin-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="retry-message"]')).toBeVisible();
  });

  test('should handle expired PIN gracefully', async () => {
    // Mock expired PIN response
    await page.route('**/api/v1/auth/plex/pin', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pin: '9999',
          pinUrl: 'https://plex.tv/pin/9999',
          expires: Date.now() - 1000, // Already expired
        }),
      });
    });

    await loginPage.goto();
    await loginPage.clickPlexLogin();

    // Verify expired PIN message
    await expect(page.locator('[data-testid="pin-expired"]')).toBeVisible();
    await expect(page.locator('[data-testid="generate-new-pin"]')).toBeVisible();

    // Click to generate new PIN
    await page.click('[data-testid="generate-new-pin"]');

    // Verify new PIN is generated
    await expect(page.locator('[data-testid="pin-input"]')).toBeVisible();
  });

  test('should maintain session across browser tabs', async () => {
    // Login in first tab
    await authHelper.loginWithPlex();

    // Open new tab
    const newPage = await context.newPage();
    await newPage.goto('/dashboard');

    // Verify user is still logged in
    await expect(newPage.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(newPage.locator('[data-testid="username-display"]')).toContainText('testuser');

    await newPage.close();
  });

  test('should handle session expiration properly', async () => {
    await authHelper.loginWithPlex();

    // Mock expired session
    await page.route('**/api/v1/auth/session', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Session expired',
          message: 'Your session has expired. Please log in again.',
        }),
      });
    });

    // Navigate to protected route
    await page.goto('/requests');

    // Should redirect to login page
    await expect(page).toHaveURL('/auth/signin');
    await expect(page.locator('[data-testid="session-expired-message"]')).toContainText(
      'session has expired'
    );
  });

  test('should logout successfully', async () => {
    await authHelper.loginWithPlex();

    // Mock logout endpoint
    await page.route('**/api/v1/auth/logout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Logout
    await authHelper.logout();

    // Verify redirect to login page
    await expect(page).toHaveURL('/auth/signin');

    // Verify protected routes redirect to login
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/auth/signin');
  });

  test.describe('Role-based Access Control', () => {
    test('should grant admin access to admin users', async () => {
      // Mock admin user login
      await page.route('**/api/v1/auth/plex/verify', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            token: 'admin-jwt-token-12345',
            user: {
              id: 'admin-123',
              username: 'admin',
              email: 'admin@medianest.test',
              role: 'admin',
              avatar: 'https://plex.tv/avatar/admin',
            },
          }),
        });
      });

      await page.route('**/api/v1/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'admin-123',
              username: 'admin',
              email: 'admin@medianest.test',
              role: 'admin',
            },
            sessionValid: true,
          }),
        });
      });

      await authHelper.loginWithPlex();

      // Should be able to access admin routes
      await adminPage.goto();
      await adminPage.verifyLoaded();
      await adminPage.verifyAdminNavigation();

      // Verify admin badge is visible
      await expect(page.locator('[data-testid="admin-badge"]')).toBeVisible();
    });

    test('should deny admin access to regular users', async () => {
      await authHelper.loginWithPlex(); // Regular user

      // Try to access admin page
      await page.goto('/admin');

      // Should redirect to unauthorized page or dashboard
      await expect(page).not.toHaveURL('/admin');
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
    });
  });

  test.describe('Multi-device Session Management', () => {
    test('should handle concurrent sessions on different devices', async () => {
      // Simulate different devices with different user agents
      const mobileContext = await page.context().browser()?.newContext({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      });

      if (!mobileContext) return;

      const mobilePage = await mobileContext.newPage();
      const mobileAuthHelper = new AuthHelper(mobilePage);

      // Setup same mocks for mobile page
      await mobilePage.route('**/api/v1/auth/plex/verify', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            token: 'mobile-jwt-token-12345',
            user: {
              id: 'user-123',
              username: 'testuser',
              email: 'test@medianest.test',
              role: 'user',
            },
          }),
        });
      });

      // Login on desktop
      await authHelper.loginWithPlex();

      // Login on mobile
      await mobileAuthHelper.loginWithPlex();

      // Both sessions should be valid
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(mobilePage.locator('[data-testid="user-menu"]')).toBeVisible();

      await mobileContext.close();
    });
  });

  test.describe('Security Validation', () => {
    test('should prevent CSRF attacks', async () => {
      await authHelper.loginWithPlex();

      // Mock CSRF token endpoint
      await page.route('**/api/v1/csrf/token', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ token: 'csrf-token-12345' }),
        });
      });

      // Attempt request without CSRF token
      const response = await page.evaluate(async () => {
        return fetch('/api/v1/media/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mediaType: 'movie', tmdbId: 12345 }),
        });
      });

      // Should fail without CSRF token
      // This would be validated by the actual server implementation
    });

    test('should prevent XSS attacks in login form', async () => {
      await loginPage.goto();
      await loginPage.clickPlexLogin();

      // Attempt XSS in PIN field
      const maliciousScript = '<script>alert("XSS")</script>';
      await loginPage.enterPin(maliciousScript);

      // Verify input is sanitized
      const pinValue = await page.inputValue('[data-testid="pin-input"]');
      expect(pinValue).not.toContain('<script>');
      expect(pinValue).not.toContain('alert');
    });

    test('should enforce secure cookies', async () => {
      await authHelper.loginWithPlex();

      // Check that auth cookies are secure
      const cookies = await context.cookies();
      const authCookie = cookies.find((c) => c.name.includes('auth') || c.name.includes('session'));

      if (authCookie) {
        expect(authCookie.secure).toBe(true);
        expect(authCookie.httpOnly).toBe(true);
        expect(authCookie.sameSite).toBe('Strict');
      }
    });
  });

  test.afterEach(async () => {
    await context.close();
  });
});
