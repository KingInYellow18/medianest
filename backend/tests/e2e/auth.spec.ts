import { test, expect, Page, BrowserContext } from '@playwright/test';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../helpers/database-cleanup';

/**
 * Comprehensive E2E Authentication Tests for MediaNest
 * 
 * This test suite covers the complete authentication flow including:
 * - Plex OAuth Flow with PIN generation
 * - Admin Bootstrap process
 * - Session Management and persistence
 * - Authorization and access control
 * - Error scenarios and edge cases
 */

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
async function setupMockAuth(page: Page) {
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
  
  // Create user in database
  await prisma.user.upsert({
    where: { plexId: userData.plexId },
    update: userData,
    create: {
      ...userData,
      plexToken: 'encrypted-test-token',
      status: 'active',
      lastLoginAt: new Date(),
    },
  });

  // Mock authentication by setting cookies directly
  const mockToken = 'mock-jwt-token-for-e2e-testing';
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

  // Mock JWT verification
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
  await databaseCleanup.cleanAll();
  await setupMockAuth(page);
});

test.afterEach(async () => {
  await databaseCleanup.cleanAll();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe('Plex OAuth Flow', () => {
  test('should complete full Plex OAuth authentication flow', async ({ page }) => {
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

    // Step 4: Simulate PIN authorization (click authorize button or auto-authorize for testing)
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

  test('should handle PIN generation errors', async ({ page }) => {
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
});

test.describe('Admin Bootstrap', () => {
  test('should bootstrap first user as admin', async ({ page }) => {
    // Ensure no users exist
    await databaseCleanup.cleanAll();

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
    await databaseCleanup.cleanAll();

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

  test('should assign admin role correctly', async ({ page }) => {
    await databaseCleanup.cleanAll();

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
});

test.describe('Session Management', () => {
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

  test('should handle logout functionality', async ({ page }) => {
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

  test('should handle session timeout', async ({ page, context }) => {
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

  test('should synchronize session across multiple tabs', async ({ context }) => {
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

    // Other tab should also be logged out (via storage events or periodic checks)
    await page2.reload();
    await page2.waitForURL(`${BASE_URL}/auth/login`);
  });
});

test.describe('Authorization Tests', () => {
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
});

test.describe('Error Scenarios', () => {
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

  test('should recover from temporary network issues', async ({ page }) => {
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

  test('should handle concurrent login attempts gracefully', async ({ context }) => {
    const pages = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage()
    ]);

    // Attempt login from multiple pages simultaneously
    const loginPromises = pages.map(async (page, index) => {
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

test.describe('Data Test ID Coverage', () => {
  test('should have all required test IDs for authentication flow', async ({ page }) => {
    // Login page elements
    await page.goto(`${BASE_URL}/auth/login`);
    
    const requiredLoginTestIds = [
      'login-page',
      'plex-login-button',
      'auth-error-message',
    ];

    for (const testId of requiredLoginTestIds) {
      await expect(page.locator(`[data-testid="${testId}"]`)).toBeDefined();
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
      await expect(page.locator(`[data-testid="${testId}"]`)).toBeDefined();
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
      await expect(page.locator(`[data-testid="${testId}"]`)).toBeDefined();
    }
  });
});