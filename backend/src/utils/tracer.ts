import { trace, context, SpanStatusCode, SpanKind, Span } from '@opentelemetry/api';

/**
 * Enhanced tracer utility class for custom instrumentation
 */
export class TracerUtil {
  private tracer = trace.getTracer('observe-backend', '1.0.0');

  /**
   * Execute a function within a custom span
   */
  async withSpan<T>(
    spanName: string,
    fn: (span: Span) => Promise<T>,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
    }
  ): Promise<T> {
    const span = this.tracer.startSpan(spanName, {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes || {},
    });

    try {
      const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Execute a synchronous function within a custom span
   */
  withSpanSync<T>(
    spanName: string,
    fn: (span: Span) => T,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
    }
  ): T {
    const span = this.tracer.startSpan(spanName, {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes || {},
    });

    try {
      const result = context.with(trace.setSpan(context.active(), span), () => fn(span));
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Create a span for database operations
   */
  async withDatabaseSpan<T>(
    operation: string,
    table: string,
    fn: (span: Span) => Promise<T>,
    query?: string
  ): Promise<T> {
    return this.withSpan(
      `db.${operation}`,
      fn,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.system': 'postgresql',
          'db.operation': operation,
          'db.sql.table': table,
          ...(query && { 'db.statement': query }),
        },
      }
    );
  }

  /**
   * Create a span for Redis cache operations
   */
  async withCacheSpan<T>(
    operation: string,
    key: string,
    fn: (span: Span) => Promise<T>,
    ttl?: number
  ): Promise<T> {
    return this.withSpan(
      `cache.${operation}`,
      fn,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'cache.system': 'redis',
          'cache.operation': operation,
          'cache.key': key,
          ...(ttl && { 'cache.ttl': ttl }),
        },
      }
    );
  }

  /**
   * Create a span for external HTTP calls
   */
  async withHttpSpan<T>(
    method: string,
    url: string,
    fn: (span: Span) => Promise<T>,
    service?: string
  ): Promise<T> {
    const urlObj = new URL(url);
    
    return this.withSpan(
      `http.client.${method.toLowerCase()}`,
      fn,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'http.method': method,
          'http.url': url,
          'http.scheme': urlObj.protocol.slice(0, -1),
          'http.host': urlObj.host,
          'external.service': service || urlObj.hostname,
        },
      }
    );
  }

  /**
   * Create a span for business logic operations
   */
  async withBusinessSpan<T>(
    operationName: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    return this.withSpan(
      `business.${operationName}`,
      fn,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'operation.type': 'business_logic',
          'operation.name': operationName,
          ...attributes,
        },
      }
    );
  }

  /**
   * Add custom attributes to the current active span
   */
  addAttributes(attributes: Record<string, string | number | boolean>): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttributes(attributes);
    }
  }

  /**
   * Add a custom event to the current active span
   */
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.addEvent(name, attributes);
    }
  }

  /**
   * Record an exception in the current active span
   */
  recordException(error: Error, attributes?: Record<string, string | number | boolean>): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.recordException(error, attributes);
      currentSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    }
  }

  /**
   * Get trace ID from current span context
   */
  getTraceId(): string | undefined {
    const currentSpan = trace.getActiveSpan();
    return currentSpan?.spanContext().traceId;
  }

  /**
   * Get span ID from current span context
   */
  getSpanId(): string | undefined {
    const currentSpan = trace.getActiveSpan();
    return currentSpan?.spanContext().spanId;
  }

  /**
   * Get correlation ID from current context
   */
  getCorrelationId(): string | undefined {
    // This would need to be set in the context by middleware
    return context.active().getValue('correlationId') as string;
  }
}

// Export singleton instance
export const tracer = new TracerUtil();