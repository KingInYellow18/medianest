import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const progressVariants = cva(
  'relative h-2 w-full overflow-hidden rounded-full bg-secondary',
  {
    variants: {
      size: {
        sm: 'h-1',
        default: 'h-2',
        lg: 'h-3'
      }
    },
    defaultVariants: {
      size: 'default'
    }
  }
)

const progressIndicatorVariants = cva(
  'h-full w-full flex-1 transition-all duration-200 ease-in-out',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        success: 'bg-green-500',
        warning: 'bg-yellow-500',
        destructive: 'bg-destructive'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants> {
  value?: number | null
  min?: number
  max?: number
  variant?: VariantProps<typeof progressIndicatorVariants>['variant']
  striped?: boolean
  animated?: boolean
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ 
    className, 
    value, 
    min = 0, 
    max = 100, 
    size,
    variant = 'default',
    striped = false,
    animated = false,
    ...props 
  }, ref) => {
    // Handle value clamping and validation
    const clampedValue = value != null && !isNaN(value) 
      ? Math.min(Math.max(value, min), max) 
      : null

    // Calculate percentage for visual display
    const percentage = clampedValue != null 
      ? ((clampedValue - min) / (max - min)) * 100
      : 0

    // Handle indeterminate state
    const isIndeterminate = clampedValue == null

    // Check for reduced motion preference
    const prefersReducedMotion = typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false

    const shouldAnimate = animated && !prefersReducedMotion

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={clampedValue ?? undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        className={cn(
          progressVariants({ size }),
          isIndeterminate && 'progress-indeterminate',
          size && `progress-${size}`,
          className
        )}
        {...props}
      >
        <div
          data-testid="progress-indicator"
          className={cn(
            progressIndicatorVariants({ variant }),
            striped && 'progress-striped',
            shouldAnimate && 'progress-animated',
            variant && `progress-${variant}`,
            'origin-left'
          )}
          style={{
            transform: `translateX(-${100 - percentage}%)`
          }}
        />
      </div>
    )
  }
)

Progress.displayName = 'Progress'

export { Progress, progressVariants }