import { Response } from 'express';
import { logger } from './logger';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    correlationId: string;
    details?: any;
    retryAfter?: number;
  };
}

export class ResponseBuilder {
  /**
   * Build standardized success response
   */
  static success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      ...(message && { message }),
    };
  }

  /**
   * Build standardized error response
   */
  static error(
    code: string,
    message: string,
    correlationId: string,
    details?: any,
    retryAfter?: number
  ): ApiResponse {
    return {
      success: false,
      error: {
        code,
        message,
        correlationId,
        ...(details && { details }),
        ...(retryAfter && { retryAfter }),
      },
    };
  }

  /**
   * Send success response with consistent format
   */
  static sendSuccess<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode: number = 200
  ): void {
    res.status(statusCode).json(ResponseBuilder.success(data, message));
  }

  /**
   * Send error response with consistent format
   */
  static sendError(
    res: Response,
    statusCode: number,
    code: string,
    message: string,
    correlationId: string,
    details?: any,
    retryAfter?: number
  ): void {
    res
      .status(statusCode)
      .json(
        ResponseBuilder.error(code, message, correlationId, details, retryAfter)
      );
  }
}

/**
 * Common response patterns for integration routes
 */
export class IntegrationResponsePatterns {
  /**
   * Service not available response
   */
  static serviceNotAvailable(
    res: Response,
    serviceName: string,
    correlationId: string
  ): void {
    ResponseBuilder.sendError(
      res,
      404,
      'SERVICE_NOT_AVAILABLE',
      `${serviceName} integration not available`,
      correlationId
    );
  }

  /**
   * Service error response with logging
   */
  static serviceError(
    res: Response,
    serviceName: string,
    error: Error,
    userId?: string,
    correlationId?: string
  ): void {
    logger.error(`Failed ${serviceName} operation`, {
      userId,
      error: error.message,
      correlationId,
    });

    ResponseBuilder.sendError(
      res,
      500,
      'SERVICE_ERROR',
      `Failed to retrieve ${serviceName} data`,
      correlationId || 'no-correlation-id'
    );
  }

  /**
   * Admin access required response
   */
  static adminRequired(res: Response, correlationId: string): void {
    ResponseBuilder.sendError(
      res,
      403,
      'ADMIN_REQUIRED',
      'Admin access required',
      correlationId
    );
  }

  /**
   * Invalid query parameter response
   */
  static invalidQuery(
    res: Response,
    paramName: string,
    correlationId: string
  ): void {
    ResponseBuilder.sendError(
      res,
      400,
      'INVALID_QUERY',
      `${paramName} is required`,
      correlationId
    );
  }
}
