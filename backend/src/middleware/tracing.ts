import { Request, Response, NextFunction } from 'express';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';

// Types extended in types/express.d.ts

/**
 * Middleware to add correlation ID and trace context to requests
 */
export const tracingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Get or create correlation ID
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  req.correlationId = correlationId;

  // Set correlation ID in response header
  res.setHeader('x-correlation-id', correlationId);

  // Get current span context
  const currentSpan = trace.getActiveSpan();
  if (currentSpan) {
    const spanContext = currentSpan.spanContext();
    req.traceId = spanContext.traceId;
    req.spanId = spanContext.spanId;

    // Add correlation ID as span attribute
    currentSpan.setAttributes({
      'http.correlation_id': correlationId,
      'http.user_agent': req.headers['user-agent'] || '',
      'http.remote_addr': req.ip || req.connection.remoteAddress || '',
    });
  }

  next();
};

/**
 * Middleware to create custom spans for business operations
 */
export const businessOperationSpan = (operationName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const tracer = trace.getTracer('observe-backend', '1.0.0');

    const span = tracer.startSpan(operationName, {
      kind: SpanKind.SERVER,
      attributes: {
        'operation.name': operationName,
        'http.method': req.method,
        'http.route': req.route?.path || req.path,
        'http.correlation_id': req.correlationId || '',
        'user.id': req.body?.userId || req.query?.userId || '',
      },
    });

    // Add span to request context
    context.with(trace.setSpan(context.active(), span), () => {
      // Handle response completion
      res.on('finish', () => {
        span.setAttributes({
          'http.status_code': res.statusCode,
          'http.response.size': res.get('content-length') || 0,
        });

        // Set span status based on HTTP status code
        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`,
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        span.end();
      });

      // Handle errors
      res.on('error', (error) => {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message as any,
        });
        span.end();
      });

      next();
    });
  };
};

/**
 * Error handling middleware with tracing
 */
export const tracingErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const currentSpan = trace.getActiveSpan();

  if (currentSpan) {
    currentSpan.recordException(error);
    currentSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message as any,
    });
    currentSpan.setAttributes({
      'error.name': error.name,
      'error.message as any': error.message as any,
      'error.stack as any': (error.stack as any) || '',
    });
  }

  // Log error with trace context
  console.error('Error occurred:', {
    error: error.message as any,
    correlationId: req.correlationId,
    traceId: req.traceId,
    spanId: req.spanId,
    stack: error.stack as any,
  });

  next(error);
};

/**
 * Utility function to create child spans for database operations
 */
export const createDatabaseSpan = (operation: string, table: string, query?: string) => {
  const tracer = trace.getTracer('observe-backend', '1.0.0');

  return tracer.startSpan(`db.${operation}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'db.system': 'postgresql',
      'db.operation': operation,
      'db.sql.table': table,
      'db.statement': query || '',
    },
  });
};

/**
 * Utility function to create child spans for external API calls
 */
export const createExternalAPISpan = (method: string, url: string, service?: string) => {
  const tracer = trace.getTracer('observe-backend', '1.0.0');

  return tracer.startSpan(`http.client.${method.toLowerCase()}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'http.method': method,
      'http.url': url,
      'http.scheme': new URL(url).protocol.slice(0, -1),
      'http.host': new URL(url).host,
      'external.service': service || new URL(url).hostname,
    },
  });
};

/**
 * Utility function to create child spans for cache operations
 */
export const createCacheSpan = (operation: string, key: string, ttl?: number) => {
  const tracer = trace.getTracer('observe-backend', '1.0.0');

  return tracer.startSpan(`cache.${operation}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'cache.system': 'redis',
      'cache.operation': operation,
      'cache.key': key,
      ...(ttl && { 'cache.ttl': ttl }),
    },
  });
};
