import { vi } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import { configure } from '@testing-library/react';

// Extend Jest matchers with axe accessibility testing
expect.extend(toHaveNoViolations);

// Configure Testing Library for accessibility testing
configure({
  testIdAttribute: 'data-testid',
  // Enable better error messages for accessibility testing
  getElementError: (message, container) => {
    const error = new Error(
      [
        message,
        'Accessibility Testing Tip: Use semantic HTML elements and proper ARIA attributes',
        'Current DOM:',
        container.innerHTML.slice(0, 2000) + (container.innerHTML.length > 2000 ? '...' : '')
      ].join('\n\n')
    );
    error.name = 'TestingLibraryElementError';
    return error;
  }
});

// Global accessibility testing utilities
global.axeConfig = {
  rules: {
    // WCAG 2.1 AA compliance rules
    'color-contrast': { enabled: true },
    'keyboard-navigation': { enabled: true },
    'focus-management': { enabled: true },
    'aria-roles': { enabled: true },
    'aria-properties': { enabled: true },
    'semantic-markup': { enabled: true },
    'alternative-text': { enabled: true },
    'page-structure': { enabled: true }
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']
};

// Mock screen reader announcements for testing
global.mockScreenReader = {
  announcements: [] as string[],
  announce: vi.fn((message: string) => {
    global.mockScreenReader.announcements.push(message);
  }),
  clear: () => {
    global.mockScreenReader.announcements = [];
  }
};

// Enhanced accessibility testing helpers
global.a11yTestHelpers = {
  // Test keyboard navigation
  testKeyboardNavigation: async (element: HTMLElement) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    for (let i = 0; i < focusableElements.length; i++) {
      const el = focusableElements[i] as HTMLElement;
      el.focus();
      expect(el).toHaveFocus();
    }
  },
  
  // Test color contrast
  testColorContrast: (element: HTMLElement) => {
    const styles = window.getComputedStyle(element);
    const backgroundColor = styles.backgroundColor;
    const color = styles.color;
    
    // Note: This is a simplified check - real implementation would calculate contrast ratio
    expect(backgroundColor).not.toBe('transparent');
    expect(color).not.toBe('transparent');
  },
  
  // Test ARIA attributes
  testAriaAttributes: (element: HTMLElement, expectedAttributes: Record<string, string>) => {
    Object.entries(expectedAttributes).forEach(([attr, value]) => {
      expect(element).toHaveAttribute(attr, value);
    });
  }
};

// Mock high contrast mode detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => {
    const queries: Record<string, boolean> = {
      '(prefers-contrast: high)': false,
      '(prefers-reduced-motion: reduce)': false,
      '(prefers-color-scheme: dark)': false,
      '(forced-colors: active)': false
    };
    
    return {
      matches: queries[query] || false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  })
});

// Mock window.speechSynthesis for screen reader testing
Object.defineProperty(window, 'speechSynthesis', {
  writable: true,
  value: {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => []),
    speaking: false,
    pending: false,
    paused: false
  }
});

console.log('🔍 Accessibility testing setup complete - axe-core integration enabled');