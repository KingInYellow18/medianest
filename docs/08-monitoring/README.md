# Monitoring & Observability

Complete monitoring, logging, and observability setup for MediaNest.

## Overview

This section provides comprehensive guidance for monitoring MediaNest in production, including metrics collection, alerting, logging, and performance monitoring.

## Monitoring Documentation

### Core Monitoring

- [Health Monitoring](./health-monitoring.md) - System health checks and endpoints
- [Application Metrics](./application-metrics.md) - Custom application metrics
- [Performance Monitoring](./performance-monitoring.md) - Performance tracking and optimization
- [Error Tracking](./error-tracking.md) - Error monitoring and alerting

### Infrastructure Monitoring

- [Database Monitoring](./database-monitoring.md) - PostgreSQL and Redis monitoring
- [Container Monitoring](./container-monitoring.md) - Docker container metrics
- [Network Monitoring](./network-monitoring.md) - Network performance and security
- [Resource Monitoring](./resource-monitoring.md) - CPU, memory, disk usage

### Logging & Observability

- [Centralized Logging](./centralized-logging.md) - Log aggregation and analysis
- [Structured Logging](./structured-logging.md) - JSON logging best practices
- [Distributed Tracing](./distributed-tracing.md) - Request tracing across services
- [Log Analysis](./log-analysis.md) - Log parsing and insights

### Alerting & Notifications

- [Alert Configuration](./alert-configuration.md) - Setting up alerts and thresholds
- [Notification Channels](./notification-channels.md) - Email, Slack, webhook alerts
- [Escalation Policies](./escalation-policies.md) - Alert escalation procedures
- [Runbooks](./runbooks.md) - Incident response procedures

## Monitoring Stack

### Recommended Tools

```yaml
Metrics: Prometheus + Grafana
Logging: Winston + ELK Stack (optional)
APM: Built-in Node.js metrics
Alerting: Prometheus Alertmanager
Uptime: Custom health checks
```

### Quick Setup

```bash
# Start monitoring stack with MediaNest
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Access monitoring dashboards
# Grafana: http://localhost:3002
# Prometheus: http://localhost:9090
```

## Key Metrics to Monitor

### Application Metrics

- Response times (p50, p95, p99)
- Request rate (requests per minute)
- Error rate (4xx, 5xx responses)
- Active users and sessions
- Plex API call success rate

### Infrastructure Metrics

- CPU usage (< 80%)
- Memory usage (< 85%)
- Disk usage (< 90%)
- Network I/O
- Container health

### Business Metrics

- User registrations
- Media requests
- Search queries
- Authentication success rate
- Feature usage statistics

## Related Documentation

- [Deployment Guide](../06-deployment/README.md) - Production deployment with monitoring
- [Security Guide](../07-security/README.md) - Security monitoring practices
- [Performance Guide](../11-performance/README.md) - Performance optimization
- [Troubleshooting](../10-troubleshooting/README.md) - Using monitoring for troubleshooting
