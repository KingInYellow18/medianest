import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object Model for the Change Password page
 * Handles both required password changes and voluntary password updates
 */
export class ChangePasswordPage extends BasePage {
  // Page-specific selectors
  private readonly selectors = {
    // Page elements
    pageTitle: '[data-testid="change-password-title"]',
    pageDescription: '[data-testid="change-password-description"]',
    requiresPasswordChangeNotice: '[data-testid="requires-password-change"]',
    
    // Form elements
    changePasswordForm: '[data-testid="change-password-form"]',
    currentPasswordInput: '#currentPassword',
    newPasswordInput: '#newPassword',
    confirmPasswordInput: '#confirmPassword',
    
    // Buttons
    updatePasswordButton: '[data-testid="update-password-button"]',
    skipForNowButton: '[data-testid="skip-for-now-button"]',
    backToSignInButton: '[data-testid="back-to-signin-button"]',
    
    // Validation and feedback
    passwordStrengthIndicator: '[data-testid="password-strength"]',
    passwordRequirements: '[data-testid="password-requirements"]',
    validationError: '[data-testid="validation-error"]',
    
    // Loading states
    updatingPasswordText: '[data-testid="updating-password-text"]',
    
    // Success states
    successMessage: '[data-testid="success-message"]',
    redirectingText: '[data-testid="redirecting-text"]',
  };

  constructor(page: Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await this.page.goto('/auth/change-password');
    await this.waitForLoad();
  }

