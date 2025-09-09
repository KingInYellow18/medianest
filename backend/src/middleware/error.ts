import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import { AppError, RateLimitError } from '@medianest/shared';

// Re-export AppError for local imports
export { AppError, RateLimitError };
import { metrics } from '../utils/monitoring';

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
  MEDIA_NOT_FOUND: 'Media not found in library.',

  // Generic Errors
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
};

// Context7 Pattern: Optimized Request Sanitization with Memoization
const sanitizationCache = new Map();
const CACHE_MAX_SIZE = 1000;
const SENSITIVE_HEADERS = new Set(['authorization', 'x-plex-token', 'cookie']);
const SENSITIVE_BODY_FIELDS = new Set(['password', 'token', 'secret']);

function sanitizeRequest(req: Request) {
  // Context7 Pattern: Create cache key from request signature
  const cacheKey = `${req.method}:${req.path}:${Object.keys(req.headers).join(',')}`;

  // Context7 Pattern: Return cached sanitized structure if available
  if (sanitizationCache.has(cacheKey)) {
    const template = sanitizationCache.get(cacheKey);
    return {
      ...template,
      query: req.query,
      params: req.params,
      body: sanitizeBody(req.body),
    };
  }

  const sanitized: any = {
    method: req.method,
    path: req.path,
    query: req.query,
    params: req.params,
    headers: {},
    body: sanitizeBody(req.body),
  };

  // Context7 Pattern: Efficient header sanitization using Set lookup
  for (const [key, value] of Object.entries(req.headers)) {
    if (!SENSITIVE_HEADERS.has(key.toLowerCase())) {
      sanitized.headers[key] = value;
    }
  }

  // Context7 Pattern: Cache sanitized template (without dynamic data)
  if (sanitizationCache.size < CACHE_MAX_SIZE) {
    sanitizationCache.set(cacheKey, {
      method: req.method,
      path: req.path,
      headers: sanitized.headers,
    });
  }

  return sanitized;
}

// Context7 Pattern: Separate body sanitization for reusability
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const sanitized = { ...body };
  for (const field of SENSITIVE_BODY_FIELDS) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
}

// Context7 Pattern: Fast-path error handlers for common scenarios
function handleValidationError(err: ZodError, req: Request, res: Response, correlationId: string) {
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

function handleClientError(err: AppError, req: Request, res: Response, correlationId: string) {
  const userMessage = USER_ERRORS[err.code || ''] || err.message;
  const statusCode = err.statusCode || 400;

  return res.status(statusCode).json({
    success: false,
    error: {
      message: userMessage,
      code: err.code || 'CLIENT_ERROR',
      correlationId,
      ...(err instanceof RateLimitError &&
        err.details?.retryAfter && { retryAfter: err.details.retryAfter }),
      ...(process.env.NODE_ENV === 'development' && { details: err.details }),
    },
  });
}

// Context7 Pattern: Optimized Error Handler with Performance Monitoring
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const correlationId = req.correlationId || 'no-correlation-id';
  const startTime = Date.now();

  // Context7 Pattern: Fast-path for common errors to reduce processing overhead
  if (err instanceof ZodError) {
    return handleValidationError(err, req, res, correlationId);
  }

  if (err instanceof AppError && err.statusCode < 500) {
    return handleClientError(err, req, res, correlationId);
  }

  // Context7 Pattern: Async logging for server errors to avoid blocking response
  const logError = () => {
    req.logger.error({
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
      processingTime: Date.now() - startTime,
    });
  };

  // Context7 Pattern: Non-blocking error logging
  setImmediate(logError);

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
        ...(err instanceof RateLimitError &&
          err.details?.retryAfter && { retryAfter: err.details.retryAfter }),
        ...(process.env.NODE_ENV === 'development' && { details: err.details }),
      },
    });
  }

  // Generic error response
  const isDev = process.env.NODE_ENV === 'development';
  return res.status(500).json({
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
