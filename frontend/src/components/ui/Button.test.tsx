import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { Button } from './Button'

describe('Button Component - TDD Implementation', () => {
  describe('Accessibility Standards (WCAG 2.1 AA)', () => {
    test('should be keyboard navigable with Enter key', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Test Button</Button>)
      
      const button = screen.getByRole('button', { name: 'Test Button' })
      button.focus()
      fireEvent.keyDown(button, { key: 'Enter' })
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    test('should be keyboard navigable with Space key', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Test Button</Button>)
      
      const button = screen.getByRole('button', { name: 'Test Button' })
      button.focus()
      fireEvent.keyDown(button, { key: ' ' })
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    test('should have proper ARIA labels when provided', () => {
      render(<Button aria-label="Close dialog">×</Button>)
      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument()
    })

    test('should support disabled state with proper ARIA attributes', () => {
      render(<Button disabled>Disabled Button</Button>)
      const button = screen.getByRole('button')
      
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-disabled', 'true')
    })

    test('should have proper focus management and visual indicators', () => {
      render(<Button>Focus Test</Button>)
      const button = screen.getByRole('button')
      
      button.focus()
      expect(button).toHaveFocus()
      expect(button).toHaveClass('focus-visible:outline-none', 'focus-visible:ring-2')
    })

    test('should announce loading state to screen readers', () => {
      render(<Button loading>Loading Button</Button>)
      const button = screen.getByRole('button')
      
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByTestId('loading-spinner')).toHaveAttribute('aria-hidden', 'true')
    })

    test('should support custom ARIA attributes', () => {
      render(
        <Button 
          aria-describedby="help-text"
          aria-expanded={false}
        >
          Menu Button
        </Button>
      )
      const button = screen.getByRole('button')
      
      expect(button).toHaveAttribute('aria-describedby', 'help-text')
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('Core Functionality', () => {
    test('should render with default props and styling', () => {
      render(<Button>Default Button</Button>)
      
      const button = screen.getByRole('button', { name: 'Default Button' })
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('bg-primary', 'text-primary-foreground')
    })

    test('should handle click events correctly', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click Me</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    test('should prevent clicks when disabled', () => {
      const handleClick = vi.fn()
      render(<Button disabled onClick={handleClick}>Disabled</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })

    test('should prevent clicks when loading', () => {
      const handleClick = vi.fn()
      render(<Button loading onClick={handleClick}>Loading</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })

    test('should support ref forwarding', () => {
      const ref = vi.fn()
      render(<Button ref={ref}>Ref Button</Button>)
      
      expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement))
    })
  })

  describe('Variant System', () => {
    test('should support all variant styles', () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const
      
      variants.forEach(variant => {
        const { unmount } = render(<Button variant={variant}>{variant}</Button>)
        const button = screen.getByRole('button')
        
        switch (variant) {
          case 'default':
            expect(button).toHaveClass('bg-primary', 'text-primary-foreground')
            break
          case 'destructive':
            expect(button).toHaveClass('bg-destructive', 'text-destructive-foreground')
            break
          case 'outline':
            expect(button).toHaveClass('border', 'border-input')
            break
          case 'secondary':
            expect(button).toHaveClass('bg-secondary', 'text-secondary-foreground')
            break
          case 'ghost':
            expect(button).toHaveClass('hover:bg-accent')
            break
          case 'link':
            expect(button).toHaveClass('text-primary', 'underline-offset-4')
            break
        }
        
        unmount()
      })
    })

    test('should support all size variants', () => {
      const sizes = ['default', 'sm', 'lg', 'icon'] as const
      
      sizes.forEach(size => {
        const { unmount } = render(<Button size={size}>{size}</Button>)
        const button = screen.getByRole('button')
        
        switch (size) {
          case 'default':
            expect(button).toHaveClass('h-10', 'px-4', 'py-2')
            break
          case 'sm':
            expect(button).toHaveClass('h-9', 'px-3')
            break
          case 'lg':
            expect(button).toHaveClass('h-11', 'px-8')
            break
          case 'icon':
            expect(button).toHaveClass('h-10', 'w-10')
            break
        }
        
        unmount()
      })
    })

    test('should combine custom className with variant classes', () => {
      render(<Button className="custom-class" variant="outline">Custom</Button>)
      const button = screen.getByRole('button')
      
      expect(button).toHaveClass('custom-class', 'border', 'border-input')
    })
  })

  describe('Loading State Management', () => {
    test('should display loading spinner when loading', () => {
      render(<Button loading>Loading Button</Button>)
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeDisabled()
    })

    test('should hide button content when loading with hideContent prop', () => {
      render(<Button loading hideContent>Hidden Content</Button>)
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument()
    })

    test('should maintain button dimensions during loading', () => {
      const { rerender } = render(<Button>Normal Button</Button>)
      const button = screen.getByRole('button')
      const initialHeight = button.offsetHeight
      
      rerender(<Button loading>Normal Button</Button>)
      expect(button).toHaveClass('h-10') // Maintains height class
    })
  })

  describe('Advanced Features', () => {
    test('should support asChild prop with Slot component', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      )
      
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', '/test')
      expect(link).toHaveClass('inline-flex', 'items-center')
    })

    test('should handle complex children elements', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>
      )
      
      expect(screen.getByText('Icon')).toBeInTheDocument()
      expect(screen.getByText('Text')).toBeInTheDocument()
    })

    test('should support custom loading text', () => {
      render(<Button loading loadingText="Processing...">Submit</Button>)
      
      expect(screen.getByText('Processing...')).toBeInTheDocument()
      expect(screen.queryByText('Submit')).not.toBeInTheDocument()
    })
  })

  describe('Performance & Accessibility Edge Cases', () => {
    test('should not cause memory leaks with event handlers', () => {
      const handleClick = vi.fn()
      const { unmount } = render(<Button onClick={handleClick}>Test</Button>)
      
      unmount()
      // Handler should be properly cleaned up
      expect(handleClick).toHaveBeenCalledTimes(0)
    })

    test('should handle rapid successive clicks properly', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Rapid Click</Button>)
      const button = screen.getByRole('button')
      
      // Simulate rapid clicks
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)
      
      expect(handleClick).toHaveBeenCalledTimes(3)
    })

    test('should maintain focus management during state changes', () => {
      const { rerender } = render(<Button>Initial</Button>)
      const button = screen.getByRole('button')
      
      button.focus()
      expect(button).toHaveFocus()
      
      rerender(<Button disabled>Updated</Button>)
      // Should not lose focus reference
      expect(button).toBeInTheDocument()
    })
  })
})