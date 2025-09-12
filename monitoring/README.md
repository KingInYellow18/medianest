# MEDIANEST PLG Observability Stack

Complete Prometheus, Loki, and Grafana monitoring solution for the MEDIANEST media management platform.

## 📊 Stack Overview

### Core Components

- **Prometheus** - Time-series metrics database and alerting
- **Loki** - Log aggregation and querying
- **Grafana** - Unified visualization dashboard
- **AlertManager** - Alert routing and notification management
- **Promtail** - Log collection and forwarding

### Exporters & Monitoring

- **Node Exporter** - System metrics (CPU, memory, disk, network)
- **cAdvisor** - Container resource usage
- **PostgreSQL Exporter** - Database performance metrics
- **Redis Exporter** - Cache performance and usage
- **Blackbox Exporter** - Endpoint availability monitoring
- **Pushgateway** - Batch job metrics collection

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose installed
- MEDIANEST application running
- Minimum 4GB RAM and 20GB disk space

### Start the Stack

```bash
# Navigate to monitoring directory
cd monitoring/

# Start all services (creates data directories and config)
./start-monitoring.sh start

# Check service health
./start-monitoring.sh status

# View logs
./start-monitoring.sh logs [service-name]
```

### Access URLs

- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093
- **Loki**: http://localhost:3100

## 📈 Metrics Collection

### Application Metrics (/metrics endpoint)

MEDIANEST backend exposes comprehensive metrics at `http://localhost:4000/metrics`:

#### HTTP Metrics

- `medianest_http_request_duration_seconds` - Request latency by endpoint
- `medianest_http_requests_total` - Request count by status code
- `medianest_http_request_size_bytes` - Request payload sizes
- `medianest_http_response_size_bytes` - Response payload sizes
- `medianest_http_active_connections` - Active HTTP connections

#### Database Metrics

- `medianest_database_query_duration_seconds` - Query performance
- `medianest_database_queries_total` - Query count by operation
- `medianest_database_connections_active` - Active DB connections
- `medianest_database_connections_idle` - Idle DB connections

#### Redis Metrics

- `medianest_redis_operation_duration_seconds` - Redis command latency
- `medianest_redis_operations_total` - Redis command count
- `medianest_redis_connections_active` - Active Redis connections
- `medianest_redis_cache_hit_ratio` - Cache effectiveness

#### Business Metrics

- `medianest_media_requests_total` - Media processing requests
- `medianest_media_request_duration_seconds` - Processing time
- `medianest_user_sessions_active` - Active user sessions
- `medianest_queue_size` - Background job queue depth

#### Security Metrics

- `medianest_auth_attempts_total` - Authentication attempts
- `medianest_rate_limit_hits_total` - Rate limiting triggers
- `medianest_security_events_total` - Security incidents

### Infrastructure Metrics

#### System (Node Exporter)

- CPU usage, load averages
- Memory usage and swap
- Disk I/O and space utilization
- Network interface statistics

#### Containers (cAdvisor)

- Container CPU and memory usage
- Container network and filesystem I/O
- Container restart and health status

## 🔍 Log Collection

### Application Logs

Promtail collects and parses logs from:

- **Backend Application**: `/backend/logs/*.log` (Winston JSON format)
- **System Logs**: `/var/log/syslog`
- **Container Logs**: `/var/lib/docker/containers/*/*log`
- **Database Logs**: PostgreSQL and Redis logs (if accessible)

### Log Structure

All logs are enriched with structured metadata:

```json
{
  "timestamp": "2025-09-11T20:00:00.000Z",
  "level": "info",
  "message": "Request completed",
  "service": "medianest-backend",
  "correlationId": "abc123",
  "meta": {
    "method": "GET",
    "url": "/api/media",
    "statusCode": 200,
    "responseTime": 45
  }
}
```

## 🚨 Alerting

### Alert Categories

#### Critical Alerts (Immediate Response)

- **ApplicationDown**: Backend service unreachable
- **CriticalErrorRate**: >5% HTTP 5xx errors
- **CriticalResponseTime**: >5s response time
- **DatabaseDown**: PostgreSQL unavailable
- **RedisDown**: Redis cache unavailable

#### Warning Alerts (Monitor)

- **HighErrorRate**: >1% HTTP 5xx errors
- **HighResponseTime**: >2s response time
- **HighCPUUsage**: >80% system CPU
- **HighMemoryUsage**: >80% system memory
- **SlowDatabaseQueries**: >1s query time

#### Business Alerts

- **MediaRequestBacklog**: >100 queued requests
- **LowActiveUsers**: <1 active user for 1 hour
- **ExternalServiceFailure**: >10% API error rate

### Notification Channels

- **Email**: ops-team@medianest.local
- **Slack**: #alerts-critical, #alerts-application
- **Webhook**: Integration with PagerDuty or incident management

## 📊 Dashboard Templates

### Pre-configured Dashboards

1. **MEDIANEST Application Overview**
   - Request rates and response times
   - Error rates and status codes
   - Database and Redis performance
   - Business metrics (media requests, user activity)

2. **Infrastructure Health**
   - System resource utilization
   - Container performance
   - Network and disk I/O
   - Service discovery and health

