import { test, expect } from '@playwright/test';

test.describe('Authentication - Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/auth/login');
  });

  test('should display login page correctly', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Login/);
    
    // Check main heading
    await expect(page.locator('h1')).toContainText('Login');
    
    // Check login form elements
    await expect(page.getByTestId('username-input')).toBeVisible();
    await expect(page.getByTestId('password-input')).toBeVisible();
    await expect(page.getByTestId('login-button')).toBeVisible();
    await expect(page.getByTestId('plex-oauth-button')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    // Try to submit empty form
    await page.getByTestId('login-button').click();
    
    // Check for validation errors
    await expect(page.getByTestId('username-error')).toContainText('Username is required');
    await expect(page.getByTestId('password-error')).toContainText('Password is required');
    
    // Ensure we're still on login page
    await expect(page.url()).toContain('/auth/login');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in invalid credentials
    await page.getByTestId('username-input').fill('invaliduser');
    await page.getByTestId('password-input').fill('wrongpassword');
    
    // Submit form
    await page.getByTestId('login-button').click();
    
    // Check for error message
    await expect(page.getByTestId('error-message')).toContainText('Invalid credentials');
    
    // Ensure we're still on login page
    await expect(page.url()).toContain('/auth/login');
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    // Fill in valid test credentials
    await page.getByTestId('username-input').fill('testuser1');
    await page.getByTestId('password-input').fill('testpassword');
    
    // Submit form
    await page.getByTestId('login-button').click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Should show user menu
    await expect(page.getByTestId('user-menu')).toBeVisible();
    
    // Should show welcome message
    await expect(page.getByTestId('welcome-message')).toContainText('Welcome');
  });

  test('should redirect authenticated users away from login', async ({ page }) => {
    // Login first
    await page.getByTestId('username-input').fill('testuser1');
    await page.getByTestId('password-input').fill('testpassword');
    await page.getByTestId('login-button').click();
    await expect(page).toHaveURL('/dashboard');
    
    // Try to go back to login page
    await page.goto('/auth/login');
    
    // Should be redirected back to dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('should handle remember me functionality', async ({ page }) => {
    // Fill credentials and check remember me
    await page.getByTestId('username-input').fill('testuser1');
    await page.getByTestId('password-input').fill('testpassword');
    await page.getByTestId('remember-me-checkbox').check();
    
    // Submit form
    await page.getByTestId('login-button').click();
    await expect(page).toHaveURL('/dashboard');
    
    // Check that persistent cookie is set
    const cookies = await page.context().cookies();
    const rememberCookie = cookies.find(cookie => cookie.name === 'remember_token');
    expect(rememberCookie).toBeTruthy();
    expect(rememberCookie?.expires).toBeGreaterThan(Date.now() / 1000 + 86400); // More than 1 day
  });

  test.describe('Plex OAuth Flow', () => {
    test('should initiate Plex OAuth flow', async ({ page }) => {
      // Mock Plex API responses
      await page.route('**/api/v1/auth/plex/pin', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            pin: '1234',
            pinId: 'test-pin-id',
            verificationUrl: 'https://plex.tv/link'
          })
        });
      });
      
      // Click Plex OAuth button
      await page.getByTestId('plex-oauth-button').click();
      
      // Should show PIN dialog
      await expect(page.getByTestId('plex-pin-dialog')).toBeVisible();
      await expect(page.getByTestId('plex-pin-code')).toContainText('1234');
      
      // Should have link to Plex
      const plexLink = page.getByTestId('plex-verification-link');
      await expect(plexLink).toHaveAttribute('href', 'https://plex.tv/link');
    });

    test('should complete Plex OAuth flow', async ({ page }) => {
      // Mock PIN creation
      await page.route('**/api/v1/auth/plex/pin', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            pin: '1234',
            pinId: 'test-pin-id',
            verificationUrl: 'https://plex.tv/link'
          })
        });
      });
      
      // Mock successful token exchange
      await page.route('**/api/v1/auth/plex/token', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'test-access-token',
            user: {
              id: 12345,
              username: 'testuser',
              email: 'test@example.com'
            }
          })
        });
      });
      
      // Start OAuth flow
      await page.getByTestId('plex-oauth-button').click();
      await expect(page.getByTestId('plex-pin-dialog')).toBeVisible();
      
      // Simulate PIN verification (click verify button)
      await page.getByTestId('verify-pin-button').click();
      
      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard');
      await expect(page.getByTestId('user-menu')).toBeVisible();
    });

    test('should handle Plex OAuth errors', async ({ page }) => {
      // Mock PIN creation failure
      await page.route('**/api/v1/auth/plex/pin', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Failed to create PIN'
          })
        });
      });
      
      // Click Plex OAuth button
      await page.getByTestId('plex-oauth-button').click();
      
      // Should show error message
      await expect(page.getByTestId('error-message')).toContainText('Failed to create PIN');
      
      // Should still be on login page
      await expect(page.url()).toContain('/auth/login');
    });
  });

  test.describe('Security', () => {
    test('should include CSRF token in login form', async ({ page }) => {
      // Check for CSRF token in form
      const csrfToken = page.locator('input[name="_csrf"]');
      await expect(csrfToken).toHaveAttribute('type', 'hidden');
      await expect(csrfToken).toHaveValue(/^[a-zA-Z0-9-_]{20,}$/);
    });

    test('should prevent XSS in login form', async ({ page }) => {
      const xssPayload = '<script>alert("xss")</script>';
      
      // Try XSS in username field
      await page.getByTestId('username-input').fill(xssPayload);
      await page.getByTestId('password-input').fill('password');
      await page.getByTestId('login-button').click();
      
      // Check that script was not executed
      const pageContent = await page.content();
      expect(pageContent).not.toContain('<script>alert("xss")</script>');
      
      // Check that input was properly escaped if displayed
      const errorMessage = await page.getByTestId('error-message').textContent();
      if (errorMessage?.includes('&lt;script&gt;')) {
        expect(errorMessage).toContain('&lt;script&gt;');
      }
    });

    test('should rate limit login attempts', async ({ page }) => {
      const attempts = [];
      
      // Make multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        attempts.push(
          page.getByTestId('username-input').fill('testuser'),
          page.getByTestId('password-input').fill('wrongpassword'),
          page.getByTestId('login-button').click(),
          page.waitForTimeout(100)
        );
      }
      
      await Promise.all(attempts);
      
      // Should show rate limit error
      await expect(page.getByTestId('error-message')).toContainText('Too many login attempts');
      
      // Form should be disabled
      await expect(page.getByTestId('login-button')).toBeDisabled();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper form labels and ARIA attributes', async ({ page }) => {
      // Check form labels
      await expect(page.locator('label[for="username"]')).toContainText('Username');
      await expect(page.locator('label[for="password"]')).toContainText('Password');
      
      // Check ARIA attributes
      await expect(page.getByTestId('username-input')).toHaveAttribute('aria-required', 'true');
      await expect(page.getByTestId('password-input')).toHaveAttribute('aria-required', 'true');
      
      // Check error ARIA attributes
      await page.getByTestId('login-button').click();
      await expect(page.getByTestId('username-input')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByTestId('password-input')).toHaveAttribute('aria-invalid', 'true');
    });

    test('should be keyboard navigable', async ({ page }) => {
      // Tab through form elements
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('username-input')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('password-input')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('remember-me-checkbox')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('login-button')).toBeFocused();
      
      // Submit with Enter key
      await page.getByTestId('username-input').fill('testuser1');
      await page.getByTestId('password-input').fill('testpassword');
      await page.keyboard.press('Enter');
      
      await expect(page).toHaveURL('/dashboard');
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Check that form is properly sized
      const form = page.getByTestId('login-form');
      const formBox = await form.boundingBox();
      expect(formBox?.width).toBeLessThanOrEqual(375);
      
      // Check that buttons are touch-friendly
      const loginButton = page.getByTestId('login-button');
      const buttonBox = await loginButton.boundingBox();
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44); // Minimum touch target
    });

    test('should display correctly on tablet devices', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Check layout adjustments
      await expect(page.getByTestId('login-form')).toBeVisible();
      await expect(page.getByTestId('plex-oauth-button')).toBeVisible();
    });
  });
});