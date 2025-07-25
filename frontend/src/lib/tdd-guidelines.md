# TDD Guidelines for MediaNest UI Modernization

## Overview

This document outlines the Test-Driven Development (TDD) approach for modernizing the MediaNest UI components using shadcn/ui, Tailwind CSS v4, and comprehensive accessibility testing.

## Foundation Setup ✅

### Current Infrastructure

- **Testing Framework**: Vitest with jsdom environment
- **UI Library**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS v4 with CSS layers
- **Accessibility**: axe-core integration for automated a11y testing
- **Component System**: CVA (Class Variance Authority) for variant management

### Key Files

- `test-setup.ts`: Enhanced test environment with comprehensive mocks
- `frontend/src/lib/test-utils.tsx`: Custom testing utilities with accessibility helpers
- `frontend/src/lib/component-templates.ts`: Standardized component and test templates
- `vitest.config.ts`: Configured with path aliases and coverage

## TDD Workflow

### 1. Red-Green-Refactor Cycle

```typescript
// RED: Write failing test first
test('should render button with primary variant', () => {
  render(<Button variant="primary">Click me</Button>)
  expect(screen.getByRole('button')).toHaveClass('bg-primary')
})

// GREEN: Minimal implementation
const Button = ({ variant, children }) => (
  <button className={variant === 'primary' ? 'bg-primary' : ''}>
    {children}
  </button>
)

// REFACTOR: Improve while keeping tests green
const Button = React.forwardRef(({ variant = 'default', ...props }, ref) => (
  <button
    ref={ref}
    className={cn(buttonVariants({ variant }))}
    {...props}
  />
))
```

### 2. Accessibility-First Development

Every component must start with accessibility tests:

```typescript
describe('Accessibility Standards (WCAG 2.1 AA)', () => {
  test('should pass axe accessibility tests', async () => {
    const { axeResults } =  render(<Component />)
    const results = await axeResults!()
    expect(results).toHaveNoViolations()
  })

  test('should be keyboard navigable', () => {
    render(<Component />)
    const element = screen.getByRole('button')
    
    fireEvent.keyDown(element, { key: 'Enter' })
    expect(handleClick).toHaveBeenCalled()
  })

  test('should have proper ARIA attributes', () => {
    render(<Component aria-label="Close dialog" />)
    expect(screen.getByLabelText('Close dialog')).toBeInTheDocument()
  })
})
```

### 3. Component Development Process

1. **Start with Tests**: Write accessibility and functionality tests first
2. **Minimal Implementation**: Create the simplest code to pass tests
3. **Styling & Variants**: Add Tailwind classes and CVA variants
4. **Performance**: Test render performance and memory usage
5. **Documentation**: Create Storybook stories and update docs

## Testing Utilities

### Enhanced Test Utils

```typescript
import { render, a11yUtils, componentUtils } from '@/lib/test-utils'

// Accessibility testing
await a11yUtils.testAccessibility(container)
a11yUtils.testKeyboardNavigation.enter(element)
a11yUtils.expectScreenReaderText(element, 'Expected text')

// Component testing
const variants = componentUtils.testVariants(Button, [
  { variant: 'primary' },
  { variant: 'secondary' }
])

// Performance testing
const renderTime = await perfUtils.measureRenderTime(() => {
  render(<Component />)
})
```

### Test Categories

1. **Accessibility Tests** - WCAG 2.1 AA compliance
2. **Functionality Tests** - Core behavior and interactions
3. **Variant Tests** - All visual variants and sizes
4. **Performance Tests** - Render time and memory usage
5. **Edge Case Tests** - Error states and boundary conditions

## Component Standards

### File Structure

```
src/components/ui/
├── Button/
│   ├── Button.tsx          # Component implementation
│   ├── Button.test.tsx     # Comprehensive tests
│   ├── Button.stories.tsx  # Storybook documentation
│   └── index.ts           # Re-exports
```

### Implementation Pattern

```typescript
// 1. Imports and types
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn, a11y } from '@/lib/utils'

// 2. Variant system with CVA
const componentVariants = cva(
  // Base classes
  'base-classes-here',
  {
    variants: {
      variant: {
        default: 'default-classes',
        secondary: 'secondary-classes',
      },
      size: {
        sm: 'small-classes',
        md: 'medium-classes',
        lg: 'large-classes',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

// 3. Props interface
export interface ComponentProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof componentVariants> {
  // Additional props
}

// 4. Component implementation
const Component = React.forwardRef<
  HTMLElement,
  ComponentProps
>(({ className, variant, size, ...props }, ref) => {
  return (
    <element
      ref={ref}
      className={cn(componentVariants({ variant, size, className }))}
      {...a11y.disabled(props.disabled)}
      {...props}
    />
  )
})

Component.displayName = 'Component'

export { Component, componentVariants }
```

## Quality Gates

### Pre-Commit Checks

- All tests must pass
- 100% accessibility test coverage
- No console warnings or errors
- Proper TypeScript types
- Consistent styling patterns

### Component Checklist

- [ ] Accessibility tests with axe-core
- [ ] Keyboard navigation support
- [ ] ARIA attributes and roles
- [ ] Screen reader compatibility
- [ ] Focus management
- [ ] All variants tested
- [ ] Performance benchmarks
- [ ] Storybook documentation
- [ ] TypeScript coverage
- [ ] Mobile responsive

## Performance Standards

- Render time < 16ms (60fps)
- Memory growth < 1MB per 100 renders
- Bundle size impact minimal
- Tree-shaking compatible
- No memory leaks

## Accessibility Requirements

- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- Focus management
- Color contrast ratios
- Reduced motion support
- High contrast mode

## Next Steps

1. Apply this TDD approach to all existing components
2. Create comprehensive test suites for YouTube components
3. Modernize styling with Tailwind v4 patterns
4. Implement performance monitoring
5. Set up automated accessibility testing in CI/CD

## Tools and Resources

- **Testing**: Vitest, Testing Library, axe-core
- **Styling**: Tailwind CSS v4, CVA, clsx
- **Components**: Radix UI, Lucide React
- **Documentation**: Storybook, TypeScript
- **Quality**: ESLint, Prettier, Husky

This foundation provides a solid base for building modern, accessible, and well-tested UI components following industry best practices.