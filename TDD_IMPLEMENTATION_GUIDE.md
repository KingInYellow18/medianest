# 🧪 Test-Driven Development Implementation Guide
## Modern Library Integration for MediaNest UI Modernization

### 📋 Overview

This guide provides a comprehensive test-first development approach for implementing modern UI libraries (Tailwind v4, shadcn/ui, Radix UI) in the MediaNest project. Our TDD methodology ensures robust, accessible, and performant components.

---

## 🎯 Current Project Analysis

### ✅ Strong Foundation
- **Framework**: Next.js 15.4.3 + React 19.1.0
- **Testing**: Vitest + @testing-library/react + Playwright
- **TypeScript**: Comprehensive type safety
- **Component Architecture**: Well-structured with separation of concerns
- **Storybook**: Component documentation and testing

### ⚠️ Critical Gaps
- Missing Tailwind CSS configuration
- No design system infrastructure
- Limited accessibility implementation
- Missing modern UI component library

---

## 🔬 TDD Workflow Design

### Phase 1: Test-First Component Development

#### 1.1 Pre-Implementation Testing Strategy

```typescript
// Test Structure Template
describe('Component Name', () => {
  // Accessibility Tests (WCAG 2.1 AA)
  describe('Accessibility', () => {
    test('should be keyboard navigable')
    test('should have proper ARIA labels')
    test('should support screen readers')
    test('should meet color contrast requirements')
  })

  // Functionality Tests
  describe('Functionality', () => {
    test('should render with default props')
    test('should handle user interactions')
    test('should validate input/output')
    test('should manage state correctly')
  })

  // Visual Tests
  describe('Visual Rendering', () => {
    test('should render correct styles')
    test('should be responsive')
    test('should handle dark/light themes')
    test('should match design system tokens')
  })

  // Performance Tests
  describe('Performance', () => {
    test('should not cause unnecessary re-renders')
    test('should handle large datasets efficiently')
    test('should lazy load when appropriate')
  })
})
```

#### 1.2 Component Development Cycle

**Step 1: Write Failing Tests**
```bash
# Create test file first
touch src/components/ui/Button.test.tsx
# Write comprehensive test cases
# Run tests - they should fail
npm test Button.test.tsx
```

**Step 2: Implement Minimal Code**
```typescript
// Implement just enough code to make tests pass
export function Button({ children, ...props }: ButtonProps) {
  return <button {...props}>{children}</button>
}
```

**Step 3: Refactor with Modern Libraries**
```typescript
// Enhance with Tailwind v4 + Radix UI
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'underline-offset-4 hover:underline text-primary'
      },
      size: {
        default: 'h-10 py-2 px-4',
        sm: 'h-9 px-3 rounded-md',
        lg: 'h-11 px-8 rounded-md',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)
```

---

## 🚀 Modern Library Integration Plan

### Phase 2: Tailwind CSS v4 Setup

#### 2.1 Installation & Configuration

```bash
# Install Tailwind v4 (July 2025 features)
npm install tailwindcss@4.0.0-alpha.36 @tailwindcss/typography @tailwindcss/forms @tailwindcss/aspect-ratio

# Create configuration with Oxide engine
npx tailwindcss init --ts --esm
```

#### 2.2 Tailwind v4 Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './stories/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  darkMode: ['class'],
  theme: {
    extend: {
      // Tailwind v4 Features
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-gentle': 'bounceGentle 0.6s ease-in-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      },
      // CSS Container Queries (v4 feature)
      containers: {
        'xs': '20rem',
        'sm': '24rem',
        'md': '28rem',
        'lg': '32rem',
        'xl': '36rem',
        '2xl': '42rem'
      },
      // Advanced Color System
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/aspect-ratio')
  ]
} satisfies Config
```

#### 2.3 CSS Layers Setup (v4 Feature)

```css
/* globals.css */
@layer theme, base, components, utilities;

