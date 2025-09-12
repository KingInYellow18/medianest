import { Page, Locator, expect } from '@playwright/test';

import { BasePage } from './BasePage';

/**
 * Login Page Object for MediaNest authentication
 */
export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signUpLink: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByTestId('email-input');
    this.passwordInput = page.getByTestId('password-input');
    this.loginButton = page.getByTestId('login-submit');
    this.errorMessage = page.getByTestId('login-error');
    this.forgotPasswordLink = page.getByTestId('forgot-password-link');
    this.signUpLink = page.getByTestId('signup-link');
    this.rememberMeCheckbox = page.getByTestId('remember-me');
    this.loadingSpinner = page.getByTestId('login-loading');
  }

  async goto() {
    await this.navigate('/login');
  }

  /**
   * Perform login with email and password
   */
  async login(email: string, password: string, rememberMe = false) {
    await this.fillField(this.emailInput, email);
    await this.fillField(this.passwordInput, password);

    if (rememberMe) {
      await this.rememberMeCheckbox.check();
    }

    await this.clickWithRetry(this.loginButton);

    // Wait for login to complete (either success or error)
    await Promise.race([
      this.page.waitForURL('**/dashboard'),
      this.errorMessage.waitFor({ state: 'visible' }),
    ]);
  }

  /**
   * Login using keyboard navigation
   */
  async loginWithKeyboard(email: string, password: string) {
    await this.fillField(this.emailInput, email);
    await this.emailInput.press('Tab');
    await this.fillField(this.passwordInput, password);
    await this.passwordInput.press('Enter');

    // Wait for navigation or error
    await Promise.race([
      this.page.waitForURL('**/dashboard'),
      this.errorMessage.waitFor({ state: 'visible' }),
    ]);
  }

  /**
   * Validate error message appears with specific text
   */
  async expectErrorMessage(message: string) {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(message);
  }

  /**
   * Validate successful login
   */
  async expectSuccessfulLogin() {
    await expect(this.page).toHaveURL(/.*\/dashboard/);

    // Verify authentication token is stored
    const authToken = await this.getLocalStorage('authToken');
    expect(authToken).toBeTruthy();

    // Verify user menu is visible
    await expect(this.page.getByTestId('user-menu')).toBeVisible();
  }

  /**
   * Validate failed login
   */
  async expectFailedLogin() {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.page).toHaveURL(/.*\/login/);

    // Verify no auth token is stored
    const authToken = await this.getLocalStorage('authToken');
    expect(authToken).toBeFalsy();
  }

  /**
   * Check if form fields are properly validated
   */
  async validateFormFields() {
    // Test empty email
    await this.fillField(this.emailInput, '');
    await this.fillField(this.passwordInput, 'password');
    await this.loginButton.click();

    await expect(this.emailInput).toHaveAttribute('aria-invalid', 'true');

    // Test invalid email format
    await this.fillField(this.emailInput, 'invalid-email');
    await this.loginButton.click();

    await expect(this.emailInput).toHaveAttribute('aria-invalid', 'true');

    // Test empty password
    await this.fillField(this.emailInput, 'test@example.com');
    await this.fillField(this.passwordInput, '');
    await this.loginButton.click();

    await expect(this.passwordInput).toHaveAttribute('aria-invalid', 'true');
  }

  /**
   * Test accessibility features
   */
  async validateAccessibility() {
    // Check ARIA labels
    await expect(this.emailInput).toHaveAttribute('aria-label');
    await expect(this.passwordInput).toHaveAttribute('aria-label');
    await expect(this.loginButton).toHaveAttribute('aria-label');

    // Check form can be navigated with keyboard
    await this.emailInput.focus();
    await this.page.keyboard.press('Tab');
    await expect(this.passwordInput).toBeFocused();

    await this.page.keyboard.press('Tab');
    await expect(this.rememberMeCheckbox).toBeFocused();

    await this.page.keyboard.press('Tab');
    await expect(this.loginButton).toBeFocused();
  }

  /**
   * Test loading states
   */
  async expectLoadingState() {
    await expect(this.loadingSpinner).toBeVisible();
    await expect(this.loginButton).toBeDisabled();
  }

  async expectLoadingComplete() {
    await expect(this.loadingSpinner).toBeHidden();
    await expect(this.loginButton).toBeEnabled();
  }

  /**
   * Navigate to forgot password
   */
  async goToForgotPassword() {
    await this.clickWithRetry(this.forgotPasswordLink);
    await expect(this.page).toHaveURL(/.*\/forgot-password/);
  }

  /**
   * Navigate to sign up
   */
  async goToSignUp() {
    await this.clickWithRetry(this.signUpLink);
    await expect(this.page).toHaveURL(/.*\/signup/);
  }
}
