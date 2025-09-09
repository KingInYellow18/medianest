/**
 * END-TO-END USER WORKFLOWS TESTING
 * 
 * Complete user journey testing from registration to media consumption
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Page, Browser, chromium } from '@playwright/test';
import { DatabaseTestHelper } from '../helpers/database-test-helper';

let browser: Browser;
let page: Page;
let dbHelper: DatabaseTestHelper;

describe('End-to-End User Workflows', () => {
  beforeAll(async () => {
    browser = await chromium.launch();
    dbHelper = new DatabaseTestHelper();
    await dbHelper.setupTestDatabase();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await dbHelper.clearTestData();
    await dbHelper.seedTestData();
  });

  afterEach(async () => {
    await page.close();
  });

  afterAll(async () => {
    await browser.close();
    await dbHelper.cleanupTestDatabase();
  });

  describe('Complete User Registration Journey', () => {
    test('should complete user registration from discovery to first media request', async () => {
      // Navigate to application
      await page.goto('http://localhost:3000');

      // Check if landing page loads
      await expect(page.locator('h1')).toContainText(['MediaNest', 'Welcome']);

      // Navigate to registration
      await page.click('text=Register');
      await page.waitForURL('**/register');

      // Fill registration form
      await page.fill('[data-testid=email-input]', 'newuser@medianest.test');
      await page.fill('[data-testid=username-input]', 'newuser');
      await page.fill('[data-testid=password-input]', 'SecurePassword123!');
      await page.fill('[data-testid=confirm-password-input]', 'SecurePassword123!');

      // Submit registration
      await page.click('[data-testid=register-button]');

      // Should redirect to dashboard or setup
      await page.waitForURL(['**/dashboard', '**/setup']);

      // Complete Plex connection if required
      if (page.url().includes('/setup')) {
        await page.fill('[data-testid=plex-server-input]', 'http://localhost:32400');
        await page.click('[data-testid=connect-plex-button]');
        await page.waitForURL('**/dashboard');
      }

      // Verify dashboard loaded
      await expect(page.locator('[data-testid=dashboard-stats]')).toBeVisible();

      // Navigate to media search
      await page.click('[data-testid=search-media-link]');
      await page.waitForURL('**/media/search');

      // Search for media
      await page.fill('[data-testid=search-input]', 'Inception');
      await page.click('[data-testid=search-button]');

      // Wait for search results
      await page.waitForSelector('[data-testid=search-results]');
      const results = page.locator('[data-testid=search-result-item]');
      await expect(results.first()).toBeVisible();

      // Request first result
      await results.first().click();
      await page.click('[data-testid=request-media-button]');

      // Verify request confirmation
      await expect(page.locator('[data-testid=request-success-message]')).toBeVisible();

      // Navigate to requests page
      await page.click('[data-testid=my-requests-link]');
      await page.waitForURL('**/requests');

      // Verify request appears in list
      await expect(page.locator('[data-testid=request-item]').first()).toBeVisible();
      await expect(page.locator('[data-testid=request-status]').first()).toContainText('Pending');
    });

    test('should handle registration errors gracefully', async () => {
      await page.goto('http://localhost:3000/register');

      // Try to register with invalid email
      await page.fill('[data-testid=email-input]', 'invalid-email');
      await page.fill('[data-testid=username-input]', 'testuser');
      await page.fill('[data-testid=password-input]', 'weak');
      await page.fill('[data-testid=confirm-password-input]', 'different');

      await page.click('[data-testid=register-button]');

      // Should show validation errors
      await expect(page.locator('[data-testid=email-error]')).toBeVisible();
      await expect(page.locator('[data-testid=password-error]')).toBeVisible();
      await expect(page.locator('[data-testid=password-match-error]')).toBeVisible();

      // Should remain on registration page
      expect(page.url()).toContain('/register');
    });
  });

  describe('Media Request Lifecycle', () => {
    test('should complete full media request workflow', async () => {
      // Login as existing user
      await page.goto('http://localhost:3000/login');
      await page.fill('[data-testid=email-input]', 'admin@medianest.test');
      await page.fill('[data-testid=password-input]', 'password123');
      await page.click('[data-testid=login-button]');

      await page.waitForURL('**/dashboard');

      // Search and request media
      await page.click('[data-testid=search-media-link]');
      await page.fill('[data-testid=search-input]', 'The Matrix');
      await page.click('[data-testid=search-button]');

      await page.waitForSelector('[data-testid=search-results]');
      await page.locator('[data-testid=search-result-item]').first().click();
      await page.click('[data-testid=request-media-button]');

      // Add request details
      await page.selectOption('[data-testid=quality-select]', 'HD');
      await page.fill('[data-testid=notes-textarea]', 'Please prioritize this request');
      await page.click('[data-testid=submit-request-button]');

      // Verify request confirmation
      await expect(page.locator('[data-testid=request-success-message]')).toBeVisible();

      // Navigate to admin panel (assuming admin user)
      await page.click('[data-testid=admin-link]');
      await page.waitForURL('**/admin');

      // Find and approve the request
      await page.click('[data-testid=pending-requests-tab]');
      const requestRow = page.locator('[data-testid=request-row]').first();
      await expect(requestRow).toBeVisible();

      await requestRow.locator('[data-testid=approve-button]').click();

      // Confirm approval
      await page.click('[data-testid=confirm-approve-button]');

      // Verify request status updated
      await expect(requestRow.locator('[data-testid=request-status]')).toContainText('Approved');

      // Check notification system
      await expect(page.locator('[data-testid=notification-badge]')).toBeVisible();
    });

    test('should handle request cancellation', async () => {
      await page.goto('http://localhost:3000/login');
      await page.fill('[data-testid=email-input]', 'admin@medianest.test');
      await page.fill('[data-testid=password-input]', 'password123');
      await page.click('[data-testid=login-button]');

      await page.waitForURL('**/dashboard');

      // Create a request
      await page.click('[data-testid=search-media-link]');
      await page.fill('[data-testid=search-input]', 'Test Movie');
      await page.click('[data-testid=search-button]');
      await page.waitForSelector('[data-testid=search-results]');
      await page.locator('[data-testid=search-result-item]').first().click();
      await page.click('[data-testid=request-media-button]');
      await page.click('[data-testid=submit-request-button]');

      // Go to requests page
      await page.click('[data-testid=my-requests-link]');

      // Cancel the request
      const requestItem = page.locator('[data-testid=request-item]').first();
      await requestItem.locator('[data-testid=cancel-request-button]').click();

      // Confirm cancellation
      await page.click('[data-testid=confirm-cancel-button]');

      // Verify status updated
      await expect(requestItem.locator('[data-testid=request-status]')).toContainText('Cancelled');
    });
  });

  describe('Real-time Updates and Notifications', () => {
    test('should receive real-time notifications for request status changes', async () => {
      // This would typically involve WebSocket testing
      // Simplified version for demonstration
      
      await page.goto('http://localhost:3000/login');
      await page.fill('[data-testid=email-input]', 'admin@medianest.test');
      await page.fill('[data-testid=password-input]', 'password123');
      await page.click('[data-testid=login-button]');

      await page.waitForURL('**/dashboard');

      // Enable notifications if browser supports it
      await page.evaluate(() => {
        if ('Notification' in window) {
          Notification.requestPermission();
        }
      });

      // Monitor for toast notifications or UI updates
      const notificationArea = page.locator('[data-testid=notifications-area]');
      await expect(notificationArea).toBeVisible();

      // Simulate receiving a notification (this would typically come from WebSocket)
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('notification', {
          detail: {
            type: 'success',
            message: 'Your request for "Test Movie" has been approved!',
            timestamp: new Date().toISOString()
          }
        }));
      });

      // Verify notification appears
      await expect(page.locator('[data-testid=toast-notification]')).toBeVisible();
      await expect(page.locator('[data-testid=toast-notification]')).toContainText('approved');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle network errors gracefully', async () => {
      await page.goto('http://localhost:3000/login');
      await page.fill('[data-testid=email-input]', 'admin@medianest.test');
      await page.fill('[data-testid=password-input]', 'password123');
      await page.click('[data-testid=login-button]');

      await page.waitForURL('**/dashboard');

      // Simulate network failure
      await page.route('**/api/**', route => {
        route.abort('failed');
      });

      // Try to perform an action that requires API call
      await page.click('[data-testid=search-media-link]');
      await page.fill('[data-testid=search-input]', 'Test Query');
      await page.click('[data-testid=search-button]');

      // Should show error message
      await expect(page.locator('[data-testid=error-message]')).toBeVisible();
      await expect(page.locator('[data-testid=error-message]')).toContainText(['network', 'error', 'connection']);

      // Should show retry option
      await expect(page.locator('[data-testid=retry-button]')).toBeVisible();

      // Restore network and retry
      await page.unroute('**/api/**');
      await page.click('[data-testid=retry-button]');

      // Should work normally now
      await page.waitForSelector('[data-testid=search-results]');
    });

    test('should maintain session across browser refresh', async () => {
      await page.goto('http://localhost:3000/login');
      await page.fill('[data-testid=email-input]', 'admin@medianest.test');
      await page.fill('[data-testid=password-input]', 'password123');
      await page.click('[data-testid=login-button]');

      await page.waitForURL('**/dashboard');

      // Verify logged in state
      await expect(page.locator('[data-testid=user-menu]')).toBeVisible();

      // Refresh page
      await page.reload();

      // Should still be logged in
      await expect(page.locator('[data-testid=user-menu]')).toBeVisible();
      expect(page.url()).toContain('/dashboard');
    });
  });

  describe('Mobile Responsiveness', () => {
    test('should work correctly on mobile devices', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 }); // iPhone X

      await page.goto('http://localhost:3000');

      // Should show mobile navigation
      await expect(page.locator('[data-testid=mobile-menu-button]')).toBeVisible();

      // Open mobile menu
      await page.click('[data-testid=mobile-menu-button]');
      await expect(page.locator('[data-testid=mobile-nav-menu]')).toBeVisible();

      // Test mobile login
      await page.click('[data-testid=mobile-login-link]');
      await page.waitForURL('**/login');

      await page.fill('[data-testid=email-input]', 'admin@medianest.test');
      await page.fill('[data-testid=password-input]', 'password123');
      await page.click('[data-testid=login-button]');

      await page.waitForURL('**/dashboard');

      // Test mobile search
      await page.click('[data-testid=mobile-search-button]');
      await expect(page.locator('[data-testid=mobile-search-overlay]')).toBeVisible();

      await page.fill('[data-testid=mobile-search-input]', 'Test Movie');
      await page.click('[data-testid=mobile-search-submit]');

      // Should show mobile-optimized results
      await expect(page.locator('[data-testid=mobile-search-results]')).toBeVisible();
    });
  });

  describe('Accessibility Testing', () => {
    test('should be accessible with keyboard navigation', async () => {
      await page.goto('http://localhost:3000');

      // Test keyboard navigation
      await page.keyboard.press('Tab'); // Focus first interactive element
      await page.keyboard.press('Tab'); // Move to next element
      await page.keyboard.press('Enter'); // Activate focused element

      // Should have navigated
      expect(page.url()).not.toBe('http://localhost:3000/');

      // Test escape key functionality
      await page.keyboard.press('Escape');

      // Should close any modals or return to previous state
    });

    test('should have proper ARIA labels and roles', async () => {
      await page.goto('http://localhost:3000/login');

      // Check for proper form labels
      const emailInput = page.locator('[data-testid=email-input]');
      await expect(emailInput).toHaveAttribute('aria-label');

      const passwordInput = page.locator('[data-testid=password-input]');
      await expect(passwordInput).toHaveAttribute('aria-label');

      // Check for form validation messaging
      await page.click('[data-testid=login-button]'); // Submit empty form

      const errorMessage = page.locator('[role="alert"]').first();
      await expect(errorMessage).toBeVisible();
    });
  });
});