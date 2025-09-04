import { Page, expect } from '@playwright/test';

/**
 * Accessibility Testing Helper for E2E Tests
 * 
 * Provides utilities for testing accessibility compliance
 * including WCAG guidelines, keyboard navigation, and screen reader support
 */
export class AccessibilityHelper {
  constructor(private page: Page) {}

  /**
   * Test keyboard navigation through focusable elements
   */
  async testKeyboardNavigation(expectedFocusOrder: string[]): Promise<void> {
    // Start from the beginning
    await this.page.keyboard.press('Tab');
    
    for (const selector of expectedFocusOrder) {
      const element = this.page.locator(selector);
      await expect(element).toBeFocused({ timeout: 1000 });
      
      if (selector !== expectedFocusOrder[expectedFocusOrder.length - 1]) {
        await this.page.keyboard.press('Tab');
      }
    }
  }

  /**
   * Test reverse keyboard navigation
   */
  async testReverseKeyboardNavigation(expectedFocusOrder: string[]): Promise<void> {
    // Navigate to the end first
    for (let i = 0; i < expectedFocusOrder.length; i++) {
      await this.page.keyboard.press('Tab');
    }
    
    // Now test reverse navigation
    const reversedOrder = [...expectedFocusOrder].reverse();
    
    for (const selector of reversedOrder) {
      await this.page.keyboard.press('Shift+Tab');
      const element = this.page.locator(selector);
      await expect(element).toBeFocused({ timeout: 1000 });
    }
  }

  /**
   * Test ARIA labels and attributes
   */
  async testAriaLabels(elements: { selector: string; expectedLabel: string | RegExp }[]): Promise<void> {
    for (const { selector, expectedLabel } of elements) {
      const element = this.page.locator(selector);
      
      // Check for aria-label first
      const ariaLabel = await element.getAttribute('aria-label');
      if (ariaLabel) {
        if (typeof expectedLabel === 'string') {
          expect(ariaLabel.toLowerCase()).toContain(expectedLabel.toLowerCase());
        } else {
          expect(ariaLabel).toMatch(expectedLabel);
        }
        continue;
      }
      
      // Check for aria-labelledby
      const ariaLabelledBy = await element.getAttribute('aria-labelledby');
      if (ariaLabelledBy) {
        const labelElement = this.page.locator(`#${ariaLabelledBy}`);
        await expect(labelElement).toBeVisible();
        continue;
      }
      
      // Check for associated label
      const labelFor = await this.page.locator(`label[for="${await element.getAttribute('id')}"]`).textContent();
      if (labelFor) {
        if (typeof expectedLabel === 'string') {
          expect(labelFor.toLowerCase()).toContain(expectedLabel.toLowerCase());
        } else {
          expect(labelFor).toMatch(expectedLabel);
        }
        continue;
      }
      
      throw new Error(`No accessible name found for element: ${selector}`);
    }
  }

  /**
   * Test form accessibility
   */
  async testFormAccessibility(formSelector: string): Promise<void> {
    const form = this.page.locator(formSelector);
    await expect(form).toBeVisible();
    
    // Form should have a label or aria-labelledby
    const hasAriaLabelledBy = await form.getAttribute('aria-labelledby');
    const hasAriaLabel = await form.getAttribute('aria-label');
    const hasRole = await form.getAttribute('role');
    
    expect(hasAriaLabelledBy || hasAriaLabel || hasRole === 'form').toBeTruthy();
    
    // Check that all form inputs have labels
    const inputs = await form.locator('input, select, textarea').all();
    for (const input of inputs) {
      const inputId = await input.getAttribute('id');
      const inputType = await input.getAttribute('type');
      
      // Skip hidden inputs and submit buttons
      if (inputType === 'hidden' || inputType === 'submit' || inputType === 'button') {
        continue;
      }
      
      if (inputId) {
        const label = this.page.locator(`label[for="${inputId}"]`);
        const hasLabel = await label.count() > 0;
        const hasAriaLabel = await input.getAttribute('aria-label');
        const hasAriaLabelledBy = await input.getAttribute('aria-labelledby');
        
        expect(hasLabel || hasAriaLabel || hasAriaLabelledBy).toBeTruthy();
      }
    }
  }

