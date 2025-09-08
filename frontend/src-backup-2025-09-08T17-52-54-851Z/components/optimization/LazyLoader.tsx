/**
 * Advanced Lazy Loading Component
 *
 * Provides intelligent lazy loading with intersection observer,
 * preloading capabilities, and performance monitoring.
 */

'use client';

import React, {
  Suspense,
  lazy,
  ComponentType,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from 'react';

import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { perfMonitor } from '@/lib/optimization/tree-shaking';

// ========================================
// LOADING COMPONENTS
// ========================================

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <div
        className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 ${sizeClasses[size]}`}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
};

interface LoadingCardProps {
  height?: string;
  className?: string;
  children?: ReactNode;
}

const LoadingCard: React.FC<LoadingCardProps> = ({ height = 'h-64', className = '', children }) => (
  <div
    className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${height} flex items-center justify-center ${className}`}
  >
    {children || (
      <div className="text-gray-500 dark:text-gray-400 text-sm">Loading component...</div>
    )}
  </div>
);

const LoadingSkeleton: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => (
  <div className={`animate-pulse space-y-3 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
        style={{ width: `${Math.random() * 40 + 60}%` }}
      />
    ))}
  </div>
);

// ========================================
// LAZY LOADING STRATEGIES
// ========================================

export type LazyStrategy =
  | 'immediate' // Load immediately
  | 'viewport' // Load when in viewport
  | 'interaction' // Load on user interaction
  | 'idle' // Load when browser is idle
  | 'delay'; // Load after a delay

export interface LazyLoaderProps {
  strategy?: LazyStrategy;
  delay?: number;
  threshold?: number;
  rootMargin?: string;
  fallback?: ComponentType;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  preload?: boolean;
  className?: string;
  children?: ReactNode;
}

// ========================================
// VIEWPORT-BASED LAZY LOADER
// ========================================

export const ViewportLazyLoader: React.FC<
  LazyLoaderProps & {
    loader: () => Promise<{ default: ComponentType<any> }>;
    componentProps?: any;
  }
> = ({
  loader,
  componentProps = {},
  threshold = 0.1,
  rootMargin = '100px',
  fallback: Fallback = LoadingSpinner,
  onLoad,
  onError,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [Component, setComponent] = useState<ComponentType<any> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Use intersection observer to detect visibility
  useIntersectionObserver(ref, {
    threshold,
    rootMargin,
    onIntersect: () => {
      if (!isVisible) {
        setIsVisible(true);
        perfMonitor.mark('lazy-load-start');
      }
    },
  });

  // Load component when visible
  useEffect(() => {
    if (isVisible && !Component && !error) {
      loader()
        .then(({ default: LoadedComponent }) => {
          setComponent(() => LoadedComponent);
          perfMonitor.mark('lazy-load-end');
          perfMonitor.measure('lazy-load-duration', 'lazy-load-start', 'lazy-load-end');
          onLoad?.();
        })
        .catch((err) => {
          setError(err);
          onError?.(err);
        });
    }
  }, [isVisible, Component, error, loader, onLoad, onError]);

  return (
    <div ref={ref} className={className}>
      {Component ? (
        <Component {...componentProps} />
      ) : error ? (
        <div className="p-4 text-red-600 bg-red-50 rounded-lg">
          Failed to load component: {error.message}
        </div>
      ) : (
        <Fallback />
      )}
    </div>
  );
};

// ========================================
// INTERACTION-BASED LAZY LOADER
// ========================================

export const InteractionLazyLoader: React.FC<
  LazyLoaderProps & {
    loader: () => Promise<{ default: ComponentType<any> }>;
    componentProps?: any;
    trigger?: 'click' | 'hover' | 'focus';
  }
> = ({
  loader,
  componentProps = {},
  trigger = 'click',
  fallback: Fallback = LoadingSpinner,
  onLoad,
  onError,
  className = '',
  children,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [Component, setComponent] = useState<ComponentType<any> | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const loadComponent = async () => {
    if (Component || isLoading || error) return;

    setIsLoading(true);
    perfMonitor.mark('interaction-load-start');

    try {
      const { default: LoadedComponent } = await loader();
      setComponent(() => LoadedComponent);
      perfMonitor.mark('interaction-load-end');
      perfMonitor.measure(
        'interaction-load-duration',
        'interaction-load-start',
        'interaction-load-end'
      );
      onLoad?.();
    } catch (err) {
      setError(err as Error);
      onError?.(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerProps = {
    [trigger === 'click' ? 'onClick' : trigger === 'hover' ? 'onMouseEnter' : 'onFocus']:
      loadComponent,
  };

  if (Component) {
    return <Component {...componentProps} />;
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg">
        Failed to load component: {error.message}
      </div>
    );
  }

  return (
    <div className={className} {...triggerProps}>
      {isLoading ? (
        <Fallback />
      ) : (
        children || (
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Load Component
          </button>
        )
      )}
    </div>
  );
};

// ========================================
// IDLE-BASED LAZY LOADER
// ========================================

export const IdleLazyLoader: React.FC<
  LazyLoaderProps & {
    loader: () => Promise<{ default: ComponentType<any> }>;
    componentProps?: any;
  }
> = ({
  loader,
  componentProps = {},
  fallback: Fallback = LoadingSpinner,
  onLoad,
  onError,
  className = '',
}) => {
  const [Component, setComponent] = useState<ComponentType<any> | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Use requestIdleCallback if available, fallback to setTimeout
    const loadWhenIdle = () => {
      perfMonitor.mark('idle-load-start');

      loader()
        .then(({ default: LoadedComponent }) => {
          setComponent(() => LoadedComponent);
          perfMonitor.mark('idle-load-end');
          perfMonitor.measure('idle-load-duration', 'idle-load-start', 'idle-load-end');
          onLoad?.();
        })
        .catch((err) => {
          setError(err);
          onError?.(err);
        });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(loadWhenIdle);
      return () => window.cancelIdleCallback(handle);
    } else {
      const timeout = setTimeout(loadWhenIdle, 100);
      return () => clearTimeout(timeout);
    }
  }, [loader, onLoad, onError]);

  return (
    <div className={className}>
      {Component ? (
        <Component {...componentProps} />
      ) : error ? (
        <div className="p-4 text-red-600 bg-red-50 rounded-lg">
          Failed to load component: {error.message}
        </div>
      ) : (
        <Fallback />
      )}
    </div>
  );
};

// ========================================
// UNIVERSAL LAZY LOADER
// ========================================

export const LazyLoader: React.FC<
  LazyLoaderProps & {
    loader: () => Promise<{ default: ComponentType<any> }>;
    componentProps?: any;
  }
> = ({ strategy = 'viewport', delay = 0, loader, componentProps, ...props }) => {
  // Add delay if specified
  const delayedLoader =
    delay > 0
      ? () =>
          new Promise<{ default: ComponentType<any> }>((resolve) => {
            setTimeout(() => {
              loader().then(resolve);
            }, delay);
          })
      : loader;

  switch (strategy) {
    case 'immediate':
      return (
        <Suspense fallback={<LoadingSpinner />}>
          <ImmediateLoader loader={delayedLoader} componentProps={componentProps} />
        </Suspense>
      );

    case 'viewport':
      return (
        <ViewportLazyLoader loader={delayedLoader} componentProps={componentProps} {...props} />
      );

    case 'interaction':
      return (
        <InteractionLazyLoader loader={delayedLoader} componentProps={componentProps} {...props} />
      );

    case 'idle':
      return <IdleLazyLoader loader={delayedLoader} componentProps={componentProps} {...props} />;

    case 'delay':
      return (
        <DelayedLoader
          loader={delayedLoader}
          componentProps={componentProps}
          delay={delay || 1000}
          {...props}
        />
      );

    default:
      return (
        <ViewportLazyLoader loader={delayedLoader} componentProps={componentProps} {...props} />
      );
  }
};

// ========================================
// HELPER COMPONENTS
// ========================================

const ImmediateLoader: React.FC<{
  loader: () => Promise<{ default: ComponentType<any> }>;
  componentProps?: any;
}> = ({ loader, componentProps }) => {
  const LazyComponent = lazy(loader);
  return <LazyComponent {...componentProps} />;
};

const DelayedLoader: React.FC<
  LazyLoaderProps & {
    loader: () => Promise<{ default: ComponentType<any> }>;
    componentProps?: any;
  }
> = ({
  loader,
  componentProps = {},
  delay = 1000,
  fallback: Fallback = LoadingSpinner,
  onLoad,
  onError,
  className = '',
}) => {
  const [Component, setComponent] = useState<ComponentType<any> | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      perfMonitor.mark('delay-load-start');

      loader()
        .then(({ default: LoadedComponent }) => {
          setComponent(() => LoadedComponent);
          perfMonitor.mark('delay-load-end');
          perfMonitor.measure('delay-load-duration', 'delay-load-start', 'delay-load-end');
          onLoad?.();
        })
        .catch((err) => {
          setError(err);
          onError?.(err);
        });
    }, delay);

    return () => clearTimeout(timeout);
  }, [loader, delay, onLoad, onError]);

  return (
    <div className={className}>
      {Component ? (
        <Component {...componentProps} />
      ) : error ? (
        <div className="p-4 text-red-600 bg-red-50 rounded-lg">
          Failed to load component: {error.message}
        </div>
      ) : (
        <Fallback />
      )}
    </div>
  );
};

// ========================================
// EXPORT LOADING COMPONENTS
// ========================================

export { LoadingSpinner, LoadingCard, LoadingSkeleton };

// ========================================
// PRELOADING UTILITIES
// ========================================

export const preloadComponent = (loader: () => Promise<any>) => {
  if (typeof window !== 'undefined') {
    // Preload when browser is idle
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        loader().catch(() => {
          // Silently fail for preloading
        });
      });
    } else {
      setTimeout(() => {
        loader().catch(() => {
          // Silently fail for preloading
        });
      }, 100);
    }
  }
};

// Preload multiple components
export const preloadComponents = (...loaders: (() => Promise<any>)[]) => {
  loaders.forEach(preloadComponent);
};
