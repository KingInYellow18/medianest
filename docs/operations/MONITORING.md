# MediaNest Monitoring Guide

**Version:** 4.0 - Comprehensive Monitoring Strategy  
**Last Updated:** September 7, 2025  
**Scope:** Application, Infrastructure, and Business Metrics

## Table of Contents

1. [Monitoring Overview](#monitoring-overview)
2. [Monitoring Stack](#monitoring-stack)
3. [Application Metrics](#application-metrics)
4. [Infrastructure Monitoring](#infrastructure-monitoring)
5. [Log Management](#log-management)
6. [Alerting Strategy](#alerting-strategy)
7. [Dashboard Configuration](#dashboard-configuration)
8. [Performance Monitoring](#performance-monitoring)
9. [Health Checks](#health-checks)
10. [Troubleshooting Monitoring](#troubleshooting-monitoring)

## Monitoring Overview

### Monitoring Philosophy

MediaNest follows a comprehensive monitoring approach based on the **Four Golden Signals**:

1. **Latency:** Response time for requests
2. **Traffic:** Rate of requests and user activity
3. **Errors:** Rate of failed requests and system errors
4. **Saturation:** Resource utilization (CPU, memory, disk, network)

### Key Monitoring Objectives

- **System Health:** Real-time service availability monitoring
- **Performance Tracking:** Response times and throughput metrics
- **Error Detection:** Automated error discovery and alerting
- **Capacity Planning:** Resource utilization trends
- **User Experience:** Frontend performance monitoring
- **Security Monitoring:** Authentication and access patterns

## Monitoring Stack

### Core Components

```yaml
Metrics Collection:
  - Prometheus: Time-series metrics database
  - Node Exporter: System-level metrics
  - Custom Exporters: Application-specific metrics

Visualization:
  - Grafana: Dashboards and visualization
  - Alertmanager: Alert management and routing

Log Management:
  - Winston: Structured application logging
  - Log aggregation: Centralized log collection
  - Log rotation: Automated log management

Application Performance:
  - Express middleware: Request/response tracking
  - Database monitoring: Query performance
  - External API monitoring: Third-party service health
```

### Architecture Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Application │───▶│ Prometheus  │───▶│  Grafana    │
│  Metrics    │    │  Server     │    │ Dashboards  │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Logs      │    │ Alertmanager│    │ Notification│
│ Aggregation │    │   Rules     │    │  Channels   │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Application Metrics

### Backend Metrics

#### HTTP Request Metrics

```javascript
// Express middleware for request tracking
const promClient = require('prom-client');

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});
```

#### Authentication Metrics

```javascript
const authAttempts = new promClient.Counter({
  name: 'auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['type', 'status'],
});

const activeUsers = new promClient.Gauge({
  name: 'active_users_current',
  help: 'Currently active users',
});

const sessionDuration = new promClient.Histogram({
  name: 'session_duration_seconds',
  help: 'User session duration',
});
```

#### Database Metrics

```javascript
const dbConnectionPool = new promClient.Gauge({
  name: 'db_connections_active',
  help: 'Active database connections',
});

const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'table'],
});
```

#### External Service Metrics

```javascript
const externalApiCalls = new promClient.Counter({
  name: 'external_api_calls_total',
  help: 'Total external API calls',
  labelNames: ['service', 'endpoint', 'status'],
});

const externalApiDuration = new promClient.Histogram({
  name: 'external_api_duration_seconds',
  help: 'External API call duration',
  labelNames: ['service', 'endpoint'],
});
```

### Frontend Metrics

#### User Experience Metrics

```javascript
// Client-side performance tracking
const performanceObserver = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (entry.entryType === 'navigation') {
      // Track page load times
      sendMetric('page_load_time', entry.loadEventEnd - entry.loadEventStart);
    }
  });
});

// Core Web Vitals
function trackWebVitals() {
  getCLS(sendMetric);
  getFID(sendMetric);
  getFCP(sendMetric);
  getLCP(sendMetric);
  getTTFB(sendMetric);
}
```

## Infrastructure Monitoring

### System Metrics

#### Server Resources

```yaml
CPU Metrics:
  - cpu_usage_percent: Overall CPU utilization
  - cpu_load_average: System load average (1m, 5m, 15m)
  - cpu_cores_available: Number of CPU cores

Memory Metrics:
  - memory_usage_bytes: Memory utilization
  - memory_available_bytes: Available memory
  - memory_usage_percent: Memory utilization percentage

Disk Metrics:
  - disk_usage_bytes: Disk space used
  - disk_available_bytes: Disk space available
  - disk_io_operations: Disk I/O operations per second

Network Metrics:
  - network_bytes_sent: Network bytes transmitted
  - network_bytes_received: Network bytes received
  - network_errors_total: Network error count
```

#### Container Metrics (Docker)

```yaml
Container Health:
  - container_cpu_usage: CPU usage per container
  - container_memory_usage: Memory usage per container
  - container_network_io: Network I/O per container
  - container_status: Container running status

Docker System:
  - docker_containers_running: Number of running containers
  - docker_images_total: Total Docker images
  - docker_volume_usage: Volume usage statistics
```

### Database Monitoring

#### PostgreSQL Metrics

```sql
-- Connection monitoring
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active';

-- Query performance
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Database size monitoring
SELECT pg_database_size('medianest') as db_size_bytes;
```

#### Redis Metrics

```bash
# Redis INFO command provides metrics
redis-cli info stats
redis-cli info memory
redis-cli info clients
```

## Log Management

### Structured Logging

#### Backend Logging Configuration

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

// Structured log format
logger.info('User authenticated', {
  userId: user.id,
  email: user.email,
  loginMethod: 'password',
  timestamp: new Date().toISOString(),
  requestId: req.id,
  userAgent: req.get('User-Agent'),
  ip: req.ip,
});
```

#### Log Levels and Categories

```yaml
Log Levels:
  - error: System errors and exceptions
  - warn: Warning conditions
  - info: General application flow
  - debug: Detailed diagnostic information

Log Categories:
  - auth: Authentication and authorization
  - api: HTTP API requests and responses
  - database: Database operations
  - external: External service calls
  - security: Security-related events
```

### Log Aggregation

#### Log Collection Pipeline

```yaml
Collection:
  - Application logs: Structured JSON logs
  - System logs: syslog, systemd journals
  - Container logs: Docker container logs
  - Web server logs: nginx access and error logs

Processing:
  - Log parsing: Extract structured data
  - Log enrichment: Add contextual information
  - Log filtering: Remove noise and sensitive data
  - Log routing: Direct to appropriate storage

Storage:
  - Long-term: Archive logs for compliance
  - Search: Indexed logs for quick search
  - Real-time: Live log streaming for monitoring
```

## Alerting Strategy

### Critical Alerts

#### Service Availability

```yaml
High Priority Alerts:
  - Service Down: HTTP health check failures
  - Database Unreachable: Connection failures
  - High Error Rate: >5% error rate for 5 minutes
  - Response Time: >2s average response time

Medium Priority Alerts:
  - High CPU Usage: >80% for 10 minutes
  - High Memory Usage: >85% for 10 minutes
  - Disk Space Low: <10% free space
  - External Service Errors: >10% failure rate

Low Priority Alerts:
  - Performance Degradation: Response time >1s
  - Authentication Issues: Failed login spike
  - Resource Trends: Gradual resource increase
```

#### Alert Configuration Examples

```yaml
# Prometheus AlertManager Rules
groups:
  - name: medianest.alerts
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Service {{ $labels.instance }} is down'

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: 'High error rate detected'
```

### Notification Channels

#### Multi-Channel Alerting

```yaml
Channels:
  - Email: Critical alerts to administrators
  - Slack: Team notifications for warnings
  - SMS: High-priority production issues
  - PagerDuty: On-call engineer escalation

Alert Routing:
  - Critical: All channels + immediate escalation
  - Warning: Email + Slack
  - Info: Slack only
  - Maintenance: Email notification
```

## Dashboard Configuration

### Grafana Dashboards

#### System Overview Dashboard

```yaml
Panels:
  - Service Status: Health check indicators
  - Request Rate: HTTP requests per second
  - Response Times: P50, P95, P99 latencies
  - Error Rates: Error percentage over time
  - Resource Usage: CPU, memory, disk utilization
  - Active Users: Current user session count
```

#### Application Performance Dashboard

```yaml
Panels:
  - API Endpoints: Performance by endpoint
  - Database Performance: Query times and connections
  - External Services: Third-party API status
  - Authentication: Login success/failure rates
  - User Activity: Page views and user actions
  - Cache Performance: Redis hit/miss rates
```

#### Infrastructure Dashboard

```yaml
Panels:
  - Server Resources: CPU, memory, disk, network
  - Container Health: Docker container status
  - Database Status: PostgreSQL and Redis metrics
  - Network Traffic: Bandwidth utilization
  - Storage Usage: Disk space trends
  - Security Events: Failed login attempts, suspicious activity
```

### Dashboard Best Practices

1. **Hierarchy:** Organize from high-level to detailed views
2. **Time Ranges:** Default to relevant time windows
3. **Thresholds:** Visual indicators for normal/warning/critical
4. **Annotations:** Mark deployment and maintenance events
5. **Drill-down:** Link related dashboards for investigation

## Performance Monitoring

### Application Performance Monitoring (APM)

#### Custom APM Implementation

```javascript
class APMTracker {
  static trackTransaction(name, fn) {
    const start = Date.now();
    return Promise.resolve(fn())
      .then((result) => {
        const duration = Date.now() - start;
        this.recordTransaction(name, duration, 'success');
        return result;
      })
      .catch((error) => {
        const duration = Date.now() - start;
        this.recordTransaction(name, duration, 'error');
        throw error;
      });
  }

  static recordTransaction(name, duration, status) {
    transactionDuration.observe({ transaction: name, status }, duration / 1000);
  }
}
```

#### Performance Benchmarks

```yaml
Response Time Targets:
  - API Endpoints: <200ms (P95)
  - Database Queries: <100ms (P95)
  - External API Calls: <1s (P95)
  - Page Load Time: <2s (P95)

Throughput Targets:
  - HTTP Requests: >100 RPS
  - Database Connections: <50% pool utilization
  - Memory Usage: <70% available memory
  - CPU Usage: <60% average utilization
```

## Health Checks

### Endpoint Health Checks

#### Comprehensive Health Check

```javascript
// /api/v1/health endpoint
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      externalServices: await checkExternalServices(),
      diskSpace: await checkDiskSpace(),
      memory: checkMemoryUsage(),
    },
  };

  const overallStatus = Object.values(health.checks).every((check) => check.status === 'healthy')
    ? 'healthy'
    : 'unhealthy';

  health.status = overallStatus;

  res.status(overallStatus === 'healthy' ? 200 : 503).json(health);
});
```

#### Individual Service Checks

```javascript
async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', responseTime: '<10ms' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

async function checkExternalServices() {
  const services = {
    plex: await checkPlexServer(),
    youtube: await checkYouTubeAPI(),
  };

  const overallHealth = Object.values(services).every((service) => service.status === 'healthy');

  return {
    status: overallHealth ? 'healthy' : 'degraded',
    services,
  };
}
```

## Troubleshooting Monitoring

### Common Monitoring Issues

#### 1. Missing Metrics

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Verify metric collection
curl http://localhost:4000/metrics

# Check application logs
tail -f logs/app.log | grep -i metric
```

#### 2. Alert Fatigue

- Review alert thresholds and adjust sensitivity
- Implement alert suppression during maintenance
- Group related alerts to reduce noise
- Use alert dependencies to prevent cascading alerts

#### 3. Dashboard Performance

- Optimize time ranges for large datasets
- Use recording rules for expensive queries
- Implement dashboard caching
- Limit concurrent dashboard queries

### Monitoring Best Practices

1. **Start Simple:** Begin with basic metrics and expand gradually
2. **Monitor What Matters:** Focus on user-impacting metrics
3. **Set Meaningful Alerts:** Avoid alerts that don't require action
4. **Document Everything:** Maintain runbooks for common scenarios
5. **Regular Review:** Periodically assess monitoring effectiveness

---

**Note:** This monitoring guide provides a comprehensive framework for MediaNest observability. Adjust configurations based on your specific infrastructure, scale, and operational requirements.
