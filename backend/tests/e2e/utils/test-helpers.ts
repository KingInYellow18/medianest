import { Page, Browser, BrowserContext, expect } from '@playwright/test';
import { testUsers } from '../fixtures/users.fixture';
import { apiHelpers } from './api-helpers';
import { dbHelpers } from './db-helpers';

/**
 * Common test helper utilities for E2E testing
 */
export class TestHelpers {
  /**
   * Wait for network requests to complete
   */
  static async waitForNetworkIdle(page: Page, timeout = 10000): Promise<void> {
    await page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Wait for specific API call to complete
   */
  static async waitForAPICall(
    page: Page,
    urlPattern: string | RegExp,
    timeout = 30000,
  ): Promise<any> {
    const response = await page.waitForResponse(urlPattern, { timeout });
    const data = await response.json().catch(() => null);
    return { response, data };
  }

  /**
   * Take screenshot with timestamp
   */
  static async takeTimestampedScreenshot(page: Page, name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    const path = `tests/e2e/screenshots/${filename}`;

    await page.screenshot({
      path,
      fullPage: true,
    });

    return path;
  }

  /**
   * Generate random email address
   */
  static generateRandomEmail(prefix = 'test'): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}-${timestamp}-${random}@medianest.test`;
  }

  /**
   * Generate random string
   */
  static generateRandomString(length = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Format date for input fields
   */
  static formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Parse date from string
   */
  static parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  /**
   * Add days to date
   */
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Wait for element with retry logic
   */
  static async waitForElementWithRetry(
    page: Page,
    selector: string,
    options: { timeout?: number; retries?: number; retryDelay?: number } = {},
  ): Promise<boolean> {
    const { timeout = 5000, retries = 3, retryDelay = 1000 } = options;

    for (let i = 0; i < retries; i++) {
      try {
        await page.waitForSelector(selector, { timeout });
        return true;
      } catch (error) {
        if (i === retries - 1) {
          throw error;
        }
        await page.waitForTimeout(retryDelay);
      }
    }

    return false;
  }

  /**
   * Scroll element into view
   */
  static async scrollIntoView(page: Page, selector: string): Promise<void> {
    await page.locator(selector).scrollIntoViewIfNeeded();
  }

  /**
   * Get element count
   */
  static async getElementCount(page: Page, selector: string): Promise<number> {
    return await page.locator(selector).count();
  }

  /**
   * Get all text contents from elements
   */
  static async getAllTextContents(page: Page, selector: string): Promise<string[]> {
    const elements = await page.locator(selector).all();
    const texts = [];

    for (const element of elements) {
      const text = await element.textContent();
      if (text) {
        texts.push(text.trim());
      }
    }

    return texts;
  }

  /**
   * Check if element contains text
   */
  static async elementContainsText(page: Page, selector: string, text: string): Promise<boolean> {
    try {
      await expect(page.locator(selector)).toContainText(text, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for text to appear in element
   */
  static async waitForTextInElement(
    page: Page,
    selector: string,
    text: string,
    timeout = 10000,
  ): Promise<void> {
    await expect(page.locator(selector)).toContainText(text, { timeout });
  }

  /**
   * Clear input and type new value
   */
  static async clearAndType(page: Page, selector: string, value: string): Promise<void> {
    const input = page.locator(selector);
    await input.clear();
    await input.fill(value);
  }

  /**
   * Select multiple options from select element
   */
  static async selectMultipleOptions(
    page: Page,
    selector: string,
    values: string[],
  ): Promise<void> {
    const select = page.locator(selector);
    await select.selectOption(values);
  }

  /**
   * Upload multiple files
   */
  static async uploadMultipleFiles(
    page: Page,
    selector: string,
    filePaths: string[],
  ): Promise<void> {
    const fileInput = page.locator(selector);
    await fileInput.setInputFiles(filePaths);
  }

  /**
   * Handle dialog (alert, confirm, prompt)
   */
  static async handleNextDialog(
    page: Page,
    action: 'accept' | 'dismiss',
    promptText?: string,
  ): Promise<void> {
    page.once('dialog', async (dialog) => {
      if (promptText && dialog.type() === 'prompt') {
        await dialog.accept(promptText);
      } else if (action === 'accept') {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });
  }

  /**
   * Get current URL path
   */
  static getCurrentPath(page: Page): string {
    const url = new URL(page.url());
    return url.pathname;
  }

  /**
   * Get URL search parameters
   */
  static getSearchParams(page: Page): URLSearchParams {
    const url = new URL(page.url());
    return url.searchParams;
  }

  /**
   * Navigate with retry on failure
   */
  static async navigateWithRetry(page: Page, url: string, retries = 3): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        return;
      } catch (error) {
        if (i === retries - 1) {
          throw error;
        }
        await page.waitForTimeout(2000);
      }
    }
  }

  /**
   * Reload page and wait for network idle
   */
  static async reloadAndWait(page: Page): Promise<void> {
    await page.reload();
    await page.waitForLoadState('networkidle');
  }

  /**
   * Check if page has error
   */
  static async hasPageError(page: Page): Promise<boolean> {
    // Check for common error indicators
    const errorSelectors = [
      '[data-testid="error-message"]',
      '.error',
      '[class*="error"]',
      'h1:has-text("Error")',
      'h1:has-text("Not Found")',
    ];

    for (const selector of errorSelectors) {
      if (await page.locator(selector).isVisible()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get page performance metrics
   */
  static async getPageMetrics(page: Page): Promise<any> {
    return await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      return {
        loadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        firstPaint:
          performance.getEntriesByType('paint').find((entry) => entry.name === 'first-paint')
            ?.startTime || 0,
        firstContentfulPaint:
          performance
            .getEntriesByType('paint')
            .find((entry) => entry.name === 'first-contentful-paint')?.startTime || 0,
      };
    });
  }

  /**
   * Check page accessibility
   */
  static async checkAccessibility(page: Page): Promise<any> {
    // This would require axe-playwright or similar tool
    // Placeholder for accessibility checks
    return await page.evaluate(() => {
      // Basic accessibility checks
      const missingAltImages = document.querySelectorAll('img:not([alt])').length;
      const missingLabels = document.querySelectorAll(
        'input:not([aria-label]):not([aria-labelledby]):not([id])',
      ).length;

      return {
        missingAltImages,
        missingLabels,
        hasSkipLink: !!document.querySelector('[href="#main"], [href="#content"]'),
        hasHeadings: !!document.querySelector('h1, h2, h3, h4, h5, h6'),
      };
    });
  }

  /**
   * Mock geolocation
   */
  static async mockGeolocation(page: Page, latitude: number, longitude: number): Promise<void> {
    await page.context().setGeolocation({ latitude, longitude });
  }

  /**
   * Set device viewport
   */
  static async setMobileViewport(page: Page): Promise<void> {
    await page.setViewportSize({ width: 375, height: 667 });
  }

  /**
   * Set desktop viewport
   */
  static async setDesktopViewport(page: Page): Promise<void> {
    await page.setViewportSize({ width: 1920, height: 1080 });
  }

  /**
   * Set tablet viewport
   */
  static async setTabletViewport(page: Page): Promise<void> {
    await page.setViewportSize({ width: 768, height: 1024 });
  }

  /**
   * Simulate slow network
   */
  static async simulateSlowNetwork(page: Page): Promise<void> {
    await page.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Add 1s delay
      route.continue();
    });
  }

  /**
   * Simulate offline mode
   */
  static async simulateOffline(page: Page): Promise<void> {
    await page.context().setOffline(true);
  }

  /**
   * Restore online mode
   */
  static async restoreOnline(page: Page): Promise<void> {
    await page.context().setOffline(false);
  }

  /**
   * Get console logs
   */
  static async getConsoleLogs(page: Page): Promise<any[]> {
    const logs: any[] = [];

    page.on('console', (msg) => {
      logs.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
      });
    });

    return logs;
  }

  /**
   * Clear console logs
   */
  static clearConsoleLogs(logs: any[]): void {
    logs.length = 0;
  }

  /**
   * Assert no console errors
   */
  static assertNoConsoleErrors(logs: any[]): void {
    const errors = logs.filter((log) => log.type === 'error');
    if (errors.length > 0) {
      throw new Error(`Console errors found: ${JSON.stringify(errors, null, 2)}`);
    }
  }

  /**
   * Create test context with custom options
   */
  static async createTestContext(browser: Browser, options: any = {}): Promise<BrowserContext> {
    return await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      ...options,
    });
  }

  /**
   * Clean up test resources
   */
  static async cleanup(page: Page, testData: any[] = []): Promise<void> {
    try {
      // Clean up test data via API
      for (const data of testData) {
        if (data.id) {
          await apiHelpers.delete(`/api/requests/${data.id}`).catch(() => {});
        }
      }

      // Clear browser data
      await page.context().clearCookies();
      await page.context().clearPermissions();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  /**
   * Generate test report data
   */
  static generateTestReport(
    testName: string,
    startTime: number,
    endTime: number,
    status: 'passed' | 'failed',
    error?: any,
  ): any {
    return {
      testName,
      duration: endTime - startTime,
      status,
      timestamp: new Date().toISOString(),
      error: error?.message || null,
    };
  }
}

// Export utility functions
export const utils = {
  generateRandomEmail: TestHelpers.generateRandomEmail,
  generateRandomString: TestHelpers.generateRandomString,
  formatDateForInput: TestHelpers.formatDateForInput,
  parseDate: TestHelpers.parseDate,
  addDays: TestHelpers.addDays,
  getCurrentPath: TestHelpers.getCurrentPath,
  getSearchParams: TestHelpers.getSearchParams,
};

// Export test helper class
export default TestHelpers;
