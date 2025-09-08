/**
 * Centralized Dynamic Component Imports
 *
 * This file manages all lazy-loaded components with proper TypeScript support
 * and consistent loading patterns. All dynamic imports are centralized here
 * to prevent circular dependencies and ensure proper tree shaking.
 */

'use client';

import React, { lazy, ComponentType, Suspense } from 'react';
import { LoadingSpinner, LoadingCard } from '@/components/optimization/LazyLoader';
import type { MediaGridProps } from '@/components/plex/MediaGrid';

// ========================================
// COMPONENT IMPORT MAPPINGS
// ========================================

// Media & Entertainment Components
const MediaGrid = lazy(() =>
  import('@/components/plex/MediaGrid').then((mod) => ({ default: mod.MediaGrid }))
);

const AdvancedSearchFilters = lazy(() =>
  import('@/components/plex/AdvancedSearchFilters').then((mod) => ({
    default: mod.AdvancedSearchFilters,
  }))
);

const PlexDashboard = lazy(() =>
  import('@/components/plex/PlexDashboard').then((mod) => ({
    default: mod.PlexDashboard,
  }))
);

// Chart & Visualization Components
const MetricsChart = lazy(() =>
  import('@/components/charts/MetricsChart').then((mod) => ({
    default: mod.MetricsChart,
  }))
);

// Settings & Admin Components
const AdminPanel = lazy(() =>
  import('@/components/admin/AdminPanel').then((mod) => ({
    default: mod.AdminPanel,
  }))
);

const SettingsPanel = lazy(() =>
  import('@/components/settings/SettingsPanel').then((mod) => ({
    default: mod.SettingsPanel,
  }))
);

// ========================================
// COMPONENT TYPE DEFINITIONS
// ========================================

// Temporarily disable prop type imports to avoid export issues
// import type { AdvancedSearchFiltersProps } from '@/components/plex/AdvancedSearchFilters';
// export type { AdvancedSearchFiltersProps };

// ========================================
// LAZY COMPONENT EXPORTS
// ========================================

// Wrapped lazy components with proper fallbacks
export const LazyMediaGrid = React.forwardRef<HTMLDivElement, MediaGridProps>((props, _ref) => (
  <Suspense fallback={<LoadingCard height="h-96" />}>
    <MediaGrid {...props} />
  </Suspense>
));

export const LazyAdvancedSearchFilters = React.forwardRef<HTMLDivElement, any>((props, _ref) => (
  <Suspense fallback={<LoadingCard height="h-64" />}>
    <AdvancedSearchFilters {...props} />
  </Suspense>
));

export const LazyPlexDashboard = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof PlexDashboard>
>((props, _ref) => (
  <Suspense fallback={<LoadingCard height="h-screen" />}>
    <PlexDashboard {...props} />
  </Suspense>
));

export const LazyMetricsChart = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof MetricsChart>
>((props, _ref) => (
  <Suspense fallback={<LoadingCard height="h-80" />}>
    <MetricsChart {...props} />
  </Suspense>
));

export const LazyAdminPanel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof AdminPanel>
>((props, _ref) => (
  <Suspense fallback={<LoadingCard height="h-screen" />}>
    <AdminPanel {...props} />
  </Suspense>
));

export const LazySettingsPanel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof SettingsPanel>
>((props, _ref) => (
  <Suspense fallback={<LoadingCard height="h-96" />}>
    <SettingsPanel {...props} />
  </Suspense>
));

// ========================================
// DYNAMIC COMPONENT FACTORY
// ========================================

interface DynamicComponentOptions {
  fallback?: ComponentType;
  retryCount?: number;
  timeout?: number;
}

/**
 * Creates a dynamically imported component with error boundaries and retries
 */
