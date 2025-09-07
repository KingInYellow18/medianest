import { AxeResults, RunOptions } from 'axe-core';

/**
 * Advanced axe-core configuration for MediaNest accessibility testing
 * Includes custom rules, comprehensive WCAG coverage, and specialized checks
 */

// Standard axe configuration for different test levels
export const axeConfigurations = {
  basic: {
    tags: ['wcag2a'],
    rules: {
      'color-contrast': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'focus-visible': { enabled: true },
      'label': { enabled: true },
      'button-name': { enabled: true },
      'link-name': { enabled: true },
      'image-alt': { enabled: true },
    }
  },

  standard: {
    tags: ['wcag2a', 'wcag2aa'],
    rules: {
      'color-contrast': { enabled: true },
      'color-contrast-enhanced': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'focus-visible': { enabled: true },
      'focus-order-semantics': { enabled: true },
      'label': { enabled: true },
      'form-field-multiple-labels': { enabled: true },
      'button-name': { enabled: true },
      'link-name': { enabled: true },
      'image-alt': { enabled: true },
      'landmark': { enabled: true },
      'heading-order': { enabled: true },
      'aria-allowed-attr': { enabled: true },
      'aria-required-attr': { enabled: true },
      'aria-valid-attr': { enabled: true },
      'aria-valid-attr-value': { enabled: true },
      'aria-roles': { enabled: true },
      'bypass': { enabled: true },
      'duplicate-id': { enabled: true },
      'duplicate-id-active': { enabled: true },
      'duplicate-id-aria': { enabled: true },
    }
  },

  comprehensive: {
    tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
    rules: {
      'color-contrast': { enabled: true },
      'color-contrast-enhanced': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'focus-visible': { enabled: true },
      'focus-order-semantics': { enabled: true },
      'label': { enabled: true },
      'form-field-multiple-labels': { enabled: true },
      'button-name': { enabled: true },
      'link-name': { enabled: true },
      'image-alt': { enabled: true },
      'landmark': { enabled: true },
      'heading-order': { enabled: true },
      'aria-allowed-attr': { enabled: true },
      'aria-required-attr': { enabled: true },
      'aria-valid-attr': { enabled: true },
      'aria-valid-attr-value': { enabled: true },
      'aria-roles': { enabled: true },
      'bypass': { enabled: true },
      'duplicate-id': { enabled: true },
      'duplicate-id-active': { enabled: true },
      'duplicate-id-aria': { enabled: true },
      'meta-viewport': { enabled: true },
      'region': { enabled: true },
      'skip-link': { enabled: true },
      'tabindex': { enabled: true },
      'page-has-heading-one': { enabled: true },
      'document-title': { enabled: true },
      'html-has-lang': { enabled: true },
      'html-lang-valid': { enabled: true },
      'html-xml-lang-mismatch': { enabled: true },
    }
  }
} as const;

