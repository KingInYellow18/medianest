import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import { generateCorrelationId } from '@medianest/shared';

import { createChildLogger } from '../utils/logger';

// Types extended in types/express.d.ts

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Extract or generate correlation ID (case-insensitive)
  const correlationId =
    req.headers['x-correlation-id'] ||
    req.headers['X-Correlation-ID'] ||
    req.headers['X-CORRELATION-ID'] ||
    generateCorrelationId();

  // Attach to request
  req.correlationId = correlationId as string;

  // Create child logger with correlation ID
  req.logger = createChildLogger(correlationId as string);

  // Set response header
  res.setHeader('x-correlation-id', correlationId);

  next();
}
