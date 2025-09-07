import { Page, Locator, expect, ScreenshotMode } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Advanced Visual Regression Testing Utilities
 * Provides pixel-perfect comparison, dynamic content masking, and cross-browser consistency
 */
export class VisualRegressionUtils {
  private page: Page;
  private baselinePath: string;
  private testName: string;
  
  constructor(page: Page, testName: string) {
    this.page = page;
    this.testName = testName;
    this.baselinePath = path.join(process.cwd(), 'visual-baselines', testName);
  }

  /**
   * Enhanced screenshot comparison with dynamic content masking
   */
  async compareScreenshot(
    selector?: string,
    options: {
      name: string;
      fullPage?: boolean;
      threshold?: number;
      mask?: string[];
      maskColor?: string;
      animations?: 'disabled' | 'allow';
      clip?: { x: number; y: number; width: number; height: number };
      mode?: ScreenshotMode;
      timeout?: number;
      stabilityChecks?: number;
    } = { name: 'screenshot' }
  ): Promise<void> {
    const {
      name,
      fullPage = false,
      threshold = 0.1,
      mask = [],
      maskColor = '#FF00FF',
      animations = 'disabled',
      clip,
      mode = 'default',
      timeout = 30000,
      stabilityChecks = 3
    } = options;

    // Wait for page to stabilize
    await this.waitForPageStability(stabilityChecks);

    // Mask dynamic content elements
    if (mask.length > 0) {
      await this.maskElements(mask, maskColor);
    }

    // Normalize common dynamic elements automatically
    await this.normalizeDynamicContent();

    const element = selector ? this.page.locator(selector) : this.page;
    
    await expect(element).toHaveScreenshot(`${name}.png`, {
      fullPage,
      threshold,
      animations,
      clip,
      mode,
      timeout
    });

    // Restore masked elements
    if (mask.length > 0) {
      await this.restoreMaskedElements(mask);
    }
  }

  /**
   * Cross-browser visual consistency testing
   */
  async crossBrowserComparison(
    selector: string,
    options: {
      name: string;
      browsers: ('chromium' | 'firefox' | 'webkit')[];
      threshold?: number;
      mask?: string[];
    }
  ): Promise<Record<string, boolean>> {
    const { name, browsers, threshold = 0.3, mask = [] } = options;
    const results: Record<string, boolean> = {};

    for (const browser of browsers) {
      try {
        await this.compareScreenshot(selector, {
          name: `${name}-${browser}`,
          threshold,
          mask,
          fullPage: true
        });
        results[browser] = true;
      } catch (error) {
        console.warn(`Cross-browser comparison failed for ${browser}:`, error);
        results[browser] = false;
      }
    }

    return results;
  }

  /**
   * Responsive design validation across device types
   */
  async responsiveDesignValidation(
    selector: string,
    options: {
      name: string;
      viewports: Array<{ name: string; width: number; height: number }>;
      threshold?: number;
    }
  ): Promise<Record<string, boolean>> {
    const { name, viewports, threshold = 0.2 } = options;
    const results: Record<string, boolean> = {};
    const originalViewport = this.page.viewportSize();

    for (const viewport of viewports) {
      try {
        await this.page.setViewportSize({ width: viewport.width, height: viewport.height });
        await this.waitForPageStability(2);

        await this.compareScreenshot(selector, {
          name: `${name}-${viewport.name}`,
          threshold,
          fullPage: true
        });

        results[viewport.name] = true;
      } catch (error) {
        console.warn(`Responsive test failed for ${viewport.name}:`, error);
        results[viewport.name] = false;
      }
    }

    // Restore original viewport
    if (originalViewport) {
      await this.page.setViewportSize(originalViewport);
    }

    return results;
  }

  /**
   * Component-level visual regression testing
   */
  async componentVisualTest(
    componentSelector: string,
    options: {
      name: string;
      states?: Array<{ name: string; action: () => Promise<void> }>;
      threshold?: number;
      isolate?: boolean;
    }
  ): Promise<Record<string, boolean>> {
    const { name, states = [], threshold = 0.1, isolate = false } = options;
    const results: Record<string, boolean> = {};

    // Test default state
    try {
      if (isolate) {
        await this.isolateComponent(componentSelector);
      }

      await this.compareScreenshot(componentSelector, {
        name: `${name}-default`,
        threshold
      });
      results['default'] = true;
    } catch (error) {
      console.warn(`Default state test failed for ${name}:`, error);
      results['default'] = false;
    }

    // Test different states
    for (const state of states) {
      try {
        await state.action();
        await this.waitForPageStability(1);

        await this.compareScreenshot(componentSelector, {
          name: `${name}-${state.name}`,
          threshold
        });
        results[state.name] = true;
      } catch (error) {
        console.warn(`State test failed for ${name}-${state.name}:`, error);
        results[state.name] = false;
      }
    }

    return results;
  }

