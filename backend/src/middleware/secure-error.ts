// @ts-nocheck
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../utils/errors';
import { logger } from '../utils/logger';
import { configService } from '../config/config.service';

/**
 * Secure error handler that prevents information leakage
 */
export function secureErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the full error for internal monitoring
  const errorId = require('crypto').randomUUID();
  const sanitizedError = sanitizeError(error);

  logger.error('Request error', {
    errorId,
    error: sanitizedError,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
    correlationId: req.correlationId,
  });

  // Determine response based on error type and environment
  const isDevelopment = configService.isDevelopment();
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details: any = undefined;

  if (error instanceof ValidationError) {
    statusCode = 400;
    message = 'Validation Error';
    details = isDevelopment ? (error as any).details : { errorId };
  } else if (error instanceof AuthenticationError) {
    statusCode = 401;
    message = 'Authentication Required';
    details = isDevelopment ? { cause: error.message as any, errorId } : { errorId };
  } else if (error instanceof AuthorizationError) {
    statusCode = 403;
    message = 'Forbidden';
    details = isDevelopment ? { cause: error.message as any, errorId } : { errorId };
  } else if (error instanceof NotFoundError) {
    statusCode = 404;
    message = 'Not Found';
    details = isDevelopment ? { cause: error.message as any, errorId } : { errorId };
  } else if (error instanceof AppError) {
    statusCode = (error as any).statusCode || 500;
    message = (error.message as any) || 'Application Error';
    details = { errorId };

    // Only show app error details in development
    if (isDevelopment && (error as any).details) {
      details.cause = (error as any).details;
    }
  } else if (error instanceof ZodError) {
    // Handle Zod validation errors
    statusCode = 400;
    message = 'Invalid Input';
    details = isDevelopment ? { errors: error.errors, errorId } : { errorId };
  } else if (error.name === 'CastError') {
    // MongoDB/Mongoose cast errors
    statusCode = 400;
    message = 'Invalid ID Format';
    details = { errorId };
  } else if (error.name === 'ValidationError') {
    // Mongoose validation errors
    statusCode = 400;
    message = 'Validation Failed';
    details = { errorId };
  } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    // MongoDB errors
    statusCode = 500;
    message = 'Database Error';
    details = { errorId };
  } else if ((error.message as any) && (error.message as any)?.includes('ENOTFOUND')) {
    // DNS/Network errors
    statusCode = 503;
    message = 'Service Unavailable';
    details = { errorId };
  } else if ((error.message as any) && (error.message as any)?.includes('ECONNREFUSED')) {
    // Connection refused errors
    statusCode = 503;
    message = 'Service Unavailable';
    details = { errorId };
  } else {
    // Unknown errors - be very careful about information leakage
    statusCode = 500;
    message = 'Internal Server Error';
    details = { errorId };

    // In development, show more details for debugging
    if (isDevelopment) {
      details.error = sanitizeError(error);
    }
  }

  // Security: Remove stack traces in production
  if (!isDevelopment) {
    delete error.stack as any;
  }

  // Log security-sensitive errors with higher priority
  if (statusCode === 401 || statusCode === 403) {
    logger.warn('Security event', {
      errorId,
      statusCode,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
      message: error.message as any,
    });
  }

  // Rate limiting check - if too many errors from same IP
  trackErrorsByIP(req.ip);

  // Send sanitized response
  const response: any = {
    error: true,
    message,
    ...(details && { details }),
  };

  // Add timestamp for debugging
  if (isDevelopment) {
    response.timestamp = new Date().toISOString();
  }

  res.status(statusCode).json(response);
}

/**
 * Sanitize error objects to prevent sensitive data leakage
 */
function sanitizeError(error: Error): any {
  const sanitized: any = {
    name: error.name,
    message: sanitizeErrorMessage(error.message as any),
  };

  // Only include stack in development
  if (configService.isDevelopment()) {
    sanitized.stack = error.stack as any;
  }

  return sanitized;
}

/**
 * Sanitize error messages to remove sensitive information
 */
