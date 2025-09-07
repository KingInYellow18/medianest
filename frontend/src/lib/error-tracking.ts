import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import { User } from '@sentry/types';

export interface FrontendSentryConfig {
  dsn: string;
  environment: string;
  debug: boolean;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
  maxBreadcrumbs: number;
  attachStacktrace: boolean;
}

export class FrontendErrorTracking {
  private config: FrontendSentryConfig;
  private initialized = false;

  constructor() {
    this.config = {
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
      environment: process.env.NODE_ENV || 'development',
      debug: process.env.NODE_ENV === 'development',
      tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      replaysSessionSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE || '0.01'),
      replaysOnErrorSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ERROR_SAMPLE_RATE || '1.0'),
      maxBreadcrumbs: 100,
      attachStacktrace: true,
    };
  }

  /**
   * Initialize Sentry for frontend
   */
  initialize(): void {
    if (this.initialized || !this.config.dsn) {
      return;
    }

    Sentry.init({
      dsn: this.config.dsn,
      environment: this.config.environment,
      debug: this.config.debug,
      tracesSampleRate: this.config.tracesSampleRate,
      maxBreadcrumbs: this.config.maxBreadcrumbs,
      attachStacktrace: this.config.attachStacktrace,
      integrations: [
        // Browser tracing for performance
        new BrowserTracing({
          tracePropagationTargets: [
            'localhost',
            /^https:\/\/api\.yourapp\.com/,
            /^\/api/,
          ],
        }),
        // Session replay for debugging
        new Sentry.Replay({
          maskAllText: false,
          maskAllInputs: false,
          blockAllMedia: false,
        }),
      ],
      replaysSessionSampleRate: this.config.replaysSessionSampleRate,
      replaysOnErrorSampleRate: this.config.replaysOnErrorSampleRate,
      beforeSend(event) {
        // Filter out sensitive data
        if (event.request) {
          delete event.request.cookies;
        }
        
        // Don't send events for certain errors
        if (event.exception) {
          const error = event.exception.values?.[0];
          if (error?.type === 'ChunkLoadError' || 
              error?.value?.includes('Loading chunk') ||
              error?.value?.includes('Network Error')) {
            return null;
          }
        }
        
        return event;
      },
    });

    this.initialized = true;
  }

  /**
   * Set user context
   */
  setUser(user: User): void {
    Sentry.setUser(user);
  }

  /**
   * Capture exception with context
   */
  captureException(error: Error, context?: any): string {
    return Sentry.captureException(error, {
      tags: context?.tags,
      extra: context?.extra,
      level: context?.level || 'error',
      fingerprint: context?.fingerprint,
    });
  }

  /**
   * Capture message
   */
  captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): string {
    return Sentry.captureMessage(message, level);
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    Sentry.addBreadcrumb(breadcrumb);
  }

  /**
   * Set tags
   */
  setTags(tags: { [key: string]: string }): void {
    Sentry.setTags(tags);
  }

  /**
   * Set extra context
   */
  setExtra(key: string, value: any): void {
    Sentry.setExtra(key, value);
  }

  /**
   * Track page view
   */
  trackPageView(pageName: string, url?: string): void {
    this.addBreadcrumb({
      message: `Page view: ${pageName}`,
      category: 'navigation',
      level: 'info',
      data: {
        page: pageName,
        url: url || window.location.href,
      },
    });
  }

  /**
   * Track user interaction
   */
  trackInteraction(action: string, element: string, extra?: any): void {
    this.addBreadcrumb({
      message: `User interaction: ${action}`,
      category: 'user',
      level: 'info',
      data: {
        action,
        element,
        ...extra,
      },
    });

    // Also track as custom event
    Sentry.addBreadcrumb({
      type: 'user',
      category: 'ui.click',
      message: `${action} on ${element}`,
      level: 'info',
      data: extra,
    });
  }

  /**
   * Track API call performance
   */
  trackApiCall(url: string, method: string, duration: number, status: number): void {
    const isError = status >= 400;
    
    this.addBreadcrumb({
      message: `API ${method} ${url}`,
      category: 'http',
      level: isError ? 'error' : 'info',
      data: {
        url,
        method,
        duration,
        status,
      },
    });

    if (isError) {
      this.captureMessage(`API Error: ${method} ${url} - ${status}`, 'warning');
    }
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metricName: string, value: number, unit: string): void {
    this.addBreadcrumb({
      message: `Performance: ${metricName}`,
      category: 'performance',
      level: 'info',
      data: {
        metric: metricName,
        value,
        unit,
      },
    });

    // Set as measurement for aggregation
    Sentry.setMeasurement(metricName, value, unit);
  }

  /**
   * Track custom event
   */
  trackEvent(eventName: string, properties?: Record<string, any>): void {
    this.addBreadcrumb({
      message: `Event: ${eventName}`,
      category: 'custom',
      level: 'info',
      data: properties,
    });
  }

  /**
   * Profile performance of async operations
   */
  async profileOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const transaction = Sentry.startTransaction({
      op: 'custom',
      name: operationName,
    });

    const startTime = performance.now();
    
    try {
      const result = await operation();
      transaction.setStatus('ok');
      return result;
    } catch (error) {
      transaction.setStatus('internal_error');
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      transaction.setMeasurement('duration', duration, 'millisecond');
      transaction.finish();
    }
  }

  /**
   * Flush events
   */
  async flush(timeout = 2000): Promise<boolean> {
    return Sentry.flush(timeout);
  }
}

// Export singleton instance
export const frontendErrorTracking = new FrontendErrorTracking();

// Export Sentry React components and hooks
export {
  Sentry,
  ErrorBoundary,
  withErrorBoundary,
  withSentryConfig,
  useSentryUser,
} from '@sentry/react';

// Export useful types
export type { User, Breadcrumb, SeverityLevel } from '@sentry/types';