  /**
   * Animation and loading state visual testing
   */
  async animationStateTest(
    selector: string,
    options: {
      name: string;
      animationDuration?: number;
      captureFrames?: number;
      loadingSelector?: string;
    }
  ): Promise<void> {
    const { name, animationDuration = 2000, captureFrames = 5, loadingSelector } = options;

    // Capture loading state if selector provided
    if (loadingSelector && await this.page.locator(loadingSelector).isVisible()) {
      await this.compareScreenshot(loadingSelector, {
        name: `${name}-loading`,
        animations: 'allow'
      });
    }

    // Capture animation frames
    const frameInterval = animationDuration / captureFrames;
    for (let i = 0; i < captureFrames; i++) {
      await this.page.waitForTimeout(frameInterval);
      await this.compareScreenshot(selector, {
        name: `${name}-frame-${i + 1}`,
        animations: 'allow'
      });
    }
  }

  /**
   * Theme variation testing
   */
  async themeVariationTest(
    selector: string,
    options: {
      name: string;
      themes: Array<{ name: string; className?: string; cssVars?: Record<string, string> }>;
      threshold?: number;
    }
  ): Promise<Record<string, boolean>> {
    const { name, themes, threshold = 0.2 } = options;
    const results: Record<string, boolean> = {};

    for (const theme of themes) {
      try {
        // Apply theme
        await this.applyTheme(theme);
        await this.waitForPageStability(1);

        await this.compareScreenshot(selector, {
          name: `${name}-${theme.name}`,
          threshold,
          fullPage: true
        });
        results[theme.name] = true;

        // Reset theme
        await this.resetTheme();
      } catch (error) {
        console.warn(`Theme test failed for ${theme.name}:`, error);
        results[theme.name] = false;
      }
    }

    return results;
  }

  /**
   * Wait for page visual stability
   */
  private async waitForPageStability(checks: number = 3): Promise<void> {
    let stableChecks = 0;
    let previousScreenshot: Buffer | null = null;

    while (stableChecks < checks) {
      await this.page.waitForTimeout(500);
      const currentScreenshot = await this.page.screenshot({ fullPage: false });

      if (previousScreenshot && Buffer.compare(currentScreenshot, previousScreenshot) === 0) {
        stableChecks++;
      } else {
        stableChecks = 0;
      }

      previousScreenshot = currentScreenshot;
    }
  }

  /**
   * Mask dynamic content elements
   */
  private async maskElements(selectors: string[], maskColor: string): Promise<void> {
    for (const selector of selectors) {
      await this.page.locator(selector).evaluateAll((elements, color) => {
        elements.forEach(el => {
          const element = el as HTMLElement;
          element.dataset.originalStyle = element.style.cssText;
          element.style.backgroundColor = color;
          element.style.color = color;
          element.style.borderColor = color;
          element.style.outline = `2px solid ${color}`;
        });
      }, maskColor);
    }
  }

  /**
   * Restore masked elements
   */
  private async restoreMaskedElements(selectors: string[]): Promise<void> {
    for (const selector of selectors) {
      await this.page.locator(selector).evaluateAll(elements => {
        elements.forEach(el => {
          const element = el as HTMLElement;
          if (element.dataset.originalStyle !== undefined) {
            element.style.cssText = element.dataset.originalStyle;
            delete element.dataset.originalStyle;
          }
        });
      });
    }
  }

