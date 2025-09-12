/**
 * Plex OAuth Flow E2E Tests
 *
 * Tests for the complete Plex OAuth authentication flow including:
 * - PIN generation and display
 * - PIN authorization process
 * - Error handling for OAuth failures
 * - Network timeout scenarios
 */

import { test, expect, Page } from '@playwright/test';
import { AuthTestFactory } from '../../shared/factories/auth-factory';
import { BaseTestHelper } from '../../shared/helpers/test-base';
import { databaseCleanup } from '../../helpers/database-cleanup';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

test.beforeEach(async ({ page }) => {
  await databaseCleanup.cleanAll();
  await AuthTestFactory.setupMockPlexAuth(page);
});

test.afterEach(async () => {
  await databaseCleanup.cleanAll();
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

  test('should handle PIN generation errors', async ({ page }) => {
    // Mock Plex API failure
    await page.route('https://plex.tv/pins.xml', async (route) => {
      await route.abort('failed');
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');

    // Verify error message is displayed
    await expect(page.locator('[data-testid="auth-error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="auth-error-message"]')).toContainText(
      'Cannot connect to Plex server',
    );
  });

  test('should handle unauthorized PIN scenario', async ({ page }) => {
    const errorScenarios = AuthTestFactory.createErrorScenarios();

    // Mock unauthorized PIN response
    await page.route('https://plex.tv/pins/e2e-pin-123.xml', async (route) => {
      await route.fulfill(errorScenarios.unauthorizedPin);
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
      'PIN has not been authorized',
    );
  });

  test('should handle network timeout during authentication', async ({ page }) => {
    // Mock delayed response to simulate timeout
    await page.route('https://plex.tv/pins/e2e-pin-123.xml', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 6000)); // 6 second delay
      await route.fulfill({
        status: 200,
        contentType: 'application/xml',
        body: `<pin><authToken>test-token</authToken></pin>`,
      });
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    // Verify timeout handling
    await expect(page.locator('[data-testid="auth-timeout-message"]')).toBeVisible({
      timeout: 8000,
    });
  });

  test('should handle network errors during PIN verification', async ({ page }) => {
    await page.route('https://plex.tv/pins/e2e-pin-123.xml', async (route) => {
      await route.abort('failed');
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    await expect(page.locator('[data-testid="network-error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should handle invalid PIN responses', async ({ page }) => {
    const errorScenarios = AuthTestFactory.createErrorScenarios();

    // Mock invalid PIN response
    await page.route('https://plex.tv/pins/e2e-pin-123.xml', async (route) => {
      await route.fulfill(errorScenarios.invalidPin);
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    await expect(page.locator('[data-testid="invalid-pin-error"]')).toBeVisible();
  });

  test('should recover from temporary network issues', async ({ page }) => {
    let callCount = 0;

    // First call fails, second succeeds
    await page.route('https://plex.tv/pins/e2e-pin-123.xml', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.abort('failed');
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/xml',
          body: `<pin><authToken>recovered-token</authToken></pin>`,
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

  test('should handle rate limiting on authentication endpoints', async ({ page }) => {
    const API_BASE_URL = `${BASE_URL}/api/v1`;
    const errorScenarios = AuthTestFactory.createErrorScenarios();

    // Mock rate limit response
    await page.route(`${API_BASE_URL}/auth/plex/verify`, async (route) => {
      await route.fulfill(errorScenarios.rateLimited);
    });

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    await expect(page.locator('[data-testid="rate-limit-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="rate-limit-error"]')).toContainText(
      'Too many attempts',
    );
  });
});
