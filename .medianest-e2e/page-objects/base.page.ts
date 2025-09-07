import { Page, Locator, expect } from '@playwright/test'
import { injectAxe, checkA11y } from 'axe-playwright'

/**
 * Enhanced Base Page Object Model for MediaNest
 * Provides comprehensive functionality for all page objects
 */
export abstract class BasePage {
  protected page: Page
  protected baseURL: string

  constructor(page: Page, baseURL = '') {
    this.page = page
    this.baseURL = baseURL
  }

  /**
   * Abstract method to be implemented by each page
   * Should navigate to the specific page
   */
  abstract goto(): Promise<void>

  /**
   * Abstract method to verify page is loaded
   * Should check for page-specific elements
   */
  abstract isLoaded(): Promise<boolean>

  // ==================== NAVIGATION & LOADING ====================

  /**
   * Navigate to a specific URL
   */
  async navigateTo(path: string): Promise<void> {
    const url = this.baseURL ? `${this.baseURL}${path}` : path
    await this.page.goto(url)
    await this.waitForPageLoad()
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad(): Promise<void> {
    await Promise.all([
      this.page.waitForLoadState('networkidle', { timeout: 30000 }),
      this.page.waitForLoadState('domcontentloaded', { timeout: 30000 })
    ])
  }

  /**
   * Reload the current page
   */
  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: 'networkidle' })
  }

  // ==================== ELEMENT INTERACTIONS ====================

  /**
   * Wait for element to be visible and return locator
   */
  async waitForElement(selector: string, timeout = 15000): Promise<Locator> {
    const element = this.page.locator(selector)
    await element.waitFor({ state: 'visible', timeout })
    return element
  }

  /**
   * Wait for element to be hidden
   */
  async waitForElementHidden(selector: string, timeout = 15000): Promise<void> {
    const element = this.page.locator(selector)
    await element.waitFor({ state: 'hidden', timeout })
  }

  /**
   * Check if element is visible
   */
  async isElementVisible(selector: string, timeout = 5000): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ state: 'visible', timeout })
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if element exists in DOM
   */
  async isElementPresent(selector: string): Promise<boolean> {
    return await this.page.locator(selector).count() > 0
  }

  /**
   * Get element text content
   */
  async getElementText(selector: string): Promise<string> {
    const element = await this.waitForElement(selector)
    return await element.textContent() ?? ''
  }

  /**
   * Get element attribute
   */
  async getElementAttribute(selector: string, attribute: string): Promise<string | null> {
    const element = await this.waitForElement(selector)
    return await element.getAttribute(attribute)
  }

  /**
   * Click element with retry logic
   */
  async clickElement(selector: string, options?: { timeout?: number; force?: boolean }): Promise<void> {
    const element = await this.waitForElement(selector, options?.timeout)
    await element.click({ force: options?.force })
  }

  /**
   * Double click element
   */
  async doubleClickElement(selector: string): Promise<void> {
    const element = await this.waitForElement(selector)
    await element.dblclick()
  }

  /**
   * Right click element
   */
  async rightClickElement(selector: string): Promise<void> {
    const element = await this.waitForElement(selector)
    await element.click({ button: 'right' })
  }

  /**
   * Hover over element
   */
  async hoverElement(selector: string): Promise<void> {
    const element = await this.waitForElement(selector)
    await element.hover()
  }

  // ==================== FORM INTERACTIONS ====================

  /**
   * Fill input field with retry logic
   */
  async fillInput(selector: string, value: string, options?: { clear?: boolean }): Promise<void> {
    const element = await this.waitForElement(selector)
    
    if (options?.clear) {
      await element.clear()
    }
    
    await element.fill(value)
    
    // Verify the value was set correctly
    const actualValue = await element.inputValue()
    if (actualValue !== value) {
      // Retry once if value doesn't match
      await element.clear()
      await element.fill(value)
    }
  }

  /**
   * Select option from dropdown
   */
  async selectOption(selector: string, value: string | { label?: string; value?: string; index?: number }): Promise<void> {
    const element = await this.waitForElement(selector)
    
    if (typeof value === 'string') {
      await element.selectOption(value)
    } else if (value.label) {
      await element.selectOption({ label: value.label })
    } else if (value.value) {
      await element.selectOption({ value: value.value })
    } else if (value.index !== undefined) {
      await element.selectOption({ index: value.index })
    }
  }

  /**
   * Check or uncheck checkbox/radio button
   */
  async setCheckbox(selector: string, checked: boolean): Promise<void> {
    const element = await this.waitForElement(selector)
    await element.setChecked(checked)
  }

  /**
   * Upload file to input
   */
  async uploadFile(selector: string, filePath: string | string[]): Promise<void> {
    const element = await this.waitForElement(selector)
    await element.setInputFiles(filePath)
  }

  // ==================== ASSERTIONS & VERIFICATION ====================

  /**
   * Assert element is visible
   */
  async assertElementVisible(selector: string, message?: string): Promise<void> {
    const element = this.page.locator(selector)
    await expect(element, message).toBeVisible()
  }

  /**
   * Assert element is hidden
   */
  async assertElementHidden(selector: string, message?: string): Promise<void> {
    const element = this.page.locator(selector)
    await expect(element, message).toBeHidden()
  }

  /**
   * Assert element contains text
   */
  async assertElementContainsText(selector: string, text: string | RegExp, message?: string): Promise<void> {
    const element = this.page.locator(selector)
    await expect(element, message).toContainText(text)
  }

  /**
   * Assert element has exact text
   */
  async assertElementHasText(selector: string, text: string | RegExp, message?: string): Promise<void> {
    const element = this.page.locator(selector)
    await expect(element, message).toHaveText(text)
  }

  /**
   * Assert element has attribute
   */
  async assertElementHasAttribute(selector: string, attribute: string, value?: string | RegExp, message?: string): Promise<void> {
    const element = this.page.locator(selector)
    if (value !== undefined) {
      await expect(element, message).toHaveAttribute(attribute, value)
    } else {
      await expect(element, message).toHaveAttribute(attribute)
    }
  }

  /**
   * Assert element count
   */
  async assertElementCount(selector: string, count: number, message?: string): Promise<void> {
    const elements = this.page.locator(selector)
    await expect(elements, message).toHaveCount(count)
  }

  // ==================== PAGE METADATA ====================

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return await this.page.title()
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url()
  }

  /**
   * Assert page title
   */
  async assertTitle(title: string | RegExp, message?: string): Promise<void> {
    await expect(this.page, message).toHaveTitle(title)
  }

  /**
   * Assert page URL
   */
  async assertURL(url: string | RegExp, message?: string): Promise<void> {
    await expect(this.page, message).toHaveURL(url)
  }

  // ==================== SCREENSHOTS & DEBUGGING ====================

  /**
   * Take screenshot
   */
  async takeScreenshot(name: string, options?: { fullPage?: boolean }): Promise<void> {
    const path = `./.medianest-e2e/screenshots/${name}-${Date.now()}.png`
    await this.page.screenshot({ 
      path, 
      fullPage: options?.fullPage ?? false 
    })
  }

  /**
   * Take full page screenshot
   */
  async takeFullPageScreenshot(name: string): Promise<void> {
    await this.takeScreenshot(name, { fullPage: true })
  }

  // ==================== ACCESSIBILITY ====================

  /**
   * Inject axe-core for accessibility testing
   */
  async injectAxe(): Promise<void> {
    await injectAxe(this.page)
  }

  /**
   * Run accessibility check
   */
  async checkAccessibility(selector?: string, options?: any): Promise<void> {
    await this.injectAxe()
    if (selector) {
      await checkA11y(this.page, selector, options)
    } else {
      await checkA11y(this.page, null, options)
    }
  }

  // ==================== WAITING & TIMING ====================

  /**
   * Wait for specific timeout
   */
  async wait(milliseconds: number): Promise<void> {
    await this.page.waitForTimeout(milliseconds)
  }

  /**
   * Wait for network to be idle
   */
  async waitForNetworkIdle(): Promise<void> {
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Wait for specific response
   */
  async waitForResponse(urlPattern: string | RegExp): Promise<void> {
    await this.page.waitForResponse(urlPattern)
  }

  /**
   * Wait for specific request
   */
  async waitForRequest(urlPattern: string | RegExp): Promise<void> {
    await this.page.waitForRequest(urlPattern)
  }

  // ==================== BROWSER ACTIONS ====================

  /**
   * Go back in browser history
   */
  async goBack(): Promise<void> {
    await this.page.goBack()
  }

  /**
   * Go forward in browser history
   */
  async goForward(): Promise<void> {
    await this.page.goForward()
  }

  /**
   * Refresh the page
   */
  async refresh(): Promise<void> {
    await this.page.reload({ waitUntil: 'networkidle' })
  }

  // ==================== SCROLL ACTIONS ====================

  /**
   * Scroll to element
   */
  async scrollToElement(selector: string): Promise<void> {
    const element = await this.waitForElement(selector)
    await element.scrollIntoViewIfNeeded()
  }

  /**
   * Scroll to top of page
   */
  async scrollToTop(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, 0))
  }

  /**
   * Scroll to bottom of page
   */
  async scrollToBottom(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  }

  // ==================== KEYBOARD ACTIONS ====================

  /**
   * Press keyboard key
   */
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key)
  }

  /**
   * Press multiple keys
   */
  async pressKeys(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.page.keyboard.press(key)
    }
  }

  /**
   * Type text
   */
  async typeText(text: string, delay = 0): Promise<void> {
    await this.page.keyboard.type(text, { delay })
  }
}