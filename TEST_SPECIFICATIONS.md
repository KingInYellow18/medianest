# 🧪 MediaNest Component Test Specifications
## Comprehensive Testing Strategy for UI Modernization & Component Interfaces

**Document Version**: 1.0  
**Date**: July 25, 2025  
**Testing Framework**: Vitest + @testing-library/react + Playwright  
**Project**: MediaNest UI Component Modernization  

---

## 📋 **EXECUTIVE SUMMARY**

This document outlines comprehensive test specifications for MediaNest's UI component modernization initiative. Based on analysis of existing components (DownloadCard, CollectionProgress, etc.) and the planned migration to Shadcn/ui + Radix UI + Tailwind v4, we define testing strategies across 5 critical areas:

1. **Core UI Component Tests** - New primitive components (Button, Progress, Input, Dialog, Card)
2. **Component Upgrade Tests** - Migration validation for existing YouTube components  
3. **Performance Test Suite** - Bundle size, render performance, interaction benchmarks
4. **Regression Test Strategy** - Ensuring existing functionality remains intact
5. **Test Automation Framework** - Integration with existing Vitest setup

---

## 🎯 **1. CORE UI COMPONENT TESTS**

### 1.1 Button Component (`/components/ui/button.tsx`)

**Test Categories**: Visual, Behavioral, Accessibility, Performance

