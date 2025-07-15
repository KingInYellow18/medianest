import { logError, ErrorLogEntry, extractErrorDetails } from '@medianest/shared';

interface ErrorReportingConfig {
  enabled: boolean;
  endpoint?: string;
  sampleRate?: number;
  excludeErrors?: string[];
}

class ErrorLogger {
  private config: ErrorReportingConfig;
  private errorQueue: ErrorLogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: ErrorReportingConfig) {
    this.config = config;

    // Set up global error handlers
    if (typeof window !== 'undefined') {
      this.setupGlobalHandlers();
    }
  }

  private setupGlobalHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = new Error(event.reason?.message || 'Unhandled Promise Rejection');
      error.stack = event.reason?.stack;

      this.logError(error, {
        type: 'unhandledrejection',
        promise: event.promise,
      });
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      this.logError(event.error || new Error(event.message), {
        type: 'global',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });
  }

  logError(error: Error, context?: any): void {
    // Use shared error logger
    const entry = logError(error, context);

    // Check if we should report this error
    if (!this.shouldReportError(error)) {
      return;
    }

    // Add to queue
    this.errorQueue.push(entry);

    // Schedule flush
    this.scheduleFlush();
  }

  private shouldReportError(error: Error): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // Check sample rate
    if (this.config.sampleRate && Math.random() > this.config.sampleRate) {
      return false;
    }

    // Check excluded errors
    if (this.config.excludeErrors) {
      const errorMessage = error.message.toLowerCase();
      const shouldExclude = this.config.excludeErrors.some((pattern) =>
        errorMessage.includes(pattern.toLowerCase()),
      );
      if (shouldExclude) {
        return false;
      }
    }

    return true;
  }

  private scheduleFlush() {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flush();
    }, 5000); // Flush every 5 seconds
  }

  async flush(): Promise<void> {
    if (!this.config.endpoint || this.errorQueue.length === 0) {
      return;
    }

    const errors = [...this.errorQueue];
    this.errorQueue = [];
    this.flushTimer = undefined;

    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errors: errors.map((entry) => ({
            ...entry,
            error: extractErrorDetails(entry.error),
          })),
          timestamp: new Date().toISOString(),
          userAgent: window.navigator.userAgent,
          url: window.location.href,
        }),
      });
    } catch (error) {
      // Failed to report errors, re-add to queue
      this.errorQueue.unshift(...errors);
      console.error('Failed to report errors:', error);
    }
  }

  // Capture React component errors
  captureComponentError(error: Error, errorInfo: React.ErrorInfo): void {
    this.logError(error, {
      type: 'react-component',
      componentStack: errorInfo.componentStack,
    });
  }

  // Capture API errors
  captureApiError(error: Error, request: { url: string; method: string }): void {
    this.logError(error, {
      type: 'api',
      request,
    });
  }

  // Capture user actions that lead to errors
  captureUserAction(action: string, error: Error, metadata?: any): void {
    this.logError(error, {
      type: 'user-action',
      action,
      metadata,
    });
  }
}

// Create singleton instance
let errorLogger: ErrorLogger | null = null;

export function initializeErrorLogger(config: Partial<ErrorReportingConfig> = {}) {
  const defaultConfig: ErrorReportingConfig = {
    enabled: process.env.NODE_ENV === 'production',
    endpoint: process.env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT,
    sampleRate: 1.0, // Report 100% of errors by default
    excludeErrors: [
      'ResizeObserver loop limit exceeded', // Common browser warning
      'Non-Error promise rejection captured', // Generic promise rejections
      'Network request failed', // Generic network errors
    ],
    ...config,
  };

  errorLogger = new ErrorLogger(defaultConfig);
  return errorLogger;
}

export function getErrorLogger(): ErrorLogger {
  if (!errorLogger) {
    errorLogger = initializeErrorLogger();
  }
  return errorLogger;
}

// Export convenience methods
export const captureError = (error: Error, context?: any) =>
  getErrorLogger().logError(error, context);

export const captureComponentError = (error: Error, errorInfo: React.ErrorInfo) =>
  getErrorLogger().captureComponentError(error, errorInfo);

export const captureApiError = (error: Error, request: { url: string; method: string }) =>
  getErrorLogger().captureApiError(error, request);

export const captureUserAction = (action: string, error: Error, metadata?: any) =>
  getErrorLogger().captureUserAction(action, error, metadata);