@layer theme {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 84% 4.9%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 94.1%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  
  body {
    @apply bg-background text-foreground;
  }
}
```

### Phase 3: shadcn/ui + Radix UI Integration

#### 3.1 Installation

```bash
# Install shadcn/ui CLI
npx shadcn@latest init

# Install Radix UI primitives
npm install @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-accordion @radix-ui/react-alert-dialog

# Install utilities
npm install class-variance-authority clsx tailwind-merge lucide-react
```

#### 3.2 Component Installation with TDD

```bash
# Install components with test-first approach
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add tooltip
npx shadcn@latest add progress
npx shadcn@latest add badge
```

---

## 🧪 Component Implementation Strategy

### Phase 4: Test-First Component Development

#### 4.1 Button Component Example

**Step 1: Write Comprehensive Tests**

```typescript
// src/components/ui/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'
import { vi } from 'vitest'

describe('Button Component', () => {
  describe('Accessibility', () => {
    test('should be keyboard navigable', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Test Button</Button>)
      
      const button = screen.getByRole('button', { name: 'Test Button' })
      button.focus()
      fireEvent.keyDown(button, { key: 'Enter' })
      
      expect(handleClick).toHaveBeenCalled()
    })

    test('should have proper ARIA labels', () => {
      render(<Button aria-label="Close dialog">×</Button>)
      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument()
    })

    test('should support disabled state', () => {
      render(<Button disabled>Disabled Button</Button>)
      const button = screen.getByRole('button')
      
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-disabled', 'true')
    })

    test('should have proper focus management', () => {
      render(<Button>Focus Test</Button>)
      const button = screen.getByRole('button')
      
      button.focus()
      expect(button).toHaveFocus()
      expect(button).toHaveClass('focus-visible:outline-none')
    })
  })

  describe('Functionality', () => {
    test('should render with default props', () => {
      render(<Button>Default Button</Button>)
      
      const button = screen.getByRole('button', { name: 'Default Button' })
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('bg-primary')
    })

    test('should handle click events', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click Me</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    test('should support different variants', () => {
      const { rerender } = render(<Button variant="destructive">Delete</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-destructive')
      
      rerender(<Button variant="outline">Outline</Button>)
      expect(screen.getByRole('button')).toHaveClass('border')
      
      rerender(<Button variant="ghost">Ghost</Button>)
      expect(screen.getByRole('button')).toHaveClass('hover:bg-accent')
    })

    test('should support different sizes', () => {
      const { rerender } = render(<Button size="sm">Small</Button>)
      expect(screen.getByRole('button')).toHaveClass('h-9')
      
      rerender(<Button size="lg">Large</Button>)
      expect(screen.getByRole('button')).toHaveClass('h-11')
    })
  })

  describe('Visual Rendering', () => {
    test('should apply correct CSS classes', () => {
      render(<Button className="custom-class">Styled Button</Button>)
      const button = screen.getByRole('button')
      
      expect(button).toHaveClass('inline-flex')
      expect(button).toHaveClass('items-center')
      expect(button).toHaveClass('justify-center')
      expect(button).toHaveClass('custom-class')
    })

    test('should handle loading state', () => {
      render(<Button loading>Loading Button</Button>)
      
      expect(screen.getByRole('button')).toBeDisabled()
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })
  })
})
```

**Step 2: Implement Component**

```typescript
// src/components/ui/Button.tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <Loader2 
            className="mr-2 h-4 w-4 animate-spin" 
            data-testid="loading-spinner"
            aria-hidden="true"
          />
        )}
        {children}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

#### 4.2 Progress Component Migration

**TDD Migration of Existing CollectionProgress Component**

