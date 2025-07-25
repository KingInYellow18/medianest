import * as React from 'react'
import { createPortal } from 'react-dom'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const dialogContentVariants = cva(
  'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
  {
    variants: {
      size: {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-[95vw] max-h-[95vh]'
      }
    },
    defaultVariants: {
      size: 'md'
    }
  }
)

interface DialogContextType {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextType | null>(null)

function useDialog() {
  const context = React.useContext(DialogContext)
  if (!context) {
    throw new Error('Dialog components must be used within a Dialog')
  }
  return context
}

export interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  const [isOpen, setIsOpen] = React.useState(open)
  
  React.useEffect(() => {
    setIsOpen(open)
  }, [open])

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    setIsOpen(newOpen)
    onOpenChange?.(newOpen)
  }, [onOpenChange])

  const contextValue = React.useMemo(() => ({
    open: isOpen,
    onOpenChange: handleOpenChange
  }), [isOpen, handleOpenChange])

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
    </DialogContext.Provider>
  )
}

export interface DialogContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dialogContentVariants> {
  children: React.ReactNode
}

export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, size, children, ...props }, ref) => {
    const { open, onOpenChange } = useDialog()
    const [mounted, setMounted] = React.useState(false)
    const contentRef = React.useRef<HTMLDivElement>(null)
    const previousActiveElement = React.useRef<HTMLElement | null>(null)

    // Handle mounting for portal
    React.useEffect(() => {
      setMounted(true)
      return () => setMounted(false)
    }, [])

    // Focus management
    React.useEffect(() => {
      if (open) {
        previousActiveElement.current = document.activeElement as HTMLElement
        
        // Trap focus and set initial focus
        const timer = setTimeout(() => {
          const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
          )
          firstFocusable?.focus()
        }, 0)

        // Prevent body scroll
        document.body.style.overflow = 'hidden'

        return () => {
          clearTimeout(timer)
          document.body.style.overflow = ''
        }
      } else {
        // Restore focus when closing
        if (previousActiveElement.current) {
          previousActiveElement.current.focus()
        }
      }
    }, [open])

    // Handle escape key
    React.useEffect(() => {
      function handleEscape(event: KeyboardEvent) {
        if (event.key === 'Escape' && open) {
          onOpenChange(false)
        }
      }

      if (open) {
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
      }
    }, [open, onOpenChange])

    // Focus trap
    React.useEffect(() => {
      function handleTabKey(event: KeyboardEvent) {
        if (!open || event.key !== 'Tab' || !contentRef.current) return

        const focusableElements = contentRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        )

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault()
            lastElement?.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault()
            firstElement?.focus()
          }
        }
      }

      if (open) {
        document.addEventListener('keydown', handleTabKey)
        return () => document.removeEventListener('keydown', handleTabKey)
      }
    }, [open])

    if (!mounted || !open) return null

    const handleOverlayClick = (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        onOpenChange(false)
      }
    }

    const dialogContent = (
      <div className="fixed inset-0 z-50">
        <div
          className="fixed inset-0 bg-black/50 dialog-overlay"
          data-testid="dialog-overlay"
          onClick={handleOverlayClick}
        />
        <div
          ref={(node) => {
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
            contentRef.current = node
          }}
          role="dialog"
          aria-modal="true"
          className={cn(dialogContentVariants({ size }), size && `dialog-${size}`, className)}
          data-state={open ? 'open' : 'closed'}
          {...props}
        >
          {children}
        </div>
      </div>
    )

    return createPortal(dialogContent, document.body)
  }
)

DialogContent.displayName = 'DialogContent'

export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function DialogHeader({ className, children, ...props }: DialogHeaderProps) {
  return (
    <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props}>
      {children}
    </div>
  )
}

export interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode
}

export const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, children, ...props }, ref) => {
    const titleId = React.useId()
    
    React.useEffect(() => {
      // Set aria-labelledby on dialog
      const dialog = document.querySelector('[role="dialog"]')
      if (dialog && !dialog.getAttribute('aria-labelledby')) {
        dialog.setAttribute('aria-labelledby', props.id || titleId)
      }
    }, [props.id, titleId])

    return (
      <h2
        ref={ref}
        id={props.id || titleId}
        className={cn('text-lg font-semibold leading-none tracking-tight custom-title', className)}
        {...props}
      >
        {children}
      </h2>
    )
  }
)

DialogTitle.displayName = 'DialogTitle'

export interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode
}

export const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    const descriptionId = React.useId()
    
    React.useEffect(() => {
      // Set aria-describedby on dialog
      const dialog = document.querySelector('[role="dialog"]')
      if (dialog && !dialog.getAttribute('aria-describedby')) {
        dialog.setAttribute('aria-describedby', props.id || descriptionId)
      }
    }, [props.id, descriptionId])

    return (
      <p
        ref={ref}
        id={props.id || descriptionId}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
      >
        {children}
      </p>
    )
  }
)

DialogDescription.displayName = 'DialogDescription'

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function DialogFooter({ className, children, ...props }: DialogFooterProps) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 custom-footer', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode
  asChild?: boolean
}

export const DialogClose = React.forwardRef<HTMLButtonElement, DialogCloseProps>(
  ({ className, children, onClick, asChild = false, ...props }, ref) => {
    const { onOpenChange } = useDialog()

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      onOpenChange(false)
    }

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...children.props,
        onClick: handleClick,
        className: cn(children.props.className, className, 'custom-close')
      })
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        className={cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2',
          'custom-close',
          className
        )}
        {...props}
      >
        {children || 'Close'}
      </button>
    )
  }
)

DialogClose.displayName = 'DialogClose'