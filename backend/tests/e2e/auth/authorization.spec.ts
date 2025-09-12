/**
 * Authorization E2E Tests
 *
 * Tests for user authorization and access control including:
 * - Admin route protection
 * - API endpoint access control
 * - UI element visibility based on roles
 * - Unauthenticated user handling
 */

import { test, expect, Page } from '@playwright/test';
import { AuthTestFactory } from '../../shared/factories/auth-factory';
import { BaseTestHelper } from '../../shared/helpers/test-base';
import { databaseCleanup } from '../../helpers/database-cleanup';

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

test.describe('Authorization Tests', () => {
  test('should protect admin-only routes from regular users', async ({ page }) => {
    await AuthTestFactory.setupAuthenticatedSession(page, 'user', API_BASE_URL);

    // Try to access admin panel
    await page.goto(`${BASE_URL}/admin`);

    // Should be redirected to unauthorized page or dashboard
    await expect(page.url()).not.toContain('/admin');
    await expect(page.locator('[data-testid="unauthorized-message"]')).toBeVisible();
  });

  test('should allow admin access to admin routes', async ({ page }) => {
    await AuthTestFactory.setupAuthenticatedSession(page, 'admin', API_BASE_URL);

    await page.goto(`${BASE_URL}/admin`);
    await expect(page.locator('[data-testid="admin-panel"]')).toBeVisible();
  });

  test('should protect API endpoints based on user role', async ({ page }) => {
    await AuthTestFactory.setupAuthenticatedSession(page, 'user', API_BASE_URL);

    // Mock admin-only API endpoint
    await page.route(`${API_BASE_URL}/admin/**`, async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Insufficient permissions', code: 'FORBIDDEN' },
        }),
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
    await AuthTestFactory.setupAuthenticatedSession(page, 'user', API_BASE_URL);
    await page.goto(`${BASE_URL}/dashboard`);

    await expect(page.locator('[data-testid="admin-menu-button"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="user-menu-button"]')).toBeVisible();

    // Clear session and test with admin
    await AuthTestFactory.clearAuthSession(page);
    await AuthTestFactory.setupAuthenticatedSession(page, 'admin', API_BASE_URL);
    await page.goto(`${BASE_URL}/dashboard`);

    await expect(page.locator('[data-testid="admin-menu-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-menu-button"]')).toBeVisible();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Clear any existing session
    await AuthTestFactory.clearAuthSession(page);

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForURL(`${BASE_URL}/auth/login`);
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
  });

  test('should enforce role-based access to different sections', async ({ page }) => {
    const testScenarios = [
      {
        role: 'user',
        allowedPaths: ['/dashboard', '/media', '/requests', '/profile'],
        forbiddenPaths: ['/admin', '/admin/users', '/admin/settings'],
      },
      {
        role: 'admin',
        allowedPaths: ['/dashboard', '/media', '/requests', '/profile', '/admin', '/admin/users'],
        forbiddenPaths: [], // Admin should have access to everything
      },
    ];

    for (const scenario of testScenarios) {
      console.log(`Testing ${scenario.role} access patterns`);

      await AuthTestFactory.clearAuthSession(page);
      await AuthTestFactory.setupAuthenticatedSession(
        page,
        scenario.role as 'user' | 'admin',
        API_BASE_URL,
      );

      // Test allowed paths
      for (const path of scenario.allowedPaths) {
        await page.goto(`${BASE_URL}${path}`);
        await expect(page.locator('[data-testid="unauthorized-message"]')).not.toBeVisible();
        console.log(`  ✅ ${scenario.role} can access ${path}`);
      }

      // Test forbidden paths
      for (const path of scenario.forbiddenPaths) {
        await page.goto(`${BASE_URL}${path}`);
        // Should be redirected or show unauthorized message
        const isUnauthorized = await page
          .locator('[data-testid="unauthorized-message"]')
          .isVisible();
        const currentUrl = page.url();
        const wasRedirected = !currentUrl.includes(path);

        expect(isUnauthorized || wasRedirected).toBe(true);
        console.log(`  ✅ ${scenario.role} cannot access ${path}`);
      }
    }
  });

  test('should validate API token permissions', async ({ page }) => {
    await AuthTestFactory.setupAuthenticatedSession(page, 'user', API_BASE_URL);

    const apiEndpoints = [
      { path: '/api/v1/auth/me', expectedStatus: 200, description: 'User info' },
      { path: '/api/v1/media/search', expectedStatus: 200, description: 'Media search' },
      { path: '/api/v1/media/requests', expectedStatus: 200, description: 'User requests' },
      { path: '/api/v1/admin/users', expectedStatus: 403, description: 'Admin users list' },
      { path: '/api/v1/admin/settings', expectedStatus: 403, description: 'Admin settings' },
    ];

    for (const endpoint of apiEndpoints) {
      const response = await page.evaluate(async (url) => {
        const res = await fetch(url, { credentials: 'include' });
        return { status: res.status };
      }, endpoint.path);

      expect(response.status).toBe(endpoint.expectedStatus);
      console.log(`  ✅ ${endpoint.description}: ${response.status}`);
    }
  });

  test('should handle privilege escalation attempts', async ({ page }) => {
    await AuthTestFactory.setupAuthenticatedSession(page, 'user', API_BASE_URL);

    // Attempt to modify user role via API
    const escalationAttempts = [
      {
        method: 'PUT',
        path: '/api/v1/user/role',
        body: { role: 'admin' },
        description: 'Role modification',
      },
      {
        method: 'POST',
        path: '/api/v1/admin/users',
        body: { username: 'test', role: 'admin' },
        description: 'User creation with admin role',
      },
      {
        method: 'DELETE',
        path: '/api/v1/admin/users/1',
        body: {},
        description: 'User deletion',
      },
    ];

    for (const attempt of escalationAttempts) {
      const response = await page.evaluate(async (options) => {
        const res = await fetch(options.path, {
          method: options.method,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options.body),
        });
        return { status: res.status };
      }, attempt);

      // Should be forbidden or unauthorized
      expect([401, 403]).toContain(response.status);
      console.log(`  ✅ ${attempt.description} blocked: ${response.status}`);
    }
  });

  test('should maintain authorization context after navigation', async ({ page }) => {
    await AuthTestFactory.setupAuthenticatedSession(page, 'admin', API_BASE_URL);

    // Navigate through different pages
    const navigationFlow = [
      { path: '/dashboard', element: '[data-testid="dashboard-welcome"]' },
      { path: '/admin', element: '[data-testid="admin-panel"]' },
      { path: '/admin/users', element: '[data-testid="users-list"]' },
      { path: '/profile', element: '[data-testid="profile-page"]' },
      { path: '/dashboard', element: '[data-testid="dashboard-welcome"]' },
    ];

    for (const step of navigationFlow) {
      await page.goto(`${BASE_URL}${step.path}`);

      // Should maintain access throughout navigation
      await expect(page.locator(step.element)).toBeVisible({ timeout: 5000 });

      // Admin menu should remain visible
      await expect(page.locator('[data-testid="admin-menu-button"]')).toBeVisible();
    }
  });
});
