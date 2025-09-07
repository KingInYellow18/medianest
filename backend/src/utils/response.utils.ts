import { Response } from 'express';
import { logger } from './logger';
import { CatchError } from '../types/common';
import {
  getErrorMessage,
  toError,
  isError,
  isValidationError,
  isHttpError,
} from '../types/error-types';

/**
 * Standard API response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: PaginationMeta;
  };
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Send successful response
 * @param res - Express response object
 * @param data - Response data
 * @param statusCode - HTTP status code (default: 200)
 * @param meta - Additional metadata
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Partial<ApiResponse['meta']>
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };

  res.status(statusCode).json(response);
}

/**
 * Send error response
 * @param res - Express response object
 * @param message - Error message
 * @param statusCode - HTTP status code (default: 500)
 * @param code - Error code
 * @param details - Additional error details
 */
export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  code?: string,
  details?: any
): void {
  const response: ApiResponse = {
    success: false,
    error: {
      message,
      code: code || getDefaultErrorCode(statusCode),
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  // Log error for internal tracking
  logger.error('API Error Response', {
    statusCode,
    message,
    code,
    details,
  });

  res.status(statusCode).json(response);
}

/**
 * Send paginated response
 * @param res - Express response object
 * @param items - Array of items
 * @param pagination - Pagination info
 * @param statusCode - HTTP status code (default: 200)
 */
export function sendPaginated<T>(
  res: Response,
  items: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  statusCode = 200
): void {
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const paginationMeta: PaginationMeta = {
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    totalPages,
    hasNext: pagination.page < totalPages,
    hasPrev: pagination.page > 1,
  };

  sendSuccess(res, items, statusCode, { pagination: paginationMeta });
}

/**
 * Send created resource response (201)
 * @param res - Express response object
 * @param data - Created resource data
 * @param resourceId - ID of created resource
 */
export function sendCreated<T>(res: Response, data: T, resourceId?: string): void {
  const meta: any = {};
  if (resourceId) {
    meta.resourceId = resourceId;
  }
  sendSuccess(res, data, 201, meta);
}

/**
 * Send no content response (204)
 * @param res - Express response object
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}

/**
 * Send not found response (404)
 * @param res - Express response object
 * @param resource - Resource name that was not found
 */
export function sendNotFound(res: Response, resource = 'Resource'): void {
  sendError(res, `${resource} not found`, 404, 'NOT_FOUND');
}

/**
 * Send validation error response (400)
 * @param res - Express response object
 * @param message - Validation error message
 * @param details - Validation error details
 */
export function sendValidationError(
  res: Response,
  message = 'Validation failed',
  details?: any
): void {
  sendError(res, message, 400, 'VALIDATION_ERROR', details);
}

/**
 * Send unauthorized response (401)
 * @param res - Express response object
 * @param message - Unauthorized message
 */
export function sendUnauthorized(res: Response, message = 'Unauthorized'): void {
  sendError(res, message, 401, 'UNAUTHORIZED');
}

/**
 * Send forbidden response (403)
 * @param res - Express response object
 * @param message - Forbidden message
 */
export function sendForbidden(res: Response, message = 'Forbidden'): void {
  sendError(res, message, 403, 'FORBIDDEN');
}

/**
 * Send conflict response (409)
 * @param res - Express response object
 * @param message - Conflict message
 */
export function sendConflict(res: Response, message = 'Resource conflict'): void {
  sendError(res, message, 409, 'CONFLICT');
}

/**
 * Send rate limit exceeded response (429)
 * @param res - Express response object
 * @param message - Rate limit message
 * @param retryAfter - Seconds to wait before retrying
 */
export function sendRateLimit(
  res: Response,
  message = 'Rate limit exceeded',
  retryAfter?: number
): void {
  if (retryAfter) {
    res.setHeader('Retry-After', retryAfter.toString());
  }
  sendError(res, message, 429, 'RATE_LIMIT_EXCEEDED');
}

/**
 * Send internal server error response (500)
 * @param res - Express response object
 * @param message - Error message
 * @param details - Error details (only included in development)
 */
export function sendInternalError(
  res: Response,
  message = 'Internal server error',
  details?: any
): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  sendError(res, message, 500, 'INTERNAL_ERROR', isDevelopment ? details : undefined);
}

/**
 * Send service unavailable response (503)
 * @param res - Express response object
 * @param message - Service unavailable message
 */
export function sendServiceUnavailable(res: Response, message = 'Service unavailable'): void {
  sendError(res, message, 503, 'SERVICE_UNAVAILABLE');
}

/**
 * Create a consistent response wrapper for async route handlers
 * @param handler - Async route handler function
 * @returns Wrapped handler with error catching
 */
export function asyncHandler(handler: (req: any, res: Response, next: any) => Promise<void>) {
  return async (req: any, res: Response, next: any): Promise<void> => {
    try {
      await handler(req, res, next);
    } catch (error: CatchError) {
      const processedError = toError(error);
      logger.error('Async handler error', {
        path: req.path,
        method: req.method,
        error: {
          message: processedError.message,
          stack: processedError.stack,
        },
      });

      // Send appropriate error response with proper type guards
      if (isValidationError(processedError)) {
        sendValidationError(res, processedError.message);
      } else if (isHttpError(processedError)) {
        sendError(res, processedError.message, processedError.statusCode, processedError.code);
      } else {
        sendInternalError(res, 'An unexpected error occurred');
      }
    }
  };
}

/**
 * Get default error code based on status code
 * @param statusCode - HTTP status code
 * @returns Default error code
 */
function getDefaultErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    case 429:
      return 'RATE_LIMIT_EXCEEDED';
    case 500:
      return 'INTERNAL_ERROR';
    case 502:
      return 'BAD_GATEWAY';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    case 504:
      return 'GATEWAY_TIMEOUT';
    default:
      return 'UNKNOWN_ERROR';
  }
}

/**
 * Create response data transformer
 * @param transformer - Function to transform data
 * @returns Response sender function
 */
export function createResponseTransformer<TInput, TOutput>(transformer: (data: TInput) => TOutput) {
  return (res: Response, data: TInput, statusCode = 200) => {
    const transformed = transformer(data);
    sendSuccess(res, transformed, statusCode);
  };
}

/**
 * Cache control helpers
 */
export const CacheControl = {
  noCache: (res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  },

  maxAge: (res: Response, seconds: number) => {
    res.setHeader('Cache-Control', `public, max-age=${seconds}`);
  },

  private: (res: Response, seconds: number) => {
    res.setHeader('Cache-Control', `private, max-age=${seconds}`);
  },
};

/**
 * CORS helpers
 */
export const CORS = {
  allowOrigin: (res: Response, origin = '*') => {
    res.setHeader('Access-Control-Allow-Origin', origin);
  },

  allowMethods: (res: Response, methods = 'GET,POST,PUT,DELETE,OPTIONS') => {
    res.setHeader('Access-Control-Allow-Methods', methods);
  },

  allowHeaders: (res: Response, headers = 'Content-Type,Authorization') => {
    res.setHeader('Access-Control-Allow-Headers', headers);
  },
};
