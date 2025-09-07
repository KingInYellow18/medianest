import { test, expect } from '../helpers/hive-mind/coordination';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MockManager } from '../fixtures/mocks';
import { testUsers, performanceBenchmarks } from '../fixtures/test-data';

test.describe('Smoke Tests - Basic Functionality', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let mockManager: MockManager;

  test.beforeEach(async ({ page, hiveMind }) => {
    await hiveMind.initializeHiveMind(hiveMind);
    
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    mockManager = new MockManager(page);

    // Setup basic mocks for smoke tests
    await mockManager.setupBasicMocks();
    
    await hiveMind.storeInMemory(hiveMind, 'test/setup', {
      testType: 'smoke',
      startTime: Date.now()
    });

    await hiveMind.notifyHiveMind(hiveMind, 'Starting smoke test suite');
  });

  test('Application loads and displays login page', async ({ page, hiveMind }) => {
    const startTime = Date.now();
    
    await loginPage.goto();
    
    const loadTime = Date.now() - startTime;
    await hiveMind.storeInMemory(hiveMind, 'performance/page-load', { loadTime });

    // Verify page loads within performance benchmark
    expect(loadTime).toBeLessThan(performanceBenchmarks.pageLoad.moderate);
    
    // Verify login form is visible
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();

    await hiveMind.notifyHiveMind(hiveMind, `Login page loaded in ${loadTime}ms`);
  });

  test('Basic authentication flow works', async ({ page, hiveMind }) => {
    await loginPage.goto();
    
    const authStartTime = Date.now();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    const authTime = Date.now() - authStartTime;

    await hiveMind.storeInMemory(hiveMind, 'performance/auth', { authTime });

    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(dashboardPage.isDisplayed()).resolves.toBe(true);

    // Verify authentication time is reasonable
    expect(authTime).toBeLessThan(performanceBenchmarks.apiResponse.moderate);

    await hiveMind.notifyHiveMind(hiveMind, `Authentication completed in ${authTime}ms`);
  });

  test('Dashboard displays and shows service status', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    
    await dashboardPage.waitForLoad();

    // Verify dashboard components are visible
    await expect(page.locator('[data-testid="dashboard-container"]')).toBeVisible();
    
    // Verify service cards are displayed
    const serviceCardCount = await dashboardPage.getServiceCardCount();
    expect(serviceCardCount).toBeGreaterThan(0);

    // Check service statuses
    const plexStatus = await dashboardPage.getServiceStatus('plex');
    const overseerrStatus = await dashboardPage.getServiceStatus('overseerr');
    const uptimeKumaStatus = await dashboardPage.getServiceStatus('uptime-kuma');

    await hiveMind.storeInMemory(hiveMind, 'services/status', {
      plex: plexStatus,
      overseerr: overseerrStatus,
      uptimeKuma: uptimeKumaStatus
    });

    // Verify at least one service is up
    const servicesUp = [plexStatus, overseerrStatus, uptimeKumaStatus].filter(status => status === 'up');
    expect(servicesUp.length).toBeGreaterThan(0);

    await hiveMind.notifyHiveMind(hiveMind, `Dashboard loaded with ${serviceCardCount} service cards`);
  });

  test('Basic navigation works', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    
    // Test navigation to each main section
    const navigationTests = [
      { section: 'Media Search', action: () => dashboardPage.goToMediaSearch(), expectedUrl: /\/media/ },
      { section: 'Requests', action: () => dashboardPage.goToRequests(), expectedUrl: /\/requests/ },
      { section: 'Plex Browser', action: () => dashboardPage.goToPlexBrowser(), expectedUrl: /\/plex/ },
      { section: 'YouTube Downloader', action: () => dashboardPage.goToYouTubeDownloader(), expectedUrl: /\/youtube/ }
    ];

    for (const nav of navigationTests) {
      const navStartTime = Date.now();
      await nav.action();
      const navTime = Date.now() - navStartTime;
      
      await expect(page).toHaveURL(nav.expectedUrl);
      expect(navTime).toBeLessThan(performanceBenchmarks.pageLoad.moderate);
      
      await hiveMind.storeInMemory(hiveMind, `navigation/${nav.section.toLowerCase()}`, { navTime });
      
      // Navigate back to dashboard
      await page.goto('/dashboard');
      await dashboardPage.waitForLoad();
    }

    await hiveMind.notifyHiveMind(hiveMind, 'All navigation tests completed successfully');
  });

  test('Logout functionality works', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    
    // Perform logout
    await dashboardPage.logout();
    
    // Verify redirect to login page
    await expect(page).toHaveURL('/auth/signin');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();

    // Verify user cannot access protected pages
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/auth/signin');

    await hiveMind.notifyHiveMind(hiveMind, 'Logout functionality verified');
  });

  test('API connectivity works', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    
    // Test basic API endpoints through UI interactions
    const apiTests = [
      {
        name: 'Service Status API',
        action: async () => {
          await page.reload();
          await dashboardPage.waitForLoad();
          return await dashboardPage.getServiceStatus('plex');
        }
      },
      {
        name: 'User Session API',
        action: async () => {
          const userMenu = page.locator('[data-testid="user-menu"]');
          await expect(userMenu).toBeVisible();
          return 'success';
        }
      }
    ];

    for (const apiTest of apiTests) {
      const apiStartTime = Date.now();
      const result = await apiTest.action();
      const apiTime = Date.now() - apiStartTime;
      
      expect(result).toBeTruthy();
      expect(apiTime).toBeLessThan(performanceBenchmarks.apiResponse.moderate);
      
      await hiveMind.storeInMemory(hiveMind, `api/${apiTest.name.toLowerCase().replace(/\s+/g, '-')}`, {
        result,
        responseTime: apiTime
      });
    }

    await hiveMind.notifyHiveMind(hiveMind, 'API connectivity tests completed');
  });

  test.afterEach(async ({ hiveMind }) => {
    const testData = await hiveMind.retrieveFromMemory(hiveMind, 'test/setup');
    const endTime = Date.now();
    const totalTime = endTime - testData?.startTime;

    await hiveMind.storeInMemory(hiveMind, 'test/completion', {
      totalTime,
      endTime
    });

    await hiveMind.notifyHiveMind(hiveMind, `Smoke test completed in ${totalTime}ms`);
  });
});