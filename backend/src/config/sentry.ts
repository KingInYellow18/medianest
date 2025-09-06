import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Request, Response, NextFunction } from 'express';

export interface SentryConfig {
  dsn: string;
  environment: string;
  debug: boolean;
  tracesSampleRate: number;
  profilesSampleRate: number;
  maxBreadcrumbs: number;
  attachStacktrace: boolean;
  enableTracing: boolean;
}

export class SentryService {
  private config: SentryConfig;
  private initialized = false;

  constructor() {
    this.config = {
      dsn: process.env.SENTRY_DSN || '',
      environment: process.env.NODE_ENV || 'development',
      debug: process.env.NODE_ENV === 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
      maxBreadcrumbs: 100,
      attachStacktrace: true,
      enableTracing: true,
    };
  }

  /**
   * Initialize Sentry with comprehensive configuration
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
      profilesSampleRate: this.config.profilesSampleRate,
      maxBreadcrumbs: this.config.maxBreadcrumbs,
      attachStacktrace: this.config.attachStacktrace,
      integrations: [
        // Node.js performance profiling
        nodeProfilingIntegration(),
        // HTTP request tracking
        new Sentry.Integrations.Http({ tracing: true }),
        // Express.js integration
        new Sentry.Integrations.Express({ app: undefined }),
        // Console integration for logging
        new Sentry.Integrations.Console(),
        // Local variables in stack traces
        new Sentry.Integrations.LocalVariables({
          captureAllExceptions: false,
        }),
      ],
      beforeSend(event) {
        // Filter out sensitive data
        if (event.request) {
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
        }
        return event;
      },
      beforeSendTransaction(event) {
        // Filter sensitive transaction data
        return event;
      },
    });

    this.initialized = true;
  }

  /**
   * Express.js request handler middleware
   */
  requestHandler() {
    return Sentry.Handlers.requestHandler({
      user: ['id', 'email', 'username'],
      request: ['method', 'url', 'headers', 'query_string'],
      transaction: 'methodPath',
    });
  }

  /**
   * Express.js tracing handler middleware
   */
  tracingHandler() {
    return Sentry.Handlers.tracingHandler();
  }

  /**
   * Express.js error handler middleware
   */
  errorHandler() {
    return Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Only handle errors that should be reported
        return error.status !== 404;
      },
    });
  }

  /**
   * Capture exception with context
   */
  captureException(error: Error, context?: any): string {
    return Sentry.captureException(error, {
      tags: context?.tags,
      extra: context?.extra,
      user: context?.user,
      level: context?.level || 'error',
      fingerprint: context?.fingerprint,
    });
  }

  /**
   * Capture message with context
   */
  captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: any): string {
    return Sentry.captureMessage(message, level);
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    Sentry.addBreadcrumb(breadcrumb);
  }

  /**
   * Set user context
   */
  setUser(user: Sentry.User): void {
    Sentry.setUser(user);
  }

  /**
   * Set tags for filtering
   */
  setTags(tags: { [key: string]: string }): void {
    Sentry.setTags(tags);
  }

  /**
   * Set extra context data
   */
  setExtra(key: string, value: any): void {
    Sentry.setExtra(key, value);
  }

  /**
   * Create custom transaction for performance monitoring
   */
  startTransaction(name: string, op: string, description?: string): Sentry.Transaction {
    return Sentry.startTransaction({
      name,
      op,
      description,
    });
  }

  /**
   * Performance monitoring middleware for database queries
   */
  wrapDatabaseQuery<T>(
    queryName: string,
    operation: string,
    query: () => Promise<T>
  ): Promise<T> {
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
    const span = transaction?.startChild({
      op: 'db',
      description: `${operation}: ${queryName}`,
    });

    const startTime = Date.now();
    
    return query()
      .then(result => {
        span?.setStatus('ok');
        span?.setData('duration', Date.now() - startTime);
        return result;
      })
      .catch(error => {
        span?.setStatus('internal_error');
        span?.setData('error', error.message);
        throw error;
      })
      .finally(() => {
        span?.finish();
      });
  }

  /**
   * Custom performance monitoring for API endpoints
   */
  monitorEndpoint(name: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const transaction = Sentry.startTransaction({
        op: 'http.server',
        name: `${req.method} ${name}`,
        data: {
          url: req.url,
          method: req.method,
          'user.id': req.user?.id,
        },
      });

      // Add transaction to request for later use
      (req as any).sentryTransaction = transaction;

      // Monitor response
      const originalSend = res.send;
      res.send = function(body) {
        transaction.setHttpStatus(res.statusCode);
        transaction.setData('response.size', Buffer.byteLength(body || ''));
        transaction.finish();
        return originalSend.call(this, body);
      };

      next();
    };
  }

  /**
   * Flush events and wait for completion
   */
  async flush(timeout = 2000): Promise<boolean> {
    return Sentry.flush(timeout);
  }

  /**
   * Close Sentry client
   */
  async close(timeout = 2000): Promise<boolean> {
    return Sentry.close(timeout);
  }
}

// Export singleton instance
export const sentryService = new SentryService();

// Export Sentry SDK for direct usage
export { Sentry };