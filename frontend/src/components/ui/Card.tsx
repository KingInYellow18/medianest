import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva(
  'rounded-lg border bg-card text-card-foreground shadow-sm card',
  {
    variants: {
      variant: {
        default: 'border-border',
        outlined: 'border-2 border-border',
        elevated: 'shadow-lg border-0',
        ghost: 'border-0 shadow-none bg-transparent'
      },
      size: {
        sm: 'p-3',
        md: 'p-6',
        lg: 'p-8'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof cardVariants> {
  children: React.ReactNode
  hover?: boolean
  disabled?: boolean
}

export const Card = React.forwardRef<HTMLElement, CardProps>(
  ({ className, variant, size, hover, disabled, children, onClick, onKeyDown, ...props }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
      if (disabled) {
        event.preventDefault()
        return
      }
      onClick?.(event)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
      if (disabled) {
        event.preventDefault()
        return
      }
      
      if (onClick && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        onClick(event as any)
      }
      
      onKeyDown?.(event)
    }

    return (
      <article
        ref={ref}
        className={cn(
          cardVariants({ variant, size }),
          hover && 'card-hover transition-colors hover:bg-muted/50',
          variant && `card-${variant}`,
          size && `card-${size}`,
          disabled && 'opacity-50 cursor-not-allowed',
          onClick && !disabled && 'cursor-pointer',
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-disabled={disabled}
        {...props}
      >
        {children}
      </article>
    )
  }
)

Card.displayName = 'Card'

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props}>
      {children}
    </div>
  )
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, as: Component = 'h3', ...props }, ref) => {
    const titleId = React.useId()
    const descriptionId = `${titleId}-description`

    // Find if there's a CardDescription sibling to associate with
    const [hasDescription, setHasDescription] = React.useState(false)

    React.useEffect(() => {
      const parentElement = ref && 'current' in ref ? ref.current?.parentElement : null
      if (parentElement) {
        const description = parentElement.querySelector(`#${descriptionId}`)
        setHasDescription(!!description)
      }
    }, [descriptionId, ref])

    return (
      <Component
        ref={ref}
        id={props.id || titleId}
        className={cn('text-2xl font-semibold leading-none tracking-tight custom-title', className)}
        aria-describedby={hasDescription ? descriptionId : undefined}
        {...props}
      >
        {children}
      </Component>
    )
  }
)

CardTitle.displayName = 'CardTitle'

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode
}

export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    const descriptionId = React.useId()

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

CardDescription.displayName = 'CardDescription'

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cn('p-6 pt-0', className)} {...props}>
      {children}
    </div>
  )
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div className={cn('flex items-center p-6 pt-0', className)} {...props}>
      {children}
    </div>
  )
}