import { Page, Locator, expect } from '@playwright/test';
import { injectAxe, checkA11y, getViolations, AxeResults, RunOptions } from 'axe-playwright';
import { 
  AccessibilityTestResult, 
  ConfigurationLevel, 
  ContextType, 
  calculateComplianceScore,
  generateRecommendations,
  getConfigurationForContext,
  getConfigurationForLevel,
  customRules
} from '../config/axe-config';

/**
 * Comprehensive accessibility testing utilities for MediaNest
 * Provides advanced axe-core integration, keyboard testing, and reporting
 */

export class AccessibilityTester {
  private page: Page;
  private results: AccessibilityTestResult[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Initialize accessibility testing by injecting axe-core and custom rules
   */
  async initialize(): Promise<void> {
    await injectAxe(this.page);
    
    // Inject custom rules
    await this.page.addInitScript(() => {
      if (typeof window !== 'undefined' && (window as any).axe) {
        const customRules = ${JSON.stringify(customRules)};
        
        Object.values(customRules).forEach(rule => {
          (window as any).axe.configure({
            rules: [{
              id: rule.id,
              selector: rule.selector,
              tags: rule.tags,
              metadata: {
                description: rule.description,
                help: rule.help,
                helpUrl: rule.helpUrl,
                impact: rule.impact
              },
              evaluate: rule.evaluate
            }]
          });
        });
      }
    });
  }

  /**
   * Run basic accessibility audit
   */
  async runBasicAudit(context?: string): Promise<AccessibilityTestResult> {
    const config = getConfigurationForLevel('basic');
    return this.runAudit(config, 'basic', context);
  }

  /**
   * Run standard accessibility audit
   */
  async runStandardAudit(context?: string): Promise<AccessibilityTestResult> {
    const config = getConfigurationForLevel('standard');
    return this.runAudit(config, 'standard', context);
  }

  /**
   * Run comprehensive accessibility audit
   */
  async runComprehensiveAudit(context?: string): Promise<AccessibilityTestResult> {
    const config = getConfigurationForLevel('comprehensive');
    return this.runAudit(config, 'comprehensive', context);
  }

  /**
   * Run context-specific accessibility audit
   */
  async runContextualAudit(contextType: ContextType, context?: string): Promise<AccessibilityTestResult> {
    const config = getConfigurationForContext(contextType);
    return this.runAudit(config, contextType, context);
  }

  /**
   * Core audit runner
   */
  private async runAudit(
    config: RunOptions, 
    testLevel: ConfigurationLevel | ContextType, 
    context?: string
  ): Promise<AccessibilityTestResult> {
    const violations = await getViolations(this.page, context, {
      ...config,
      detailedReport: true,
      detailedReportOptions: { html: true }
    });

    const result: AccessibilityTestResult = {
      url: this.page.url(),
      timestamp: new Date().toISOString(),
      testLevel,
      violations: violations || [],
      passes: [], // Note: axe-playwright doesn't return passes
      inapplicable: [],
      incomplete: [],
      summary: {
        totalViolations: violations?.length || 0,
        criticalViolations: violations?.filter(v => v.impact === 'critical').length || 0,
        seriousViolations: violations?.filter(v => v.impact === 'serious').length || 0,
        moderateViolations: violations?.filter(v => v.impact === 'moderate').length || 0,
        minorViolations: violations?.filter(v => v.impact === 'minor').length || 0,
        complianceScore: calculateComplianceScore(violations || [])
      },
      recommendations: generateRecommendations(violations || [])
    };

    this.results.push(result);
    return result;
  }

  /**
   * Test keyboard navigation comprehensively
   */
  async testKeyboardNavigation(): Promise<KeyboardNavigationResult> {
    const result: KeyboardNavigationResult = {
      totalInteractiveElements: 0,
      keyboardAccessibleElements: 0,
      focusableElements: [],
      tabOrder: [],
      violations: [],
      recommendations: []
    };

    // Get all interactive elements
    const interactiveSelector = [
      'a', 'button', 'input', 'select', 'textarea',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]', '[role="link"]', '[role="menuitem"]',
      '[role="tab"]', '[role="option"]'
    ].join(', ');

    const interactiveElements = await this.page.locator(interactiveSelector).all();
    result.totalInteractiveElements = interactiveElements.length;

    // Test each element for keyboard accessibility
    for (let i = 0; i < interactiveElements.length; i++) {
      const element = interactiveElements[i];
      const elementInfo = await this.analyzeInteractiveElement(element, i);
      
      if (elementInfo.isKeyboardAccessible) {
        result.keyboardAccessibleElements++;
      }
      
      result.focusableElements.push(elementInfo);
      
      if (elementInfo.violations.length > 0) {
        result.violations.push(...elementInfo.violations);
      }
    }

    // Test tab order
    result.tabOrder = await this.testTabOrder();
    
    // Test common keyboard shortcuts
    await this.testKeyboardShortcuts(result);

    // Generate recommendations
    result.recommendations = this.generateKeyboardRecommendations(result);

    return result;
  }

