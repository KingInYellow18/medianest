/**
 * Unified Logging Type Definitions
 * Consolidates winston logger types with Express request/response integration
 * Supports both prometheus metrics integration and correlation tracking
 */

import type { Logger as WinstonLogger } from 'winston';
import type { Request, Response } from 'express';

// ===================================
// WINSTON LOGGER TYPE EXTENSIONS
// ===================================

/**
 * Extended winston logger interface with correlation tracking
 */
export interface CorrelatedLogger extends WinstonLogger {
  correlationId?: string;
  requestId?: string;
}

/**
 * Winston log metadata structure for MEDIANEST
 */
export interface LogMetadata {
  correlationId?: string;
  requestId?: string;
  userId?: string;
  service?: string;
  operation?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  url?: string;
  ip?: string;
  userAgent?: string;
  traceId?: string;
  spanId?: string;
  environment?: string;
  version?: string;
  error?: {
    message: string;
    stack?: string;
    code?: string;
    name?: string;
  };
  // Allow additional metadata
  [key: string]: unknown;
}

/**
 * Performance logging metadata structure
 */
export interface PerformanceLogMetadata extends LogMetadata {
  operation: string;
  duration: number;
  unit: 'ms' | 'seconds' | 'minutes';
  threshold?: number;
  exceeded?: boolean;
}

/**
 * Security event logging metadata
 */
export interface SecurityLogMetadata extends LogMetadata {
  securityEvent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  sourceIp?: string;
  targetResource?: string;
  action?: string;
  threat?: string;
}

/**
 * Business metrics logging metadata
 */
export interface BusinessMetricLogMetadata extends LogMetadata {
  metric: string;
  value: number;
  unit: string;
  tags?: Record<string, string | number>;
  timestamp?: string;
}

// ===================================
// EXPRESS REQUEST EXTENSIONS
// ===================================

/**
 * Extended Express Request with proper logger typing
 */
export interface RequestWithLogger extends Request {
  logger?: CorrelatedLogger;
  correlationId: string; // Made required to match global Express.Request
  requestId?: string;
  startTime?: number;
  traceId?: string;
  spanId?: string;
}

/**
 * Express Response with logging context
 */
export interface ResponseWithLogger extends Response {
  correlationId?: string;
  requestId?: string;
  logContext?: LogMetadata;
}

// ===================================
// LOGGER FACTORY TYPES
// ===================================

/**
 * Logger factory configuration options
 */
export interface LoggerFactoryOptions {
  correlationId?: string;
  requestId?: string;
  service?: string;
  defaultMeta?: LogMetadata;
  enableMetrics?: boolean;
}

/**
 * Request logger factory options
 */
export interface RequestLoggerOptions extends LoggerFactoryOptions {
  includeHeaders?: boolean;
  includeSensitiveData?: boolean;
  sanitizeFields?: string[];
}

// ===================================
// STRUCTURED LOGGING TYPES
// ===================================

/**
 * Structured log entry for consistent formatting
 */
export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  correlationId: string;
  environment: string;
  metadata?: LogMetadata;
}

/**
 * HTTP request log entry
 */
export interface HttpLogEntry extends StructuredLogEntry {
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  ip: string;
  userAgent?: string;
  userId?: string;
  requestSize?: number;
  responseSize?: number;
}

/**
 * Error log entry with enhanced error context
 */
export interface ErrorLogEntry extends StructuredLogEntry {
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    cause?: string;
  };
  request?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
  context?: Record<string, unknown>;
}

// ===================================
// PROMETHEUS INTEGRATION TYPES
// ===================================

/**
 * Log level metrics tracking
 */
export interface LogLevelMetrics {
  level: 'error' | 'warn' | 'info' | 'debug' | 'verbose' | 'silly';
  service: string;
  count: number;
}

/**
 * Error metrics for prometheus tracking
 */
export interface ErrorMetrics {
  errorType: string;
  source: string;
  count: number;
  lastOccurrence: string;
}

// ===================================
// LOGGING MIDDLEWARE TYPES
// ===================================

/**
 * Logging middleware configuration
 */
export interface LoggingMiddlewareConfig {
  level?: 'error' | 'warn' | 'info' | 'debug';
  format?: 'json' | 'combined' | 'common' | 'dev';
  skip?: (req: Request, res: Response) => boolean;
  includeBody?: boolean;
  includeHeaders?: boolean;
  sanitizeHeaders?: string[];
  maxBodySize?: number;
  enableMetrics?: boolean;
}

/**
 * Correlation ID middleware configuration
 */
export interface CorrelationIdConfig {
  header?: string;
  generator?: () => string;
  setResponseHeader?: boolean;
  reuseExisting?: boolean;
}

// ===================================
// LOG ROTATION & TRANSPORT TYPES
// ===================================

/**
 * File transport configuration for winston
 */
export interface FileTransportConfig {
  filename: string;
  level?: string;
  maxsize?: number;
  maxFiles?: number;
  datePattern?: string;
  zippedArchive?: boolean;
}

/**
 * Console transport configuration
 */
export interface ConsoleTransportConfig {
  level?: string;
  format?: 'json' | 'colored' | 'simple';
  silent?: boolean;
}

/**
 * External logging service configuration (e.g., Loki, Elasticsearch)
 */
export interface ExternalLogConfig {
  endpoint: string;
  apiKey?: string;
  batchSize?: number;
  flushInterval?: number;
  labels?: Record<string, string>;
  compression?: boolean;
}

// ===================================
// UTILITY TYPES
// ===================================

/**
 * Log level union type
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose' | 'silly';

/**
 * Log format union type
 */
export type LogFormat = 'json' | 'combined' | 'common' | 'dev' | 'custom';

/**
 * Environment-specific log configuration
 */
export type EnvironmentLogConfig = {
  development: LoggingMiddlewareConfig;
  production: LoggingMiddlewareConfig;
  test: LoggingMiddlewareConfig;
};

// ===================================
// FACTORY FUNCTION TYPES
// ===================================

/**
 * Child logger creation function signature
 */
export type CreateChildLogger = (correlationId?: string) => CorrelatedLogger;

/**
 * Request logger creation function signature
 */
export type CreateRequestLogger = (req: Request, correlationId?: string) => CorrelatedLogger;

/**
 * Performance logger function signature
 */
export type LogPerformance = (
  operation: string,
  duration: number,
  metadata?: Record<string, unknown>,
  correlationId?: string,
) => void;

/**
 * Security event logger function signature
 */
export type LogSecurityEvent = (
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, unknown>,
  correlationId?: string,
) => void;

/**
 * Business metrics logger function signature
 */
export type LogBusinessMetric = (
  metric: string,
  value: number,
  unit: string,
  tags?: Record<string, unknown>,
  correlationId?: string,
) => void;
