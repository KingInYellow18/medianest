// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';

import { AppError } from '@medianest/shared';
import { logger } from '../utils/logger';
import { CatchError } from '../types/common';

interface ValidationData {
  body?: any;
  params?: any;
  query?: any;
  headers?: any;
  cookies?: any;
}

/**
 * Validation middleware factory for Zod schemas
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Create validation object from request
      const validationData: ValidationData = {};

      // Include body if present
      if (req.body && Object.keys(req.body).length > 0) {
        validationData.body = req.body;
      }

      // Include params if present
      if (req.params && Object.keys(req.params).length > 0) {
        validationData.params = req.params;
      }

      // Include query if present
      if (req.query && Object.keys(req.query).length > 0) {
        validationData.query = req.query;
      }

      // Include specific headers if present
      if (req.headers) {
        validationData.headers = req.headers;
      }

      // Include cookies if present
      if (req.cookies) {
        validationData.cookies = req.cookies;
      }

      // Parse with schema
      const parsed = schema.parse(validationData);

      // Update request objects with parsed data
      if (parsed.body) req.body = parsed.body;
      if (parsed.params) req.params = parsed.params;
      if (parsed.query) req.query = parsed.query;

      next();
    } catch (error: CatchError) {
      if (error instanceof ZodError) {
        const validationError = formatZodError(error);
        logger.warn('Validation failed', {
          correlationId: req.correlationId,
          url: req.url,
          method: req.method,
          errors: validationError.details,
        });

        const appError = new AppError(
          validationError.message,
          400,
          'VALIDATION_ERROR',
          validationError.details
        );

        next(appError);
      } else {
        logger.error('Unexpected validation error', {
          error,
          correlationId: req.correlationId,
        });
        next(new AppError('Invalid request format', 400, 'INVALID_REQUEST'));
      }
    }
  };
}

/**
 * Format Zod validation errors into user-friendly format
 */
function formatZodError(error: ZodError) {
  const details = error.errors.map((err) => {
    const path = err.path.join('.');
    return {
      field: path,
      message: err.message,
      code: err.code,
      expected: 'expected' in err ? err.expected : undefined,
      received: 'received' in err ? err.received : undefined,
    };
  });

  // Create a user-friendly main message
  let message = 'Validation failed';
  if (details.length === 1) {
    message = details[0].message;
  } else if (details.length > 1) {
    message = `${details.length} validation errors occurred`;
  }

  return {
    message,
    details,
  };
}

/**
 * Validation middleware for specific request parts
 */
export const validateBody = (schema: ZodSchema) => validate(z.object({ body: schema }));
export const validateParams = (schema: ZodSchema) => validate(z.object({ params: schema }));
export const validateQuery = (schema: ZodSchema) => validate(z.object({ query: schema }));

/**
 * Combined validation for multiple request parts
 */
export const validateRequest = (schemas: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
  headers?: ZodSchema;
}) => {
  const schemaObject: Record<string, ZodSchema> = {};

  if (schemas.body) schemaObject.body = schemas.body;
  if (schemas.params) schemaObject.params = schemas.params;
  if (schemas.query) schemaObject.query = schemas.query;
  if (schemas.headers) schemaObject.headers = schemas.headers;

  return validate(z.object(schemaObject));
};
