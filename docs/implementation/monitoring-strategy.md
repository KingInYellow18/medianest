# Monitoring Strategy - MediaNest DevOps

## Executive Summary

Comprehensive monitoring is critical for MediaNest's production reliability, security, and performance optimization. This document outlines a complete observability strategy using validated tools and current best practices, building upon the existing Prometheus and Grafana infrastructure.

## Current Monitoring Infrastructure Assessment

### Existing Components
MediaNest already has a solid monitoring foundation:

#### Prometheus Configuration
- **Scrape Targets**: Application, Node Exporter, PostgreSQL, Redis, Nginx, cAdvisor
- **Retention Policy**: 7 days local storage with 512MB limit
- **Alert Rules**: Production-ready alert configurations
- **Service Discovery**: Static configuration with Docker Swarm integration

#### Monitoring Services
- **Prometheus**: Central metrics collection and alerting
- **Grafana**: Visualization and dashboarding (when configured)
- **Node Exporter**: System-level metrics collection
- **Database Exporters**: PostgreSQL and Redis monitoring
- **Container Monitoring**: cAdvisor for container metrics

#### Automation Scripts
- `start-monitoring-stack.sh`: Automated monitoring service deployment
- `prometheus-validator.sh`: Configuration validation and health checks

## Comprehensive Monitoring Architecture

### Three Pillars of Observability

#### 1. Metrics (Quantitative Data)
```yaml
metrics_collection:
  application_metrics:
    - Request rates and latency
    - Error rates and types
    - Business KPIs
    - User engagement metrics
  
  infrastructure_metrics:
    - CPU, memory, disk utilization
    - Network throughput
    - Container health
    - Service dependencies
  
  custom_metrics:
    - Feature usage analytics
    - Performance benchmarks
    - Security events
    - Cost optimization data
```

#### 2. Logs (Contextual Information)
```yaml
logging_architecture:
  application_logs:
    - Structured JSON logging
    - Request/response logging
    - Error and exception tracking
    - Security audit logs
  
  system_logs:
    - Container runtime logs
    - Operating system events
    - Network activity logs
    - Storage access logs
  
  aggregation_strategy:
    - Log shipping with Promtail
    - Centralized storage in Loki
    - Correlation with metrics
    - Long-term retention
```

#### 3. Traces (Request Flow)
```yaml
tracing_implementation:
  distributed_tracing:
    - Request flow visualization
    - Service dependency mapping
    - Performance bottleneck identification
    - Error propagation tracking
  
  trace_collection:
    - OpenTelemetry instrumentation
    - Jaeger for trace storage
    - Trace sampling strategies
    - Trace-metric correlation
```

## Enhanced Monitoring Stack

### Core Monitoring Services

#### Prometheus Configuration Enhancement
```yaml
# Enhanced Prometheus Configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    environment: '${ENVIRONMENT}'
    cluster: 'medianest-swarm'
    region: '${DEPLOYMENT_REGION}'

rule_files:
  - "alert_rules.yml"
  - "recording_rules.yml"

scrape_configs:
  # MediaNest Application - Enhanced
  - job_name: 'medianest-app'
    static_configs:
      - targets: ['app:4000']
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: '/metrics'
    params:
      format: ['prometheus']
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'medianest_.*'
        action: keep

  # Business Metrics Endpoint
  - job_name: 'medianest-business'
    static_configs:
      - targets: ['app:4000']
    metrics_path: '/metrics/business'
    scrape_interval: 30s

  # Custom Application Metrics
  - job_name: 'medianest-custom'
    static_configs:
      - targets: ['app:4000']
    metrics_path: '/metrics/custom'
    scrape_interval: 60s

  # Enhanced Infrastructure Monitoring
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        regex: '([^:]+):(.*)'
        replacement: '${1}'

  # PostgreSQL Enhanced Monitoring
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']
    scrape_interval: 30s
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'pg_.*'
        action: keep

  # Redis Enhanced Monitoring
  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']
    scrape_interval: 30s

  # Load Balancer Monitoring
  - job_name: 'traefik'
    static_configs:
      - targets: ['traefik:8080']
    metrics_path: '/metrics'

  # Container Monitoring Enhanced
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
    metric_relabel_configs:
      - source_labels: [container_label_com_docker_swarm_service_name]
        target_label: service_name

# Remote Write for Long-term Storage
remote_write:
  - url: "https://prometheus-remote-write.example.com/api/v1/write"
    queue_config:
      max_samples_per_send: 1000
      max_shards: 200
      capacity: 2500
    write_relabel_configs:
      - source_labels: [__name__]
        regex: 'medianest_.*|up|node_.*'
        action: keep

# Storage Configuration Enhanced
storage:
  tsdb:
    path: /prometheus
    retention.time: 15d
    retention.size: 2GB
    wal-compression: true
```

