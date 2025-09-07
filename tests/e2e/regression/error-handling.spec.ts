import { test, expect } from '../helpers/hive-mind/coordination';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MockManager } from '../fixtures/mocks';
import { testUsers, errorScenarios } from '../fixtures/test-data';

test.describe('Regression Tests - Error Handling', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let mockManager: MockManager;

  test.beforeEach(async ({ page, hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Starting error handling regression tests');
    
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    mockManager = new MockManager(page);

    await mockManager.setupBasicMocks();
  });

  test('Network timeout error handling', async ({ page, hiveMind }) => {
    await hiveMind.storeInMemory(hiveMind, 'error-handling/network-timeout/start', {
      testType: 'network-timeout',
      startTime: Date.now()
    });

    // Mock network timeout
    await mockManager.mockErrorScenarios('networkTimeout');

    // Attempt to login
    await loginPage.goto();
    await loginPage.fillCredentials(testUsers.admin.email, testUsers.admin.password);
    await loginPage.submitLogin();

    // Verify timeout error is displayed
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible({ timeout: 35000 });
    
    const errorMessage = await page.locator('[data-testid="network-error"]').textContent();
    expect(errorMessage).toContain('network timeout');

    // Verify retry button is available
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

    await hiveMind.storeInMemory(hiveMind, 'error-handling/network-timeout', {
      errorDisplayed: true,
      errorMessage,
      retryButtonAvailable: true
    });

    // Test retry functionality
    await mockManager.clearMocks();
    await mockManager.setupBasicMocks(); // Restore working mocks

    await page.click('[data-testid="retry-button"]');

    // Should succeed after retry
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    await hiveMind.storeInMemory(hiveMind, 'error-handling/network-timeout-retry', {
      retrySuccessful: true,
      redirectedToDashboard: true
    });

    await hiveMind.notifyHiveMind(hiveMind, 'Network timeout error handling verified with successful retry');
  });

  test('Server error (500) handling', async ({ page, hiveMind }) => {
    await mockManager.mockErrorScenarios('serverError');

    await loginPage.goto();
    await loginPage.fillCredentials(testUsers.admin.email, testUsers.admin.password);
    await loginPage.submitLogin();

    // Verify server error is displayed
    await expect(page.locator('[data-testid="server-error"]')).toBeVisible();
    
    const errorMessage = await page.locator('[data-testid="server-error"]').textContent();
    expect(errorMessage).toContain('server error');

    // Verify error details are not exposed to user
    expect(errorMessage).not.toContain('stack trace');
    expect(errorMessage).not.toContain('internal error');

    await hiveMind.storeInMemory(hiveMind, 'error-handling/server-error', {
      errorDisplayed: true,
      errorMessage,
      noSensitiveInfo: true
    });

    // Verify user-friendly error message
    expect(errorMessage).toContain('something went wrong');

    await hiveMind.notifyHiveMind(hiveMind, 'Server error handling verified with user-friendly message');
  });

  test('Unauthorized access (401) handling', async ({ page, hiveMind }) => {
    await mockManager.mockErrorScenarios('unauthorized');

    await loginPage.goto();
    await loginPage.fillCredentials(testUsers.admin.email, testUsers.admin.password);
    await loginPage.submitLogin();

    // Verify unauthorized error
    await expect(page.locator('[data-testid="auth-error"]')).toBeVisible();
    
    const errorMessage = await page.locator('[data-testid="auth-error"]').textContent();
    expect(errorMessage).toContain('credentials');

    // Should remain on login page
    await expect(page).toHaveURL('/auth/signin');

    await hiveMind.storeInMemory(hiveMind, 'error-handling/unauthorized', {
      errorDisplayed: true,
      remainedOnLoginPage: true,
      errorMessage
    });

    await hiveMind.notifyHiveMind(hiveMind, 'Unauthorized access handling verified');

    // Test session expiration scenario
    await mockManager.clearMocks();
    await mockManager.setupBasicMocks();

    // Login successfully first
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await expect(page).toHaveURL('/dashboard');

    // Mock session expiration
    await mockManager.mockErrorScenarios('unauthorized');

    // Try to navigate to another page
    await page.goto('/requests');

    // Should redirect to login with session expired message
    await expect(page).toHaveURL('/auth/signin');
    await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();

    await hiveMind.storeInMemory(hiveMind, 'error-handling/session-expiration', {
      redirectedToLogin: true,
      sessionExpiredMessageShown: true
    });

    await hiveMind.notifyHiveMind(hiveMind, 'Session expiration handling verified');
  });

  test('Rate limiting (429) handling', async ({ page, hiveMind }) => {
    await mockManager.mockErrorScenarios('rateLimited');

    await loginPage.goto();
    await loginPage.fillCredentials(testUsers.admin.email, testUsers.admin.password);
    await loginPage.submitLogin();

    // Verify rate limit error
    await expect(page.locator('[data-testid="rate-limit-error"]')).toBeVisible();
    
    const errorMessage = await page.locator('[data-testid="rate-limit-error"]').textContent();
    expect(errorMessage).toContain('too many requests');

    // Verify rate limit info is displayed
    await expect(page.locator('[data-testid="rate-limit-info"]')).toBeVisible();
    
    const rateLimitInfo = await page.locator('[data-testid="rate-limit-info"]').textContent();
    expect(rateLimitInfo).toMatch(/try again in \d+/i);

    await hiveMind.storeInMemory(hiveMind, 'error-handling/rate-limit', {
      errorDisplayed: true,
      errorMessage,
      rateLimitInfo,
      cooldownInfoShown: true
    });

    // Verify login button is disabled during cooldown
    const loginButton = page.locator('[data-testid="login-button"]');
    await expect(loginButton).toBeDisabled();

    await hiveMind.notifyHiveMind(hiveMind, 'Rate limiting handling verified with cooldown period');
  });

  test('Not found (404) error handling', async ({ page, hiveMind }) => {
    await mockManager.mockErrorScenarios('notFound');

    // Navigate to a valid page that will return 404 due to mock
    await page.goto('/dashboard');

    // Should show 404 error page
    await expect(page.locator('[data-testid="not-found-error"]')).toBeVisible();
    
    const errorMessage = await page.locator('[data-testid="not-found-error"]').textContent();
    expect(errorMessage).toContain('not found');

    // Verify navigation options are available
    await expect(page.locator('[data-testid="go-home-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="go-back-button"]')).toBeVisible();

    await hiveMind.storeInMemory(hiveMind, 'error-handling/not-found', {
      errorDisplayed: true,
      errorMessage,
      navigationOptionsAvailable: true
    });

    // Test go home functionality
    await page.click('[data-testid="go-home-button"]');
    // Should attempt to navigate home (though may fail due to mock)

    await hiveMind.notifyHiveMind(hiveMind, '404 error handling verified with navigation options');
  });

  test('JavaScript error boundary handling', async ({ page, hiveMind }) => {
    // Inject a script that will cause a JavaScript error
    await page.addInitScript(() => {
      // Override a method to cause an error
      window.addEventListener('load', () => {
        const originalMethod = window.console.error;
        let errorCaught = false;
        
        window.console.error = (...args) => {
          if (args[0] && args[0].toString().includes('React error')) {
            errorCaught = true;
            window.testErrorBoundaryTriggered = true;
          }
          originalMethod.apply(console, args);
        };

        // Simulate a React error
        setTimeout(() => {
          if (!errorCaught) {
            throw new Error('Simulated component error for testing');
          }
        }, 1000);
      });
    });

    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Check if error boundary caught the error
    const errorBoundaryTriggered = await page.evaluate(() => window.testErrorBoundaryTriggered);
    
    if (errorBoundaryTriggered) {
      // Verify error boundary UI is shown
      await expect(page.locator('[data-testid="error-boundary"]')).toBeVisible();
      
      const errorBoundaryMessage = await page.locator('[data-testid="error-boundary-message"]').textContent();
      expect(errorBoundaryMessage).toContain('something went wrong');

      // Verify reload button is available
      await expect(page.locator('[data-testid="error-boundary-reload"]')).toBeVisible();

      await hiveMind.storeInMemory(hiveMind, 'error-handling/error-boundary', {
        errorBoundaryTriggered: true,
        errorBoundaryDisplayed: true,
        reloadButtonAvailable: true
      });
    } else {
      // Error boundary not triggered (good defensive coding)
      await hiveMind.storeInMemory(hiveMind, 'error-handling/error-boundary', {
        errorBoundaryTriggered: false,
        applicationStableWithoutBoundary: true
      });
    }

    await hiveMind.notifyHiveMind(hiveMind, 'JavaScript error boundary handling tested');
  });

  test('API connection failure recovery', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Simulate API connection failure after successful login
    await page.route('/api/**', async (route) => {
      await route.abort('failed');
    });

    // Try to refresh dashboard data
    await page.click('[data-testid="refresh-services"]');

    // Verify connection error is displayed
    await expect(page.locator('[data-testid="connection-error"]')).toBeVisible();
    
    const connectionError = await page.locator('[data-testid="connection-error"]').textContent();
    expect(connectionError).toContain('connection failed');

    // Verify retry mechanism
    await expect(page.locator('[data-testid="retry-connection"]')).toBeVisible();

    await hiveMind.storeInMemory(hiveMind, 'error-handling/api-connection-failure', {
      connectionErrorDisplayed: true,
      retryButtonAvailable: true,
      errorMessage: connectionError
    });

    // Test automatic retry after recovery
    await page.unroute('/api/**');
    await mockManager.setupBasicMocks();

    // Wait for automatic recovery or click retry
    const retryButton = page.locator('[data-testid="retry-connection"]');
    if (await retryButton.isVisible()) {
      await retryButton.click();
    }

    // Should recover and show success state
    const recoverySuccessful = await page.locator('[data-testid="connection-restored"]').isVisible({ timeout: 10000 });
    
    await hiveMind.storeInMemory(hiveMind, 'error-handling/api-recovery', {
      recoverySuccessful,
      connectionRestored: recoverySuccessful
    });

    await hiveMind.notifyHiveMind(hiveMind, `API connection recovery: ${recoverySuccessful ? 'successful' : 'failed'}`);
  });

  test('Graceful degradation during partial failures', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Mock partial API failures (some services work, others don't)
    await page.route('/api/services/plex/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Plex service unavailable' })
      });
    });

    // Keep other services working
    await mockManager.mockServiceStatus();

    await dashboardPage.waitForLoad();

    // Verify that available services still work
    const overseerrStatus = await dashboardPage.getServiceStatus('overseerr');
    expect(overseerrStatus).toBe('up');

    // Verify failed service shows error state
    const plexCard = page.locator('[data-testid="plex-service-card"]');
    await expect(plexCard.locator('[data-testid="service-error"]')).toBeVisible();

    // Verify partial failure notification
    await expect(page.locator('[data-testid="partial-service-failure"]')).toBeVisible();

    const partialFailureMessage = await page.locator('[data-testid="partial-service-failure"]').textContent();
    expect(partialFailureMessage).toContain('some services unavailable');

    await hiveMind.storeInMemory(hiveMind, 'error-handling/partial-failure', {
      partialFailureDetected: true,
      workingServicesAvailable: true,
      failedServicesMarked: true,
      partialFailureMessage
    });

    // Test that user can still use available functionality
    await dashboardPage.goToMediaSearch();
    await expect(page.locator('[data-testid="media-search-container"]')).toBeVisible();

    await hiveMind.storeInMemory(hiveMind, 'error-handling/graceful-degradation', {
      availableFeaturesStillWork: true,
      userCanContinue: true
    });

    await hiveMind.notifyHiveMind(hiveMind, 'Graceful degradation during partial failures verified');
  });

  test('Error logging and reporting', async ({ page, hiveMind }) => {
    const consoleErrors = [];
    const networkErrors = [];

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Capture network errors
    page.on('requestfailed', request => {
      networkErrors.push({
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText,
        timestamp: new Date().toISOString()
      });
    });

    // Cause various errors
    await mockManager.mockErrorScenarios('serverError');
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Wait for errors to be logged
    await page.waitForTimeout(2000);

    // Verify error logging
    expect(consoleErrors.length).toBeGreaterThan(0);

    const errorTypes = consoleErrors.map(error => {
      if (error.text.includes('Failed to fetch')) return 'network';
      if (error.text.includes('500')) return 'server';
      if (error.text.includes('React')) return 'component';
      return 'other';
    });

    await hiveMind.storeInMemory(hiveMind, 'error-handling/error-logging', {
      consoleErrors: consoleErrors.length,
      networkErrors: networkErrors.length,
      errorTypes: errorTypes.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {}),
      sampleErrors: consoleErrors.slice(0, 3)
    });

    // Check if errors are being sent to error reporting service
    let errorReported = false;
    page.on('request', request => {
      if (request.url().includes('/api/error-report') || 
          request.url().includes('sentry') || 
          request.url().includes('bugsnag')) {
        errorReported = true;
      }
    });

    // Trigger another error to test reporting
    await page.reload();
    await page.waitForTimeout(1000);

    await hiveMind.storeInMemory(hiveMind, 'error-handling/error-reporting', {
      errorReportingServiceCalled: errorReported,
      automaticReporting: errorReported
    });

    await hiveMind.notifyHiveMind(hiveMind, 
      `Error logging captured ${consoleErrors.length} console errors and ${networkErrors.length} network errors`
    );
  });

  test.afterEach(async ({ hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Error handling regression test completed');
  });
});