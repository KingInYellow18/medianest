import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { createChildLogger } from '../utils/logger';

// Extend Express Request interface to include correlation ID and logger
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      logger: any;
    }
  }
}

export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Extract or generate correlation ID (case-insensitive)
  const correlationId =
    req.headers['x-correlation-id'] ||
    req.headers['X-Correlation-ID'] ||
    req.headers['X-CORRELATION-ID'] ||
    uuidv4();

  // Attach to request
  req.correlationId = correlationId as string;

  // Create child logger with correlation ID
  req.logger = createChildLogger(correlationId as string);

  // Set response header
  res.setHeader('x-correlation-id', correlationId);

  next();
}