  async isLoaded(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.changePasswordForm);
  }

  getPageTitle(): string {
    return 'Change Password';
  }

  protected getMainContentSelector(): string {
    return this.selectors.changePasswordForm;
  }

  /**
   * Verify the page loaded correctly
   */
  async verifyPageElements(): Promise<void> {
    await expect(this.page.locator(this.selectors.pageTitle)).toBeVisible();
    await expect(this.page.locator(this.selectors.changePasswordForm)).toBeVisible();
    await expect(this.page.locator(this.selectors.currentPasswordInput)).toBeVisible();
    await expect(this.page.locator(this.selectors.newPasswordInput)).toBeVisible();
    await expect(this.page.locator(this.selectors.confirmPasswordInput)).toBeVisible();
    await expect(this.page.locator(this.selectors.updatePasswordButton)).toBeVisible();
  }

  /**
   * Check if password change is required
   */
  async isPasswordChangeRequired(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.requiresPasswordChangeNotice);
  }

  /**
   * Check if skip option is available
   */
  async isSkipAvailable(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.skipForNowButton);
  }

  /**
   * Change password with full validation
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword?: string
  ): Promise<void> {
    // Use newPassword for confirm if not specified
    const confirmPass = confirmPassword || newPassword;
    
    // Fill form fields
    await this.fillInput(this.selectors.currentPasswordInput, currentPassword, { clear: true });
    await this.fillInput(this.selectors.newPasswordInput, newPassword, { clear: true });
    await this.fillInput(this.selectors.confirmPasswordInput, confirmPass, { clear: true });
    
    // Submit form
    await this.clickElement(this.selectors.updatePasswordButton);
    
    // Wait for processing
    await this.waitForFormSubmission();
  }

  /**
   * Get password strength indication
   */
  async getPasswordStrength(): Promise<string> {
    if (await this.isElementVisible(this.selectors.passwordStrengthIndicator)) {
      return await this.getTextContent(this.selectors.passwordStrengthIndicator);
    }
    return '';
  }

  /**
   * Get password requirements
   */
  async getPasswordRequirements(): Promise<string[]> {
    if (await this.isElementVisible(this.selectors.passwordRequirements)) {
      const requirementsElement = this.page.locator(this.selectors.passwordRequirements);
      const requirements = await requirementsElement.locator('li').allTextContents();
      return requirements;
    }
    return [];
  }

  /**
   * Validate password requirements are met
   */
  async validatePasswordRequirements(password: string): Promise<boolean> {
    await this.fillInput(this.selectors.newPasswordInput, password);
    
    // Trigger validation by focusing another field
    await this.clickElement(this.selectors.confirmPasswordInput);
    
    // Check if any validation errors are shown
    return !(await this.isElementVisible(this.selectors.validationError));
  }

  /**
   * Get form validation errors
   */
  async getValidationErrors(): Promise<string[]> {
    const errorElements = this.page.locator(this.selectors.validationError);
    const errors = await errorElements.allTextContents();
    return errors.filter(error => error.trim() !== '');
  }

  /**
   * Test password confirmation matching
   */
  async testPasswordConfirmation(password: string, confirmPassword: string): Promise<boolean> {
    await this.fillInput(this.selectors.newPasswordInput, password);
    await this.fillInput(this.selectors.confirmPasswordInput, confirmPassword);
    
    // Trigger validation
    await this.page.locator(this.selectors.confirmPasswordInput).blur();
    
    // Check if confirmation error is shown
    const errors = await this.getValidationErrors();
    return !errors.some(error => error.includes('match'));
  }

  /**
   * Skip password change (if allowed)
   */
  async skipPasswordChange(): Promise<void> {
    if (await this.isSkipAvailable()) {
      await this.clickElement(this.selectors.skipForNowButton);
      await this.waitForLoading();
    } else {
      throw new Error('Skip option is not available - password change may be required');
    }
  }

  /**
   * Go back to sign in
   */
  async goBackToSignIn(): Promise<void> {
    if (await this.isElementVisible(this.selectors.backToSignInButton)) {
      await this.clickElement(this.selectors.backToSignInButton);
      await this.page.waitForURL('/auth/signin');
    }
  }

  /**
   * Wait for password change success
   */
  async waitForPasswordChangeSuccess(): Promise<void> {
    await this.waitForElement(this.selectors.successMessage);
    
    // Wait for redirect
    if (await this.isElementVisible(this.selectors.redirectingText)) {
      await this.page.waitForURL('/dashboard', { timeout: 10000 });
    }
  }

  /**
   * Test various password scenarios
   */
  async testPasswordScenarios(): Promise<void> {
    // Test weak password
    const weakPassword = '123';
    await this.fillInput(this.selectors.newPasswordInput, weakPassword);
    const weakStrength = await this.getPasswordStrength();
    expect(weakStrength).toContain('weak');
    
    // Test medium password
    const mediumPassword = 'password123';
    await this.fillInput(this.selectors.newPasswordInput, mediumPassword);
    const mediumStrength = await this.getPasswordStrength();
    expect(mediumStrength).toMatch(/(medium|fair)/i);
    
    // Test strong password
    const strongPassword = 'MyStr0ng!P@ssw0rd';
    await this.fillInput(this.selectors.newPasswordInput, strongPassword);
    const strongStrength = await this.getPasswordStrength();
    expect(strongStrength).toContain('strong');
  }

  /**
   * Test form validation scenarios
   */
  async testFormValidation(): Promise<void> {
    // Test empty fields
    await this.clickElement(this.selectors.updatePasswordButton);
    let errors = await this.getValidationErrors();
    expect(errors.length).toBeGreaterThan(0);
    
    // Test mismatched confirmation
    await this.fillInput(this.selectors.currentPasswordInput, 'admin');
    await this.fillInput(this.selectors.newPasswordInput, 'newpassword');
    await this.fillInput(this.selectors.confirmPasswordInput, 'different');
    
    await this.clickElement(this.selectors.updatePasswordButton);
    errors = await this.getValidationErrors();
    expect(errors.some(error => error.includes('match'))).toBe(true);
    
    // Test same as current password
    await this.fillInput(this.selectors.newPasswordInput, 'admin');
    await this.fillInput(this.selectors.confirmPasswordInput, 'admin');
    
    await this.clickElement(this.selectors.updatePasswordButton);
    errors = await this.getValidationErrors();
    expect(errors.some(error => error.includes('current'))).toBe(true);
  }

  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation(): Promise<void> {
    // Tab through form fields
    await this.page.locator(this.selectors.currentPasswordInput).focus();
    
    await this.navigateWithTab();
    await expect(this.page.locator(this.selectors.newPasswordInput)).toBeFocused();
    
    await this.navigateWithTab();
    await expect(this.page.locator(this.selectors.confirmPasswordInput)).toBeFocused();
    
    await this.navigateWithTab();
    await expect(this.page.locator(this.selectors.updatePasswordButton)).toBeFocused();
    
    // Test form submission with Enter
    await this.fillInput(this.selectors.currentPasswordInput, 'admin');
    await this.fillInput(this.selectors.newPasswordInput, 'NewPassword123!');
    await this.fillInput(this.selectors.confirmPasswordInput, 'NewPassword123!');
    
    await this.pressEnter();
    await this.waitForLoading();
  }

  /**
   * Test accessibility features
   */
  async testAccessibility(): Promise<void> {
    // Check form labels
    const currentPasswordLabel = this.page.locator('label[for="currentPassword"]');
    const newPasswordLabel = this.page.locator('label[for="newPassword"]');
    const confirmPasswordLabel = this.page.locator('label[for="confirmPassword"]');
    
    await expect(currentPasswordLabel).toBeVisible();
    await expect(newPasswordLabel).toBeVisible();
    await expect(confirmPasswordLabel).toBeVisible();
    
    // Check ARIA attributes
    const newPasswordInput = this.page.locator(this.selectors.newPasswordInput);
    const confirmPasswordInput = this.page.locator(this.selectors.confirmPasswordInput);
    
    // Should have aria-describedby for password requirements
    expect(await newPasswordInput.getAttribute('aria-describedby')).toBeTruthy();
    expect(await confirmPasswordInput.getAttribute('aria-describedby')).toBeTruthy();
    
    // Check error announcements
    await this.fillInput(this.selectors.newPasswordInput, '123');
    await this.fillInput(this.selectors.confirmPasswordInput, '456');
    await this.clickElement(this.selectors.updatePasswordButton);
    
    const errorElement = this.page.locator(this.selectors.validationError).first();
    if (await errorElement.isVisible()) {
      expect(await errorElement.getAttribute('role')).toBe('alert');
    }
  }

  /**
   * Complete password change workflow
   */
  async completePasswordChange(
    currentPassword: string = 'admin',
    newPassword: string = 'NewSecurePassword123!'
  ): Promise<void> {
    await this.verifyPageElements();
    await this.changePassword(currentPassword, newPassword);
    await this.waitForPasswordChangeSuccess();
  }

  /**
   * Handle required password change scenario
   */
  async handleRequiredPasswordChange(): Promise<void> {
    const isRequired = await this.isPasswordChangeRequired();
    expect(isRequired).toBe(true);
    
    // Skip should not be available for required changes
    const canSkip = await this.isSkipAvailable();
    expect(canSkip).toBe(false);
    
    await this.completePasswordChange();
  }
}