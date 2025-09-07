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

export interface CustomMetricOptions {
  name: string;
  help: string;
  labels?: string[];
  buckets?: number[];
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
  configure(config: UnknownRecord): void;
}
