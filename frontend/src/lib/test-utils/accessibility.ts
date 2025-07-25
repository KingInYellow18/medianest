import { axe, toHaveNoViolations } from 'jest-axe';
import { render, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

export interface AccessibilityTestOptions {
  rules?: Record<string, any>;
  tags?: string[];
  timeout?: number;
  skipRules?: string[];
}

export class AccessibilityTester {
  private static defaultOptions: AccessibilityTestOptions = {
    rules: {},
    tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
    timeout: 5000,
    skipRules: []
  };

  /**
   * Run axe accessibility audit on rendered component
   */
  static async auditAccessibility(
    container: HTMLElement, 
    options: AccessibilityTestOptions = {}
  ) {
    const config = { ...this.defaultOptions, ...options };
    
    // Remove rules that should be skipped
    const rules = { ...config.rules };
    config.skipRules?.forEach(rule => {
      rules[rule] = { enabled: false };
    });

    const results = await axe(container, {
      rules,
      tags: config.tags
    });

    expect(results).toHaveNoViolations();
    return results;
  }

  /**
   * Test keyboard navigation for all focusable elements
   */
  static async testKeyboardNavigation(container: HTMLElement) {
    const user = userEvent.setup();
    
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) {
      throw new Error('No focusable elements found - this may indicate an accessibility issue');
    }

    // Test Tab navigation
    for (let i = 0; i < focusableElements.length; i++) {
      await user.tab();
      expect(focusableElements[i]).toHaveFocus();
    }

    // Test Shift+Tab navigation (reverse)
    for (let i = focusableElements.length - 1; i >= 0; i--) {
      await user.tab({ shift: true });
      expect(focusableElements[i]).toHaveFocus();
    }
  }

  /**
   * Test screen reader announcements
   */
  static testScreenReaderAnnouncements(container: HTMLElement) {
    const liveRegions = container.querySelectorAll('[aria-live]');
    const alerts = container.querySelectorAll('[role="alert"]');
    const status = container.querySelectorAll('[role="status"]');
    
    return {
      liveRegions: Array.from(liveRegions),
      alerts: Array.from(alerts),
      status: Array.from(status),
      hasAnnouncements: liveRegions.length > 0 || alerts.length > 0 || status.length > 0
    };
  }

  /**
   * Test color contrast (basic implementation)
   */
  static testColorContrast(element: HTMLElement) {
    const styles = window.getComputedStyle(element);
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;
    
    // Basic validation - in real implementation, you'd calculate actual contrast ratios
    expect(color).not.toBe('');
    expect(backgroundColor).not.toBe('');
    expect(color).not.toBe(backgroundColor);
    
    return { color, backgroundColor };
  }

  /**
   * Test ARIA attributes and relationships
   */
  static testAriaCompliance(element: HTMLElement, expectedAttributes: Record<string, string> = {}) {
    // Test required ARIA attributes
    Object.entries(expectedAttributes).forEach(([attr, value]) => {
      expect(element).toHaveAttribute(attr, value);
    });

    // Test ARIA relationships
    const ariaDescribedBy = element.getAttribute('aria-describedby');
    if (ariaDescribedBy) {
      const describedByElements = ariaDescribedBy.split(' ').map(id => 
        document.getElementById(id)
      );
      describedByElements.forEach(el => {
        expect(el).toBeInTheDocument();
      });
    }

    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelledByElements = ariaLabelledBy.split(' ').map(id => 
        document.getElementById(id)
      );
      labelledByElements.forEach(el => {
        expect(el).toBeInTheDocument();
      });
    }
  }

  /**
   * Test responsive accessibility across viewports
   */
  static async testResponsiveAccessibility(
    renderComponent: () => RenderResult,
    viewports: Array<{ width: number; height: number; name: string }>
  ) {
    const results: Array<{ viewport: string; violations: any[] }> = [];

    for (const viewport of viewports) {
      // Mock viewport resize
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: viewport.width,
      });
      
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: viewport.height,
      });

      // Trigger resize event
      window.dispatchEvent(new Event('resize'));

      const { container, unmount } = renderComponent();
      
      try {
        const auditResults = await this.auditAccessibility(container);
        results.push({
          viewport: viewport.name,
          violations: auditResults.violations
        });
      } finally {
        unmount();
      }
    }

    return results;
  }

  /**
   * Test form accessibility
   */
  static testFormAccessibility(formElement: HTMLElement) {
    const inputs = formElement.querySelectorAll('input, textarea, select');
    const labels = formElement.querySelectorAll('label');
    const fieldsets = formElement.querySelectorAll('fieldset');
    const legends = formElement.querySelectorAll('legend');

    // Check that all inputs have associated labels
    inputs.forEach(input => {
      const id = input.getAttribute('id');
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');
      
      if (id) {
        const associatedLabel = formElement.querySelector(`label[for="${id}"]`);
        expect(
          associatedLabel || ariaLabel || ariaLabelledBy
        ).toBeTruthy();
      } else {
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    });

    // Check fieldset/legend pairs
    fieldsets.forEach(fieldset => {
      const legend = fieldset.querySelector('legend');
      expect(legend).toBeInTheDocument();
    });

    return {
      inputCount: inputs.length,
      labelCount: labels.length,
      fieldsetCount: fieldsets.length,
      legendCount: legends.length
    };
  }

  /**
   * Test high contrast mode compatibility
   */
  static testHighContrastMode(element: HTMLElement) {
    // Mock high contrast mode
    const mockHighContrast = vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(prefers-contrast: high)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    // Trigger high contrast event
    window.dispatchEvent(new MediaQueryListEvent('change', {
      matches: true,
      media: '(prefers-contrast: high)'
    }));

    // Verify element remains accessible
    expect(element).toBeVisible();
    
    mockHighContrast.mockRestore();
  }

  /**
   * Comprehensive accessibility test suite
   */
  static async runComprehensiveTest(
    container: HTMLElement,
    options: AccessibilityTestOptions & {
      testKeyboard?: boolean;
      testScreenReader?: boolean;
      testColorContrast?: boolean;
      testAria?: boolean;
      testHighContrast?: boolean;
      expectedAttributes?: Record<string, string>;
    } = {}
  ) {
    const results: any = {};

    // Core axe audit
    results.audit = await this.auditAccessibility(container, options);

    // Keyboard navigation test
    if (options.testKeyboard !== false) {
      try {
        await this.testKeyboardNavigation(container);
        results.keyboard = { passed: true };
      } catch (error) {
        results.keyboard = { passed: false, error: error.message };
      }
    }

    // Screen reader test
    if (options.testScreenReader !== false) {
      results.screenReader = this.testScreenReaderAnnouncements(container);
    }

    // Color contrast test
    if (options.testColorContrast !== false) {
      try {
        results.colorContrast = this.testColorContrast(container);
      } catch (error) {
        results.colorContrast = { passed: false, error: error.message };
      }
    }

    // ARIA compliance test
    if (options.testAria !== false && options.expectedAttributes) {
      try {
        this.testAriaCompliance(container, options.expectedAttributes);
        results.aria = { passed: true };
      } catch (error) {
        results.aria = { passed: false, error: error.message };
      }
    }

    // High contrast mode test
    if (options.testHighContrast !== false) {
      try {
        this.testHighContrastMode(container);
        results.highContrast = { passed: true };
      } catch (error) {
        results.highContrast = { passed: false, error: error.message };
      }
    }

    return results;
  }
}

// Convenience functions for common accessibility tests
export const a11yUtils = {
  audit: AccessibilityTester.auditAccessibility,
  testKeyboard: AccessibilityTester.testKeyboardNavigation,
  testScreenReader: AccessibilityTester.testScreenReaderAnnouncements,
  testColorContrast: AccessibilityTester.testColorContrast,
  testAria: AccessibilityTester.testAriaCompliance,
  testForm: AccessibilityTester.testFormAccessibility,
  testResponsive: AccessibilityTester.testResponsiveAccessibility,
  runComprehensive: AccessibilityTester.runComprehensiveTest
};

export default AccessibilityTester;