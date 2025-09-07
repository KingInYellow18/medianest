// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import { sentryService } from '../config/sentry';
import { logger as Logger } from '../utils/logger';

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  endpoint?: string;
  method?: string;
  body?: any;
  query?: any;
  params?: any;
}

export class ErrorTrackingMiddleware {
  private logger: typeof Logger;

  constructor(logger: typeof Logger) {
    this.logger = logger;
  }

  /**
   * Middleware to capture request context for error tracking
   */
  captureContext() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add context to Sentry scope
      sentryService.setTags({
        method: req.method,
        endpoint: req.route?.path || req.path,
        userAgent: req.get('user-agent') || 'unknown',
      });

      sentryService.setExtra('request', {
        url: req.url,
        method: req.method,
        headers: this.sanitizeHeaders(req.headers),
        query: req.query,
        params: req.params,
        body: this.sanitizeBody(req.body),
        ip: req.ip,
      });

      // Set user context if available
      if (req.user) {
        sentryService.setUser({
          id: req.user.id?.toString(),
          email: (req.user as any).email,
          username: (req.user as any).username,
          ip_address: req.ip,
        });
      }

      // Add breadcrumb for request
      sentryService.addBreadcrumb({
        message: `${req.method} ${req.path}`,
        category: 'http',
        level: 'info',
        data: {
          method: req.method,
          url: req.url,
          user_id: req.user?.id,
        },
      });

      next();
    };
  }

  /**
   * Error handling middleware with comprehensive logging
   */
  handleError() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const context: ErrorContext = {
        userId: req.user?.id?.toString(),
        requestId: req.headers['x-request-id'] as string,
        userAgent: req.get('user-agent'),
        ip: req.ip,
        endpoint: req.route?.path || req.path,
        method: req.method,
        body: this.sanitizeBody(req.body),
        query: req.query,
        params: req.params,
      };

      // Determine error severity
      const statusCode = (error as any).statusCode || (error as any).status || 500;
      const severity = this.getSeverityLevel(statusCode);

      // Log error with context
      this.logger.error('Request error', {
        error: {
          name: error.name,
          message: error.message as any,
          stack: error.stack as any,
          statusCode,
        },
        context,
      });

      // Capture in Sentry with enriched context
      const sentryId = sentryService.captureException(error, {
        level: severity,
        tags: {
          statusCode: statusCode.toString(),
          endpoint: context.endpoint,
          method: context.method,
        },
        extra: {
          context,
          errorDetails: {
            name: error.name,
            message: error.message as any,
            stack: error.stack as any,
          },
        },
        user: context.userId
          ? {
              id: context.userId,
              ip_address: context.ip,
            }
          : undefined,
      });

      // Add Sentry ID to response headers for debugging
      if (sentryId) {
        res.set('X-Sentry-ID', sentryId);
      }

      // Send appropriate error response
      if (!res.headersSent) {
        const errorResponse = this.createErrorResponse(error, statusCode, sentryId);
        res.status(statusCode).json(errorResponse);
      }

      next();
    };
  }

  /**
   * Performance monitoring middleware
   */
  monitorPerformance() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const transaction = sentryService.startTransaction(
        `${req.method} ${req.route?.path || req.path}`,
        'http.server',
        `${req.method} ${req.url}`,
      );

      // Store transaction for later use
      (req as any).sentryTransaction = transaction;

      // Monitor response
      const originalSend = res.send;
      res.send = function (body) {
        const duration = Date.now() - startTime;

        // Set transaction data
        transaction.setHttpStatus(res.statusCode);
        transaction.setData('response.size', Buffer.byteLength(body || ''));
        transaction.setData('duration', duration);
        transaction.setData('user.id', req.user?.id);

        // Add performance breadcrumb
        sentryService.addBreadcrumb({
          message: `Response sent: ${res.statusCode}`,
          category: 'http',
          level: res.statusCode >= 400 ? 'warning' : 'info',
          data: {
            status: res.statusCode,
            duration,
            size: Buffer.byteLength(body || ''),
          },
        });

        // Log slow requests
        if (duration > 1000) {
          sentryService.captureMessage(
            `Slow request: ${req.method} ${req.path} took ${duration}ms`,
            'warning',
          );
        }

        transaction.finish();
        return originalSend.call(this, body);
      };

      next();
    };
  }

  /**
   * Database query monitoring wrapper
   */
  monitorDatabaseQuery<T>(
    queryName: string,
    operation: string,
    query: () => Promise<T>,
  ): Promise<T> {
    return sentryService.wrapDatabaseQuery(queryName, operation, query);
  }

  /**
   * Async error catcher for route handlers
   */
  asyncErrorCatcher(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Rate limiting error handler
   */
  handleRateLimitError() {
    return (req: Request, res: Response, next: NextFunction) => {
      sentryService.captureMessage(`Rate limit exceeded for IP: ${req.ip}`, 'warning');

      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: res.get('Retry-After'),
      });
    };
  }

  /**
   * Validation error handler
   */
  handleValidationError() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      if (error.name === 'ValidationError' || error.type === 'validation') {
        sentryService.captureException(error, {
          level: 'warning',
          tags: { errorType: 'validation' },
          extra: { validationErrors: error.errors },
        });

        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: error.errors,
        });
        return;
      }

      next(error);
    };
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.secret;
    delete sanitized.apiKey;
    return sanitized;
  }

  private getSeverityLevel(statusCode: number): 'error' | 'warning' | 'info' {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warning';
    return 'info';
  }

  private createErrorResponse(error: Error, statusCode: number, sentryId?: string) {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      error: error.name || 'Error',
      message: (error.message as any) || 'An error occurred',
      statusCode,
      ...(sentryId && { sentryId }),
      ...(!isProduction && {
        stack: error.stack as any,
        details: (error as any).details,
      }),
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const errorTrackingMiddleware = new ErrorTrackingMiddleware(new Logger('ErrorTracking'));
