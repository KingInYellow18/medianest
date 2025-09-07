import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object Model for the MediaNest Sign In page
 * Handles both Plex authentication and Admin setup flows
 */
export class SignInPage extends BasePage {
  // Page-specific selectors
  private readonly selectors = {
    // Page elements
    pageTitle: '[data-testid="signin-title"]',
    pageDescription: '[data-testid="signin-description"]',
    
    // Plex authentication
    plexSignInButton: '[data-testid="plex-signin-button"]',
    plexPinDisplay: '[data-testid="plex-pin"]',
    openAuthPageButton: '[data-testid="open-auth-page-button"]',
    authorizationWaiting: '[data-testid="authorization-waiting"]',
    cancelAuthButton: '[data-testid="cancel-auth-button"]',
    
    // Admin setup
    adminSetupButton: '[data-testid="admin-setup-button"]',
    adminLoginForm: '[data-testid="admin-login-form"]',
    usernameInput: '#username',
    passwordInput: '#password',
    adminSignInButton: '[data-testid="admin-signin-button"]',
    backToPlexButton: '[data-testid="back-to-plex-button"]',
    
    // Loading states
    loadingSpinner: '.animate-spin',
    signingInText: '[data-testid="signing-in-text"]',
    startingAuthText: '[data-testid="starting-auth-text"]',
    
    // Error handling
    errorAlert: '[role="alert"][data-variant="destructive"]',
    errorDescription: '[data-testid="error-description"]',
  };

  constructor(page: Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await this.page.goto('/auth/signin');
    await this.waitForLoad();
  }

