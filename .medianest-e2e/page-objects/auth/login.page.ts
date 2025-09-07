import { Page } from '@playwright/test'
import { BasePage } from '../base.page'

/**
 * Login Page Object Model
 * Handles authentication flow for MediaNest
 */
export class LoginPage extends BasePage {
  // Selectors
  private readonly selectors = {
    pageTitle: 'h1, [data-testid="login-title"]',
    emailInput: 'input[type="email"], input[name="email"], #email, [data-testid="email-input"]',
    passwordInput: 'input[type="password"], input[name="password"], #password, [data-testid="password-input"]',
    submitButton: 'button[type="submit"], input[type="submit"], button:has-text("Sign In"), button:has-text("Login"), [data-testid="login-button"]',
    errorMessage: '.error, .alert-error, [data-testid="error-message"], [role="alert"]',
    successMessage: '.success, .alert-success, [data-testid="success-message"]',
    forgotPasswordLink: 'a:has-text("Forgot"), a:has-text("Reset"), [data-testid="forgot-password-link"]',
    registerLink: 'a:has-text("Register"), a:has-text("Sign Up"), [data-testid="register-link"]',
    plexAuthButton: 'button:has-text("Plex"), .plex-auth, [data-testid="plex-auth-button"]',
    rememberMeCheckbox: 'input[type="checkbox"][name="remember"], #remember, [data-testid="remember-checkbox"]',
    loadingSpinner: '.loading, .spinner, [data-testid="loading-spinner"]',
    
    // Form validation
    emailError: '[data-testid="email-error"], .email-error',
    passwordError: '[data-testid="password-error"], .password-error',
    
    // Social auth
    googleAuthButton: 'button:has-text("Google"), [data-testid="google-auth-button"]',
    githubAuthButton: 'button:has-text("GitHub"), [data-testid="github-auth-button"]'
  }

  constructor(page: Page) {
    super(page)
  }

  /**
   * Navigate to login page
   */
  async goto(): Promise<void> {
    await this.navigateTo('/auth/signin')
  }

  /**
   * Check if login page is loaded
   */
  async isLoaded(): Promise<boolean> {
    try {
      await this.waitForElement(this.selectors.pageTitle, 10000)
      const title = await this.getElementText(this.selectors.pageTitle)
      return title.toLowerCase().includes('sign in') || 
             title.toLowerCase().includes('login') ||
             title.toLowerCase().includes('authenticate')
    } catch {
      return false
    }
  }

  // ==================== AUTHENTICATION ACTIONS ====================

  /**
   * Login with email and password
   */
  async login(email: string, password: string, options?: { 
    rememberMe?: boolean
    expectSuccess?: boolean 
  }): Promise<void> {
    await this.fillEmail(email)
    await this.fillPassword(password)
    
    if (options?.rememberMe) {
      await this.checkRememberMe()
    }
    
    await this.clickSubmit()
    
    if (options?.expectSuccess !== false) {
      await this.waitForLoginSuccess()
    }
  }

  /**
   * Quick login for test users
   */
  async quickLogin(userType: 'user' | 'admin' = 'user'): Promise<void> {
    const credentials = userType === 'admin' 
      ? {
          email: process.env.TEST_ADMIN_EMAIL || 'admin@medianest.local',
          password: process.env.TEST_ADMIN_PASSWORD || 'adminpassword123'
        }
      : {
          email: process.env.TEST_USER_EMAIL || 'test@medianest.local',
          password: process.env.TEST_USER_PASSWORD || 'testpassword123'
        }
    
    await this.login(credentials.email, credentials.password)
  }

  /**
   * Attempt login with invalid credentials
   */
  async attemptInvalidLogin(email: string, password: string): Promise<void> {
    await this.login(email, password, { expectSuccess: false })
    await this.waitForErrorMessage()
  }

  /**
   * Login with Plex authentication
   */
  async loginWithPlex(): Promise<void> {
    await this.clickElement(this.selectors.plexAuthButton)
    // Note: This would require handling the Plex OAuth flow
    // which might open in a new tab/window
  }

  // ==================== FORM FIELD ACTIONS ====================

  /**
   * Fill email field
   */
  async fillEmail(email: string): Promise<void> {
    await this.fillInput(this.selectors.emailInput, email, { clear: true })
  }

  /**
   * Fill password field
   */
  async fillPassword(password: string): Promise<void> {
    await this.fillInput(this.selectors.passwordInput, password, { clear: true })
  }