#### **Visual Appearance Tests**
```typescript
describe('Button Visual Tests', () => {
  test('should render all variant styles correctly', () => {
    const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'];
    variants.forEach(variant => {
      render(<Button variant={variant}>Test Button</Button>);
      expect(screen.getByRole('button')).toHaveClass(getVariantClasses(variant));
    });
  });

  test('should render all size variations', () => {
    const sizes = ['default', 'sm', 'lg', 'icon'];
    sizes.forEach(size => {
      render(<Button size={size}>Test</Button>);
      expect(screen.getByRole('button')).toHaveClass(getSizeClasses(size));
    });
  });

  test('should handle disabled state styling', () => {
    render(<Button disabled>Disabled Button</Button>);
    expect(screen.getByRole('button')).toHaveClass('opacity-50 cursor-not-allowed');
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

#### **Behavioral Tests**
```typescript
describe('Button Behavior Tests', () => {
  test('should handle click events properly', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    
    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('should prevent clicks when disabled', async () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    
    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('should handle loading state', () => {
    render(<Button loading>Loading Button</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
```

#### **Accessibility Tests**
```typescript
describe('Button Accessibility Tests', () => {
  test('should have proper ARIA attributes', () => {
    render(<Button aria-label="Save document">Save</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Save document');
  });

  test('should support keyboard navigation', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Keyboard Button</Button>);
    
    screen.getByRole('button').focus();
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);
    
    await user.keyboard('{Space}');
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  test('should meet contrast ratio requirements', async () => {
    render(<Button>Contrast Test</Button>);
    const button = screen.getByRole('button');
    
    // Use axe-core for automated accessibility testing
    const results = await axe(button);
    expect(results).toHaveNoViolations();
  });
});
```

### 1.2 Progress Component (`/components/ui/progress.tsx`)

#### **Visual & Animation Tests**
```typescript
describe('Progress Component Tests', () => {
  test('should render progress bar with correct value', () => {
    render(<Progress value={75} />);
    const progressBar = screen.getByRole('progressbar');
    
    expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  test('should animate progress changes smoothly', async () => {
    const { rerender } = render(<Progress value={0} />);
    const progressBar = screen.getByRole('progressbar');
    
    rerender(<Progress value={50} />);
    
    // Test CSS transition is applied
    expect(progressBar.firstChild).toHaveStyle('transition-duration: 0.3s');
    
    await waitFor(() => {
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    });
  });

  test('should handle gradient variant', () => {
    render(<Progress value={60} variant="gradient" />);
    const progressFill = screen.getByRole('progressbar').firstChild;
    expect(progressFill).toHaveClass('gradient-progress');
  });
});
```

### 1.3 Input Component (`/components/ui/input.tsx`)

#### **Form Integration Tests**
```typescript
describe('Input Component Tests', () => {
  test('should handle controlled input properly', async () => {
    const TestForm = () => {
      const [value, setValue] = useState('');
      return (
        <Input 
          value={value} 
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter text"
        />
      );
    };
    
    render(<TestForm />);
    const input = screen.getByPlaceholderText('Enter text');
    
    await user.type(input, 'Hello World');
    expect(input).toHaveValue('Hello World');
  });

  test('should validate input types', () => {
    render(<Input type="email" placeholder="Enter email" />);
    const input = screen.getByPlaceholderText('Enter email');
    expect(input).toHaveAttribute('type', 'email');
  });

  test('should handle error states', () => {
    render(<Input error="Invalid input" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Invalid input')).toBeInTheDocument();
  });
});
```

### 1.4 Dialog Component (`/components/ui/dialog.tsx`)

#### **Modal Behavior Tests**
```typescript
describe('Dialog Component Tests', () => {
  test('should open and close properly', async () => {
    const TestDialog = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open Dialog</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>Test Dialog</DialogTitle>
              <DialogDescription>This is a test dialog</DialogDescription>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </DialogContent>
          </Dialog>
        </>
      );
    };
    
    render(<TestDialog />);
    
    // Initially closed
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    
    // Open dialog
    await user.click(screen.getByText('Open Dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    
    // Close dialog
    await user.click(screen.getByText('Close'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('should handle escape key to close', async () => {
    render(
      <Dialog open onOpenChange={vi.fn()}>
        <DialogContent>Test Content</DialogContent>
      </Dialog>
    );
    
    await user.keyboard('{Escape}');
    // Verify onOpenChange was called with false
  });

  test('should trap focus within dialog', async () => {
    render(
      <Dialog open>
        <DialogContent>
          <Button>First Button</Button>
          <Button>Second Button</Button>
        </DialogContent>
      </Dialog>
    );
    
    const firstButton = screen.getByText('First Button');
    const secondButton = screen.getByText('Second Button');
    
    firstButton.focus();
    await user.tab();
    expect(secondButton).toHaveFocus();
    
    await user.tab();
    expect(firstButton).toHaveFocus(); // Should wrap around
  });
});
```

### 1.5 Card Component (`/components/ui/card.tsx`)

#### **Layout & Composition Tests**
```typescript
describe('Card Component Tests', () => {
  test('should render card structure correctly', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
          <CardDescription>Test Description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card content goes here</p>
        </CardContent>
        <CardFooter>
          <Button>Action</Button>
        </CardFooter>
      </Card>
    );
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('Card content goes here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  test('should support hover and interactive states', async () => {
    render(<Card hoverable>Hoverable Card</Card>);
    const card = screen.getByText('Hoverable Card').closest('[data-testid="card"]');
    
    await user.hover(card);
    expect(card).toHaveClass('hover:shadow-lg');
  });
});
```

---

## 🔄 **2. COMPONENT UPGRADE TESTS**

### 2.1 DownloadCard Migration Tests

#### **Before/After Comparison Tests**
```typescript
describe('DownloadCard Migration Tests', () => {
  const mockDownload = {
    id: 'test-download-1',
    title: 'Test Video Title',
    url: 'https://youtube.com/watch?v=test',
    status: 'downloading' as const,
    progress: 65,
    thumbnail: 'https://img.youtube.com/vi/test/maxresdefault.jpg',
    type: 'video' as const,
    createdAt: '2025-07-25T10:00:00Z',
    format: { quality: '1080p', container: 'mp4' }
  };

  test('should maintain all original functionality after migration', () => {
    const onCancel = vi.fn();
    const onRetry = vi.fn();
    const onViewInPlex = vi.fn();
    
    render(
      <DownloadCard 
        download={mockDownload}
        onCancel={onCancel}
        onRetry={onRetry}
        onViewInPlex={onViewInPlex}
      />
    );
    
    // Verify all critical elements are present
    expect(screen.getByText('Test Video Title')).toBeInTheDocument();
    expect(screen.getByText('downloading')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '65');
    expect(screen.getByAltText('')).toHaveAttribute('src', mockDownload.thumbnail);
  });

  test('should use new UI primitives internally', () => {
    render(<DownloadCard download={mockDownload} />);
    
    // Verify new Card component is used
    const cardElement = screen.getByTestId('download-card');
    expect(cardElement).toHaveClass('bg-card', 'border', 'rounded-lg');
    
    // Verify new Progress component is used
    const progressElement = screen.getByRole('progressbar');
    expect(progressElement).toHaveClass('relative', 'overflow-hidden');
  });

  test('should maintain responsive behavior', () => {
    render(<DownloadCard download={mockDownload} />);
    
    // Test mobile layout
    global.innerWidth = 375;
    global.dispatchEvent(new Event('resize'));
    
    const cardElement = screen.getByTestId('download-card');
    expect(cardElement).toHaveClass('flex-col', 'sm:flex-row');
  });
});
```

### 2.2 CollectionProgress Migration Tests

#### **Step Indicator Migration Tests**
```typescript
describe('CollectionProgress Migration Tests', () => {
  const mockCollection = {
    id: 'test-collection',
    name: 'Test Playlist',
    status: 'adding-media' as const,
    videoCount: 10,
    processedCount: 6,
    videos: [
      { youtubeId: 'vid1', title: 'Video 1', status: 'added' as const },
      { youtubeId: 'vid2', title: 'Video 2', status: 'pending' as const }
    ]
  };

  test('should render step indicators with new UI primitives', () => {
    render(<CollectionProgress collection={mockCollection} />);
    
    // Verify Progress component is used
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    
    // Verify step indicators use new styling
    const stepIndicators = screen.getAllByTestId('step-indicator');
    stepIndicators.forEach(indicator => {
      expect(indicator).toHaveClass('rounded-full', 'border-2');
    });
  });

  test('should maintain progress calculation accuracy', () => {
    render(<CollectionProgress collection={mockCollection} />);
    
    const progress = (6 / 10) * 100; // 60%
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60');
  });

  test('should handle compact mode correctly', () => {
    render(<CollectionProgress collection={mockCollection} compact />);
    
    // Should show simplified version
    expect(screen.queryByTestId('step-indicator')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('6/10')).toBeInTheDocument();
  });
});
```

### 2.3 QueueFilters Migration Tests

#### **Filter Functionality Tests**
```typescript
describe('QueueFilters Migration Tests', () => {
  test('should use new Input component for search', async () => {
    const onFiltersChange = vi.fn();
    render(<QueueFilters onFiltersChange={onFiltersChange} />);
    
    const searchInput = screen.getByPlaceholderText('Search downloads...');
    expect(searchInput).toHaveClass('flex', 'h-10', 'w-full'); // New Input styles
    
    await user.type(searchInput, 'test search');
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'test search' })
    );
  });

  test('should use new Select components for dropdowns', () => {
    render(<QueueFilters />);
    
    const statusSelect = screen.getByTestId('status-select');
    expect(statusSelect).toHaveAttribute('data-component', 'select');
  });
});
```

---

## ⚡ **3. PERFORMANCE TEST SUITE**

### 3.1 Bundle Size Tests

#### **Component Bundle Analysis**
```typescript
describe('Bundle Size Performance Tests', () => {
  test('should meet bundle size targets for core components', async () => {
    const bundleSizes = await getBundleSizes([
      'components/ui/button',
      'components/ui/progress', 
      'components/ui/input',
      'components/ui/dialog',
      'components/ui/card'
    ]);
    
    // Targets based on headless architecture expectations
    expect(bundleSizes.button).toBeLessThan(3000); // 3KB
    expect(bundleSizes.progress).toBeLessThan(2000); // 2KB
    expect(bundleSizes.input).toBeLessThan(4000); // 4KB
    expect(bundleSizes.dialog).toBeLessThan(8000); // 8KB
    expect(bundleSizes.card).toBeLessThan(2000); // 2KB
  });

  test('should achieve 60% bundle reduction target', async () => {
    const oldBundleSize = await getOriginalBundleSize();
    const newBundleSize = await getCurrentBundleSize();
    
    const reduction = ((oldBundleSize - newBundleSize) / oldBundleSize) * 100;
    expect(reduction).toBeGreaterThan(60);
  });

  test('should tree-shake unused components properly', async () => {
    const bundleAnalysis = await analyzeBundleTreeShaking();
    
    // Verify only imported components are included
    expect(bundleAnalysis.unusedComponents).toHaveLength(0);
    expect(bundleAnalysis.treeShakingEfficiency).toBeGreaterThan(85);
  });
});
```

### 3.2 Render Performance Tests

#### **Component Render Benchmarks**
```typescript
describe('Render Performance Tests', () => {
  test('should render DownloadCard within performance budget', async () => {
    const renderStart = performance.now();
    
    render(<DownloadCard download={mockComplexDownload} />);
    
    const renderTime = performance.now() - renderStart;
    expect(renderTime).toBeLessThan(16); // 60fps = 16.67ms budget
  });

  test('should handle large lists efficiently with virtualization', async () => {
    const downloads = generateMockDownloads(1000);
    
    const renderStart = performance.now();
    render(<DownloadQueue downloads={downloads} virtualized />);
    
    const renderTime = performance.now() - renderStart;
    expect(renderTime).toBeLessThan(100); // Large list budget
    
    // Verify only visible items are rendered
    const renderedItems = screen.getAllByTestId('download-card');
    expect(renderedItems.length).toBeLessThan(20); // Virtualization window
  });

  test('should memoize expensive calculations', () => {
    const memoSpy = vi.spyOn(React, 'useMemo');
    
    render(<CollectionProgress collection={mockCollection} />);
    
    // Verify memoization is used for progress calculations
    expect(memoSpy).toHaveBeenCalledWith(
      expect.any(Function),
      expect.arrayContaining([mockCollection.processedCount, mockCollection.videoCount])
    );
  });
});
```

### 3.3 Interaction Performance Tests

#### **User Interaction Benchmarks**
```typescript
describe('Interaction Performance Tests', () => {
  test('should handle button clicks within performance budget', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    
    const clickStart = performance.now();
    await user.click(screen.getByRole('button'));
    const clickTime = performance.now() - clickStart;
    
    expect(clickTime).toBeLessThan(16); // 60fps budget
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('should animate progress changes smoothly', async () => {
    const { rerender } = render(<Progress value={0} />);
    
    const animationStart = performance.now();
    rerender(<Progress value={100} />);
    
    // Wait for animation to complete
    await waitFor(() => {
      const animationTime = performance.now() - animationStart;
      expect(animationTime).toBeLessThan(300); // CSS transition duration
    });
  });

  test('should debounce search input properly', async () => {
    const onSearch = vi.fn();
    render(<QueueFilters onSearch={onSearch} />);
    
    const searchInput = screen.getByPlaceholderText('Search downloads...');
    
    // Rapid typing should be debounced
    await user.type(searchInput, 'quick search');
    
    // Should not call on every keystroke
    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});
```

---

## 🛡️ **4. REGRESSION TEST STRATEGY**

### 4.1 Existing Functionality Tests

#### **Critical Path Tests**
```typescript
describe('Regression Tests - Critical Functionality', () => {
  test('should maintain download queue operations', async () => {
    const mockQueue = generateMockDownloadQueue();
    const { rerender } = render(<DownloadQueue queue={mockQueue} />);
    
    // Test adding to queue
    const newDownload = createMockDownload();
    const updatedQueue = [...mockQueue, newDownload];
    rerender(<DownloadQueue queue={updatedQueue} />);
    
    expect(screen.getByText(newDownload.title)).toBeInTheDocument();
    
    // Test removing from queue
    const filteredQueue = mockQueue.filter(d => d.id !== mockQueue[0].id);
    rerender(<DownloadQueue queue={filteredQueue} />);
    
    expect(screen.queryByText(mockQueue[0].title)).not.toBeInTheDocument();
  });

  test('should maintain URL submission functionality', async () => {
    const onSubmit = vi.fn();
    render(<URLSubmissionForm onSubmit={onSubmit} />);
    
    const urlInput = screen.getByPlaceholderText('YouTube URL...');
    const submitButton = screen.getByRole('button', { name: /submit/i });
    
    await user.type(urlInput, 'https://youtube.com/watch?v=test');
    await user.click(submitButton);
    
    expect(onSubmit).toHaveBeenCalledWith({
      url: 'https://youtube.com/watch?v=test',
      format: expect.any(Object)
    });
  });

  test('should maintain Plex integration status updates', async () => {
    const download = createMockDownload({ 
      status: 'completed',
      plexStatus: 'processing'
    });
    
    const { rerender } = render(<DownloadCard download={download} />);
    
    // Update Plex status
    const updatedDownload = { ...download, plexStatus: 'completed' };
    rerender(<DownloadCard download={updatedDownload} />);
    
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view in plex/i })).toBeEnabled();
  });
});
```

### 4.2 Data Flow Tests

#### **State Management Regression Tests**
```typescript
describe('Regression Tests - State Management', () => {
  test('should maintain WebSocket connection handling', async () => {
    const mockSocket = createMockSocket();
    const onStatusUpdate = vi.fn();
    
    render(
      <SocketProvider socket={mockSocket}>
        <DownloadCard download={mockDownload} onStatusUpdate={onStatusUpdate} />
      </SocketProvider>
    );
    
    // Simulate WebSocket message
    mockSocket.emit('download:progress', {
      id: mockDownload.id,
      progress: 75
    });
    
    await waitFor(() => {
      expect(onStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ progress: 75 })
      );
    });
  });

  test('should maintain error handling patterns', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const errorBoundary = render(
      <ErrorBoundary>
        <DownloadCard download={null} /> {/* Invalid props */}
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
});
```

### 4.3 Visual Regression Tests

#### **Screenshot Comparison Tests**
```typescript
describe('Visual Regression Tests', () => {
  test('should maintain visual consistency for DownloadCard', async () => {
    const component = <DownloadCard download={mockDownload} />;
    
    // Take screenshot of current component
    const screenshot = await takeScreenshot(component);
    
    // Compare with baseline
    expect(screenshot).toMatchImageSnapshot({
      threshold: 0.1, // Allow 10% difference
      customDiffConfig: {
        threshold: 0.1,
        includeAA: false
      }
    });
  });

  test('should maintain responsive breakpoint behavior', async () => {
    const viewports = [
      { width: 375, height: 667 }, // Mobile
      { width: 768, height: 1024 }, // Tablet  
      { width: 1920, height: 1080 } // Desktop
    ];
    
    for (const viewport of viewports) {
      await setViewport(viewport);
      
      const component = <DownloadQueue downloads={mockDownloads} />;
      const screenshot = await takeScreenshot(component);
      
      expect(screenshot).toMatchImageSnapshot({
        customSnapshotIdentifier: `download-queue-${viewport.width}x${viewport.height}`
      });
    }
  });
});
```

---

## 🤖 **5. TEST AUTOMATION FRAMEWORK**

### 5.1 Vitest Integration

#### **Enhanced Configuration**
```typescript
// vitest.config.extended.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [
      './test-setup.ts',
      './test-setup-components.ts', // New setup for component tests
      './test-setup-performance.ts' // Performance testing utilities
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        'test-setup*.ts',
        'vitest.config*.ts',
        'storybook-static/**',
        '**/*.stories.{ts,tsx}',
        'playwright.config.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        'components/ui/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    reporters: [
      'default',
      'json',
      ['html', { outputFile: 'test-results/index.html' }],
      ['junit', { outputFile: 'test-results/junit.xml' }]
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend/src'),
      '@shared': path.resolve(__dirname, './shared/src'),
      '@backend': path.resolve(__dirname, './backend/src'),
      '@test-utils': path.resolve(__dirname, './test-utils')
    }
  }
});
```

#### **Component Test Setup**
```typescript
// test-setup-components.ts
import { vi } from 'vitest';
import { configure } from '@testing-library/react';
import '@testing-library/jest-dom';
import 'axe-core/lib/axe.min.js';

// Configure testing library
configure({
  testIdAttribute: 'data-testid'
});

// Mock Next.js components
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  )
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn()
  }),
  usePathname: () => '/test-path',
  useSearchParams: () => new URLSearchParams()
}));

// Mock Framer Motion for testing
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
    span: 'span'
  },
  AnimatePresence: ({ children }: any) => children
}));

