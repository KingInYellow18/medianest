import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

interface TimeoutOptions {
  timeout?: number; // in milliseconds
  message?: string;
}

/**
 * Middleware to set request timeout
 * @param options Timeout options
 */
export function requestTimeout(options: TimeoutOptions = {}) {
  const { timeout = 30000, message = 'Request timeout' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Set timeout on the request
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        const error = new AppError(message, 408); // 408 Request Timeout
        next(error);
      }
    }, timeout);

    // Clear timeout when response finishes
    res.on('finish', () => {
      clearTimeout(timer);
    });

    // Clear timeout on close
    res.on('close', () => {
      clearTimeout(timer);
    });

    next();
  };
}

/**
 * Preset timeout configurations
 */
export const timeoutPresets = {
  // Short timeout for quick operations (10 seconds)
  short: requestTimeout({ timeout: 10000 }),

  // Medium timeout for standard operations (30 seconds)
  medium: requestTimeout({ timeout: 30000 }),

  // Long timeout for heavy operations (60 seconds)
  long: requestTimeout({ timeout: 60000 }),

  // Extra long timeout for file operations (5 minutes)
  extraLong: requestTimeout({ timeout: 300000 }),
};
