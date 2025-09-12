# MEDIANEST PLG Stack Troubleshooting Guide

## Quick Start Commands

```bash
# Start PLG monitoring stack
cd monitoring && docker compose up -d

# Check service status
docker ps --filter "name=medianest-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Run comprehensive validation
./monitoring/scripts/validate-stack.sh

# View service logs
docker compose -f monitoring/docker-compose.yml logs [service-name]

# Stop monitoring stack
docker compose -f monitoring/docker-compose.yml down
```

## Common Issues and Solutions

### 1. Grafana Permission Issues

**Symptoms:**

- Grafana container restarting repeatedly
- Error: "GF_PATHS_DATA='/var/lib/grafana' is not writable"
- Dashboard inaccessible at http://localhost:3002

**Root Cause:**
Docker volume permissions incompatible with Grafana user (472)

**Solutions:**

**Option A: Fix permissions (requires sudo)**

```bash
sudo chown -R 472:472 monitoring/data/grafana
docker compose -f monitoring/docker-compose.yml restart grafana
```

**Option B: Use root user (current configuration)**

```bash
# Already configured in docker-compose.yml as user: "0"
# Just restart the service
docker compose -f monitoring/docker-compose.yml restart grafana
```

**Option C: Recreate with proper permissions**

```bash
docker compose -f monitoring/docker-compose.yml down
docker volume rm monitoring_grafana_data
docker compose -f monitoring/docker-compose.yml up -d
```

### 2. Port Conflicts

**Symptoms:**

- Error: "port is already allocated"
- Service fails to start with bind errors

**Common Conflicts:**

- Port 3001: Often used by development servers
- Port 3000: Common React development port
- Port 9090: Sometimes used by other Prometheus instances

**Solution:**

```bash
# Check what's using a port
ss -tulpn | grep :3001
lsof -i :3001

# Stop conflicting services or change ports in docker-compose.yml
# Example: Change Grafana port from 3002 to 3003
sed -i 's/3002:3002/3003:3003/g' monitoring/docker-compose.yml
sed -i 's/GF_SERVER_HTTP_PORT=3002/GF_SERVER_HTTP_PORT=3003/g' monitoring/docker-compose.yml
```

### 3. Network Configuration Issues

**Symptoms:**

- "network medianest-development declared as external, but could not be found"
- Services can't communicate with each other

**Solution:**

```bash
# Create missing networks
docker network create medianest-development --driver bridge --subnet 172.30.0.0/16
docker network create medianest-monitoring --driver bridge --subnet 172.31.0.0/16

# Verify networks exist
docker network ls | grep medianest

# Restart services
docker compose -f monitoring/docker-compose.yml up -d
```

### 4. Missing Volumes

**Symptoms:**

- "external volume not found"
- Data not persisting between restarts

**Solution:**

```bash
# Create missing volumes
docker volume create medianest_backend_dev_logs
docker volume create monitoring_prometheus_data
docker volume create monitoring_loki_data
docker volume create monitoring_grafana_data

# Verify volumes exist
docker volume ls | grep monitoring
```

### 5. Configuration File Errors

**Symptoms:**

- Services failing to start with config errors
- "yaml: line X: did not find expected" errors

**Prometheus Config Issues:**

```bash
# Validate Prometheus config
docker run --rm -v $(pwd)/monitoring/config/prometheus:/etc/prometheus prom/prometheus:v2.47.0 promtool check config /etc/prometheus/prometheus.yml

# Common issues:
# - Invalid YAML indentation
# - Missing required fields
# - Invalid scrape target formats
```

**Loki Config Issues:**

```bash
# Validate Loki config
docker run --rm -v $(pwd)/monitoring/config/loki:/etc/loki grafana/loki:2.9.0 -config.file=/etc/loki/local-config.yaml -verify-config

# Common issues:
# - Version incompatible fields
# - Missing required sections
# - Invalid storage configuration
```

### 6. Service Discovery Problems

**Symptoms:**

- Prometheus showing targets as "DOWN"
- "dial tcp: lookup [service] on 127.0.0.11:53: server misbehaving"

**Solution:**

```bash
# Check network connectivity
docker exec medianest-prometheus nslookup medianest-loki
docker exec medianest-prometheus wget -qO- http://medianest-loki:3100/ready

# Verify service names in prometheus.yml match container names
grep -n "targets:" monitoring/config/prometheus/prometheus.yml

# Update targets to use container names
# Example: Change "backend:4000" to "medianest-backend:4000"
```

### 7. Application Integration Issues

**Symptoms:**

- Backend metrics endpoint not accessible
- No application logs in Loki
- "Backend is not responding" in validation

**Prerequisites:**

```bash
# Start MEDIANEST development environment first
docker compose -f config/docker/docker-compose.dev.yml up -d

# Verify backend is running
curl http://localhost:4000/health
curl http://localhost:4000/metrics

# Check backend logs are being generated
tail -f logs/medianest-backend.log
```

**Integration Steps:**

