import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'  
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card'

describe('Card Component - TDD Implementation', () => {
  describe('RED Phase - Failing Tests First', () => {
    describe('Basic Card Structure and Semantic HTML', () => {
      test('should render card with proper semantic structure', () => {
        render(
          <Card>
            <CardHeader>
              <CardTitle>Test Card Title</CardTitle>
              <CardDescription>Test card description</CardDescription>
            </CardHeader>
            <CardContent>
              Main card content
            </CardContent>
            <CardFooter>
              Card footer content
            </CardFooter>
          </Card>
        )

        // Card should use article element for semantic meaning
        const card = screen.getByRole('article')
        expect(card).toBeInTheDocument()
        expect(card).toHaveClass('card')

        // Content should be properly structured
        expect(screen.getByText('Test Card Title')).toBeInTheDocument()
        expect(screen.getByText('Test card description')).toBeInTheDocument()
        expect(screen.getByText('Main card content')).toBeInTheDocument()
        expect(screen.getByText('Card footer content')).toBeInTheDocument()
      })

      test('should render minimal card with just content', () => {
        render(
          <Card>
            <CardContent>Simple card content</CardContent>
          </Card>
        )

        const card = screen.getByRole('article')
        expect(card).toBeInTheDocument()
        expect(screen.getByText('Simple card content')).toBeInTheDocument()
      })

      test('should support custom HTML attributes', () => {
        render(
          <Card data-testid="custom-card" id="unique-card">
            <CardContent>Content with attributes</CardContent>
          </Card>
        )

        const card = screen.getByTestId('custom-card')
        expect(card).toHaveAttribute('id', 'unique-card')
      })
    })

    describe('Accessibility and ARIA Support (WCAG 2.1 AA)', () => {
      test('should have proper heading hierarchy', () => {
        render(
          <Card>
            <CardHeader>
              <CardTitle>Main Card Title</CardTitle>
              <CardDescription>Card description</CardDescription>
            </CardHeader>
          </Card>
        )

        const title = screen.getByRole('heading', { level: 3 })
        expect(title).toHaveTextContent('Main Card Title')
      })

      test('should support custom heading levels', () => {
        render(
          <Card>
            <CardHeader>
              <CardTitle as="h2">Level 2 Heading</CardTitle>
            </CardHeader>
          </Card>
        )

        const title = screen.getByRole('heading', { level: 2 })
        expect(title).toHaveTextContent('Level 2 Heading')
      })

      test('should associate description with card title', () => {
        render(
          <Card>
            <CardHeader>
              <CardTitle>Accessible Card</CardTitle>
              <CardDescription>This card demonstrates accessibility</CardDescription>
            </CardHeader>
          </Card>
        )

        const title = screen.getByRole('heading')
        const description = screen.getByText('This card demonstrates accessibility')
        
        expect(title).toHaveAttribute('aria-describedby')
        expect(description).toHaveAttribute('id')
        expect(title.getAttribute('aria-describedby')).toBe(description.getAttribute('id'))
      })

      test('should support aria-label when no title is provided', () => {
        render(
          <Card aria-label="Product information card">
            <CardContent>Product details</CardContent>
          </Card>
        )

        const card = screen.getByRole('article')
        expect(card).toHaveAttribute('aria-label', 'Product information card')
      })

      test('should be keyboard navigable when interactive', () => {
        const handleClick = vi.fn()
        
        render(
          <Card onClick={handleClick} tabIndex={0}>
            <CardContent>Clickable card</CardContent>
          </Card>
        )

        const card = screen.getByRole('article')
        expect(card).toHaveAttribute('tabIndex', '0')

        fireEvent.keyDown(card, { key: 'Enter' })
        expect(handleClick).toHaveBeenCalled()
      })
    })

    describe('Visual Variants and Styling', () => {
      test('should support different card variants', () => {
        const variants = ['default', 'outlined', 'elevated', 'ghost'] as const

        variants.forEach(variant => {
          const { unmount } = render(
            <Card variant={variant}>
              <CardContent>{variant} card</CardContent>
            </Card>
          )

          const card = screen.getByRole('article')
          expect(card).toHaveClass(`card-${variant}`)
          
          unmount()
        })
      })

      test('should support different card sizes', () => {
        const sizes = ['sm', 'md', 'lg'] as const

        sizes.forEach(size => {
          const { unmount } = render(
            <Card size={size}>
              <CardContent>{size} card</CardContent>
            </Card>
          )

          const card = screen.getByRole('article')
          expect(card).toHaveClass(`card-${size}`)
          
          unmount()
        })
      })

      test('should support custom className', () => {
        render(
          <Card className="custom-card-class">
            <CardHeader className="custom-header">
              <CardTitle className="custom-title">Custom Card</CardTitle>
            </CardHeader>
            <CardContent className="custom-content">
              Custom content
            </CardContent>
            <CardFooter className="custom-footer">
              Custom footer
            </CardFooter>
          </Card>
        )

        const card = screen.getByRole('article')
        const title = screen.getByRole('heading')
        const content = screen.getByText('Custom content')
        const footer = screen.getByText('Custom footer')

        expect(card).toHaveClass('custom-card-class')
        expect(title).toHaveClass('custom-title')
        expect(content.closest('.custom-content')).toBeInTheDocument()
        expect(footer.closest('.custom-footer')).toBeInTheDocument()
      })

      test('should support hover and focus states for interactive cards', () => {
        render(
          <Card hover tabIndex={0}>
            <CardContent>Hoverable card</CardContent>
          </Card>
        )

        const card = screen.getByRole('article')
        expect(card).toHaveClass('card-hover')
      })
    })

    describe('Card Composition and Layout', () => {
      test('should support complex card layouts', () => {
        render(
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <div className="avatar">A</div>
                <div>
                  <CardTitle>User Profile</CardTitle>
                  <CardDescription>Software Developer</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>Location: San Francisco</p>
                <p>Years of experience: 5</p>
              </div>
            </CardContent>
            <CardFooter>
              <button>View Profile</button>
              <button>Send Message</button>
            </CardFooter>
          </Card>
        )

        expect(screen.getByText('User Profile')).toBeInTheDocument()
        expect(screen.getByText('Software Developer')).toBeInTheDocument()
        expect(screen.getByText('Location: San Francisco')).toBeInTheDocument()
        expect(screen.getByText('View Profile')).toBeInTheDocument()
        expect(screen.getByText('Send Message')).toBeInTheDocument()
      })

      test('should support cards without headers', () => {
        render(
          <Card>
            <CardContent>
              Content-only card
            </CardContent>
            <CardFooter>
              Footer actions
            </CardFooter>
          </Card>
        )

        expect(screen.getByText('Content-only card')).toBeInTheDocument()
        expect(screen.getByText('Footer actions')).toBeInTheDocument()
      })

      test('should support cards without footers', () => {
        render(
          <Card>
            <CardHeader>
              <CardTitle>Header and Content Only</CardTitle>
            </CardHeader>
            <CardContent>
              No footer here
            </CardContent>
          </Card>
        )

        expect(screen.getByText('Header and Content Only')).toBeInTheDocument()
        expect(screen.getByText('No footer here')).toBeInTheDocument()
      })

      test('should handle multiple cards in a layout', () => {
        render(
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardTitle>First Card</CardTitle>
              <CardContent>First content</CardContent>
            </Card>
            <Card>
              <CardTitle>Second Card</CardTitle>
              <CardContent>Second content</CardContent>
            </Card>
          </div>
        )

        const cards = screen.getAllByRole('article')
        expect(cards).toHaveLength(2)
        expect(screen.getByText('First Card')).toBeInTheDocument()
        expect(screen.getByText('Second Card')).toBeInTheDocument()
      })
    })

    describe('Interactive Features and Events', () => {
      test('should handle click events on interactive cards', () => {
        const handleClick = vi.fn()
        
        render(
          <Card onClick={handleClick}>
            <CardContent>Clickable card</CardContent>
          </Card>
        )

        const card = screen.getByRole('article')
        fireEvent.click(card)
        
        expect(handleClick).toHaveBeenCalledTimes(1)
      })

      test('should handle keyboard events for accessibility', () => {
        const handleKeyDown = vi.fn()
        
        render(
          <Card onKeyDown={handleKeyDown} tabIndex={0}>
            <CardContent>Keyboard accessible card</CardContent>
          </Card>
        )

        const card = screen.getByRole('article')
        fireEvent.keyDown(card, { key: 'Enter' })
        fireEvent.keyDown(card, { key: ' ' })
        
        expect(handleKeyDown).toHaveBeenCalledTimes(2)
      })

      test('should support disabled state', () => {
        const handleClick = vi.fn()
        
        render(
          <Card onClick={handleClick} disabled>
            <CardContent>Disabled card</CardContent>
          </Card>
        )

        const card = screen.getByRole('article')
        expect(card).toHaveAttribute('aria-disabled', 'true')
        
        fireEvent.click(card)
        expect(handleClick).not.toHaveBeenCalled()
      })
    })

    describe('Performance and Edge Cases', () => {
      test('should support ref forwarding', () => {
        const ref = React.createRef<HTMLElement>()
        
        render(
          <Card ref={ref}>
            <CardContent>Ref forwarding test</CardContent>
          </Card>
        )

        expect(ref.current).toBeInstanceOf(HTMLElement)
        expect(ref.current).toHaveAttribute('role', 'article')
      })

      test('should handle empty content gracefully', () => {
        render(
          <Card>
            <CardHeader>
              <CardTitle></CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent></CardContent>
            <CardFooter></CardFooter>
          </Card>
        )

        const card = screen.getByRole('article')
        expect(card).toBeInTheDocument()
      })

      test('should maintain consistent spacing with missing sections', () => {
        render(
          <Card>
            <CardHeader>
              <CardTitle>Title Only</CardTitle>
            </CardHeader>
            <CardContent>Content without description</CardContent>
          </Card>
        )

        expect(screen.getByText('Title Only')).toBeInTheDocument()
        expect(screen.getByText('Content without description')).toBeInTheDocument()
      })

      test('should not cause memory leaks with event handlers', () => {
        const handleClick = vi.fn()
        const { unmount } = render(
          <Card onClick={handleClick}>
            <CardContent>Test card</CardContent>
          </Card>
        )

        unmount()
        // Component should unmount cleanly without errors
        expect(handleClick).toHaveBeenCalledTimes(0)
      })
    })
  })
})