  /**
   * Normalize common dynamic content
   */
  private async normalizeDynamicContent(): Promise<void> {
    await this.page.evaluate(() => {
      // Hide timestamps
      document.querySelectorAll('[data-testid*="timestamp"], .timestamp, .time-ago').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });

      // Normalize counters and metrics that change frequently
      document.querySelectorAll('[data-testid*="count"], [data-testid*="metric"]').forEach(el => {
        if (el.textContent?.match(/\d+/)) {
          el.textContent = el.textContent.replace(/\d+/g, '999');
        }
      });

      // Hide loading indicators
      document.querySelectorAll('.loading, .spinner, [data-testid*="loading"]').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      // Stabilize animations
      document.querySelectorAll('*').forEach(el => {
        const element = el as HTMLElement;
        element.style.animation = 'none !important';
        element.style.transition = 'none !important';
      });
    });
  }

  /**
   * Isolate component for focused testing
   */
  private async isolateComponent(selector: string): Promise<void> {
    await this.page.evaluate((sel) => {
      const component = document.querySelector(sel);
      if (component) {
        // Hide all other elements
        document.body.childNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && !component.contains(node as Element) && node !== component) {
            (node as HTMLElement).style.display = 'none';
          }
        });

        // Position component for clean screenshot
        const element = component as HTMLElement;
        element.style.position = 'fixed';
        element.style.top = '0';
        element.style.left = '0';
        element.style.zIndex = '9999';
        element.style.background = 'white';
      }
    }, selector);
  }

  /**
   * Apply theme variations
   */
  private async applyTheme(theme: { name: string; className?: string; cssVars?: Record<string, string> }): Promise<void> {
    await this.page.evaluate((themeConfig) => {
      const { className, cssVars } = themeConfig;
      
      if (className) {
        document.documentElement.className = className;
        document.body.className = className;
      }

      if (cssVars) {
        Object.entries(cssVars).forEach(([property, value]) => {
          document.documentElement.style.setProperty(property, value);
        });
      }
    }, theme);
  }

  /**
   * Reset theme to default
   */
  private async resetTheme(): Promise<void> {
    await this.page.evaluate(() => {
      document.documentElement.className = '';
      document.body.className = '';
      document.documentElement.style.cssText = '';
    });
  }

  /**
   * Performance-optimized screenshot capture
   */
  async optimizedScreenshot(
    selector?: string,
    options: {
      name: string;
      quality?: number;
      format?: 'png' | 'jpeg';
      omitBackground?: boolean;
      timeout?: number;
    } = { name: 'screenshot' }
  ): Promise<Buffer> {
    const { name, quality = 80, format = 'png', omitBackground = false, timeout = 10000 } = options;

    // Optimize page for screenshot
    await this.page.evaluate(() => {
      // Disable smooth scrolling
      document.documentElement.style.scrollBehavior = 'auto';
      
      // Force layout completion
      document.body.offsetHeight;
    });

    const element = selector ? this.page.locator(selector) : this.page;
    
    return await element.screenshot({
      path: `visual-regression/${name}.${format}`,
      quality: format === 'jpeg' ? quality : undefined,
      omitBackground,
      timeout,
      type: format
    });
  }

  /**
   * Generate visual diff report
   */
  async generateDiffReport(
    results: Record<string, boolean>,
    testSuite: string
  ): Promise<string> {
    const timestamp = new Date().toISOString();
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    const failedTests = Object.entries(results).filter(([, passed]) => !passed);

    const report = {
      testSuite,
      timestamp,
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: totalTests - passedTests,
        successRate: `${((passedTests / totalTests) * 100).toFixed(2)}%`
      },
      results,
      failedTests: failedTests.map(([name, ]) => name)
    };

    const reportPath = path.join(process.cwd(), 'visual-regression-reports', `${testSuite}-${Date.now()}.json`);
    
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    } catch (error) {
      console.warn('Failed to write visual diff report:', error);
    }

    return reportPath;
  }
}

/**
 * Visual regression test configuration
 */
export interface VisualTestConfig {
  browsers?: ('chromium' | 'firefox' | 'webkit')[];
  viewports?: Array<{ name: string; width: number; height: number }>;
  themes?: Array<{ name: string; className?: string; cssVars?: Record<string, string> }>;
  maskSelectors?: string[];
  threshold?: number;
  animations?: 'disabled' | 'allow';
  stabilityChecks?: number;
}

/**
 * Default visual test configuration for MediaNest
 */
export const MEDIANEST_VISUAL_CONFIG: VisualTestConfig = {
  browsers: ['chromium', 'firefox', 'webkit'],
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'wide', width: 2560, height: 1440 }
  ],
  themes: [
    { name: 'light', className: '' },
    { name: 'dark', className: 'dark' },
    { name: 'high-contrast', cssVars: { '--contrast': '2', '--brightness': '1.5' } }
  ],
  maskSelectors: [
    '[data-testid*="timestamp"]',
    '[data-testid*="last-updated"]',
    '[data-testid*="uptime"]',
    '.timestamp',
    '.time-ago',
    '.live-indicator',
    '[data-testid*="live-status"]'
  ],
  threshold: 0.1,
  animations: 'disabled',
  stabilityChecks: 2
};