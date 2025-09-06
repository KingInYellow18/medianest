import { Request, Response, NextFunction } from 'express';
import { AppError } from '@medianest/shared';
import { logger } from '../utils/logger';
import { errorRecoveryManager } from '../utils/error-recovery';
import { healthMonitor } from '../services/health-monitor.service';

export interface ErrorContext {
  correlationId?: string;
  userId?: string;
  operation: string;
  service?: string;
  metadata?: Record<string, any>;
}

// Global error handler
export function globalErrorHandler() {
  return async (error: Error, req: Request, res: Response, next: NextFunction) => {
    // Avoid multiple error handling
    if (res.headersSent) {
      return next(error);
    }

    // Track error metrics
    healthMonitor.trackRequest(0, true);

    // Generate correlation ID if not present
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build error context
    const errorContext: ErrorContext = {
      correlationId,
      userId: (req as any).user?.id,
      operation: `${req.method} ${req.path}`,
      service: 'backend-api',
      metadata: {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        body: req.method !== 'GET' ? req.body : undefined,
        query: req.query,
        params: req.params,
        headers: sanitizeHeaders(req.headers),
      },
    };

    // Log error with context
    logger.error('Request error occurred', {
      error: error.message,
      stack: error.stack,
      context: errorContext,
      correlationId,
    });

    // Determine error type and response
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';
    let shouldAttemptRecovery = false;

    if (error instanceof AppError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
      errorCode = error.code || 'APP_ERROR';
      shouldAttemptRecovery = error.statusCode >= 500;
    } else if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = 'Validation failed';
      errorCode = 'VALIDATION_ERROR';
    } else if (error.name === 'UnauthorizedError') {
      statusCode = 401;
      errorMessage = 'Unauthorized';
      errorCode = 'UNAUTHORIZED';
    } else if (error.name === 'ForbiddenError') {
      statusCode = 403;
      errorMessage = 'Forbidden';
      errorCode = 'FORBIDDEN';
    } else if (error.name === 'NotFoundError') {
      statusCode = 404;
      errorMessage = 'Resource not found';
      errorCode = 'NOT_FOUND';
    } else if (error.name === 'TimeoutError') {
      statusCode = 408;
      errorMessage = 'Request timeout';
      errorCode = 'TIMEOUT';
      shouldAttemptRecovery = true;
    } else if (error.name === 'CircuitBreakerError') {
      statusCode = 503;
      errorMessage = 'Service temporarily unavailable';
      errorCode = 'SERVICE_UNAVAILABLE';
      shouldAttemptRecovery = true;
    } else if (error.name === 'BulkheadError') {
      statusCode = 429;
      errorMessage = 'Too many concurrent requests';
      errorCode = 'RATE_LIMIT_EXCEEDED';
    } else {
      // Unexpected server errors
      shouldAttemptRecovery = statusCode >= 500;
    }

    // Attempt error recovery for server errors
    if (shouldAttemptRecovery) {
      try {
        const recoveryResult = await errorRecoveryManager.executeRecovery(error, {
          operation: errorContext.operation,
          service: errorContext.service,
          correlationId: errorContext.correlationId,
          userId: errorContext.userId,
          metadata: {
            ...errorContext.metadata,
            fallbackToCache: true,
            cacheKey: `response:${req.method}:${req.path}:${JSON.stringify(req.query)}`,
            defaultResponse: getDefaultResponse(req.path, req.method),
            enableGracefulDegradation: true,
            degradedFeatures: getAvailableFeaturesInDegradedMode(req.path),
          },
          timestamp: new Date(),
        });

        logger.info('Error recovery successful', {
          correlationId,
          originalError: error.message,
          recoveryResult: typeof recoveryResult,
        });

        return res.status(200).json({
          success: true,
          data: recoveryResult,
          recovered: true,
          message: 'Request recovered through fallback mechanism',
          correlationId,
          timestamp: new Date(),
        });
      } catch (recoveryError) {
        logger.warn('Error recovery failed', {
          correlationId,
          originalError: error.message,
          recoveryError: (recoveryError as Error).message,
        });

        // Continue with original error response
      }
    }

    // Build error response
    const errorResponse = {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      correlationId,
      timestamp: new Date(),
      path: req.path,
      method: req.method,
    };

    // Add recovery suggestions for certain error types
    if (statusCode === 503) {
      errorResponse.error.message += '. Please try again in a few moments.';
      (errorResponse as any).retryAfter = getRetryAfterSeconds(error);
    } else if (statusCode === 429) {
      (errorResponse as any).retryAfter = 60; // 1 minute
    }

    res.status(statusCode).json(errorResponse);
  };
}

// Not found handler
export function notFoundHandler() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const error = new AppError(`Route ${req.method} ${req.path} not found`, 404, 'ROUTE_NOT_FOUND');
    next(error);
  };
}

