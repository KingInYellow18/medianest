import { useEffect, useCallback, useRef } from 'react';
import { frontendErrorTracking } from '../lib/error-tracking';

export interface PerformanceMetrics {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
}

export interface NavigationMetrics {
  pageLoadTime: number;
  domContentLoaded: number;
  networkLatency: number;
  renderTime: number;
}

/**
 * Hook for monitoring Core Web Vitals and performance metrics
 */
export const usePerformanceMonitoring = (pageName?: string) => {
  const metricsRef = useRef<PerformanceMetrics>({});
  const observerRef = useRef<PerformanceObserver | null>(null);

  /**
   * Initialize performance monitoring
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    // Track page view
    if (pageName) {
      frontendErrorTracking.trackPageView(pageName);
    }

    // Observe LCP (Largest Contentful Paint)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEventTiming;
      
      if (lastEntry) {
        metricsRef.current.lcp = lastEntry.startTime;
        frontendErrorTracking.trackPerformance('lcp', lastEntry.startTime, 'millisecond');
      }
    });

    // Observe FID (First Input Delay)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries() as PerformanceEventTiming[];
      entries.forEach((entry) => {
        if (entry.processingStart > entry.startTime) {
          const fid = entry.processingStart - entry.startTime;
          metricsRef.current.fid = fid;
          frontendErrorTracking.trackPerformance('fid', fid, 'millisecond');
        }
      });
    });

    // Observe CLS (Cumulative Layout Shift)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries() as any[];
      entries.forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          metricsRef.current.cls = clsValue;
          frontendErrorTracking.trackPerformance('cls', clsValue, 'ratio');
        }
      });
    });

    // Observe FCP (First Contentful Paint)
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          metricsRef.current.fcp = entry.startTime;
          frontendErrorTracking.trackPerformance('fcp', entry.startTime, 'millisecond');
        }
      });
    });

    try {
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      fidObserver.observe({ entryTypes: ['first-input'] });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      fcpObserver.observe({ entryTypes: ['paint'] });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }

    // Store observers for cleanup
    observerRef.current = lcpObserver;

    return () => {
      lcpObserver.disconnect();
      fidObserver.disconnect();
      clsObserver.disconnect();
      fcpObserver.disconnect();
    };
  }, [pageName]);

  /**
   * Get navigation timing metrics
   */
  const getNavigationMetrics = useCallback((): NavigationMetrics | null => {
    if (typeof window === 'undefined' || !window.performance?.timing) {
      return null;
    }

    const timing = window.performance.timing;
    
    return {
      pageLoadTime: timing.loadEventEnd - timing.navigationStart,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      networkLatency: timing.responseStart - timing.fetchStart,
      renderTime: timing.loadEventEnd - timing.responseEnd,
    };
  }, []);

  /**
   * Track custom performance metric
   */
  const trackCustomMetric = useCallback((name: string, value: number, unit: string = 'millisecond') => {
    frontendErrorTracking.trackPerformance(name, value, unit);
  }, []);

  /**
   * Track user interaction performance
   */
  const trackInteractionPerformance = useCallback((
    interaction: string, 
    startTime: number,
    element?: string
  ) => {
    const duration = performance.now() - startTime;
    
    frontendErrorTracking.trackInteraction(interaction, element || 'unknown', {
      duration,
      performance: true,
    });

    // Track slow interactions
    if (duration > 100) { // 100ms threshold for responsiveness
      frontendErrorTracking.captureMessage(
        `Slow interaction: ${interaction} took ${duration}ms`,
        'warning'
      );
    }
  }, []);

  /**
   * Track API call performance
   */
  const trackApiPerformance = useCallback((
    url: string,
    method: string,
    startTime: number,
    status: number,
    responseSize?: number
  ) => {
    const duration = performance.now() - startTime;
    
    frontendErrorTracking.trackApiCall(url, method, duration, status);
    
    // Track additional metrics
    if (responseSize) {
      trackCustomMetric(`api_response_size_${method.toLowerCase()}`, responseSize, 'bytes');
    }
    
    if (duration > 2000) { // 2s threshold for API calls
      frontendErrorTracking.captureMessage(
        `Slow API call: ${method} ${url} took ${duration}ms`,
        'warning'
      );
    }
  }, [trackCustomMetric]);

  /**
   * Track resource loading performance
   */
  const trackResourcePerformance = useCallback(() => {
    if (typeof window === 'undefined' || !window.performance?.getEntriesByType) {
      return;
    }

    const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    resources.forEach((resource) => {
      const duration = resource.responseEnd - resource.startTime;
      const resourceType = resource.initiatorType || 'unknown';
      
      // Track large resources
      if (resource.transferSize && resource.transferSize > 100000) { // 100KB
        trackCustomMetric(
          `large_resource_${resourceType}`,
          resource.transferSize,
          'bytes'
        );
      }
      
      // Track slow resources
      if (duration > 1000) { // 1s
        frontendErrorTracking.captureMessage(
          `Slow resource load: ${resource.name} took ${duration}ms`,
          'info'
        );
      }
    });
  }, [trackCustomMetric]);

  /**
   * Get current performance metrics
   */
  const getCurrentMetrics = useCallback((): PerformanceMetrics => {
    return { ...metricsRef.current };
  }, []);

  /**
   * Track page visibility changes
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        frontendErrorTracking.trackEvent('page_hidden', { pageName });
      } else {
        frontendErrorTracking.trackEvent('page_visible', { pageName });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pageName]);

  return {
    getCurrentMetrics,
    getNavigationMetrics,
    trackCustomMetric,
    trackInteractionPerformance,
    trackApiPerformance,
    trackResourcePerformance,
    metrics: metricsRef.current,
  };
};

/**
 * Hook for measuring component render performance
 */
export const useRenderPerformance = (componentName: string) => {
  const renderStartRef = useRef<number>(0);
  
  useEffect(() => {
    renderStartRef.current = performance.now();
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStartRef.current;
    
    if (renderTime > 16) { // 16ms threshold (60fps)
      frontendErrorTracking.trackPerformance(
        `component_render_${componentName}`,
        renderTime,
        'millisecond'
      );
      
      if (renderTime > 100) { // Slow render threshold
        frontendErrorTracking.captureMessage(
          `Slow component render: ${componentName} took ${renderTime}ms`,
          'warning'
        );
      }
    }
  });
};

/**
 * Hook for tracking bundle size and loading performance
 */
export const useBundlePerformance = () => {
  useEffect(() => {
    // Track initial bundle load
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigationEntry) {
      const ttfb = navigationEntry.responseStart - navigationEntry.fetchStart;
      const domLoad = navigationEntry.domContentLoadedEventEnd - navigationEntry.fetchStart;
      const fullLoad = navigationEntry.loadEventEnd - navigationEntry.fetchStart;
      
      frontendErrorTracking.trackPerformance('ttfb', ttfb, 'millisecond');
      frontendErrorTracking.trackPerformance('dom_load', domLoad, 'millisecond');
      frontendErrorTracking.trackPerformance('full_load', fullLoad, 'millisecond');
    }
    
    // Track script loading
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach((script) => {
      const src = script.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        frontendErrorTracking.trackEvent('script_loaded', { src });
      }
    });
  }, []);
};

/**
 * Performance measurement decorator for functions
 */
export const withPerformanceTracking = <T extends (...args: any[]) => any>(
  fn: T,
  name: string
): T => {
  return ((...args: any[]) => {
    const start = performance.now();
    const result = fn(...args);
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start;
        frontendErrorTracking.trackPerformance(`function_${name}`, duration, 'millisecond');
      });
    } else {
      const duration = performance.now() - start;
      frontendErrorTracking.trackPerformance(`function_${name}`, duration, 'millisecond');
      return result;
    }
  }) as T;
};