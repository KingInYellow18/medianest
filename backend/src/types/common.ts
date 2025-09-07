/**
 * Common type definitions to replace 'any' types
 */

// Error handling types
export interface ErrorWithMessage {
  message: string;
  stack?: string;
  name?: string;
  code?: string | number;
  statusCode?: number;
  cause?: unknown;
}

export interface HttpError extends ErrorWithMessage {
  statusCode: number;
  status?: number;
}

export interface ValidationError extends ErrorWithMessage {
  field?: string;
  value?: unknown;
  constraint?: string;
}

// HTTP request/response types
export interface RequestHeaders {
  [key: string]: string | string[] | undefined;
  'user-agent'?: string;
  'content-type'?: string;
  authorization?: string;
  'x-correlation-id'?: string;
  'x-forwarded-for'?: string;
  accept?: string;
  cookie?: string;
}

export interface ResponseHeaders {
  [key: string]: string | string[] | number | undefined;
  'content-type'?: string;
  'content-length'?: string | number;
  'cache-control'?: string;
  'set-cookie'?: string[];
  location?: string;
}

// Generic HTTP types
export interface HttpRequest {
  url?: string;
  method?: string;
  headers: RequestHeaders;
  body?: unknown;
  query?: Record<string, string | string[]>;
  params?: Record<string, string>;
  ip?: string;
  protocol?: string;
  hostname?: string;
  path?: string;
}

export interface HttpResponse {
  statusCode: number;
  headers: ResponseHeaders;
  body?: unknown;
  getHeader: (name: string) => string | number | string[] | undefined;
  setHeader: (name: string, value: string | number | string[]) => void;
  removeHeader: (name: string) => void;
}

// Configuration types
export interface ConfigValue {
  value: string | number | boolean | object | null;
  source?: 'env' | 'default' | 'config' | 'override';
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

export interface DatabaseConfig {
  url: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean | object;
  poolSize?: number;
  timeout?: number;
  retries?: number;
}

// Logging types
export interface LogContext {
  [key: string]: unknown;
  timestamp?: string;
  level?: string;
  module?: string;
  operation?: string;
  userId?: string;
  requestId?: string;
  sessionId?: string;
  error?: ErrorWithMessage;
}

// Generic utility types
export type UnknownRecord = Record<string, unknown>;
export type StringRecord = Record<string, string>;
export type NumberRecord = Record<string, number>;
export type AnyFunction = (...args: unknown[]) => unknown;
export type AsyncFunction<T = unknown> = (...args: unknown[]) => Promise<T>;

// Array types
export type UnknownArray = unknown[];
export type StringArray = string[];
export type NumberArray = number[];

// Database operation types
export interface DatabaseOperation {
  table: string;
  operation: 'create' | 'read' | 'update' | 'delete' | 'upsert' | 'count';
  data?: UnknownRecord;
  where?: UnknownRecord;
  select?: string[] | UnknownRecord;
  include?: UnknownRecord;
  orderBy?: UnknownRecord;
  take?: number;
  skip?: number;
}

export interface DatabaseResult<T = unknown> {
  data: T;
  count?: number;
  metadata?: UnknownRecord;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ErrorWithMessage;
  message?: string;
  metadata?: {
    timestamp: string;
    requestId?: string;
    version?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  data: T[];
  metadata: {
    timestamp: string;
    requestId?: string;
    version?: string;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

// Event and messaging types
export interface EventPayload<T = unknown> {
  type: string;
  data: T;
  metadata: {
    timestamp: string;
    source: string;
    version: string;
    correlationId?: string;
  };
}

export interface QueueMessage<T = unknown> {
  id: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  delay?: number;
  priority?: number;
  createdAt: string;
  processedAt?: string;
  completedAt?: string;
  failedAt?: string;
  error?: ErrorWithMessage;
}

// Metrics and monitoring types
export interface PerformanceMetrics {
  duration: number;
  memory: {
    used: number;
    total: number;
    free: number;
  };
  cpu: {
    usage: number;
    load: number[];
  };
  timestamp: string;
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: {
    [service: string]: {
      status: 'up' | 'down' | 'degraded';
      responseTime?: number;
      error?: string;
      timestamp: string;
    };
  };
  timestamp: string;
}

// Type guards
export const isError = (value: unknown): value is ErrorWithMessage => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as ErrorWithMessage).message === 'string'
  );
};

export const isHttpError = (value: unknown): value is HttpError => {
  return (
    isError(value) && 'statusCode' in value && typeof (value as HttpError).statusCode === 'number'
  );
};

export const isUnknownRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

// Utility type for replacing any in catch blocks
export type CatchError = ErrorWithMessage | Error | string | unknown;
