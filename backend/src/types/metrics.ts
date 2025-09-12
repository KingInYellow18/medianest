/**
 * Type definitions for metrics and monitoring
 */

export interface MetricsConfig {
  enabled: boolean;
  collectInterval: number;
  defaultLabels?: Record<string, string>;
  endpoint: string;
  port?: number;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
  };
  error?: string;
}

export interface DatabaseMetrics {
  activeConnections: number;
  idleConnections: number;
  totalQueries: number;
  queryDuration: number;
  errorRate: number;
}

export interface RedisMetrics {
  activeConnections: number;
  operations: number;
  operationDuration: number;
  errorRate: number;
  memoryUsage?: number;
  keyspaceHits?: number;
  keyspaceMisses?: number;
}

export interface ExternalServiceMetrics {
  service: string;
  endpoint: string;
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  lastStatusCode: number;
}

export interface BusinessMetrics {
  mediaRequests: {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
  userActivity: {
    activeUsers: number;
    totalSessions: number;
    averageSessionDuration: number;
  };
  mediaLibrary: {
    totalSize: number;
    sizeByType: Record<string, number>;
  };
  queues: Record<string, number>;
}

export interface HttpMetrics {
  totalRequests: number;
  averageResponseTime: number;
  responseTimePercentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  statusCodeDistribution: Record<string, number>;
  errorRate: number;
}

export interface ApplicationMetrics {
  info: {
    version: string;
    environment: string;
    nodeVersion: string;
    uptime: number;
  };
  performance: {
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    eventLoopLag: number;
  };
  health: HealthCheckResult;
}

export interface MetricsSummary {
  timestamp: string;
  application: ApplicationMetrics;
  http: HttpMetrics;
  database: DatabaseMetrics;
  redis: RedisMetrics;
  externalServices: ExternalServiceMetrics[];
  business: BusinessMetrics;
}

export type MetricLabels = Record<string, string | number>;

// ===================================
// PROMETHEUS TYPE CONSOLIDATION
// ===================================

/**
 * Prometheus metric type union for type-safe metric operations
 */
export type PrometheusMetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Generic prometheus metric interface
 */
export interface PrometheusMetric {
  name: string;
  help: string;
  type: PrometheusMetricType;
  labelNames?: string[];
}

/**
 * Counter metric configuration
 */
export interface CounterMetricConfig extends PrometheusMetric {
  type: 'counter';
}

/**
 * Gauge metric configuration  
 */
export interface GaugeMetricConfig extends PrometheusMetric {
  type: 'gauge';
}

/**
 * Histogram metric configuration
 */
export interface HistogramMetricConfig extends PrometheusMetric {
  type: 'histogram';
  buckets?: number[];
}

/**
 * Summary metric configuration
 */
export interface SummaryMetricConfig extends PrometheusMetric {
  type: 'summary';
  percentiles?: number[];
  maxAgeSeconds?: number;
  ageBuckets?: number;
}

/**
 * Union type for all metric configurations
 */
export type MetricConfig = CounterMetricConfig | GaugeMetricConfig | HistogramMetricConfig | SummaryMetricConfig;

/**
 * Enhanced custom metric options with type safety
 */
export interface CustomMetricOptions {
  name: string;
  help: string;
  type: PrometheusMetricType;
  labels?: string[];
  buckets?: number[];
  percentiles?: number[];
  maxAgeSeconds?: number;
  ageBuckets?: number;
}

/**
 * Metric registry interface for type-safe metric management
 */
export interface MetricRegistry {
  registerMetric(config: MetricConfig): void;
  getMetric(name: string): PrometheusMetric | undefined;
  removeMetric(name: string): boolean;
  listMetrics(): PrometheusMetric[];
  clear(): void;
}

/**
 * Label constraint types for type-safe label operations
 */
export type HttpMethodLabel = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type StatusClassLabel = '1xx' | '2xx' | '3xx' | '4xx' | '5xx';
export type DatabaseOperationLabel = 'select' | 'insert' | 'update' | 'delete' | 'create' | 'drop';
export type RedisCommandLabel = 'get' | 'set' | 'del' | 'exists' | 'expire' | 'incr' | 'decr' | 'hget' | 'hset';
export type QueueStatusLabel = 'pending' | 'processing' | 'completed' | 'failed' | 'retried';

/**
 * Metric label interfaces for type safety
 */
export interface HttpMetricLabels {
  method: HttpMethodLabel;
  route: string;
  status_code: number;
  status_class: StatusClassLabel;
  user_agent?: string;
}

export interface DatabaseMetricLabels {
  operation: DatabaseOperationLabel;
  table: string;
  status: 'success' | 'error';
}

export interface RedisMetricLabels {
  command: RedisCommandLabel;
  status: 'success' | 'error';
  key_pattern?: string;
}

export interface QueueMetricLabels {
  queue_name: string;
  job_type: string;
  status: QueueStatusLabel;
  priority?: string;
}

export interface MetricsMiddlewareOptions {
  enabled?: boolean;
  excludeRoutes?: string[];
  includeSensitiveHeaders?: boolean;
  requestSizeHistogram?: boolean;
  responseSizeHistogram?: boolean;
}

export interface ServiceHealthCheck {
  name: string;
  check: () => Promise<{ status: 'healthy' | 'unhealthy'; message?: string; details?: any }>;
  timeout?: number;
  critical?: boolean;
}

export interface MetricsExporter {
  export(metrics: MetricsSummary): Promise<void>;
  configure(config: Record<string, unknown>): void;
}
