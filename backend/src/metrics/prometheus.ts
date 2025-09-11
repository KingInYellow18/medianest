/**
 * Enhanced Prometheus Metrics Instrumentation for MEDIANEST
 * Comprehensive application and business metrics collection
 */

import { performance } from 'perf_hooks';
import { Request, Response, NextFunction } from 'express';
import client, { Counter, Gauge, Histogram, Summary, register } from 'prom-client';
import { logger } from '../utils/logger';
import { CatchError } from '../types/common';

// Initialize default metrics collection
client.collectDefaultMetrics({
  register,
  prefix: 'medianest_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// =================================
// HTTP REQUEST METRICS
// =================================

export const httpRequestDuration = new Histogram({
  name: 'medianest_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'status_class', 'user_agent'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const httpRequestsTotal = new Counter({
  name: 'medianest_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'status_class'],
});

export const httpRequestSize = new Histogram({
  name: 'medianest_http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [64, 256, 1024, 4096, 16384, 65536, 262144, 1048576],
});

export const httpResponseSize = new Histogram({
  name: 'medianest_http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [64, 256, 1024, 4096, 16384, 65536, 262144, 1048576],
});

export const httpActiveConnections = new Gauge({
  name: 'medianest_http_active_connections',
  help: 'Number of active HTTP connections',
});

// =================================
// DATABASE METRICS
// =================================

export const dbQueryDuration = new Histogram({
  name: 'medianest_database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
});

export const dbQueriesTotal = new Counter({
  name: 'medianest_database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
});

export const dbConnectionsActive = new Gauge({
  name: 'medianest_database_connections_active',
  help: 'Number of active database connections',
});

export const dbConnectionsIdle = new Gauge({
  name: 'medianest_database_connections_idle',
  help: 'Number of idle database connections',
});

export const dbConnectionPoolSize = new Gauge({
  name: 'medianest_database_connection_pool_size',
  help: 'Database connection pool size',
});

export const dbLockWaitTime = new Histogram({
  name: 'medianest_database_lock_wait_seconds',
  help: 'Time spent waiting for database locks',
  labelNames: ['table', 'lock_type'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 5, 10],
});

// =================================
// REDIS CACHE METRICS
// =================================

export const redisOperationDuration = new Histogram({
  name: 'medianest_redis_operation_duration_seconds',
  help: 'Redis operation duration in seconds',
  labelNames: ['command', 'status', 'key_pattern'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});

export const redisOperationsTotal = new Counter({
  name: 'medianest_redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['command', 'status'],
});

export const redisConnectionsActive = new Gauge({
  name: 'medianest_redis_connections_active',
  help: 'Number of active Redis connections',
});

export const redisMemoryUsage = new Gauge({
  name: 'medianest_redis_memory_usage_bytes',
  help: 'Redis memory usage in bytes',
});

export const redisCacheHitRatio = new Gauge({
  name: 'medianest_redis_cache_hit_ratio',
  help: 'Redis cache hit ratio (0-1)',
});

export const redisKeyCount = new Gauge({
  name: 'medianest_redis_keys_total',
  help: 'Total number of keys in Redis',
  labelNames: ['key_type'],
});

// =================================
// WINSTON LOGGING METRICS
// =================================

export const logMessagesTotal = new Counter({
  name: 'medianest_log_messages_total',
  help: 'Total number of log messages',
  labelNames: ['level', 'service'],
});

export const logErrors = new Counter({
  name: 'medianest_log_errors_total',
  help: 'Total number of error log messages',
  labelNames: ['error_type', 'source'],
});

// =================================
// EXTERNAL API METRICS
// =================================

export const externalApiDuration = new Histogram({
  name: 'medianest_external_api_duration_seconds',
  help: 'External API call duration in seconds',
  labelNames: ['service', 'operation', 'status', 'endpoint'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60],
});

export const externalApiRequestsTotal = new Counter({
  name: 'medianest_external_api_requests_total',
  help: 'Total number of external API requests',
  labelNames: ['service', 'operation', 'status'],
});

export const externalApiErrors = new Counter({
  name: 'medianest_external_api_errors_total',
  help: 'Total number of external API errors',
  labelNames: ['service', 'operation', 'error_type'],
});

// =================================
// BUSINESS METRICS
// =================================

export const mediaRequestsTotal = new Counter({
  name: 'medianest_media_requests_total',
  help: 'Total number of media requests',
  labelNames: ['type', 'status', 'source', 'user_type'],
});

export const mediaRequestDuration = new Histogram({
  name: 'medianest_media_request_duration_seconds',
  help: 'Time to process media requests',
  labelNames: ['type', 'status'],
  buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600],
});

export const userSessionsActive = new Gauge({
  name: 'medianest_user_sessions_active',
  help: 'Number of active user sessions',
  labelNames: ['user_type'],
});

export const userActionsTotal = new Counter({
  name: 'medianest_user_actions_total',
  help: 'Total number of user actions',
  labelNames: ['action', 'user_type', 'result'],
});

export const mediaLibrarySize = new Gauge({
  name: 'medianest_media_library_size_bytes',
  help: 'Total size of media library in bytes',
  labelNames: ['media_type'],
});

export const mediaLibraryItems = new Gauge({
  name: 'medianest_media_library_items_total',
  help: 'Total number of items in media library',
  labelNames: ['media_type', 'status'],
});

// =================================
// QUEUE METRICS
// =================================

export const queueSize = new Gauge({
  name: 'medianest_queue_size',
  help: 'Number of items in processing queues',
  labelNames: ['queue_name', 'priority'],
});

export const queueProcessingTime = new Histogram({
  name: 'medianest_queue_processing_seconds',
  help: 'Time to process queue items',
  labelNames: ['queue_name', 'job_type', 'status'],
  buckets: [0.1, 1, 5, 10, 30, 60, 300, 600],
});

export const queueJobsTotal = new Counter({
  name: 'medianest_queue_jobs_total',
  help: 'Total number of queue jobs processed',
  labelNames: ['queue_name', 'job_type', 'status'],
});

export const queueWorkerUtilization = new Gauge({
  name: 'medianest_queue_worker_utilization_ratio',
  help: 'Queue worker utilization ratio (0-1)',
  labelNames: ['queue_name'],
});

// =================================
// APPLICATION HEALTH METRICS
// =================================

export const appInfo = new Gauge({
  name: 'medianest_app_info',
  help: 'Application information',
  labelNames: ['version', 'environment', 'node_version'],
});

export const appUptime = new Gauge({
  name: 'medianest_app_uptime_seconds',
  help: 'Application uptime in seconds',
});

export const eventLoopLag = new Gauge({
  name: 'medianest_nodejs_eventloop_lag_seconds',
  help: 'Event loop lag in seconds',
});

export const memoryHeapUsed = new Gauge({
  name: 'medianest_nodejs_heap_used_bytes',
  help: 'Node.js heap used in bytes',
});

export const gcDuration = new Summary({
  name: 'medianest_nodejs_gc_duration_seconds',
  help: 'Garbage collection duration',
  labelNames: ['kind'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
  maxAgeSeconds: 600,
  ageBuckets: 5,
});

// =================================
// WEBSOCKET METRICS
// =================================

export const websocketConnections = new Gauge({
  name: 'medianest_websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['namespace', 'user_type'],
});

export const websocketMessages = new Counter({
  name: 'medianest_websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['direction', 'event_type', 'namespace'],
});

export const websocketErrors = new Counter({
  name: 'medianest_websocket_errors_total',
  help: 'Total number of WebSocket errors',
  labelNames: ['error_type', 'namespace'],
});

// =================================
// SECURITY METRICS
// =================================

export const authAttemptsTotal = new Counter({
  name: 'medianest_auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['type', 'result', 'user_agent'],
});

export const rateLimitHits = new Counter({
  name: 'medianest_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint', 'limit_type'],
});

export const securityEventsTotal = new Counter({
  name: 'medianest_security_events_total',
  help: 'Total number of security events',
  labelNames: ['event_type', 'severity', 'source'],
});

// =================================
// REGISTER ALL METRICS
// =================================

const metricsToRegister = [
  httpRequestDuration, httpRequestsTotal, httpRequestSize, httpResponseSize, httpActiveConnections,
  dbQueryDuration, dbQueriesTotal, dbConnectionsActive, dbConnectionsIdle, dbConnectionPoolSize, dbLockWaitTime,
  redisOperationDuration, redisOperationsTotal, redisConnectionsActive, redisMemoryUsage, redisCacheHitRatio, redisKeyCount,
  logMessagesTotal, logErrors,
  externalApiDuration, externalApiRequestsTotal, externalApiErrors,
  mediaRequestsTotal, mediaRequestDuration, userSessionsActive, userActionsTotal, mediaLibrarySize, mediaLibraryItems,
  queueSize, queueProcessingTime, queueJobsTotal, queueWorkerUtilization,
  appInfo, appUptime, eventLoopLag, memoryHeapUsed, gcDuration,
  websocketConnections, websocketMessages, websocketErrors,
  authAttemptsTotal, rateLimitHits, securityEventsTotal,
];

metricsToRegister.forEach(metric => {
  try {
    register.registerMetric(metric);
  } catch (error: CatchError) {
    logger.warn(`Metric already registered: ${metric.name}`, { error });
  }
});

// =================================
// MIDDLEWARE FUNCTIONS
// =================================

export const prometheusMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  const route = req.route?.path || req.path || 'unknown';

  // Track request size
  const requestSize = parseInt(req.get('content-length') || '0', 10);
  httpRequestSize.observe({ method: req.method, route }, requestSize);

  // Track active connections
  httpActiveConnections.inc();

  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any) {
    const duration = Number(process.hrtime.bigint() - start) / 1e9; // Convert to seconds
    const responseSize = parseInt(res.get('content-length') || '0', 10);
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
    const userAgent = req.get('user-agent') || 'unknown';

    // Record metrics
    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode, status_class: statusClass, user_agent: userAgent },
      duration,
    );
    httpRequestsTotal.inc({ method: req.method, route, status_code: res.statusCode, status_class: statusClass });
    httpResponseSize.observe(
      { method: req.method, route, status_code: res.statusCode },
      responseSize,
    );

    // Decrement active connections
    httpActiveConnections.dec();

    // Call original end
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// =================================
// TRACKING HELPER FUNCTIONS
// =================================