  async isLoaded(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.pageTitle);
  }

  getPageTitle(): string {
    return 'Sign In';
  }

  protected getMainContentSelector(): string {
    return this.selectors.pageTitle;
  }

  /**
   * Verify the page loaded correctly with expected elements
   */
  async verifyPageElements(): Promise<void> {
    await expect(this.page.locator(this.selectors.pageTitle)).toContainText('Sign in to MediaNest');
    await expect(this.page.locator(this.selectors.pageDescription)).toContainText('Access your media server and services');
    await expect(this.page.locator(this.selectors.plexSignInButton)).toBeVisible();
    await expect(this.page.locator(this.selectors.adminSetupButton)).toBeVisible();
  }

  /**
   * Start Plex authentication flow
   */
  async startPlexAuthentication(): Promise<{ pin: string; authUrl: string }> {
    await this.clickElement(this.selectors.plexSignInButton);
    
    // Wait for loading to complete
    await this.waitForElementToHide(this.selectors.startingAuthText, 10000);
    
    // Get the PIN that's displayed
    const pinElement = await this.waitForElement(this.selectors.plexPinDisplay);
    const pin = await pinElement.textContent() || '';
    
    // Get the auth URL from the button
    const authButton = await this.waitForElement(this.selectors.openAuthPageButton);
    const authUrl = await authButton.getAttribute('onclick') || '';
    
    // Verify waiting state is shown
    await expect(this.page.locator(this.selectors.authorizationWaiting)).toBeVisible();
    
    return { pin: pin.trim(), authUrl };
  }

  /**
   * Open Plex authorization page in new window
   */
  async openPlexAuthPage(): Promise<void> {
    await this.clickElement(this.selectors.openAuthPageButton);
  }

  /**
   * Cancel Plex authentication
   */
  async cancelPlexAuthentication(): Promise<void> {
    await this.clickElement(this.selectors.cancelAuthButton);
    
    // Verify we're back to initial state
    await expect(this.page.locator(this.selectors.plexSignInButton)).toBeVisible();
    await expect(this.page.locator(this.selectors.plexPinDisplay)).not.toBeVisible();
  }

  /**
   * Wait for Plex authentication to complete
   */
  async waitForPlexAuthCompletion(timeout: number = 60000): Promise<void> {
    // Wait for redirect to dashboard or callback URL
    await this.page.waitForURL(/\/(dashboard|auth\/change-password)/, { timeout });
  }

  /**
   * Switch to admin setup mode
   */
  async switchToAdminSetup(): Promise<void> {
    await this.clickElement(this.selectors.adminSetupButton);
    await expect(this.page.locator(this.selectors.adminLoginForm)).toBeVisible();
  }

  /**
   * Switch back to Plex login
   */
  async switchBackToPlexLogin(): Promise<void> {
    await this.clickElement(this.selectors.backToPlexButton);
    await expect(this.page.locator(this.selectors.plexSignInButton)).toBeVisible();
  }

  /**
   * Perform admin login
   */
  async adminLogin(username: string = 'admin', password: string = 'admin'): Promise<void> {
    // Ensure we're in admin mode
    if (!(await this.isElementVisible(this.selectors.adminLoginForm))) {
      await this.switchToAdminSetup();
    }

    // Fill credentials
    await this.fillInput(this.selectors.usernameInput, username, { clear: true });
    await this.fillInput(this.selectors.passwordInput, password, { clear: true });
    
    // Submit form
    await this.clickElement(this.selectors.adminSignInButton);
    
    // Wait for loading to complete
    await this.waitForElementToHide(this.selectors.signingInText, 10000);
    
    // Wait for redirect
    await this.page.waitForURL(/\/auth\/change-password/, { timeout: 10000 });
  }

  /**
   * Get current authentication error
   */
  async getAuthenticationError(): Promise<string | null> {
    if (await this.isElementVisible(this.selectors.errorAlert)) {
      return await this.getTextContent(this.selectors.errorDescription);
    }
    return null;
  }

  /**
   * Handle URL-based errors (from query parameters)
   */
  async handleUrlErrors(): Promise<string | null> {
    const url = this.page.url();
    const urlParams = new URL(url).searchParams;
    const error = urlParams.get('error');
    
    if (error) {
      const errorMappings: Record<string, string> = {
        'OAuthSignin': 'Failed to start authentication',
        'OAuthCallback': 'Authentication failed',
        'OAuthCreateAccount': 'Failed to create account',
        'EmailCreateAccount': 'Failed to create account',
        'Callback': 'Authentication failed',
        'Default': 'An error occurred during sign in'
      };
      
      return errorMappings[error] || error;
    }
    
    return null;
  }

  /**
   * Verify admin form validation
   */
  async verifyAdminFormValidation(): Promise<void> {
    await this.switchToAdminSetup();
    
    // Check username is disabled (pre-filled)
    const usernameInput = this.page.locator(this.selectors.usernameInput);
    await expect(usernameInput).toBeDisabled();
    await expect(usernameInput).toHaveValue('admin');
    
    // Check password is required
    await this.fillInput(this.selectors.passwordInput, '', { clear: true });
    await this.clickElement(this.selectors.adminSignInButton);
    
    // Browser validation should prevent submission
    const passwordInput = this.page.locator(this.selectors.passwordInput);
    await expect(passwordInput).toHaveAttribute('required');
  }

  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation(): Promise<void> {
    // Tab through main elements
    await this.navigateWithTab();
    await expect(this.page.locator(this.selectors.plexSignInButton)).toBeFocused();
    
    await this.navigateWithTab();
    await expect(this.page.locator(this.selectors.adminSetupButton)).toBeFocused();
    
    // Test Enter key on Plex button
    await this.page.locator(this.selectors.plexSignInButton).focus();
    await this.pressEnter();
    
    // Should start Plex auth flow
    await expect(this.page.locator(this.selectors.plexPinDisplay)).toBeVisible({ timeout: 10000 });
  }

  /**
   * Test responsive behavior
   */
  async testResponsiveDesign(): Promise<void> {
    // Test mobile viewport
    await this.page.setViewportSize({ width: 375, height: 667 });
    await this.verifyPageElements();
    
    // Test tablet viewport  
    await this.page.setViewportSize({ width: 768, height: 1024 });
    await this.verifyPageElements();
    
    // Reset to desktop
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.verifyPageElements();
  }

  /**
   * Simulate Plex authentication completion
   * (For testing without actual Plex server)
   */
  async simulatePlexAuthCompletion(): Promise<void> {
    // This would typically be called after external Plex auth
    // For testing, we can trigger the callback directly
    await this.page.evaluate(() => {
      // Simulate the polling callback receiving authorization
      window.postMessage({ 
        type: 'plex-auth-complete', 
        authToken: 'mock-token' 
      }, '*');
    });
    
    await this.waitForPlexAuthCompletion();
  }

  /**
   * Test error scenarios
   */
  async testErrorScenarios(): Promise<void> {
    // Test invalid admin credentials
    await this.switchToAdminSetup();
    await this.fillInput(this.selectors.passwordInput, 'wrongpassword');
    await this.clickElement(this.selectors.adminSignInButton);
    
    // Should show error (implementation dependent)
    await this.waitForLoading();
    
    // Test network error simulation
    await this.page.route('/api/auth/plex/pin', (route) => {
      route.abort('failed');
    });
    
    await this.switchBackToPlexLogin();
    await this.clickElement(this.selectors.plexSignInButton);
    
    // Should handle gracefully
    await this.waitForLoading();
  }
}