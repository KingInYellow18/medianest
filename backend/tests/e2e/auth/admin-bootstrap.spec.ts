/**
 * Admin Bootstrap E2E Tests
 *
 * Tests for the admin bootstrap process including:
 * - First user admin assignment
 * - Admin password setup and validation
 * - Admin role verification and access
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

    const passwordScenarios = AuthTestFactory.createPasswordValidationScenarios();

    for (const scenario of passwordScenarios) {
      console.log(`Testing password scenario: ${scenario.name}`);

      // Clear previous inputs
      await page.fill('[data-testid="admin-password-input"]', '');
      await page.fill('[data-testid="admin-password-confirm"]', '');

      // Fill in test data
      await page.fill('[data-testid="admin-password-input"]', scenario.password);

      if (scenario.confirm !== undefined) {
        await page.fill('[data-testid="admin-password-confirm"]', scenario.confirm);
      } else {
        await page.fill('[data-testid="admin-password-confirm"]', scenario.password);
      }

      await page.click('[data-testid="admin-setup-submit"]');

      // Check for expected error
      if (scenario.name === 'password mismatch') {
        await expect(page.locator('[data-testid="password-mismatch-error"]')).toBeVisible();
      } else {
        await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
        await expect(page.locator('[data-testid="password-error"]')).toContainText(
          scenario.expectedError,
        );
      }
    }
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

  test('should prevent non-first users from accessing admin setup', async ({ page }) => {
    // Create a user first (not via UI to simulate existing users)
    await BaseTestHelper.createTestUser('user');

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    // Should redirect to normal user dashboard, not admin setup
    await page.waitForURL(`${BASE_URL}/dashboard`);

    // Should not have admin menu
    await expect(page.locator('[data-testid="admin-menu-button"]')).not.toBeVisible();

    // Direct navigation to admin setup should be blocked
    await page.goto(`${BASE_URL}/admin/setup`);
    await expect(page.locator('[data-testid="unauthorized-message"]')).toBeVisible();
  });

  test('should handle admin setup form validation edge cases', async ({ page }) => {
    await databaseCleanup.cleanAll();

    await page.goto(`${BASE_URL}/auth/login`);
    await page.click('[data-testid="plex-login-button"]');
    await page.click('[data-testid="plex-authorize-button"]');

    await page.waitForURL(`${BASE_URL}/admin/setup`);

    // Test empty form submission
    await page.click('[data-testid="admin-setup-submit"]');
    await expect(page.locator('[data-testid="password-required-error"]')).toBeVisible();

    // Test password with only spaces
    await page.fill('[data-testid="admin-password-input"]', '        ');
    await page.fill('[data-testid="admin-password-confirm"]', '        ');
    await page.click('[data-testid="admin-setup-submit"]');
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();

    // Test extremely long password
    const longPassword = 'A'.repeat(256) + '1!';
    await page.fill('[data-testid="admin-password-input"]', longPassword);
    await page.fill('[data-testid="admin-password-confirm"]', longPassword);
    await page.click('[data-testid="admin-setup-submit"]');
    await expect(page.locator('[data-testid="password-too-long-error"]')).toBeVisible();
  });
});