export async function trackDbQuery<T>(
  operation: string,
  table: string,
  queryFn: () => Promise<T>,
): Promise<T> {
  const start = process.hrtime.bigint();
  let status = 'success';

  try {
    const result = await queryFn();
    return result;
  } catch (error: CatchError) {
    status = 'error';
    throw error;
  } finally {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    dbQueryDuration.observe({ operation, table, status }, duration);
    dbQueriesTotal.inc({ operation, table, status });
  }
}

export async function trackRedisOperation<T>(
  command: string,
  keyPattern: string,
  operationFn: () => Promise<T>,
): Promise<T> {
  const start = process.hrtime.bigint();
  let status = 'success';

  try {
    const result = await operationFn();
    return result;
  } catch (error: CatchError) {
    status = 'error';
    throw error;
  } finally {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    redisOperationDuration.observe({ command, status, key_pattern: keyPattern }, duration);
    redisOperationsTotal.inc({ command, status });
  }
}

export async function trackExternalApiCall<T>(
  service: string,
  operation: string,
  endpoint: string,
  apiFn: () => Promise<T>,
): Promise<T> {
  const start = process.hrtime.bigint();
  let status = 'success';

  try {
    const result = await apiFn();
    return result;
  } catch (error: CatchError) {
    status = 'error';
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
    externalApiErrors.inc({ service, operation, error_type: errorType });
    throw error;
  } finally {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    externalApiDuration.observe({ service, operation, status, endpoint }, duration);
    externalApiRequestsTotal.inc({ service, operation, status });
  }
}

