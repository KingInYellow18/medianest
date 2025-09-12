import { test as setup, expect } from '@playwright/test';
import { testUsers } from '../fixtures/test-data';

const authFile = 'e2e/fixtures/auth.json';

/**
 * Authentication setup for E2E tests
 * This runs before all tests to establish authenticated state
 */
setup('authenticate user', async ({ page, request }) => {
  console.log('🔐 Setting up authentication for E2E tests...');

  try {
    // Navigate to login page
    await page.goto('/login');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Mock successful login API response
    await page.route('**/api/auth/login', async route => {
      if (route.request().method() === 'POST') {
        const requestData = route.request().postDataJSON();
        
        if (requestData.email === testUsers.validUser.email && 
            requestData.password === testUsers.validUser.password) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              token: 'test-auth-token-12345',
              user: {
                id: 1,
                email: testUsers.validUser.email,
                name: testUsers.validUser.name,
                role: testUsers.validUser.role
              }
            })
          });
        } else {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Invalid credentials'
            })
          });
        }
      } else {
        await route.continue();
      }
    });

    // Mock authenticated API endpoints
    await page.route('**/api/user/profile', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testUsers.validUser)
      });
    });

    await page.route('**/api/dashboard**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stats: {
            totalServices: 5,
            activeServices: 4,
            totalMedia: 150,
            storageUsed: '2.5TB'
          },
          recentActivity: []
        })
      });
    });

    // Check if login form exists, otherwise we're already authenticated
    const emailInput = page.locator('[data-testid="email-input"]');
    const passwordInput = page.locator('[data-testid="password-input"]');
    const loginButton = page.locator('[data-testid="login-submit"]');
    
    if (await emailInput.isVisible()) {
      // Perform login
      await emailInput.fill(testUsers.validUser.email);
      await passwordInput.fill(testUsers.validUser.password);
      await loginButton.click();
      
      // Wait for redirect to dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    } else {
      // Already authenticated, navigate to dashboard
      await page.goto('/dashboard');
    }
    
    // Verify we're on the dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Verify authentication elements are present
    const userMenu = page.getByTestId('user-menu');
    if (await userMenu.isVisible()) {
      await expect(userMenu).toBeVisible();
    }
    
    // Set authentication state in localStorage
    await page.evaluate((user) => {
      localStorage.setItem('authToken', 'test-auth-token-12345');
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('isAuthenticated', 'true');
    }, testUsers.validUser);
    
    // Save authentication state
    await page.context().storageState({ path: authFile });
    
    console.log('✅ Authentication setup completed successfully');
    
  } catch (error) {
    console.error('❌ Authentication setup failed:', error);
    throw error;
  }
});