// Global test utilities
global.takeScreenshot = async (component: React.ReactElement) => {
  // Screenshot implementation
};

global.getBundleSizes = async (components: string[]) => {
  // Bundle size analysis implementation
};
```

### 5.2 Custom Test Utilities

#### **Component Testing Helpers**
```typescript
// test-utils/component-helpers.ts
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';

// Custom render function with providers
export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderOptions & {
    initialTheme?: 'light' | 'dark';
    queryClient?: QueryClient;
  } = {}
) {
  const {
    initialTheme = 'dark',
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    }),
    ...renderOptions
  } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme={initialTheme}>
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  };
}

// Performance testing helpers
export const performanceHelpers = {
  measureRenderTime: async (renderFn: () => void) => {
    const start = performance.now();
    renderFn();
    return performance.now() - start;
  },

  measureInteractionTime: async (interactionFn: () => Promise<void>) => {
    const start = performance.now();
    await interactionFn();
    return performance.now() - start;
  }
};

// Accessibility testing helpers  
export const a11yHelpers = {
  checkKeyboardNavigation: async (element: HTMLElement) => {
    // Implementation for keyboard navigation testing
  },

  checkAriaAttributes: (element: HTMLElement) => {
    // Implementation for ARIA attributes validation
  }
};
```

### 5.3 Test Categories & Organization

#### **Test File Structure**
```
frontend/src/
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── button.test.tsx          # Unit tests
│   │   ├── button.visual.test.tsx   # Visual regression
│   │   ├── button.a11y.test.tsx     # Accessibility tests
│   │   └── button.perf.test.tsx     # Performance tests
│   └── youtube/
│       ├── DownloadCard.tsx
│       ├── DownloadCard.test.tsx         # Existing functionality
│       ├── DownloadCard.migration.test.tsx # Migration validation
│       └── DownloadCard.integration.test.tsx
├── __tests__/
│   ├── integration/                 # Cross-component integration
│   ├── regression/                  # Regression test suites
│   └── performance/                 # Performance benchmarks
└── test-utils/                      # Shared testing utilities
```

#### **Test Scripts Enhancement**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",
    
    "test:components": "vitest run components",
    "test:integration": "vitest run __tests__/integration",
    "test:regression": "vitest run __tests__/regression",
    "test:performance": "vitest run __tests__/performance",
    "test:a11y": "vitest run --grep=\"accessibility|a11y\"",
    "test:visual": "vitest run --grep=\"visual|screenshot\"",
    
    "test:migration": "vitest run --grep=\"migration\"",
    "test:before-deploy": "npm run test:regression && npm run test:performance && npm run test:a11y",
    
    "test:playwright": "playwright test",
    "test:e2e": "playwright test --project=chromium",
    "test:storybook": "test-storybook"
  }
}
```

