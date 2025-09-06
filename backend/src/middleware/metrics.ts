import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';
import { performance } from 'perf_hooks';

// Create a Registry
const register = new client.Registry();

// Add default metrics
try {
  client.collectDefaultMetrics({ register });
} catch (error) {
  console.warn('Default metrics already collected:', error);
}

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestSize = new client.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route']
});

const httpResponseSize = new client.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code']
});

// Database metrics
const dbQueryDuration = new client.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
});

const dbConnectionsActive = new client.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

// Redis metrics
const redisOperationDuration = new client.Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Redis operation duration in seconds',
  labelNames: ['command', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});

const redisConnectionsActive = new client.Gauge({
  name: 'redis_connections_active',
  help: 'Number of active Redis connections'
});

// External API metrics
const externalApiDuration = new client.Histogram({
  name: 'external_api_duration_seconds',
  help: 'External API call duration in seconds',
  labelNames: ['service', 'operation', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

// Business metrics
const mediaRequestsTotal = new client.Counter({
  name: 'media_requests_total',
  help: 'Total number of media requests',
  labelNames: ['type', 'status', 'source']
});

const userSessionsActive = new client.Gauge({
  name: 'user_sessions_active',
  help: 'Number of active user sessions'
});

const queueSize = new client.Gauge({
  name: 'queue_size',
  help: 'Number of items in processing queues',
  labelNames: ['queue_name']
});

// Application health metrics
const appInfo = new client.Gauge({
  name: 'app_info',
  help: 'Application information',
  labelNames: ['version', 'environment']
});

// Memory and performance metrics
const eventLoopLag = new client.Gauge({
  name: 'nodejs_eventloop_lag_seconds',
  help: 'Event loop lag in seconds'
});

// Register all metrics
try {
  register.registerMetric(httpRequestDuration);
  register.registerMetric(httpRequestsTotal);
  register.registerMetric(httpRequestSize);
  register.registerMetric(httpResponseSize);
  register.registerMetric(dbQueryDuration);
  register.registerMetric(dbConnectionsActive);
  register.registerMetric(redisOperationDuration);
  register.registerMetric(redisConnectionsActive);
  register.registerMetric(externalApiDuration);
  register.registerMetric(mediaRequestsTotal);
  register.registerMetric(userSessionsActive);
  register.registerMetric(queueSize);
  register.registerMetric(appInfo);
  register.registerMetric(eventLoopLag);
} catch (error) {
  console.warn('Some metrics already registered:', error);
}

// Set application info
appInfo.set({ version: process.env.APP_VERSION || '1.0.0', environment: process.env.NODE_ENV || 'development' }, 1);

// Event loop lag monitoring
setInterval(() => {
  const start = performance.now();
  setImmediate(() => {
    const lag = (performance.now() - start) / 1000;
    eventLoopLag.set(lag);
  });
}, 1000);

// Metrics middleware
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const route = req.route?.path || req.path;
  
  // Track request size
  const requestSize = parseInt(req.get('content-length') || '0', 10);
  httpRequestSize.observe({ method: req.method, route }, requestSize);
  
  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = (Date.now() - start) / 1000;
    const responseSize = parseInt(res.get('content-length') || '0', 10);
    
    // Record metrics
    httpRequestDuration.observe({ method: req.method, route, status_code: res.statusCode }, duration);
    httpRequestsTotal.inc({ method: req.method, route, status_code: res.statusCode });
    httpResponseSize.observe({ method: req.method, route, status_code: res.statusCode }, responseSize);
    
    // Call original end
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Database query tracking function
export const trackDbQuery = async <T>(
  operation: string,
  table: string,
  queryFn: () => Promise<T>
): Promise<T> => {
  const start = Date.now();
  let status = 'success';
  
  try {
    const result = await queryFn();
    return result;
  } catch (error) {
    status = 'error';
    throw error;
  } finally {
    const duration = (Date.now() - start) / 1000;
    dbQueryDuration.observe({ operation, table, status }, duration);
  }
};

// Redis operation tracking
export const trackRedisOperation = async <T>(
  command: string,
  operationFn: () => Promise<T>
): Promise<T> => {
  const start = Date.now();
  let status = 'success';
  
  try {
    const result = await operationFn();
    return result;
  } catch (error) {
    status = 'error';
    throw error;
  } finally {
    const duration = (Date.now() - start) / 1000;
    redisOperationDuration.observe({ command, status }, duration);
  }
};

// External API call tracking
export const trackExternalApiCall = async <T>(
  service: string,
  operation: string,
  apiFn: () => Promise<T>
): Promise<T> => {
  const start = Date.now();
  let status = 'success';
  
  try {
    const result = await apiFn();
    return result;
  } catch (error) {
    status = 'error';
    throw error;
  } finally {
    const duration = (Date.now() - start) / 1000;
    externalApiDuration.observe({ service, operation, status }, duration);
  }
};

// Business metrics helpers
export const trackMediaRequest = (type: string, status: string, source: string) => {
  mediaRequestsTotal.inc({ type, status, source });
};

export const setActiveUsers = (count: number) => {
  userSessionsActive.set(count);
};

export const setQueueSize = (queueName: string, size: number) => {
  queueSize.set({ queue_name: queueName }, size);
};

export const updateDbConnections = (count: number) => {
  dbConnectionsActive.set(count);
};

export const updateRedisConnections = (count: number) => {
  redisConnectionsActive.set(count);
};

// Health check endpoint data
export const getHealthMetrics = () => {
  return {
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    eventLoopLag: eventLoopLag.get(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0'
  };
};

// Export the register for /metrics endpoint
export { register };

export default {
  metricsMiddleware,
  trackDbQuery,
  trackRedisOperation,
  trackExternalApiCall,
  trackMediaRequest,
  setActiveUsers,
  setQueueSize,
  updateDbConnections,
  updateRedisConnections,
  getHealthMetrics,
  register
};