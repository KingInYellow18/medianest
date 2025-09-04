import { test, expect, Page, BrowserContext } from '@playwright/test';
import { AuthHelper } from '../helpers/auth';

/**
 * E2E Tests for Admin Dashboard Functionality
 * 
 * Tests cover:
 * - Admin authentication and access control
 * - User management (view, edit roles, delete)
 * - Service status monitoring
 * - System statistics display
 * - Configuration management
 * - Activity logs viewing
 * - Broadcast messages
 * - Service health checks
 * - User session management
 * - Admin-only features visibility
 * - Performance metrics
 * - Accessibility
 * - Mobile responsiveness
 * - Cross-browser compatibility
 */

test.describe('Admin Dashboard E2E Tests', () => {
  let authHelper: AuthHelper;
  let context: BrowserContext;
  let page: Page;

  // Mock data
  const mockUsers = [
    {
      id: 'user-1',
      plexId: 'plex-123',
      plexUsername: 'john_doe',
      email: 'john@example.com',
      thumb: 'https://plex.tv/users/john_doe/avatar.png',
      role: 'user',
      createdAt: '2024-01-15T10:30:00Z',
      lastLoginAt: '2024-01-20T14:22:00Z',
      _count: {
        mediaRequests: 15,
        youtubeDownloads: 8
      }
    },
    {
      id: 'user-2',
      plexId: 'plex-456',
      plexUsername: 'jane_admin',
      email: 'jane@example.com',
      thumb: 'https://plex.tv/users/jane_admin/avatar.png',
      role: 'admin',
      createdAt: '2024-01-10T08:15:00Z',
      lastLoginAt: '2024-01-21T09:45:00Z',
      _count: {
        mediaRequests: 25,
        youtubeDownloads: 12
      }
    }
  ];

  const mockSystemStats = {
    users: {
      total: 150,
      active: 89
    },
    requests: {
      total: 543,
      pending: 23
    },
    downloads: {
      total: 298,
      active: 5
    }
  };

  const mockServices = [
    {
      id: 'service-1',
      service: 'plex',
      baseUrl: 'https://plex.example.com',
      status: 'healthy',
      lastChecked: '2024-01-21T10:00:00Z',
      responseTime: 150
    },
    {
      id: 'service-2',
      service: 'overseerr',
      baseUrl: 'https://overseerr.example.com',
      status: 'unhealthy',
      lastChecked: '2024-01-21T10:00:00Z',
      responseTime: 5000,
      error: 'Connection timeout'
    }
  ];

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    authHelper = new AuthHelper(page);

    // Mock admin authentication
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'admin-123',
            plexUsername: 'admin_user',
            email: 'admin@example.com',
            role: 'admin'
          }
        })
      });
    });

    // Mock users endpoint
    await page.route('**/api/v1/admin/users**', async (route) => {
      if (route.request().method() === 'GET') {
        const url = new URL(route.request().url());
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
        const search = url.searchParams.get('search');
        const role = url.searchParams.get('role');

        let filteredUsers = mockUsers;
        
        if (search) {
          filteredUsers = mockUsers.filter(user => 
            user.plexUsername.includes(search) || user.email.includes(search)
          );
        }
        
        if (role && role !== 'all') {
          filteredUsers = mockUsers.filter(user => user.role === role);
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              users: filteredUsers,
              pagination: {
                total: filteredUsers.length,
                page,
                pageSize,
                totalPages: Math.ceil(filteredUsers.length / pageSize)
              }
            }
          })
        });
      }
    });

    // Mock user role update
    await page.route('**/api/v1/admin/users/*/role', async (route) => {
      if (route.request().method() === 'PATCH') {
        const data = await route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'user-1',
              plexUsername: 'john_doe',
              email: 'john@example.com',
              role: data.role
            }
          })
        });
      }
    });

    // Mock user deletion
    await page.route('**/api/v1/admin/users/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'User deleted successfully'
          })
        });
      }
    });

    // Mock system stats
    await page.route('**/api/v1/admin/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockSystemStats
        })
      });
    });

    // Mock services endpoint
    await page.route('**/api/v1/admin/services', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockServices
        })
      });
    });

    // Login as admin before each test
    await authHelper.quickLogin();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('Admin Authentication and Access', () => {
    test('should require admin role to access admin dashboard', async () => {
      // Mock non-admin user
      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'user-123',
              plexUsername: 'regular_user',
              email: 'user@example.com',
              role: 'user'
            }
          })
        });
      });

      await page.goto('/admin');

      // Should redirect to unauthorized page or dashboard
      await expect(page).toHaveURL(/\/(dashboard|unauthorized)/);
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
    });

    test('should allow admin access to admin dashboard', async () => {
      await page.goto('/admin');

      // Should successfully load admin dashboard
      await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="admin-header"]')).toContainText('Admin Dashboard');
    });

    test('should show admin-only navigation items', async () => {
      await page.goto('/admin');

      // Check admin navigation items
      await expect(page.locator('[data-testid="nav-users"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-services"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-system-stats"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-activity-logs"]')).toBeVisible();
    });
  });

  test.describe('User Management', () => {
    test('should display users list with pagination', async () => {
      await page.goto('/admin/users');

      // Should show users table
      await expect(page.locator('[data-testid="users-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-row"]')).toHaveCount(2);

      // Verify user data display
      const firstUser = page.locator('[data-testid="user-row"]').first();
      await expect(firstUser.locator('[data-testid="username"]')).toContainText('john_doe');
      await expect(firstUser.locator('[data-testid="email"]')).toContainText('john@example.com');
      await expect(firstUser.locator('[data-testid="role-badge"]')).toContainText('user');
      await expect(firstUser.locator('[data-testid="request-count"]')).toContainText('15');
    });

    test('should filter users by role', async () => {
      await page.goto('/admin/users');

      // Filter by admin role
      await page.selectOption('[data-testid="role-filter"]', 'admin');
      
      // Should show only admin users
      await expect(page.locator('[data-testid="user-row"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="username"]')).toContainText('jane_admin');

      // Filter by user role
      await page.selectOption('[data-testid="role-filter"]', 'user');
      await expect(page.locator('[data-testid="user-row"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="username"]')).toContainText('john_doe');
    });

    test('should search users by username or email', async () => {
      await page.goto('/admin/users');

      // Search by username
      await page.fill('[data-testid="user-search"]', 'john');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('[data-testid="user-row"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="username"]')).toContainText('john_doe');

      // Clear search
      await page.fill('[data-testid="user-search"]', '');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('[data-testid="user-row"]')).toHaveCount(2);
    });

    test('should update user role', async () => {
      await page.goto('/admin/users');

      // Find user and click role edit button
      const userRow = page.locator('[data-testid="user-row"]').first();
      await userRow.locator('[data-testid="edit-role-btn"]').click();

      // Should open role edit modal
      await expect(page.locator('[data-testid="edit-role-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="current-role"]')).toContainText('user');

      // Change role to admin
      await page.selectOption('[data-testid="new-role-select"]', 'admin');
      await page.click('[data-testid="save-role-btn"]');

      // Should show success message
      await expect(page.locator('[data-testid="role-update-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="role-update-success"]')).toContainText(/role updated/i);

      // Modal should close
      await expect(page.locator('[data-testid="edit-role-modal"]')).not.toBeVisible();
    });

    test('should prevent admin from removing own admin role', async () => {
      await page.goto('/admin/users');

      // Try to edit current admin user's role
      const adminRow = page.locator('[data-testid="user-row"]').filter({ hasText: 'jane_admin' });
      await adminRow.locator('[data-testid="edit-role-btn"]').click();

      // Should show warning or disable role change
      const roleSelect = page.locator('[data-testid="new-role-select"]');
      await expect(roleSelect.locator('option[value="user"]')).toBeDisabled();
      
      // Or should show warning message
      await expect(page.locator('[data-testid="self-role-warning"]')).toBeVisible();
    });

    test('should delete user account', async () => {
      await page.goto('/admin/users');

      // Find user and click delete button
      const userRow = page.locator('[data-testid="user-row"]').first();
      await userRow.locator('[data-testid="delete-user-btn"]').click();

      // Should show confirmation modal
      await expect(page.locator('[data-testid="delete-user-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="delete-warning"]')).toContainText(/permanently delete/i);

      // Confirm deletion
      await page.fill('[data-testid="delete-confirmation"]', 'DELETE');
      await page.click('[data-testid="confirm-delete-btn"]');

      // Should show success message
      await expect(page.locator('[data-testid="delete-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="delete-success"]')).toContainText(/deleted successfully/i);
    });

    test('should prevent admin from deleting own account', async () => {
      await page.goto('/admin/users');

      // Try to delete current admin user
      const adminRow = page.locator('[data-testid="user-row"]').filter({ hasText: 'jane_admin' });
      const deleteBtn = adminRow.locator('[data-testid="delete-user-btn"]');

      // Delete button should be disabled
      await expect(deleteBtn).toBeDisabled();
      
      // Or should show tooltip with warning
      await deleteBtn.hover();
      await expect(page.locator('[data-testid="self-delete-warning"]')).toBeVisible();
    });
  });

  test.describe('Service Status Monitoring', () => {
    test('should display service status overview', async () => {
      await page.goto('/admin/services');

      // Should show services grid
      await expect(page.locator('[data-testid="services-grid"]')).toBeVisible();
      await expect(page.locator('[data-testid="service-card"]')).toHaveCount(2);

      // Verify service status display
      const plexService = page.locator('[data-testid="service-card-plex"]');
      await expect(plexService.locator('[data-testid="service-name"]')).toContainText('Plex');
      await expect(plexService.locator('[data-testid="status-indicator"]')).toHaveClass(/healthy/);
      await expect(plexService.locator('[data-testid="response-time"]')).toContainText('150ms');

      const overseerrService = page.locator('[data-testid="service-card-overseerr"]');
      await expect(overseerrService.locator('[data-testid="status-indicator"]')).toHaveClass(/unhealthy/);
      await expect(overseerrService.locator('[data-testid="error-message"]')).toContainText('Connection timeout');
    });

    test('should refresh service status', async () => {
      await page.goto('/admin/services');

      // Click refresh button
      await page.click('[data-testid="refresh-services"]');

      // Should show loading indicator
      await expect(page.locator('[data-testid="services-loading"]')).toBeVisible();
      
      // Should update timestamps
      await expect(page.locator('[data-testid="last-updated"]')).toBeVisible();
    });

    test('should show service health history', async () => {
      await page.goto('/admin/services');

      // Click on service card to view details
      await page.click('[data-testid="service-card-plex"]');

      // Should show service detail modal
      await expect(page.locator('[data-testid="service-detail-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="health-history-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="uptime-percentage"]')).toBeVisible();
    });
  });

  test.describe('System Statistics Display', () => {
    test('should display system statistics dashboard', async () => {
      await page.goto('/admin/stats');

      // Should show stats cards
      await expect(page.locator('[data-testid="stats-grid"]')).toBeVisible();

      // Verify user stats
      const userStats = page.locator('[data-testid="users-stats-card"]');
      await expect(userStats.locator('[data-testid="total-users"]')).toContainText('150');
      await expect(userStats.locator('[data-testid="active-users"]')).toContainText('89');

      // Verify request stats
      const requestStats = page.locator('[data-testid="requests-stats-card"]');
      await expect(requestStats.locator('[data-testid="total-requests"]')).toContainText('543');
      await expect(requestStats.locator('[data-testid="pending-requests"]')).toContainText('23');

      // Verify download stats
      const downloadStats = page.locator('[data-testid="downloads-stats-card"]');
      await expect(downloadStats.locator('[data-testid="total-downloads"]')).toContainText('298');
      await expect(downloadStats.locator('[data-testid="active-downloads"]')).toContainText('5');
    });

    test('should display interactive charts', async () => {
      await page.goto('/admin/stats');

      // Should show charts
      await expect(page.locator('[data-testid="usage-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="activity-timeline"]')).toBeVisible();

      // Chart should be interactive
      const chart = page.locator('[data-testid="usage-chart"]');
      await chart.hover();
      await expect(page.locator('[data-testid="chart-tooltip"]')).toBeVisible();
    });

    test('should filter stats by time period', async () => {
      await page.goto('/admin/stats');

      // Change time period
      await page.selectOption('[data-testid="time-period-select"]', '7d');
      
      // Should reload stats
      await expect(page.locator('[data-testid="stats-loading"]')).toBeVisible();
      await expect(page.locator('[data-testid="time-period-label"]')).toContainText('Last 7 days');
    });
  });

  test.describe('Configuration Management', () => {
    test('should display service configurations', async () => {
      await page.goto('/admin/config');

      // Should show configuration sections
      await expect(page.locator('[data-testid="config-sections"]')).toBeVisible();
      await expect(page.locator('[data-testid="plex-config"]')).toBeVisible();
      await expect(page.locator('[data-testid="overseerr-config"]')).toBeVisible();
    });

    test('should update service configuration', async () => {
      await page.goto('/admin/config');

      // Click edit button for Plex config
      await page.click('[data-testid="edit-plex-config"]');

      // Should show configuration form
      await expect(page.locator('[data-testid="config-form"]')).toBeVisible();

      // Update configuration
      await page.fill('[data-testid="base-url-input"]', 'https://new-plex.example.com');
      await page.click('[data-testid="save-config"]');

      // Should show success message
      await expect(page.locator('[data-testid="config-update-success"]')).toBeVisible();
    });

    test('should validate configuration before saving', async () => {
      await page.goto('/admin/config');

      // Edit configuration with invalid data
      await page.click('[data-testid="edit-plex-config"]');
      await page.fill('[data-testid="base-url-input"]', 'invalid-url');
      await page.click('[data-testid="save-config"]');

      // Should show validation error
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="validation-error"]')).toContainText(/invalid url/i);
    });
  });

  test.describe('Activity Logs Viewing', () => {
    test('should display activity logs', async () => {
      // Mock activity logs
      await page.route('**/api/v1/admin/logs', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              logs: [
                {
                  id: 'log-1',
                  action: 'user_role_updated',
                  userId: 'user-1',
                  adminId: 'admin-123',
                  details: { oldRole: 'user', newRole: 'admin' },
                  timestamp: '2024-01-21T10:30:00Z'
                },
                {
                  id: 'log-2',
                  action: 'user_deleted',
                  userId: 'user-2',
                  adminId: 'admin-123',
                  details: { username: 'deleted_user' },
                  timestamp: '2024-01-21T09:15:00Z'
                }
              ]
            }
          })
        });
      });

      await page.goto('/admin/logs');

      // Should show logs table
      await expect(page.locator('[data-testid="logs-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="log-entry"]')).toHaveCount(2);

      // Verify log entry details
      const firstLog = page.locator('[data-testid="log-entry"]').first();
      await expect(firstLog.locator('[data-testid="action"]')).toContainText('user_role_updated');
      await expect(firstLog.locator('[data-testid="timestamp"]')).toContainText('2024-01-21');
    });

    test('should filter logs by action type', async () => {
      await page.goto('/admin/logs');

      // Filter by action type
      await page.selectOption('[data-testid="action-filter"]', 'user_role_updated');

      // Should filter logs
      await expect(page.locator('[data-testid="log-entry"]')).toHaveCount(1);
    });

    test('should search logs by user', async () => {
      await page.goto('/admin/logs');

      // Search by username
      await page.fill('[data-testid="log-search"]', 'deleted_user');
      await page.keyboard.press('Enter');

      // Should show matching logs
      await expect(page.locator('[data-testid="log-entry"]')).toHaveCount(1);
    });
  });

  test.describe('Broadcast Messages', () => {
    test('should send broadcast message to all users', async () => {
      // Mock broadcast endpoint
      await page.route('**/api/v1/admin/broadcast', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Broadcast sent successfully'
            })
          });
        }
      });

      await page.goto('/admin/broadcast');

      // Fill broadcast form
      await page.fill('[data-testid="message-title"]', 'System Maintenance');
      await page.fill('[data-testid="message-content"]', 'System will be down for maintenance from 2-4 AM UTC.');
      await page.selectOption('[data-testid="message-type"]', 'warning');

      // Send broadcast
      await page.click('[data-testid="send-broadcast"]');

      // Should show success message
      await expect(page.locator('[data-testid="broadcast-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="broadcast-success"]')).toContainText(/sent successfully/i);
    });

    test('should preview broadcast message', async () => {
      await page.goto('/admin/broadcast');

      // Fill message
      await page.fill('[data-testid="message-title"]', 'Test Message');
      await page.fill('[data-testid="message-content"]', 'This is a test message.');

      // Click preview
      await page.click('[data-testid="preview-message"]');

      // Should show preview modal
      await expect(page.locator('[data-testid="message-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="preview-title"]')).toContainText('Test Message');
      await expect(page.locator('[data-testid="preview-content"]')).toContainText('This is a test message.');
    });
  });

  test.describe('User Session Management', () => {
    test('should display active user sessions', async () => {
      // Mock sessions endpoint
      await page.route('**/api/v1/admin/sessions', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessions: [
                {
                  id: 'session-1',
                  userId: 'user-1',
                  username: 'john_doe',
                  ipAddress: '192.168.1.100',
                  userAgent: 'Mozilla/5.0 Chrome/91.0',
                  lastActivity: '2024-01-21T10:45:00Z',
                  createdAt: '2024-01-21T08:30:00Z'
                }
              ]
            }
          })
        });
      });

      await page.goto('/admin/sessions');

      // Should show sessions table
      await expect(page.locator('[data-testid="sessions-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="session-row"]')).toHaveCount(1);

      // Verify session details
      const sessionRow = page.locator('[data-testid="session-row"]').first();
      await expect(sessionRow.locator('[data-testid="username"]')).toContainText('john_doe');
      await expect(sessionRow.locator('[data-testid="ip-address"]')).toContainText('192.168.1.100');
    });

    test('should terminate user session', async () => {
      await page.goto('/admin/sessions');

      // Click terminate session
      await page.click('[data-testid="terminate-session-1"]');

      // Should show confirmation
      await expect(page.locator('[data-testid="terminate-confirmation"]')).toBeVisible();
      await page.click('[data-testid="confirm-terminate"]');

      // Should show success message
      await expect(page.locator('[data-testid="session-terminated"]')).toBeVisible();
    });
  });

  test.describe('Performance Testing', () => {
    test('should load admin dashboard within performance budget', async () => {
      const startTime = Date.now();
      await page.goto('/admin');
      
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Should load within 2 seconds
      expect(loadTime).toBeLessThan(2000);
    });

    test('should handle large user datasets efficiently', async () => {
      // Mock large user dataset
      const largeUserList = Array.from({ length: 1000 }, (_, i) => ({
        id: `user-${i}`,
        plexUsername: `user_${i}`,
        email: `user${i}@example.com`,
        role: i % 10 === 0 ? 'admin' : 'user'
      }));

      await page.route('**/api/v1/admin/users**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              users: largeUserList.slice(0, 20), // Paginated
              pagination: {
                total: 1000,
                page: 1,
                pageSize: 20,
                totalPages: 50
              }
            }
          })
        });
      });

      const startTime = Date.now();
      await page.goto('/admin/users');
      await page.waitForLoadState('networkidle');
      const renderTime = Date.now() - startTime;

      // Should render within 1.5 seconds even with pagination
      expect(renderTime).toBeLessThan(1500);
    });
  });

  test.describe('Accessibility Testing', () => {
    test('should be navigable by keyboard', async () => {
      await page.goto('/admin');

      // Test keyboard navigation through admin interface
      await page.keyboard.press('Tab'); // First navigation item
      await expect(page.locator('[data-testid="nav-users"]')).toBeFocused();

      await page.keyboard.press('Tab'); // Services nav
      await expect(page.locator('[data-testid="nav-services"]')).toBeFocused();

      await page.keyboard.press('Enter'); // Navigate to services
      await expect(page).toHaveURL('/admin/services');
    });

    test('should have proper ARIA labels for admin controls', async () => {
      await page.goto('/admin/users');

      // Check ARIA labels on user management controls
      await expect(page.locator('[data-testid="edit-role-btn"]').first()).toHaveAttribute('aria-label', /edit role/i);
      await expect(page.locator('[data-testid="delete-user-btn"]').first()).toHaveAttribute('aria-label', /delete user/i);
      await expect(page.locator('[data-testid="user-search"]')).toHaveAttribute('aria-label', /search users/i);
    });

    test('should announce important actions to screen readers', async () => {
      await page.goto('/admin/users');

      // Perform user role update
      await page.click('[data-testid="edit-role-btn"]');
      await page.selectOption('[data-testid="new-role-select"]', 'admin');
      await page.click('[data-testid="save-role-btn"]');

      // Should have live region announcement
      await expect(page.locator('[aria-live="assertive"]')).toContainText(/role updated/i);
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should work on mobile viewport', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/admin');

      // Should show mobile-friendly navigation
      await expect(page.locator('[data-testid="mobile-nav-toggle"]')).toBeVisible();
      
      // Tap to open navigation
      await page.tap('[data-testid="mobile-nav-toggle"]');
      await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();

      // Navigate to users page
      await page.tap('[data-testid="nav-users"]');
      await expect(page).toHaveURL('/admin/users');
    });

    test('should have responsive tables', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/admin/users');

      // Table should be horizontally scrollable or stack on mobile
      const table = page.locator('[data-testid="users-table"]');
      await expect(table).toBeVisible();
      
      // Should have horizontal scroll or card layout
      const tableStyle = await table.evaluate(el => getComputedStyle(el).overflowX);
      expect(['auto', 'scroll', 'hidden']).toContain(tableStyle);
    });

    test('should have touch-friendly controls', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/admin/users');

      // Action buttons should meet minimum touch target size
      const editButton = page.locator('[data-testid="edit-role-btn"]').first();
      const buttonSize = await editButton.boundingBox();
      
      expect(buttonSize!.height).toBeGreaterThanOrEqual(44);
      expect(buttonSize!.width).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    test('should work consistently across browsers', async () => {
      await page.goto('/admin');

      // Basic admin functionality should work the same
      await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
      
      // Navigate to users
      await page.click('[data-testid="nav-users"]');
      await expect(page.locator('[data-testid="users-table"]')).toBeVisible();
      
      // User management should work
      await page.click('[data-testid="edit-role-btn"]');
      await expect(page.locator('[data-testid="edit-role-modal"]')).toBeVisible();
    });

    test('should handle browser-specific styling correctly', async () => {
      await page.goto('/admin/stats');

      // Charts should render correctly across browsers
      await expect(page.locator('[data-testid="usage-chart"]')).toBeVisible();
      
      // CSS Grid/Flexbox layouts should work
      const statsGrid = page.locator('[data-testid="stats-grid"]');
      const gridDisplay = await statsGrid.evaluate(el => getComputedStyle(el).display);
      expect(['grid', 'flex']).toContain(gridDisplay);
    });
  });

  test.describe('Security Testing', () => {
    test('should protect against CSRF attacks', async () => {
      await page.goto('/admin/users');

      // Should include CSRF token in forms
      const form = page.locator('[data-testid="user-form"]');
      await expect(form.locator('input[name="_token"]')).toBeVisible();
    });

    test('should sanitize user input in admin interface', async () => {
      await page.goto('/admin/broadcast');

      // Try to inject script in message
      const maliciousScript = '<script>alert("XSS")</script>';
      await page.fill('[data-testid="message-content"]', maliciousScript);
      
      // Click preview to see if script is executed
      await page.click('[data-testid="preview-message"]');
      
      // Script should be sanitized and not executed
      const previewContent = page.locator('[data-testid="preview-content"]');
      const textContent = await previewContent.textContent();
      expect(textContent).not.toContain('<script>');
    });
  });
});