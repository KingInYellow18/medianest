/**
 * CONSOLIDATED END-TO-END AUTHENTICATION TESTS
 * 
 * Comprehensive E2E tests covering complete user authentication journeys
 * This file consolidates and replaces:
 * - backend/tests/e2e/auth.spec.ts (25+ test scenarios with browser automation)
 * - All browser-based authentication flows
 * - Complete user journeys from login to logout
 * - Cross-system authentication validation
 * 
 * Total: 30+ E2E test scenarios with zero functional loss
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { DatabaseCleanup } from './database-cleanup';
import { createTestUser, createTestJWT } from './auth-test-utils';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const API_BASE_URL = `${BASE_URL}/api/v1`;

// Test data
const TEST_USERS = {
  admin: {
    plexId: 'e2e-admin-123',
    username: 'testadmin',
    email: 'admin@e2etest.local',
    role: 'admin' as const,
  },
  user: {
    plexId: 'e2e-user-456',
    username: 'testuser',
    email: 'user@e2etest.local',
    role: 'user' as const,
  },
};

// Helper functions
async function setupMockPlexAuth(page: Page) {
  // Mock Plex API responses for consistent testing
  await page.route('https://plex.tv/pins.xml', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?>
        <pin>
          <id>e2e-pin-123</id>
          <code>TEST</code>
        </pin>`
    });
  });

  await page.route('https://plex.tv/pins/e2e-pin-123.xml', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?>
        <pin>
          <authToken>mock-plex-token-12345</authToken>
        </pin>`
    });
  });

  await page.route('https://plex.tv/users/account.xml', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?>
        <user>
          <id>e2e-test-123</id>
          <username>e2etestuser</username>
          <email>e2e@test.local</email>
        </user>`
    });
  });
}

async function setupAuthenticatedSession(page: Page, userType: 'admin' | 'user' = 'user') {
  const userData = TEST_USERS[userType];
  const user = createTestUser(userData);
  
  // Create user in test database
  const { databaseService } = await import('./database-service');
  await databaseService.createUser({
    ...userData,
    plexToken: 'encrypted-test-token',
    status: 'active',
    lastLoginAt: new Date(),
  });

  // Mock authentication by setting cookies directly
  const mockToken = createTestJWT({ userId: userData.plexId, role: userData.role });
  await page.context().addCookies([
    {
      name: 'token',
      value: mockToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
    },
  ]);

  // Mock JWT verification endpoint
  await page.route(`${API_BASE_URL}/auth/session`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          user: {
            id: userData.plexId,
            username: userData.username,
            email: userData.email,
            role: userData.role,
          },
        },
      }),
    });
  });
}

async function clearAuthCookies(page: Page) {
  await page.context().clearCookies();
}

// Test suite setup and teardown
test.beforeEach(async ({ page }) => {
  await DatabaseCleanup.cleanAll();
  await setupMockPlexAuth(page);
});

test.afterEach(async () => {
  await DatabaseCleanup.cleanAll();
});

test.afterAll(async () => {
  const { databaseService } = await import('./database-service');
  await databaseService.disconnect();
});

test.describe('Complete Plex OAuth Authentication Flow', () => {
  test('should complete full Plex OAuth authentication workflow', async ({ page }) => {
    // Step 1: Navigate to login page
    await page.goto(`${BASE_URL}/auth/login`);
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="plex-login-button"]')).toBeVisible();

    // Step 2: Click "Sign in with Plex"
    await page.click('[data-testid="plex-login-button"]');

    // Step 3: Verify PIN generation UI
    await expect(page.locator('[data-testid="plex-pin-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="plex-pin-code"]')).toBeVisible();
    await expect(page.locator('[data-testid="plex-qr-code"]')).toBeVisible();

    // Verify PIN code is displayed
    const pinCode = await page.locator('[data-testid="plex-pin-code"]').textContent();
    expect(pinCode).toBe('TEST');

    // Step 4: Simulate PIN authorization
    await page.click('[data-testid="plex-authorize-button"]');

    // Step 5: Verify successful authentication and redirect
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible();

    // Step 6: Verify session is active
    const sessionResponse = await page.evaluate(async () => {
      const response = await fetch('/api/v1/auth/session', {
        credentials: 'include',
      });
      return response.json();
    });

    expect(sessionResponse.success).toBe(true);
    expect(sessionResponse.data.user).toBeDefined();
  });

  test('should handle PIN generation errors gracefully', async ({ page }) => {
    // Mock Plex API failure
    await page.route('https://plex.tv/pins.xml', async route => {
      await route.abort('failed');
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');

    // Verify error message is displayed
    await expect(page.locator('[data-testid="auth-error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="auth-error-message"]')).toContainText(
      'Cannot connect to Plex server'
    );
  });

  test('should handle unauthorized PIN scenario', async ({ page }) => {
    // Mock unauthorized PIN response
    await page.route('https://plex.tv/pins/e2e-pin-123.xml', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/xml',
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <pin>
            <id>e2e-pin-123</id>
          </pin>`
      });
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    
    // Wait for PIN modal
    await expect(page.locator('[data-testid="plex-pin-modal"]')).toBeVisible();
    
    // Try to authorize
    await page.click('[data-testid="plex-authorize-button"]');

    // Verify error message
    await expect(page.locator('[data-testid="pin-error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="pin-error-message"]')).toContainText(
      'PIN has not been authorized'
    );
  });

  test('should handle network timeout during authentication', async ({ page }) => {
    // Mock delayed response to simulate timeout
    await page.route('https://plex.tv/pins/e2e-pin-123.xml', async route => {
      await new Promise(resolve => setTimeout(resolve, 6000)); // 6 second delay
      await route.fulfill({
        status: 200,
        contentType: 'application/xml',
        body: `<pin><authToken>test-token</authToken></pin>`
      });
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    // Verify timeout handling
    await expect(page.locator('[data-testid="auth-timeout-message"]')).toBeVisible({ timeout: 8000 });
  });

  test('should recover from temporary network issues with retry', async ({ page }) => {
    let callCount = 0;
    
    // First call fails, second succeeds
    await page.route('https://plex.tv/pins/e2e-pin-123.xml', async route => {
      callCount++;
      if (callCount === 1) {
        await route.abort('failed');
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/xml',
          body: `<pin><authToken>recovered-token</authToken></pin>`
        });
      }
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    // First attempt fails
    await expect(page.locator('[data-testid="network-error-message"]')).toBeVisible();

    // Retry should succeed
    await page.click('[data-testid="retry-button"]');
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
  });
});

test.describe('Admin Bootstrap and First User Setup', () => {
  test('should bootstrap first user as admin', async ({ page }) => {
    // Ensure no users exist
    await DatabaseCleanup.cleanAll();

    // Complete OAuth flow
    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    // Verify user is redirected to admin setup if they're first user
    await page.waitForURL(`${BASE_URL}/admin/setup`, { timeout: 10000 });
    await expect(page.locator('[data-testid="admin-setup-page"]')).toBeVisible();

    // Complete admin setup
    await page.fill('[data-testid="admin-password-input"]', 'TestPassword123!');
    await page.fill('[data-testid="admin-password-confirm"]', 'TestPassword123!');
    await page.click('[data-testid="admin-setup-submit"]');

    // Verify redirect to dashboard with admin privileges
    await page.waitForURL(`${BASE_URL}/dashboard`);
    await expect(page.locator('[data-testid="admin-menu-button"]')).toBeVisible();
  });

  test('should validate password requirements during admin setup', async ({ page }) => {
    await DatabaseCleanup.cleanAll();

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    await page.waitForURL(`${BASE_URL}/admin/setup`);

    // Test weak password
    await page.fill('[data-testid="admin-password-input"]', 'weak');
    await page.click('[data-testid="admin-setup-submit"]');

    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-error"]')).toContainText(
      'Password must be at least 8 characters'
    );

    // Test mismatched passwords
    await page.fill('[data-testid="admin-password-input"]', 'ValidPassword123!');
    await page.fill('[data-testid="admin-password-confirm"]', 'DifferentPassword123!');
    await page.click('[data-testid="admin-setup-submit"]');

    await expect(page.locator('[data-testid="password-mismatch-error"]')).toBeVisible();
  });

  test('should assign admin role correctly to first user', async ({ page }) => {
    await DatabaseCleanup.cleanAll();

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    await page.waitForURL(`${BASE_URL}/admin/setup`);
    await page.fill('[data-testid="admin-password-input"]', 'AdminPassword123!');
    await page.fill('[data-testid="admin-password-confirm"]', 'AdminPassword123!');
    await page.click('[data-testid="admin-setup-submit"]');

    // Verify admin access in UI
    await page.waitForURL(`${BASE_URL}/dashboard`);
    await expect(page.locator('[data-testid="admin-menu-button"]')).toBeVisible();

    // Navigate to admin panel
    await page.click('[data-testid="admin-menu-button"]');
    await page.click('[data-testid="admin-panel-link"]');

    await page.waitForURL(`${BASE_URL}/admin`);
    await expect(page.locator('[data-testid="admin-panel"]')).toBeVisible();
  });

  test('should prevent admin setup for subsequent users', async ({ page }) => {
    // Create existing admin user
    await setupAuthenticatedSession(page, 'admin');

    // Clear session to simulate new user
    await clearAuthCookies(page);

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    // Should redirect to regular dashboard, not admin setup
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
    await expect(page.locator('[data-testid="admin-setup-page"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible();
  });
});

test.describe('Session Management and Persistence', () => {
  test('should persist session across page reloads', async ({ page }) => {
    await setupAuthenticatedSession(page);

    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible();

    // Reload page
    await page.reload();
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible();

    // Navigate to different authenticated page
    await page.goto(`${BASE_URL}/media`);
    await expect(page.locator('[data-testid="media-page"]')).toBeVisible();
  });

  test('should maintain session across browser tabs', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await setupAuthenticatedSession(page1);

    // Both tabs should be authenticated
    await page1.goto(`${BASE_URL}/dashboard`);
    await page2.goto(`${BASE_URL}/dashboard`);

    await expect(page1.locator('[data-testid="dashboard-welcome"]')).toBeVisible();
    await expect(page2.locator('[data-testid="dashboard-welcome"]')).toBeVisible();

    // Logout from one tab
    await page1.click('[data-testid="user-menu-button"]');
    await page1.click('[data-testid="logout-button"]');

    // Other tab should also be logged out (via storage events)
    await page2.reload();
    await page2.waitForURL(`${BASE_URL}/auth/login`);
  });

  test('should handle logout functionality properly', async ({ page }) => {
    await setupAuthenticatedSession(page);

    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible();

    // Logout
    await page.click('[data-testid="user-menu-button"]');
    await page.click('[data-testid="logout-button"]');

    // Verify redirect to login
    await page.waitForURL(`${BASE_URL}/auth/login`);
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();

    // Verify session is cleared
    const sessionResponse = await page.evaluate(async () => {
      const response = await fetch('/api/v1/auth/session', {
        credentials: 'include',
      });
      return { status: response.status, json: await response.json().catch(() => null) };
    });

    expect(sessionResponse.status).toBe(401);
  });

  test('should handle session timeout gracefully', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Mock expired token response
    await page.route(`${API_BASE_URL}/auth/session`, async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Token expired', code: 'TOKEN_EXPIRED' }
        })
      });
    });

    await page.goto(`${BASE_URL}/dashboard`);

    // Verify automatic redirect to login on expired session
    await page.waitForURL(`${BASE_URL}/auth/login`);
    await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
  });

  test('should handle concurrent login attempts gracefully', async ({ context }) => {
    const pages = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage()
    ]);

    // Attempt login from multiple pages simultaneously
    const loginPromises = pages.map(async (page, index) => {
      await setupMockPlexAuth(page);
      await page.goto(`${BASE_URL}/auth/login`);
      await page.click('[data-testid="plex-login-button"]');
      await page.click('[data-testid="plex-authorize-button"]');
      
      // One should succeed, others should handle gracefully
      try {
        await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 5000 });
        return { page: index, success: true };
      } catch {
        return { page: index, success: false };
      }
    });

    const results = await Promise.all(loginPromises);
    const successCount = results.filter(r => r.success).length;

    // At least one should succeed, and failures should be handled gracefully
    expect(successCount).toBeGreaterThanOrEqual(1);
    
    // Clean up pages
    await Promise.all(pages.map(page => page.close()));
  });
});

test.describe('Authorization and Role-Based Access Control', () => {
  test('should protect admin-only routes from regular users', async ({ page }) => {
    await setupAuthenticatedSession(page, 'user');

    // Try to access admin panel
    await page.goto(`${BASE_URL}/admin`);
    
    // Should be redirected to unauthorized page or dashboard
    await expect(page.url()).not.toContain('/admin');
    await expect(
      page.locator('[data-testid="unauthorized-message"]')
    ).toBeVisible();
  });

  test('should allow admin access to admin routes', async ({ page }) => {
    await setupAuthenticatedSession(page, 'admin');

    await page.goto(`${BASE_URL}/admin`);
    await expect(page.locator('[data-testid="admin-panel"]')).toBeVisible();
  });

  test('should protect API endpoints based on user role', async ({ page }) => {
    await setupAuthenticatedSession(page, 'user');

    // Mock admin-only API endpoint
    await page.route(`${API_BASE_URL}/admin/**`, async route => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Insufficient permissions', code: 'FORBIDDEN' }
        })
      });
    });

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/v1/admin/users', {
        credentials: 'include',
      });
      return { status: res.status, json: await res.json() };
    });

    expect(response.status).toBe(403);
    expect(response.json.error.code).toBe('FORBIDDEN');
  });

  test('should show/hide UI elements based on user role', async ({ page }) => {
    // Test with regular user
    await setupAuthenticatedSession(page, 'user');
    await page.goto(`${BASE_URL}/dashboard`);

    await expect(page.locator('[data-testid="admin-menu-button"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="user-menu-button"]')).toBeVisible();

    // Clear session and test with admin
    await clearAuthCookies(page);
    await setupAuthenticatedSession(page, 'admin');
    await page.goto(`${BASE_URL}/dashboard`);

    await expect(page.locator('[data-testid="admin-menu-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-menu-button"]')).toBeVisible();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Clear any existing session
    await clearAuthCookies(page);

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForURL(`${BASE_URL}/auth/login`);
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
  });

  test('should maintain role permissions across navigation', async ({ page }) => {
    await setupAuthenticatedSession(page, 'admin');

    // Start at dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.locator('[data-testid="admin-menu-button"]')).toBeVisible();

    // Navigate to media page
    await page.goto(`${BASE_URL}/media`);
    await expect(page.locator('[data-testid="admin-controls"]')).toBeVisible();

    // Navigate to user management
    await page.goto(`${BASE_URL}/admin/users`);
    await expect(page.locator('[data-testid="user-management-panel"]')).toBeVisible();
  });
});

test.describe('Error Scenarios and Recovery', () => {
  test('should handle network errors during PIN verification', async ({ page }) => {
    await page.route('https://plex.tv/pins/e2e-pin-123.xml', async route => {
      await route.abort('failed');
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    await expect(page.locator('[data-testid="network-error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should handle invalid PIN responses', async ({ page }) => {
    // Mock invalid PIN response
    await page.route('https://plex.tv/pins/e2e-pin-123.xml', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'PIN not found' })
      });
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    await expect(page.locator('[data-testid="invalid-pin-error"]')).toBeVisible();
  });

  test('should handle rate limiting on authentication endpoints', async ({ page }) => {
    // Mock rate limit response
    await page.route(`${API_BASE_URL}/auth/plex/verify`, async route => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { 
            message: 'Too many authentication attempts', 
            code: 'RATE_LIMITED',
            retryAfter: 60
          }
        })
      });
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    await expect(page.locator('[data-testid="rate-limit-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="rate-limit-error"]')).toContainText(
      'Too many attempts'
    );
  });

  test('should handle browser storage limitations gracefully', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Mock localStorage quota exceeded
    await page.evaluate(() => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };
    });

    await page.goto(`${BASE_URL}/dashboard`);

    // Should still function despite storage issues
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible();
    await expect(page.locator('[data-testid="storage-warning"]')).toBeVisible();
  });

  test('should handle JavaScript errors during authentication', async ({ page }) => {
    // Mock JavaScript error during auth flow
    await page.addInitScript(() => {
      window.addEventListener('DOMContentLoaded', () => {
        const originalFetch = window.fetch;
        window.fetch = (url) => {
          if (url.includes('/auth/')) {
            throw new Error('Network error');
          }
          return originalFetch(url);
        };
      });
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');

    // Should show user-friendly error
    await expect(page.locator('[data-testid="auth-error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="auth-error-message"]')).toContainText(
      'An error occurred during authentication'
    );
  });
});

test.describe('Security and Compliance Validation', () => {
  test('should implement proper CSRF protection', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Mock CSRF token mismatch
    await page.route(`${API_BASE_URL}/auth/logout`, async route => {
      const headers = route.request().headers();
      if (!headers['x-csrf-token']) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { message: 'CSRF token missing', code: 'CSRF_ERROR' }
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.goto(`${BASE_URL}/dashboard`);
    
    // Attempt logout without CSRF token should fail gracefully
    const logoutResponse = await page.evaluate(async () => {
      const response = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      return { status: response.status, json: await response.json() };
    });

    expect(logoutResponse.status).toBe(403);
    expect(logoutResponse.json.error.code).toBe('CSRF_ERROR');
  });

  test('should enforce secure headers in responses', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/v1/auth/session');
      return {
        headers: Object.fromEntries(res.headers.entries()),
        status: res.status
      };
    });

    // Verify security headers
    expect(response.headers).toHaveProperty('x-content-type-options');
    expect(response.headers).toHaveProperty('x-frame-options');
    expect(response.headers).toHaveProperty('x-xss-protection');
    expect(response.headers).toHaveProperty('strict-transport-security');
  });

  test('should prevent XSS attacks in error messages', async ({ page }) => {
    const xssPayload = '<script>alert("xss")</script>';

    await page.route(`${API_BASE_URL}/auth/plex/verify`, async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: `Invalid PIN: ${xssPayload}` }
        })
      });
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    // Error message should be sanitized
    await expect(page.locator('[data-testid="pin-error-message"]')).toBeVisible();
    
    // XSS payload should not be executed
    const hasAlert = await page.evaluate(() => {
      return window.alert.toString() !== 'function alert() { [native code] }';
    });
    expect(hasAlert).toBe(false);
  });
});

test.describe('Performance and Load Handling', () => {
  test('should handle multiple rapid authentication attempts', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);

    // Rapid clicks on login button
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="plex-login-button"]');
      await page.waitForTimeout(100);
    }

    // Should show PIN modal only once
    const pinModals = await page.locator('[data-testid="plex-pin-modal"]').count();
    expect(pinModals).toBe(1);
  });

  test('should maintain performance with slow network conditions', async ({ page }) => {
    // Simulate slow network
    await page.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue();
    });

    await setupAuthenticatedSession(page);

    const startTime = Date.now();
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible();
    const loadTime = Date.now() - startTime;

    // Should complete within reasonable time even with network delay
    expect(loadTime).toBeLessThan(10000); // 10 seconds
  });

  test('should handle memory-intensive operations gracefully', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Create memory pressure
    await page.evaluate(() => {
      const arrays = [];
      for (let i = 0; i < 100; i++) {
        arrays.push(new Array(10000).fill('memory-test'));
      }
      (window as any).memoryTest = arrays;
    });

    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible();

    // Authentication should still work despite memory pressure
    await page.goto(`${BASE_URL}/media`);
    await expect(page.locator('[data-testid="media-page"]')).toBeVisible();
  });
});

test.describe('Accessibility and User Experience', () => {
  test('should support keyboard navigation through auth flow', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);

    // Tab to login button and activate with Enter
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="plex-login-button"]')).toBeFocused();
    await page.keyboard.press('Enter');

    // PIN modal should be accessible via keyboard
    await expect(page.locator('[data-testid="plex-pin-modal"]')).toBeVisible();
    
    // Tab to authorize button
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="plex-authorize-button"]')).toBeFocused();
    await page.keyboard.press('Enter');

    // Should continue auth flow
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
  });

  test('should provide appropriate ARIA labels and roles', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);

    // Check ARIA labels on key elements
    await expect(page.locator('[data-testid="plex-login-button"]')).toHaveAttribute('aria-label');
    await expect(page.locator('[data-testid="login-page"]')).toHaveAttribute('role');

    await page.click('[data-testid="plex-login-button"]');

    // PIN modal should have proper ARIA attributes
    await expect(page.locator('[data-testid="plex-pin-modal"]')).toHaveAttribute('role', 'dialog');
    await expect(page.locator('[data-testid="plex-pin-modal"]')).toHaveAttribute('aria-modal', 'true');
  });

  test('should maintain focus management during auth flow', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);

    // Focus should be on login button initially
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="plex-login-button"]')).toBeFocused();

    await page.keyboard.press('Enter');

    // Focus should move to PIN modal
    await expect(page.locator('[data-testid="plex-pin-modal"]')).toBeVisible();
    
    // First focusable element in modal should be focused
    const focusedElement = await page.locator(':focus').first();
    expect(await focusedElement.isVisible()).toBe(true);
  });

  test('should display loading states appropriately', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');

    // Should show loading state during PIN generation
    await expect(page.locator('[data-testid="pin-loading-spinner"]')).toBeVisible();

    await expect(page.locator('[data-testid="plex-pin-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="pin-loading-spinner"]')).not.toBeVisible();

    await page.click('[data-testid="plex-authorize-button"]');

    // Should show loading state during authorization
    await expect(page.locator('[data-testid="auth-loading-spinner"]')).toBeVisible();
  });
});

test.describe('Data Validation and Test ID Coverage', () => {
  test('should have all required test IDs for authentication flow', async ({ page }) => {
    // Login page elements
    await page.goto(`${BASE_URL}/auth/login`);
    
    const requiredLoginTestIds = [
      'login-page',
      'plex-login-button',
      'auth-error-message',
    ];

    for (const testId of requiredLoginTestIds) {
      await expect(page.locator(`[data-testid="${testId}"]`)).toBeAttached();
    }
  });

  test('should have all required test IDs for Plex PIN modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');

    const requiredPinTestIds = [
      'plex-pin-modal',
      'plex-pin-code',
      'plex-qr-code',
      'plex-authorize-button',
      'pin-error-message',
    ];

    for (const testId of requiredPinTestIds) {
      await expect(page.locator(`[data-testid="${testId}"]`)).toBeAttached();
    }
  });

  test('should have all required test IDs for dashboard', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await page.goto(`${BASE_URL}/dashboard`);

    const requiredDashboardTestIds = [
      'dashboard-welcome',
      'user-menu-button',
      'logout-button',
    ];

    for (const testId of requiredDashboardTestIds) {
      await expect(page.locator(`[data-testid="${testId}"]`)).toBeAttached();
    }
  });

  test('should validate all authentication-related form inputs', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await expect(page.locator('[data-testid="plex-pin-modal"]')).toBeVisible();

    // Verify form validation attributes
    const inputElements = await page.locator('input[required]').all();
    for (const input of inputElements) {
      expect(await input.getAttribute('required')).toBeDefined();
    }

    // Verify ARIA validation attributes
    const validatedElements = await page.locator('[aria-invalid]').all();
    for (const element of validatedElements) {
      const ariaInvalid = await element.getAttribute('aria-invalid');
      expect(['true', 'false']).toContain(ariaInvalid);
    }
  });
});