### Grafana Dashboard Strategy
```yaml
# Grafana Configuration
grafana_setup:
  dashboards:
    application_overview:
      - Request rates and latency
      - Error rates by endpoint
      - Active user sessions
      - Business KPI metrics
    
    infrastructure_overview:
      - System resource utilization
      - Container health status
      - Network performance
      - Storage utilization
    
    business_intelligence:
      - User engagement metrics
      - Feature usage analytics
      - Revenue impact metrics
      - Performance cost analysis
    
    security_monitoring:
      - Authentication failures
      - Suspicious activity patterns
      - Security policy violations
      - Vulnerability exposure
```

### Log Aggregation with Loki
```yaml
# Loki Configuration for Log Aggregation
loki_config:
  server:
    http_listen_port: 3100
    grpc_listen_port: 9096

  ingester:
    chunk_idle_period: 3m
    chunk_block_size: 262144
    chunk_retain_period: 1m
    max_transfer_retries: 0
    lifecycler:
      address: 127.0.0.1
      ring:
        kvstore:
          store: inmemory
        replication_factor: 1
      final_sleep: 0s

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
      resync_interval: 5s
      shared_store: filesystem
    filesystem:
      directory: /loki/chunks

  limits_config:
    enforce_metric_name: false
    reject_old_samples: true
    reject_old_samples_max_age: 168h

  chunk_store_config:
    max_look_back_period: 0s

  table_manager:
    retention_deletes_enabled: false
    retention_period: 0s
```

### Promtail Configuration
```yaml
# Promtail for Log Collection
promtail_config:
  server:
    http_listen_port: 9080
    grpc_listen_port: 0

  positions:
    filename: /tmp/positions.yaml

  clients:
    - url: http://loki:3100/loki/api/v1/push

  scrape_configs:
    # Docker Container Logs
    - job_name: docker
      docker_sd_configs:
        - host: unix:///var/run/docker.sock
          refresh_interval: 5s
      relabel_configs:
        - source_labels: ['__meta_docker_container_name']
          target_label: 'container'
        - source_labels: ['__meta_docker_container_log_stream']
          target_label: 'stream'
      pipeline_stages:
        - json:
            expressions:
              timestamp: timestamp
              level: level
              message: message
              service: service
        - timestamp:
            source: timestamp
            format: RFC3339Nano
        - labels:
            level:
            service:

    # System Logs
    - job_name: syslog
      static_configs:
        - targets:
            - localhost
          labels:
            job: syslog
            __path__: /var/log/syslog

    # Application Specific Logs
    - job_name: medianest
      static_configs:
        - targets:
            - localhost
          labels:
            job: medianest-app
            __path__: /var/log/medianest/*.log
      pipeline_stages:
        - json:
            expressions:
              level: level
              timestamp: timestamp
              message: message
              requestId: requestId
              userId: userId
        - labels:
            level:
            requestId:
```

## Application Performance Monitoring (APM)

### OpenTelemetry Integration
```typescript
// OpenTelemetry Setup for MediaNest
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'medianest-backend',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV,
  }),
  
  traceExporter: new JaegerExporter({
    endpoint: 'http://jaeger-collector:14268/api/traces',
  }),
  
  metricExporter: new PrometheusExporter({
    port: 9464,
    preventServerStart: false,
  }),
  
  instrumentations: [
    // Auto-instrumentation for common libraries
    require('@opentelemetry/instrumentation-http'),
    require('@opentelemetry/instrumentation-express'),
    require('@opentelemetry/instrumentation-postgresql'),
    require('@opentelemetry/instrumentation-redis'),
  ],
});

sdk.start();
```