// MediaNest-specific custom rules
export const customRules = {
  'service-card-accessibility': {
    id: 'service-card-accessibility',
    impact: 'serious',
    tags: ['custom', 'medianest'],
    description: 'Service cards must have proper accessibility attributes',
    help: 'Service cards should have headings, status indicators with aria-labels, and keyboard-accessible actions',
    helpUrl: 'https://medianest-docs.com/accessibility#service-cards',
    selector: '[data-testid*="card"]',
    evaluate: function(node: Element) {
      const heading = node.querySelector('h1, h2, h3, h4, h5, h6');
      if (!heading) return false;
      
      const statusIndicator = node.querySelector('[data-testid*="status"]');
      if (statusIndicator && !statusIndicator.getAttribute('aria-label')) return false;
      
      const buttons = node.querySelectorAll('button, [role="button"]');
      for (const button of Array.from(buttons)) {
        const hasAccessibleName = button.textContent?.trim() || 
                                  button.getAttribute('aria-label') || 
                                  button.getAttribute('title');
        if (!hasAccessibleName) return false;
      }
      
      return true;
    }
  },

  'loading-state-accessibility': {
    id: 'loading-state-accessibility',
    impact: 'moderate',
    tags: ['custom', 'medianest'],
    description: 'Loading states must be announced to screen readers',
    help: 'Loading spinners and overlays should have aria-live regions or proper role attributes',
    helpUrl: 'https://medianest-docs.com/accessibility#loading-states',
    selector: '[data-testid*="loading"], [data-testid*="spinner"], .animate-spin',
    evaluate: function(node: Element) {
      const hasAriaLive = node.getAttribute('aria-live');
      const hasRole = node.getAttribute('role');
      const hasLabel = node.getAttribute('aria-label');
      
      return !!(hasAriaLive || hasRole === 'status' || hasRole === 'progressbar' || hasLabel);
    }
  },

  'error-message-accessibility': {
    id: 'error-message-accessibility',
    impact: 'serious',
    tags: ['custom', 'medianest'],
    description: 'Error messages must be properly announced',
    help: 'Error messages should use role="alert" or aria-live="assertive" for immediate announcement',
    helpUrl: 'https://medianest-docs.com/accessibility#error-handling',
    selector: '[data-testid*="error"], .error, .alert-error',
    evaluate: function(node: Element) {
      const hasAlertRole = node.getAttribute('role') === 'alert';
      const hasAriaLive = node.getAttribute('aria-live');
      
      return !!(hasAlertRole || hasAriaLive === 'assertive' || hasAriaLive === 'polite');
    }
  },

  'modal-focus-trap': {
    id: 'modal-focus-trap',
    impact: 'critical',
    tags: ['custom', 'medianest'],
    description: 'Modal dialogs must implement proper focus management',
    help: 'Modals should trap focus within the dialog and return focus to trigger element on close',
    helpUrl: 'https://medianest-docs.com/accessibility#modals',
    selector: '[role="dialog"], [data-testid*="modal"]',
    evaluate: function(node: Element) {
      const hasTabIndex = node.getAttribute('tabindex') === '-1' || node.getAttribute('tabindex') === '0';
      const hasAriaLabelledBy = node.getAttribute('aria-labelledby');
      const hasAriaLabel = node.getAttribute('aria-label');
      const hasCloseButton = node.querySelector('[data-testid*="close"], [aria-label*="close" i]');
      
      return !!(hasTabIndex && (hasAriaLabelledBy || hasAriaLabel) && hasCloseButton);
    }
  }
};

// Context-specific configurations
export const contextConfigurations = {
  authentication: {
    ...axeConfigurations.comprehensive,
    rules: {
      ...axeConfigurations.comprehensive.rules,
      'label': { enabled: true },
      'form-field-multiple-labels': { enabled: true },
      'required-attr': { enabled: true },
      'aria-required-attr': { enabled: true },
      'password-field': { enabled: true },
    },
    include: ['form', '[role="form"]', 'input', 'button[type="submit"]'],
    exclude: []
  },

  dashboard: {
    ...axeConfigurations.standard,
    rules: {
      ...axeConfigurations.standard.rules,
      'landmark': { enabled: true },
      'region': { enabled: true },
      'heading-order': { enabled: true },
      'service-card-accessibility': { enabled: true },
      'loading-state-accessibility': { enabled: true },
    },
    include: ['[data-testid*="card"]', 'main', 'nav'],
    exclude: []
  },

  mediaSearch: {
    ...axeConfigurations.standard,
    rules: {
      ...axeConfigurations.standard.rules,
      'label': { enabled: true },
      'button-name': { enabled: true },
      'listitem': { enabled: true },
      'list': { enabled: true },
      'searchbox-role': { enabled: true },
    },
    include: ['[role="search"]', 'input[type="search"]', '[data-testid*="search"]'],
    exclude: []
  },

  navigation: {
    ...axeConfigurations.standard,
    rules: {
      ...axeConfigurations.standard.rules,
      'landmark': { enabled: true },
      'link-name': { enabled: true },
      'aria-current': { enabled: true },
      'skip-link': { enabled: true },
      'bypass': { enabled: true },
    },
    include: ['nav', '[role="navigation"]', '[data-testid*="nav"]'],
    exclude: []
  },

  forms: {
    ...axeConfigurations.comprehensive,
    rules: {
      ...axeConfigurations.comprehensive.rules,
      'label': { enabled: true },
      'form-field-multiple-labels': { enabled: true },
      'required-attr': { enabled: true },
      'aria-required-attr': { enabled: true },
      'fieldset-legend': { enabled: true },
      'error-message-accessibility': { enabled: true },
    },
    include: ['form', '[role="form"]', 'fieldset', 'input', 'select', 'textarea'],
    exclude: []
  }
};