// Async error wrapper
export function asyncErrorHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Validation error handler
export function validationErrorHandler() {
  return (error: any, _req: Request, _res: Response, next: NextFunction) => {
    if (error.name === 'ZodError') {
      const validationError = new AppError('Validation failed', 400, 'VALIDATION_ERROR');

      // Add validation details
      (validationError as any).details = {
        errors: error.errors.map((err: any) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
      };

      return next(validationError);
    }
    next(error);
  };
}

// Rate limiting error handler
export function rateLimitErrorHandler() {
  return (error: any, req: Request, _res: Response, next: NextFunction) => {
    if (error.name === 'RateLimitError' || error.code === 'RATE_LIMIT_EXCEEDED') {
      const rateLimitError = new AppError(
        'Too many requests, please try again later',
        429,
        'RATE_LIMIT_EXCEEDED',
      );

      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
      });

      return next(rateLimitError);
    }
    next(error);
  };
}

// Database error handler
export function databaseErrorHandler() {
  return (error: any, _req: Request, _res: Response, next: NextFunction) => {
    // Prisma errors
    if (error.code && error.code.startsWith('P')) {
      let message = 'Database operation failed';
      let statusCode = 500;

      switch (error.code) {
        case 'P2002': // Unique constraint violation
          message = 'Resource already exists';
          statusCode = 409;
          break;
        case 'P2025': // Record not found
          message = 'Resource not found';
          statusCode = 404;
          break;
        case 'P2003': // Foreign key constraint violation
          message = 'Invalid reference to related resource';
          statusCode = 400;
          break;
        case 'P1001': // Database unreachable
        case 'P1002': // Database timeout
          message = 'Database temporarily unavailable';
          statusCode = 503;
          break;
      }

      const dbError = new AppError(message, statusCode, 'DATABASE_ERROR');
      return next(dbError);
    }

    // Generic database connection errors
    if (
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('database')
    ) {
      const dbError = new AppError('Database connection failed', 503, 'DATABASE_CONNECTION_ERROR');
      return next(dbError);
    }

    next(error);
  };
}

// Authentication error handler
export function authErrorHandler() {
  return (error: any, _req: Request, _res: Response, next: NextFunction) => {
    if (error.name === 'JsonWebTokenError') {
      const authError = new AppError('Invalid authentication token', 401, 'INVALID_TOKEN');
      return next(authError);
    }

    if (error.name === 'TokenExpiredError') {
      const authError = new AppError('Authentication token expired', 401, 'TOKEN_EXPIRED');
      return next(authError);
    }

    if (error.name === 'NotBeforeError') {
      const authError = new AppError(
        'Authentication token not active yet',
        401,
        'TOKEN_NOT_ACTIVE',
      );
      return next(authError);
    }

    next(error);
  };
}

// Helper functions
function sanitizeHeaders(headers: any): Record<string, any> {
  const sanitized = { ...headers };
  const sensitiveKeys = ['authorization', 'cookie', 'x-api-key'];

  sensitiveKeys.forEach((key) => {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  });

  return sanitized;
}

function getDefaultResponse(path: string, _method: string): any {
  // Return appropriate default responses based on path
  if (path.includes('/users')) {
    return { users: [], message: 'User service temporarily unavailable' };
  } else if (path.includes('/media')) {
    return { media: [], message: 'Media service temporarily unavailable' };
  } else if (path.includes('/dashboard')) {
    return { metrics: {}, message: 'Dashboard temporarily unavailable' };
  }

  return { message: 'Service temporarily unavailable' };
}

function getAvailableFeaturesInDegradedMode(path: string): string[] {
  // Define which features are available in degraded mode
  const degradedFeatures: Record<string, string[]> = {
    '/users': ['basic-info', 'authentication'],
    '/media': ['cached-content', 'search-history'],
    '/dashboard': ['basic-metrics', 'cached-stats'],
  };

  for (const [route, features] of Object.entries(degradedFeatures)) {
    if (path.includes(route)) {
      return features;
    }
  }

  return ['basic-functionality'];
}

function getRetryAfterSeconds(error: Error): number {
  // Return appropriate retry delay based on error type
  if (error.name === 'CircuitBreakerError') {
    // Extract retry time from circuit breaker error message
    const match = error.message.match(/Next retry at: (.+)/);
    if (match) {
      const retryTime = new Date(match[1]).getTime();
      const now = Date.now();
      return Math.max(0, Math.ceil((retryTime - now) / 1000));
    }
    return 30; // Default 30 seconds
  } else if (error.message.includes('timeout')) {
    return 5; // 5 seconds for timeout errors
  } else if (error.message.includes('database')) {
    return 60; // 1 minute for database errors
  }

  return 30; // Default retry after 30 seconds
}
