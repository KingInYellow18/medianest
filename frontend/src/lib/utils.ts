import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to merge Tailwind CSS classes with proper conflict resolution
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Type-safe utility for creating variant-based component classes
 */
export function createVariants<T extends Record<string, any>>(variants: T) {
  return variants
}

/**
 * Accessibility utilities for enhanced user experience
 */
export const a11y = {
  /**
   * Creates accessible label attributes for screen readers
   */
  label: (label: string, describedBy?: string) => ({
    'aria-label': label,
    ...(describedBy && { 'aria-describedby': describedBy })
  }),

  /**
   * Creates proper loading state attributes
   */
  loading: (isLoading: boolean, label?: string) => ({
    'aria-busy': isLoading,
    'aria-live': 'polite' as const,
    ...(label && { 'aria-label': isLoading ? `Loading ${label}` : label })
  }),

  /**
   * Creates proper disabled state attributes
   */
  disabled: (isDisabled: boolean) => ({
    'aria-disabled': isDisabled,
    disabled: isDisabled
  })
}

/**
 * Performance utilities for optimized rendering
 */
export const perf = {
  /**
   * Creates stable references for event handlers
   */
  stableHandler: <T extends (...args: any[]) => any>(handler: T): T => {
    return handler
  },

  /**
   * Debounce utility for performance optimization
   */
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  }
}