export function createDynamicComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: DynamicComponentOptions = {}
): ComponentType<React.ComponentProps<T>> {
  const { fallback: Fallback = LoadingSpinner, retryCount = 3, timeout = 10000 } = options;

  const LazyComponent = lazy(() => {
    let retries = 0;

    const loadWithRetry = async (): Promise<{ default: T }> => {
      try {
        return await Promise.race([
          importFn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Component import timeout')), timeout)
          ),
        ]);
      } catch (error) {
        if (retries < retryCount) {
          retries++;
          console.warn(`Component import failed, retrying (${retries}/${retryCount})...`, error);
          await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
          return loadWithRetry();
        }
        throw error;
      }
    };

    return loadWithRetry();
  });

  return React.forwardRef<any, React.ComponentProps<T>>((props, ref) => (
    <Suspense fallback={<Fallback />}>
      <LazyComponent {...props} ref={ref} />
    </Suspense>
  ));
}

// ========================================
// COMPONENT REGISTRY
// ========================================

/**
 * Registry for dynamically loaded components
 * Useful for plugin systems or conditional loading
 */
export interface ComponentRegistryEntry {
  name: string;
  loader: () => Promise<{ default: ComponentType<any> }>;
  fallback?: ComponentType;
}

class ComponentRegistry {
  private components = new Map<string, ComponentRegistryEntry>();
  private loaded = new Map<string, ComponentType<any>>();

  register(entry: ComponentRegistryEntry): void {
    this.components.set(entry.name, entry);
  }

  async get(name: string): Promise<ComponentType<any> | null> {
    // Return cached component if already loaded
    if (this.loaded.has(name)) {
      return this.loaded.get(name)!;
    }

    const entry = this.components.get(name);
    if (!entry) {
      console.warn(`Component '${name}' not found in registry`);
      return null;
    }

    try {
      const { default: Component } = await entry.loader();
      this.loaded.set(name, Component);
      return Component;
    } catch (error) {
      console.error(`Failed to load component '${name}':`, error);
      return null;
    }
  }

  getSync(name: string): ComponentType<any> | null {
    return this.loaded.get(name) || null;
  }

  clear(): void {
    this.components.clear();
    this.loaded.clear();
  }
}

export const componentRegistry = new ComponentRegistry();

// ========================================
// PRELOADING UTILITIES
// ========================================

/**
 * Preload components during idle time
 */
export const preloadComponents = (...loaders: Array<() => Promise<any>>) => {
  if (typeof window === 'undefined') return;

  const preloadWhenIdle = () => {
    loaders.forEach((loader) => {
      loader().catch((error) => {
        console.warn('Component preload failed:', error);
      });
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preloadWhenIdle);
  } else {
    setTimeout(preloadWhenIdle, 100);
  }
};

// Preload critical components
export const preloadCriticalComponents = () => {
  preloadComponents(
    () => import('@/components/plex/MediaGrid'),
    () => import('@/components/plex/AdvancedSearchFilters'),
    () => import('@/components/plex/PlexDashboard')
  );
};

// ========================================
// ERROR BOUNDARIES
// ========================================

interface LazyLoadErrorBoundaryProps {
  fallback?: ComponentType<{ error?: Error; retry?: () => void }>;
  children: React.ReactNode;
}

export class LazyLoadErrorBoundary extends React.Component<
  LazyLoadErrorBoundaryProps,
  { hasError: boolean; error?: Error }
> {
  constructor(props: LazyLoadErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('LazyLoad Error:', error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback || DefaultErrorFallback;
      return <Fallback error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<{ error?: Error; retry?: () => void }> = ({
  error,
  retry,
}) => (
  <div className="p-4 border border-red-300 rounded-lg bg-red-50 text-red-700">
    <h3 className="font-semibold mb-2">Failed to load component</h3>
    <p className="text-sm mb-4">{error?.message || 'Unknown error occurred'}</p>
    {retry && (
      <button
        onClick={retry}
        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
      >
        Retry
      </button>
    )}
  </div>
);

// Set display names for better debugging
LazyMediaGrid.displayName = 'LazyMediaGrid';
LazyAdvancedSearchFilters.displayName = 'LazyAdvancedSearchFilters';
LazyPlexDashboard.displayName = 'LazyPlexDashboard';
LazyMetricsChart.displayName = 'LazyMetricsChart';
LazyAdminPanel.displayName = 'LazyAdminPanel';
LazySettingsPanel.displayName = 'LazySettingsPanel';
