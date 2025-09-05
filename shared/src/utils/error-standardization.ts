import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger';

/**
 * Standardized error types with correlation ID support
 */
export interface StandardError {
  code: string;
  message: string;
  statusCode: number;
  correlationId: string;
  details?: any;
  retryAfter?: number;
  timestamp: Date;
  path?: string;
  userId?: string;
}

/**
 * Error categories for consistent handling
 */
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INTERNAL_SERVER = 'INTERNAL_SERVER',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
}

/**
 * Standardized error messages for consistent user experience
 */
export const ERROR_MESSAGES: Record<string, { message: string; category: ErrorCategory; statusCode: number }> = {
  // Authentication Errors
  AUTH_FAILED: {
    message: 'Authentication failed. Please log in again.',
    category: ErrorCategory.AUTHENTICATION,
    statusCode: 401,
  },
  PLEX_TOKEN_EXPIRED: {
    message: 'Your Plex session has expired. Please reconnect.',
    category: ErrorCategory.AUTHENTICATION,
    statusCode: 401,
  },
  INVALID_TOKEN: {
    message: 'Invalid authentication token.',
    category: ErrorCategory.AUTHENTICATION,
    statusCode: 401,
  },

  // Authorization Errors
  PERMISSION_DENIED: {
    message: "You don't have permission to perform this action.",
    category: ErrorCategory.AUTHORIZATION,
    statusCode: 403,
  },
  ADMIN_REQUIRED: {
    message: 'Admin access required for this operation.',
    category: ErrorCategory.AUTHORIZATION,
    statusCode: 403,
  },

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: {
    message: 'Too many requests. Please try again later.',
    category: ErrorCategory.RATE_LIMIT,
    statusCode: 429,
  },
  YOUTUBE_QUOTA_EXCEEDED: {
    message: 'Download limit reached. Try again in an hour.',
    category: ErrorCategory.RATE_LIMIT,
    statusCode: 429,
  },

  // Service Availability
  SERVICE_UNAVAILABLE: {
    message: 'This service is temporarily unavailable.',
    category: ErrorCategory.SERVICE_UNAVAILABLE,
    statusCode: 503,
  },
  PLEX_UNREACHABLE: {
    message: 'Cannot connect to Plex server. Please try again.',
    category: ErrorCategory.EXTERNAL_SERVICE,
    statusCode: 502,
  },
  OVERSEERR_DOWN: {
    message: 'Media requests are temporarily unavailable.',
    category: ErrorCategory.EXTERNAL_SERVICE,
    statusCode: 502,
  },
  DATABASE_ERROR: {
    message: 'Database operation failed. Please try again.',
    category: ErrorCategory.DATABASE,
    statusCode: 500,
  },

  // Validation Errors
  VALIDATION_ERROR: {
    message: 'Invalid request data provided.',
    category: ErrorCategory.VALIDATION,
    statusCode: 400,
  },
  INVALID_YOUTUBE_URL: {
    message: 'Please provide a valid YouTube playlist URL.',
    category: ErrorCategory.VALIDATION,
    statusCode: 400,
  },
  MISSING_REQUIRED_FIELD: {
    message: 'Required field is missing from request.',
    category: ErrorCategory.VALIDATION,
    statusCode: 400,
  },

  // Resource Errors
  NOT_FOUND: {
    message: 'The requested resource was not found.',
    category: ErrorCategory.NOT_FOUND,
    statusCode: 404,
  },
  USER_NOT_FOUND: {
    message: 'User not found.',
    category: ErrorCategory.NOT_FOUND,
    statusCode: 404,
  },
  MEDIA_NOT_FOUND: {
    message: 'Media not found in library.',
    category: ErrorCategory.NOT_FOUND,
    statusCode: 404,
  },

  // Generic Errors
  INTERNAL_ERROR: {
    message: 'An unexpected error occurred. Please try again.',
    category: ErrorCategory.INTERNAL_SERVER,
    statusCode: 500,
  },
  NETWORK_ERROR: {
    message: 'Network error occurred. Please check your connection.',
    category: ErrorCategory.NETWORK,
    statusCode: 502,
  },
};

/**
 * Enhanced error class with correlation ID and categorization
 */