  /**
   * Analyze individual interactive element
   */
  private async analyzeInteractiveElement(element: Locator, index: number): Promise<InteractiveElementInfo> {
    const info: InteractiveElementInfo = {
      index,
      tagName: '',
      type: '',
      hasAccessibleName: false,
      hasFocusIndicator: false,
      isKeyboardAccessible: false,
      tabIndex: null,
      ariaAttributes: {},
      violations: []
    };

    try {
      // Get basic element information
      info.tagName = await element.evaluate(el => el.tagName.toLowerCase());
      info.type = await element.getAttribute('type') || '';
      info.tabIndex = await element.getAttribute('tabindex');

      // Check for accessible name
      const accessibleName = await element.evaluate(el => {
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const textContent = el.textContent?.trim();
        const title = el.getAttribute('title');
        
        if (ariaLabel) return ariaLabel;
        if (ariaLabelledBy) {
          const labelElement = document.getElementById(ariaLabelledBy);
          return labelElement?.textContent?.trim() || '';
        }
        if (textContent) return textContent;
        if (title) return title;
        
        // For inputs, check for associated label
        if (el.tagName.toLowerCase() === 'input') {
          const id = el.getAttribute('id');
          if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            return label?.textContent?.trim() || '';
          }
        }
        
        return '';
      });

      info.hasAccessibleName = !!accessibleName;

      // Get ARIA attributes
      info.ariaAttributes = await element.evaluate(el => {
        const attrs: Record<string, string> = {};
        for (const attr of el.attributes) {
          if (attr.name.startsWith('aria-')) {
            attrs[attr.name] = attr.value;
          }
        }
        return attrs;
      });

      // Test focus capability
      try {
        await element.focus();
        info.hasFocusIndicator = await element.evaluate(el => {
          const computedStyle = window.getComputedStyle(el);
          const outline = computedStyle.outline;
          const outlineWidth = computedStyle.outlineWidth;
          const boxShadow = computedStyle.boxShadow;
          
          // Check if element has visible focus indicator
          return outline !== 'none' || 
                 outlineWidth !== '0px' || 
                 boxShadow.includes('rgb') ||
                 el.matches(':focus-visible');
        });
        
        info.isKeyboardAccessible = true;
      } catch {
        info.isKeyboardAccessible = false;
        info.violations.push('Element cannot receive keyboard focus');
      }

      // Check for common violations
      if (!info.hasAccessibleName && info.tagName !== 'div') {
        info.violations.push('Missing accessible name');
      }

      if (!info.hasFocusIndicator && info.isKeyboardAccessible) {
        info.violations.push('No visible focus indicator');
      }

      if (info.tabIndex === '-1' && !info.ariaAttributes['aria-hidden']) {
        info.violations.push('Element removed from tab order without aria-hidden');
      }

    } catch (error) {
      info.violations.push(`Error analyzing element: ${error}`);
    }

