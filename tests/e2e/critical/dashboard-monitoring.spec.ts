import { test, expect } from '../helpers/hive-mind/coordination';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MockManager } from '../fixtures/mocks';
import { testUsers, serviceEndpoints } from '../fixtures/test-data';

test.describe('Critical User Journey - Dashboard Service Monitoring', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let mockManager: MockManager;

  test.beforeEach(async ({ page, hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Starting dashboard monitoring tests');
    
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    mockManager = new MockManager(page);

    await mockManager.setupBasicMocks();
    await mockManager.mockServiceStatus();

    // Login before each test
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await dashboardPage.waitForLoad();
  });

  test('Service status monitoring and real-time updates', async ({ page, hiveMind }) => {
    await hiveMind.storeInMemory(hiveMind, 'dashboard/monitoring-start', {
      testType: 'service-status-monitoring',
      startTime: Date.now()
    });

    // Verify initial service statuses
    const initialStatuses = {
      plex: await dashboardPage.getServiceStatus('plex'),
      overseerr: await dashboardPage.getServiceStatus('overseerr'),
      uptimeKuma: await dashboardPage.getServiceStatus('uptime-kuma')
    };

    await hiveMind.storeInMemory(hiveMind, 'dashboard/initial-statuses', initialStatuses);

    // Verify service cards are displayed
    const serviceCardCount = await dashboardPage.getServiceCardCount();
    expect(serviceCardCount).toBeGreaterThanOrEqual(3);

    await hiveMind.notifyHiveMind(hiveMind, `Dashboard showing ${serviceCardCount} service cards`);

    // Test real-time status updates via WebSocket
    await dashboardPage.waitForRealtimeUpdate();

    // Mock a service status change
    await page.route('/api/services/plex/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'down',
          version: '1.32.5.7349',
          machineIdentifier: 'test-machine-id',
          updatedAt: new Date().toISOString(),
          error: 'Connection timeout'
        })
      });
    });

    // Trigger a status refresh
    await page.reload();
    await dashboardPage.waitForLoad();

    // Wait for status change to propagate
    await dashboardPage.waitForServiceStatus('plex', 'down');

    const updatedStatus = await dashboardPage.getServiceStatus('plex');
    expect(updatedStatus).toBe('down');

    await hiveMind.storeInMemory(hiveMind, 'dashboard/status-change', {
      service: 'plex',
      previousStatus: initialStatuses.plex,
      newStatus: updatedStatus,
      changeDetected: true
    });

    await hiveMind.notifyHiveMind(hiveMind, 'Real-time status update verified');

    // Verify error information is displayed
    await expect(page.locator('[data-testid="plex-error-info"]')).toBeVisible();

    await hiveMind.notifyHiveMind(hiveMind, 'Service error information displayed');
  });

  test('Service health dashboard overview', async ({ page, hiveMind }) => {
    // Verify dashboard overview components
    await expect(page.locator('[data-testid="dashboard-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="service-overview"]')).toBeVisible();

    // Check service health indicators
    const healthIndicators = await page.locator('[data-testid="health-indicator"]').count();
    expect(healthIndicators).toBeGreaterThan(0);

    await hiveMind.storeInMemory(hiveMind, 'dashboard/health-overview', {
      healthIndicators,
      overviewVisible: true
    });

    // Verify quick actions are available
    const quickActionsVisible = await dashboardPage.areQuickActionsVisible();
    expect(quickActionsVisible).toBe(true);

    // Test quick action functionality
    const quickActions = [
      { name: 'Refresh Services', selector: '[data-testid="refresh-services"]' },
      { name: 'View Logs', selector: '[data-testid="view-logs"]' },
      { name: 'System Status', selector: '[data-testid="system-status"]' }
    ];

    for (const action of quickActions) {
      const element = page.locator(action.selector);
      if (await element.isVisible()) {
        await expect(element).toBeEnabled();
        await hiveMind.storeInMemory(hiveMind, `dashboard/quick-action-${action.name.toLowerCase().replace(/\s+/g, '-')}`, {
          available: true,
          enabled: true
        });
      }
    }

    await hiveMind.notifyHiveMind(hiveMind, 'Dashboard overview verification completed');

    // Test service detail modals
    await page.click('[data-testid="plex-service-card"]');
    await expect(page.locator('[data-testid="service-detail-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="service-detail-plex"]')).toBeVisible();

    // Verify service details
    await expect(page.locator('[data-testid="service-version"]')).toBeVisible();
    await expect(page.locator('[data-testid="service-uptime"]')).toBeVisible();
    await expect(page.locator('[data-testid="service-connections"]')).toBeVisible();

    // Close modal
    await page.click('[data-testid="close-modal"]');
    await expect(page.locator('[data-testid="service-detail-modal"]')).not.toBeVisible();

    await hiveMind.notifyHiveMind(hiveMind, 'Service detail modal functionality verified');
  });

  test('Uptime monitoring and historical data', async ({ page, hiveMind }) => {
    // Navigate to uptime monitoring section
    await page.click('[data-testid="uptime-kuma-card"]');
    await expect(page.locator('[data-testid="uptime-detail"]')).toBeVisible();

    // Verify uptime displays
    const uptimeDisplays = await page.locator('[data-testid="uptime-display"]').count();
    expect(uptimeDisplays).toBeGreaterThan(0);

    await hiveMind.storeInMemory(hiveMind, 'dashboard/uptime-monitoring', {
      uptimeDisplays,
      monitoringActive: true
    });

    // Check for historical data charts
    const charts = await page.locator('[data-testid="uptime-chart"]').count();
    if (charts > 0) {
      await expect(page.locator('[data-testid="uptime-chart"]').first()).toBeVisible();
      
      await hiveMind.storeInMemory(hiveMind, 'dashboard/historical-data', {
        chartsAvailable: true,
        chartCount: charts
      });
    }

    // Verify monitor status list
    await expect(page.locator('[data-testid="monitor-list"]')).toBeVisible();

    const monitors = await page.locator('[data-testid="monitor-item"]').count();
    expect(monitors).toBeGreaterThanOrEqual(1);

    // Check individual monitor statuses
    const monitorStatuses = [];
    for (let i = 0; i < Math.min(monitors, 5); i++) {
      const monitor = page.locator('[data-testid="monitor-item"]').nth(i);
      const name = await monitor.locator('[data-testid="monitor-name"]').textContent();
      const status = await monitor.locator('[data-testid="monitor-status"]').textContent();
      
      monitorStatuses.push({ name, status });
    }

    await hiveMind.storeInMemory(hiveMind, 'dashboard/monitor-statuses', {
      totalMonitors: monitors,
      statuses: monitorStatuses
    });

    await hiveMind.notifyHiveMind(hiveMind, `Uptime monitoring: ${monitors} monitors tracked`);

    // Test uptime percentage calculations
    for (const monitor of monitorStatuses) {
      if (monitor.status && monitor.status.includes('%')) {
        const percentage = parseFloat(monitor.status.replace('%', ''));
        expect(percentage).toBeGreaterThanOrEqual(0);
        expect(percentage).toBeLessThanOrEqual(100);
      }
    }

    await hiveMind.notifyHiveMind(hiveMind, 'Uptime percentages validated');
  });

  test('Service integration health checks', async ({ page, hiveMind }) => {
    // Test Plex integration health
    await page.click('[data-testid="plex-health-check"]');
    
    // Wait for health check to complete
    await expect(page.locator('[data-testid="health-check-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="health-check-progress"]')).not.toBeVisible({ timeout: 10000 });

    // Verify health check results
    await expect(page.locator('[data-testid="health-check-results"]')).toBeVisible();

    const healthCheckItems = [
      { name: 'API Connectivity', selector: '[data-testid="api-connectivity-check"]' },
      { name: 'Authentication', selector: '[data-testid="auth-check"]' },
      { name: 'Library Access', selector: '[data-testid="library-access-check"]' },
      { name: 'Metadata Service', selector: '[data-testid="metadata-service-check"]' }
    ];

    const healthResults = [];
    for (const check of healthCheckItems) {
      const element = page.locator(check.selector);
      if (await element.isVisible()) {
        const status = await element.getAttribute('data-status');
        healthResults.push({
          name: check.name,
          status: status || 'unknown'
        });
      }
    }

    await hiveMind.storeInMemory(hiveMind, 'dashboard/plex-health-check', {
      totalChecks: healthCheckItems.length,
      results: healthResults,
      completedAt: new Date().toISOString()
    });

    const passedChecks = healthResults.filter(result => result.status === 'pass').length;
    expect(passedChecks).toBeGreaterThan(0);

    await hiveMind.notifyHiveMind(hiveMind, `Plex health check: ${passedChecks}/${healthResults.length} checks passed`);

    // Test Overseerr integration health
    await page.click('[data-testid="overseerr-health-check"]');
    
    await expect(page.locator('[data-testid="health-check-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="health-check-progress"]')).not.toBeVisible({ timeout: 10000 });

    const overseerrHealthItems = [
      { name: 'API Connection', selector: '[data-testid="overseerr-api-check"]' },
      { name: 'Plex Integration', selector: '[data-testid="overseerr-plex-check"]' },
      { name: 'Request Processing', selector: '[data-testid="request-processing-check"]' }
    ];

    const overseerrResults = [];
    for (const check of overseerrHealthItems) {
      const element = page.locator(check.selector);
      if (await element.isVisible()) {
        const status = await element.getAttribute('data-status');
        overseerrResults.push({
          name: check.name,
          status: status || 'unknown'
        });
      }
    }

    await hiveMind.storeInMemory(hiveMind, 'dashboard/overseerr-health-check', {
      totalChecks: overseerrHealthItems.length,
      results: overseerrResults,
      completedAt: new Date().toISOString()
    });

    const overseerrPassedChecks = overseerrResults.filter(result => result.status === 'pass').length;

    await hiveMind.notifyHiveMind(hiveMind, 
      `Overseerr health check: ${overseerrPassedChecks}/${overseerrResults.length} checks passed`
    );

    // Overall integration health summary
    const totalChecks = healthResults.length + overseerrResults.length;
    const totalPassed = passedChecks + overseerrPassedChecks;
    const healthPercentage = (totalPassed / totalChecks) * 100;

    await hiveMind.storeInMemory(hiveMind, 'dashboard/integration-health-summary', {
      totalChecks,
      totalPassed,
      healthPercentage,
      plexHealth: healthResults,
      overseerrHealth: overseerrResults
    });

    expect(healthPercentage).toBeGreaterThanOrEqual(50);

    await hiveMind.notifyHiveMind(hiveMind, 
      `Overall integration health: ${totalPassed}/${totalChecks} checks passed (${healthPercentage}%)`
    );
  });

  test('Dashboard performance and responsiveness', async ({ page, hiveMind }) => {
    const performanceMetrics = {
      initialLoad: 0,
      serviceStatusUpdate: 0,
      realTimeUpdate: 0,
      modalOpen: 0
    };

    // Measure initial dashboard load time
    const loadStartTime = Date.now();
    await page.reload();
    await dashboardPage.waitForLoad();
    performanceMetrics.initialLoad = Date.now() - loadStartTime;

    // Measure service status refresh time
    const refreshStartTime = Date.now();
    await page.click('[data-testid="refresh-services"]');
    await page.waitForSelector('[data-testid="refresh-complete"]', { timeout: 10000 });
    performanceMetrics.serviceStatusUpdate = Date.now() - refreshStartTime;

    // Measure real-time update responsiveness
    const realtimeStartTime = Date.now();
    await dashboardPage.waitForRealtimeUpdate();
    performanceMetrics.realTimeUpdate = Date.now() - realtimeStartTime;

    // Measure modal open performance
    const modalStartTime = Date.now();
    await page.click('[data-testid="plex-service-card"]');
    await page.waitForSelector('[data-testid="service-detail-modal"]');
    performanceMetrics.modalOpen = Date.now() - modalStartTime;

    await page.click('[data-testid="close-modal"]');

    await hiveMind.storeInMemory(hiveMind, 'dashboard/performance-metrics', {
      metrics: performanceMetrics,
      measuredAt: new Date().toISOString()
    });

    // Verify performance benchmarks
    expect(performanceMetrics.initialLoad).toBeLessThan(5000); // 5 seconds
    expect(performanceMetrics.serviceStatusUpdate).toBeLessThan(3000); // 3 seconds
    expect(performanceMetrics.realTimeUpdate).toBeLessThan(2000); // 2 seconds
    expect(performanceMetrics.modalOpen).toBeLessThan(1000); // 1 second

    await hiveMind.notifyHiveMind(hiveMind, 
      `Dashboard performance: Load=${performanceMetrics.initialLoad}ms, ` +
      `Refresh=${performanceMetrics.serviceStatusUpdate}ms, ` +
      `RealTime=${performanceMetrics.realTimeUpdate}ms, ` +
      `Modal=${performanceMetrics.modalOpen}ms`
    );

    // Test responsiveness under load
    const concurrentActions = [
      () => page.click('[data-testid="plex-service-card"]'),
      () => page.click('[data-testid="close-modal"]'),
      () => page.click('[data-testid="overseerr-service-card"]'),
      () => page.click('[data-testid="close-modal"]'),
      () => page.click('[data-testid="refresh-services"]')
    ];

    const loadTestStartTime = Date.now();
    await Promise.all(concurrentActions.map(action => action().catch(() => {})));
    const loadTestTime = Date.now() - loadTestStartTime;

    await hiveMind.storeInMemory(hiveMind, 'dashboard/load-test', {
      concurrentActions: concurrentActions.length,
      totalTime: loadTestTime,
      averageActionTime: loadTestTime / concurrentActions.length
    });

    expect(loadTestTime).toBeLessThan(10000); // 10 seconds for all actions

    await hiveMind.notifyHiveMind(hiveMind, 
      `Load test completed: ${concurrentActions.length} actions in ${loadTestTime}ms`
    );
  });
});