export class StandardizedError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly category: ErrorCategory;
  public readonly correlationId: string;
  public readonly timestamp: Date;
  public readonly details?: any;
  public readonly retryAfter?: number;
  public readonly path?: string;
  public readonly userId?: string;

  constructor(
    code: string,
    correlationId: string,
    details?: any,
    retryAfter?: number,
    path?: string,
    userId?: string
  ) {
    const errorInfo = ERROR_MESSAGES[code] || ERROR_MESSAGES.INTERNAL_ERROR;
    super(errorInfo.message);
    
    this.name = 'StandardizedError';
    this.code = code;
    this.statusCode = errorInfo.statusCode;
    this.category = errorInfo.category;
    this.correlationId = correlationId;
    this.timestamp = new Date();
    this.details = details;
    this.retryAfter = retryAfter;
    this.path = path;
    this.userId = userId;

    // Ensure proper stack trace
    Error.captureStackTrace(this, StandardizedError);
  }

  /**
   * Convert to standard error response format
   */
  toResponse(): {
    success: false;
    error: {
      code: string;
      message: string;
      correlationId: string;
      category: string;
      timestamp: string;
      details?: any;
      retryAfter?: number;
    };
  } {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        correlationId: this.correlationId,
        category: this.category,
        timestamp: this.timestamp.toISOString(),
        ...(this.details && { details: this.details }),
        ...(this.retryAfter && { retryAfter: this.retryAfter }),
      },
    };
  }

  /**
   * Convert to log format
   */
  toLogFormat(): any {
    return {
      error: {
        code: this.code,
        message: this.message,
        category: this.category,
        statusCode: this.statusCode,
        stack: this.stack,
        details: this.details,
      },
      correlationId: this.correlationId,
      timestamp: this.timestamp.toISOString(),
      path: this.path,
      userId: this.userId,
    };
  }
}

/**
 * Error handler factory for consistent error processing
 */
export class ErrorHandler {
  /**
   * Create standardized error from various error types
   */
  static createStandardError(
    error: any,
    correlationId: string,
    path?: string,
    userId?: string
  ): StandardizedError {
    // Already standardized error
    if (error instanceof StandardizedError) {
      return error;
    }

    // Zod validation errors
    if (error instanceof ZodError) {
      return new StandardizedError(
        'VALIDATION_ERROR',
        correlationId,
        this.formatZodError(error),
        undefined,
        path,
        userId
      );
    }

    // Network/timeout errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return new StandardizedError(
        'NETWORK_ERROR',
        correlationId,
        { originalError: error.message },
        undefined,
        path,
        userId
      );
    }

    // Database errors (Prisma)
    if (error.code === 'P2002') {
      return new StandardizedError(
        'VALIDATION_ERROR',
        correlationId,
        { message: 'Unique constraint violation', field: error.meta?.target },
        undefined,
        path,
        userId
      );
    }

    // Rate limit errors
    if (error.name === 'TooManyRequestsError') {
      return new StandardizedError(
        'RATE_LIMIT_EXCEEDED',
        correlationId,
        undefined,
        error.retryAfter || 60,
        path,
        userId
      );
    }

    // Default to internal error
    return new StandardizedError(
      'INTERNAL_ERROR',
      correlationId,
      process.env.NODE_ENV === 'development' ? { originalError: error.message } : undefined,
      undefined,
      path,
      userId
    );
  }

  /**
   * Format Zod validation errors for user consumption
   */
  private static formatZodError(error: ZodError): any {
    return {
      validationErrors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    };
  }

  /**
   * Express error handler middleware
   */
  static middleware() {
    return (err: any, req: Request, res: Response, next: NextFunction) => {
      const correlationId = req.correlationId || 'no-correlation-id';
      const standardError = this.createStandardError(
        err,
        correlationId,
        req.path,
        req.user?.id
      );

      // Log error with full context
      const logData = {
        ...standardError.toLogFormat(),
        request: {
          method: req.method,
          path: req.path,
          query: req.query,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        },
      };

      // Choose log level based on error category
      if (standardError.category === ErrorCategory.INTERNAL_SERVER) {
        logger.error('Internal server error', logData);
      } else if (standardError.statusCode >= 500) {
        logger.error('Server error', logData);
      } else if (standardError.statusCode >= 400) {
        logger.warn('Client error', logData);
      } else {
        logger.info('Request error', logData);
      }

      // Send standardized response
      res.status(standardError.statusCode).json(standardError.toResponse());
    };
  }

  /**
   * Async error handler wrapper
   */
  static asyncHandler<T extends any[], R>(
    fn: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R | void> {
    return async (...args: T): Promise<R | void> => {
      try {
        return await fn(...args);
      } catch (error) {
        const [req, res, next] = args as any;
        if (next && typeof next === 'function') {
          next(error);
        } else {
          throw error;
        }
      }
    };
  }

  /**
   * Get error statistics for monitoring
   */
  static getErrorStats(timeWindowMinutes = 5): {
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    topErrorCodes: Array<{ code: string; count: number }>;
    errorRate: number;
  } {
    // This would typically integrate with a metrics collection system
    // For now, return a basic structure
    return {
      totalErrors: 0,
      errorsByCategory: {},
      topErrorCodes: [],
      errorRate: 0,
    };
  }
}

/**
 * Utility functions for error handling
 */
export const createError = (code: string, correlationId: string, details?: any) => {
  return new StandardizedError(code, correlationId, details);
};

export const asyncHandler = ErrorHandler.asyncHandler;
export const errorMiddleware = ErrorHandler.middleware();
