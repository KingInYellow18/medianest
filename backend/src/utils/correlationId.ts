import { Request } from 'express';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

// AsyncLocalStorage for correlation ID context
const correlationIdStorage = new AsyncLocalStorage<string>();

/**
 * Get correlation ID from current async context
 */
export const getCorrelationId = (): string | undefined => {
  return correlationIdStorage.getStore();
};

/**
 * Run function with correlation ID context
 */
export const withCorrelationId = <T>(correlationId: string, fn: () => T): T => {
  return correlationIdStorage.run(correlationId, fn);
};

/**
 * Extract or generate correlation ID from request
 */
export const extractCorrelationId = (req: Request): string => {
  return (
    req.get('X-Correlation-ID') || req.get('X-Request-ID') || (req as any).correlationId || uuidv4()
  );
};

/**
 * Middleware to set correlation ID in async context
 */
export const correlationIdMiddleware = (req: any, res: any, next: any) => {
  const correlationId = extractCorrelationId(req);
  req.correlationId = correlationId;
  res.set('X-Correlation-ID', correlationId);

  correlationIdStorage.run(correlationId, () => {
    next();
  });
};

/**
 * Get correlation ID for database operations
 */
export const getDbCorrelationId = (): string => {
  return getCorrelationId() || 'system';
};

/**
 * Enhanced correlation ID with additional context
 */
export interface CorrelationContext {
  id: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  parentSpanId?: string;
}

const contextStorage = new AsyncLocalStorage<CorrelationContext>();

export const getCorrelationContext = (): CorrelationContext | undefined => {
  return contextStorage.getStore();
};

export const withCorrelationContext = <T>(context: CorrelationContext, fn: () => T): T => {
  return contextStorage.run(context, fn);
};

export const updateCorrelationContext = (updates: Partial<CorrelationContext>): void => {
  const current = contextStorage.getStore();
  if (current) {
    Object.assign(current, updates);
  }
};
