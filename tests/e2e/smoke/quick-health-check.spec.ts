import { test, expect } from '../helpers/hive-mind/coordination';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MockManager } from '../fixtures/mocks';
import { testUsers, performanceBenchmarks } from '../fixtures/test-data';

test.describe('Smoke Tests - Quick Health Check', () => {
  test.setTimeout(60000); // 1 minute timeout for smoke tests

  test('Complete application health check', async ({ page, hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Starting comprehensive health check');
    
    const healthCheck = {
      pageLoad: false,
      authentication: false,
      dashboard: false,
      services: false,
      navigation: false
    };

    const mockManager = new MockManager(page);
    await mockManager.setupBasicMocks();

    try {
      // 1. Page Load Test
      const startTime = Date.now();
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      
      const loadTime = Date.now() - startTime;
      healthCheck.pageLoad = loadTime < performanceBenchmarks.pageLoad.fast;
      
      await hiveMind.storeInMemory(hiveMind, 'health/pageLoad', {
        success: healthCheck.pageLoad,
        loadTime
      });

      // 2. Authentication Test
      const authStartTime = Date.now();
      await loginPage.login(testUsers.admin.email, testUsers.admin.password);
      
      const authTime = Date.now() - authStartTime;
      healthCheck.authentication = await page.locator('[data-testid="dashboard-container"]').isVisible();
      
      await hiveMind.storeInMemory(hiveMind, 'health/authentication', {
        success: healthCheck.authentication,
        authTime
      });

      // 3. Dashboard Test
      const dashboardPage = new DashboardPage(page);
      await dashboardPage.waitForLoad();
      
      const serviceCardCount = await dashboardPage.getServiceCardCount();
      healthCheck.dashboard = serviceCardCount > 0;
      
      await hiveMind.storeInMemory(hiveMind, 'health/dashboard', {
        success: healthCheck.dashboard,
        serviceCardCount
      });

      // 4. Services Test
      const services = {
        plex: await dashboardPage.getServiceStatus('plex'),
        overseerr: await dashboardPage.getServiceStatus('overseerr'),
        uptimeKuma: await dashboardPage.getServiceStatus('uptime-kuma')
      };
      
      const servicesUp = Object.values(services).filter(status => status === 'up').length;
      healthCheck.services = servicesUp > 0;
      
      await hiveMind.storeInMemory(hiveMind, 'health/services', {
        success: healthCheck.services,
        services,
        servicesUp
      });

      // 5. Basic Navigation Test
      await dashboardPage.goToMediaSearch();
      const mediaPageLoaded = await page.locator('[data-testid="media-search"]').isVisible({ timeout: 5000 });
      healthCheck.navigation = mediaPageLoaded;
      
      await hiveMind.storeInMemory(hiveMind, 'health/navigation', {
        success: healthCheck.navigation
      });

    } catch (error) {
      await hiveMind.storeInMemory(hiveMind, 'health/error', {
        error: error.message,
        healthCheck
      });
      
      await hiveMind.notifyHiveMind(hiveMind, `Health check failed: ${error.message}`);
      throw error;
    }

    // Verify overall health
    const totalChecks = Object.keys(healthCheck).length;
    const passedChecks = Object.values(healthCheck).filter(Boolean).length;
    const healthPercentage = (passedChecks / totalChecks) * 100;

    await hiveMind.storeInMemory(hiveMind, 'health/summary', {
      totalChecks,
      passedChecks,
      healthPercentage,
      healthCheck
    });

    // Require at least 80% health for smoke test to pass
    expect(healthPercentage).toBeGreaterThanOrEqual(80);

    await hiveMind.notifyHiveMind(hiveMind, 
      `Health check completed: ${passedChecks}/${totalChecks} checks passed (${healthPercentage}%)`
    );
  });

  test('Critical endpoints are responding', async ({ page, hiveMind }) => {
    const mockManager = new MockManager(page);
    await mockManager.setupBasicMocks();

    const endpoints = [
      { name: 'Auth API', url: '/api/auth/signin', method: 'GET' },
      { name: 'Dashboard API', url: '/api/dashboard', method: 'GET' },
      { name: 'Services API', url: '/api/services/status', method: 'GET' }
    ];

    const endpointResults = [];

    for (const endpoint of endpoints) {
      try {
        const response = await page.request.fetch(endpoint.url, {
          method: endpoint.method
        });

        const success = response.status() < 500;
        endpointResults.push({
          name: endpoint.name,
          url: endpoint.url,
          status: response.status(),
          success
        });

        await hiveMind.storeInMemory(hiveMind, `endpoints/${endpoint.name.toLowerCase().replace(/\s+/g, '-')}`, {
          success,
          status: response.status()
        });

      } catch (error) {
        endpointResults.push({
          name: endpoint.name,
          url: endpoint.url,
          status: 0,
          success: false,
          error: error.message
        });
      }
    }

    const successfulEndpoints = endpointResults.filter(result => result.success).length;
    const endpointHealthPercentage = (successfulEndpoints / endpoints.length) * 100;

    await hiveMind.storeInMemory(hiveMind, 'endpoints/summary', {
      totalEndpoints: endpoints.length,
      successfulEndpoints,
      healthPercentage: endpointHealthPercentage,
      results: endpointResults
    });

    // Require at least 50% of critical endpoints to be responding
    expect(endpointHealthPercentage).toBeGreaterThanOrEqual(50);

    await hiveMind.notifyHiveMind(hiveMind, 
      `Endpoint health: ${successfulEndpoints}/${endpoints.length} endpoints responding`
    );
  });

  test('Performance benchmarks are met', async ({ page, hiveMind }) => {
    const mockManager = new MockManager(page);
    await mockManager.setupBasicMocks();

    const performanceMetrics = {
      pageLoad: 0,
      timeToInteractive: 0,
      firstContentfulPaint: 0
    };

    // Measure page load performance
    const startTime = Date.now();
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');
    performanceMetrics.pageLoad = Date.now() - startTime;

    // Get additional performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        timeToInteractive: navigation.domInteractive - navigation.navigationStart,
        firstContentfulPaint: navigation.domContentLoadedEventEnd - navigation.navigationStart
      };
    });

    performanceMetrics.timeToInteractive = metrics.timeToInteractive;
    performanceMetrics.firstContentfulPaint = metrics.firstContentfulPaint;

    // Check against benchmarks
    const benchmarkResults = {
      pageLoad: performanceMetrics.pageLoad < performanceBenchmarks.pageLoad.moderate,
      timeToInteractive: performanceMetrics.timeToInteractive < 3000, // 3 seconds
      firstContentfulPaint: performanceMetrics.firstContentfulPaint < 2000 // 2 seconds
    };

    await hiveMind.storeInMemory(hiveMind, 'performance/metrics', {
      metrics: performanceMetrics,
      benchmarks: benchmarkResults
    });

    const passedBenchmarks = Object.values(benchmarkResults).filter(Boolean).length;
    const totalBenchmarks = Object.keys(benchmarkResults).length;

    // Require at least 2 out of 3 performance benchmarks to pass
    expect(passedBenchmarks).toBeGreaterThanOrEqual(2);

    await hiveMind.notifyHiveMind(hiveMind, 
      `Performance benchmarks: ${passedBenchmarks}/${totalBenchmarks} passed`
    );
  });
});