3. **Database Performance**
   - Query performance and slow queries
   - Connection pool utilization
   - Table and index statistics
   - Backup and maintenance status

4. **Logs and Traces**
   - Log volume and error rates
   - Correlation ID tracking
   - Error stack traces
   - Security events

5. **SLO Dashboard**
   - Service level objectives
   - Error budget tracking
   - Availability metrics
   - Performance SLIs

## ⚙️ Configuration

### Environment Variables

Create `.env.monitoring` file:

```bash
# Database Credentials
POSTGRES_PASSWORD=your_postgres_password
REDIS_PASSWORD=your_redis_password

# Grafana Settings
GRAFANA_PASSWORD=secure_admin_password

# AlertManager Notifications
SMTP_HOST=smtp.your-domain.com
SMTP_USERNAME=alerts@your-domain.com
SMTP_PASSWORD=smtp_password
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Security
METRICS_TOKEN=secure-metrics-access-token
```

### Retention Policies

- **Metrics**: 30 days (configurable in prometheus.yml)
- **Logs**: 30 days (configurable in loki-config.yml)
- **Alerts**: 7 days retention in AlertManager

### Resource Requirements

#### Minimum (Development)

- 2 CPU cores
- 4GB RAM
- 20GB disk space

#### Production

- 4 CPU cores
- 8GB RAM
- 100GB disk space (with log/metric retention)

## 🛠️ Operations

### Service Management

```bash
# Start all services
./start-monitoring.sh start

# Stop all services
./start-monitoring.sh stop

# Restart services
./start-monitoring.sh restart

# View service status
./start-monitoring.sh status

# View service logs
./start-monitoring.sh logs [service-name]

# Clean all data (destructive)
./start-monitoring.sh clean
```

### Health Checks

```bash
# Check service health
curl http://localhost:9090/-/healthy  # Prometheus
curl http://localhost:3001/api/health # Grafana
curl http://localhost:3100/ready      # Loki
curl http://localhost:9093/-/healthy  # AlertManager
```

### Backup Procedures

```bash
# Backup Prometheus data
tar -czf prometheus-backup-$(date +%Y%m%d).tar.gz data/prometheus/

# Backup Grafana dashboards
tar -czf grafana-backup-$(date +%Y%m%d).tar.gz data/grafana/

# Backup alert configurations
tar -czf config-backup-$(date +%Y%m%d).tar.gz prometheus/ alertmanager/
```

## 🔧 Troubleshooting

### Common Issues

#### Services Not Starting

- Check Docker daemon is running
- Verify port availability (9090, 3001, 3100, etc.)
- Check data directory permissions
- Review service logs: `./start-monitoring.sh logs [service]`

#### No Metrics from Application

- Verify MEDIANEST backend is running on port 4000
- Check `/metrics` endpoint: `curl http://localhost:4000/metrics`
- Ensure Prometheus can reach backend container
- Review Prometheus targets: http://localhost:9090/targets

#### Grafana Can't Connect to Data Sources

- Verify Prometheus URL: http://prometheus:9090
- Check network connectivity between containers
- Review Grafana logs for connection errors
- Test data source connections in Grafana UI

#### Missing Logs in Loki

- Check Promtail service status
- Verify log file paths in promtail-config.yml
- Ensure log files are readable by Promtail
- Review Promtail logs for parsing errors

### Performance Tuning

#### High Memory Usage

- Reduce retention periods in configuration
- Adjust Prometheus scrape intervals
- Limit high-cardinality metrics
- Enable metric compression

#### Slow Queries

- Add database indexes for frequently queried metrics
- Optimize PromQL queries in dashboards
- Use recording rules for complex aggregations
- Implement query caching

## 📚 Integration Guide

### Adding Custom Metrics

1. **In Application Code**:

```typescript
import { trackCustomMetric } from './metrics/prometheus';

// Track business metric
trackMediaRequest('movie', 'completed', 'plex', 'premium');
```

2. **In Prometheus Config**:

```yaml
- job_name: 'custom-exporter'
  static_configs:
    - targets: ['your-service:port']
```

### Custom Dashboards

1. Create JSON dashboard in `grafana/dashboards/`
2. Import via Grafana UI or provisioning
3. Use template variables for dynamic filtering
4. Add alerting rules for critical metrics

### External Integrations

- **PagerDuty**: Configure webhook in alertmanager.yml
- **Slack**: Add webhook URL for team notifications
- **ITSM Tools**: Use webhook receivers for ticket creation
- **Custom APIs**: Implement webhook handlers for alert processing

## 🔒 Security Considerations

- Metrics endpoint protected with bearer token in production
- Network segmentation between monitoring and application
- TLS encryption for external communications
- Regular security updates for monitoring components
- Access control and audit logging in Grafana

## 📞 Support

For issues and questions:

- Check service logs: `./start-monitoring.sh logs`
- Review configuration files for syntax errors
- Verify network connectivity between services
- Consult component documentation (Prometheus, Grafana, Loki)

---

**Stack Version**: v1.0.0  
**Last Updated**: 2025-09-11  
**Compatibility**: MEDIANEST v1.0.0+