---

## 📊 **SUCCESS METRICS & ACCEPTANCE CRITERIA**

### **Performance Targets**
- ✅ **Bundle Size**: 60% reduction from current size
- ✅ **Render Performance**: <16ms for component renders (60fps)
- ✅ **Interaction Response**: <100ms for user interactions
- ✅ **Test Coverage**: >90% for new UI components, >80% overall

### **Quality Targets**
- ✅ **Accessibility**: 100% WCAG 2.1 AA compliance
- ✅ **Visual Consistency**: <10% difference in visual regression tests
- ✅ **Cross-browser**: Support Chrome 100+, Firefox 100+, Safari 14+
- ✅ **Mobile Responsive**: Flawless behavior across all breakpoints

### **Test Execution Targets**
- ✅ **Test Suite Speed**: <5 minutes for full test run
- ✅ **Test Reliability**: <1% flaky test rate
- ✅ **CI/CD Integration**: Automated testing on all PRs
- ✅ **Documentation**: 100% test coverage documentation

---

## 🚀 **IMPLEMENTATION ROADMAP**

### **Phase 1: Foundation (Week 1-2)**
1. Set up enhanced Vitest configuration
2. Create component test utilities and helpers
3. Implement performance testing framework
4. Set up visual regression testing infrastructure

### **Phase 2: Core Component Tests (Week 3-4)**
1. Write comprehensive tests for Button, Progress, Input, Dialog, Card components
2. Implement accessibility test suite with axe-core
3. Create performance benchmarks for each component
4. Set up automated bundle size tracking

### **Phase 3: Migration Validation (Week 5-6)**
1. Create migration tests for existing components
2. Implement regression test suite for critical paths
3. Set up visual regression tests with screenshot comparison
4. Create integration tests for component interactions

### **Phase 4: Automation & CI/CD (Week 7-8)**
1. Integrate all test suites with CI/CD pipeline  
2. Set up automated performance monitoring
3. Create test reporting dashboard
4. Implement automated test result notifications

---

**Document Status**: ✅ **APPROVED FOR IMPLEMENTATION**  
**Next Action**: Begin Phase 1 foundation setup with enhanced Vitest configuration  
**Testing Lead**: Tester-Delta (MediaNest Hive Mind)  
**Review Date**: August 1, 2025