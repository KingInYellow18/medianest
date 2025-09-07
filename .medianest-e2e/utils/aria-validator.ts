import { Page, Locator } from '@playwright/test';

/**
 * ARIA Compliance Validator for MediaNest
 * Comprehensive validation of ARIA attributes, roles, and patterns
 */

export class AriaValidator {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Validate all ARIA attributes on the page
   */
  async validateAllAriaAttributes(): Promise<AriaValidationResult> {
    const result: AriaValidationResult = {
      validAttributes: [],
      invalidAttributes: [],
      missingRequiredAttributes: [],
      deprecatedAttributes: [],
      recommendations: []
    };

    // Find all elements with ARIA attributes
    const elementsWithAria = await this.page.locator('[aria-*]').all();

    for (const element of elementsWithAria) {
      const validation = await this.validateElementAria(element);
      
      result.validAttributes.push(...validation.validAttributes);
      result.invalidAttributes.push(...validation.invalidAttributes);
      result.missingRequiredAttributes.push(...validation.missingRequiredAttributes);
      result.deprecatedAttributes.push(...validation.deprecatedAttributes);
    }

    // Generate recommendations
    result.recommendations = this.generateAriaRecommendations(result);

    return result;
  }

  /**
   * Validate ARIA attributes for a specific element
   */
  async validateElementAria(element: Locator): Promise<AriaValidationResult> {
    const result: AriaValidationResult = {
      validAttributes: [],
      invalidAttributes: [],
      missingRequiredAttributes: [],
      deprecatedAttributes: [],
      recommendations: []
    };

    const elementInfo = await element.evaluate(el => ({
      tagName: el.tagName.toLowerCase(),
      attributes: Array.from(el.attributes).reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
      }, {} as Record<string, string>),
      textContent: el.textContent?.trim() || '',
      innerHTML: el.innerHTML
    }));

    const role = elementInfo.attributes.role;
    const ariaAttributes = Object.entries(elementInfo.attributes)
      .filter(([name]) => name.startsWith('aria-'));

    // Validate each ARIA attribute
    for (const [attrName, attrValue] of ariaAttributes) {
      const validation = this.validateAriaAttribute(attrName, attrValue, role, elementInfo.tagName);
      
      if (validation.isValid) {
        result.validAttributes.push({
          element: elementInfo.tagName,
          attribute: attrName,
          value: attrValue,
          role: role
        });
      } else {
        result.invalidAttributes.push({
          element: elementInfo.tagName,
          attribute: attrName,
          value: attrValue,
          role: role,
          reason: validation.reason
        });
      }
    }

    // Check for missing required attributes based on role
    if (role) {
      const required = this.getRequiredAriaAttributes(role);
      for (const reqAttr of required) {
        if (!elementInfo.attributes[reqAttr]) {
          result.missingRequiredAttributes.push({
            element: elementInfo.tagName,
            role: role,
            missingAttribute: reqAttr,
            reason: `Role "${role}" requires "${reqAttr}" attribute`
          });
        }
      }
    }

    // Check for deprecated attributes
    for (const [attrName] of ariaAttributes) {
      if (this.isDeprecatedAriaAttribute(attrName)) {
        result.deprecatedAttributes.push({
          element: elementInfo.tagName,
          attribute: attrName,
          value: elementInfo.attributes[attrName],
          reason: 'This ARIA attribute is deprecated',
          replacement: this.getReplacementForDeprecatedAttribute(attrName)
        });
      }
    }

    return result;
  }

  /**
   * Validate a specific ARIA attribute
   */
  private validateAriaAttribute(
    attribute: string, 
    value: string, 
    role: string | undefined,
    tagName: string
  ): { isValid: boolean; reason?: string } {
    // Check if attribute exists
    if (!this.isValidAriaAttribute(attribute)) {
      return { isValid: false, reason: `"${attribute}" is not a valid ARIA attribute` };
    }

    // Check if attribute is allowed for this role
    if (role && !this.isAttributeAllowedForRole(attribute, role)) {
      return { isValid: false, reason: `"${attribute}" is not allowed for role "${role}"` };
    }

    // Validate attribute value format
    const valueValidation = this.validateAriaAttributeValue(attribute, value);
    if (!valueValidation.isValid) {
      return { isValid: false, reason: valueValidation.reason };
    }

    // Check for role-specific constraints
    if (role) {
      const roleConstraints = this.checkRoleSpecificConstraints(attribute, value, role, tagName);
      if (!roleConstraints.isValid) {
        return { isValid: false, reason: roleConstraints.reason };
      }
    }

    return { isValid: true };
  }

  /**
   * Check if ARIA attribute is valid
   */
  private isValidAriaAttribute(attribute: string): boolean {
    const validAttributes = [
      'aria-activedescendant', 'aria-atomic', 'aria-autocomplete', 'aria-busy',
      'aria-checked', 'aria-colcount', 'aria-colindex', 'aria-colspan',
      'aria-controls', 'aria-current', 'aria-describedby', 'aria-details',
      'aria-disabled', 'aria-dropeffect', 'aria-errormessage', 'aria-expanded',
      'aria-flowto', 'aria-grabbed', 'aria-haspopup', 'aria-hidden',
      'aria-invalid', 'aria-keyshortcuts', 'aria-label', 'aria-labelledby',
      'aria-level', 'aria-live', 'aria-modal', 'aria-multiline',
      'aria-multiselectable', 'aria-orientation', 'aria-owns', 'aria-placeholder',
      'aria-posinset', 'aria-pressed', 'aria-readonly', 'aria-relevant',
      'aria-required', 'aria-roledescription', 'aria-rowcount', 'aria-rowindex',
      'aria-rowspan', 'aria-selected', 'aria-setsize', 'aria-sort',
      'aria-valuemax', 'aria-valuemin', 'aria-valuenow', 'aria-valuetext'
    ];

    return validAttributes.includes(attribute);
  }

  /**
   * Check if attribute is allowed for role
   */
  private isAttributeAllowedForRole(attribute: string, role: string): boolean {
    const roleAttributeMap: Record<string, string[]> = {
      'button': ['aria-expanded', 'aria-haspopup', 'aria-pressed', 'aria-disabled'],
      'checkbox': ['aria-checked', 'aria-disabled', 'aria-readonly'],
      'combobox': ['aria-expanded', 'aria-haspopup', 'aria-activedescendant', 'aria-autocomplete'],
      'dialog': ['aria-modal', 'aria-labelledby', 'aria-describedby'],
      'grid': ['aria-multiselectable', 'aria-readonly', 'aria-rowcount', 'aria-colcount'],
      'gridcell': ['aria-selected', 'aria-readonly', 'aria-rowindex', 'aria-colindex'],
      'listbox': ['aria-multiselectable', 'aria-orientation', 'aria-readonly'],
      'menuitem': ['aria-haspopup', 'aria-disabled'],
      'progressbar': ['aria-valuemax', 'aria-valuemin', 'aria-valuenow', 'aria-valuetext'],
      'radio': ['aria-checked', 'aria-disabled'],
      'slider': ['aria-valuemax', 'aria-valuemin', 'aria-valuenow', 'aria-valuetext', 'aria-orientation'],
      'spinbutton': ['aria-valuemax', 'aria-valuemin', 'aria-valuenow', 'aria-readonly'],
      'switch': ['aria-checked', 'aria-disabled', 'aria-readonly'],
      'tab': ['aria-selected', 'aria-disabled', 'aria-controls'],
      'tablist': ['aria-orientation', 'aria-multiselectable'],
      'tabpanel': ['aria-labelledby'],
      'textbox': ['aria-multiline', 'aria-readonly', 'aria-placeholder', 'aria-invalid'],
      'tree': ['aria-multiselectable', 'aria-orientation'],
      'treeitem': ['aria-expanded', 'aria-level', 'aria-posinset', 'aria-setsize', 'aria-selected']
    };

    const globalAttributes = [
      'aria-atomic', 'aria-busy', 'aria-controls', 'aria-current', 'aria-describedby',
      'aria-details', 'aria-disabled', 'aria-dropeffect', 'aria-errormessage',
      'aria-flowto', 'aria-grabbed', 'aria-haspopup', 'aria-hidden', 'aria-invalid',
      'aria-keyshortcuts', 'aria-label', 'aria-labelledby', 'aria-live', 'aria-owns',
      'aria-relevant', 'aria-roledescription'
    ];

    return globalAttributes.includes(attribute) || 
           (roleAttributeMap[role] && roleAttributeMap[role].includes(attribute));
  }

  /**
   * Validate ARIA attribute value format
   */
  private validateAriaAttributeValue(attribute: string, value: string): { isValid: boolean; reason?: string } {
    const valueValidators: Record<string, (value: string) => { isValid: boolean; reason?: string }> = {
      'aria-atomic': (v) => ['true', 'false'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "true" or "false"' },
      'aria-busy': (v) => ['true', 'false'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "true" or "false"' },
      'aria-checked': (v) => ['true', 'false', 'mixed'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "true", "false", or "mixed"' },
      'aria-current': (v) => ['page', 'step', 'location', 'date', 'time', 'true', 'false'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Invalid aria-current value' },
      'aria-disabled': (v) => ['true', 'false'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "true" or "false"' },
      'aria-expanded': (v) => ['true', 'false'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "true" or "false"' },
      'aria-haspopup': (v) => ['false', 'true', 'menu', 'listbox', 'tree', 'grid', 'dialog'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Invalid aria-haspopup value' },
      'aria-hidden': (v) => ['true', 'false'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "true" or "false"' },
      'aria-invalid': (v) => ['false', 'true', 'grammar', 'spelling'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Invalid aria-invalid value' },
      'aria-level': (v) => /^\d+$/.test(v) && parseInt(v) > 0 ? { isValid: true } : { isValid: false, reason: 'Must be a positive integer' },
      'aria-live': (v) => ['off', 'polite', 'assertive'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "off", "polite", or "assertive"' },
      'aria-modal': (v) => ['true', 'false'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "true" or "false"' },
      'aria-multiline': (v) => ['true', 'false'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "true" or "false"' },
      'aria-multiselectable': (v) => ['true', 'false'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "true" or "false"' },
      'aria-orientation': (v) => ['horizontal', 'vertical'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "horizontal" or "vertical"' },
      'aria-pressed': (v) => ['true', 'false', 'mixed'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "true", "false", or "mixed"' },
      'aria-readonly': (v) => ['true', 'false'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "true" or "false"' },
      'aria-relevant': (v) => {
        const validTokens = ['additions', 'removals', 'text', 'all'];
        const tokens = v.split(/\s+/);
        const allValid = tokens.every(token => validTokens.includes(token));
        return allValid ? { isValid: true } : { isValid: false, reason: 'Invalid aria-relevant tokens' };
      },
      'aria-required': (v) => ['true', 'false'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "true" or "false"' },
      'aria-selected': (v) => ['true', 'false'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Must be "true" or "false"' },
      'aria-sort': (v) => ['ascending', 'descending', 'none', 'other'].includes(v) ? { isValid: true } : { isValid: false, reason: 'Invalid aria-sort value' },
      'aria-valuemax': (v) => /^-?\d+(\.\d+)?$/.test(v) ? { isValid: true } : { isValid: false, reason: 'Must be a valid number' },
      'aria-valuemin': (v) => /^-?\d+(\.\d+)?$/.test(v) ? { isValid: true } : { isValid: false, reason: 'Must be a valid number' },
      'aria-valuenow': (v) => /^-?\d+(\.\d+)?$/.test(v) ? { isValid: true } : { isValid: false, reason: 'Must be a valid number' }
    };

    const validator = valueValidators[attribute];
    if (validator) {
      return validator(value);
    }

    // For ID references, check if they exist (simplified check)
    if (['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-flowto'].includes(attribute)) {
      if (!value.trim()) {
        return { isValid: false, reason: 'ID reference cannot be empty' };
      }
      // Note: Full ID validation would require checking if referenced elements exist
      return { isValid: true };
    }

    // For text-based attributes
    if (['aria-label', 'aria-roledescription', 'aria-valuetext', 'aria-keyshortcuts', 'aria-placeholder'].includes(attribute)) {
      return value.trim() ? { isValid: true } : { isValid: false, reason: 'Text value cannot be empty' };
    }

    return { isValid: true }; // Default to valid for unknown attributes
  }

  /**
   * Get required ARIA attributes for a role
   */
  private getRequiredAriaAttributes(role: string): string[] {
    const requiredAttributes: Record<string, string[]> = {
      'checkbox': ['aria-checked'],
      'combobox': ['aria-expanded'],
      'grid': ['aria-rowcount', 'aria-colcount'],
      'progressbar': ['aria-valuenow'],
      'radio': ['aria-checked'],
      'scrollbar': ['aria-controls', 'aria-orientation', 'aria-valuemax', 'aria-valuemin', 'aria-valuenow'],
      'separator': ['aria-orientation'],
      'slider': ['aria-valuemax', 'aria-valuemin', 'aria-valuenow'],
      'spinbutton': ['aria-valuemax', 'aria-valuemin', 'aria-valuenow'],
      'switch': ['aria-checked'],
      'tab': ['aria-selected'],
      'tabpanel': ['aria-labelledby'],
      'treeitem': ['aria-selected']
    };

    return requiredAttributes[role] || [];
  }

  /**
   * Check role-specific constraints
   */
  private checkRoleSpecificConstraints(
    attribute: string, 
    value: string, 
    role: string, 
    tagName: string
  ): { isValid: boolean; reason?: string } {
    // Specific validation rules for common patterns
    if (role === 'combobox' && attribute === 'aria-expanded') {
      // Combobox should have aria-expanded
      return { isValid: true };
    }

    if (role === 'dialog' && attribute === 'aria-modal') {
      // Dialog with aria-modal should be properly implemented
      return { isValid: true };
    }

    if (role === 'button' && attribute === 'aria-pressed') {
      // Toggle buttons should use aria-pressed
      return { isValid: true };
    }

    // Check numeric range constraints
    if (['aria-valuemin', 'aria-valuemax', 'aria-valuenow'].includes(attribute)) {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return { isValid: false, reason: 'Numeric value required' };
      }
      
      // Additional range validation could be added here
      return { isValid: true };
    }

    return { isValid: true };
  }

  /**
   * Check if ARIA attribute is deprecated
   */
  private isDeprecatedAriaAttribute(attribute: string): boolean {
    const deprecatedAttributes = [
      'aria-dropeffect',
      'aria-grabbed'
    ];

    return deprecatedAttributes.includes(attribute);
  }

  /**
   * Get replacement for deprecated attribute
   */
  private getReplacementForDeprecatedAttribute(attribute: string): string {
    const replacements: Record<string, string> = {
      'aria-dropeffect': 'Use HTML5 drag and drop API',
      'aria-grabbed': 'Use HTML5 drag and drop API'
    };

    return replacements[attribute] || 'No direct replacement available';
  }

  /**
   * Generate ARIA recommendations
   */
  private generateAriaRecommendations(result: AriaValidationResult): string[] {
    const recommendations: string[] = [];

    if (result.invalidAttributes.length > 0) {
      recommendations.push(`Fix ${result.invalidAttributes.length} invalid ARIA attributes`);
    }

    if (result.missingRequiredAttributes.length > 0) {
      recommendations.push(`Add ${result.missingRequiredAttributes.length} missing required ARIA attributes`);
    }

    if (result.deprecatedAttributes.length > 0) {
      recommendations.push(`Replace ${result.deprecatedAttributes.length} deprecated ARIA attributes`);
    }

    // Add specific recommendations based on common patterns
    const rolesMissingLabels = result.missingRequiredAttributes
      .filter(missing => ['aria-label', 'aria-labelledby'].includes(missing.missingAttribute));
    
    if (rolesMissingLabels.length > 0) {
      recommendations.push('Ensure all interactive elements have accessible names');
    }

    const formControlsNeedingLabels = result.invalidAttributes
      .filter(invalid => invalid.element.match(/input|select|textarea/));
    
    if (formControlsNeedingLabels.length > 0) {
      recommendations.push('Associate form controls with proper labels');
    }

    return recommendations;
  }

  /**
   * Validate specific ARIA patterns
   */
  async validateAriaPatterns(): Promise<AriaPatternResult[]> {
    const patterns: AriaPatternResult[] = [];

    // Validate modal pattern
    const modalPattern = await this.validateModalPattern();
    if (modalPattern) patterns.push(modalPattern);

    // Validate combobox pattern
    const comboboxPattern = await this.validateComboboxPattern();
    if (comboboxPattern) patterns.push(comboboxPattern);

    // Validate tab pattern
    const tabPattern = await this.validateTabPattern();
    if (tabPattern) patterns.push(tabPattern);

    // Validate menu pattern
    const menuPattern = await this.validateMenuPattern();
    if (menuPattern) patterns.push(menuPattern);

    return patterns;
  }

  /**
   * Validate modal ARIA pattern
   */
  private async validateModalPattern(): Promise<AriaPatternResult | null> {
    const modals = await this.page.locator('[role="dialog"], [data-testid*="modal"]').all();
    
    if (modals.length === 0) return null;

    const result: AriaPatternResult = {
      pattern: 'modal',
      isValid: true,
      violations: [],
      recommendations: []
    };

    for (const modal of modals) {
      const modalInfo = await modal.evaluate(el => ({
        hasAriaModal: el.hasAttribute('aria-modal'),
        hasAriaLabelledBy: el.hasAttribute('aria-labelledby'),
        hasAriaLabel: el.hasAttribute('aria-label'),
        hasTabIndex: el.hasAttribute('tabindex'),
        hasCloseButton: !!el.querySelector('[data-testid*="close"], [aria-label*="close" i]')
      }));

      if (!modalInfo.hasAriaModal) {
        result.violations.push('Modal missing aria-modal="true"');
        result.isValid = false;
      }

      if (!modalInfo.hasAriaLabelledBy && !modalInfo.hasAriaLabel) {
        result.violations.push('Modal missing accessible name (aria-labelledby or aria-label)');
        result.isValid = false;
      }

      if (!modalInfo.hasTabIndex) {
        result.violations.push('Modal missing tabindex="-1" for focus management');
        result.isValid = false;
      }

      if (!modalInfo.hasCloseButton) {
        result.violations.push('Modal missing accessible close button');
        result.isValid = false;
      }
    }

    if (!result.isValid) {
      result.recommendations.push('Follow ARIA modal pattern specification');
      result.recommendations.push('Implement proper focus management and keyboard support');
    }

    return result;
  }

  /**
   * Validate combobox ARIA pattern
   */
  private async validateComboboxPattern(): Promise<AriaPatternResult | null> {
    const comboboxes = await this.page.locator('[role="combobox"]').all();
    
    if (comboboxes.length === 0) return null;

    const result: AriaPatternResult = {
      pattern: 'combobox',
      isValid: true,
      violations: [],
      recommendations: []
    };

    for (const combobox of comboboxes) {
      const comboboxInfo = await combobox.evaluate(el => ({
        hasAriaExpanded: el.hasAttribute('aria-expanded'),
        hasAriaHaspopup: el.hasAttribute('aria-haspopup'),
        hasAriaControls: el.hasAttribute('aria-controls'),
        ariaAutocomplete: el.getAttribute('aria-autocomplete')
      }));

      if (!comboboxInfo.hasAriaExpanded) {
        result.violations.push('Combobox missing aria-expanded attribute');
        result.isValid = false;
      }

      if (comboboxInfo.hasAriaHaspopup) {
        result.recommendations.push('Consider if aria-haspopup is needed for this combobox implementation');
      }
    }

    return result;
  }

  /**
   * Validate tab ARIA pattern
   */
  private async validateTabPattern(): Promise<AriaPatternResult | null> {
    const tabLists = await this.page.locator('[role="tablist"]').all();
    
    if (tabLists.length === 0) return null;

    const result: AriaPatternResult = {
      pattern: 'tabs',
      isValid: true,
      violations: [],
      recommendations: []
    };

    for (const tabList of tabLists) {
      const tabs = await tabList.locator('[role="tab"]').all();
      const tabPanels = await this.page.locator('[role="tabpanel"]').all();

      if (tabs.length === 0) {
        result.violations.push('Tablist contains no tabs');
        result.isValid = false;
      }

      if (tabPanels.length !== tabs.length) {
        result.violations.push('Number of tabs and tabpanels do not match');
        result.isValid = false;
      }

      // Check each tab
      for (const tab of tabs) {
        const tabInfo = await tab.evaluate(el => ({
          hasAriaSelected: el.hasAttribute('aria-selected'),
          hasAriaControls: el.hasAttribute('aria-controls'),
          isSelected: el.getAttribute('aria-selected') === 'true'
        }));

        if (!tabInfo.hasAriaSelected) {
          result.violations.push('Tab missing aria-selected attribute');
          result.isValid = false;
        }

        if (!tabInfo.hasAriaControls) {
          result.violations.push('Tab missing aria-controls attribute');
          result.isValid = false;
        }
      }
    }

    return result;
  }

  /**
   * Validate menu ARIA pattern
   */
  private async validateMenuPattern(): Promise<AriaPatternResult | null> {
    const menus = await this.page.locator('[role="menu"]').all();
    
    if (menus.length === 0) return null;

    const result: AriaPatternResult = {
      pattern: 'menu',
      isValid: true,
      violations: [],
      recommendations: []
    };

    for (const menu of menus) {
      const menuItems = await menu.locator('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]').all();

      if (menuItems.length === 0) {
        result.violations.push('Menu contains no menu items');
        result.isValid = false;
      }

      // Check keyboard navigation support
      const hasKeyboardSupport = await menu.evaluate(el => {
        return el.hasAttribute('tabindex') || el.querySelector('[tabindex]');
      });

      if (!hasKeyboardSupport) {
        result.violations.push('Menu lacks keyboard navigation support');
        result.isValid = false;
      }
    }

    return result;
  }
}

// Type definitions
export interface AriaValidationResult {
  validAttributes: AriaAttributeInfo[];
  invalidAttributes: AriaAttributeError[];
  missingRequiredAttributes: MissingAriaAttribute[];
  deprecatedAttributes: DeprecatedAriaAttribute[];
  recommendations: string[];
}

export interface AriaAttributeInfo {
  element: string;
  attribute: string;
  value: string;
  role?: string;
}

export interface AriaAttributeError extends AriaAttributeInfo {
  reason: string;
}

export interface MissingAriaAttribute {
  element: string;
  role: string;
  missingAttribute: string;
  reason: string;
}

export interface DeprecatedAriaAttribute {
  element: string;
  attribute: string;
  value: string;
  reason: string;
  replacement: string;
}

export interface AriaPatternResult {
  pattern: string;
  isValid: boolean;
  violations: string[];
  recommendations: string[];
}