import { Page, Locator, expect } from '@playwright/test';
import { AccessibilityTester, AccessibilityReport } from '../utils/accessibility-utils';
import { AriaValidator, AriaValidationResult } from '../utils/aria-validator';
import { SemanticHtmlValidator, SemanticValidationResult } from '../utils/semantic-html-validator';

/**
 * Enhanced Base Page Object with comprehensive accessibility testing capabilities
 * Extends the original BasePage with advanced accessibility validation
 */
export abstract class BaseAccessibilityPage {
  protected readonly page: Page;
  protected readonly timeout = 10000;
  protected accessibilityTester: AccessibilityTester;
  protected ariaValidator: AriaValidator;
  protected semanticValidator: SemanticHtmlValidator;
  
  // Common accessibility selectors
  protected readonly accessibilitySelectors = {
    // ARIA landmarks
    main: '[role="main"], main',
    navigation: '[role="navigation"], nav',
    banner: '[role="banner"], header',
    contentinfo: '[role="contentinfo"], footer',
    complementary: '[role="complementary"], aside',
    search: '[role="search"]',
    
    // Headings
    h1: 'h1',
    headings: 'h1, h2, h3, h4, h5, h6',
    
    // Interactive elements
    focusable: 'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    buttons: 'button, [role="button"]',
    links: 'a[href]',
    
    // Form elements
    formControls: 'input, textarea, select',
    labels: 'label',
    fieldsets: 'fieldset',
    legends: 'legend',
    
    // Status and live regions
    liveRegions: '[aria-live], [role="alert"], [role="status"], [role="log"]',
    alerts: '[role="alert"]',
    status: '[role="status"]',
    
    // Media elements
    images: 'img',
    videos: 'video',
    audio: 'audio',
    
    // Navigation aids
    skipLinks: 'a[href^="#"], .skip-link',
    breadcrumbs: '[aria-label*="breadcrumb" i], .breadcrumb',
    
    // Loading states
    loadingIndicators: '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"]',
    
    // Error states
    errorMessages: '[role="alert"], .error, [aria-invalid="true"]',
  };

  constructor(page: Page) {
    this.page = page;
    this.accessibilityTester = new AccessibilityTester(page);
    this.ariaValidator = new AriaValidator(page);
    this.semanticValidator = new SemanticHtmlValidator(page);
  }

  // Abstract methods that must be implemented by subclasses
  abstract navigate(): Promise<void>;
  abstract isLoaded(): Promise<boolean>;
  abstract getPageTitle(): string;
  abstract getMainContentSelector(): string;

  /**
   * Initialize accessibility testing for the page
   */
  async initializeAccessibilityTesting(): Promise<void> {
    await this.accessibilityTester.initialize();
  }

  /**
   * Run basic accessibility audit
   */
  async runBasicAccessibilityAudit(): Promise<void> {
    const result = await this.accessibilityTester.runBasicAudit();
    
    // Assert no critical violations
    const criticalViolations = result.violations.filter(v => v.impact === 'critical');
    if (criticalViolations.length > 0) {
      console.error('Critical accessibility violations found:', criticalViolations);
      throw new Error(`${criticalViolations.length} critical accessibility violations found`);
    }

    // Warn about serious violations
    const seriousViolations = result.violations.filter(v => v.impact === 'serious');
    if (seriousViolations.length > 0) {
      console.warn(`${seriousViolations.length} serious accessibility violations found`);
    }
  }

