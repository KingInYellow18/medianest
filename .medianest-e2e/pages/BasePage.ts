import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object Model containing shared functionality and utilities
 * for all MediaNest application pages. Provides common navigation,
 * element interaction, and wait strategies.
 */
export abstract class BasePage {
  protected readonly page: Page;
  protected readonly timeout = 10000;
  
  // Common selectors shared across pages
  protected readonly commonSelectors = {
    // Navigation
    navbar: '[data-testid="navbar"]',
    navLinks: '[data-testid="nav-link"]',
    userMenu: '[data-testid="user-menu"]',
    
    // Loading states
    loader: '[data-testid="loader"]',
    spinner: '.animate-spin',
    loadingOverlay: '[data-testid="loading-overlay"]',
    
    // Error states
    errorBoundary: '[data-testid="error-boundary"]',
    errorMessage: '[data-testid="error-message"]',
    alertError: '[role="alert"][data-variant="destructive"]',
    
    // Buttons and actions
    submitButton: '[type="submit"]',
    cancelButton: '[data-testid="cancel-button"]',
    closeButton: '[data-testid="close-button"]',
    
    // Modals and overlays
    modal: '[data-testid="modal"]',
    modalOverlay: '[data-testid="modal-overlay"]',
    modalContent: '[data-testid="modal-content"]',
    
    // Forms
    form: 'form',
    input: 'input',
    textarea: 'textarea',
    select: 'select',
    
    // Cards and content
    card: '[data-testid="card"]',
    cardHeader: '[data-testid="card-header"]',
    cardContent: '[data-testid="card-content"]',
  };

  constructor(page: Page) {
    this.page = page;
  }

  // Abstract methods that must be implemented by subclasses
  abstract navigate(): Promise<void>;
  abstract isLoaded(): Promise<boolean>;
  abstract getPageTitle(): string;

  /**
   * Wait for the page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.waitForElement(this.getMainContentSelector());
  }

  /**
   * Get the main content selector for the page
   */
  protected abstract getMainContentSelector(): string;

  /**
   * Wait for an element to be visible
   */
  async waitForElement(selector: string, timeout: number = this.timeout): Promise<Locator> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible', timeout });
    return element;
  }

  /**
   * Wait for an element to be hidden
   */
  async waitForElementToHide(selector: string, timeout: number = this.timeout): Promise<void> {
    await this.page.locator(selector).waitFor({ state: 'hidden', timeout });
  }

  /**
   * Wait for loading to complete
   */
  async waitForLoading(): Promise<void> {
    // Wait for any loading spinners to disappear
    try {
      await this.waitForElementToHide(this.commonSelectors.spinner, 2000);
    } catch {
      // Spinner might not be present, which is fine
    }

    try {
      await this.waitForElementToHide(this.commonSelectors.loadingOverlay, 2000);
    } catch {
      // Loading overlay might not be present, which is fine
    }

    // Wait for network to be idle
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click element with wait and retry logic
   */
  async clickElement(selector: string, options: { timeout?: number; force?: boolean } = {}): Promise<void> {
    const element = await this.waitForElement(selector, options.timeout);
    await element.click({ force: options.force });
  }

  /**
   * Fill input field with validation
   */
  async fillInput(selector: string, value: string, options: { clear?: boolean; validate?: boolean } = {}): Promise<void> {
    const input = await this.waitForElement(selector);
    
    if (options.clear) {
      await input.clear();
    }
    
    await input.fill(value);
    
    if (options.validate !== false) {
      await expect(input).toHaveValue(value);
    }
  }

  /**
   * Select option from dropdown
   */
  async selectOption(selector: string, value: string): Promise<void> {
    const select = await this.waitForElement(selector);
    await select.selectOption(value);
  }

  /**
   * Get text content from element
   */
  async getTextContent(selector: string): Promise<string> {
    const element = await this.waitForElement(selector);
    return (await element.textContent()) || '';
  }

  /**
   * Check if element exists and is visible
   */
  async isElementVisible(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector);
      await element.waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for and verify page title
   */
  async verifyPageTitle(expectedTitle: string): Promise<void> {
    await expect(this.page).toHaveTitle(new RegExp(expectedTitle, 'i'));
  }

  /**
   * Wait for and verify URL contains path
   */
  async verifyUrlContains(path: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(path));
  }

  /**
   * Handle error states and provide meaningful feedback
   */
  async checkForErrors(): Promise<string | null> {
    // Check for error boundary
    if (await this.isElementVisible(this.commonSelectors.errorBoundary)) {
      return await this.getTextContent(this.commonSelectors.errorMessage);
    }

    // Check for alert errors
    if (await this.isElementVisible(this.commonSelectors.alertError)) {
      return await this.getTextContent(this.commonSelectors.alertError);
    }

    return null;
  }

  /**
   * Wait for form submission to complete
   */
  async waitForFormSubmission(): Promise<void> {
    // Wait for submit button to be re-enabled (common pattern)
    await this.page.waitForFunction(() => {
      const submitBtn = document.querySelector('[type="submit"]') as HTMLButtonElement;
      return !submitBtn?.disabled;
    }, { timeout: this.timeout });

    await this.waitForLoading();
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(name?: string): Promise<Buffer> {
    const screenshotName = name || `${this.getPageTitle()}-${Date.now()}`;
    return await this.page.screenshot({ 
      fullPage: true,
      path: `.medianest-e2e/screenshots/${screenshotName}.png`
    });
  }

  /**
   * Handle modal interactions
   */
  async waitForModal(): Promise<Locator> {
    return await this.waitForElement(this.commonSelectors.modal);
  }

  async closeModal(): Promise<void> {
    if (await this.isElementVisible(this.commonSelectors.closeButton)) {
      await this.clickElement(this.commonSelectors.closeButton);
    } else if (await this.isElementVisible(this.commonSelectors.modalOverlay)) {
      // Click outside modal to close
      await this.clickElement(this.commonSelectors.modalOverlay);
    }
    await this.waitForElementToHide(this.commonSelectors.modal);
  }

  /**
   * Common navigation helpers
   */
  async navigateToHome(): Promise<void> {
    await this.page.goto('/');
    await this.waitForLoad();
  }

  async navigateToDashboard(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.waitForLoad();
  }

  /**
   * Accessibility helpers
   */
  async verifyAccessibility(): Promise<void> {
    // Check for proper heading structure
    const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);

    // Check for alt text on images
    const images = await this.page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).toBeDefined();
    }

    // Check for form labels
    const inputs = await this.page.locator('input[type="text"], input[type="email"], input[type="password"], textarea').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      if (id) {
        const label = this.page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    }
  }

  /**
   * Performance monitoring
   */
  async measurePageLoadTime(): Promise<number> {
    const startTime = Date.now();
    await this.waitForLoad();
    return Date.now() - startTime;
  }

  /**
   * Network request monitoring
   */
  async waitForApiResponse(urlPattern: string | RegExp): Promise<any> {
    const response = await this.page.waitForResponse(urlPattern);
    return await response.json();
  }

  /**
   * Keyboard navigation helpers
   */
  async navigateWithTab(steps: number = 1): Promise<void> {
    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press('Tab');
    }
  }

  async navigateWithShiftTab(steps: number = 1): Promise<void> {
    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press('Shift+Tab');
    }
  }

  async pressEnter(): Promise<void> {
    await this.page.keyboard.press('Enter');
  }

  async pressEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }
}