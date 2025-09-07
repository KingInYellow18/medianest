# Monitoring and Logging Setup

Comprehensive guide for setting up monitoring, logging, alerting, and observability for MediaNest in production environments.

## Table of Contents

- [Overview](#overview)
- [Monitoring Stack](#monitoring-stack)
- [Metrics Collection](#metrics-collection)
- [Logging System](#logging-system)
- [Alerting Configuration](#alerting-configuration)
- [Health Checks](#health-checks)
- [Performance Monitoring](#performance-monitoring)
- [Security Monitoring](#security-monitoring)
- [Dashboards](#dashboards)
- [Troubleshooting](#troubleshooting)

## Overview

MediaNest uses a comprehensive monitoring and observability stack:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Loki**: Log aggregation and search
- **Promtail**: Log shipping
- **Alertmanager**: Alert routing and notification
- **Jaeger**: Distributed tracing (optional)
- **Node Exporter**: System metrics
- **Custom Metrics**: Application-specific monitoring

## Monitoring Stack

### Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   MediaNest │    │  Prometheus │    │   Grafana   │
│     App     │───▶│   Server    │───▶│ Dashboards  │
│             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
                           │                   │
                           ▼                   │
                   ┌─────────────┐            │
                   │ Alertmanager│            │
                   │   Alerts    │            │
                   └─────────────┘            │
                                              │
┌─────────────┐    ┌─────────────┐           │
│  Application│    │    Loki     │◀──────────┘
│    Logs     │───▶│ Log Storage │
│             │    │             │
└─────────────┘    └─────────────┘
       ▲                   ▲
       │                   │
┌─────────────┐    ┌─────────────┐
│  Promtail   │    │System Logs  │
│Log Shipping │    │  & Metrics  │
└─────────────┘    └─────────────┘
```

### Docker Compose Setup

#### Monitoring Services

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: medianest-prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
    ports:
      - '9090:9090'
    volumes:
      - ./monitoring/prometheus:/etc/prometheus:ro
      - prometheus_data:/prometheus
    networks:
      - monitoring
    restart: unless-stopped
    labels:
      - 'com.medianest.component=monitoring'

  grafana:
    image: grafana/grafana:latest
    container_name: medianest-grafana
    ports:
      - '3001:3000'
    environment:
      - GF_SECURITY_ADMIN_PASSWORD_FILE=/run/secrets/grafana_password
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_SERVER_DOMAIN=${DOMAIN_NAME}
      - GF_SERVER_ROOT_URL=https://${DOMAIN_NAME}/grafana/
      - GF_SERVER_SERVE_FROM_SUB_PATH=true
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
    secrets:
      - grafana_password
    networks:
      - monitoring
    restart: unless-stopped
    depends_on:
      - prometheus

  loki:
    image: grafana/loki:latest
    container_name: medianest-loki
    ports:
      - '3100:3100'
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - ./monitoring/loki:/etc/loki:ro
      - loki_data:/loki
    networks:
      - monitoring
    restart: unless-stopped

  promtail:
    image: grafana/promtail:latest
    container_name: medianest-promtail
    volumes:
      - ./monitoring/promtail:/etc/promtail:ro
      - /var/log:/var/log/host:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - medianest_logs:/var/log/app:ro
    command: -config.file=/etc/promtail/config.yml
    networks:
      - monitoring
    restart: unless-stopped
    depends_on:
      - loki

  alertmanager:
    image: prom/alertmanager:latest
    container_name: medianest-alertmanager
    ports:
      - '9093:9093'
    volumes:
      - ./monitoring/alertmanager:/etc/alertmanager:ro
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/config.yml'
      - '--storage.path=/alertmanager'
      - '--web.external-url=http://localhost:9093'
    networks:
      - monitoring
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    container_name: medianest-node-exporter
    ports:
      - '9100:9100'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - monitoring
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
  loki_data:
  alertmanager_data:
  medianest_logs:

networks:
  monitoring:
    driver: bridge

secrets:
  grafana_password:
    file: ./secrets/grafana_password
```

### Starting the Monitoring Stack

```bash
# Create monitoring configuration
mkdir -p monitoring/{prometheus,grafana,loki,promtail,alertmanager}

# Start monitoring services
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Verify services
docker-compose ps prometheus grafana loki promtail alertmanager
```

## Metrics Collection

### Prometheus Configuration

#### monitoring/prometheus/prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    environment: 'production'
    cluster: 'medianest'

rule_files:
  - 'alert_rules.yml'
  - 'recording_rules.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

scrape_configs:
  # MediaNest Backend Application
  - job_name: 'medianest-backend'
    static_configs:
      - targets: ['backend:4000']
    metrics_path: '/metrics'
    scrape_interval: 5s
    scrape_timeout: 5s
    honor_labels: true
    params:
      format: ['prometheus']

  # MediaNest Frontend Application
  - job_name: 'medianest-frontend'
    static_configs:
      - targets: ['frontend:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 10s

  # PostgreSQL Database
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
    scrape_interval: 30s
    metrics_path: '/metrics'
    params:
      include_databases: ['medianest']

  # Redis Cache
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 30s

  # Nginx Reverse Proxy
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:80']
    metrics_path: '/nginx_status'
    scrape_interval: 15s

  # System Metrics
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
    scrape_interval: 15s

  # Container Metrics
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
    scrape_interval: 15s

  # MediaNest Internal Services
  - job_name: 'medianest-services'
    scrape_interval: 15s
    static_configs:
      - targets:
          - 'backend:4000'
          - 'frontend:3000'
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
      - source_labels: [__address__]
        regex: '([^:]+):.*'
        target_label: service
        replacement: '${1}'
```

### Application Metrics

#### Backend Metrics

```javascript
// backend/src/utils/metrics.js
const promClient = require('prom-client');

// Create a Registry
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({
  register,
  prefix: 'medianest_',
  timeout: 5000,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Custom Metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'medianest_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDuration = new promClient.Histogram({
  name: 'medianest_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const activeConnections = new promClient.Gauge({
  name: 'medianest_active_connections',
  help: 'Number of active connections',
  labelNames: ['type'],
});

const databaseConnections = new promClient.Gauge({
  name: 'medianest_database_connections',
  help: 'Number of active database connections',
  labelNames: ['state'],
});

const queueSize = new promClient.Gauge({
  name: 'medianest_queue_size',
  help: 'Current queue size',
  labelNames: ['queue_name'],
});

const downloadProgress = new promClient.Gauge({
  name: 'medianest_download_progress',
  help: 'Current download progress percentage',
  labelNames: ['download_id', 'type'],
});

const plexConnectionStatus = new promClient.Gauge({
  name: 'medianest_plex_connection_status',
  help: 'Plex server connection status (1 = connected, 0 = disconnected)',
});

const cacheHitRatio = new promClient.Gauge({
  name: 'medianest_cache_hit_ratio',
  help: 'Cache hit ratio',
  labelNames: ['cache_type'],
});

// Register custom metrics
register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(activeConnections);
register.registerMetric(databaseConnections);
register.registerMetric(queueSize);
register.registerMetric(downloadProgress);
register.registerMetric(plexConnectionStatus);
register.registerMetric(cacheHitRatio);

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  activeConnections,
  databaseConnections,
  queueSize,
  downloadProgress,
  plexConnectionStatus,
  cacheHitRatio,
};
```

#### Metrics Middleware

```javascript
// backend/src/middleware/metrics.js
const { httpRequestsTotal, httpRequestDuration } = require('../utils/metrics');

const metricsMiddleware = (req, res, next) => {
  const start = Date.now();

  // Capture request start time
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;

    // Increment request counter
    httpRequestsTotal.labels(req.method, route, res.statusCode).inc();

    // Record request duration
    httpRequestDuration.labels(req.method, route, res.statusCode).observe(duration);
  });

  next();
};

module.exports = metricsMiddleware;
```

#### Metrics Endpoint

```javascript
// backend/src/routes/metrics.js
const express = require('express');
const { register } = require('../utils/metrics');

const router = express.Router();

router.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error.message);
  }
});

module.exports = router;
```

### Database Metrics

#### PostgreSQL Exporter

```yaml
# Add to docker-compose.monitoring.yml
postgres-exporter:
  image: prometheuscommunity/postgres-exporter:latest
  container_name: medianest-postgres-exporter
  environment:
    DATA_SOURCE_NAME: 'postgresql://medianest:${DB_PASSWORD}@postgres:5432/medianest?sslmode=disable'
    PG_EXPORTER_EXTEND_QUERY_PATH: '/etc/postgres_exporter/queries.yaml'
  volumes:
    - ./monitoring/postgres-exporter:/etc/postgres_exporter:ro
  ports:
    - '9187:9187'
  networks:
    - monitoring
    - backend-network
  depends_on:
    - postgres
  restart: unless-stopped
```

#### Custom Database Queries

```yaml
# monitoring/postgres-exporter/queries.yaml
pg_database:
  query: 'SELECT pg_database.datname, pg_database_size(pg_database.datname) as size FROM pg_database'
  master: true
  cache_seconds: 30
  metrics:
    - datname:
        usage: 'LABEL'
        description: 'Name of database'
    - size:
        usage: 'GAUGE'
        description: 'Disk space used by the database'

pg_table_stats:
  query: |
    SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup, n_dead_tup
    FROM pg_stat_user_tables
  master: true
  cache_seconds: 30
  metrics:
    - schemaname:
        usage: 'LABEL'
        description: 'Name of schema'
    - tablename:
        usage: 'LABEL'
        description: 'Name of table'
    - n_tup_ins:
        usage: 'COUNTER'
        description: 'Number of tuples inserted'
    - n_tup_upd:
        usage: 'COUNTER'
        description: 'Number of tuples updated'
    - n_tup_del:
        usage: 'COUNTER'
        description: 'Number of tuples deleted'
    - n_live_tup:
        usage: 'GAUGE'
        description: 'Number of live tuples'
    - n_dead_tup:
        usage: 'GAUGE'
        description: 'Number of dead tuples'
```

## Logging System

### Loki Configuration

#### monitoring/loki/loki-config.yaml

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2023-01-01
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    cache_ttl: 24h
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

compactor:
  working_directory: /loki/boltdb-shipper-compactor
  shared_store: filesystem

limits_config:
  retention_period: 744h # 31 days
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  ingestion_rate_mb: 16
  ingestion_burst_size_mb: 32
  max_streams_per_user: 10000
  max_line_size: 256000

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: true
  retention_period: 744h

ruler:
  storage:
    type: local
    local:
      directory: /loki/rules
  rule_path: /loki/rules
  alertmanager_url: http://alertmanager:9093
  ring:
    kvstore:
      store: inmemory
  enable_api: true
```

### Promtail Configuration

#### monitoring/promtail/config.yml

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Docker container logs
  - job_name: containers
    static_configs:
      - targets:
          - localhost
        labels:
          job: containerlogs
          __path__: /var/lib/docker/containers/*/*.log
    pipeline_stages:
      - json:
          expressions:
            output: log
            stream: stream
            attrs:
      - json:
          expressions:
            tag:
          source: attrs
      - regex:
          expression: (?P<container_name>(?:[^|]*))\|(?P<image_name>(?:[^|]*))\|(?P<image_id>(?:[^|]*))\|(?P<container_id>(?:[^|]*))
          source: tag
      - timestamp:
          format: RFC3339Nano
          source: time
      - labels:
          stream:
          container_name:
          image_name:
      - output:
          source: output

  # MediaNest application logs
  - job_name: medianest-backend
    static_configs:
      - targets:
          - localhost
        labels:
          job: medianest-backend
          __path__: /var/log/app/backend/*.log
    pipeline_stages:
      - json:
          expressions:
            timestamp: time
            level: level
            message: message
            service: service
            trace_id: traceId
            user_id: userId
      - timestamp:
          format: RFC3339
          source: timestamp
      - labels:
          level:
          service:
          trace_id:
          user_id:

  # MediaNest frontend logs
  - job_name: medianest-frontend
    static_configs:
      - targets:
          - localhost
        labels:
          job: medianest-frontend
          __path__: /var/log/app/frontend/*.log

  # Nginx access logs
  - job_name: nginx-access
    static_configs:
      - targets:
          - localhost
        labels:
          job: nginx-access
          __path__: /var/log/nginx/access.log
    pipeline_stages:
      - json:
          expressions:
            timestamp: timestamp
            remote_addr: remote_addr
            request: request
            status: status
            body_bytes_sent: body_bytes_sent
            request_time: request_time
            upstream_response_time: upstream_response_time
      - timestamp:
          format: RFC3339
          source: timestamp
      - labels:
          remote_addr:
          status:
          upstream_response_time:

  # Nginx error logs
  - job_name: nginx-error
    static_configs:
      - targets:
          - localhost
        labels:
          job: nginx-error
          __path__: /var/log/nginx/error.log

  # System logs
  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: system
          __path__: /var/log/host/syslog
```

### Application Logging Configuration

#### Backend Logging

```javascript
// backend/src/utils/logger.js
const winston = require('winston');
const config = require('../config');

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, traceId, userId, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      service: service || 'medianest-backend',
      traceId,
      userId,
      ...meta,
    });
  })
);

const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'medianest-backend' },
  transports: [
    // File logging for production
    new winston.transports.File({
      filename: '/var/log/app/backend/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 7,
      tailable: true,
    }),
    new winston.transports.File({
      filename: '/var/log/app/backend/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 7,
      tailable: true,
    }),
  ],
});

// Console logging for development
if (config.server.env !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
}

// Request logging middleware
logger.requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      traceId: req.traceId,
      userId: req.user?.id,
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
};

module.exports = logger;
```

#### Frontend Logging

```javascript
// frontend/src/utils/logger.js
class Logger {
  constructor() {
    this.apiUrl = process.env.NEXT_PUBLIC_API_URL;
    this.environment = process.env.NODE_ENV;
  }

  log(level, message, meta = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: 'medianest-frontend',
      environment: this.environment,
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...meta,
    };

    // Console logging
    console[level] ? console[level](message, meta) : console.log(message, meta);

    // Send to backend in production
    if (this.environment === 'production' && level === 'error') {
      this.sendToBackend(logEntry);
    }
  }

  async sendToBackend(logEntry) {
    try {
      await fetch(`${this.apiUrl}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      console.error('Failed to send log to backend:', error);
    }
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  error(message, meta) {
    this.log('error', message, meta);
  }

  debug(message, meta) {
    if (this.environment === 'development') {
      this.log('debug', message, meta);
    }
  }
}

export default new Logger();
```

## Alerting Configuration

### Alertmanager Configuration

#### monitoring/alertmanager/config.yml

```yaml
global:
  smtp_smarthost: '${SMTP_HOST}:${SMTP_PORT}'
  smtp_from: '${SMTP_FROM}'
  smtp_auth_username: '${SMTP_USER}'
  smtp_auth_password: '${SMTP_PASS}'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        severity: warning
      receiver: 'warning-alerts'
    - match:
        service: medianest-backend
      receiver: 'backend-alerts'
    - match:
        service: medianest-frontend
      receiver: 'frontend-alerts'

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://webhook:5001/'

  - name: 'critical-alerts'
    email_configs:
      - to: 'admin@yourdomain.com'
        subject: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        body: |
          Alert: {{ .GroupLabels.alertname }}
          Severity: {{ .CommonLabels.severity }}
          Instance: {{ .CommonLabels.instance }}
          Description: {{ .CommonAnnotations.description }}

          {{ range .Alerts }}
          - Alert: {{ .Annotations.summary }}
            Value: {{ .Annotations.value }}
            Started: {{ .StartsAt.Format "2006-01-02 15:04:05" }}
          {{ end }}
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts-critical'
        color: 'danger'
        title: 'Critical Alert: {{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'

  - name: 'warning-alerts'
    email_configs:
      - to: 'team@yourdomain.com'
        subject: '⚠️ WARNING: {{ .GroupLabels.alertname }}'
        body: |
          Alert: {{ .GroupLabels.alertname }}
          Severity: {{ .CommonLabels.severity }}
          Instance: {{ .CommonLabels.instance }}
          Description: {{ .CommonAnnotations.description }}

  - name: 'backend-alerts'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#backend-alerts'
        color: 'warning'
        title: 'Backend Alert: {{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'

  - name: 'frontend-alerts'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#frontend-alerts'
        color: 'warning'
        title: 'Frontend Alert: {{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
```

### Alert Rules

#### monitoring/prometheus/alert_rules.yml

```yaml
groups:
  - name: medianest-alerts
    rules:
      # High-level service alerts
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Service {{ $labels.job }} is down'
          description: 'Service {{ $labels.job }} on instance {{ $labels.instance }} has been down for more than 1 minute'

      - alert: HighErrorRate
        expr: rate(medianest_http_requests_total{status_code=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High error rate detected'
          description: 'Error rate is {{ $value }} errors per second on {{ $labels.instance }}'

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(medianest_http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High response time detected'
          description: '95th percentile response time is {{ $value }}s on {{ $labels.instance }}'

      # Database alerts
      - alert: DatabaseConnectionsHigh
        expr: medianest_database_connections > 80
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: 'High number of database connections'
          description: 'Database has {{ $value }} active connections'

      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'PostgreSQL database is down'
          description: 'PostgreSQL database has been down for more than 1 minute'

      # Redis alerts
      - alert: RedisDown
        expr: up{job="redis"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Redis is down'
          description: 'Redis has been down for more than 1 minute'

      - alert: RedisMemoryHigh
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Redis memory usage is high'
          description: 'Redis memory usage is {{ $value | humanizePercentage }}'

      # System resource alerts
      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High CPU usage detected'
          description: 'CPU usage is {{ $value }}% on {{ $labels.instance }}'

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'High memory usage detected'
          description: 'Memory usage is {{ $value }}% on {{ $labels.instance }}'

      - alert: DiskSpaceRunningOut
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100 < 10
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Disk space running out'
          description: 'Disk space is {{ $value }}% full on {{ $labels.instance }} filesystem {{ $labels.mountpoint }}'

      # Application-specific alerts
      - alert: PlexConnectionLost
        expr: medianest_plex_connection_status == 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: 'Plex server connection lost'
          description: 'MediaNest has lost connection to Plex server'

      - alert: DownloadQueueStuck
        expr: increase(medianest_queue_size{queue_name="downloads"}[10m]) == 0 and medianest_queue_size{queue_name="downloads"} > 0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 'Download queue appears stuck'
          description: 'Download queue size has not changed for 10 minutes with {{ $value }} items pending'

      - alert: HighFailedDownloads
        expr: rate(medianest_downloads_total{status="failed"}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High failed download rate'
          description: 'Failed download rate is {{ $value }} failures per second'

      # SSL certificate expiry
      - alert: SSLCertificateExpiringSoon
        expr: probe_ssl_earliest_cert_expiry - time() < 86400 * 7
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: 'SSL certificate expiring soon'
          description: 'SSL certificate for {{ $labels.instance }} expires in {{ $value | humanizeDuration }}'

      - alert: SSLCertificateExpired
        expr: probe_ssl_earliest_cert_expiry - time() < 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'SSL certificate expired'
          description: 'SSL certificate for {{ $labels.instance }} has expired'
```

## Health Checks

### Application Health Endpoints

#### Comprehensive Health Check

```javascript
// backend/src/routes/health.js
const express = require('express');
const router = express.Router();
const pool = require('../database/connection');
const redis = require('../utils/redis');
const axios = require('axios');

// Basic health check
router.get('/health', async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    version: process.env.npm_package_version || 'unknown',
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    checks: {},
  };

  try {
    // Database health
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    checks.checks.database = {
      status: 'healthy',
      responseTime: Date.now() - dbStart,
      connections: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };
  } catch (error) {
    checks.checks.database = {
      status: 'unhealthy',
      error: error.message,
    };
    checks.status = 'unhealthy';
  }

  try {
    // Redis health
    const redisStart = Date.now();
    await redis.ping();
    const info = await redis.info('memory');
    checks.checks.redis = {
      status: 'healthy',
      responseTime: Date.now() - redisStart,
      memory: parseRedisInfo(info),
    };
  } catch (error) {
    checks.checks.redis = {
      status: 'unhealthy',
      error: error.message,
    };
    checks.status = 'unhealthy';
  }

  try {
    // Plex server health (if configured)
    if (process.env.PLEX_URL) {
      const plexStart = Date.now();
      const response = await axios.get(`${process.env.PLEX_URL}/status/sessions`, {
        headers: { 'X-Plex-Token': process.env.PLEX_TOKEN },
        timeout: 5000,
      });
      checks.checks.plex = {
        status: 'healthy',
        responseTime: Date.now() - plexStart,
        sessions: response.data?.MediaContainer?.size || 0,
      };
    }
  } catch (error) {
    checks.checks.plex = {
      status: 'unhealthy',
      error: error.message,
    };
    if (process.env.PLEX_REQUIRED === 'true') {
      checks.status = 'unhealthy';
    }
  }

  // System resources
  checks.checks.system = {
    status: 'healthy',
    memory: {
      used: process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external,
      rss: process.memoryUsage().rss,
    },
    cpu: process.cpuUsage(),
  };

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(checks);
});

// Readiness check (can handle traffic)
router.get('/ready', async (req, res) => {
  try {
    // Quick checks for readiness
    await pool.query('SELECT 1');
    await redis.ping();

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Liveness check (container should restart if this fails)
router.get('/live', (req, res) => {
  // Very basic check - if we can respond, we're alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
});

function parseRedisInfo(info) {
  const lines = info.split('\r\n');
  const memory = {};

  lines.forEach((line) => {
    if (line.includes('used_memory:')) {
      memory.used = parseInt(line.split(':')[1]);
    } else if (line.includes('used_memory_human:')) {
      memory.usedHuman = line.split(':')[1];
    } else if (line.includes('maxmemory:')) {
      memory.max = parseInt(line.split(':')[1]);
    }
  });

  return memory;
}

module.exports = router;
```

### External Health Monitoring

#### Docker Health Checks

```yaml
# In docker-compose.prod.yml
services:
  backend:
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:4000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  frontend:
    healthcheck:
      test:
        ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:3000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 45s

  postgres:
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U medianest -d medianest']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  redis:
    healthcheck:
      test:
        [
          'CMD',
          'redis-cli',
          '--no-auth-warning',
          '-a',
          '$$(cat /run/secrets/redis_password)',
          'ping',
        ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
```

## Performance Monitoring

### APM Integration

#### New Relic Integration

```javascript
// backend/src/apm.js
const newrelic = require('newrelic');

// Custom instrumentation
newrelic.addCustomAttribute('service', 'medianest-backend');
newrelic.addCustomAttribute('version', process.env.npm_package_version);

// Custom metrics
const recordDownloadMetric = (duration, success) => {
  newrelic.recordMetric('Custom/Download/Duration', duration);
  newrelic.recordMetric(`Custom/Download/${success ? 'Success' : 'Failure'}`, 1);
};

const recordPlexApiCall = (endpoint, responseTime) => {
  newrelic.recordMetric(`Custom/Plex/${endpoint}`, responseTime);
};

module.exports = {
  recordDownloadMetric,
  recordPlexApiCall,
};
```

#### Custom Performance Tracking

```javascript
// backend/src/utils/performance.js
const { performance, PerformanceObserver } = require('perf_hooks');
const logger = require('./logger');

class PerformanceMonitor {
  constructor() {
    this.measurements = new Map();
    this.setupObserver();
  }

  setupObserver() {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name.startsWith('medianest:')) {
          logger.info('Performance measurement', {
            name: entry.name,
            duration: entry.duration,
            type: entry.entryType,
          });
        }
      });
    });

    observer.observe({ entryTypes: ['measure'] });
  }

  start(name) {
    performance.mark(`${name}-start`);
  }

  end(name) {
    performance.mark(`${name}-end`);
    performance.measure(`medianest:${name}`, `${name}-start`, `${name}-end`);
  }

  async trackAsync(name, asyncFn) {
    this.start(name);
    try {
      const result = await asyncFn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }
}

module.exports = new PerformanceMonitor();
```

## Security Monitoring

### Security Event Logging

```javascript
// backend/src/middleware/security-logger.js
const logger = require('../utils/logger');

const securityLogger = {
  logFailedLogin: (req, email, reason) => {
    logger.warn('Failed login attempt', {
      event: 'failed_login',
      email,
      reason,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });
  },

  logSuspiciousActivity: (req, activity, details) => {
    logger.warn('Suspicious activity detected', {
      event: 'suspicious_activity',
      activity,
      details,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });
  },

  logRateLimitExceeded: (req, limit) => {
    logger.warn('Rate limit exceeded', {
      event: 'rate_limit_exceeded',
      limit,
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
  },

  logAccessAttempt: (req, resource, allowed) => {
    logger.info('Access attempt', {
      event: 'access_attempt',
      resource,
      allowed,
      userId: req.user?.id,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
  },
};

module.exports = securityLogger;
```

### Intrusion Detection

```yaml
# monitoring/prometheus/security_rules.yml
groups:
  - name: security-alerts
    rules:
      - alert: BruteForceAttack
        expr: increase(medianest_failed_logins_total[5m]) > 10
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Potential brute force attack detected'
          description: 'More than 10 failed login attempts in 5 minutes from {{ $labels.ip }}'

      - alert: SuspiciousUserActivity
        expr: increase(medianest_suspicious_activity_total[10m]) > 5
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: 'Suspicious user activity detected'
          description: 'Multiple suspicious activities detected from {{ $labels.ip }}'

      - alert: UnauthorizedAccessAttempt
        expr: increase(medianest_unauthorized_access_total[5m]) > 5
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: 'Multiple unauthorized access attempts'
          description: '{{ $value }} unauthorized access attempts from {{ $labels.ip }}'
```

## Troubleshooting

### Common Monitoring Issues

#### Prometheus Not Scraping Metrics

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check service connectivity
docker-compose exec prometheus wget -qO- http://backend:4000/metrics

# Verify network connectivity
docker-compose exec prometheus nslookup backend
```

#### Grafana Dashboard Not Loading Data

```bash
# Check Grafana data source
curl -H "Authorization: Bearer <api-key>" http://localhost:3001/api/datasources

# Test Prometheus connection
curl -H "Authorization: Bearer <api-key>" \
  "http://localhost:3001/api/datasources/proxy/1/api/v1/query?query=up"

# Check Grafana logs
docker-compose logs grafana
```

#### Loki Not Receiving Logs

```bash
# Check Loki ingestion
curl http://localhost:3100/ready

# Test log ingestion
curl -H "Content-Type: application/json" \
  -XPOST "http://localhost:3100/loki/api/v1/push" \
  --data-raw '{"streams": [{"stream": {"job": "test"}, "values": [["1640995200000000000", "test log message"]]}]}'

# Check Promtail status
docker-compose exec promtail promtail -config.file=/etc/promtail/config.yml -dry-run
```

### Performance Optimization

#### Prometheus Storage Optimization

```yaml
# Adjust retention and storage settings
prometheus:
  command:
    - '--storage.tsdb.retention.time=30d'
    - '--storage.tsdb.retention.size=10GB'
    - '--storage.tsdb.wal-compression'
```

#### Grafana Performance

```bash
# Optimize Grafana database
docker-compose exec grafana sqlite3 /var/lib/grafana/grafana.db "VACUUM;"

# Clear Grafana cache
curl -X POST http://admin:password@localhost:3001/api/admin/provisioning/dashboards/reload
```

### Monitoring Best Practices

1. **Start with essential metrics** - Don't monitor everything at once
2. **Set meaningful thresholds** - Avoid alert fatigue
3. **Use labels effectively** - Enable powerful querying
4. **Monitor user experience** - Not just system metrics
5. **Regular maintenance** - Clean up old data and unused dashboards
6. **Document your dashboards** - Make them maintainable
7. **Test your alerts** - Ensure they fire when expected
8. **Monitor your monitoring** - Keep monitoring systems healthy
9. **Correlate logs and metrics** - Link related information
10. **Regular reviews** - Update monitoring as system evolves

For additional configuration and advanced topics, see:

- [Production Deployment Guide](./production-deployment-guide.md)
- [Configuration Management](./configuration-management.md)
- [Backup and Recovery](./backup-recovery-procedures.md)
