import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object for MediaNest E2E tests
 * Provides common functionality for all page objects
 */
export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a specific path
   */
  async navigate(path: string = '') {
    await this.page.goto(path);
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.evaluate(() => document.readyState === 'complete');
  }

  /**
   * Take a screenshot with a specific name
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({
      path: `e2e/results/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  /**
   * Scroll to an element
   */
  async scrollToElement(locator: Locator) {
    await locator.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
  }

  /**
   * Wait for animations to complete
   */
  async waitForAnimation() {
    await this.page.waitForTimeout(300);
  }

  /**
   * Get local storage value
   */
  async getLocalStorage(key: string) {
    return await this.page.evaluate((k) => localStorage.getItem(k), key);
  }

  /**
   * Set local storage value
   */
  async setLocalStorage(key: string, value: string) {
    await this.page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value]);
  }

  /**
   * Clear all cookies
   */
  async clearCookies() {
    await this.page.context().clearCookies();
  }

  /**
   * Mock API endpoint
   */
  async mockAPI(endpoint: string, response: any, status = 200) {
    await this.page.route(`**/api/${endpoint}`, async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  /**
   * Wait for specific response
   */
  async waitForResponse(urlPattern: string | RegExp) {
    return await this.page.waitForResponse(urlPattern);
  }

  /**
   * Execute JavaScript in browser context
   */
  async executeScript<T>(script: Function, ...args: any[]): Promise<T> {
    return await this.page.evaluate(script, ...args);
  }

  /**
   * Wait for element to be visible and stable
   */
  async waitForElementStable(locator: Locator, timeout = 5000) {
    await expect(locator).toBeVisible();
    await locator.waitFor({ state: 'attached', timeout });

    // Wait for element to be stable (no movement)
    let previousBox = await locator.boundingBox();
    let stableCount = 0;

    while (stableCount < 3) {
      await this.page.waitForTimeout(100);
      const currentBox = await locator.boundingBox();

      if (
        previousBox &&
        currentBox &&
        previousBox.x === currentBox.x &&
        previousBox.y === currentBox.y
      ) {
        stableCount++;
      } else {
        stableCount = 0;
      }

      previousBox = currentBox;
    }
  }

  /**
   * Fill form field with validation
   */
  async fillField(locator: Locator, value: string, validate = true) {
    await locator.fill(value);

    if (validate) {
      await expect(locator).toHaveValue(value);
    }
  }

  /**
   * Click with retry logic
   */
  async clickWithRetry(locator: Locator, retries = 3) {
    let lastError;

    for (let i = 0; i < retries; i++) {
      try {
        await this.waitForElementStable(locator);
        await locator.click();
        return;
      } catch (error) {
        lastError = error;
        await this.page.waitForTimeout(500);
      }
    }

    throw lastError;
  }

  /**
   * Type with human-like delay
   */
  async typeHuman(locator: Locator, text: string, delay = 50) {
    await locator.type(text, { delay });
  }

  /**
   * Hover and wait for tooltip or dropdown
   */
  async hoverAndWait(locator: Locator, waitForSelector?: string, timeout = 3000) {
    await locator.hover();

    if (waitForSelector) {
      await this.page.waitForSelector(waitForSelector, { timeout });
    } else {
      await this.page.waitForTimeout(300);
    }
  }
}