```typescript
// src/components/ui/Progress.test.tsx
import { render, screen } from '@testing-library/react'
import { Progress } from './Progress'

describe('Progress Component', () => {
  describe('Accessibility', () => {
    test('should have proper ARIA attributes', () => {
      render(<Progress value={50} aria-label="Loading progress" />)
      
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '50')
      expect(progressbar).toHaveAttribute('aria-valuemin', '0')
      expect(progressbar).toHaveAttribute('aria-valuemax', '100')
      expect(progressbar).toHaveAttribute('aria-label', 'Loading progress')
    })

    test('should support indeterminate state', () => {
      render(<Progress />)
      
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).not.toHaveAttribute('aria-valuenow')
    })
  })

  describe('Visual Rendering', () => {
    test('should render correct progress width', () => {
      render(<Progress value={75} />)
      
      const progressIndicator = screen.getByTestId('progress-indicator')
      expect(progressIndicator).toHaveStyle({ transform: 'translateX(-25%)' })
    })

    test('should handle different sizes', () => {
      const { rerender } = render(<Progress value={50} className="h-2" />)
      expect(screen.getByRole('progressbar')).toHaveClass('h-2')
      
      rerender(<Progress value={50} className="h-4" />)
      expect(screen.getByRole('progressbar')).toHaveClass('h-4')
    })
  })
})
```

---

## 📏 Code Quality Standards

### Phase 5: TypeScript Excellence

#### 5.1 Strict Type Definitions

```typescript
// src/types/ui.ts
export interface ComponentBaseProps {
  className?: string
  children?: React.ReactNode
  'data-testid'?: string
}

export interface AccessibilityProps {
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  role?: string
}

export interface VariantProps<T> {
  variant?: keyof T
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

// Strict theme type definitions
export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeConfig {
  colors: Record<string, string>
  spacing: Record<string, string>
  typography: Record<string, string>
  borderRadius: Record<string, string>
}
```

#### 5.2 Performance Standards

```typescript
// Performance utilities
import { memo, useMemo, useCallback } from 'react'

// Memoization for expensive components
export const OptimizedButton = memo(Button, (prevProps, nextProps) => {
  return (
    prevProps.variant === nextProps.variant &&
    prevProps.size === nextProps.size &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.loading === nextProps.loading
  )
})

// Custom hooks for performance
export function useTheme() {
  return useMemo(() => ({
    theme: getCurrentTheme(),
    toggleTheme: useCallback(() => toggleTheme(), [])
  }), [])
}
```

#### 5.3 Accessibility Standards

```typescript
// Accessibility utilities
export function useA11y() {
  return {
    // Keyboard navigation
    handleKeyDown: useCallback((event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        return true
      }
      return false
    }, []),
    
    // Focus management
    trapFocus: useCallback((container: HTMLElement) => {
      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      // Focus trapping logic
    }, []),
    
    // Screen reader announcements
    announce: useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
      const announcement = document.createElement('div')
      announcement.setAttribute('aria-live', priority)
      announcement.setAttribute('aria-atomic', 'true')
      announcement.textContent = message
      announcement.style.position = 'absolute'
      announcement.style.left = '-10000px'
      document.body.appendChild(announcement)
      setTimeout(() => document.body.removeChild(announcement), 1000)
    }, [])
  }
}
```

---

## 🔄 Existing Component Migration

### Phase 6: TDD Refactoring Strategy

#### 6.1 CollectionProgress Component Migration

**Step 1: Add Comprehensive Tests**

