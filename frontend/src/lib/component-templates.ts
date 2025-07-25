/**
 * Component Templates for TDD Development
 * Provides standardized templates and patterns for consistent component development
 */

export const componentTemplates = {
  /**
   * Basic React component template with TypeScript
   */
  basicComponent: (componentName: string) => `import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ${componentName}Props extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
  variant?: 'default' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}

const ${componentName} = React.forwardRef<HTMLDivElement, ${componentName}Props>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center',
          // Variant styles
          {
            'bg-background text-foreground': variant === 'default',
            'bg-secondary text-secondary-foreground': variant === 'secondary',
          },
          // Size styles
          {
            'text-sm px-2 py-1': size === 'sm',
            'text-base px-4 py-2': size === 'md',
            'text-lg px-6 py-3': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

${componentName}.displayName = '${componentName}'

export { ${componentName} }`,

  /**
   * Component with Class Variance Authority (CVA)
   */
  cvaComponent: (componentName: string) => `import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const ${componentName.toLowerCase()}Variants = cva(
  // Base styles
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface ${componentName}Props
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof ${componentName.toLowerCase()}Variants> {
  children?: React.ReactNode
}

const ${componentName} = React.forwardRef<HTMLDivElement, ${componentName}Props>(
  ({ className, variant, size, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(${componentName.toLowerCase()}Variants({ variant, size, className }))}
        {...props}
      >
        {children}
      </div>
    )
  }
)

${componentName}.displayName = '${componentName}'

export { ${componentName}, ${componentName.toLowerCase()}Variants }`,

  /**
   * Comprehensive test file template
   */
  testTemplate: (componentName: string) => `import { render, screen, fireEvent } from '@/lib/test-utils'
import { vi } from 'vitest'
import { ${componentName} } from './${componentName}'

describe('${componentName} Component - TDD Implementation', () => {
  describe('Accessibility Standards (WCAG 2.1 AA)', () => {
    test('should pass axe accessibility tests', async () => {
      const { axeResults } = render(<${componentName}>Test Content</${componentName}>)
      const results = await axeResults!()
      expect(results).toHaveNoViolations()
    })

    test('should be keyboard navigable', () => {
      render(<${componentName}>Keyboard Test</${componentName}>)
      const element = screen.getByText('Keyboard Test')
      
      // Test Tab navigation
      element.focus()
      expect(element).toHaveFocus()
    })

    test('should have proper ARIA attributes', () => {
      render(<${componentName} aria-label="Test Label">Test</${componentName}>)
      expect(screen.getByLabelText('Test Label')).toBeInTheDocument()
    })

    test('should support screen reader announcements', () => {
      render(<${componentName} role="button" aria-describedby="desc">Action</${componentName}>)
      const element = screen.getByRole('button')
      
      expect(element).toHaveAttribute('aria-describedby', 'desc')
    })
  })

  describe('Core Functionality', () => {
    test('should render with default props', () => {
      render(<${componentName}>Default Test</${componentName}>)
      expect(screen.getByText('Default Test')).toBeInTheDocument()
    })

    test('should handle click events', () => {
      const handleClick = vi.fn()
      render(<${componentName} onClick={handleClick}>Clickable</${componentName}>)
      
      fireEvent.click(screen.getByText('Clickable'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    test('should support ref forwarding', () => {
      const ref = vi.fn()
      render(<${componentName} ref={ref}>Ref Test</${componentName}>)
      
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLElement))
    })

    test('should apply custom className', () => {
      render(<${componentName} className="custom-class">Custom</${componentName}>)
      const element = screen.getByText('Custom')
      
      expect(element).toHaveClass('custom-class')
    })
  })

  describe('Variant System', () => {
    test('should support default variant', () => {
      render(<${componentName} variant="default">Default Variant</${componentName}>)
      const element = screen.getByText('Default Variant')
      
      expect(element).toBeInTheDocument()
      // Add specific class assertions based on your variant system
    })

    test('should support secondary variant', () => {
      render(<${componentName} variant="secondary">Secondary Variant</${componentName}>)
      const element = screen.getByText('Secondary Variant')
      
      expect(element).toBeInTheDocument()
      // Add specific class assertions based on your variant system
    })

    test('should support size variants', () => {
      const sizes = ['sm', 'md', 'lg'] as const
      
      sizes.forEach(size => {
        const { unmount } = render(<${componentName} size={size}>{size}</${componentName}>)
        const element = screen.getByText(size)
        
        expect(element).toBeInTheDocument()
        // Add specific size class assertions
        
        unmount()
      })
    })
  })

  describe('Performance & Edge Cases', () => {
    test('should not cause memory leaks', () => {
      const { unmount } = render(<${componentName}>Memory Test</${componentName}>)
      
      unmount()
      // Component should be properly cleaned up
      expect(screen.queryByText('Memory Test')).not.toBeInTheDocument()
    })

    test('should handle rapid interactions', () => {
      const handleClick = vi.fn()
      render(<${componentName} onClick={handleClick}>Rapid Test</${componentName}>)
      const element = screen.getByText('Rapid Test')
      
      // Simulate rapid clicks
      fireEvent.click(element)
      fireEvent.click(element)
      fireEvent.click(element)
      
      expect(handleClick).toHaveBeenCalledTimes(3)
    })

    test('should maintain state during re-renders', () => {
      const { rerender } = render(<${componentName}>Initial</${componentName}>)
      
      rerender(<${componentName}>Updated</${componentName}>)
      expect(screen.getByText('Updated')).toBeInTheDocument()
    })
  })
})`,

  /**
   * Storybook story template
   */
  storyTemplate: (componentName: string) => `import type { Meta, StoryObj } from '@storybook/react'
import { ${componentName} } from './${componentName}'

const meta: Meta<typeof ${componentName}> = {
  title: 'Components/${componentName}',
  component: ${componentName},
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A modern, accessible ${componentName} component built with Tailwind CSS and shadcn/ui patterns.',
      },
    },
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'secondary'],
      description: 'The visual variant of the component',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'The size of the component',
    },
    children: {
      control: { type: 'text' },
      description: 'The content to display inside the component',
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Default ${componentName}',
    variant: 'default',
    size: 'md',
  },
}

export const Secondary: Story = {
  args: {
    children: 'Secondary ${componentName}',
    variant: 'secondary',
    size: 'md',
  },
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <${componentName} size="sm">Small</${componentName}>
      <${componentName} size="md">Medium</${componentName}>
      <${componentName} size="lg">Large</${componentName}>
    </div>
  ),
}

export const Variants: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <${componentName} variant="default">Default</${componentName}>
      <${componentName} variant="secondary">Secondary</${componentName}>
    </div>
  ),
}

export const Interactive: Story = {
  args: {
    children: 'Click me!',
    onClick: () => alert('${componentName} clicked!'),
  },
}

export const WithCustomStyling: Story = {
  args: {
    children: 'Custom Styled',
    className: 'border-2 border-dashed border-blue-500 bg-blue-50',
  },
}`,

  /**
   * Hook template for custom hooks
   */
  hookTemplate: (hookName: string) => `import { useState, useEffect, useCallback, useMemo } from 'react'

export interface ${hookName}Options {
  // Define options interface
}

export interface ${hookName}Return {
  // Define return interface
}

/**
 * Custom hook: ${hookName}
 * 
 * @param options Configuration options
 * @returns Hook return value
 */
export function ${hookName}(options: ${hookName}Options = {}): ${hookName}Return {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const memoizedValue = useMemo(() => {
    // Compute expensive values here
    return state
  }, [state])

  const handleAction = useCallback(() => {
    // Handle actions here
  }, [])

  useEffect(() => {
    // Side effects here
  }, [])

  return {
    state,
    loading,
    error,
    memoizedValue,
    handleAction,
  }
}`,

  /**
   * Hook test template
   */
  hookTestTemplate: (hookName: string) => `import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { ${hookName} } from './${hookName}'

describe('${hookName} Hook - TDD Implementation', () => {
  test('should initialize with default values', () => {
    const { result } = renderHook(() => ${hookName}())
    
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  test('should handle state updates', () => {
    const { result } = renderHook(() => ${hookName}())
    
    act(() => {
      result.current.handleAction()
    })
    
    // Add assertions based on expected behavior
  })

  test('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => ${hookName}())
    
    unmount()
    
    // Verify cleanup behavior
  })

  test('should handle options changes', () => {
    const { result, rerender } = renderHook(
      ({ options }) => ${hookName}(options),
      {
        initialProps: { options: {} }
      }
    )
    
    rerender({ options: { /* new options */ } })
    
    // Verify options handling
  })
})`,
}

