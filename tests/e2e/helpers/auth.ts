import { Page, expect } from '@playwright/test';

export class AuthHelper {
  constructor(private page: Page) {}

  /**
   * Simulate Plex OAuth login flow for E2E testing
   * Since we're testing the full flow, we need to mock the Plex API responses
   */
  async loginWithPlex(pinCode: string = '1234') {
    // Navigate to login page
    await this.page.goto('/auth/signin');

    // Wait for login page to load
    await expect(this.page.locator('[data-testid="plex-login-button"]')).toBeVisible();

    // Click Plex login button
    await this.page.click('[data-testid="plex-login-button"]');

    // Wait for PIN input to appear (mocked Plex OAuth flow)
    await expect(this.page.locator('[data-testid="pin-input"]')).toBeVisible();

    // Enter PIN code
    await this.page.fill('[data-testid="pin-input"]', pinCode);

    // Click verify PIN button
    await this.page.click('[data-testid="verify-pin"]');

    // Wait for successful login redirect to dashboard
    await expect(this.page).toHaveURL('/dashboard');

    // Verify we're logged in by checking for user-specific elements
    await expect(this.page.locator('[data-testid="user-menu"]')).toBeVisible();
  }

  /**
   * Check if user is already logged in
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.locator('[data-testid="user-menu"]').waitFor({ timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Logout from the application
   */
  async logout() {
    // Click user menu
    await this.page.click('[data-testid="user-menu"]');

    // Click logout button
    await this.page.click('[data-testid="logout-button"]');

    // Verify redirect to login page
    await expect(this.page).toHaveURL('/auth/signin');
  }

  /**
   * Quick login for tests that don't need to test the auth flow itself
   */
  async quickLogin() {
    // Check if already logged in
    if (await this.isLoggedIn()) {
      return;
    }

    // Perform login
    await this.loginWithPlex();
  }
}
