interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
  metadata?: any;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  url?: string;
  metadata?: any;
}

class FrontendLogger {
  private correlationId?: string;
  private userId?: string;
  private sessionId: string;
  private logBuffer: LogEntry[] = [];
  private metricsBuffer: PerformanceMetric[] = [];
  private readonly maxBufferSize = 100;
  private readonly flushInterval = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startPerformanceMonitoring();
    this.setupFlushTimer();
    this.setupErrorHandling();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private setupErrorHandling() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.error('Global error caught', {
        message: event.error?.message || event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        type: 'javascript_error',
      });
    });

    // Promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', {
        reason: event.reason,
        type: 'promise_rejection',
      });
    });
  }

  private startPerformanceMonitoring() {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // Monitor page load performance
      window.addEventListener('load', () => {
        setTimeout(() => {
          this.collectPageLoadMetrics();
        }, 0);
      });

      // Monitor navigation performance
      this.observeNavigationTiming();

      // Monitor Core Web Vitals
      this.observeCoreWebVitals();
    }
  }

  private collectPageLoadMetrics() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    if (navigation) {
      const metrics = [
        { name: 'dns_lookup', value: navigation.domainLookupEnd - navigation.domainLookupStart },
        { name: 'tcp_connect', value: navigation.connectEnd - navigation.connectStart },
        { name: 'server_response', value: navigation.responseEnd - navigation.requestStart },
        { name: 'dom_parse', value: navigation.domContentLoadedEventEnd - navigation.responseEnd },
        { name: 'page_load', value: navigation.loadEventEnd - navigation.navigationStart },
        {
          name: 'dom_ready',
          value: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        },
      ];

      metrics.forEach((metric) => {
        if (metric.value > 0) {
          this.recordMetric(metric.name, metric.value, 'ms', {
            type: 'page_load',
            url: window.location.href,
          });
        }
      });
    }
  }

  private observeNavigationTiming() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const nav = entry as PerformanceNavigationTiming;
            this.recordMetric('page_load_time', nav.loadEventEnd - nav.navigationStart, 'ms');
          }
        });
      });

      try {
        observer.observe({ entryTypes: ['navigation'] });
      } catch (e) {
        // Ignore if not supported
      }
    }
  }

  private observeCoreWebVitals() {
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric('lcp', lastEntry.startTime, 'ms', { type: 'core_web_vital' });
      });

      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        // Ignore if not supported
      }

      // First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          const fid = (entry as any).processingStart - entry.startTime;
          this.recordMetric('fid', fid, 'ms', { type: 'core_web_vital' });
        });
      });

      try {
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        // Ignore if not supported
      }

      // Cumulative Layout Shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            this.recordMetric('cls', clsValue, 'score', { type: 'core_web_vital' });
          }
        });
      });

      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        // Ignore if not supported
      }
    }
  }

  setCorrelationId(correlationId: string) {
    this.correlationId = correlationId;
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  private createLogEntry(level: LogEntry['level'], message: string, metadata?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.correlationId,
      userId: this.userId,
      sessionId: this.sessionId,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      metadata,
    };
  }

  debug(message: string, metadata?: any) {
    const entry = this.createLogEntry('debug', message, metadata);
    this.addToBuffer(entry);
    if (process.env.NODE_ENV === 'development') {
      console.debug('[DEBUG]', message, metadata);
    }
  }

  info(message: string, metadata?: any) {
    const entry = this.createLogEntry('info', message, metadata);
    this.addToBuffer(entry);
    if (process.env.NODE_ENV === 'development') {
      console.info('[INFO]', message, metadata);
    }
  }

  warn(message: string, metadata?: any) {
    const entry = this.createLogEntry('warn', message, metadata);
    this.addToBuffer(entry);
    console.warn('[WARN]', message, metadata);
  }

  error(message: string, metadata?: any) {
    const entry = this.createLogEntry('error', message, metadata);
    this.addToBuffer(entry);
    console.error('[ERROR]', message, metadata);

    // Immediately flush errors
    this.flush();
  }

  recordMetric(name: string, value: number, unit: string, metadata?: any) {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      metadata,
    };

    this.metricsBuffer.push(metric);

    if (this.metricsBuffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  // Track user interactions
  trackUserInteraction(action: string, element?: string, metadata?: any) {
    this.info('User interaction', {
      action,
      element,
      type: 'user_interaction',
      ...metadata,
    });
  }

  // Track API calls
  trackApiCall(url: string, method: string, statusCode?: number, duration?: number, error?: any) {
    const level = error || (statusCode && statusCode >= 400) ? 'error' : 'info';
    const message = error ? 'API call failed' : 'API call completed';

    this[level](message, {
      url: url.replace(/([?&](api_key|token)=)[^&]+/g, '$1[REDACTED]'), // Redact sensitive params
      method,
      statusCode,
      duration: duration ? `${duration}ms` : undefined,
      error: error?.message,
      type: 'api_call',
    });
  }

  // Track page views
  trackPageView(page: string, metadata?: any) {
    this.info('Page view', {
      page,
      type: 'page_view',
      ...metadata,
    });
  }

  private addToBuffer(entry: LogEntry) {
    this.logBuffer.push(entry);

    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  private async flush() {
    if (this.logBuffer.length === 0 && this.metricsBuffer.length === 0) {
      return;
    }

    const payload = {
      logs: [...this.logBuffer],
      metrics: [...this.metricsBuffer],
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    };

    // Clear buffers
    this.logBuffer = [];
    this.metricsBuffer = [];

    try {
      // Send to backend logging endpoint
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.correlationId && { 'X-Correlation-ID': this.correlationId }),
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // Silently fail to avoid infinite loops
      console.error('Failed to send logs to backend:', error);
    }
  }

  // Cleanup method
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(); // Final flush
  }
}

// Create singleton instance
const logger = new FrontendLogger();

// Export both the instance and the class
export default logger;
export { FrontendLogger };

// Convenience methods for direct use
export const debug = (message: string, metadata?: any) => logger.debug(message, metadata);
export const info = (message: string, metadata?: any) => logger.info(message, metadata);
export const warn = (message: string, metadata?: any) => logger.warn(message, metadata);
export const error = (message: string, metadata?: any) => logger.error(message, metadata);
export const trackUserInteraction = (action: string, element?: string, metadata?: any) =>
  logger.trackUserInteraction(action, element, metadata);
export const trackApiCall = (
  url: string,
  method: string,
  statusCode?: number,
  duration?: number,
  error?: any
) => logger.trackApiCall(url, method, statusCode, duration, error);
export const trackPageView = (page: string, metadata?: any) => logger.trackPageView(page, metadata);
export const recordMetric = (name: string, value: number, unit: string, metadata?: any) =>
  logger.recordMetric(name, value, unit, metadata);
export const setCorrelationId = (correlationId: string) => logger.setCorrelationId(correlationId);
export const setUserId = (userId: string) => logger.setUserId(userId);
