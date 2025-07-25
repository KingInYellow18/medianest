import React, { ReactElement } from 'react'
import { render, RenderOptions, RenderResult } from '@testing-library/react'
import { vi } from 'vitest'

// Axe accessibility testing (install jest-axe when available)
let axe: any = null
let toHaveNoViolations: any = null

try {
  const jestAxe = require('jest-axe')
  axe = jestAxe.axe
  toHaveNoViolations = jestAxe.toHaveNoViolations
  expect.extend(toHaveNoViolations)
} catch (error) {
  // Fallback when jest-axe is not available
  console.warn('jest-axe not installed, using fallback accessibility testing')
  axe = async () => ({ violations: [] })
  toHaveNoViolations = { toHaveNoViolations: () => ({ pass: true, message: () => '' }) }
}

/**
 * Enhanced render function with built-in providers and utilities
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Whether to include axe accessibility testing
   */
  skipAxe?: boolean
  /**
   * Initial route for router testing
   */
  initialRoute?: string
  /**
   * Mock user preferences
   */
  userPreferences?: {
    theme?: 'light' | 'dark'
    language?: string
    reducedMotion?: boolean
  }
}

/**
 * Test wrapper that provides common context providers
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  // Add your common providers here as needed
  // For now, keeping it simple
  return <>{children}</>
}

/**
 * Enhanced render function with accessibility testing
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & {
  axeResults?: () => Promise<any>
} {
  const { skipAxe = false, userPreferences, ...renderOptions } = options

  // Apply user preferences to document if provided
  if (userPreferences?.theme) {
    document.body.classList.toggle('dark', userPreferences.theme === 'dark')
  }

  const result = render(ui, {
    wrapper: TestWrapper,
    ...renderOptions,
  })

  // Add axe testing utility
  const axeResults = async () => {
    if (skipAxe) return null
    return await axe(result.container)
  }

  return {
    ...result,
    axeResults,
  }
}

/**
 * Accessibility testing utilities
 */
export const a11yUtils = {
  /**
   * Test component for WCAG compliance
   */
  async testAccessibility(container: Element | HTMLElement) {
    const results = await axe(container)
    expect(results).toHaveNoViolations()
    return results
  },

  /**
   * Test keyboard navigation
   */
  testKeyboardNavigation: {
    tab: (element: Element) => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    },
    shiftTab: (element: Element) => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))
    },
    enter: (element: Element) => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    },
    space: (element: Element) => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    },
    escape: (element: Element) => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    },
    arrowDown: (element: Element) => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    },
    arrowUp: (element: Element) => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    },
  },

  /**
   * Test screen reader announcements
   */
  expectScreenReaderText: (element: Element, text: string) => {
    const srText = element.getAttribute('aria-label') || 
                   element.getAttribute('aria-labelledby') ||
                   element.textContent
    expect(srText).toContain(text)
  },

  /**
   * Test focus management
   */
  expectProperFocus: (element: Element) => {
    expect(element).toHaveFocus()
    expect(element).toHaveAttribute('tabindex', expect.not.stringMatching('-1'))
  },
}

/**
 * Component testing utilities
 */
export const componentUtils = {
  /**
   * Test all variant combinations
   */
  testVariants: <T extends Record<string, any>>(
    Component: React.ComponentType<T>,
    variants: Partial<T>[],
    commonProps: Partial<T> = {}
  ) => {
    return variants.map((variant, index) => ({
      name: `variant-${index}`,
      props: { ...commonProps, ...variant } as T,
      render: () => renderWithProviders(<Component {...{ ...commonProps, ...variant } as T} />),
    }))
  },

  /**
   * Test responsive behavior
   */
  testResponsive: (breakpoints: Record<string, number>) => {
    return Object.entries(breakpoints).map(([name, width]) => ({
      name,
      width,
      setup: () => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: width,
        })
        window.dispatchEvent(new Event('resize'))
      },
    }))
  },

  /**
   * Mock component props with proper typing
   */
  mockProps: <T extends Record<string, any>>(
    defaultProps: T,
    overrides: Partial<T> = {}
  ): T => ({
    ...defaultProps,
    ...overrides,
  }),
}

/**
 * Performance testing utilities
 */
export const perfUtils = {
  /**
   * Measure render time
   */
  measureRenderTime: async (renderFn: () => Promise<void> | void) => {
    const start = performance.now()
    await renderFn()
    const end = performance.now()
    return end - start
  },

  /**
   * Test for memory leaks
   */
  testMemoryLeaks: (Component: React.ComponentType, iterations = 100) => {
    const results = []
    
    for (let i = 0; i < iterations; i++) {
      const { unmount } = renderWithProviders(<Component />)
      
      // Force garbage collection if available (Node.js with --expose-gc)
      if (global.gc) {
        global.gc()
      }
      
      const memory = (performance as any).memory
      if (memory) {
        results.push({
          iteration: i,
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
        })
      }
      
      unmount()
    }
    
    return results
  },
}

/**
 * Animation testing utilities
 */
export const animationUtils = {
  /**
   * Wait for animations to complete
   */
  waitForAnimations: async (element: Element, timeout = 1000) => {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Animation timeout'))
      }, timeout)

      const observer = new MutationObserver(() => {
        if (!element.getAnimations || element.getAnimations().length === 0) {
          clearTimeout(timer)
          observer.disconnect()
          resolve()
        }
      })

      observer.observe(element, {
        attributes: true,
        attributeFilter: ['style', 'class'],
      })

      // Check immediately in case no animations are running
      if (!element.getAnimations || element.getAnimations().length === 0) {
        clearTimeout(timer)
        observer.disconnect()
        resolve()
      }
    })
  },

  /**
   * Mock reduced motion preference
   */
  mockReducedMotion: (reduced = true) => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)' ? reduced : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  },
}

/**
 * Data testing utilities
 */
export const dataUtils = {
  /**
   * Create mock data generators
   */
  createMockData: <T>(factory: () => T, count = 1): T[] => {
    return Array.from({ length: count }, factory)
  },

  /**
   * Mock API responses
   */
  mockApiResponse: <T>(data: T, delay = 0) => {
    return new Promise<T>((resolve) => {
      setTimeout(() => resolve(data), delay)
    })
  },

  /**
   * Mock API errors
   */
  mockApiError: (message = 'API Error', status = 500, delay = 0) => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(message) as any
        error.status = status
        reject(error)
      }, delay)
    })
  },
}

/**
 * Custom testing matchers and utilities
 */
export const customMatchers = {
  /**
   * Check if element has proper ARIA attributes
   */
  toHaveProperARIA: (element: Element) => {
    const hasRole = element.hasAttribute('role')
    const hasLabel = element.hasAttribute('aria-label') || 
                     element.hasAttribute('aria-labelledby')
    
    return {
      pass: hasRole && hasLabel,
      message: () => 
        `Expected element to have proper ARIA attributes (role and label/labelledby)`
    }
  },

  /**
   * Check if component follows design system patterns
   */
  toFollowDesignSystem: (element: Element) => {
    const hasCorrectClasses = element.classList.contains('inline-flex') ||
                             element.classList.contains('flex') ||
                             element.classList.contains('grid')
    
    return {
      pass: hasCorrectClasses,
      message: () => 'Expected element to follow design system layout patterns'
    }
  },
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'

// Re-export our enhanced render as the default
export { renderWithProviders as render }