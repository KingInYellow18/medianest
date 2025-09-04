import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly loginButton: Locator;
  readonly plexOAuthButton: Locator;
  readonly errorMessage: Locator;
  readonly usernameError: Locator;
  readonly passwordError: Locator;
  readonly loginForm: Locator;
  readonly plexPinDialog: Locator;
  readonly plexPinCode: Locator;
  readonly verifyPinButton: Locator;
  readonly plexVerificationLink: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Form elements
    this.usernameInput = page.getByTestId('username-input');
    this.passwordInput = page.getByTestId('password-input');
    this.rememberMeCheckbox = page.getByTestId('remember-me-checkbox');
    this.loginButton = page.getByTestId('login-button');
    this.plexOAuthButton = page.getByTestId('plex-oauth-button');
    this.loginForm = page.getByTestId('login-form');
    
    // Error messages
    this.errorMessage = page.getByTestId('error-message');
    this.usernameError = page.getByTestId('username-error');
    this.passwordError = page.getByTestId('password-error');
    
    // Plex OAuth elements
    this.plexPinDialog = page.getByTestId('plex-pin-dialog');
    this.plexPinCode = page.getByTestId('plex-pin-code');
    this.verifyPinButton = page.getByTestId('verify-pin-button');
    this.plexVerificationLink = page.getByTestId('plex-verification-link');
  }

  /**
   * Navigate to the login page
   */
  async goto() {
    await this.page.goto('/auth/login');
  }

  /**
   * Perform standard username/password login
   */
  async login(username: string, password: string, rememberMe = false) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    
    if (rememberMe) {
      await this.rememberMeCheckbox.check();
    }
    
    await this.loginButton.click();
  }

  /**
   * Perform login with valid test credentials
   */
  async loginAsTestUser() {
    await this.login('testuser1', 'testpassword');
  }

  /**
   * Perform login as admin user
   */
  async loginAsAdmin() {
    await this.login('testadmin', 'testpassword');
  }

  /**
   * Submit the login form without filling credentials (for validation testing)
   */
  async submitEmptyForm() {
    await this.loginButton.click();
  }

  /**
   * Initiate Plex OAuth flow
   */
  async startPlexOAuth() {
    await this.plexOAuthButton.click();
  }

  /**
   * Complete Plex OAuth verification
   */
  async verifyPlexPin() {
    await this.verifyPinButton.click();
  }

  /**
   * Check if user is logged in (by checking if we're redirected)
   */
  async isLoggedIn(): Promise<boolean> {
    await this.page.waitForURL('**/dashboard', { timeout: 5000 }).catch(() => {});
    return this.page.url().includes('/dashboard');
  }

  /**
   * Check if login form is visible
   */
  async isLoginFormVisible(): Promise<boolean> {
    return await this.loginForm.isVisible();
  }

  /**
   * Check if error message is displayed
   */
  async hasError(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * Get the error message text
   */
  async getErrorMessage(): Promise<string> {
    return await this.errorMessage.textContent() || '';
  }

  /**
   * Check if validation errors are shown
   */
  async hasValidationErrors(): Promise<boolean> {
    const usernameErrorVisible = await this.usernameError.isVisible();
    const passwordErrorVisible = await this.passwordError.isVisible();
    return usernameErrorVisible || passwordErrorVisible;
  }

  /**
   * Check if Plex PIN dialog is open
   */
  async isPlexPinDialogOpen(): Promise<boolean> {
    return await this.plexPinDialog.isVisible();
  }

  /**
   * Get the displayed Plex PIN code
   */
  async getPlexPin(): Promise<string> {
    return await this.plexPinCode.textContent() || '';
  }

  /**
   * Check if login button is disabled (for rate limiting)
   */
  async isLoginButtonDisabled(): Promise<boolean> {
    return await this.loginButton.isDisabled();
  }

  /**
   * Clear the login form
   */
  async clearForm() {
    await this.usernameInput.clear();
    await this.passwordInput.clear();
    if (await this.rememberMeCheckbox.isChecked()) {
      await this.rememberMeCheckbox.uncheck();
    }
  }

  /**
   * Wait for page to load completely
   */
  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if form has CSRF token
   */
  async hasCsrfToken(): Promise<boolean> {
    const csrfInput = this.page.locator('input[name="_csrf"]');
    return await csrfInput.isVisible();
  }

  /**
   * Get CSRF token value
   */
  async getCsrfToken(): Promise<string> {
    const csrfInput = this.page.locator('input[name="_csrf"]');
    return await csrfInput.getAttribute('value') || '';
  }

  /**
   * Attempt multiple failed logins (for rate limiting testing)
   */
  async attemptMultipleFailedLogins(attempts = 5) {
    for (let i = 0; i < attempts; i++) {
      await this.clearForm();
      await this.login('testuser', 'wrongpassword');
      await this.page.waitForTimeout(100); // Small delay between attempts
    }
  }

  /**
   * Check accessibility features
   */
  async checkAccessibility() {
    const checks = {
      usernameLabel: await this.page.locator('label[for="username"]').isVisible(),
      passwordLabel: await this.page.locator('label[for="password"]').isVisible(),
      usernameRequired: await this.usernameInput.getAttribute('aria-required') === 'true',
      passwordRequired: await this.passwordInput.getAttribute('aria-required') === 'true',
    };
    
    return checks;
  }

  /**
   * Navigate through form using keyboard
   */
  async navigateWithKeyboard() {
    await this.page.keyboard.press('Tab'); // Username field
    await this.page.keyboard.press('Tab'); // Password field
    await this.page.keyboard.press('Tab'); // Remember me checkbox
    await this.page.keyboard.press('Tab'); // Login button
  }

  /**
   * Submit form using Enter key
   */
  async submitWithEnter() {
    await this.passwordInput.press('Enter');
  }
}