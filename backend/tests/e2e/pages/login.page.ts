import { Page, expect } from '@playwright/test';

import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  // Selectors
  private readonly selectors = {
    emailInput: '[data-testid="email-input"]',
    passwordInput: '[data-testid="password-input"]',
    loginButton: '[data-testid="login-button"]',
    errorMessage: '[data-testid="error-message"]',
    forgotPasswordLink: '[data-testid="forgot-password-link"]',
    signUpLink: '[data-testid="signup-link"]',
    rememberMeCheckbox: '[data-testid="remember-me-checkbox"]',
    loadingSpinner: '[data-testid="loading-spinner"]',
    socialLoginGoogle: '[data-testid="google-login-button"]',
    socialLoginFacebook: '[data-testid="facebook-login-button"]',
    logo: '[data-testid="app-logo"]',
    loginForm: '[data-testid="login-form"]',
  };

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to login page
   */
  async navigate(): Promise<void> {
    await this.goto('/login');
    await this.waitForPageLoad();
    await this.waitForElement(this.selectors.loginForm);
  }

  /**
   * Fill email field
   */
  async fillEmail(email: string): Promise<void> {
    await this.fillInput(this.selectors.emailInput, email);
  }

  /**
   * Fill password field
   */
  async fillPassword(password: string): Promise<void> {
    await this.fillInput(this.selectors.passwordInput, password);
  }

  /**
   * Click login button
   */
  async clickLogin(): Promise<void> {
    await this.clickElement(this.selectors.loginButton);
  }

  /**
   * Perform complete login flow
   */
  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickLogin();

    // Wait for either success (redirect) or error message
    await Promise.race([
      this.page.waitForNavigation({ timeout: 10000 }),
      this.waitForElement(this.selectors.errorMessage, 10000).catch(() => {}),
    ]);
  }

  /**
   * Login and wait for dashboard
   */
  async loginAndWaitForDashboard(email: string, password: string): Promise<void> {
    await this.login(email, password);

    // Verify successful login by checking URL or dashboard elements
    await expect(this.page).toHaveURL(/\/dashboard/);
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    if (await this.isElementVisible(this.selectors.errorMessage)) {
      return await this.getTextContent(this.selectors.errorMessage);
    }
    return '';
  }

  /**
   * Check if login button is disabled
   */
  async isLoginButtonDisabled(): Promise<boolean> {
    return !(await this.isElementEnabled(this.selectors.loginButton));
  }

  /**
   * Check if loading spinner is visible
   */
  async isLoadingSpinnerVisible(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.loadingSpinner);
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword(): Promise<void> {
    await this.clickElement(this.selectors.forgotPasswordLink);
  }

  /**
   * Click sign up link
   */
  async clickSignUp(): Promise<void> {
    await this.clickElement(this.selectors.signUpLink);
  }

  /**
   * Toggle remember me checkbox
   */
  async toggleRememberMe(): Promise<void> {
    await this.clickElement(this.selectors.rememberMeCheckbox);
  }

  /**
   * Check if remember me is checked
   */
  async isRememberMeChecked(): Promise<boolean> {
    return await this.isElementChecked(this.selectors.rememberMeCheckbox);
  }

  /**
   * Click Google login button
   */
  async clickGoogleLogin(): Promise<void> {
    await this.clickElement(this.selectors.socialLoginGoogle);
  }

  /**
   * Click Facebook login button
   */
  async clickFacebookLogin(): Promise<void> {
    await this.clickElement(this.selectors.socialLoginFacebook);
  }

  /**
   * Verify login page elements are present
   */
  async verifyPageElements(): Promise<void> {
    await expect(this.page.locator(this.selectors.logo)).toBeVisible();
    await expect(this.page.locator(this.selectors.emailInput)).toBeVisible();
    await expect(this.page.locator(this.selectors.passwordInput)).toBeVisible();
    await expect(this.page.locator(this.selectors.loginButton)).toBeVisible();
    await expect(this.page.locator(this.selectors.forgotPasswordLink)).toBeVisible();
    await expect(this.page.locator(this.selectors.signUpLink)).toBeVisible();
  }

  /**
   * Clear login form
   */
  async clearForm(): Promise<void> {
    await this.fillEmail('');
    await this.fillPassword('');
  }

  /**
   * Submit form by pressing Enter
   */
  async submitWithEnter(): Promise<void> {
    await this.page.locator(this.selectors.passwordInput).press('Enter');
  }

  /**
   * Check if current page is login page
   */
  async isOnLoginPage(): Promise<boolean> {
    return this.getCurrentUrl().includes('/login');
  }

  /**
   * Wait for login form to be ready
   */
  async waitForFormReady(): Promise<void> {
    await this.waitForElement(this.selectors.emailInput);
    await this.waitForElement(this.selectors.passwordInput);
    await this.waitForElement(this.selectors.loginButton);
  }

  /**
   * Attempt login with invalid credentials and verify error
   */
  async loginWithInvalidCredentials(email: string, password: string): Promise<string> {
    await this.login(email, password);
    await this.waitForElement(this.selectors.errorMessage);
    return await this.getErrorMessage();
  }
}