// Severity levels for reporting
export const severityLevels = {
  CRITICAL: 'critical',
  SERIOUS: 'serious', 
  MODERATE: 'moderate',
  MINOR: 'minor'
} as const;

export type SeverityLevel = typeof severityLevels[keyof typeof severityLevels];
export type ConfigurationLevel = keyof typeof axeConfigurations;
export type ContextType = keyof typeof contextConfigurations;

// Accessibility test result interface
export interface AccessibilityTestResult {
  url: string;
  timestamp: string;
  testLevel: ConfigurationLevel | ContextType;
  violations: AxeResults['violations'];
  passes: AxeResults['passes'];
  inapplicable: AxeResults['inapplicable'];
  incomplete: AxeResults['incomplete'];
  summary: {
    totalViolations: number;
    criticalViolations: number;
    seriousViolations: number;
    moderateViolations: number;
    minorViolations: number;
    complianceScore: number; // 0-100 percentage
  };
  recommendations?: string[];
  screenshots?: string[];
}

// Helper function to calculate compliance score
export function calculateComplianceScore(violations: AxeResults['violations']): number {
  if (violations.length === 0) return 100;
  
  const severityWeights = {
    critical: 25,
    serious: 10,
    moderate: 5,
    minor: 1
  };
  
  const totalDeductions = violations.reduce((total, violation) => {
    const weight = severityWeights[violation.impact as keyof typeof severityWeights] || 1;
    return total + (weight * violation.nodes.length);
  }, 0);
  
  // Base score starts at 100, deduct based on weighted violations
  const score = Math.max(0, 100 - totalDeductions);
  return Math.round(score);
}

// Helper function to get configuration by context
export function getConfigurationForContext(context: ContextType): RunOptions {
  return contextConfigurations[context];
}

// Helper function to get configuration by level
export function getConfigurationForLevel(level: ConfigurationLevel): RunOptions {
  return axeConfigurations[level];
}

// Generate accessibility recommendations based on violations
export function generateRecommendations(violations: AxeResults['violations']): string[] {
  const recommendations = new Set<string>();
  
  violations.forEach(violation => {
    switch (violation.id) {
      case 'color-contrast':
        recommendations.add('Improve color contrast ratios to meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)');
        break;
      case 'label':
        recommendations.add('Add proper labels to form controls using <label> elements or aria-label attributes');
        break;
      case 'button-name':
        recommendations.add('Ensure all buttons have accessible names through text content, aria-label, or aria-labelledby');
        break;
      case 'link-name':
        recommendations.add('Provide descriptive text for links, avoiding generic phrases like "click here"');
        break;
      case 'image-alt':
        recommendations.add('Add meaningful alt text to images, or empty alt="" for decorative images');
        break;
      case 'heading-order':
        recommendations.add('Use heading tags (h1-h6) in proper hierarchical order without skipping levels');
        break;
      case 'landmark':
        recommendations.add('Use semantic HTML landmarks (main, nav, aside, footer) or ARIA landmarks');
        break;
      case 'keyboard-navigation':
        recommendations.add('Ensure all interactive elements are keyboard accessible with visible focus indicators');
        break;
      case 'aria-required-attr':
        recommendations.add('Add required ARIA attributes for roles and states');
        break;
      case 'focus-visible':
        recommendations.add('Provide clear visual focus indicators for keyboard navigation');
        break;
      default:
        recommendations.add(`Address ${violation.id} violations as described in the WCAG guidelines`);
    }
  });
  
  return Array.from(recommendations);
}

export default {
  axeConfigurations,
  customRules,
  contextConfigurations,
  severityLevels,
  calculateComplianceScore,
  getConfigurationForContext,
  getConfigurationForLevel,
  generateRecommendations
};