// =================================
// BUSINESS METRIC HELPERS
// =================================

export const trackMediaRequest = (type: string, status: string, source: string, userType: string = 'user') => {
  mediaRequestsTotal.inc({ type, status, source, user_type: userType });
};

export const trackMediaProcessingTime = (type: string, status: string, durationSeconds: number) => {
  mediaRequestDuration.observe({ type, status }, durationSeconds);
};

export const trackUserAction = (action: string, userType: string, result: string) => {
  userActionsTotal.inc({ action, user_type: userType, result });
};

export const updateUserSessions = (count: number, userType: string = 'all') => {
  userSessionsActive.set({ user_type: userType }, count);
};

export const updateQueueMetrics = (queueName: string, size: number, priority: string = 'normal') => {
  queueSize.set({ queue_name: queueName, priority }, size);
};

export const trackQueueJob = async <T>(
  queueName: string,
  jobType: string,
  jobFn: () => Promise<T>,
): Promise<T> => {
  const start = process.hrtime.bigint();
  let status = 'success';

  try {
    const result = await jobFn();
    return result;
  } catch (error: CatchError) {
    status = 'error';
    throw error;
  } finally {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    queueProcessingTime.observe({ queue_name: queueName, job_type: jobType, status }, duration);
    queueJobsTotal.inc({ queue_name: queueName, job_type: jobType, status });
  }
};

