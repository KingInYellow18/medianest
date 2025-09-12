import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a specific URL
   */
  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }

  /**
   * Wait for page to load completely
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(selector: string, timeout = 30000): Promise<Locator> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible', timeout });
    return element;
  }

  /**
   * Click an element with retry logic
   */
  async clickElement(selector: string, timeout = 10000): Promise<void> {
    const element = await this.waitForElement(selector, timeout);
    await element.click();
  }

  /**
   * Fill input field
   */
  async fillInput(selector: string, value: string): Promise<void> {
    const input = await this.waitForElement(selector);
    await input.clear();
    await input.fill(value);
  }

  /**
   * Get text content of element
   */
  async getTextContent(selector: string): Promise<string> {
    const element = await this.waitForElement(selector);
    const text = await element.textContent();
    return text?.trim() || '';
  }

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ state: 'attached', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if element is visible
   */
  async isElementVisible(selector: string): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for element to disappear
   */
  async waitForElementToDisappear(selector: string, timeout = 10000): Promise<void> {
    try {
      await this.page.locator(selector).waitFor({ state: 'hidden', timeout });
    } catch {
      // Element might not exist at all, which is fine
    }
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(name: string): Promise<Buffer> {
    return await this.page.screenshot({
      fullPage: true,
      path: `tests/e2e/screenshots/${name}-${Date.now()}.png`,
    });
  }

  /**
   * Wait for API response
   */
  async waitForResponse(urlPattern: string | RegExp, timeout = 30000): Promise<any> {
    const response = await this.page.waitForResponse(urlPattern, { timeout });
    return await response.json();
  }

  /**
   * Execute JavaScript in browser context
   */
  async executeScript<T = any>(script: string): Promise<T> {
    return await this.page.evaluate(script);
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Reload page
   */
  async reload(): Promise<void> {
    await this.page.reload();
  }

  /**
   * Go back in browser history
   */
  async goBack(): Promise<void> {
    await this.page.goBack();
  }

  /**
   * Accept dialog (alert, confirm, prompt)
   */
  async acceptDialog(): Promise<void> {
    this.page.on('dialog', (dialog) => dialog.accept());
  }

  /**
   * Dismiss dialog (alert, confirm, prompt)
   */
  async dismissDialog(): Promise<void> {
    this.page.on('dialog', (dialog) => dialog.dismiss());
  }

  /**
   * Wait for network to be idle
   */
  async waitForNetworkIdle(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Hover over element
   */
  async hoverElement(selector: string): Promise<void> {
    const element = await this.waitForElement(selector);
    await element.hover();
  }

  /**
   * Double click element
   */
  async doubleClickElement(selector: string): Promise<void> {
    const element = await this.waitForElement(selector);
    await element.dblclick();
  }

  /**
   * Right click element
   */
  async rightClickElement(selector: string): Promise<void> {
    const element = await this.waitForElement(selector);
    await element.click({ button: 'right' });
  }

  /**
   * Select option from dropdown
   */
  async selectOption(selector: string, value: string): Promise<void> {
    const select = await this.waitForElement(selector);
    await select.selectOption(value);
  }

  /**
   * Upload file
   */
  async uploadFile(selector: string, filePath: string): Promise<void> {
    const fileInput = await this.waitForElement(selector);
    await fileInput.setInputFiles(filePath);
  }

  /**
   * Wait for specific text to appear
   */
  async waitForText(text: string, timeout = 10000): Promise<void> {
    await this.page.waitForFunction(
      (searchText) => document.body.textContent?.includes(searchText),
      text,
      { timeout },
    );
  }

  /**
   * Get element attribute value
   */
  async getAttributeValue(selector: string, attribute: string): Promise<string | null> {
    const element = await this.waitForElement(selector);
    return await element.getAttribute(attribute);
  }

  /**
   * Check if element is enabled
   */
  async isElementEnabled(selector: string): Promise<boolean> {
    const element = await this.waitForElement(selector);
    return await element.isEnabled();
  }

  /**
   * Check if element is checked (for checkboxes/radio buttons)
   */
  async isElementChecked(selector: string): Promise<boolean> {
    const element = await this.waitForElement(selector);
    return await element.isChecked();
  }

  /**
   * Close current page
   */
  async closePage(): Promise<void> {
    await this.page.close();
  }
}