1. Ensure backend application implements /metrics endpoint
2. Verify Winston logging is configured with file output
3. Update Promtail to monitor application log files
4. Configure backend service discovery in Prometheus

### 8. Resource Issues

**Symptoms:**

- Services running slowly
- Container restarts due to resource limits
- Host system becoming unresponsive

**Solution:**

```bash
# Check resource usage
docker stats --no-stream

# Adjust resource limits in docker-compose.yml
# Example for Prometheus:
services:
  prometheus:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.5'
```

## Service-Specific Troubleshooting

### Prometheus

```bash
# Check configuration
docker exec medianest-prometheus promtool check config /etc/prometheus/prometheus.yml

# Check targets
curl http://localhost:9090/api/v1/targets

# Check storage
du -sh monitoring/data/prometheus

# Reload configuration (if web.enable-lifecycle is enabled)
curl -X POST http://localhost:9090/-/reload
```

### Loki

```bash
# Check Loki status
curl http://localhost:3100/ready

# Check log ingestion
curl http://localhost:3100/loki/api/v1/labels

# Check recent logs
curl 'http://localhost:3100/loki/api/v1/query_range?query={job="docker"}&start='$(date -d '1 hour ago' +%s)000000000'&end='$(date +%s)000000000

# Check storage usage
du -sh monitoring/data/loki
```

### Grafana

```bash
# Check Grafana logs
docker compose -f monitoring/docker-compose.yml logs grafana

# Reset admin password
docker exec medianest-grafana grafana-cli admin reset-admin-password newpassword

# Check datasources via API
curl -u admin:medianest123 http://localhost:3002/api/datasources

# Check health
curl http://localhost:3002/api/health
```

### Promtail

```bash
# Check Promtail targets
curl http://localhost:9080/targets

# Check metrics
curl http://localhost:9080/metrics

# Verify log file access
docker exec medianest-promtail ls -la /var/log/medianest/
```

## Performance Optimization

### Reduce Resource Usage

```bash
# Reduce Prometheus retention
# Edit monitoring/config/prometheus/prometheus.yml
# Change: --storage.tsdb.retention.time=30d
# To:     --storage.tsdb.retention.time=7d

# Reduce scrape frequency for non-critical metrics
# Change: scrape_interval: 5s
# To:     scrape_interval: 15s

# Limit Loki ingestion rate
# Edit monitoring/config/loki/local-config.yaml
limits_config:
  ingestion_rate_mb: 4
  ingestion_burst_size_mb: 8
```

### Optimize Storage

```bash
# Clean up old data
docker exec medianest-prometheus rm -rf /prometheus/01*
docker exec medianest-loki rm -rf /loki/chunks/fake/01*

# Compress logs
docker exec medianest-promtail logrotate /etc/logrotate.conf
```

## Validation and Testing

### Health Checks

```bash
# All services health check
for service in prometheus loki grafana; do
  echo "=== $service ==="
  curl -f http://localhost:$(docker port medianest-$service | cut -d: -f2)/api/health 2>/dev/null && echo "✅ Healthy" || echo "❌ Unhealthy"
done
```

### End-to-End Testing

```bash
# Generate test data
curl http://localhost:4000/health  # Generate backend logs
hey -n 100 -c 10 http://localhost:4000/health  # Generate load

# Check metrics collection
curl 'http://localhost:9090/api/v1/query?query=up'

# Check log collection
sleep 30  # Wait for logs to be processed
curl 'http://localhost:3100/loki/api/v1/query?query={job="docker"}'
```

## Emergency Procedures

### Complete Reset

```bash
# Stop all monitoring services
docker compose -f monitoring/docker-compose.yml down -v

# Remove all monitoring data
docker volume rm monitoring_prometheus_data monitoring_loki_data monitoring_grafana_data

# Remove networks
docker network rm medianest-monitoring

# Clean up orphaned containers
docker container prune -f

# Restart from scratch
docker compose -f monitoring/docker-compose.yml up -d
```

### Backup Critical Data

```bash
# Backup Prometheus data
docker run --rm -v monitoring_prometheus_data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-backup-$(date +%Y%m%d).tar.gz /data

# Backup Grafana data
docker run --rm -v monitoring_grafana_data:/data -v $(pwd):/backup alpine tar czf /backup/grafana-backup-$(date +%Y%m%d).tar.gz /data

# Backup Loki data
docker run --rm -v monitoring_loki_data:/data -v $(pwd):/backup alpine tar czf /backup/loki-backup-$(date +%Y%m%d).tar.gz /data
```

## Support Resources

- **Validation Script**: `./monitoring/scripts/validate-stack.sh`
- **Service Logs**: `docker compose -f monitoring/docker-compose.yml logs [service]`
- **Prometheus UI**: http://localhost:9090
- **Loki API**: http://localhost:3100
- **Grafana Dashboard**: http://localhost:3002 (admin/medianest123)

For additional support, review the validation report at `monitoring/VALIDATION_REPORT.md`
