# Grafana Dashboard Guide

## Overview

This guide provides comprehensive documentation for the Grafana observability dashboards implemented for the TypeScript full-stack application. The dashboard suite includes real-time monitoring for application performance, infrastructure health, business metrics, and external service dependencies.

## Dashboard Architecture

### Dashboard Categories

1. **Application Performance** - API metrics, response times, error rates
2. **Infrastructure** - Docker containers, system resources, network I/O
3. **Business Metrics** - User activity, media requests, engagement
4. **Database Performance** - PostgreSQL queries, connections, cache hit ratios
5. **External Services** - Plex, YouTube API, Overseerr health monitoring
6. **System Overview** - High-level health and performance indicators

### Data Sources

- **Prometheus** - Primary metrics collection and storage
- **Loki** - Log aggregation and analysis
- **Jaeger** - Distributed tracing
- **PostgreSQL** - Direct database metrics
- **Redis** - Cache performance metrics
- **Blackbox Exporter** - External service monitoring

## Quick Start

### Starting the Stack

```bash
# Navigate to Grafana configuration directory
cd config/monitoring/grafana/scripts

# Start the complete observability stack
./start-grafana-stack.sh

# Test the setup
./test-dashboard-setup.sh
```

### Accessing Dashboards

- **Grafana UI**: http://localhost:3030
- **Default Credentials**: admin/admin123
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686

## Dashboard Details

### 1. API Performance Dashboard

**Path**: `dashboards/application/api-performance.json`

**Key Metrics**:

- Response time distribution (95th/50th percentiles)
- API error rate gauge
- Request rate by endpoint
- HTTP status code distribution
- Top endpoints by traffic and errors

**Alert Thresholds**:

- Error rate > 5% (Critical)
- Response time > 2000ms (Warning)
- Service down (Critical)

### 2. Infrastructure Dashboard

**Path**: `dashboards/infrastructure/docker-containers.json`

**Key Metrics**:

- Container CPU usage
- Memory consumption
- Network I/O rates
- Disk I/O performance
- Container status overview

**Alert Thresholds**:

- CPU usage > 80% (Warning)
- Memory usage > 90% (Critical)
- Container down (Critical)

### 3. Business Metrics Dashboard

**Path**: `dashboards/business/user-activity.json`

**Key Metrics**:

- Active users (5min/24h)
- Media request rates by type
- Platform usage distribution
- Top requested media
- Request success rates

**Alert Thresholds**:

- Low user activity < 5 users (Info)
- Media request failure rate > 10% (Warning)

### 4. Database Performance Dashboard

**Path**: `dashboards/database/postgresql-performance.json`

**Key Metrics**:

- Active connections
- Query duration averages
- Blocked queries count
- Buffer cache hit ratio
- Database operations (inserts/updates/deletes)

**Alert Thresholds**:

- Active connections > 80 (Warning)
- Slow queries > 5 (Warning)
- Cache hit ratio < 90% (Warning)

### 5. External Services Dashboard

**Path**: `dashboards/external/services-health.json`

**Key Metrics**:

- Service availability status
- Response time monitoring
- API request rates
- Service status summary table

**Alert Thresholds**:

- Service down (Warning)
- Response time > 5000ms (Warning)

### 6. System Overview Dashboard

**Path**: `dashboards/overview/system-overview.json`

**Key Metrics**:

- API error rate gauge
- Response time (95th percentile)
- Active user count
- Service availability percentage
- System resource utilization

## Alerting Configuration

### Alert Rules

**File**: `alerts/critical-alerts.yml`

**Alert Groups**:

1. **API Alerts** - Error rates, response times, service availability
2. **Database Alerts** - Connection usage, query performance, cache ratios
3. **Infrastructure Alerts** - CPU, memory, container health
4. **External Services** - Third-party service monitoring
5. **Business Alerts** - User activity, request failure rates

### Notification Channels

**File**: `alerts/notification-policies.yml`

**Channels**:

- **Slack Critical** - #alerts-critical channel
- **Slack Warnings** - #alerts-warnings channel
- **Email** - ops@observe-app.local
- **PagerDuty** - Critical infrastructure alerts
- **Discord** - Development team notifications