### Custom Metrics Implementation
```typescript
// Custom Business Metrics
import { metrics } from '@opentelemetry/api-metrics';

const meter = metrics.getMeter('medianest-business', '1.0.0');

// User engagement metrics
const userLoginCounter = meter.createCounter('user_logins_total', {
  description: 'Total number of user logins',
});

const activeSessionsGauge = meter.createUpDownCounter('active_sessions', {
  description: 'Number of active user sessions',
});

// Performance metrics
const requestDuration = meter.createHistogram('http_request_duration_ms', {
  description: 'HTTP request duration in milliseconds',
  boundaries: [1, 5, 15, 50, 100, 500, 1000, 5000],
});

// Business KPIs
const contentViews = meter.createCounter('content_views_total', {
  description: 'Total content views',
});

const featureUsage = meter.createCounter('feature_usage_total', {
  description: 'Feature usage counter',
});

// Usage in application code
export const trackUserLogin = (userId: string, method: string) => {
  userLoginCounter.add(1, {
    method,
    user_type: 'registered',
  });
};

export const trackContentView = (contentId: string, contentType: string) => {
  contentViews.add(1, {
    content_type: contentType,
    content_id: contentId,
  });
};
```

## Alert Rules and Notification Strategy

### Critical Alert Rules
```yaml
# Alert Rules Configuration
groups:
  - name: application.rules
    rules:
      # High Error Rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}% for {{ $labels.service }}"

      # High Response Time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"

      # Service Down
      - alert: ServiceDown
        expr: up{job="medianest-app"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service is down"
          description: "{{ $labels.service }} has been down for more than 1 minute"

  - name: infrastructure.rules
    rules:
      # High CPU Usage
      - alert: HighCPUUsage
        expr: (100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)) > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is {{ $value }}% on {{ $labels.instance }}"

      # High Memory Usage
      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is {{ $value }}% on {{ $labels.instance }}"

      # Low Disk Space
      - alert: LowDiskSpace
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.10
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space"
          description: "Disk usage is {{ $value }}% on {{ $labels.instance }}:{{ $labels.mountpoint }}"

  - name: business.rules
    rules:
      # Low User Activity
      - alert: LowUserActivity
        expr: rate(user_logins_total[1h]) < 10
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low user activity detected"
          description: "User login rate is {{ $value }} per hour"

      # Database Connection Issues
      - alert: DatabaseConnectionIssues
        expr: postgresql_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failed"
          description: "PostgreSQL database is not accessible"

  - name: security.rules
    rules:
      # Multiple Failed Authentication Attempts
      - alert: MultipleFailedLogins
        expr: rate(authentication_failures_total[5m]) > 5
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Multiple failed authentication attempts"
          description: "{{ $value }} failed login attempts per second"

      # Suspicious Activity
      - alert: SuspiciousActivity
        expr: rate(suspicious_requests_total[5m]) > 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Suspicious activity detected"
          description: "{{ $value }} suspicious requests per second"
```

### Notification Channels
```yaml
# Alertmanager Configuration
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@medianest.com'

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

receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://127.0.0.1:5001/'

  - name: 'critical-alerts'
    slack_configs:
      - api_url: '${SLACK_API_URL}'
        channel: '#critical-alerts'
        title: 'Critical Alert - MediaNest'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
    email_configs:
      - to: 'oncall@medianest.com'
        subject: 'CRITICAL: {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}

  - name: 'warning-alerts'
    slack_configs:
      - api_url: '${SLACK_API_URL}'
        channel: '#alerts'
        title: 'Warning Alert - MediaNest'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'dev', 'instance']
```

## Performance Monitoring

### SLI/SLO Framework
```yaml
# Service Level Indicators and Objectives
sli_slo_framework:
  availability:
    sli: "Percentage of successful HTTP requests"
    slo: "99.9% availability over 30 days"
    alert_threshold: "99.5%"
    
  latency:
    sli: "95th percentile response time"
    slo: "< 500ms for 95% of requests"
    alert_threshold: "< 1000ms"
    
  error_rate:
    sli: "Percentage of HTTP 5xx errors"
    slo: "< 0.1% error rate over 24 hours"
    alert_threshold: "< 0.5%"
    
  throughput:
    sli: "Requests per second capacity"
    slo: "> 1000 RPS sustained"
    alert_threshold: "> 800 RPS"
```