```typescript
// src/components/youtube/CollectionProgress.test.tsx
import { render, screen } from '@testing-library/react'
import { CollectionProgress } from './CollectionProgress'
import type { CollectionProgressProps } from '@/types/plex-collections'

const mockCollection = {
  id: 'test-collection',
  name: 'Test Collection',
  status: 'downloading' as const,
  videoCount: 5,
  processedCount: 3,
  videos: [
    { youtubeId: '1', title: 'Video 1', status: 'added' as const },
    { youtubeId: '2', title: 'Video 2', status: 'pending' as const },
    { youtubeId: '3', title: 'Video 3', status: 'failed' as const, error: 'Network error' }
  ]
}

describe('CollectionProgress Migration', () => {
  test('should maintain existing functionality', () => {
    render(<CollectionProgress collection={mockCollection} />)
    
    expect(screen.getByText('Processing Videos')).toBeInTheDocument()
    expect(screen.getByText('3 / 5')).toBeInTheDocument()
  })

  test('should use new Progress component', () => {
    render(<CollectionProgress collection={mockCollection} />)
    
    // Should use shadcn/ui Progress component
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '60') // 3/5 * 100
  })

  test('should maintain compact mode', () => {
    render(<CollectionProgress collection={mockCollection} compact />)
    
    // Should render compact version
    expect(screen.queryByText('Processing Videos')).not.toBeInTheDocument()
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })
})
```

**Step 2: Refactor with Modern Components**

```typescript
// Updated CollectionProgress.tsx
'use client'

import { FolderPlus, FileVideo, Film, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import type { CollectionProgressProps } from '@/types/plex-collections'
import { getStepFromStatus, getStepStatus } from '@/lib/plex/collection-utils'
import { cn } from '@/lib/utils'

export function CollectionProgress({ collection, compact = false }: CollectionProgressProps) {
  const progress = collection.videoCount > 0 
    ? (collection.processedCount / collection.videoCount) * 100 
    : 0
  
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <Badge variant="secondary" className="text-xs">
            {getStepFromStatus(collection.status).label}
          </Badge>
          <span className="font-medium">
            {collection.processedCount}/{collection.videoCount}
          </span>
        </div>
        <Progress 
          value={progress} 
          className="h-2"
          aria-label={`Collection progress: ${Math.round(progress)}% complete`}
        />
      </div>
    )
  }
  
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {/* Step Indicators */}
        <div className="flex items-center justify-between">
          <StepIndicator
            icon={FolderPlus}
            label="Create Collection"
            status={getStepStatus(collection.status, 'creating')}
          />
          <div className="flex-1 h-0.5 bg-border mx-2" />
          <StepIndicator
            icon={FileVideo}
            label="Add Media"
            status={getStepStatus(collection.status, 'adding-media')}
          />
          <div className="flex-1 h-0.5 bg-border mx-2" />
          <StepIndicator
            icon={Film}
            label="Update Metadata"
            status={getStepStatus(collection.status, 'updating-metadata')}
          />
        </div>
        
        {/* Progress Details */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Processing Videos</span>
            <span className="font-medium">
              {collection.processedCount} / {collection.videoCount}
            </span>
          </div>
          
          <Progress 
            value={progress} 
            className="h-3"
            aria-label={`Processing progress: ${collection.processedCount} of ${collection.videoCount} videos complete`}
          />
          
          {/* Current step info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {getStepFromStatus(collection.status).label}
            </Badge>
            {progress > 0 && progress < 100 && (
              <span>{Math.round(progress)}% complete</span>
            )}
          </div>
          
          {/* Video List */}
          {collection.videos && collection.videos.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {collection.videos.map((video, index) => (
                <VideoStatus key={video.youtubeId} video={video} index={index + 1} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Modern StepIndicator with improved accessibility
function StepIndicator({ 
  icon: Icon, 
  label, 
  status 
}: { 
  icon: React.ComponentType<{ className?: string }>
  label: string
  status: 'pending' | 'active' | 'completed' | 'failed'
}) {
  const statusConfig = {
    pending: { className: 'opacity-50 text-muted-foreground', bgClass: 'bg-muted border-muted' },
    active: { className: 'text-primary', bgClass: 'bg-primary/20 border-primary animate-pulse' },
    completed: { className: 'text-green-600', bgClass: 'bg-green-100 border-green-600' },
    failed: { className: 'text-destructive', bgClass: 'bg-destructive/20 border-destructive' }
  }
  
  const config = statusConfig[status]
  
  return (
    <div 
      className={cn('flex flex-col items-center gap-1 min-w-0', config.className)}
      role="status"
      aria-label={`${label}: ${status}`}
    >
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
        config.bgClass
      )}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <span className="text-xs text-center leading-tight">{label}</span>
    </div>
  )
}
```