**Routing Policies**:

- Critical alerts → Slack + PagerDuty
- Warning alerts → Slack + Email
- Info alerts → Discord

## Customization Guide

### Adding New Dashboards

1. Create JSON dashboard file in appropriate category directory
2. Add dashboard provisioning configuration
3. Update dashboard categories in provisioning config
4. Test import with validation script

### Custom Metrics

1. Add Prometheus scrape targets
2. Create custom queries in dashboards
3. Set up appropriate alert thresholds
4. Document new metrics in this guide

### Notification Customization

1. Update webhook URLs in environment variables
2. Modify notification templates in policies
3. Adjust routing rules based on team structure
4. Test notification delivery

## Environment Variables

```bash
# Grafana Configuration
GRAFANA_ADMIN_PASSWORD=admin123
GRAFANA_SECRET_KEY=SW2YcwTIb9zpOOhoPsMm

# Database Passwords
POSTGRES_PASSWORD=postgres
REDIS_PASSWORD=

# Notification Webhooks
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
PAGERDUTY_INTEGRATION_KEY=your-key
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
```

## Troubleshooting

### Common Issues

1. **Dashboard Not Loading**

   - Check data source connections
   - Verify Prometheus is scraping targets
   - Review Grafana logs

2. **Missing Metrics**

   - Ensure application exports metrics
   - Check Prometheus configuration
   - Verify label selectors in queries

3. **Alert Not Firing**
   - Test alert queries manually
   - Check alert evaluation intervals
   - Verify notification channel configuration

### Debug Commands

```bash
# Check service health
./test-dashboard-setup.sh

# View logs
docker logs observe-grafana
docker logs observe-prometheus

# Test queries
curl http://localhost:9090/api/v1/query?query=up

# Restart services
./start-grafana-stack.sh restart
```

## Maintenance

### Regular Tasks

1. **Weekly**:

   - Review alert noise and adjust thresholds
   - Check dashboard performance
   - Validate data retention settings

2. **Monthly**:

   - Update dashboard templates
   - Review and clean up unused alerts
   - Performance optimization

3. **Quarterly**:
   - Upgrade Grafana and plugins
   - Review and update documentation
   - Capacity planning review

### Backup Strategy

1. **Dashboard Export**:

   ```bash
   # Export all dashboards
   curl -u admin:password http://localhost:3030/api/search | \
   jq -r '.[] | select(.type=="dash-db") | .uri' | \
   sed 's/db\///g' | \
   xargs -I {} curl -u admin:password http://localhost:3030/api/dashboards/db/{} > backup.json
   ```

2. **Configuration Backup**:
   - Version control all YAML configurations
   - Backup Grafana database regularly
   - Document custom modifications

## Security Considerations

1. **Access Control**:

   - Use strong admin passwords
   - Implement proper user roles
   - Enable HTTPS in production

2. **Data Protection**:

   - Secure webhook URLs
   - Encrypt sensitive environment variables
   - Regular security audits

3. **Network Security**:
   - Restrict dashboard access
   - Use VPN for external access
   - Monitor for unauthorized changes

## Performance Optimization

1. **Query Optimization**:

   - Use appropriate time ranges
   - Optimize PromQL queries
   - Implement query result caching

2. **Resource Management**:

   - Monitor Grafana resource usage
   - Optimize dashboard refresh intervals
   - Clean up old data regularly

3. **Scalability**:
   - Plan for increased metric volume
   - Consider dashboard performance impact
   - Implement proper data retention policies

## Support and Resources

### Internal Resources

- Dashboard configuration files: `config/monitoring/grafana/`
- Alert definitions: `config/monitoring/grafana/alerts/`
- Test scripts: `config/monitoring/grafana/scripts/`

### External Documentation

- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Query Language](https://prometheus.io/docs/prometheus/latest/querying/)
- [Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/)

### Team Contacts

- **Infrastructure Team**: ops@observe-app.local
- **Development Team**: dev@observe-app.local
- **On-call**: Use PagerDuty integration
