import { test, expect } from '../helpers/hive-mind/coordination';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MockManager } from '../fixtures/mocks';
import { testUsers } from '../fixtures/test-data';

test.describe('Critical User Journey - Authentication Flow', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let mockManager: MockManager;

  test.beforeEach(async ({ page, hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Starting authentication flow tests');
    
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    mockManager = new MockManager(page);

    await mockManager.setupBasicMocks();
    await mockManager.mockAuthEndpoints();
  });

  test('Complete authentication workflow', async ({ page, hiveMind }) => {
    await hiveMind.storeInMemory(hiveMind, 'auth-flow/start', {
      testType: 'complete-auth-workflow',
      startTime: Date.now()
    });

    // Step 1: Navigate to login page
    await loginPage.goto();
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    
    await hiveMind.notifyHiveMind(hiveMind, 'Login page loaded successfully');

    // Step 2: Enter valid credentials
    await loginPage.fillCredentials(testUsers.admin.email, testUsers.admin.password);
    
    // Step 3: Submit login form
    const authStartTime = Date.now();
    await loginPage.submitLogin();
    
    // Step 4: Verify successful redirect
    await expect(page).toHaveURL('/dashboard');
    const authTime = Date.now() - authStartTime;
    
    await hiveMind.storeInMemory(hiveMind, 'auth-flow/login', {
      success: true,
      authTime,
      user: testUsers.admin.email
    });

    // Step 5: Verify dashboard is accessible
    await expect(dashboardPage.isDisplayed()).resolves.toBe(true);
    
    // Step 6: Verify user session is active
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    await hiveMind.notifyHiveMind(hiveMind, `Authentication completed in ${authTime}ms`);

    // Step 7: Test session persistence
    await page.reload();
    await dashboardPage.waitForLoad();
    await expect(page).toHaveURL('/dashboard');
    await expect(dashboardPage.isDisplayed()).resolves.toBe(true);
    
    await hiveMind.storeInMemory(hiveMind, 'auth-flow/session-persistence', {
      success: true,
      verified: true
    });

    await hiveMind.notifyHiveMind(hiveMind, 'Session persistence verified');
  });

  test('Authentication with invalid credentials', async ({ page, hiveMind }) => {
    await loginPage.goto();
    
    // Test with invalid password
    await loginPage.fillCredentials(testUsers.admin.email, 'wrong-password');
    await loginPage.submitLogin();
    
    // Verify error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
    
    // Verify user stays on login page
    await expect(page).toHaveURL('/auth/signin');
    
    await hiveMind.storeInMemory(hiveMind, 'auth-flow/invalid-credentials', {
      success: true,
      errorDisplayed: true,
      remainedOnLoginPage: true
    });

    await hiveMind.notifyHiveMind(hiveMind, 'Invalid credentials test completed');

    // Test with non-existent user
    await loginPage.fillCredentials('nonexistent@test.com', 'password');
    await loginPage.submitLogin();
    
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page).toHaveURL('/auth/signin');
    
    await hiveMind.notifyHiveMind(hiveMind, 'Non-existent user test completed');
  });

  test('Password change flow', async ({ page, hiveMind }) => {
    // Login first
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    
    // Navigate to password change
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="change-password-link"]');
    
    await expect(page).toHaveURL('/auth/change-password');
    await expect(page.locator('[data-testid="change-password-form"]')).toBeVisible();

    // Fill password change form
    await page.fill('[data-testid="current-password"]', testUsers.admin.password);
    await page.fill('[data-testid="new-password"]', 'NewPassword123!@#');
    await page.fill('[data-testid="confirm-password"]', 'NewPassword123!@#');

    // Submit password change
    const changeStartTime = Date.now();
    await page.click('[data-testid="change-password-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Password updated successfully');
    
    const changeTime = Date.now() - changeStartTime;
    
    await hiveMind.storeInMemory(hiveMind, 'auth-flow/password-change', {
      success: true,
      changeTime,
      user: testUsers.admin.email
    });

    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    await hiveMind.notifyHiveMind(hiveMind, `Password change completed in ${changeTime}ms`);

    // Test login with new password (would require updating mock)
    await dashboardPage.logout();
    await expect(page).toHaveURL('/auth/signin');
    
    await hiveMind.notifyHiveMind(hiveMind, 'Password change flow completed successfully');
  });

  test('Session timeout handling', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    
    // Mock session expiration
    await page.route('/api/**', async (route) => {
      if (route.request().headers()['authorization']) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Token expired' })
        });
      } else {
        await route.continue();
      }
    });

    // Try to access a protected resource
    await page.reload();
    
    // Should redirect to login due to expired session
    await expect(page).toHaveURL('/auth/signin');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    
    // Verify session timeout message
    await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
    
    await hiveMind.storeInMemory(hiveMind, 'auth-flow/session-timeout', {
      success: true,
      redirectedToLogin: true,
      messageDisplayed: true
    });

    await hiveMind.notifyHiveMind(hiveMind, 'Session timeout handling verified');
  });

  test('Logout flow', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    
    // Verify user is logged in
    await expect(dashboardPage.isDisplayed()).resolves.toBe(true);
    
    // Perform logout
    const logoutStartTime = Date.now();
    await dashboardPage.logout();
    const logoutTime = Date.now() - logoutStartTime;
    
    // Verify redirect to login page
    await expect(page).toHaveURL('/auth/signin');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    
    await hiveMind.storeInMemory(hiveMind, 'auth-flow/logout', {
      success: true,
      logoutTime,
      redirectedToLogin: true
    });

    // Verify session is cleared
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/auth/signin');
    
    // Verify logout message
    await expect(page.locator('[data-testid="logout-message"]')).toBeVisible();
    
    await hiveMind.notifyHiveMind(hiveMind, `Logout completed in ${logoutTime}ms`);

    // Test that back button doesn't return to protected pages
    await page.goBack();
    await expect(page).toHaveURL('/auth/signin');
    
    await hiveMind.storeInMemory(hiveMind, 'auth-flow/logout-security', {
      success: true,
      backButtonSecure: true
    });

    await hiveMind.notifyHiveMind(hiveMind, 'Logout security verified');
  });

  test('Multiple login attempts handling', async ({ page, hiveMind }) => {
    await loginPage.goto();
    
    const maxAttempts = 5;
    const attemptResults = [];

    // Attempt multiple failed logins
    for (let i = 1; i <= maxAttempts; i++) {
      await loginPage.fillCredentials(testUsers.admin.email, 'wrong-password');
      const attemptStartTime = Date.now();
      await loginPage.submitLogin();
      const attemptTime = Date.now() - attemptStartTime;
      
      const hasError = await page.locator('[data-testid="error-message"]').isVisible();
      const hasRateLimit = await page.locator('[data-testid="rate-limit-message"]').isVisible();
      
      attemptResults.push({
        attempt: i,
        attemptTime,
        hasError,
        hasRateLimit,
        url: page.url()
      });

      await hiveMind.storeInMemory(hiveMind, `auth-flow/attempt-${i}`, {
        attempt: i,
        hasError,
        hasRateLimit,
        attemptTime
      });

      // Small delay between attempts
      await page.waitForTimeout(1000);
    }

    // Verify rate limiting kicks in
    const rateLimitedAttempts = attemptResults.filter(result => result.hasRateLimit).length;
    expect(rateLimitedAttempts).toBeGreaterThan(0);

    await hiveMind.storeInMemory(hiveMind, 'auth-flow/rate-limiting', {
      totalAttempts: maxAttempts,
      rateLimitedAttempts,
      attemptResults
    });

    await hiveMind.notifyHiveMind(hiveMind, 
      `Rate limiting test: ${rateLimitedAttempts}/${maxAttempts} attempts rate limited`
    );

    // Verify legitimate login still works after cooldown
    await page.waitForTimeout(5000); // Wait for rate limit cooldown
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await expect(page).toHaveURL('/dashboard');
    
    await hiveMind.notifyHiveMind(hiveMind, 'Legitimate login works after rate limit cooldown');
  });
});