  /**
   * Test button accessibility
   */
  async testButtonAccessibility(buttonSelector: string, expectedLabel: string | RegExp): Promise<void> {
    const button = this.page.locator(buttonSelector);
    await expect(button).toBeVisible();
    
    // Button should be focusable
    await button.focus();
    await expect(button).toBeFocused();
    
    // Button should have accessible text
    const buttonText = await button.textContent();
    const ariaLabel = await button.getAttribute('aria-label');
    const ariaLabelledBy = await button.getAttribute('aria-labelledby');
    
    let accessibleText = buttonText || ariaLabel;
    
    if (ariaLabelledBy) {
      const labelElement = this.page.locator(`#${ariaLabelledBy}`);
      accessibleText = await labelElement.textContent();
    }
    
    expect(accessibleText).toBeTruthy();
    
    if (typeof expectedLabel === 'string') {
      expect(accessibleText?.toLowerCase()).toContain(expectedLabel.toLowerCase());
    } else {
      expect(accessibleText).toMatch(expectedLabel);
    }
    
    // Button should be activatable with keyboard
    await this.page.keyboard.press('Enter');
    // Note: Actual activation testing would depend on the specific button behavior
  }

  /**
   * Test live regions for dynamic content updates
   */
  async testLiveRegions(expectedMessages: string[]): Promise<void> {
    const liveRegions = this.page.locator('[aria-live]');
    const liveRegionCount = await liveRegions.count();
    
    expect(liveRegionCount).toBeGreaterThan(0);
    
    for (let i = 0; i < expectedMessages.length; i++) {
      const message = expectedMessages[i];
      
      // Wait for the message to appear in any live region
      let found = false;
      for (let j = 0; j < liveRegionCount; j++) {
        const region = liveRegions.nth(j);
        try {
          await expect(region).toContainText(message, { timeout: 5000 });
          found = true;
          break;
        } catch {
          // Continue checking other regions
        }
      }
      
      if (!found) {
        throw new Error(`Live region message not found: ${message}`);
      }
    }
  }

  /**
   * Test heading structure (h1, h2, h3, etc.)
   */
  async testHeadingStructure(): Promise<void> {
    const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').all();
    
    expect(headings.length).toBeGreaterThan(0);
    
    let previousLevel = 0;
    
    for (const heading of headings) {
      const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
      const currentLevel = parseInt(tagName.replace('h', ''));
      
      // First heading should be h1
      if (previousLevel === 0) {
        expect(currentLevel).toBe(1);
      } else {
        // Subsequent headings should not skip levels
        expect(currentLevel).toBeLessThanOrEqual(previousLevel + 1);
      }
      
      previousLevel = currentLevel;
      
      // Heading should have visible text
      const text = await heading.textContent();
      expect(text?.trim()).toBeTruthy();
    }
  }