    return info;
  }

  /**
   * Test tab order throughout the page
   */
  private async testTabOrder(): Promise<TabOrderElement[]> {
    const tabOrder: TabOrderElement[] = [];
    
    // Start from beginning of document
    await this.page.keyboard.press('Tab');
    
    let previousElement: string | null = null;
    let tabCount = 0;
    const maxTabs = 50; // Prevent infinite loops

    while (tabCount < maxTabs) {
      const currentElement = await this.page.evaluate(() => {
        const activeElement = document.activeElement;
        if (!activeElement || activeElement === document.body) return null;
        
        return {
          tagName: activeElement.tagName.toLowerCase(),
          id: activeElement.getAttribute('id') || '',
          className: activeElement.getAttribute('class') || '',
          textContent: activeElement.textContent?.trim().substring(0, 50) || '',
          role: activeElement.getAttribute('role') || '',
          tabIndex: activeElement.getAttribute('tabindex') || '0',
          boundingRect: activeElement.getBoundingClientRect()
        };
      });

      if (!currentElement) break;

      const elementSignature = `${currentElement.tagName}#${currentElement.id}.${currentElement.className}`;
      
      // Break if we're cycling back to a previous element
      if (elementSignature === previousElement) break;

      tabOrder.push({
        order: tabCount + 1,
        element: currentElement,
        isVisible: currentElement.boundingRect.width > 0 && currentElement.boundingRect.height > 0
      });

      previousElement = elementSignature;
      tabCount++;
      
      await this.page.keyboard.press('Tab');
    }

    return tabOrder;
  }

  /**
   * Test common keyboard shortcuts
   */
  private async testKeyboardShortcuts(result: KeyboardNavigationResult): Promise<void> {
    const shortcuts = [
      { key: 'Escape', description: 'Close modals/overlays' },
      { key: 'Enter', description: 'Activate buttons/links' },
      { key: 'Space', description: 'Activate buttons' },
      { key: 'ArrowDown', description: 'Navigate lists/menus' },
      { key: 'ArrowUp', description: 'Navigate lists/menus' },
      { key: 'Home', description: 'Go to beginning' },
      { key: 'End', description: 'Go to end' }
    ];

    for (const shortcut of shortcuts) {
      try {
        const initialUrl = this.page.url();
        await this.page.keyboard.press(shortcut.key);
        
        // Check if shortcut had any effect (this is very context-dependent)
        const finalUrl = this.page.url();
        if (initialUrl !== finalUrl) {
          result.violations.push(`${shortcut.key} caused unexpected navigation`);
        }
      } catch (error) {
        // Keyboard shortcut errors are usually not critical
        console.warn(`Keyboard shortcut test failed for ${shortcut.key}:`, error);
      }
    }
  }

  /**
   * Generate keyboard navigation recommendations
   */
  private generateKeyboardRecommendations(result: KeyboardNavigationResult): string[] {
    const recommendations: string[] = [];
    
    const accessibilityRate = result.keyboardAccessibleElements / result.totalInteractiveElements;
    
    if (accessibilityRate < 1) {
      recommendations.push(`${Math.round((1 - accessibilityRate) * 100)}% of interactive elements are not keyboard accessible`);
    }

    const elementsWithoutFocus = result.focusableElements.filter(el => !el.hasFocusIndicator);
    if (elementsWithoutFocus.length > 0) {
      recommendations.push(`${elementsWithoutFocus.length} elements lack visible focus indicators`);
    }

    const elementsWithoutNames = result.focusableElements.filter(el => !el.hasAccessibleName);
    if (elementsWithoutNames.length > 0) {
      recommendations.push(`${elementsWithoutNames.length} interactive elements lack accessible names`);
    }

    if (result.tabOrder.length > 20) {
      recommendations.push('Consider simplifying tab order - very long tab sequences can be difficult to navigate');
    }

    const offscreenElements = result.tabOrder.filter(el => !el.isVisible);
    if (offscreenElements.length > 0) {
      recommendations.push(`${offscreenElements.length} focusable elements are not visible - consider hiding with aria-hidden or tabindex="-1"`);
    }

    return recommendations;
  }

  /**
   * Test screen reader compatibility
   */
  async testScreenReaderCompatibility(): Promise<ScreenReaderTestResult> {
    const result: ScreenReaderTestResult = {
      landmarksCount: 0,
      headingStructure: [],
      ariaLabels: 0,
      ariaDescriptions: 0,
      liveRegions: 0,
      skipLinks: 0,
      violations: [],
      recommendations: []
    };

    // Test landmarks
    const landmarks = await this.page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="search"], main, nav, header, footer, aside').count();
    result.landmarksCount = landmarks;

    // Test heading structure
    const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').all();
    for (const heading of headings) {
      const level = parseInt(await heading.evaluate(el => el.tagName.charAt(1)));
      const text = await heading.textContent();
      result.headingStructure.push({ level, text: text?.trim() || '' });
    }

    // Validate heading hierarchy
    let previousLevel = 0;
    for (const heading of result.headingStructure) {
      if (heading.level > previousLevel + 1) {
        result.violations.push(`Heading level ${heading.level} skips from level ${previousLevel} - "${heading.text}"`);
      }
      previousLevel = heading.level;
    }

    // Test ARIA usage
    result.ariaLabels = await this.page.locator('[aria-label]').count();
    result.ariaDescriptions = await this.page.locator('[aria-describedby], [aria-description]').count();
    result.liveRegions = await this.page.locator('[aria-live], [role="alert"], [role="status"], [role="log"]').count();

    // Test skip links
    result.skipLinks = await this.page.locator('a[href*="#"], .skip-link').count();

    // Generate recommendations
    if (result.landmarksCount === 0) {
      result.recommendations.push('Add semantic landmarks (main, nav, header, footer) or ARIA landmarks');
    }

    if (result.headingStructure.length === 0) {
      result.recommendations.push('Add heading structure for screen reader navigation');
    }

    if (result.skipLinks === 0) {
      result.recommendations.push('Consider adding skip links for keyboard users');
    }

    if (result.liveRegions === 0) {
      result.recommendations.push('Consider adding ARIA live regions for dynamic content updates');
    }

    return result;
  }

  /**
   * Test color contrast and visual accessibility
   */
  async testColorContrast(): Promise<ColorContrastResult> {
    const result: ColorContrastResult = {
      totalElements: 0,
      passedElements: 0,
      failedElements: [],
      violations: [],
      recommendations: []
    };

    // Run axe color contrast check
    const violations = await getViolations(this.page, null, {
      rules: {
        'color-contrast': { enabled: true },
        'color-contrast-enhanced': { enabled: true }
      }
    });

    result.violations = violations?.filter(v => 
      v.id === 'color-contrast' || v.id === 'color-contrast-enhanced'
    ) || [];

    // Analyze specific elements for contrast
    const textElements = await this.page.locator('p, span, a, button, input, label, h1, h2, h3, h4, h5, h6').all();
    result.totalElements = textElements.length;

    for (const element of textElements) {
      const contrastInfo = await element.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          text: el.textContent?.trim() || ''
        };
      });

      // This is a simplified check - full contrast calculation would require color parsing
      if (contrastInfo.color !== 'rgba(0, 0, 0, 0)' && contrastInfo.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        result.passedElements++;
      } else {
        result.failedElements.push({
          text: contrastInfo.text.substring(0, 50),
          color: contrastInfo.color,
          backgroundColor: contrastInfo.backgroundColor
        });
      }
    }

    // Generate contrast fix suggestions
    result.recommendations = this.generateContrastRecommendations(result);

    return result;
  }

  /**
   * Generate color contrast recommendations
   */
  private generateContrastRecommendations(result: ColorContrastResult): string[] {
    const recommendations: string[] = [];

    if (result.violations.length > 0) {
      recommendations.push('Use WebAIM Color Contrast Checker to verify and improve color combinations');
      recommendations.push('Ensure normal text has a contrast ratio of at least 4.5:1');
      recommendations.push('Ensure large text (18pt+ or 14pt+ bold) has a contrast ratio of at least 3:1');
    }

    const failureRate = result.failedElements.length / result.totalElements;
    if (failureRate > 0.1) {
      recommendations.push('Consider using a design system with pre-validated color combinations');
      recommendations.push('Test color contrast early in the design process');
    }

    return recommendations;
  }

  /**
   * Test focus management
   */
  async testFocusManagement(): Promise<FocusManagementResult> {
    const result: FocusManagementResult = {
      focusTrappingWorks: false,
      focusRestoration: false,
      visibleFocusIndicators: 0,
      totalFocusableElements: 0,
      violations: [],
      recommendations: []
    };

    // Test focus trap in modals
    const modals = await this.page.locator('[role="dialog"], [data-testid*="modal"]').all();
    
    if (modals.length > 0) {
      for (const modal of modals) {
        if (await modal.isVisible()) {
          const trapResult = await this.testFocusTrap(modal);
          result.focusTrappingWorks = trapResult;
          break; // Test first visible modal
        }
      }
    }

    // Test focus indicators
    const focusableElements = await this.page.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])').all();
    result.totalFocusableElements = focusableElements.length;

    for (const element of focusableElements) {
      try {
        await element.focus();
        const hasVisibleFocus = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.outline !== 'none' && 
                 style.outlineWidth !== '0px' ||
                 style.boxShadow.includes('rgb') ||
                 el.matches(':focus-visible');
        });
        
        if (hasVisibleFocus) {
          result.visibleFocusIndicators++;
        }
      } catch {
        // Element might not be focusable
      }
    }

    // Generate recommendations
    const focusIndicatorRate = result.visibleFocusIndicators / result.totalFocusableElements;
    if (focusIndicatorRate < 0.9) {
      result.recommendations.push('Improve focus indicators for keyboard navigation');
    }

    if (modals.length > 0 && !result.focusTrappingWorks) {
      result.recommendations.push('Implement focus trapping in modal dialogs');
    }

    return result;
  }

  /**
   * Test focus trap implementation
   */
  private async testFocusTrap(modal: Locator): Promise<boolean> {
    try {
      // Focus the modal
      await modal.focus();
      
      // Find focusable elements within modal
      const focusableInModal = modal.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const count = await focusableInModal.count();
      
      if (count === 0) return false; // No focusable elements
      
      // Tab through all elements and check if focus stays in modal
      for (let i = 0; i < count + 2; i++) { // +2 to test wrapping
        await this.page.keyboard.press('Tab');
        
        const focusedElement = await this.page.evaluate(() => {
          const active = document.activeElement;
          return active ? {
            tag: active.tagName,
            id: active.id,
            className: active.className
          } : null;
        });
        
        if (!focusedElement) return false;
        
        // Check if focused element is within modal
        const isWithinModal = await modal.locator(':focus').count() > 0;
        if (!isWithinModal && i < count) {
          return false; // Focus escaped modal
        }
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate comprehensive accessibility report
   */
  async generateComprehensiveReport(): Promise<AccessibilityReport> {
    const auditResult = await this.runComprehensiveAudit();
    const keyboardResult = await this.testKeyboardNavigation();
    const screenReaderResult = await this.testScreenReaderCompatibility();
    const colorContrastResult = await this.testColorContrast();
    const focusManagementResult = await this.testFocusManagement();

    const report: AccessibilityReport = {
      url: this.page.url(),
      timestamp: new Date().toISOString(),
      overallScore: this.calculateOverallScore(auditResult, keyboardResult, screenReaderResult),
      audit: auditResult,
      keyboardNavigation: keyboardResult,
      screenReader: screenReaderResult,
      colorContrast: colorContrastResult,
      focusManagement: focusManagementResult,
      summary: {
        totalViolations: auditResult.summary.totalViolations,
        criticalIssues: auditResult.summary.criticalViolations,
        keyboardAccessibilityRate: keyboardResult.keyboardAccessibleElements / keyboardResult.totalInteractiveElements,
        contrastPassRate: colorContrastResult.passedElements / colorContrastResult.totalElements,
        hasProperLandmarks: screenReaderResult.landmarksCount > 0,
        hasFocusManagement: focusManagementResult.focusTrappingWorks
      },
      recommendations: this.consolidateRecommendations([
        auditResult.recommendations || [],
        keyboardResult.recommendations,
        screenReaderResult.recommendations,
        colorContrastResult.recommendations,
        focusManagementResult.recommendations
      ])
    };

    return report;
  }

  /**
   * Calculate overall accessibility score
   */
  private calculateOverallScore(
    audit: AccessibilityTestResult,
    keyboard: KeyboardNavigationResult,
    screenReader: ScreenReaderTestResult
  ): number {
    const auditScore = audit.summary.complianceScore;
    const keyboardScore = (keyboard.keyboardAccessibleElements / keyboard.totalInteractiveElements) * 100;
    const screenReaderScore = Math.min(100, (
      (screenReader.landmarksCount > 0 ? 25 : 0) +
      (screenReader.headingStructure.length > 0 ? 25 : 0) +
      (screenReader.skipLinks > 0 ? 25 : 0) +
      (screenReader.liveRegions > 0 ? 25 : 0)
    ));

    // Weighted average: audit 50%, keyboard 30%, screen reader 20%
    return Math.round((auditScore * 0.5) + (keyboardScore * 0.3) + (screenReaderScore * 0.2));
  }

  /**
   * Consolidate recommendations from all tests
   */
  private consolidateRecommendations(recommendationGroups: string[][]): string[] {
    const allRecommendations = recommendationGroups.flat();
    return [...new Set(allRecommendations)]; // Remove duplicates
  }

  /**
   * Get all test results
   */
  getResults(): AccessibilityTestResult[] {
    return this.results;
  }

  /**
   * Clear test results
   */
  clearResults(): void {
    this.results = [];
  }
}

// Type definitions for test results
export interface KeyboardNavigationResult {
  totalInteractiveElements: number;
  keyboardAccessibleElements: number;
  focusableElements: InteractiveElementInfo[];
  tabOrder: TabOrderElement[];
  violations: string[];
  recommendations: string[];
}

export interface InteractiveElementInfo {
  index: number;
  tagName: string;
  type: string;
  hasAccessibleName: boolean;
  hasFocusIndicator: boolean;
  isKeyboardAccessible: boolean;
  tabIndex: string | null;
  ariaAttributes: Record<string, string>;
  violations: string[];
}

export interface TabOrderElement {
  order: number;
  element: {
    tagName: string;
    id: string;
    className: string;
    textContent: string;
    role: string;
    tabIndex: string;
    boundingRect: DOMRect;
  };
  isVisible: boolean;
}

export interface ScreenReaderTestResult {
  landmarksCount: number;
  headingStructure: { level: number; text: string }[];
  ariaLabels: number;
  ariaDescriptions: number;
  liveRegions: number;
  skipLinks: number;
  violations: string[];
  recommendations: string[];
}

export interface ColorContrastResult {
  totalElements: number;
  passedElements: number;
  failedElements: { text: string; color: string; backgroundColor: string }[];
  violations: any[];
  recommendations: string[];
}

export interface FocusManagementResult {
  focusTrappingWorks: boolean;
  focusRestoration: boolean;
  visibleFocusIndicators: number;
  totalFocusableElements: number;
  violations: string[];
  recommendations: string[];
}

export interface AccessibilityReport {
  url: string;
  timestamp: string;
  overallScore: number;
  audit: AccessibilityTestResult;
  keyboardNavigation: KeyboardNavigationResult;
  screenReader: ScreenReaderTestResult;
  colorContrast: ColorContrastResult;
  focusManagement: FocusManagementResult;
  summary: {
    totalViolations: number;
    criticalIssues: number;
    keyboardAccessibilityRate: number;
    contrastPassRate: number;
    hasProperLandmarks: boolean;
    hasFocusManagement: boolean;
  };
  recommendations: string[];
}