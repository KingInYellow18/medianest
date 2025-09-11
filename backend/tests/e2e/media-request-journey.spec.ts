import { test, expect, Browser, Page, BrowserContext } from '@playwright/test';
import { LoginPage } from '../tests/e2e/pages/login.page';
import { AdminDashboardPage } from '../tests/e2e/pages/admin.page';
import { AuthHelper } from '../tests/e2e/helpers/auth';

/**
 * Comprehensive Media Request User Journey E2E Tests
 * Tests the complete media request workflow including:
 * - Media search and discovery
 * - Request creation and submission
 * - Admin review and approval process
 * - Status tracking and notifications
 * - Request fulfillment and download
 */

test.describe('Media Request User Journey', () => {
  let page: Page;
  let context: BrowserContext;
  let authHelper: AuthHelper;
  let adminPage: AdminDashboardPage;

  const mockMediaSearchResults = {
    results: [
      {
        id: 12345,
        title: 'Inception',
        year: 2010,
        type: 'movie',
        overview: 'A thief who steals corporate secrets through dream-sharing technology...',
        poster: '/poster-inception.jpg',
        backdrop: '/backdrop-inception.jpg',
        genres: ['Action', 'Sci-Fi', 'Thriller'],
        rating: 8.8,
        runtime: 148,
        status: 'available',
      },
      {
        id: 67890,
        title: 'Breaking Bad',
        year: 2008,
        type: 'tv',
        overview: 'A high school chemistry teacher diagnosed with inoperable lung cancer...',
        poster: '/poster-breaking-bad.jpg',
        backdrop: '/backdrop-breaking-bad.jpg',
        genres: ['Crime', 'Drama', 'Thriller'],
        rating: 9.5,
        seasons: 5,
        status: 'partially_available',
      },
    ],
    totalResults: 2,
    page: 1,
    totalPages: 1,
  };

  const mockUserRequests = [
    {
      id: 'req-123',
      mediaId: 12345,
      title: 'Inception',
      type: 'movie',
      status: 'pending',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      quality: 'HD',
      description: 'Test request for Inception movie',
    },
  ];

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    authHelper = new AuthHelper(page);
    adminPage = new AdminDashboardPage(page);

    // Setup authentication mocks
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

    // Setup media API mocks
    await page.route('**/api/v1/media/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMediaSearchResults),
      });
    });

    await page.route('**/api/v1/media/requests', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ requests: mockUserRequests, totalCount: 1 }),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'req-new-123',
            success: true,
            message: 'Request created successfully',
          }),
        });
      }
    });

    await page.route('**/api/v1/media/:mediaType/:tmdbId', async (route) => {
      const url = route.request().url();
      const movieMatch = url.match(/\/media\/movie\/(\d+)/);
      const tvMatch = url.match(/\/media\/tv\/(\d+)/);

      if (movieMatch && movieMatch[1] === '12345') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMediaSearchResults.results[0]),
        });
      } else if (tvMatch && tvMatch[1] === '67890') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMediaSearchResults.results[1]),
        });
      }
    });

    // Login before each test
    await authHelper.loginWithPlex();
  });

  test('should search for media successfully', async () => {
    // Navigate to dashboard
    await page.goto('/dashboard');

    // Verify search section is visible
    await expect(page.locator('[data-testid="search-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();

    // Perform search
    await page.fill('[data-testid="search-input"]', 'Inception');
    await page.click('[data-testid="search-button"]');

    // Wait for search results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-loading"]')).not.toBeVisible();

    // Verify search results
    const mediaCards = page.locator('[data-testid="media-card"]');
    await expect(mediaCards).toHaveCount(2);

    // Check first result (Inception movie)
    const firstCard = mediaCards.first();
    await expect(firstCard.locator('[data-testid="media-title"]')).toContainText('Inception');
    await expect(firstCard.locator('[data-testid="media-year"]')).toContainText('2010');
    await expect(firstCard.locator('[data-testid="media-type"]')).toContainText('Movie');
    await expect(firstCard.locator('[data-testid="media-rating"]')).toContainText('8.8');

    // Check second result (Breaking Bad TV show)
    const secondCard = mediaCards.nth(1);
    await expect(secondCard.locator('[data-testid="media-title"]')).toContainText('Breaking Bad');
    await expect(secondCard.locator('[data-testid="media-year"]')).toContainText('2008');
    await expect(secondCard.locator('[data-testid="media-type"]')).toContainText('TV Show');
  });

  test('should create media request successfully', async () => {
    await page.goto('/dashboard');

    // Search for media
    await page.fill('[data-testid="search-input"]', 'Inception');
    await page.click('[data-testid="search-button"]');

    // Wait for results and click request button
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    const firstCard = page.locator('[data-testid="media-card"]').first();
    await firstCard.locator('[data-testid="request-button"]').click();

    // Verify request modal opens
    await expect(page.locator('[data-testid="request-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="modal-title"]')).toContainText('Request Inception');

    // Fill out request form
    await page.selectOption('[data-testid="quality-select"]', 'HD');
    await page.fill('[data-testid="description-input"]', 'Would love to watch this amazing movie!');

    // Submit request
    await page.click('[data-testid="submit-request"]');

    // Verify success notification
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-notification"]')).toContainText(
      'Request created successfully'
    );

    // Verify modal closes
    await expect(page.locator('[data-testid="request-modal"]')).not.toBeVisible();
  });

  test('should create TV show request with season selection', async () => {
    await page.goto('/dashboard');

    // Search and select TV show
    await page.fill('[data-testid="search-input"]', 'Breaking Bad');
    await page.click('[data-testid="search-button"]');

    const tvCard = page.locator('[data-testid="media-card"]').nth(1);
    await tvCard.locator('[data-testid="request-button"]').click();

    // Verify TV show request modal
    await expect(page.locator('[data-testid="request-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="season-selection"]')).toBeVisible();

    // Select specific seasons
    await page.check('[data-testid="season-1"]');
    await page.check('[data-testid="season-2"]');
    await page.selectOption('[data-testid="quality-select"]', '4K');

    // Submit request
    await page.fill('[data-testid="description-input"]', 'Please add seasons 1 and 2');
    await page.click('[data-testid="submit-request"]');

    // Verify success
    await expect(page.locator('[data-testid="success-notification"]')).toBeVisible();
  });

  test('should display user requests correctly', async () => {
    // Navigate to requests page
    await page.goto('/requests');

    // Verify requests page loads
    await expect(page.locator('[data-testid="requests-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="page-title"]')).toContainText('My Requests');

    // Verify request list
    await expect(page.locator('[data-testid="request-list"]')).toBeVisible();

    const requestItems = page.locator('[data-testid="request-item"]');
    await expect(requestItems).toHaveCount(1);

    // Verify request details
    const firstRequest = requestItems.first();
    await expect(firstRequest.locator('[data-testid="request-title"]')).toContainText('Inception');
    await expect(firstRequest.locator('[data-testid="request-status"]')).toContainText('Pending');
    await expect(firstRequest.locator('[data-testid="request-type"]')).toContainText('Movie');
    await expect(firstRequest.locator('[data-testid="request-date"]')).toBeVisible();
  });

  test('should handle request status updates', async () => {
    // Mock request with different status
    await page.route('**/api/v1/media/requests', async (route) => {
      if (route.request().method() === 'GET') {
        const updatedRequests = [
          {
            ...mockUserRequests[0],
            status: 'approved',
            adminNote: 'Approved by admin - processing started',
            approvedAt: '2024-01-15T14:30:00Z',
          },
        ];

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ requests: updatedRequests, totalCount: 1 }),
        });
      }
    });

    await page.goto('/requests');

    const requestItem = page.locator('[data-testid="request-item"]').first();

    // Verify approved status
    await expect(requestItem.locator('[data-testid="request-status"]')).toContainText('Approved');
    await expect(requestItem.locator('[data-testid="status-badge"]')).toHaveClass(/approved/);
    await expect(requestItem.locator('[data-testid="admin-note"]')).toContainText(
      'Approved by admin'
    );
  });

  test('should cancel pending request', async () => {
    await page.route('**/api/v1/media/requests/req-123', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Request cancelled successfully' }),
        });
      }
    });

    await page.goto('/requests');

    const requestItem = page.locator('[data-testid="request-item"]').first();

    // Click cancel button
    await requestItem.locator('[data-testid="cancel-request"]').click();

    // Confirm cancellation
    await expect(page.locator('[data-testid="cancel-modal"]')).toBeVisible();
    await page.click('[data-testid="confirm-cancel"]');

    // Verify success notification
    await expect(page.locator('[data-testid="success-notification"]')).toContainText(
      'Request cancelled successfully'
    );
  });

  test.describe('Admin Request Management', () => {
    test.beforeEach(async () => {
      // Mock admin user
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

      // Mock admin requests endpoint
      await page.route('**/api/v1/admin/requests**', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              requests: [
                {
                  ...mockUserRequests[0],
                  user: { username: 'testuser', email: 'test@medianest.test' },
                },
              ],
              totalCount: 1,
              pendingCount: 1,
              approvedCount: 0,
            }),
          });
        }
      });

      // Reload page to get admin session
      await page.reload();
    });

    test('should view and manage all requests as admin', async () => {
      await page.goto('/admin/requests');

      // Verify admin requests page
      await expect(page.locator('[data-testid="admin-requests-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="page-title"]')).toContainText('All Requests');

      // Verify request statistics
      await expect(page.locator('[data-testid="pending-count"]')).toContainText('1');
      await expect(page.locator('[data-testid="total-count"]')).toContainText('1');

      // Verify request in list
      const requestItem = page.locator('[data-testid="admin-request-item"]').first();
      await expect(requestItem.locator('[data-testid="request-title"]')).toContainText('Inception');
      await expect(requestItem.locator('[data-testid="request-user"]')).toContainText('testuser');
      await expect(requestItem.locator('[data-testid="admin-actions"]')).toBeVisible();
    });

    test('should approve request as admin', async () => {
      await page.route('**/api/v1/admin/requests/req-123/approve', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Request approved successfully',
            }),
          });
        }
      });

      await page.goto('/admin/requests');

      const requestItem = page.locator('[data-testid="admin-request-item"]').first();

      // Click approve button
      await requestItem.locator('[data-testid="approve-button"]').click();

      // Fill approval modal
      await expect(page.locator('[data-testid="approval-modal"]')).toBeVisible();
      await page.fill('[data-testid="admin-notes"]', 'Approved - great movie choice');
      await page.selectOption('[data-testid="priority-select"]', 'high');
      await page.click('[data-testid="confirm-approval"]');

      // Verify success
      await expect(page.locator('[data-testid="success-notification"]')).toContainText(
        'Request approved successfully'
      );
    });

    test('should reject request with reason', async () => {
      await page.route('**/api/v1/admin/requests/req-123/reject', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Request rejected',
            }),
          });
        }
      });

      await page.goto('/admin/requests');

      const requestItem = page.locator('[data-testid="admin-request-item"]').first();

      // Click reject button
      await requestItem.locator('[data-testid="reject-button"]').click();

      // Fill rejection modal
      await expect(page.locator('[data-testid="rejection-modal"]')).toBeVisible();
      await page.fill('[data-testid="rejection-reason"]', 'Content not available in region');
      await page.click('[data-testid="confirm-rejection"]');

      // Verify success
      await expect(page.locator('[data-testid="success-notification"]')).toContainText(
        'Request rejected'
      );
    });
  });

  test.describe('Error Handling', () => {
    test('should handle search API errors gracefully', async () => {
      await page.route('**/api/v1/media/search**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Search service temporarily unavailable',
          }),
        });
      });

      await page.goto('/dashboard');
      await page.fill('[data-testid="search-input"]', 'Inception');
      await page.click('[data-testid="search-button"]');

      // Verify error handling
      await expect(page.locator('[data-testid="error-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-notification"]')).toContainText(
        'Search failed'
      );
      await expect(page.locator('[data-testid="retry-search"]')).toBeVisible();
    });

    test('should handle request creation errors', async () => {
      await page.route('**/api/v1/media/requests', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Duplicate request',
              message: 'You have already requested this item',
            }),
          });
        }
      });

      await page.goto('/dashboard');
      await page.fill('[data-testid="search-input"]', 'Inception');
      await page.click('[data-testid="search-button"]');

      const firstCard = page.locator('[data-testid="media-card"]').first();
      await firstCard.locator('[data-testid="request-button"]').click();

      await page.selectOption('[data-testid="quality-select"]', 'HD');
      await page.click('[data-testid="submit-request"]');

      // Verify error handling
      await expect(page.locator('[data-testid="error-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-notification"]')).toContainText(
        'already requested'
      );
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should handle large search results efficiently', async () => {
      // Mock large result set
      const largeResults = {
        results: Array.from({ length: 50 }, (_, i) => ({
          id: 10000 + i,
          title: `Movie ${i + 1}`,
          year: 2020 + (i % 5),
          type: 'movie',
          overview: `Overview for movie ${i + 1}`,
          poster: `/poster-${i}.jpg`,
          rating: 7.0 + (i % 3),
        })),
        totalResults: 500,
        page: 1,
        totalPages: 10,
      };

      await page.route('**/api/v1/media/search**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(largeResults),
        });
      });

      await page.goto('/dashboard');

      const startTime = Date.now();
      await page.fill('[data-testid="search-input"]', 'movie');
      await page.click('[data-testid="search-button"]');

      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      const loadTime = Date.now() - startTime;

      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);

      // Verify pagination
      await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
      await expect(page.locator('[data-testid="results-info"]')).toContainText('500 results');
    });
  });

  test.afterEach(async () => {
    await context.close();
  });
});
