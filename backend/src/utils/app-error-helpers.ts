/**
 * AppError utility functions to ensure proper type casting
 */

import { AppError } from '@medianest/shared';

// HTTP Status Codes as proper numbers
export const HttpStatusCodes = {
  BAD_REQUEST: 400 as const,
  UNAUTHORIZED: 401 as const,
  FORBIDDEN: 403 as const,
  NOT_FOUND: 404 as const,
  CONFLICT: 409 as const,
  TOO_MANY_REQUESTS: 429 as const,
  INTERNAL_SERVER_ERROR: 500 as const,
  BAD_GATEWAY: 502 as const,
  SERVICE_UNAVAILABLE: 503 as const,
  GATEWAY_TIMEOUT: 504 as const,
} as const;

// Helper function to create AppError with proper typing
export function createAppError(
  code: string,
  message: string,
  statusCode: keyof typeof HttpStatusCodes | number,
  details?: any,
): AppError {
  const numericStatusCode =
    typeof statusCode === 'number' ? statusCode : HttpStatusCodes[statusCode];

  return new AppError(code, message, numericStatusCode, details);
}

// Specific error creators for common cases
export const AppErrors = {
  unauthorized: (message: string = 'Unauthorized', details?: any) =>
    createAppError('UNAUTHORIZED', message, HttpStatusCodes.UNAUTHORIZED, details),

  forbidden: (message: string = 'Forbidden', details?: any) =>
    createAppError('FORBIDDEN', message, HttpStatusCodes.FORBIDDEN, details),

  notFound: (message: string = 'Not Found', details?: any) =>
    createAppError('NOT_FOUND', message, HttpStatusCodes.NOT_FOUND, details),

  badRequest: (message: string = 'Bad Request', details?: any) =>
    createAppError('VALIDATION_ERROR', message, HttpStatusCodes.BAD_REQUEST, details),

  conflict: (message: string = 'Conflict', details?: any) =>
    createAppError('CONFLICT', message, HttpStatusCodes.CONFLICT, details),

  tooManyRequests: (message: string = 'Too Many Requests', details?: any) =>
    createAppError('RATE_LIMIT_EXCEEDED', message, HttpStatusCodes.TOO_MANY_REQUESTS, details),

  internalError: (message: string = 'Internal Server Error', details?: any) =>
    createAppError('INTERNAL_ERROR', message, HttpStatusCodes.INTERNAL_SERVER_ERROR, details),

  badGateway: (message: string = 'Bad Gateway', details?: any) =>
    createAppError('BAD_GATEWAY', message, HttpStatusCodes.BAD_GATEWAY, details),

  serviceUnavailable: (message: string = 'Service Unavailable', details?: any) =>
    createAppError('SERVICE_UNAVAILABLE', message, HttpStatusCodes.SERVICE_UNAVAILABLE, details),

  gatewayTimeout: (message: string = 'Gateway Timeout', details?: any) =>
    createAppError('GATEWAY_TIMEOUT', message, HttpStatusCodes.GATEWAY_TIMEOUT, details),
};
