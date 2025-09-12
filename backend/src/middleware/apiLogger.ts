import { performance } from 'perf_hooks';

import { Request, Response, NextFunction } from 'express';

// @ts-ignore
import { CatchError } from '../types/common';
import { getCorrelationId } from '../utils/correlationId';
import { logger } from '../utils/logger';

// API-specific logging middleware
export const apiLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = performance.now();
  const correlationId = getCorrelationId() || req.correlationId || 'unknown';

  // Enhanced request logging for API endpoints
  logger.info('API request started', {
    correlationId,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    ip: req.ip,
    ips: req.ips,
    headers: filterApiHeaders(req.headers),
    body: shouldLogRequestBody(req) ? sanitizeBody(req.body) : undefined,
  });

  // Track response metrics
  let responseSize = 0;
  const originalSend = res.send;

  res.send = function (body: any) {
    if (body) {
      responseSize = Buffer.isBuffer(body) ? body.length : Buffer.byteLength(String(body));
    }
    return originalSend.call(this, body);
  };

  // Handle response completion
  res.on('finish', () => {
    const duration = performance.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'info';

    logger[level]('API request completed', {
      correlationId,
      method: req.method,
      url: req.url,
      path: req.path,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      duration: Math.round(duration * 100) / 100,
      responseSize,
      contentType: res.get('Content-Type'),
      cacheControl: res.get('Cache-Control'),
      etag: res.get('ETag'),
    });

    // Log performance metrics for slow requests
    if (duration > 1000) {
      // > 1 second
      logger.warn('Slow API request detected', {
        correlationId,
        metric: 'slow_api_request',
        duration,
        endpoint: `${req.method} ${req.path}`,
        statusCode: res.statusCode,
      });
    }

    // Log performance metrics for different response size categories
    if (responseSize > 0) {
      let sizeCategory = 'small';
      if (responseSize > 1024 * 1024)
        sizeCategory = 'large'; // > 1MB
      else if (responseSize > 1024 * 100) sizeCategory = 'medium'; // > 100KB

      logger.debug('API response size recorded', {
        correlationId,
        metric: 'api_response_size',
        size: responseSize,
        endpoint: `${req.method} ${req.path}`,
        category: sizeCategory,
      });
    }
  });

  // Handle response errors
  res.on('error', (error) => {
    const duration = performance.now() - startTime;

    logger.error('API response error', {
      correlationId,
      operation: 'api_response',
      error: error.message,
      stack: error.stack,
      method: req.method,
      url: req.url,
      duration,
      statusCode: res.statusCode,
    });
  });

  next();
};

// Database query logging middleware
export const createDatabaseLoggerMiddleware = (pool: any) => {
  if (pool && pool.on) {
    // PostgreSQL pool events
    pool.on('connect', () => {
      logger.debug('Database connection established', {
        correlationId: getCorrelationId(),
        event: 'db_connect',
      });
    });

    pool.on('error', (error: Error) => {
      logger.error('Database connection error', {
        correlationId: getCorrelationId(),
        operation: 'database_connection',
        error: error.message,
        stack: error.stack,
      });
    });

    // Intercept queries for logging
    const originalQuery = pool.query.bind(pool);
    pool.query = async (text: string, params?: unknown[]) => {
      const startTime = performance.now();
      const correlationId = getCorrelationId() || 'system';

      logger.debug('Database query started', {
        correlationId,
        query: sanitizeQuery(text),
        paramCount: params?.length || 0,
      });

      try {
        const result = await originalQuery(text, params);
        const duration = performance.now() - startTime;

        logger.debug('Database query completed', {
          correlationId,
          query: sanitizeQuery(text),
          duration: Math.round(duration * 100) / 100,
          rowCount: result.rowCount || 0,
          fieldCount: result.fields?.length || 0,
        });

        // Log slow queries
        if (duration > 1000) {
          // > 1 second
          logger.warn('Slow database query detected', {
            correlationId,
            metric: 'slow_database_query',
            duration,
            query: sanitizeQuery(text),
            rowCount: result.rowCount,
          });
        }

        return result;
      } catch (error: CatchError) {
        const duration = performance.now() - startTime;

        logger.error('Database query error', {
          correlationId,
          operation: 'database_query',
          error: (error as Error).message,
          stack: (error as Error).stack,
          query: sanitizeQuery(text),
          duration,
          paramCount: params?.length || 0,
        });
        throw error;
      }
    };
  }
};

// External service call logging
export const logExternalServiceCall = async <T>(
  serviceName: string,
  operation: string,
  serviceCall: () => Promise<T>,
  metadata?: Record<string, any>,
): Promise<T> => {
  const startTime = performance.now();
  const correlationId = getCorrelationId() || 'system';

  logger.info('External service call started', {
    correlationId,
    service: serviceName,
    operation,
    ...metadata,
  });

  try {
    const result = await serviceCall();
    const duration = performance.now() - startTime;

    logger.info('External service call completed', {
      correlationId,
      service: serviceName,
      operation,
      duration: Math.round(duration * 100) / 100,
      success: true,
      ...metadata,
    });

    // Log slow external calls
    if (duration > 5000) {
      // > 5 seconds
      logger.warn('Slow external service call detected', {
        correlationId,
        metric: 'slow_external_service_call',
        duration,
        service: serviceName,
        operation,
      });
    }

    return result;
  } catch (error: CatchError) {
    const duration = performance.now() - startTime;

    logger.error('External service call error', {
      correlationId,
      operation: 'external_service_call',
      error: (error as Error).message,
      stack: (error as Error).stack,
      service: serviceName,
      operationName: operation,
      duration,
      ...metadata,
    });
    throw error;
  }
};

// Utility functions
const filterApiHeaders = (headers: any): Record<string, any> => {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
    'authentication',
  ];

  const filtered = { ...headers };
  sensitiveHeaders.forEach((header) => {
    if (filtered[header]) {
      filtered[header] = '[REDACTED]';
    }
  });

  return filtered;
};

const shouldLogRequestBody = (req: Request): boolean => {
  // Only log request body in development or if explicitly enabled
  if (process.env.NODE_ENV !== 'development' && process.env.LOG_REQUEST_BODY !== 'true') {
    return false;
  }

  // Don't log for certain endpoints
  const skipPaths = ['/api/auth/login', '/api/auth/register', '/api/upload'];
  if (skipPaths.some((path) => req.path.startsWith(path))) {
    return false;
  }

  // Only log for specific content types
  const contentType = req.get('Content-Type') || '';
  return (
    contentType.includes('application/json') ||
    contentType.includes('application/x-www-form-urlencoded')
  );
};

const sanitizeBody = (body: any): any => {
  if (!body || typeof body !== 'object') return body;

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...body };

  const sanitizeObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;

    const result = Array.isArray(obj) ? [] : {};

    Object.keys(obj).forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some((field) => lowerKey.includes(field))) {
        (result as any)[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        (result as any)[key] = sanitizeObject(obj[key]);
      } else {
        (result as any)[key] = obj[key];
      }
    });

    return result;
  };

  return sanitizeObject(sanitized);
};

const sanitizeQuery = (query: string): string => {
  // Remove sensitive data from queries
  const sensitivePatterns = [
    /password\s*=\s*'[^']*'/gi,
    /token\s*=\s*'[^']*'/gi,
    /secret\s*=\s*'[^']*'/gi,
  ];

  let sanitized = query;
  sensitivePatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, (match) => {
      const field = match.split('=')[0];
      return `${field} = '[REDACTED]'`;
    });
  });

  return sanitized;
};

export { filterApiHeaders, sanitizeBody, sanitizeQuery };