### Recording Rules for SLIs
```yaml
# Prometheus Recording Rules
groups:
  - name: sli.rules
    interval: 30s
    rules:
      # Availability SLI
      - record: medianest:availability:rate5m
        expr: |
          sum(rate(http_requests_total{status!~"5.."}[5m])) /
          sum(rate(http_requests_total[5m]))

      # Latency SLI
      - record: medianest:latency:p95:5m
        expr: |
          histogram_quantile(0.95, 
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

      # Error Rate SLI
      - record: medianest:error_rate:rate5m
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) /
          sum(rate(http_requests_total[5m]))

      # Throughput SLI
      - record: medianest:throughput:rate5m
        expr: sum(rate(http_requests_total[5m]))

  - name: slo.rules
    interval: 5m
    rules:
      # 30-day availability SLO
      - record: medianest:availability:30d
        expr: avg_over_time(medianest:availability:rate5m[30d])

      # Daily error budget
      - record: medianest:error_budget:daily
        expr: |
          1 - (
            sum(increase(http_requests_total{status=~"5.."}[24h])) /
            sum(increase(http_requests_total[24h]))
          )
```

## Security Monitoring

### Security Metrics Collection
```yaml
# Security Monitoring Configuration
security_monitoring:
  authentication_monitoring:
    - Failed login attempts
    - Unusual login patterns
    - Password reset frequency
    - Session anomalies
  
  access_monitoring:
    - Unauthorized access attempts
    - Privilege escalation attempts
    - Suspicious API usage
    - Data access patterns
  
  infrastructure_monitoring:
    - Container security violations
    - Network policy violations
    - Certificate expiration
    - Vulnerability exposure
  
  compliance_monitoring:
    - Policy violations
    - Audit log completeness
    - Data retention compliance
    - Access control validation
```

### Security Alert Rules
```yaml
# Security-Specific Alert Rules
groups:
  - name: security.rules
    rules:
      # Brute Force Detection
      - alert: BruteForceAttack
        expr: rate(authentication_failures_total[1m]) > 10
        for: 30s
        labels:
          severity: critical
          category: security
        annotations:
          summary: "Potential brute force attack detected"
          description: "{{ $value }} failed authentication attempts per second"

      # Unusual API Usage
      - alert: UnusualAPIUsage
        expr: rate(http_requests_total[5m]) > 1000
        for: 2m
        labels:
          severity: warning
          category: security
        annotations:
          summary: "Unusual API usage pattern detected"
          description: "API request rate is {{ $value }} requests/second"

      # Container Security Violation
      - alert: ContainerSecurityViolation
        expr: container_security_violations_total > 0
        for: 0s
        labels:
          severity: critical
          category: security
        annotations:
          summary: "Container security policy violation"
          description: "Security violation detected in container {{ $labels.container }}"
```

## Capacity Planning and Cost Optimization

### Resource Utilization Monitoring
```yaml
# Capacity Planning Metrics
capacity_planning:
  compute_resources:
    - CPU utilization trends
    - Memory usage patterns
    - Network bandwidth utilization
    - Storage growth rates
  
  application_resources:
    - Container resource consumption
    - Database connection pool usage
    - Cache hit rates
    - Queue depths
  
  predictive_analysis:
    - Growth trend analysis
    - Seasonal usage patterns
    - Peak load predictions
    - Capacity recommendations
```

### Cost Monitoring
```yaml
# Cost Optimization Monitoring
cost_monitoring:
  infrastructure_costs:
    - Server utilization vs cost
    - Storage costs and usage
    - Network transfer costs
    - License utilization
  
  operational_costs:
    - Support ticket costs
    - Incident response costs
    - Maintenance overhead
    - Training investments
  
  optimization_opportunities:
    - Underutilized resources
    - Over-provisioned services
    - Inefficient architectures
    - License optimization
```

## Implementation and Deployment