  /**
   * Run comprehensive accessibility audit with detailed reporting
   */
  async runComprehensiveAccessibilityAudit(): Promise<AccessibilityReport> {
    const report = await this.accessibilityTester.generateComprehensiveReport();
    
    // Log summary for visibility
    console.log(`Accessibility Score: ${report.overallScore}/100`);
    console.log(`Total Violations: ${report.summary.totalViolations}`);
    console.log(`Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`Keyboard Accessibility: ${Math.round(report.summary.keyboardAccessibilityRate * 100)}%`);
    
    return report;
  }

  /**
   * Test keyboard navigation for the page
   */
  async testKeyboardNavigation(): Promise<void> {
    const result = await this.accessibilityTester.testKeyboardNavigation();
    
    // Assert minimum keyboard accessibility threshold
    const accessibilityRate = result.keyboardAccessibleElements / result.totalInteractiveElements;
    expect(accessibilityRate).toBeGreaterThanOrEqual(0.95); // 95% threshold
    
    // Check for focus indicators
    const elementsWithoutFocus = result.focusableElements.filter(el => !el.hasFocusIndicator);
    if (elementsWithoutFocus.length > 0) {
      console.warn(`${elementsWithoutFocus.length} elements lack visible focus indicators`);
    }
  }

  /**
   * Test screen reader compatibility
   */
  async testScreenReaderCompatibility(): Promise<void> {
    const result = await this.accessibilityTester.testScreenReaderCompatibility();
    
    // Assert essential screen reader features
    expect(result.landmarksCount).toBeGreaterThan(0);
    expect(result.headingStructure.length).toBeGreaterThan(0);
    
    // Verify proper heading hierarchy
    if (result.violations.length > 0) {
      console.warn('Screen reader violations:', result.violations);
    }
  }

  /**
   * Validate ARIA usage
   */
  async validateAriaUsage(): Promise<void> {
    const result = await this.ariaValidator.validateAllAriaAttributes();
    
    // Assert no invalid ARIA attributes
    expect(result.invalidAttributes.length).toBe(0);
    
    // Assert no missing required attributes
    expect(result.missingRequiredAttributes.length).toBe(0);
    
    // Warn about deprecated attributes
    if (result.deprecatedAttributes.length > 0) {
      console.warn('Deprecated ARIA attributes found:', result.deprecatedAttributes);
    }
  }

  /**
   * Validate semantic HTML structure
   */
  async validateSemanticHtml(): Promise<void> {
    const result = await this.semanticValidator.validateSemanticStructure();
    
    // Assert minimum semantic score
    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    
    // Assert essential document structure
    expect(result.documentStructure.hasHtmlLang).toBe(true);
    expect(result.documentStructure.hasTitle).toBe(true);
    expect(result.headingHierarchy.hasH1).toBe(true);
  }

  /**
   * Test focus management
   */
  async testFocusManagement(): Promise<void> {
    const result = await this.accessibilityTester.testFocusManagement();
    
    // Check focus indicators
    const focusIndicatorRate = result.visibleFocusIndicators / result.totalFocusableElements;
    expect(focusIndicatorRate).toBeGreaterThanOrEqual(0.9); // 90% threshold
  }

  /**
   * Test color contrast
   */
  async testColorContrast(): Promise<void> {
    const result = await this.accessibilityTester.testColorContrast();
    
    // Check for contrast violations
    const contrastViolations = result.violations.filter(v => 
      v.id === 'color-contrast' || v.id === 'color-contrast-enhanced'
    );
    
    expect(contrastViolations.length).toBe(0);
  }

  /**
   * Verify page has proper landmark structure
   */
  async verifyLandmarkStructure(): Promise<void> {
    // Check for main content area
    const mainLandmark = this.page.locator(this.accessibilitySelectors.main);
    await expect(mainLandmark).toBeVisible();
    
    // Check for navigation
    const navCount = await this.page.locator(this.accessibilitySelectors.navigation).count();
    expect(navCount).toBeGreaterThanOrEqual(1);
  }

  /**
   * Verify heading hierarchy
   */
  async verifyHeadingHierarchy(): Promise<void> {
    // Check for H1
    const h1Count = await this.page.locator(this.accessibilitySelectors.h1).count();
    expect(h1Count).toBe(1);
    
    // Check heading sequence
    const headings = await this.page.locator(this.accessibilitySelectors.headings).all();
    
    if (headings.length > 1) {
      let previousLevel = 0;
      
      for (const heading of headings) {
        const level = parseInt(await heading.evaluate(el => el.tagName.charAt(1)));
        
        // First heading should be H1
        if (previousLevel === 0) {
          expect(level).toBe(1);
        }
        
        // Don't skip heading levels
        if (previousLevel > 0) {
          expect(level).toBeLessThanOrEqual(previousLevel + 1);
        }
        
        previousLevel = level;
      }
    }
  }

  /**
   * Test form accessibility
   */
  async testFormAccessibility(): Promise<void> {
    const forms = await this.page.locator('form').all();
    
    for (const form of forms) {
      // Check form controls have labels
      const inputs = await form.locator(this.accessibilitySelectors.formControls).all();
      
      for (const input of inputs) {
        const inputInfo = await input.evaluate(el => {
          const id = el.getAttribute('id');
          const hasLabel = id && document.querySelector(`label[for="${id}"]`);
          const hasAriaLabel = el.getAttribute('aria-label');
          const hasAriaLabelledBy = el.getAttribute('aria-labelledby');
          const type = el.getAttribute('type') || 'text';
          
          return {
            type,
            hasAccessibleName: !!(hasLabel || hasAriaLabel || hasAriaLabelledBy)
          };
        });
        
        // Skip hidden inputs
        if (inputInfo.type === 'hidden') continue;
        
        expect(inputInfo.hasAccessibleName).toBe(true);
      }
    }
  }

  /**
   * Test button accessibility
   */
  async testButtonAccessibility(): Promise<void> {
    const buttons = await this.page.locator(this.accessibilitySelectors.buttons).all();
    
    for (const button of buttons) {
      // Check button has accessible name
      const hasAccessibleName = await button.evaluate(el => {
        const text = el.textContent?.trim();
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const title = el.getAttribute('title');
        
        return !!(text || ariaLabel || ariaLabelledBy || title);
      });
      
      expect(hasAccessibleName).toBe(true);
      
      // Check button is keyboard focusable
      const tabIndex = await button.getAttribute('tabindex');
      if (tabIndex === '-1') {
        // Button should have aria-hidden if removed from tab order
        const ariaHidden = await button.getAttribute('aria-hidden');
        expect(ariaHidden).toBe('true');
      }
    }
  }

  /**
   * Test link accessibility
   */
  async testLinkAccessibility(): Promise<void> {
    const links = await this.page.locator(this.accessibilitySelectors.links).all();
    
    for (const link of links) {
      // Check link has accessible name
      const linkInfo = await link.evaluate(el => {
        const text = el.textContent?.trim();
        const ariaLabel = el.getAttribute('aria-label');
        const href = el.getAttribute('href');
        
        // Check for generic link text
        const genericTexts = ['click here', 'read more', 'more', 'link', 'here'];
        const isGeneric = text && genericTexts.some(generic => 
          text.toLowerCase().includes(generic.toLowerCase())
        );
        
        return {
          text,
          href,
          hasAccessibleName: !!(text || ariaLabel),
          isGeneric
        };
      });
      
      expect(linkInfo.hasAccessibleName).toBe(true);
      
      // Warn about generic link text
      if (linkInfo.isGeneric) {
        console.warn(`Link has generic text: "${linkInfo.text}" (${linkInfo.href})`);
      }
    }
  }

  /**
   * Test image accessibility
   */
  async testImageAccessibility(): Promise<void> {
    const images = await this.page.locator(this.accessibilitySelectors.images).all();
    
    for (const img of images) {
      const imgInfo = await img.evaluate(el => ({
        src: el.getAttribute('src'),
        alt: el.getAttribute('alt'),
        hasAlt: el.hasAttribute('alt'),
        role: el.getAttribute('role')
      }));
      
      // All images must have alt attribute (empty for decorative images)
      expect(imgInfo.hasAlt || imgInfo.role === 'presentation').toBe(true);
    }
  }

  /**
   * Test error state accessibility
   */
  async testErrorStateAccessibility(): Promise<void> {
    const errorElements = await this.page.locator(this.accessibilitySelectors.errorMessages).all();
    
    for (const error of errorElements) {
      const errorInfo = await error.evaluate(el => ({
        role: el.getAttribute('role'),
        ariaLive: el.getAttribute('aria-live'),
        isVisible: el.offsetParent !== null
      }));
      
      if (errorInfo.isVisible) {
        // Error messages should be announced to screen readers
        const isAnnounced = errorInfo.role === 'alert' || 
                           errorInfo.ariaLive === 'assertive' || 
                           errorInfo.ariaLive === 'polite';
        expect(isAnnounced).toBe(true);
      }
    }
  }

  /**
   * Test loading state accessibility
   */
  async testLoadingStateAccessibility(): Promise<void> {
    const loadingElements = await this.page.locator(this.accessibilitySelectors.loadingIndicators).all();
    
    for (const loading of loadingElements) {
      const loadingInfo = await loading.evaluate(el => ({
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
        ariaBusy: el.getAttribute('aria-busy'),
        isVisible: el.offsetParent !== null
      }));
      
      if (loadingInfo.isVisible) {
        // Loading states should be announced
        const hasProperRole = ['status', 'progressbar'].includes(loadingInfo.role || '');
        const hasLabel = !!loadingInfo.ariaLabel;
        const isBusy = loadingInfo.ariaBusy === 'true';
        
        expect(hasProperRole || hasLabel || isBusy).toBe(true);
      }
    }
  }

  /**
   * Test skip links
   */
  async testSkipLinks(): Promise<void> {
    const skipLinks = await this.page.locator(this.accessibilitySelectors.skipLinks).all();
    
    for (const skipLink of skipLinks) {
      const href = await skipLink.getAttribute('href');
      
      if (href && href.startsWith('#')) {
        // Check if target exists
        const targetId = href.substring(1);
        const target = this.page.locator(`#${targetId}`);
        await expect(target).toBeAttached();
        
        // Test skip link functionality
        await skipLink.focus();
        await expect(skipLink).toBeFocused();
      }
    }
  }

  /**
   * Generate accessibility violation report with screenshots
   */
  async generateAccessibilityReport(testName: string): Promise<string> {
    const report = await this.runComprehensiveAccessibilityAudit();
    
    // Take screenshot if violations exist
    if (report.summary.totalViolations > 0) {
      const screenshot = await this.page.screenshot({
        fullPage: true,
        path: `/home/kinginyellow/projects/medianest-playwright/.medianest-e2e/reports/accessibility-${testName}-${Date.now()}.png`
      });
      
      report.screenshots = [`accessibility-${testName}-${Date.now()}.png`];
    }
    
    // Generate JSON report
    const reportPath = `/home/kinginyellow/projects/medianest-playwright/.medianest-e2e/reports/accessibility-${testName}-${Date.now()}.json`;
    const fs = await import('fs/promises');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    return reportPath;
  }

  /**
   * Wait for accessibility-ready state
   */
  async waitForAccessibilityReady(): Promise<void> {
    // Wait for page to be loaded
    await this.page.waitForLoadState('networkidle');
    
    // Wait for any loading indicators to disappear
    try {
      await this.page.locator(this.accessibilitySelectors.loadingIndicators).waitFor({
        state: 'hidden',
        timeout: 5000
      });
    } catch {
      // Loading indicators might not be present
    }
    
    // Wait for main content to be visible
    await this.page.locator(this.getMainContentSelector()).waitFor({
      state: 'visible',
      timeout: this.timeout
    });
  }

  /**
   * Test complete accessibility suite for the page
   */
  async runCompleteAccessibilityTests(): Promise<AccessibilityReport> {
    console.log(`Running complete accessibility tests for: ${this.getPageTitle()}`);
    
    // Initialize
    await this.initializeAccessibilityTesting();
    await this.waitForAccessibilityReady();
    
    // Run all accessibility tests
    await this.verifyLandmarkStructure();
    await this.verifyHeadingHierarchy();
    await this.testKeyboardNavigation();
    await this.testScreenReaderCompatibility();
    await this.validateAriaUsage();
    await this.validateSemanticHtml();
    await this.testFocusManagement();
    await this.testColorContrast();
    await this.testFormAccessibility();
    await this.testButtonAccessibility();
    await this.testLinkAccessibility();
    await this.testImageAccessibility();
    await this.testErrorStateAccessibility();
    await this.testLoadingStateAccessibility();
    await this.testSkipLinks();
    
    // Generate comprehensive report
    const report = await this.runComprehensiveAccessibilityAudit();
    
    console.log(`Accessibility tests completed. Score: ${report.overallScore}/100`);
    
    return report;
  }

  /**
   * Test accessibility in different viewport sizes
   */
  async testResponsiveAccessibility(): Promise<AccessibilityReport[]> {
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1920, height: 1080, name: 'desktop' }
    ];
    
    const reports: AccessibilityReport[] = [];
    
    for (const viewport of viewports) {
      await this.page.setViewportSize({ width: viewport.width, height: viewport.height });
      await this.waitForAccessibilityReady();
      
      console.log(`Testing accessibility on ${viewport.name} viewport`);
      const report = await this.runComprehensiveAccessibilityAudit();
      report.url = `${report.url} (${viewport.name})`;
      reports.push(report);
    }
    
    return reports;
  }

  /**
   * Helper method to announce messages to screen readers (for testing)
   */
  async announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): Promise<void> {
    await this.page.evaluate(({ message, priority }) => {
      const announcer = document.createElement('div');
      announcer.setAttribute('aria-live', priority);
      announcer.setAttribute('aria-atomic', 'true');
      announcer.style.position = 'absolute';
      announcer.style.left = '-10000px';
      announcer.style.width = '1px';
      announcer.style.height = '1px';
      announcer.style.overflow = 'hidden';
      
      document.body.appendChild(announcer);
      announcer.textContent = message;
      
      // Remove after announcement
      setTimeout(() => announcer.remove(), 1000);
    }, { message, priority });
  }

  /**
   * Get accessibility testing results
   */
  getAccessibilityResults() {
    return this.accessibilityTester.getResults();
  }

  /**
   * Clear accessibility testing results
   */
  clearAccessibilityResults(): void {
    this.accessibilityTester.clearResults();
  }
}