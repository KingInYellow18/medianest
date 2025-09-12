# MEDIANEST Loki Integration Guide

## Overview

Complete log aggregation solution for MEDIANEST using Grafana Loki, Promtail, and enhanced Winston logging.

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│ MEDIANEST Apps  │───▶│   Promtail   │───▶│    Loki     │───▶│   Grafana   │
│                 │    │              │    │             │    │             │
│ - Backend       │    │ Log Collector│    │ Log Storage │    │ Dashboards  │
│ - Frontend      │    │ - Files      │    │ - Indexing  │    │ - Querying  │
│ - Containers    │    │ - Docker     │    │ - 30d Retention    - Alerting  │
└─────────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
```

## Features

### ✅ Enhanced Logging

- **Structured JSON logs** for production
- **Correlation ID tracking** across requests
- **Performance metrics** logging
- **Security event** logging
- **Business metrics** integration

### ✅ Log Collection

- **Docker container logs** via Promtail
- **Application log files** with rotation
- **Error and exception logs** with stack traces
- **System logs** (optional)

### ✅ Storage & Retention

- **30-day retention policy**
- **Efficient indexing** with BoltDB Shipper
- **Automatic compaction** for storage optimization
- **Query performance tuning**

### ✅ Visualization

- **Pre-built Grafana dashboards**
- **Real-time log streaming**
- **Correlation ID linking**
- **Error rate monitoring**
- **Performance tracking**

## Quick Start

### 1. Start Loki Stack

```bash
# From project root
cd monitoring
docker-compose -f docker-compose.loki.yml up -d

# Verify services
docker-compose -f docker-compose.loki.yml ps
```

### 2. Connect to MEDIANEST Network

```bash
# Connect Promtail to MEDIANEST network for log collection
docker network connect medianest-development medianest-promtail
docker network connect medianest-development medianest-loki
```

### 3. Access Dashboards

- **Grafana**: http://localhost:3001
  - Username: `admin`
  - Password: `medianest_grafana`
- **Loki API**: http://localhost:3100
- **Promtail Metrics**: http://localhost:9080/metrics

## Configuration Files

### Core Configuration

- `loki/loki-config.yml` - Loki server configuration
- `promtail/promtail-config.yml` - Log collection rules
- `docker-compose.loki.yml` - Complete monitoring stack

### Grafana Integration

- `grafana/datasources/loki.yml` - Loki datasource configuration
- `grafana/dashboards/medianest-logs.json` - MEDIANEST dashboard
- `grafana/dashboards/dashboard.yml` - Dashboard provisioning

## Log Formats

### Development Logs

```
2025-09-11T20:05:13.226Z [abc123def] info: User login successful {"userId": "123", "ip": "192.168.1.1"}
```

### Production JSON Logs

```json
{
  "timestamp": "2025-09-11T20:05:13.226Z",
  "level": "info",
  "message": "User login successful",
  "service": "medianest-backend",
  "correlationId": "abc123def",
  "environment": "production",
  "requestId": "req_456",
  "method": "POST",
  "url": "/api/auth/login",
  "statusCode": 200,
  "responseTime": 45,
  "ip": "192.168.1.1",
  "userId": "123"
}
```

## Enhanced Logger Usage

### Basic Logging with Correlation

```typescript
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('req_123');
logger.info('Processing user request', { userId: '456' });
```

### Request Logging

```typescript
import { createRequestLogger } from '../utils/logger';

const requestLogger = createRequestLogger(req);
requestLogger.info('API request started');
```

### Performance Logging

```typescript
import { logPerformance } from '../utils/logger';

const startTime = Date.now();
// ... operation ...
logPerformance('database_query', Date.now() - startTime, { table: 'users' });
```

### Security Events

```typescript
import { logSecurityEvent } from '../utils/logger';

logSecurityEvent('failed_login_attempt', 'medium', {
  ip: req.ip,
  username: req.body.username,
  attempts: 3,
});
```

### Business Metrics

```typescript
import { logBusinessMetric } from '../utils/logger';

