import { Request, Response, NextFunction } from 'express';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

import { logger } from '../utils/logger';

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({
  prefix: 'medianest_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// HTTP request metrics
const httpRequestsTotal = new Counter({
  name: 'medianest_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const httpRequestDuration = new Histogram({
  name: 'medianest_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

// Business metrics
const activeUsers = new Gauge({
  name: 'medianest_active_users',
  help: 'Number of active users',
});

const mediaRequestsTotal = new Counter({
  name: 'medianest_media_requests_total',
  help: 'Total number of media requests',
  labelNames: ['type', 'service'],
});

const downloadQueueSize = new Gauge({
  name: 'medianest_download_queue_size',
  help: 'Number of items in download queue',
  labelNames: ['status'],
});

const serviceHealth = new Gauge({
  name: 'medianest_service_health',
  help: 'Health status of integrated services',
  labelNames: ['service'],
});

// WebSocket metrics
const wsConnectionsActive = new Gauge({
  name: 'medianest_websocket_connections_active',
  help: 'Number of active WebSocket connections',
});

const wsMessagesTotal = new Counter({
  name: 'medianest_websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['direction', 'type'],
});

// Database metrics
const dbConnectionsActive = new Gauge({
  name: 'medianest_db_connections_active',
  help: 'Number of active database connections',
});

const dbQueriesTotal = new Counter({
  name: 'medianest_db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table'],
});

const dbQueryDuration = new Histogram({
  name: 'medianest_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

// Cache metrics
const cacheHitsTotal = new Counter({
  name: 'medianest_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache'],
});

const cacheMissesTotal = new Counter({
  name: 'medianest_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache'],
});

// Error metrics
const errorsTotal = new Counter({
  name: 'medianest_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code'],
});

// Middleware to collect HTTP metrics
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Normalize route path for metrics
  const route = req.route?.path || req.path.replace(/\/[0-9]+/g, '/:id');

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route,
      status: res.statusCode.toString(),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);

    // Log slow requests
    if (duration > 1) {
      logger.warn('Slow request detected', {
        method: req.method,
        route,
        duration,
        status: res.statusCode,
      });
    }
  });

  next();
}

// Metrics endpoint handler
export function metricsHandler(req: Request, res: Response) {
  res.set('Content-Type', register.contentType);
  register
    .metrics()
    .then((metrics) => {
      res.end(metrics);
    })
    .catch((err) => {
      logger.error('Error generating metrics', err);
      res.status(500).end();
    });
}

// Export metrics for use in other parts of the application
export const metrics = {
  httpRequestsTotal,
  httpRequestDuration,
  activeUsers,
  mediaRequestsTotal,
  downloadQueueSize,
  serviceHealth,
  wsConnectionsActive,
  wsMessagesTotal,
  dbConnectionsActive,
  dbQueriesTotal,
  dbQueryDuration,
  cacheHitsTotal,
  cacheMissesTotal,
  errorsTotal,
};

// Helper functions for common metric operations
export function recordMediaRequest(type: string, service: string) {
  mediaRequestsTotal.inc({ type, service });
}

export function updateDownloadQueueSize(status: string, size: number) {
  downloadQueueSize.set({ status }, size);
}

export function updateServiceHealth(service: string, isHealthy: boolean) {
  serviceHealth.set({ service }, isHealthy ? 1 : 0);
}

export function recordDatabaseQuery(operation: string, table: string, duration: number) {
  dbQueriesTotal.inc({ operation, table });
  dbQueryDuration.observe({ operation, table }, duration);
}

export function recordCacheOperation(cache: string, hit: boolean) {
  if (hit) {
    cacheHitsTotal.inc({ cache });
  } else {
    cacheMissesTotal.inc({ cache });
  }
}

export function recordError(type: string, code: string) {
  errorsTotal.inc({ type, code });
}

export function updateActiveConnections(db: number, ws: number) {
  dbConnectionsActive.set(db);
  wsConnectionsActive.set(ws);
}

export function recordWebSocketMessage(direction: 'in' | 'out', type: string) {
  wsMessagesTotal.inc({ direction, type });
}
