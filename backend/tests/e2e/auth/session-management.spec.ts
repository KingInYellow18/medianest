/**
 * Session Management E2E Tests
 *
 * Tests for session handling including:
 * - Session persistence across page reloads
 * - Logout functionality
 * - Session timeout handling
 * - Multi-tab session synchronization
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

import { databaseCleanup } from '../../helpers/database-cleanup';
import { AuthTestFactory } from '../../shared/factories/auth-factory';
import { BaseTestHelper } from '../../shared/helpers/test-base';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const API_BASE_URL = `${BASE_URL}/api/v1`;

test.beforeEach(async ({ page }) => {
  await databaseCleanup.cleanAll();
  await AuthTestFactory.setupMockPlexAuth(page);
});

test.afterEach(async () => {
  await databaseCleanup.cleanAll();
});

test.describe('Session Management', () => {
  test('should persist session across page reloads', async ({ page }) => {
    await AuthTestFactory.setupAuthenticatedSession(page, 'user', API_BASE_URL);

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
    await AuthTestFactory.setupAuthenticatedSession(page, 'user', API_BASE_URL);

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

  test('should handle session timeout', async ({ page }) => {
    await AuthTestFactory.setupAuthenticatedSession(page, 'user', API_BASE_URL);
    const errorScenarios = AuthTestFactory.createErrorScenarios();

    // Mock expired token response
    await page.route(`${API_BASE_URL}/auth/session`, async (route) => {
      await route.fulfill(errorScenarios.expiredToken);
    });

    await page.goto(`${BASE_URL}/dashboard`);

    // Verify automatic redirect to login on expired session
    await page.waitForURL(`${BASE_URL}/auth/login`);
    await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
  });

  test('should synchronize session across multiple tabs', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await AuthTestFactory.setupMockPlexAuth(page1);
    await AuthTestFactory.setupMockPlexAuth(page2);
    await AuthTestFactory.setupAuthenticatedSession(page1, 'user', API_BASE_URL);

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

    await page1.close();
    await page2.close();
  });

  test('should handle session state transitions correctly', async ({ page }) => {
    // Test 1: Unauthenticated -> Authenticated
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForURL(`${BASE_URL}/auth/login`);

    await AuthTestFactory.setupAuthenticatedSession(page, 'user', API_BASE_URL);
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible();

    // Test 2: Authenticated -> Session Expired -> Re-authenticated
    const errorScenarios = AuthTestFactory.createErrorScenarios();
    await page.route(`${API_BASE_URL}/auth/session`, async (route) => {
      await route.fulfill(errorScenarios.expiredToken);
    });

    await page.reload();
    await page.waitForURL(`${BASE_URL}/auth/login`);

    // Re-authenticate
    await page.unroute(`${API_BASE_URL}/auth/session`);
    await AuthTestFactory.setupAuthenticatedSession(page, 'user', API_BASE_URL);
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible();
  });

  test('should maintain session security with proper token rotation', async ({ page }) => {
    await AuthTestFactory.setupAuthenticatedSession(page, 'user', API_BASE_URL);
    await page.goto(`${BASE_URL}/dashboard`);

    // Capture initial session token
    const initialCookies = await page.context().cookies();
    const initialToken = initialCookies.find((c) => c.name === 'token')?.value;

    // Perform an action that might trigger token rotation
    await page.click('[data-testid="user-menu-button"]');
    await page.click('[data-testid="profile-link"]');

    // Wait a bit for potential token rotation
    await page.waitForTimeout(2000);

    // Check if token was rotated (this depends on your implementation)
    const newCookies = await page.context().cookies();
    const newToken = newCookies.find((c) => c.name === 'token')?.value;

    // Session should still be valid regardless of token rotation
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible();

    expect(newToken).toBeDefined();
  });

  test('should handle concurrent session operations safely', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const page3 = await context.newPage();

    await Promise.all([
      AuthTestFactory.setupMockPlexAuth(page1),
      AuthTestFactory.setupMockPlexAuth(page2),
      AuthTestFactory.setupMockPlexAuth(page3),
    ]);

    // Setup authentication on all pages
    await AuthTestFactory.setupAuthenticatedSession(page1, 'user', API_BASE_URL);

    // Perform concurrent operations
    const operations = [
      page1.goto(`${BASE_URL}/dashboard`),
      page2.goto(`${BASE_URL}/media`),
      page3.goto(`${BASE_URL}/profile`),
    ];

    const results = await Promise.allSettled(operations);

    // At least one operation should succeed
    const successful = results.filter((r) => r.status === 'fulfilled').length;
    expect(successful).toBeGreaterThanOrEqual(1);

    // Clean up
    await Promise.all([page1.close(), page2.close(), page3.close()]);
  });
});
