import { test, expect, Browser, Page, BrowserContext } from '@playwright/test';
import { AuthHelper } from '../tests/e2e/helpers/auth';

/**
 * Comprehensive Error Recovery and Offline Scenario E2E Tests
 * Tests MediaNest's resilience and error handling including:
 * - Network failures and recovery
 * - Offline functionality
 * - Service unavailability scenarios
 * - Data corruption recovery
 * - Session timeout handling
 * - Browser crash recovery
 * - Progressive enhancement
 * - Graceful degradation
 */

test.describe('Error Recovery and Offline Scenarios', () => {
  let page: Page;
  let context: BrowserContext;
  let authHelper: AuthHelper;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    authHelper = new AuthHelper(page);

    // Setup basic authentication mocks
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

    // Login before each test
    await authHelper.loginWithPlex();
  });

  test.describe('Network Failure Recovery', () => {
    test('should handle complete network failure gracefully', async () => {
      await page.goto('/dashboard');

      // Verify initial load
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

      // Simulate complete network failure
      await page.route('**/*', async (route) => {
        await route.abort('internetdisconnected');
      });

      // Try to navigate or perform action that requires network
      await page.click('[data-testid="nav-requests"]');

      // Verify offline/error state is shown
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="offline-message"]')).toContainText(
        /offline|network/i
      );
      await expect(page.locator('[data-testid="retry-connection"]')).toBeVisible();

      // Verify cached content is still available
      await expect(page.locator('[data-testid="cached-content"]')).toBeVisible();
    });

    test('should recover when network connection is restored', async () => {
      await page.goto('/dashboard');

      // Simulate network failure
      await page.route('**/api/v1/media/requests', async (route) => {
        await route.abort('internetdisconnected');
      });

      await page.goto('/requests');
      await expect(page.locator('[data-testid="connection-error"]')).toBeVisible();

      // Restore network connection
      await page.route('**/api/v1/media/requests', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            requests: [],
            totalCount: 0,
          }),
        });
      });

      // Click retry or wait for auto-retry
      await page.click('[data-testid="retry-connection"]');

      // Verify successful recovery
      await expect(page.locator('[data-testid="connection-error"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="requests-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="connection-restored"]')).toBeVisible();
    });

    test('should handle intermittent network failures with retry logic', async () => {
      await page.goto('/dashboard');

      let requestCount = 0;

      // Simulate intermittent failures (fail first 2 attempts, then succeed)
      await page.route('**/api/v1/media/search**', async (route) => {
        requestCount++;

        if (requestCount <= 2) {
          await route.abort('timedout');
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              results: [
                {
                  id: 12345,
                  title: 'Test Movie',
                  year: 2024,
                  type: 'movie',
                },
              ],
            }),
          });
        }
      });

      // Perform search
      await page.fill('[data-testid="search-input"]', 'test movie');
      await page.click('[data-testid="search-button"]');

      // Should show loading, then retry indicators, then success
      await expect(page.locator('[data-testid="search-loading"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="search-result"]')).toHaveCount(1);
    });
  });

  test.describe('Service Unavailability Scenarios', () => {
    test('should handle Plex server unavailability', async () => {
      await page.route('**/api/v1/plex/server', async (route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Plex server unavailable',
            message: 'Unable to connect to Plex Media Server',
          }),
        });
      });

      await page.goto('/plex');

      // Verify error state
      await expect(page.locator('[data-testid="plex-unavailable"]')).toBeVisible();
      await expect(page.locator('[data-testid="service-error-message"]')).toContainText(
        'Plex server unavailable'
      );
      await expect(page.locator('[data-testid="retry-plex-connection"]')).toBeVisible();

      // Verify other parts of app still work
      await page.goto('/requests');
      await expect(page.locator('[data-testid="requests-page"]')).toBeVisible();
    });

    test('should handle YouTube service failures gracefully', async () => {
      await page.route('**/api/v1/youtube/metadata**', async (route) => {
        await route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'YouTube service temporarily unavailable',
          }),
        });
      });

      await page.goto('/youtube');

      // Try to get video metadata
      await page.fill('[data-testid="url-input"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await page.click('[data-testid="get-info-button"]');

      // Verify graceful error handling
      await expect(page.locator('[data-testid="service-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="service-error"]')).toContainText(
        /temporarily unavailable/i
      );
      await expect(page.locator('[data-testid="try-again-later"]')).toBeVisible();

      // Verify form is still usable for retry
      await expect(page.locator('[data-testid="url-input"]')).toBeEnabled();
      await expect(page.locator('[data-testid="get-info-button"]')).toBeEnabled();
    });

    test('should handle database connectivity issues', async () => {
      // Simulate database connection issues
      await page.route('**/api/v1/media/requests', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Database connection failed',
            message: 'Unable to connect to database',
          }),
        });
      });

      await page.goto('/requests');

      // Verify database error handling
      await expect(page.locator('[data-testid="database-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText(/database/i);
      await expect(page.locator('[data-testid="contact-admin"]')).toBeVisible();

      // Verify automatic retry attempt
      await expect(page.locator('[data-testid="auto-retry-indicator"]')).toBeVisible();
    });
  });

  test.describe('Session Management and Recovery', () => {
    test('should handle session expiration during activity', async () => {
      await page.goto('/dashboard');

      // Simulate session expiration mid-activity
      await page.route('**/api/v1/media/requests', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Session expired',
            message: 'Your session has expired. Please log in again.',
          }),
        });
      });

      // Try to navigate to requests page
      await page.goto('/requests');

      // Should redirect to login with session expired message
      await expect(page).toHaveURL(/auth\/signin/);
      await expect(page.locator('[data-testid="session-expired-alert"]')).toBeVisible();
      await expect(page.locator('[data-testid="session-expired-alert"]')).toContainText(/expired/i);

      // Should preserve the intended destination
      await expect(page.locator('[data-testid="redirect-after-login"]')).toHaveAttribute(
        'value',
        '/requests'
      );
    });

    test('should handle concurrent session conflicts', async () => {
      await page.goto('/dashboard');

      // Simulate session conflict (logged in elsewhere)
      await page.route('**/api/v1/auth/session', async (route) => {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Session conflict',
            message: 'Your account is logged in from another device',
          }),
        });
      });

      // Perform action that checks session
      await page.reload();

      // Verify session conflict handling
      await expect(page.locator('[data-testid="session-conflict-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="conflict-message"]')).toContainText(
        /another device/i
      );

      // Should offer options to continue or logout
      await expect(page.locator('[data-testid="force-login"]')).toBeVisible();
      await expect(page.locator('[data-testid="logout-everywhere"]')).toBeVisible();
    });

    test('should recover from corrupted session data', async () => {
      await page.goto('/dashboard');

      // Corrupt local session data
      await page.evaluate(() => {
        localStorage.setItem('authToken', 'corrupted-invalid-token');
        localStorage.setItem('user', 'invalid-json-data');
      });

      // Navigate to protected page
      await page.goto('/requests');

      // Should detect corruption and redirect to login
      await expect(page).toHaveURL(/auth\/signin/);
      await expect(page.locator('[data-testid="session-corrupted-warning"]')).toBeVisible();

      // Should clear corrupted data
      const authToken = await page.evaluate(() => localStorage.getItem('authToken'));
      const userData = await page.evaluate(() => localStorage.getItem('user'));
      expect(authToken).toBeNull();
      expect(userData).toBeNull();
    });
  });

  test.describe('Progressive Enhancement and Graceful Degradation', () => {
    test('should function with JavaScript disabled', async () => {
      // Disable JavaScript
      await context.setJavaScriptEnabled(false);

      await page.goto('/');

      // Basic content should still be visible
      await expect(page.locator('[data-testid="no-js-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="upgrade-browser-message"]')).toBeVisible();

      // Forms should work with basic HTML
      await expect(page.locator('[data-testid="basic-login-form"]')).toBeVisible();

      // Re-enable JavaScript
      await context.setJavaScriptEnabled(true);
      await page.reload();

      // Enhanced features should become available
      await expect(page.locator('[data-testid="enhanced-features"]')).toBeVisible();
    });

    test('should handle missing CSS gracefully', async () => {
      // Block CSS loading
      await page.route('**/*.css', async (route) => {
        await route.abort();
      });

      await page.goto('/dashboard');

      // Content should still be readable and functional
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

      // Navigation should still work
      await page.click('[data-testid="nav-requests"]');
      await expect(page).toHaveURL(/requests/);
    });

    test('should work with slow network connections', async () => {
      // Simulate slow 2G connection
      const client = await context.newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 50 * 1024, // 50kb/s
        uploadThroughput: 20 * 1024, // 20kb/s
        latency: 2000, // 2 second latency
      });

      const startTime = Date.now();
      await page.goto('/dashboard');

      // Should show loading indicators
      await expect(page.locator('[data-testid="slow-connection-indicator"]')).toBeVisible();

      // Should eventually load
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
      const loadTime = Date.now() - startTime;

      // Should implement progressive loading
      expect(loadTime).toBeLessThan(30000); // Should load within 30 seconds even on slow connection

      // Should show performance tips for slow connections
      await expect(page.locator('[data-testid="performance-tips"]')).toBeVisible();
    });
  });

  test.describe('Data Corruption and Recovery', () => {
    test('should handle malformed API responses', async () => {
      await page.route('**/api/v1/media/search**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: 'invalid-json-response-that-cannot-be-parsed',
        });
      });

      await page.goto('/dashboard');
      await page.fill('[data-testid="search-input"]', 'test');
      await page.click('[data-testid="search-button"]');

      // Should handle JSON parse errors gracefully
      await expect(page.locator('[data-testid="parse-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText(
        /unable to process/i
      );
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('should recover from corrupted local storage', async () => {
      await page.goto('/dashboard');

      // Corrupt various local storage items
      await page.evaluate(() => {
        localStorage.setItem('userPreferences', 'corrupted-data');
        localStorage.setItem('recentSearches', 'invalid-json');
        localStorage.setItem('downloadQueue', '{broken-json}');
      });

      // Reload page to trigger corruption detection
      await page.reload();

      // Should detect and clean corrupted data
      await expect(page.locator('[data-testid="data-recovery-notice"]')).toBeVisible();

      // App should still function with default values
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

      // Local storage should be cleaned
      const preferences = await page.evaluate(() => localStorage.getItem('userPreferences'));
      const searches = await page.evaluate(() => localStorage.getItem('recentSearches'));
      expect(preferences).toBeNull();
      expect(searches).toBeNull();
    });

    test('should handle partial data loading failures', async () => {
      let requestCount = 0;

      await page.route('**/api/v1/media/requests', async (route) => {
        requestCount++;

        if (requestCount === 1) {
          // First request returns partial data
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              requests: [
                { id: '1', title: 'Movie 1', status: 'pending' },
                // Missing some fields
              ],
              totalCount: 3, // Claims more data exists
            }),
          });
        } else {
          // Subsequent requests complete the data
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              requests: [
                {
                  id: '1',
                  title: 'Movie 1',
                  status: 'pending',
                  type: 'movie',
                  createdAt: '2024-01-01T00:00:00Z',
                },
                {
                  id: '2',
                  title: 'Movie 2',
                  status: 'approved',
                  type: 'movie',
                  createdAt: '2024-01-02T00:00:00Z',
                },
                {
                  id: '3',
                  title: 'Movie 3',
                  status: 'completed',
                  type: 'movie',
                  createdAt: '2024-01-03T00:00:00Z',
                },
              ],
              totalCount: 3,
            }),
          });
        }
      });

      await page.goto('/requests');

      // Should show partial data initially
      await expect(page.locator('[data-testid="request-item"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="loading-more"]')).toBeVisible();

      // Should automatically retry for missing data
      await expect(page.locator('[data-testid="request-item"]')).toHaveCount(3);
      await expect(page.locator('[data-testid="loading-more"]')).not.toBeVisible();
    });
  });

  test.describe('Browser-Specific Error Handling', () => {
    test('should handle browser storage quota exceeded', async () => {
      await page.goto('/dashboard');

      // Fill up storage quota (simulate with large data)
      await page.evaluate(() => {
        try {
          const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB
          for (let i = 0; i < 100; i++) {
            localStorage.setItem(`large_item_${i}`, largeData);
          }
        } catch (e) {
          // Storage quota exceeded - this is expected
        }
      });

      // Try to save user preferences
      await page.goto('/settings');
      await page.click('[data-testid="save-preferences"]');

      // Should handle quota exceeded gracefully
      await expect(page.locator('[data-testid="storage-quota-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="clear-cache-suggestion"]')).toBeVisible();
    });

    test('should handle browser crashes and recovery', async () => {
      await page.goto('/dashboard');

      // Start a long-running operation
      await page.fill('[data-testid="search-input"]', 'complex search');
      await page.click('[data-testid="search-button"]');

      // Simulate browser crash by closing and reopening
      await page.close();
      page = await context.newPage();

      await page.goto('/dashboard');

      // Should detect interrupted operation
      await expect(page.locator('[data-testid="recovery-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="resume-operation"]')).toBeVisible();

      // Should offer to resume previous operation
      await page.click('[data-testid="resume-operation"]');
      await expect(page.locator('[data-testid="search-input"]')).toHaveValue('complex search');
    });

    test('should handle memory pressure scenarios', async () => {
      await page.goto('/dashboard');

      // Simulate memory pressure by creating many objects
      await page.evaluate(() => {
        (window as any).memoryIntensiveData = [];
        for (let i = 0; i < 100000; i++) {
          (window as any).memoryIntensiveData.push({
            id: i,
            data: new Array(1000).fill(`item-${i}`),
          });
        }
      });

      // Navigate around the app
      await page.goto('/requests');
      await page.goto('/plex');
      await page.goto('/youtube');

      // App should implement memory management
      const memoryUsage = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });

      // Should have cleaned up or handled memory pressure
      // The exact threshold depends on browser and device
      expect(memoryUsage).toBeLessThan(500 * 1024 * 1024); // 500MB limit
    });
  });

  test.describe('Real-Time Feature Recovery', () => {
    test('should handle WebSocket connection failures', async () => {
      await page.goto('/requests');

      // Mock WebSocket connection failure
      await page.evaluate(() => {
        // Override WebSocket to simulate connection failure
        const originalWebSocket = window.WebSocket;
        (window as any).WebSocket = function (url: string) {
          setTimeout(() => {
            const event = new Event('error');
            this.dispatchEvent && this.dispatchEvent(event);
          }, 100);
          return {
            close: () => {},
            send: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            readyState: 3, // CLOSED
          };
        };
      });

      // Should detect WebSocket failure and fall back to polling
      await expect(page.locator('[data-testid="realtime-disconnected"]')).toBeVisible();
      await expect(page.locator('[data-testid="polling-fallback-active"]')).toBeVisible();

      // Should still receive updates via polling
      await expect(page.locator('[data-testid="status-updates"]')).toBeVisible();
    });

    test('should handle server-sent events failures', async () => {
      await page.goto('/admin/dashboard');

      // Mock EventSource failure
      await page.evaluate(() => {
        (window as any).EventSource = function () {
          setTimeout(() => {
            const event = new Event('error');
            this.dispatchEvent && this.dispatchEvent(event);
          }, 100);
          return {
            close: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            readyState: 2, // CLOSED
          };
        };
      });

      // Should fall back to periodic refresh
      await expect(page.locator('[data-testid="sse-connection-failed"]')).toBeVisible();
      await expect(page.locator('[data-testid="periodic-refresh-active"]')).toBeVisible();
    });
  });

  test.afterEach(async () => {
    await context.close();
  });
});
