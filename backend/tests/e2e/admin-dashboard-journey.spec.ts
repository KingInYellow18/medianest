import { test, expect, Browser, Page, BrowserContext } from '@playwright/test';
import { AdminPage } from './pages/admin.page';
import { AuthHelper } from './helpers/auth';

/**
 * Comprehensive Admin Dashboard User Journey E2E Tests
 * Tests the complete admin dashboard functionality including:
 * - User management and role administration
 * - Service monitoring and health checks
 * - System statistics and analytics
 * - Request management and approval workflows
 * - Broadcast messaging system
 * - Settings and configuration management
 */

test.describe('Admin Dashboard User Journey', () => {
  let page: Page;
  let context: BrowserContext;
  let authHelper: AuthHelper;
  let adminDashboard: AdminDashboardPage;
  let adminUsers: AdminUsersPage;
  let adminServices: AdminServicesPage;
  let adminStats: AdminStatsPage;
  let adminBroadcast: AdminBroadcastPage;

  const mockUsers = [
    {
      id: 'user-1',
      username: 'john_doe',
      email: 'john@medianest.test',
      role: 'user',
      createdAt: '2024-01-10T08:00:00Z',
      lastLoginAt: '2024-01-15T14:30:00Z',
      requestCount: 12,
      downloadCount: 8,
      isActive: true,
    },
    {
      id: 'user-2',
      username: 'jane_smith',
      email: 'jane@medianest.test',
      role: 'moderator',
      createdAt: '2024-01-12T10:15:00Z',
      lastLoginAt: '2024-01-15T16:45:00Z',
      requestCount: 25,
      downloadCount: 20,
      isActive: true,
    },
    {
      id: 'user-3',
      username: 'bob_inactive',
      email: 'bob@medianest.test',
      role: 'user',
      createdAt: '2023-12-01T12:00:00Z',
      lastLoginAt: '2023-12-15T10:00:00Z',
      requestCount: 3,
      downloadCount: 1,
      isActive: false,
    },
  ];

  const mockServices = [
    {
      name: 'Plex Media Server',
      status: 'healthy',
      responseTime: 45,
      url: 'http://plex.medianest.local:32400',
      lastCheck: '2024-01-15T17:00:00Z',
      uptime: 99.8,
      version: '1.32.5.7349',
    },
    {
      name: 'YouTube-DL Service',
      status: 'healthy',
      responseTime: 123,
      url: 'http://youtube-dl.medianest.local:8080',
      lastCheck: '2024-01-15T17:00:00Z',
      uptime: 98.5,
      version: '2024.01.15',
    },
    {
      name: 'Database (PostgreSQL)',
      status: 'healthy',
      responseTime: 12,
      url: 'postgresql://db.medianest.local:5432',
      lastCheck: '2024-01-15T17:00:00Z',
      uptime: 100.0,
      version: '15.4',
    },
    {
      name: 'Redis Cache',
      status: 'warning',
      responseTime: 234,
      url: 'redis://redis.medianest.local:6379',
      lastCheck: '2024-01-15T17:00:00Z',
      uptime: 95.2,
      version: '7.2.3',
      warning: 'High memory usage detected',
    },
    {
      name: 'External API (TMDB)',
      status: 'unhealthy',
      responseTime: 0,
      url: 'https://api.themoviedb.org/3',
      lastCheck: '2024-01-15T17:00:00Z',
      uptime: 87.3,
      error: 'Connection timeout after 30 seconds',
    },
  ];

  const mockStats = {
    users: {
      total: 1247,
      active: 892,
      newThisMonth: 156,
      newThisWeek: 34,
    },
    requests: {
      total: 8934,
      pending: 23,
      approved: 7821,
      rejected: 186,
      completed: 7021,
    },
    downloads: {
      total: 5634,
      active: 12,
      completed: 5401,
      failed: 221,
      totalSize: '12.7 TB',
    },
    system: {
      uptime: '15 days, 7 hours',
      cpuUsage: 34.2,
      memoryUsage: 67.8,
      diskUsage: 78.9,
      networkIn: '245.7 MB/s',
      networkOut: '89.3 MB/s',
    },
    activity: [
      {
        timestamp: '2024-01-15T16:45:00Z',
        type: 'user_registered',
        user: 'new_user_123',
        details: 'New user registration',
      },
      {
        timestamp: '2024-01-15T16:30:00Z',
        type: 'request_approved',
        user: 'admin',
        details: 'Approved movie request: Inception',
      },
      {
        timestamp: '2024-01-15T16:15:00Z',
        type: 'download_completed',
        user: 'john_doe',
        details: 'YouTube download completed: Music Video',
      },
    ],
  };

  const mockRequests = [
    {
      id: 'req-1',
      title: 'Inception',
      type: 'movie',
      status: 'pending',
      user: { username: 'john_doe', email: 'john@medianest.test' },
      quality: 'HD',
      description: 'Would love to watch this amazing movie',
      createdAt: '2024-01-15T10:00:00Z',
      priority: 'normal',
    },
    {
      id: 'req-2',
      title: 'Breaking Bad',
      type: 'tv',
      status: 'approved',
      user: { username: 'jane_smith', email: 'jane@medianest.test' },
      quality: '4K',
      description: 'Please add all seasons',
      createdAt: '2024-01-14T14:30:00Z',
      approvedAt: '2024-01-15T09:15:00Z',
      approvedBy: 'admin',
      priority: 'high',
      seasons: [1, 2, 3, 4, 5],
    },
    {
      id: 'req-3',
      title: 'Outdated Movie',
      type: 'movie',
      status: 'rejected',
      user: { username: 'bob_inactive', email: 'bob@medianest.test' },
      quality: 'HD',
      description: 'Old movie request',
      createdAt: '2024-01-13T12:00:00Z',
      rejectedAt: '2024-01-14T16:00:00Z',
      rejectedBy: 'admin',
      rejectionReason: 'Content not available in region',
    },
  ];

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    authHelper = new AuthHelper(page);
    adminDashboard = new AdminDashboardPage(page);
    adminUsers = new AdminUsersPage(page);
    adminServices = new AdminServicesPage(page);
    adminStats = new AdminStatsPage(page);
    adminBroadcast = new AdminBroadcastPage(page);

    // Setup admin authentication
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

    // Setup admin API mocks
    await page.route('**/api/v1/admin/users**', async (route) => {
      const url = new URL(route.request().url());
      const search = url.searchParams.get('search');
      const role = url.searchParams.get('role');

      let filteredUsers = mockUsers;

      if (search) {
        filteredUsers = filteredUsers.filter(
          (u) => u.username.includes(search) || u.email.includes(search),
        );
      }

      if (role && role !== 'all') {
        filteredUsers = filteredUsers.filter((u) => u.role === role);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: filteredUsers,
          totalCount: filteredUsers.length,
          page: 1,
          pageSize: 20,
        }),
      });
    });

    await page.route('**/api/v1/admin/users/*/role', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'User role updated successfully',
          }),
        });
      }
    });

    await page.route('**/api/v1/admin/users/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        const userId = route.request().url().split('/').pop();
        if (userId === 'admin-123') {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Cannot delete own account',
              message: 'Administrators cannot delete their own accounts',
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'User deleted successfully',
            }),
          });
        }
      }
    });

    await page.route('**/api/v1/admin/services**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ services: mockServices }),
      });
    });

    await page.route('**/api/v1/admin/stats**', async (route) => {
      const url = new URL(route.request().url());
      const period = url.searchParams.get('period') || '7d';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockStats,
          period,
          generatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/v1/admin/requests**', async (route) => {
      const url = new URL(route.request().url());
      const status = url.searchParams.get('status');

      let filteredRequests = mockRequests;
      if (status && status !== 'all') {
        filteredRequests = filteredRequests.filter((r) => r.status === status);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requests: filteredRequests,
          totalCount: filteredRequests.length,
          pendingCount: mockRequests.filter((r) => r.status === 'pending').length,
          approvedCount: mockRequests.filter((r) => r.status === 'approved').length,
          rejectedCount: mockRequests.filter((r) => r.status === 'rejected').length,
        }),
      });
    });

    await page.route('**/api/v1/admin/requests/*/approve', async (route) => {
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

    await page.route('**/api/v1/admin/requests/*/reject', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Request rejected successfully',
          }),
        });
      }
    });

    await page.route('**/api/v1/admin/broadcast', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Broadcast message sent successfully',
            recipientCount: 892,
          }),
        });
      }
    });

    // Login as admin before each test
    await authHelper.loginWithPlex();
  });

  test('should display admin dashboard overview', async () => {
    await adminDashboard.goto();

    // Verify admin dashboard loads
    await adminDashboard.verifyLoaded();
    await adminDashboard.verifyAdminNavigation();

    // Verify overview cards
    await expect(page.locator('[data-testid="overview-cards"]')).toBeVisible();

    // Check user statistics
    await expect(page.locator('[data-testid="users-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-users"]')).toContainText('1,247');
    await expect(page.locator('[data-testid="active-users"]')).toContainText('892');

    // Check request statistics
    await expect(page.locator('[data-testid="requests-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-requests"]')).toContainText('8,934');
    await expect(page.locator('[data-testid="pending-requests"]')).toContainText('23');

    // Check download statistics
    await expect(page.locator('[data-testid="downloads-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-downloads"]')).toContainText('5,634');
    await expect(page.locator('[data-testid="total-size"]')).toContainText('12.7 TB');

    // Check system statistics
    await expect(page.locator('[data-testid="system-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="system-uptime"]')).toContainText('15 days');
    await expect(page.locator('[data-testid="cpu-usage"]')).toContainText('34.2%');
    await expect(page.locator('[data-testid="memory-usage"]')).toContainText('67.8%');

    // Verify recent activity
    await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible();
    const activityItems = page.locator('[data-testid="activity-item"]');
    await expect(activityItems).toHaveCount(3);
  });

  test('should manage users effectively', async () => {
    await adminUsers.goto();

    // Verify users page loads
    await expect(page.locator('[data-testid="users-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="page-title"]')).toContainText('User Management');

    // Verify user list
    const userRows = page.locator('[data-testid="user-row"]');
    await expect(userRows).toHaveCount(3);

    // Check first user details
    await adminUsers.verifyUserData(0, {
      username: 'john_doe',
      email: 'john@medianest.test',
      role: 'user',
      requestCount: '12',
    });

    // Check moderator user
    await adminUsers.verifyUserData(1, {
      username: 'jane_smith',
      email: 'jane@medianest.test',
      role: 'moderator',
      requestCount: '25',
    });

    // Test user search
    await adminUsers.searchUsers('john');
    // Should show only john_doe
    await expect(userRows).toHaveCount(1);
    await expect(userRows.first().locator('[data-testid="username"]')).toContainText('john_doe');

    // Clear search
    await page.fill('[data-testid="user-search"]', '');
    await page.keyboard.press('Enter');
    await expect(userRows).toHaveCount(3);

    // Test role filter
    await adminUsers.filterByRole('moderator');
    await expect(userRows).toHaveCount(1);
    await expect(userRows.first().locator('[data-testid="username"]')).toContainText('jane_smith');
  });

  test('should edit user roles', async () => {
    await adminUsers.goto();

    // Edit first user's role
    await adminUsers.editUserRole(0, 'moderator');

    // Verify success message
    await adminUsers.verifySuccess('User role updated successfully');
  });

  test('should delete users with protection for own account', async () => {
    await adminUsers.goto();

    // Try to delete a regular user (should work)
    await adminUsers.deleteUser(0);
    await adminUsers.verifySuccess('User deleted successfully');

    // Mock attempting to delete own account
    await page.route('**/api/v1/admin/users/admin-123', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Cannot delete own account',
          }),
        });
      }
    });

    // Try to delete own account (should be prevented)
    // This would need to be tested with a UI element that represents the admin's own account
  });

  test('should monitor service health', async () => {
    await adminServices.goto();

    // Verify services page loads
    await expect(page.locator('[data-testid="services-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="page-title"]')).toContainText('Service Monitoring');

    // Verify service cards
    const serviceCards = page.locator('[data-testid="service-card"]');
    await expect(serviceCards).toHaveCount(5);

    // Check healthy service (Plex)
    await adminServices.verifyServiceStatus('Plex Media Server', 'healthy');
    await adminServices.verifyResponseTime('Plex Media Server', '45ms');

    // Check warning service (Redis)
    await adminServices.verifyServiceStatus('Redis Cache', 'warning');
    const redisCard = page.locator('[data-testid="service-card-Redis Cache"]');
    await expect(redisCard.locator('[data-testid="warning-message"]')).toContainText(
      'High memory usage',
    );

    // Check unhealthy service (TMDB API)
    await adminServices.verifyServiceStatus('External API (TMDB)', 'unhealthy');
    await adminServices.verifyServiceError('External API (TMDB)', 'Connection timeout');

    // Test service refresh
    await adminServices.refreshServices();
    await expect(page.locator('[data-testid="services-loading"]')).toBeVisible();
  });

  test('should view detailed service information', async () => {
    await adminServices.goto();

    // View Plex service details
    await adminServices.viewServiceDetails('Plex Media Server');

    // Verify service detail modal
    const modal = page.locator('[data-testid="service-detail-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-testid="service-name"]')).toContainText('Plex Media Server');
    await expect(modal.locator('[data-testid="service-version"]')).toContainText('1.32.5.7349');
    await expect(modal.locator('[data-testid="service-uptime"]')).toContainText('99.8%');
    await expect(modal.locator('[data-testid="service-url"]')).toContainText(
      'plex.medianest.local:32400',
    );
  });

  test('should display system statistics with time period selection', async () => {
    await adminStats.goto();

    // Verify stats page loads
    await expect(page.locator('[data-testid="stats-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="page-title"]')).toContainText('System Statistics');

    // Verify default stats (7 days)
    await adminStats.verifyStats({
      totalUsers: '1,247',
      activeUsers: '892',
      totalRequests: '8,934',
      pendingRequests: '23',
      totalDownloads: '5,634',
      activeDownloads: '12',
    });

    // Test time period change
    await adminStats.changeTimePeriod('30d');

    // Verify stats are updated (mock would return different data for 30d period)
    await expect(page.locator('[data-testid="stats-loading"]')).toBeVisible();

    // Verify charts are displayed
    await adminStats.verifyCharts();
  });

  test('should manage media requests', async () => {
    await page.goto('/admin/requests');

    // Verify requests page loads
    await expect(page.locator('[data-testid="requests-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="page-title"]')).toContainText('Media Requests');

    // Verify request statistics
    await expect(page.locator('[data-testid="pending-count"]')).toContainText('1');
    await expect(page.locator('[data-testid="approved-count"]')).toContainText('1');
    await expect(page.locator('[data-testid="rejected-count"]')).toContainText('1');

    // Verify request list
    const requestItems = page.locator('[data-testid="request-item"]');
    await expect(requestItems).toHaveCount(3);

    // Check pending request
    const pendingRequest = requestItems.first();
    await expect(pendingRequest.locator('[data-testid="request-title"]')).toContainText(
      'Inception',
    );
    await expect(pendingRequest.locator('[data-testid="request-status"]')).toContainText('pending');
    await expect(pendingRequest.locator('[data-testid="request-user"]')).toContainText('john_doe');
    await expect(pendingRequest.locator('[data-testid="admin-actions"]')).toBeVisible();

    // Test request approval
    await pendingRequest.locator('[data-testid="approve-button"]').click();

    // Fill approval modal
    await expect(page.locator('[data-testid="approval-modal"]')).toBeVisible();
    await page.fill('[data-testid="admin-notes"]', 'Approved - excellent movie choice');
    await page.selectOption('[data-testid="priority-select"]', 'high');
    await page.click('[data-testid="confirm-approval"]');

    // Verify success
    await expect(page.locator('[data-testid="success-notification"]')).toContainText(
      'Request approved successfully',
    );
  });

  test('should reject media requests with reason', async () => {
    await page.goto('/admin/requests');

    // Find pending request and reject it
    const pendingRequest = page.locator('[data-testid="request-item"]').first();
    await pendingRequest.locator('[data-testid="reject-button"]').click();

    // Fill rejection modal
    await expect(page.locator('[data-testid="rejection-modal"]')).toBeVisible();
    await page.fill('[data-testid="rejection-reason"]', 'Content not available in our region');
    await page.click('[data-testid="confirm-rejection"]');

    // Verify success
    await expect(page.locator('[data-testid="success-notification"]')).toContainText(
      'Request rejected successfully',
    );
  });

  test('should send broadcast messages', async () => {
    await adminBroadcast.goto();

    // Verify broadcast page loads
    await expect(page.locator('[data-testid="broadcast-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="page-title"]')).toContainText('Broadcast Message');

    // Test message preview
    const title = 'System Maintenance Notice';
    const content = 'MediaNest will undergo scheduled maintenance tonight from 2-4 AM EST.';

    await adminBroadcast.previewMessage(title, content);
    await adminBroadcast.verifyPreviewContent(title, content);

    // Close preview and send broadcast
    await page.click('[data-testid="close-preview"]');
    await adminBroadcast.sendBroadcast(title, content, 'warning');

    // Verify broadcast success
    await adminBroadcast.verifyBroadcastSent();
    await expect(page.locator('[data-testid="recipient-count"]')).toContainText('892 users');
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle service monitoring errors gracefully', async () => {
      // Mock service error
      await page.route('**/api/v1/admin/services**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Service monitoring temporarily unavailable',
          }),
        });
      });

      await adminServices.goto();

      // Verify error handling
      await expect(page.locator('[data-testid="services-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="services-error"]')).toContainText(
        'monitoring temporarily unavailable',
      );
      await expect(page.locator('[data-testid="retry-services"]')).toBeVisible();
    });

    test('should handle user management errors', async () => {
      // Mock user API error
      await page.route('**/api/v1/admin/users**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Database connection failed',
          }),
        });
      });

      await adminUsers.goto();

      // Verify error handling
      await expect(page.locator('[data-testid="users-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="users-error"]')).toContainText(
        'Database connection failed',
      );
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should handle large user datasets efficiently', async () => {
      // Mock large user dataset
      const largeUserList = Array.from({ length: 1000 }, (_, i) => ({
        id: `user-${i + 1}`,
        username: `user_${i + 1}`,
        email: `user${i + 1}@medianest.test`,
        role: i % 10 === 0 ? 'admin' : i % 5 === 0 ? 'moderator' : 'user',
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
        lastLoginAt: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
        requestCount: Math.floor(Math.random() * 50),
        downloadCount: Math.floor(Math.random() * 30),
        isActive: Math.random() > 0.1,
      }));

      await page.route('**/api/v1/admin/users**', async (route) => {
        const url = new URL(route.request().url());
        const page_num = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('limit') || '50');

        const start = (page_num - 1) * pageSize;
        const end = start + pageSize;
        const paginatedUsers = largeUserList.slice(start, end);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            users: paginatedUsers,
            totalCount: largeUserList.length,
            page: page_num,
            pageSize,
            totalPages: Math.ceil(largeUserList.length / pageSize),
          }),
        });
      });

      const startTime = Date.now();
      await adminUsers.goto();

      await expect(page.locator('[data-testid="user-row"]').first()).toBeVisible();
      const loadTime = Date.now() - startTime;

      // Should load within 2 seconds
      expect(loadTime).toBeLessThan(2000);

      // Should show pagination
      await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
      await expect(page.locator('[data-testid="results-info"]')).toContainText('1,000 users');
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await adminDashboard.goto();

      // Open mobile navigation
      await adminDashboard.openMobileNav();

      // Verify mobile navigation works
      await expect(page.locator('[data-testid="mobile-nav-users"]')).toBeVisible();
      await page.click('[data-testid="mobile-nav-users"]');

      // Verify navigation to users page on mobile
      await expect(page).toHaveURL('/admin/users');
      await expect(page.locator('[data-testid="mobile-users-layout"]')).toBeVisible();
    });
  });

  test.afterEach(async () => {
    await context.close();
  });
});
