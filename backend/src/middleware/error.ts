import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import {
  AppError,
  RateLimitError,
} from '../utils/errors';
import { metrics } from '../utils/monitoring';
import { logger } from '../utils/logger';

// User-friendly error messages
const USER_ERRORS: Record<string, string> = {
  // Authentication Errors
  AUTH_FAILED: 'Authentication failed. Please log in again.',
  PLEX_TOKEN_EXPIRED: 'Your Plex session has expired. Please reconnect.',
  PERMISSION_DENIED: "You don't have permission to perform this action.",

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
  YOUTUBE_QUOTA_EXCEEDED: 'Download limit reached. Try again in an hour.',

  // Service Availability
  SERVICE_UNAVAILABLE: 'This service is temporarily unavailable.',
  PLEX_UNREACHABLE: 'Cannot connect to Plex server. Please try again.',
  OVERSEERR_DOWN: 'Media requests are temporarily unavailable.',

  // Validation Errors
  INVALID_REQUEST: 'Invalid request. Please check your input.',
  INVALID_YOUTUBE_URL: 'Please provide a valid YouTube playlist URL.',
  VALIDATION_ERROR: 'Invalid request data',

  // Resource Errors
  NOT_FOUND: 'The requested resource was not found.',
  NOT_FOUND_ERROR: 'The requested resource was not found.',
  MEDIA_NOT_FOUND: 'Media not found in library.',

  // Generic Errors
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
};

// Sanitize request data before logging
function sanitizeRequest(req: Request) {
  const sanitized: {
    method: string;
    path: string;
    query: unknown;
    params: unknown;
    userAgent?: string;
    ip?: string;
    correlationId?: string;
    body?: unknown;
  } = {
    method: req.method,
    path: req.path,
    query: req.query,
    params: req.params,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    correlationId: req.correlationId,
    body: { ...req.body },
  };

  // Headers are not included for security reasons

  // Remove sensitive body fields
  if (sanitized.body && typeof sanitized.body === 'object' && 'password' in sanitized.body) {
    (sanitized.body as any).password = '[REDACTED]';
  }

  return sanitized;
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Handle JSON parsing errors
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid JSON in request body',
        correlationId: req.correlationId || 'no-correlation-id',
      },
    });
  }
  const correlationId = req.correlationId || 'no-correlation-id';

  // Log detailed error internally
  const logData = {
    correlationId,
    error: {
      message: err.message,
      stack: err.stack,
      code: err instanceof AppError ? err.code : undefined,
      statusCode: err instanceof AppError ? err.statusCode : 500,
      details: err instanceof AppError ? err.details : undefined,
    },
    request: sanitizeRequest(req),
    userId: req.user?.id,
    ip: req.ip,
  };

  if (req.logger) {
    req.logger.error(logData);
  } else {
    logger.error('Unhandled error', logData);
  }

  // Record metrics
  const errorCode = err instanceof AppError ? err.code || 'UNKNOWN' : 'INTERNAL_ERROR';
  metrics.incrementError(errorCode);

  // Handle specific error types
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        message: USER_ERRORS.VALIDATION_ERROR,
        code: 'VALIDATION_ERROR',
        correlationId,
        details: process.env.NODE_ENV === 'development' ? err.errors : undefined,
      },
    });
  }

  if (err instanceof AppError) {
    const userMessage = USER_ERRORS[err.code || ''] || err.message;
    const statusCode = err.statusCode || 500;

    return res.status(statusCode).json({
      success: false,
      error: {
        message: userMessage,
        code: err.code || 'INTERNAL_ERROR',
        correlationId,
        ...(err instanceof RateLimitError && { retryAfter: err.retryAfter }),
        ...(process.env.NODE_ENV === 'development' && { details: err.details }),
      },
    });
  }

  // Generic error response
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: USER_ERRORS.INTERNAL_ERROR,
      correlationId,
      ...(isDev && {
        originalMessage: err.message,
        stack: err.stack,
      }),
    },
  });
};