  /**
   * Test color contrast (basic check for visibility)
   */
  async testColorContrast(elements: string[]): Promise<void> {
    for (const selector of elements) {
      const element = this.page.locator(selector);
      await expect(element).toBeVisible();
      
      // Get computed styles
      const styles = await element.evaluate(el => {
        const computed = getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          fontSize: computed.fontSize
        };
      });
      
      // Basic visibility check - element should have contrasting colors
      expect(styles.color).not.toBe(styles.backgroundColor);
      
      // Font size should be readable (at least 12px)
      const fontSize = parseInt(styles.fontSize);
      expect(fontSize).toBeGreaterThanOrEqual(12);
    }
  }

  /**
   * Test skip links functionality
   */
  async testSkipLinks(): Promise<void> {
    // Press Tab to reveal skip link
    await this.page.keyboard.press('Tab');
    
    const skipLink = this.page.locator('a[href^="#"]:visible').first();
    
    if (await skipLink.count() > 0) {
      const skipText = await skipLink.textContent();
      expect(skipText?.toLowerCase()).toContain('skip');
      
      // Test that skip link actually works
      const href = await skipLink.getAttribute('href');
      await skipLink.click();
      
      if (href) {
        const targetElement = this.page.locator(href);
        await expect(targetElement).toBeFocused();
      }
    }
  }

  /**
   * Test modal/dialog accessibility
   */
  async testModalAccessibility(modalSelector: string): Promise<void> {
    const modal = this.page.locator(modalSelector);
    await expect(modal).toBeVisible();
    
    // Modal should have role="dialog" or role="alertdialog"
    const role = await modal.getAttribute('role');
    expect(['dialog', 'alertdialog']).toContain(role);
    
    // Modal should have aria-labelledby or aria-label
    const ariaLabel = await modal.getAttribute('aria-label');
    const ariaLabelledBy = await modal.getAttribute('aria-labelledby');
    expect(ariaLabel || ariaLabelledBy).toBeTruthy();
    
    // Focus should be trapped within modal
    await this.page.keyboard.press('Tab');
    const focusedElement = await this.page.locator(':focus').first();
    const isWithinModal = await focusedElement.evaluate(
      (el, modalEl) => modalEl.contains(el),
      await modal.elementHandle()
    );
    expect(isWithinModal).toBe(true);
    
    // Escape key should close modal (if implemented)
    await this.page.keyboard.press('Escape');
    // Note: This test depends on the specific modal implementation
  }

  /**
   * Test table accessibility
   */
  async testTableAccessibility(tableSelector: string): Promise<void> {
    const table = this.page.locator(tableSelector);
    await expect(table).toBeVisible();
    
    // Table should have headers
    const headers = table.locator('th');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(0);
    
    // Headers should have scope attribute or be properly associated
    for (let i = 0; i < headerCount; i++) {
      const header = headers.nth(i);
      const scope = await header.getAttribute('scope');
      const id = await header.getAttribute('id');
      
      // Either scope or id should be present for association
      expect(scope || id).toBeTruthy();
    }
    
    // Table should have caption or aria-label for context
    const caption = table.locator('caption');
    const ariaLabel = await table.getAttribute('aria-label');
    const ariaLabelledBy = await table.getAttribute('aria-labelledby');
    
    const hasCaptionOrLabel = await caption.count() > 0 || ariaLabel || ariaLabelledBy;
    expect(hasCaptionOrLabel).toBe(true);
  }

  /**
   * Test error message accessibility
   */
  async testErrorMessages(formSelector: string): Promise<void> {
    const form = this.page.locator(formSelector);
    const errorMessages = form.locator('[role="alert"], .error, [aria-live="assertive"]');
    
    if (await errorMessages.count() > 0) {
      // Error messages should be associated with form fields
      const errors = await errorMessages.all();
      
      for (const error of errors) {
        const errorText = await error.textContent();
        expect(errorText?.trim()).toBeTruthy();
        
        // Error should be in a live region or have role="alert"
        const role = await error.getAttribute('role');
        const ariaLive = await error.getAttribute('aria-live');
        
        expect(role === 'alert' || ariaLive === 'assertive' || ariaLive === 'polite').toBe(true);
      }
    }
  }

  /**
   * Check minimum touch target sizes for mobile
   */
  async testTouchTargetSizes(selectors: string[], minSize: number = 44): Promise<void> {
    for (const selector of selectors) {
      const element = this.page.locator(selector);
      
      if (await element.count() > 0) {
        const boundingBox = await element.boundingBox();
        
        if (boundingBox) {
          expect(boundingBox.width).toBeGreaterThanOrEqual(minSize);
          expect(boundingBox.height).toBeGreaterThanOrEqual(minSize);
        }
      }
    }
  }

  /**
   * Test focus indicators visibility
   */
  async testFocusIndicators(focusableSelectors: string[]): Promise<void> {
    for (const selector of focusableSelectors) {
      const element = this.page.locator(selector);
      
      if (await element.count() > 0) {
        await element.focus();
        await expect(element).toBeFocused();
        
        // Check that focus is visually indicated
        const outline = await element.evaluate(el => {
          const computed = getComputedStyle(el);
          return {
            outline: computed.outline,
            outlineWidth: computed.outlineWidth,
            boxShadow: computed.boxShadow
          };
        });
        
        // Should have some form of focus indication
        const hasFocusIndicator = 
          outline.outline !== 'none' || 
          outline.outlineWidth !== '0px' || 
          outline.boxShadow !== 'none';
        
        expect(hasFocusIndicator).toBe(true);
      }
    }
  }
}