  /**
   * Check remember me checkbox
   */
  async checkRememberMe(): Promise<void> {
    if (await this.isElementVisible(this.selectors.rememberMeCheckbox)) {
      await this.setCheckbox(this.selectors.rememberMeCheckbox, true)
    }
  }

  /**
   * Click submit button
   */
  async clickSubmit(): Promise<void> {
    await this.clickElement(this.selectors.submitButton)
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword(): Promise<void> {
    await this.clickElement(this.selectors.forgotPasswordLink)
  }

  /**
   * Click register link
   */
  async clickRegister(): Promise<void> {
    await this.clickElement(this.selectors.registerLink)
  }

  // ==================== VALIDATION & FEEDBACK ====================

  /**
   * Wait for login success (redirect to dashboard)
   */
  async waitForLoginSuccess(timeout = 15000): Promise<void> {
    // Wait for redirect to dashboard or main app
    await Promise.race([
      this.page.waitForURL(/dashboard/, { timeout }),
      this.page.waitForURL(/plex/, { timeout }),
      this.page.waitForURL(/home/, { timeout }),
      this.page.waitForURL(/app/, { timeout })
    ])
  }

  /**
   * Wait for error message
   */
  async waitForErrorMessage(timeout = 10000): Promise<void> {
    await this.waitForElement(this.selectors.errorMessage, timeout)
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    return await this.getElementText(this.selectors.errorMessage)
  }

  /**
   * Check if login is in progress
   */
  async isLoading(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.loadingSpinner, 1000)
  }

  /**
   * Check if email field has error
   */
  async hasEmailError(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.emailError)
  }

  /**
   * Check if password field has error
   */
  async hasPasswordError(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.passwordError)
  }

  /**
   * Get email validation error
   */
  async getEmailError(): Promise<string> {
    if (await this.hasEmailError()) {
      return await this.getElementText(this.selectors.emailError)
    }
    return ''
  }

  /**
   * Get password validation error
   */
  async getPasswordError(): Promise<string> {
    if (await this.hasPasswordError()) {
      return await this.getElementText(this.selectors.passwordError)
    }
    return ''
  }

  // ==================== FORM VALIDATION ====================

  /**
   * Validate email field (check if it accepts valid/invalid emails)
   */
  async validateEmailField(email: string): Promise<boolean> {
    await this.fillEmail(email)
    await this.clickElement('body') // Click outside to trigger validation
    return !(await this.hasEmailError())
  }

  /**
   * Test form validation
   */
  async testFormValidation(): Promise<{
    emptyEmail: boolean
    emptyPassword: boolean
    invalidEmail: boolean
  }> {
    // Test empty email
    await this.fillEmail('')
    await this.fillPassword('password')
    await this.clickSubmit()
    const emptyEmail = await this.hasEmailError()

    // Test empty password
    await this.fillEmail('test@example.com')
    await this.fillPassword('')
    await this.clickSubmit()
    const emptyPassword = await this.hasPasswordError()

    // Test invalid email
    await this.fillEmail('invalid-email')
    await this.fillPassword('password')
    await this.clickElement('body')
    const invalidEmail = await this.hasEmailError()

    return { emptyEmail, emptyPassword, invalidEmail }
  }

  // ==================== ACCESSIBILITY ====================

  /**
   * Check login form accessibility
   */
  async checkAccessibility(): Promise<void> {
    await super.checkAccessibility('form, [role="form"]', {
      rules: {
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'focus-management': { enabled: true },
        'label': { enabled: true }
      }
    })
  }

  // ==================== ASSERTIONS ====================

  /**
   * Assert login page is displayed
   */
  async assertLoginPageDisplayed(): Promise<void> {
    await this.assertElementVisible(this.selectors.pageTitle, 'Login page title should be visible')
    await this.assertElementVisible(this.selectors.emailInput, 'Email input should be visible')
    await this.assertElementVisible(this.selectors.passwordInput, 'Password input should be visible')
    await this.assertElementVisible(this.selectors.submitButton, 'Submit button should be visible')
  }

  /**
   * Assert login success
   */
  async assertLoginSuccess(): Promise<void> {
    // Should be redirected away from login page
    await this.assertURL(/dashboard|plex|home|app/, 'Should redirect to main app after login')
  }

  /**
   * Assert login error
   */
  async assertLoginError(expectedMessage?: string): Promise<void> {
    await this.assertElementVisible(this.selectors.errorMessage, 'Error message should be displayed')
    
    if (expectedMessage) {
      await this.assertElementContainsText(
        this.selectors.errorMessage, 
        expectedMessage, 
        `Error message should contain: ${expectedMessage}`
      )
    }
  }
}