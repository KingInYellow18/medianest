import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';

/**
 * Authentication E2E Tests for MediaNest
 * Tests login/logout flow and authentication states
 */
test.describe('Authentication Flow', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    await loginPage.goto();

    // Verify login page loads
    await expect(page).toHaveURL(/.*\/login/);
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();

    // Perform login
    await loginPage.login('test@medianest.com', 'testpassword123');

    // Verify successful login
    await loginPage.expectSuccessfulLogin();

    // Verify dashboard loads
    await dashboardPage.expectDashboardLoaded();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await loginPage.goto();

    // Attempt login with invalid credentials
    await loginPage.login('invalid@email.com', 'wrongpassword');

    // Verify login failed
    await loginPage.expectFailedLogin();
    await loginPage.expectErrorMessage('Invalid email or password');
  });

  test('should validate required fields', async ({ page }) => {
    await loginPage.goto();

    // Test form validation
    await loginPage.validateFormFields();

    // Verify error states are shown
    await expect(loginPage.emailInput).toHaveAttribute('aria-invalid', 'true');
  });

  test('should support keyboard navigation', async ({ page }) => {
    await loginPage.goto();

    // Test keyboard login
    await loginPage.loginWithKeyboard('test@medianest.com', 'testpassword123');

    // Verify successful login
    await loginPage.expectSuccessfulLogin();
  });

  test('should remember user preference', async ({ page }) => {
    await loginPage.goto();

    // Login with remember me checked
    await loginPage.login('test@medianest.com', 'testpassword123', true);

    // Verify successful login
    await loginPage.expectSuccessfulLogin();

    // Verify remember me token is set
    const rememberToken = await loginPage.getLocalStorage('rememberMe');
    expect(rememberToken).toBeTruthy();
  });

  test('should successfully logout', async ({ page }) => {
    // Start from authenticated state
    await dashboardPage.goto();
    await dashboardPage.expectDashboardLoaded();

    // Perform logout
    await dashboardPage.logout();

    // Verify redirect to login
    await expect(page).toHaveURL(/.*\/login/);

    // Verify auth state cleared
    const authToken = await loginPage.getLocalStorage('authToken');
    expect(authToken).toBeFalsy();
  });

  test('should handle session expiration', async ({ page }) => {
    await dashboardPage.goto();
    await dashboardPage.expectDashboardLoaded();

    // Simulate expired token
    await dashboardPage.setLocalStorage('authToken', 'expired-token');

    // Mock 401 response for API calls
    await page.route('**/api/**', (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    // Refresh page to trigger auth check
    await page.reload();

    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login/);
    await expect(loginPage.errorMessage).toBeVisible();
  });

  test('should be accessible', async ({ page }) => {
    await loginPage.goto();

    // Test accessibility
    await loginPage.validateAccessibility();

    // Test with screen reader simulation
    await page.evaluate(() => {
      document.body.setAttribute('role', 'application');
    });

    // Verify ARIA labels and roles
    await expect(loginPage.emailInput).toHaveAttribute('role');
    await expect(loginPage.passwordInput).toHaveAttribute('role');
  });

  test('should handle loading states', async ({ page }) => {
    await loginPage.goto();

    // Mock slow API response
    await page.route('**/api/auth/login', (route) => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            token: 'test-token',
            user: { id: 1, email: 'test@medianest.com' },
          }),
        });
      }, 2000);
    });

    // Start login process
    await loginPage.fillField(loginPage.emailInput, 'test@medianest.com');
    await loginPage.fillField(loginPage.passwordInput, 'testpassword123');
    await loginPage.loginButton.click();

    // Verify loading state
    await loginPage.expectLoadingState();

    // Wait for completion
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
    await loginPage.expectLoadingComplete();
  });

  test('should navigate to forgot password', async ({ page }) => {
    await loginPage.goto();

    await loginPage.goToForgotPassword();

    // Verify navigation
    await expect(page).toHaveURL(/.*\/forgot-password/);
  });

  test('should navigate to sign up', async ({ page }) => {
    await loginPage.goto();

    await loginPage.goToSignUp();

    // Verify navigation
    await expect(page).toHaveURL(/.*\/signup/);
  });

  test('should persist authentication across page refreshes', async ({ page }) => {
    // Login first
    await loginPage.goto();
    await loginPage.login('test@medianest.com', 'testpassword123');
    await loginPage.expectSuccessfulLogin();

    // Refresh the page
    await page.reload();

    // Should still be authenticated
    await expect(page).toHaveURL(/.*\/dashboard/);
    await dashboardPage.expectDashboardLoaded();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await loginPage.goto();

    // Mock network error
    await page.route('**/api/auth/login', (route) => {
      route.abort('failed');
    });

    // Attempt login
    await loginPage.login('test@medianest.com', 'testpassword123');

    // Should show network error
    await loginPage.expectErrorMessage('Network error');
  });

  test('should support social login (if available)', async ({ page }) => {
    await loginPage.goto();

    const googleLogin = page.getByTestId('google-login');
    const githubLogin = page.getByTestId('github-login');

    // Test if social login buttons exist
    if (await googleLogin.isVisible()) {
      await expect(googleLogin).toBeEnabled();
    }

    if (await githubLogin.isVisible()) {
      await expect(githubLogin).toBeEnabled();
    }
  });
});
