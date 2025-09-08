# Observe - Comprehensive Observability Stack

## 🎯 Overview

This observability stack provides complete visibility into the Observe application with minimal impact on existing code. It runs in parallel with technical debt elimination efforts and actually helps identify issues during the cleanup process.

## 🏗️ Architecture

### Three Pillars of Observability

1. **Metrics** (Prometheus + Grafana)

   - HTTP request/response metrics
   - Database performance tracking
   - External API monitoring
   - Business metrics (media requests, user activity)
   - Infrastructure monitoring

2. **Logs** (Loki + Promtail)

   - Structured JSON logging
   - Correlation ID tracking
   - Centralized log aggregation
   - Frontend error tracking

3. **Traces** (Jaeger + OpenTelemetry)
   - Distributed request tracing
   - Database query tracing
   - External API call tracing
   - Performance bottleneck identification

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js backend running on port 3000
- Frontend running on port 3001

### 1. Deploy Observability Stack

```bash
# Deploy complete stack
./scripts/deploy-observability.sh

# Check deployment status
./scripts/deploy-observability.sh health
```

### 2. Integrate with Application

#### Backend Integration

Add to your Express app:

```typescript
import { metricsMiddleware, register } from './middleware/metrics';
import { correlationMiddleware, requestLoggingMiddleware } from './middleware/logging';

// Add middleware
app.use(correlationMiddleware);
app.use(requestLoggingMiddleware);
app.use(metricsMiddleware);

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

#### Frontend Integration

Add to your React app:

```typescript
import logger from './lib/logger';

// Track page views
logger.trackPageView('/dashboard');

// Track user interactions
logger.trackUserInteraction('button_click', 'submit_form');

// Track API calls
logger.trackApiCall('/api/users', 'GET', 200, 150);
```

## 📊 Access Points

After deployment, access these services:

- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **Alertmanager**: http://localhost:9093

## 🎛️ Key Metrics Collected

### HTTP Performance

- Request duration (95th percentile < 500ms)
- Request rate and error rate
- Response sizes

### Database Performance

- Query duration (95th percentile < 100ms)
- Connection pool utilization
- Slow query detection

### Business Metrics

- Media requests by type and source
- Active user sessions
- Queue processing metrics

### Infrastructure

- CPU, memory, disk usage
- Container health and restarts
- Network performance

## 🚨 Alerting

### Critical Alerts (Immediate Response)

- Service unavailable > 1 minute
- Error rate > 10% for 5 minutes
- Database connection failures
- Memory usage > 90% for 2 minutes

### Warning Alerts (Monitor Closely)

- Response time > 2s for 10 minutes
- External API failures
- Resource usage > 75% for 15 minutes

## 📈 Dashboards

### 1. Application Performance Dashboard

- API response times and error rates
- Database query performance
- External service health

### 2. Infrastructure Dashboard

- Container resource usage
- System metrics
- Network performance

### 3. Business Metrics Dashboard

- User activity and engagement
- Media request patterns
- Service utilization

## 🔧 Common Operations

### View Real-time Logs

```bash
# All services
./scripts/deploy-observability.sh logs

# Specific service
docker logs -f observe-grafana
```

### Check Service Health

```bash
./scripts/deploy-observability.sh health
```

### Restart Services

```bash
./scripts/deploy-observability.sh restart
```

### Scale Services

```bash
# Scale Prometheus for high load
docker-compose -f config/monitoring/docker-compose.observability.yml up -d --scale prometheus=2
```

## 🛠️ Troubleshooting

### Services Not Starting

1. Check Docker daemon is running
2. Verify port availability (3001, 9090, 16686, etc.)
3. Check disk space for data volumes

### Missing Metrics

1. Verify application is exposing /metrics endpoint
2. Check Prometheus targets in UI
3. Verify network connectivity between containers

### No Logs Appearing

1. Check log file permissions in backend/logs
2. Verify Promtail configuration
3. Check Loki ingestion rates

### Traces Not Appearing

1. Verify OpenTelemetry is initialized in application
2. Check Jaeger collector endpoints
3. Verify trace sampling configuration

## 🔒 Security Considerations

### Data Privacy

- API keys and tokens automatically redacted in logs
- Sensitive headers filtered from traces
- Email addresses partially masked in logs

### Access Control

- Change default Grafana credentials immediately
- Use environment variables for secrets
- Enable HTTPS in production

### Network Security

- Services communicate via Docker network
- Expose only necessary ports
- Use reverse proxy for production

## 📋 Maintenance

### Daily Tasks

- Monitor dashboard alerts
- Check service health status
- Review error logs for issues

### Weekly Tasks

- Analyze performance trends
- Review and tune alert thresholds
- Update dashboards based on feedback

### Monthly Tasks

- Archive old metrics and logs
- Update container images
- Review and optimize resource usage

## 🎯 Performance Targets

### Response Time SLAs

- API endpoints: 95th percentile < 500ms
- Database queries: 95th percentile < 100ms
- Page load times: < 2 seconds

### Availability Targets

- Application uptime: 99.9%
- Database availability: 99.95%
- External service integration: 95%

### Alert Response Times

- Critical issues: < 5 minutes MTTR
- Warning issues: < 15 minutes MTTR
- Performance degradation: < 2 minutes MTTD

## 🚀 Production Deployment

### Environment Variables

```bash
export GRAFANA_ADMIN_PASSWORD=secure_password
export PROMETHEUS_RETENTION=30d
export LOKI_RETENTION=7d
```

### Resource Requirements

- Minimum: 4GB RAM, 2 CPU cores
- Recommended: 8GB RAM, 4 CPU cores
- Storage: 100GB for 30-day retention

### High Availability Setup

1. Deploy Prometheus with external storage
2. Use Grafana with external database
3. Configure Loki with distributed mode
4. Set up Jaeger with Elasticsearch backend

## 📞 Support

For issues or questions:

1. Check the troubleshooting section
2. Review service logs
3. Consult Grafana dashboards for insights
4. Create GitHub issue with details

---

This observability stack provides enterprise-grade monitoring while running seamlessly alongside existing development and debt elimination work. It requires minimal code changes and provides immediate value through comprehensive system visibility.
