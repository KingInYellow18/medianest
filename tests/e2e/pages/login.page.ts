import { Page, expect } from '@playwright/test'
import { BasePage } from './base.page'

export class LoginPage extends BasePage {
  // Selectors
  private readonly plexLoginButton = '[data-testid="plex-login-button"]'
  private readonly pinInput = '[data-testid="pin-input"]'
  private readonly verifyPinButton = '[data-testid="verify-pin"]'
  private readonly errorMessage = '[data-testid="auth-error"]'
  private readonly loadingSpinner = '[data-testid="auth-loading"]'

  constructor(page: Page) {
    super(page)
  }

  async goto(): Promise<void> {
    await this.page.goto('/auth/signin')
    await this.waitForLoad()
  }

  /**
   * Check if login page is displayed
   */
  async isDisplayed(): Promise<boolean> {
    return await this.isElementVisible(this.plexLoginButton)
  }

  /**
   * Click the Plex login button
   */
  async clickPlexLogin(): Promise<void> {
    await this.page.click(this.plexLoginButton)
  }

  /**
   * Enter PIN code
   */
  async enterPin(pin: string): Promise<void> {
    await this.page.fill(this.pinInput, pin)
  }

  /**
   * Click verify PIN button
   */
  async clickVerifyPin(): Promise<void> {
    await this.page.click(this.verifyPinButton)
  }

  /**
   * Complete full login flow
   */
  async loginWithPin(pin: string): Promise<void> {
    await this.clickPlexLogin()
    await expect(this.page.locator(this.pinInput)).toBeVisible()
    await this.enterPin(pin)
    await this.clickVerifyPin()
  }

  /**
   * Check if error message is displayed
   */
  async hasError(): Promise<boolean> {
    return await this.isElementVisible(this.errorMessage)
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    const errorElement = this.page.locator(this.errorMessage)
    await errorElement.waitFor({ state: 'visible' })
    return await errorElement.textContent() || ''
  }

  /**
   * Check if loading spinner is visible
   */
  async isLoading(): Promise<boolean> {
    return await this.isElementVisible(this.loadingSpinner)
  }

  /**
   * Wait for login to complete (redirect to dashboard)
   */
  async waitForLoginSuccess(): Promise<void> {
    await expect(this.page).toHaveURL('/dashboard')
  }
}