// =================================
// WINSTON LOGGER INTEGRATION
// =================================

export const trackLogMessage = (level: string, service: string = 'medianest-backend') => {
  logMessagesTotal.inc({ level, service });
  
  if (level === 'error') {
    logErrors.inc({ error_type: 'application', source: service });
  }
};

// =================================
// WEBSOCKET TRACKING
// =================================

export const trackWebSocketConnection = (namespace: string, userType: string, connected: boolean) => {
  if (connected) {
    websocketConnections.inc({ namespace, user_type: userType });
  } else {
    websocketConnections.dec({ namespace, user_type: userType });
  }
};

export const trackWebSocketMessage = (direction: 'inbound' | 'outbound', eventType: string, namespace: string) => {
  websocketMessages.inc({ direction, event_type: eventType, namespace });
};

export const trackWebSocketError = (errorType: string, namespace: string) => {
  websocketErrors.inc({ error_type: errorType, namespace });
};

// =================================
// SECURITY TRACKING
// =================================

export const trackAuthAttempt = (type: string, result: string, userAgent: string = 'unknown') => {
  authAttemptsTotal.inc({ type, result, user_agent: userAgent });
};

export const trackRateLimitHit = (endpoint: string, limitType: string) => {
  rateLimitHits.inc({ endpoint, limit_type: limitType });
};

export const trackSecurityEvent = (eventType: string, severity: string, source: string) => {
  securityEventsTotal.inc({ event_type: eventType, severity, source });
};

// =================================
// INITIALIZATION & MONITORING
// =================================

// Set application info
appInfo.set(
  {
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    node_version: process.version,
  },
  1,
);

// Update uptime every 30 seconds
setInterval(() => {
  appUptime.set(process.uptime());
  memoryHeapUsed.set(process.memoryUsage().heapUsed);
}, 30000);

// Event loop lag monitoring
setInterval(() => {
  const start = performance.now();
  setImmediate(() => {
    const lag = (performance.now() - start) / 1000;
    eventLoopLag.set(lag);
  });
}, 1000);

// =================================
// HEALTH CHECK ENDPOINT DATA
// =================================

export const getHealthMetrics = () => {
  return {
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    eventLoopLag: eventLoopLag.get(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
    metricsCount: register.getMetricsAsArray().length,
  };
};

// Export the register for /metrics endpoint
export { register };

// Default export for backwards compatibility
export default {
  prometheusMiddleware,
  trackDbQuery,
  trackRedisOperation,
  trackExternalApiCall,
  trackMediaRequest,
  trackUserAction,
  updateUserSessions,
  updateQueueMetrics,
  trackQueueJob,
  trackLogMessage,
  trackWebSocketConnection,
  trackWebSocketMessage,
  trackWebSocketError,
  trackAuthAttempt,
  trackRateLimitHit,
  trackSecurityEvent,
  getHealthMetrics,
  register,
};