/**
 * Utility function to generate component files
 */
export function generateComponentFiles(componentName: string, template: keyof typeof componentTemplates) {
  return componentTemplates[template](componentName)
}

/**
 * TDD Development Workflow Templates
 */
export const tddWorkflow = {
  /**
   * Red-Green-Refactor cycle template
   */
  redGreenRefactor: `
// TDD Red-Green-Refactor Cycle

// 1. RED: Write a failing test first
test('should [describe expected behavior]', () => {
  // Arrange
  const props = { /* test props */ }
  
  // Act
  render(<Component {...props} />)
  
  // Assert - This should fail initially
  expect(screen.getByRole('button')).toBeInTheDocument()
})

// 2. GREEN: Write minimal code to make test pass
const Component = (props) => {
  return <button>Minimal implementation</button>
}

// 3. REFACTOR: Improve code while keeping tests green
const Component = React.forwardRef((props, ref) => {
  return (
    <button
      ref={ref}
      className="improved-styling"
      {...props}
    >
      {props.children}
    </button>
  )
})
`,

  /**
   * Accessibility-first development template
   */
  accessibilityFirst: `
// Accessibility-First TDD Approach

// 1. Start with accessibility tests
test('should be accessible to screen readers', async () => {
  const { container } = render(<Component />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})

// 2. Test keyboard navigation
test('should support keyboard navigation', () => {
  render(<Component />)
  const element = screen.getByRole('button')
  
  fireEvent.keyDown(element, { key: 'Enter' })
  expect(element).toHaveFocus()
})

// 3. Test ARIA attributes
test('should have proper ARIA labels', () => {
  render(<Component aria-label="Action button" />)
  expect(screen.getByLabelText('Action button')).toBeInTheDocument()
})
`,

  /**
   * Performance-focused development template
   */
  performanceFocused: `
// Performance-Focused TDD Approach

// 1. Test render performance
test('should render efficiently', async () => {
  const renderTime = await perfUtils.measureRenderTime(() => {
    render(<Component />)
  })
  
  expect(renderTime).toBeLessThan(16) // 60fps threshold
})

// 2. Test memory management
test('should not cause memory leaks', () => {
  const results = perfUtils.testMemoryLeaks(Component, 50)
  const memoryGrowth = results[results.length - 1].usedJSHeapSize - results[0].usedJSHeapSize
  
  expect(memoryGrowth).toBeLessThan(1024 * 1024) // Less than 1MB growth
})

// 3. Test efficient re-renders
test('should minimize re-renders', () => {
  const renderSpy = vi.fn()
  const TestComponent = () => {
    renderSpy()
    return <Component />
  }
  
  const { rerender } = render(<TestComponent />)
  rerender(<TestComponent />)
  
  expect(renderSpy).toHaveBeenCalledTimes(2) // Only expected renders
})
`,
}

export default componentTemplates