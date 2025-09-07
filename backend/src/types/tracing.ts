import { SpanKind, SpanStatusCode } from '@opentelemetry/api';

/**
 * Custom span attributes for business operations
 */
export interface BusinessSpanAttributes {
  'operation.name': string;
  'operation.type': 'business_logic' | 'data_access' | 'external_api' | 'cache' | 'auth';
  'user.id'?: string;
  'tenant.id'?: string;
  'correlation.id': string;
}

/**
 * Database span attributes
 */
export interface DatabaseSpanAttributes {
  'db.system': 'postgresql' | 'redis' | 'elasticsearch';
  'db.operation': 'select' | 'insert' | 'update' | 'delete' | 'transaction';
  'db.sql.table': string;
  'db.statement'?: string;
  'db.rows_affected'?: number;
  'db.query_duration_ms'?: number;
}

/**
 * HTTP client span attributes
 */
export interface HttpClientSpanAttributes {
  'http.method': string;
  'http.url': string;
  'http.scheme': string;
  'http.host': string;
  'http.status_code'?: number;
  'http.response_size'?: number;
  'http.response_time_ms'?: number;
  'external.service'?: string;
}

/**
 * Cache operation span attributes
 */
export interface CacheSpanAttributes {
  'cache.system': 'redis' | 'memory' | 'distributed';
  'cache.operation': 'get' | 'set' | 'delete' | 'invalidate' | 'clear';
  'cache.key': string;
  'cache.hit'?: boolean;
  'cache.ttl'?: number;
  'cache.size_bytes'?: number;
  'cache.keys_deleted'?: number;
}

/**
 * Custom span data for client-server correlation
 */
export interface ClientSpanData {
  spanId: string;
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
  correlationId: string;
  sessionId: string;
  status: 'OK' | 'ERROR';
  attributes: Record<string, any>;
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, any>;
  }>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Trace context for request correlation
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  correlationId: string;
  sessionId?: string;
  userId?: string;
  tenantId?: string;
}

/**
 * Performance metrics for spans
 */
export interface SpanMetrics {
  duration: number;
  memoryUsage?: number;
  cpuUsage?: number;
  dbConnections?: number;
  cacheHitRate?: number;
  errorRate?: number;
}

/**
 * Sampling configuration
 */
export interface SamplingConfig {
  ratio: number;
  maxTracesPerSecond?: number;
  excludeHealthChecks: boolean;
  excludeStaticAssets: boolean;
  highVolumeOperations?: string[];
}

/**
 * Alert configuration for tracing
 */
export interface TracingAlertConfig {
  errorRateThreshold: number; // percentage
  latencyThresholdMs: number;
  throughputThreshold: number; // spans per second
  memoryUsageThreshold: number; // percentage
  enableSlackNotifications: boolean;
  enableEmailNotifications: boolean;
}

/**
 * Jaeger configuration
 */
export interface JaegerConfig {
  endpoint: string;
  serviceName: string;
  serviceVersion: string;
  environment: string;
  tags: Array<{ key: string; value: string }>;
  sampling: SamplingConfig;
  batchSpanProcessor: {
    maxExportBatchSize: number;
    maxQueueSize: number;
    exportTimeoutMillis: number;
    scheduledDelayMillis: number;
  };
}

/**
 * Custom instrumentation configuration
 */
export interface InstrumentationConfig {
  http: {
    enabled: boolean;
    ignoreUrls: string[];
    captureHeaders: boolean;
    captureRequestBody: boolean;
    captureResponseBody: boolean;
  };
  database: {
    enabled: boolean;
    captureQueries: boolean;
    maxQueryLength: number;
  };
  cache: {
    enabled: boolean;
    captureKeys: boolean;
  };
  external: {
    enabled: boolean;
    services: Array<{
      name: string;
      baseUrl: string;
      timeout: number;
    }>;
  };
}

/**
 * Export all types for use in application
 */
export type {
  SpanKind,
  SpanStatusCode,
};