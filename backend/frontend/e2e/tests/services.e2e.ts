import { test, expect } from '@playwright/test';

import { DashboardPage } from '../pages/DashboardPage';
import { ServicesPage } from '../pages/ServicesPage';

/**
 * Services Management E2E Tests for MediaNest
 * Tests service management workflow and monitoring
 */
test.describe('Services Management', () => {
  let servicesPage: ServicesPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    servicesPage = new ServicesPage(page);
    dashboardPage = new DashboardPage(page);

    // Start from dashboard and navigate to services
    await dashboardPage.goto();
    await dashboardPage.goToServices();
  });

  test('should display services list correctly', async ({ page }) => {
    await servicesPage.expectServicesPageLoaded();

    // Verify page elements
    await expect(servicesPage.servicesList).toBeVisible();
    await expect(servicesPage.addServiceButton).toBeVisible();
    await expect(servicesPage.searchInput).toBeVisible();

    // Get all service cards
    const serviceCards = await servicesPage.getServiceCards();
    expect(serviceCards.length).toBeGreaterThan(0);

    // Verify first service card has required elements
    const firstCard = serviceCards[0];
    await expect(firstCard.getByTestId('service-name')).toBeVisible();
    await expect(firstCard.getByTestId('service-status')).toBeVisible();
    await expect(firstCard.getByTestId('toggle-status-btn')).toBeVisible();
  });

  test('should toggle service status', async ({ page }) => {
    // Find an active service
    const activeService = servicesPage.getServiceCard('test-service-1');
    await expect(activeService).toBeVisible();

    // Verify initial status
    await servicesPage.verifyServiceDetails('test-service-1', {
      status: 'active',
    });

    // Toggle status
    const newStatus = await servicesPage.toggleServiceStatus('test-service-1');
    expect(newStatus).toBe('inactive');

    // Verify status changed
    await servicesPage.verifyServiceDetails('test-service-1', {
      status: 'inactive',
    });

    // Toggle back
    await servicesPage.toggleServiceStatus('test-service-1');
    await servicesPage.verifyServiceDetails('test-service-1', {
      status: 'active',
    });
  });

  test('should retry failed services', async ({ page }) => {
    // Mock a service in error state
    await page.evaluate(() => {
      const errorService = {
        id: 'error-service',
        name: 'Error Service',
        status: 'error',
        lastChecked: new Date().toISOString(),
        uptime: 0.85,
        responseTime: 0,
        errorCount: 5,
      };

      const services = JSON.parse(localStorage.getItem('test-services') || '[]');
      services.push(errorService);
      localStorage.setItem('test-services', JSON.stringify(services));
    });

    await page.reload();

    // Find the error service
    const errorService = servicesPage.getServiceCard('error-service');
    await expect(errorService).toBeVisible();

    // Verify retry button is visible
    const retryButton = errorService.getByTestId('retry-btn');
    await expect(retryButton).toBeVisible();

    // Mock successful retry API response
    await page.route('**/api/services/*/retry', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          status: 'active',
          message: 'Service retried successfully',
        }),
      });
    });

    // Perform retry
    await servicesPage.retryService('error-service');

    // Verify status changed after retry
    await servicesPage.verifyServiceDetails('error-service', {
      status: 'active',
    });
  });

  test('should add new service', async ({ page }) => {
    // Mock API response for adding service
    await page.route('**/api/services', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          body: JSON.stringify({
            id: 'new-test-service',
            name: 'New Test Service',
            url: 'http://localhost:8080',
            type: 'web',
            status: 'active',
            description: 'A test service for E2E testing',
          }),
        });
      } else {
        route.continue();
      }
    });

    // Add new service
    await servicesPage.addService({
      name: 'New Test Service',
      url: 'http://localhost:8080',
      type: 'web',
      description: 'A test service for E2E testing',
    });

    // Verify service was added
    const newService = servicesPage.getServiceCard('new-test-service');
    await expect(newService).toBeVisible();

    await servicesPage.verifyServiceDetails('new-test-service', {
      name: 'New Test Service',
      status: 'active',
    });
  });

  test('should search and filter services', async ({ page }) => {
    // Test search functionality
    await servicesPage.searchServices('Test Media');

    // Verify search results
    const visibleServices = await servicesPage.getServiceCards();
    expect(visibleServices.length).toBeGreaterThan(0);

    // Each visible service should contain search term
    for (const service of visibleServices) {
      const serviceName = await service.getByTestId('service-name').textContent();
      expect(serviceName?.toLowerCase()).toContain('test media');
    }

    // Clear search
    await servicesPage.searchServices('');

    // Test filtering by status
    await servicesPage.filterByStatus('active');

    // Verify only active services are shown
    const activeServices = await servicesPage.getServiceCards();
    for (const service of activeServices) {
      const status = await service.getAttribute('data-status');
      expect(status).toBe('active');
    }
  });

  test('should sort services', async ({ page }) => {
    // Sort by name
    await servicesPage.sortServices('name');
    await servicesPage.verifySortOrder('name');

    // Sort by status
    await servicesPage.sortServices('status');
    await servicesPage.verifySortOrder('status');
  });

  test('should refresh services list', async ({ page }) => {
    // Mock API response for refresh
    await page.route('**/api/services', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([
          {
            id: 'refreshed-service',
            name: 'Refreshed Service',
            status: 'active',
            lastChecked: new Date().toISOString(),
            uptime: 1.0,
            responseTime: 50,
            errorCount: 0,
          },
        ]),
      });
    });

    // Refresh services
    await servicesPage.refreshServices();

    // Verify refresh completed
    const refreshedService = servicesPage.getServiceCard('refreshed-service');
    await expect(refreshedService).toBeVisible();
  });

  test('should handle bulk operations', async ({ page }) => {
    // Mock bulk operation API
    await page.route('**/api/services/bulk', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          affectedServices: ['test-service-1', 'test-service-2'],
          message: 'Bulk operation completed',
        }),
      });
    });

    // Select multiple services
    await servicesPage.selectMultipleServices(['test-service-1', 'test-service-2']);

    // Verify bulk actions are available
    await expect(page.getByTestId('bulk-actions')).toBeVisible();

    // Perform bulk stop operation
    await servicesPage.performBulkAction('stop');

    // Verify operation completed
    await expect(page.getByTestId('bulk-success-message')).toBeVisible();
  });

  test('should delete service with confirmation', async ({ page }) => {
    // Add a service to delete
    await page.evaluate(() => {
      const deleteService = {
        id: 'delete-test-service',
        name: 'Delete Test Service',
        status: 'inactive',
        lastChecked: new Date().toISOString(),
        uptime: 0.5,
        responseTime: 200,
        errorCount: 3,
      };

      const services = JSON.parse(localStorage.getItem('test-services') || '[]');
      services.push(deleteService);
      localStorage.setItem('test-services', JSON.stringify(services));
    });

    await page.reload();

    // Mock delete API response
    await page.route('**/api/services/delete-test-service', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 204 });
      } else {
        route.continue();
      }
    });

    // Delete service
    await servicesPage.deleteService('delete-test-service');

    // Verify service was removed
    const deletedService = servicesPage.getServiceCard('delete-test-service');
    await expect(deletedService).toBeHidden();
  });

  test('should display service metrics correctly', async ({ page }) => {
    // Verify service metrics are displayed
    await servicesPage.verifyServiceDetails('test-service-1', {
      uptime: '99%',
      responseTime: '120ms',
      errorCount: '0',
    });

    // Check last checked time format
    const serviceCard = servicesPage.getServiceCard('test-service-1');
    const lastChecked = serviceCard.getByTestId('last-checked');
    await expect(lastChecked).toBeVisible();

    const lastCheckedText = await lastChecked.textContent();
    expect(lastCheckedText).toMatch(/(Just now|\d+[mhd] ago)/);
  });

  test('should handle empty state', async ({ page }) => {
    // Mock empty services response
    await page.route('**/api/services', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([]),
      });
    });

    await page.reload();

    // Verify empty state is shown
    await servicesPage.expectEmptyState();

    // Verify add service button is still available
    await expect(servicesPage.addServiceButton).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });

    // Services should stack vertically on mobile
    await expect(servicesPage.servicesList).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });

    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });

    // All controls should be visible on desktop
    await expect(servicesPage.addServiceButton).toBeVisible();
    await expect(servicesPage.searchInput).toBeVisible();
    await expect(servicesPage.filterDropdown).toBeVisible();
  });

  test('should show real-time status updates', async ({ page }) => {
    // Mock WebSocket for real-time updates
    await page.evaluate(() => {
      // Simulate WebSocket connection
      const mockWS = {
        send: () => {},
        close: () => {},
        addEventListener: (event: string, handler: Function) => {
          if (event === 'message') {
            // Simulate status update after 2 seconds
            setTimeout(() => {
              handler({
                data: JSON.stringify({
                  type: 'serviceStatusUpdate',
                  serviceId: 'test-service-1',
                  status: 'error',
                  responseTime: 0,
                  errorCount: 1,
                }),
              });
            }, 2000);
          }
        },
      };

      // Replace WebSocket constructor
      (window as any).WebSocket = function () {
        return mockWS;
      };
    });

    await page.reload();

    // Wait for real-time update
    await page.waitForTimeout(3000);

    // Verify status was updated
    await servicesPage.verifyServiceDetails('test-service-1', {
      status: 'error',
      errorCount: '1',
    });
  });
});