---

## 🔧 Development Workflow

### Phase 7: Complete TDD Implementation Process

#### 7.1 Component Development Checklist

```bash
# 1. Create test file first
touch src/components/ui/ComponentName.test.tsx

# 2. Write failing tests
npm test ComponentName.test.tsx

# 3. Implement minimal component
touch src/components/ui/ComponentName.tsx

# 4. Make tests pass
npm test ComponentName.test.tsx

# 5. Refactor with modern libraries
# - Add Tailwind v4 classes
# - Integrate Radix UI primitives
# - Implement accessibility features

# 6. Add Storybook stories
touch src/components/ui/ComponentName.stories.tsx

# 7. Run full test suite
npm test
npm run test:coverage

# 8. Visual regression testing
npm run chromatic
```

#### 7.2 Quality Gates

**Pre-commit Requirements:**
- ✅ All tests pass
- ✅ 90%+ test coverage
- ✅ TypeScript type checking
- ✅ ESLint passing
- ✅ Accessibility audit (axe-core)
- ✅ Performance budget checks

```json
// package.json scripts
{
  "scripts": {
    "test:tdd": "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "test:a11y": "jest --testPathPattern=a11y",
    "test:visual": "chromatic --exit-zero-on-changes",
    "lint": "eslint . --ext .ts,.tsx",
    "type-check": "tsc --noEmit",
    "pre-commit": "npm run type-check && npm run lint && npm run test:coverage"
  }
}
```

---

## 📊 Success Metrics

### Phase 8: Measurement & Monitoring

#### 8.1 Code Quality Metrics
- **Test Coverage**: > 90%
- **TypeScript Strict Mode**: 100% compliance
- **Accessibility Score**: WCAG 2.1 AA (100%)
- **Performance Budget**: < 50kb bundle size per component

#### 8.2 User Experience Metrics
- **Loading Performance**: < 100ms first paint
- **Interaction Responsiveness**: < 16ms frame time
- **Accessibility**: 0 axe-core violations
- **Browser Support**: 95%+ modern browsers

#### 8.3 Developer Experience Metrics
- **Test Execution Time**: < 5 seconds
- **Build Time**: < 30 seconds (Tailwind v4 Oxide)
- **Hot Reload**: < 200ms
- **Type Checking**: < 3 seconds

---

## 🚀 Implementation Roadmap

### Week 1: Foundation Setup
- [x] Install Tailwind v4 with Oxide engine
- [x] Configure shadcn/ui CLI
- [x] Setup testing infrastructure
- [x] Create design system tokens

### Week 2: Core Components (TDD)
- [ ] Button component with full test coverage
- [ ] Input/Form components
- [ ] Card/Layout components
- [ ] Progress/Loading components

### Week 3: Advanced Components
- [ ] Dialog/Modal components
- [ ] Dropdown/Menu components
- [ ] Tooltip/Popover components
- [ ] Navigation components

### Week 4: Migration & Integration
- [ ] Migrate existing CollectionProgress
- [ ] Update YouTube components
- [ ] Integration testing
- [ ] Performance optimization

---

## 📚 Resources & References

### Documentation Links
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Component Library](https://ui.shadcn.com/)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
- [Vitest Testing Framework](https://vitest.dev/)
- [Testing Library React](https://testing-library.com/docs/react-testing-library/intro/)

### Code Examples Repository
```bash
# Clone examples repository
git clone https://github.com/shadcn-ui/ui.git examples/shadcn-ui
git clone https://github.com/tailwindlabs/tailwindcss.git examples/tailwindcss-v4
```

---

**Next Steps**: Begin with Phase 1 implementation, starting with the Button component TDD cycle. Each component should follow the strict test-first methodology outlined in this guide.
