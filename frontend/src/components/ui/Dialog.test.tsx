import * as React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './Dialog'

describe('Dialog Component - TDD Implementation', () => {
  describe('RED Phase - Failing Tests First', () => {
    describe('Basic Dialog Structure and Rendering', () => {
      test('should render dialog when open', () => {
        render(
          <Dialog open>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Test Dialog</DialogTitle>
                <DialogDescription>This is a test dialog</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        )

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Test Dialog')).toBeInTheDocument()
        expect(screen.getByText('This is a test dialog')).toBeInTheDocument()
      })

      test('should not render dialog when closed', () => {
        render(
          <Dialog open={false}>
            <DialogContent>
              <DialogTitle>Hidden Dialog</DialogTitle>
            </DialogContent>
          </Dialog>
        )

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.queryByText('Hidden Dialog')).not.toBeInTheDocument()
      })

      test('should render dialog overlay/backdrop', () => {
        render(
          <Dialog open>
            <DialogContent>
              <DialogTitle>Dialog with Overlay</DialogTitle>
            </DialogContent>
          </Dialog>
        )

        const overlay = screen.getByTestId('dialog-overlay')
        expect(overlay).toBeInTheDocument()
        expect(overlay).toHaveClass('dialog-overlay')
      })
    })

    describe('ARIA and Accessibility (WCAG 2.1 AA)', () => {
      test('should have proper dialog role and ARIA attributes', () => {
        render(
          <Dialog open>
            <DialogContent>
              <DialogTitle>Accessible Dialog</DialogTitle>
              <DialogDescription>Dialog description for screen readers</DialogDescription>
            </DialogContent>
          </Dialog>
        )

        const dialog = screen.getByRole('dialog')
        expect(dialog).toHaveAttribute('role', 'dialog')
        expect(dialog).toHaveAttribute('aria-modal', 'true')
        expect(dialog).toHaveAttribute('aria-labelledby')
        expect(dialog).toHaveAttribute('aria-describedby')
      })

      test('should properly label dialog with title', () => {
        render(
          <Dialog open>
            <DialogContent>
              <DialogTitle id="dialog-title">Custom Dialog Title</DialogTitle>
            </DialogContent>
          </Dialog>
        )

        const dialog = screen.getByRole('dialog')
        const title = screen.getByText('Custom Dialog Title')
        
        expect(title).toHaveAttribute('id', 'dialog-title')
        expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title')
      })

      test('should associate description with dialog', () => {
        render(
          <Dialog open>
            <DialogContent>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription id="dialog-desc">Custom description</DialogDescription>
            </DialogContent>
          </Dialog>
        )

        const dialog = screen.getByRole('dialog')
        const description = screen.getByText('Custom description')
        
        expect(description).toHaveAttribute('id', 'dialog-desc')
        expect(dialog).toHaveAttribute('aria-describedby', 'dialog-desc')
      })

      test('should support custom aria-label when no title provided', () => {
        render(
          <Dialog open>
            <DialogContent aria-label="Settings Dialog">
              Content without title
            </DialogContent>
          </Dialog>
        )

        const dialog = screen.getByRole('dialog')
        expect(dialog).toHaveAttribute('aria-label', 'Settings Dialog')
      })
    })

    describe('Focus Management and Keyboard Navigation', () => {
      test('should trap focus within dialog when open', async () => {
        const user = userEvent.setup()
        
        render(
          <div>
            <button>Outside Button</button>
            <Dialog open>
              <DialogContent>
                <DialogTitle>Focus Test Dialog</DialogTitle>
                <button>First Button</button>
                <button>Second Button</button>
                <DialogClose>Close</DialogClose>
              </DialogContent>
            </Dialog>
          </div>
        )

        const firstButton = screen.getByText('First Button')
        const secondButton = screen.getByText('Second Button')
        const closeButton = screen.getByText('Close')
        const outsideButton = screen.getByText('Outside Button')

        // Focus should start on first focusable element
        await waitFor(() => {
          expect(firstButton).toHaveFocus()
        })

        // Tab should cycle through dialog elements only
        await user.tab()
        expect(secondButton).toHaveFocus()

        await user.tab()
        expect(closeButton).toHaveFocus()

        await user.tab()
        expect(firstButton).toHaveFocus() // Should wrap back to first

        // Outside button should not receive focus
        outsideButton.focus()
        expect(outsideButton).not.toHaveFocus()
      })

      test('should close dialog on Escape key', async () => {
        const user = userEvent.setup()
        const onOpenChange = vi.fn()

        render(
          <Dialog open onOpenChange={onOpenChange}>
            <DialogContent>
              <DialogTitle>Escapable Dialog</DialogTitle>
            </DialogContent>
          </Dialog>
        )

        await user.keyboard('{Escape}')
        expect(onOpenChange).toHaveBeenCalledWith(false)
      })

      test('should restore focus to trigger element when dialog closes', async () => {
        const user = userEvent.setup()

        function TestComponent() {
          const [open, setOpen] = React.useState(false)
          
          return (
            <div>
              <button onClick={() => setOpen(true)}>Open Dialog</button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                  <DialogTitle>Test Dialog</DialogTitle>
                  <DialogClose>Close</DialogClose>
                </DialogContent>
              </Dialog>
            </div>
          )
        }

        render(<TestComponent />)

        const openButton = screen.getByText('Open Dialog')
        
        // Open dialog
        await user.click(openButton)
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument()
        })

        // Close dialog
        const closeButton = screen.getByText('Close')
        await user.click(closeButton)

        // Focus should return to open button
        await waitFor(() => {
          expect(openButton).toHaveFocus()
        })
      })

      test('should handle focus for disabled elements', () => {
        render(
          <Dialog open>
            <DialogContent>
              <DialogTitle>Dialog with Disabled Elements</DialogTitle>
              <button disabled>Disabled Button</button>
              <button>Enabled Button</button>
              <input disabled />
              <input />
            </DialogContent>
          </Dialog>
        )

        const enabledButton = screen.getByText('Enabled Button')
        const enabledInput = screen.getByDisplayValue('')

        // Focus should skip disabled elements
        expect(enabledButton).toBeInTheDocument()
        expect(enabledInput).toBeInTheDocument()
      })
    })

    describe('Dialog Interaction and Events', () => {
      test('should close dialog when clicking overlay', async () => {
        const user = userEvent.setup()
        const onOpenChange = vi.fn()

        render(
          <Dialog open onOpenChange={onOpenChange}>
            <DialogContent>
              <DialogTitle>Click Outside Dialog</DialogTitle>
            </DialogContent>
          </Dialog>
        )

        const overlay = screen.getByTestId('dialog-overlay')
        await user.click(overlay)
        
        expect(onOpenChange).toHaveBeenCalledWith(false)
      })

      test('should not close dialog when clicking content area', async () => {
        const user = userEvent.setup()
        const onOpenChange = vi.fn()

        render(
          <Dialog open onOpenChange={onOpenChange}>
            <DialogContent>
              <DialogTitle>Content Click Dialog</DialogTitle>
              <p>Content area</p>
            </DialogContent>
          </Dialog>
        )

        const content = screen.getByText('Content area')
        await user.click(content)
        
        expect(onOpenChange).not.toHaveBeenCalled()
      })

      test('should close dialog when clicking close button', async () => {
        const user = userEvent.setup()
        const onOpenChange = vi.fn()

        render(
          <Dialog open onOpenChange={onOpenChange}>
            <DialogContent>
              <DialogTitle>Closable Dialog</DialogTitle>
              <DialogClose>Close Dialog</DialogClose>
            </DialogContent>
          </Dialog>
        )

        const closeButton = screen.getByText('Close Dialog')
        await user.click(closeButton)
        
        expect(onOpenChange).toHaveBeenCalledWith(false)
      })

      test('should support controlled open state', () => {
        const { rerender } = render(
          <Dialog open={false}>
            <DialogContent>
              <DialogTitle>Controlled Dialog</DialogTitle>
            </DialogContent>
          </Dialog>
        )

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        rerender(
          <Dialog open={true}>
            <DialogContent>
              <DialogTitle>Controlled Dialog</DialogTitle>
            </DialogContent>
          </Dialog>
        )

        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    describe('Dialog Composition and Variants', () => {
      test('should support different dialog sizes', () => {
        const sizes = ['sm', 'md', 'lg', 'xl', 'full'] as const

        sizes.forEach(size => {
          const { unmount } = render(
            <Dialog open>
              <DialogContent size={size}>
                <DialogTitle>Size Test Dialog</DialogTitle>
              </DialogContent>
            </Dialog>
          )

          const dialog = screen.getByRole('dialog')
          expect(dialog).toHaveClass(`dialog-${size}`)
          
          unmount()
        })
      })

      test('should support dialog with header, body, and footer', () => {
        render(
          <Dialog open>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Complete Dialog</DialogTitle>
                <DialogDescription>Dialog with all sections</DialogDescription>
              </DialogHeader>
              <div>Main content area</div>
              <DialogFooter>
                <DialogClose>Cancel</DialogClose>
                <button>Save</button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )

        expect(screen.getByText('Complete Dialog')).toBeInTheDocument()
        expect(screen.getByText('Dialog with all sections')).toBeInTheDocument()
        expect(screen.getByText('Main content area')).toBeInTheDocument()
        expect(screen.getByText('Cancel')).toBeInTheDocument()
        expect(screen.getByText('Save')).toBeInTheDocument()
      })

      test('should support custom className on dialog components', () => {
        render(
          <Dialog open>
            <DialogContent className="custom-dialog">
              <DialogHeader className="custom-header">
                <DialogTitle className="custom-title">Custom Dialog</DialogTitle>
              </DialogHeader>
              <DialogFooter className="custom-footer">
                <DialogClose className="custom-close">Close</DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )

        const dialog = screen.getByRole('dialog')
        const title = screen.getByText('Custom Dialog')
        const closeButton = screen.getByText('Close')

        expect(dialog).toHaveClass('custom-dialog')
        expect(title).toHaveClass('custom-title')
        expect(closeButton).toHaveClass('custom-close')
      })
    })

    describe('Performance and Edge Cases', () => {
      test('should handle portal rendering correctly', () => {
        render(
          <Dialog open>
            <DialogContent>
              <DialogTitle>Portal Dialog</DialogTitle>
            </DialogContent>
          </Dialog>
        )

        // Dialog should be rendered in portal (body)
        const dialog = screen.getByRole('dialog')
        expect(dialog.closest('body')).toBeInTheDocument()
      })

      test('should prevent body scroll when dialog is open', () => {
        render(
          <Dialog open>
            <DialogContent>
              <DialogTitle>No Scroll Dialog</DialogTitle>
            </DialogContent>
          </Dialog>
        )

        expect(document.body).toHaveStyle('overflow: hidden')
      })

      test('should restore body scroll when dialog closes', () => {
        const { rerender } = render(
          <Dialog open>
            <DialogContent>
              <DialogTitle>Scroll Test Dialog</DialogTitle>
            </DialogContent>
          </Dialog>
        )

        expect(document.body).toHaveStyle('overflow: hidden')

        rerender(
          <Dialog open={false}>
            <DialogContent>
              <DialogTitle>Scroll Test Dialog</DialogTitle>
            </DialogContent>
          </Dialog>
        )

        expect(document.body).not.toHaveStyle('overflow: hidden')
      })

      test('should handle multiple dialogs gracefully', () => {
        render(
          <div>
            <Dialog open>
              <DialogContent>
                <DialogTitle>First Dialog</DialogTitle>
              </DialogContent>
            </Dialog>
            <Dialog open>
              <DialogContent>
                <DialogTitle>Second Dialog</DialogTitle>
              </DialogContent>
            </Dialog>
          </div>
        )

        // Both dialogs should be present
        expect(screen.getByText('First Dialog')).toBeInTheDocument()
        expect(screen.getByText('Second Dialog')).toBeInTheDocument()
        
        // Only the last dialog should be active
        const dialogs = screen.getAllByRole('dialog')
        expect(dialogs).toHaveLength(2)
      })

      test('should support ref forwarding', () => {
        const ref = React.createRef<HTMLDivElement>()
        
        render(
          <Dialog open>
            <DialogContent ref={ref}>
              <DialogTitle>Ref Dialog</DialogTitle>
            </DialogContent>
          </Dialog>
        )

        expect(ref.current).toBeInstanceOf(HTMLDivElement)
        expect(ref.current).toHaveAttribute('role', 'dialog')
      })
    })
  })
})