function sanitizeErrorMessage(message: string): string {
  if (!message) return 'Unknown error';

  // Remove file paths
  message = message.replace(/\/[^\s]+/g, '[FILE_PATH]');

  // Remove database connection strings
  message = message.replace(/mongodb:\/\/[^\s]+/g, '[DATABASE_URL]');
  message = message.replace(/postgresql:\/\/[^\s]+/g, '[DATABASE_URL]');
  message = message.replace(/redis:\/\/[^\s]+/g, '[REDIS_URL]');

  // Remove JWT tokens
  message = message.replace(
    /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
    '[JWT_TOKEN]'
  );

  // Remove API keys and secrets
  message = message.replace(/[a-zA-Z0-9]{32,}/g, '[SECRET]');

  // Remove IP addresses (but keep localhost for development)
  if (configService.isProduction()) {
    message = message.replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, '[IP_ADDRESS]');
  }

  // Remove environment variables
  message = message.replace(/\$[A-Z_]+/g, '[ENV_VAR]');

  return message;
}

/**
 * Track errors by IP for rate limiting and monitoring
 */
const errorsByIP = new Map<string, { count: number; resetTime: number }>();

function trackErrorsByIP(ip: string): void {
  const now = Date.now();
  const resetWindow = 15 * 60 * 1000; // 15 minutes
  const maxErrors = 100; // Max errors per IP in window

  const existing = errorsByIP.get(ip);

  if (!existing || now > existing.resetTime) {
    errorsByIP.set(ip, { count: 1, resetTime: now + resetWindow });
    return;
  }

  existing.count++;

  // Log suspicious activity
  if (existing.count > maxErrors) {
    logger.warn('High error rate detected from IP', {
      ip,
      errorCount: existing.count,
      timeWindow: resetWindow / 1000 / 60,
    });
  }
}

/**
 * Handle unhandled promise rejections
 */
export function handleUnhandledRejection(): void {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    const errorId = require('crypto').randomUUID();

    logger.error('Unhandled Promise Rejection', {
      errorId,
      reason: sanitizeError(reason instanceof Error ? reason : new Error(String(reason))),
      promise: promise.toString(),
    });

    // In production, we might want to restart the process
    if (configService.isProduction()) {
      logger.error('Process will exit due to unhandled rejection');
      process.exit(1);
    }
  });
}

/**
 * Handle uncaught exceptions
 */
export function handleUncaughtException(): void {
  process.on('uncaughtException', (error: Error) => {
    const errorId = require('crypto').randomUUID();

    logger.error('Uncaught Exception', {
      errorId,
      error: sanitizeError(error),
    });

    // Always exit on uncaught exceptions
    logger.error('Process will exit due to uncaught exception');
    process.exit(1);
  });
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  const errorId = require('crypto').randomUUID();

  logger.warn('Route not found', {
    errorId,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
  });

  res.status(404).json({
    error: true,
    message: 'Route not found',
    details: {
      errorId,
      ...(configService.isDevelopment() && {
        requestedPath: req.path,
        method: req.method,
      }),
    },
  });
}

/**
 * Health check error handler
 */
export function healthCheckErrorHandler(error: Error): any {
  return {
    status: 'error',
    message: 'Health check failed',
    timestamp: new Date().toISOString(),
    ...(configService.isDevelopment() && {
      error: sanitizeError(error),
    }),
  };
}

/**
 * Database connection error handler
 */
export function handleDatabaseError(error: Error): void {
  const errorId = require('crypto').randomUUID();

  logger.error('Database connection error', {
    errorId,
    error: sanitizeError(error),
    timestamp: new Date().toISOString(),
  });

  // In production, implement retry logic or circuit breaker
  if (configService.isProduction()) {
    // Could implement exponential backoff retry here
    logger.warn('Database connection failed - implement retry logic');
  }
}

/**
 * WebSocket error handler
 */
export function handleWebSocketError(error: Error, socketId?: string): void {
  const errorId = require('crypto').randomUUID();

  logger.error('WebSocket error', {
    errorId,
    socketId,
    error: sanitizeError(error),
    timestamp: new Date().toISOString(),
  });
}

/**
 * External service error handler
 */
export function handleExternalServiceError(serviceName: string, error: Error): void {
  const errorId = require('crypto').randomUUID();

  logger.error('External service error', {
    errorId,
    service: serviceName,
    error: sanitizeError(error),
    timestamp: new Date().toISOString(),
  });

  // Could implement circuit breaker pattern here
  logger.info(`Service ${serviceName} error - consider implementing circuit breaker`);
}
