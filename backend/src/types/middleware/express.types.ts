// Express middleware and request/response extensions
import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import { User } from '@medianest/shared';

// Extended Express Request interface
export interface AuthenticatedRequest extends Request {
  user?: User;
  correlationId: string;
  startTime?: number;
}

// Validation result types
export interface ValidationResult {
  isValid: boolean;
  errors?: ValidationError[];
  data?: Record<string, unknown>;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Rate limiting types
export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skip?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
}

// Logging middleware types
export interface LoggingOptions {
  level: 'error' | 'warn' | 'info' | 'debug';
  format?: 'json' | 'combined' | 'common' | 'dev';
  skip?: (req: Request, res: Response) => boolean;
}

export interface CorrelationIdOptions {
  header?: string;
  generator?: () => string;
  setResponseHeader?: boolean;
}

// Error handling types
export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: Record<string, unknown>;
    stack?: string;
  };
  timestamp: string;
  path: string;
  method: string;
  correlationId?: string;
}

// Middleware function types
export type MiddlewareFunction = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;
export type ErrorMiddlewareFunction = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;