### Monitoring Stack Deployment
```yaml
# Complete Monitoring Stack
version: '3.8'

services:
  # Prometheus
  prometheus:
    image: prom/prometheus:v2.45.0
    container_name: prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=15d'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
    ports:
      - "9090:9090"
    volumes:
      - ./config/production/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./config/production/alert_rules.yml:/etc/prometheus/alert_rules.yml
      - ./config/production/recording_rules.yml:/etc/prometheus/recording_rules.yml
      - prometheus_data:/prometheus
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.labels.monitoring == true

  # Grafana
  grafana:
    image: grafana/grafana:10.0.0
    container_name: grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./config/production/grafana/provisioning:/etc/grafana/provisioning
      - ./config/production/grafana/dashboards:/var/lib/grafana/dashboards
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.labels.monitoring == true

  # Loki
  loki:
    image: grafana/loki:2.8.0
    container_name: loki
    command: -config.file=/etc/loki/local-config.yaml
    ports:
      - "3100:3100"
    volumes:
      - ./config/production/loki.yml:/etc/loki/local-config.yaml
      - loki_data:/loki
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.labels.monitoring == true

  # Promtail
  promtail:
    image: grafana/promtail:2.8.0
    container_name: promtail
    command: -config.file=/etc/promtail/config.yml
    volumes:
      - ./config/production/promtail.yml:/etc/promtail/config.yml
      - /var/log:/var/log:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    deploy:
      mode: global

  # Jaeger
  jaeger:
    image: jaegertracing/all-in-one:1.46
    container_name: jaeger
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    ports:
      - "16686:16686"
      - "14250:14250"
      - "14268:14268"
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.labels.monitoring == true

  # Alertmanager
  alertmanager:
    image: prom/alertmanager:v0.25.0
    container_name: alertmanager
    command:
      - '--config.file=/etc/alertmanager/config.yml'
      - '--storage.path=/alertmanager'
    ports:
      - "9093:9093"
    volumes:
      - ./config/production/alertmanager.yml:/etc/alertmanager/config.yml
      - alertmanager_data:/alertmanager
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.labels.monitoring == true

volumes:
  prometheus_data:
  grafana_data:
  loki_data:
  alertmanager_data:

networks:
  monitoring:
    external: true
```

### Automated Deployment Script
```bash
#!/bin/bash
# Enhanced Monitoring Stack Deployment

set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-production}"
STACK_NAME="medianest-monitoring"

echo "🚀 Deploying MediaNest Monitoring Stack"
echo "Environment: $ENVIRONMENT"

# Create monitoring network
docker network create --driver overlay monitoring 2>/dev/null || true

# Label nodes for monitoring placement
docker node update --label-add monitoring=true $(docker node ls -q --filter role=manager | head -1)

# Deploy secrets
echo "🔒 Creating monitoring secrets..."
echo "${GRAFANA_PASSWORD:-admin}" | docker secret create grafana_password - 2>/dev/null || true
echo "${SLACK_API_URL:-}" | docker secret create slack_api_url - 2>/dev/null || true

# Deploy monitoring stack
echo "📊 Deploying monitoring services..."
docker stack deploy -c docker-compose.monitoring.yml $STACK_NAME

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
timeout=300
counter=0

while ! curl -sf http://localhost:9090/-/ready >/dev/null 2>&1; do
    if [[ $counter -ge $timeout ]]; then
        echo "❌ Prometheus failed to start within ${timeout} seconds"
        exit 1
    fi
    sleep 5
    ((counter+=5))
    echo -n "."
done

echo -e "\n✅ Prometheus is ready"

# Validate Grafana
if curl -sf http://admin:${GRAFANA_PASSWORD:-admin}@localhost:3001/api/health >/dev/null 2>&1; then
    echo "✅ Grafana is ready"
else
    echo "⚠️  Grafana may still be starting..."
fi

# Import Grafana dashboards
echo "📊 Importing Grafana dashboards..."
./scripts/import-dashboards.sh

# Run monitoring validation
echo "🔍 Running monitoring validation..."
./scripts/validate-monitoring.sh

echo "🎉 Monitoring stack deployment complete!"
echo "📊 Prometheus: http://localhost:9090"
echo "📈 Grafana: http://localhost:3001 (admin/${GRAFANA_PASSWORD:-admin})"
echo "🔍 Jaeger: http://localhost:16686"
echo "🚨 Alertmanager: http://localhost:9093"
```

## Success Metrics and KPIs

### Monitoring Effectiveness
- **Alert Accuracy**: > 95% actionable alerts
- **Mean Detection Time**: < 2 minutes for critical issues
- **False Positive Rate**: < 5% of total alerts
- **Monitoring Coverage**: 100% of critical services

### Operational Impact
- **Mean Time to Detection**: < 5 minutes
- **Mean Time to Resolution**: < 30 minutes
- **Incident Prevention**: 80% of issues prevented
- **Capacity Planning Accuracy**: > 90% prediction accuracy

## Conclusion

This comprehensive monitoring strategy transforms MediaNest's observability capabilities, providing deep insights into application performance, infrastructure health, and business metrics. The implementation builds upon existing Prometheus infrastructure while adding modern observability practices including distributed tracing, log aggregation, and advanced alerting.

The strategy ensures MediaNest can proactively identify and resolve issues, optimize performance, and make data-driven decisions for continuous improvement. The monitoring stack provides the foundation for reliable, scalable, and secure operations in production environments.