logBusinessMetric('user_signup', 1, 'count', { source: 'web' });
logBusinessMetric('revenue', 29.99, 'usd', { plan: 'premium' });
```

## Loki Query Examples

### Find logs by correlation ID

```logql
{service="medianest-backend"} | json | correlation_id="abc123def"
```

### Error logs in last hour

```logql
{service="medianest-backend",level="error"} | json
```

### Performance metrics

```logql
{service="medianest-backend"} | json | operation != ""
```

### HTTP requests with high response time

```logql
{service="medianest-backend"} | json | response_time > 1000
```

### Security events

```logql
{service="medianest-backend"} |~ "Security Event"
```

## Grafana Dashboards

### MEDIANEST Application Logs

- **Log volume** by service
- **Error rate** monitoring
- **Response time** distribution
- **HTTP status codes** breakdown
- **Top request URLs**
- **Security events** panel
- **Correlation ID** filtering

### Key Metrics

- **Error Rate**: Errors per second
- **Response Time**: P50, P95, P99 percentiles
- **Request Volume**: Requests per minute
- **Status Codes**: 2xx, 4xx, 5xx distribution

## Alerting (Optional)

Enable alerting with Alertmanager:

```bash
docker-compose -f docker-compose.loki.yml --profile alerting up -d
```

### Alert Rules

- High error rate (>10 errors/min)
- Slow response time (P95 > 2s)
- Security events (any critical)
- Service unavailable

## Storage Management

### Retention Policy

- **Default**: 30 days (720 hours)
- **Configuration**: `limits_config.retention_period` in loki-config.yml
- **Automatic cleanup**: Every 10 minutes

### Storage Optimization

- **Chunk size**: 256KB blocks, 1MB target
- **Compression**: Automatic via BoltDB Shipper
- **Indexing**: Optimized for time-series queries
- **Caching**: 100MB memory cache for queries

## Troubleshooting

### Common Issues

#### Promtail can't read Docker logs

```bash
# Check Docker socket permissions
ls -la /var/run/docker.sock

# Verify Promtail container access
docker exec medianest-promtail ls -la /var/run/docker.sock
```

#### Loki out of memory

```bash
# Check Loki memory usage
docker stats medianest-loki

# Adjust chunk settings in loki-config.yml
# Reduce chunk_idle_period and chunk_target_size
```

#### Grafana datasource issues

```bash
# Verify Loki connectivity
docker exec medianest-grafana curl http://loki:3100/ready

# Check Grafana logs
docker logs medianest-grafana
```

### Health Checks

```bash
# Check all services
docker-compose -f docker-compose.loki.yml ps

# Loki health
curl http://localhost:3100/ready

# Promtail metrics
curl http://localhost:9080/metrics

# Grafana health
curl http://localhost:3001/api/health
```

## Performance Tuning

### High-Volume Environments

1. **Increase ingestion limits** in loki-config.yml:

   ```yaml
   limits_config:
     ingestion_rate_mb: 16
     ingestion_burst_size_mb: 32
   ```

2. **Scale Loki horizontally** (requires object storage)
3. **Optimize Promtail batching**:
   ```yaml
   clients:
     - batchsize: 2097152 # 2MB
       batchwait: 2s
   ```

### Query Performance

1. **Use specific labels** in queries
2. **Limit time ranges** for large datasets
3. **Enable result caching**
4. **Use log sampling** for high-volume debug logs

## Integration with CI/CD

### Docker Compose Override

Create `docker-compose.override.yml` in project root:

```yaml
version: '3.8'
services:
  backend:
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
        labels: 'service,environment'
    labels:
      - 'com.medianest.service=backend'
      - 'com.medianest.environment=${ENVIRONMENT:-development}'
```

### Kubernetes Integration

Use the provided configurations as base for Kubernetes deployments with:

- **ConfigMaps** for Loki/Promtail configuration
- **PersistentVolumes** for data storage
- **Services** for network connectivity
- **Ingress** for external access

## Security Considerations

### Production Deployment

- Enable **authentication** in Loki
- Use **TLS encryption** for all connections
- Implement **RBAC** in Grafana
- **Secure datasource** credentials
- **Network segmentation** for monitoring stack

### Log Sanitization

- **Remove sensitive data** before logging
- **Hash user identifiers** where needed
- **Comply with GDPR** for personal data
- **Implement log retention** policies

## Monitoring the Monitoring

### Key Metrics to Monitor

- **Promtail ingestion rate** and errors
- **Loki memory usage** and query performance
- **Grafana dashboard** load times
- **Storage utilization** and growth rate
- **Query response times**

### Self-Monitoring Queries

```logql
# Promtail errors
{job="promtail"} |= "error"

# Loki performance
{job="loki"} | json | level="warn" or level="error"

# Storage growth
sum(increase(loki_ingester_chunks_created_total[1h]))
```
