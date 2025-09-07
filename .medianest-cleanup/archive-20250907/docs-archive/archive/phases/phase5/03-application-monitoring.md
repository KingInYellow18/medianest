# Phase 5: Application Monitoring Setup

**Status:** Not Started  
**Priority:** Medium  
**Dependencies:** Application deployed  
**Estimated Time:** 4 hours

## Objective

Set up comprehensive monitoring for MediaNest to track errors, performance, and usage, ensuring reliable operation in the homelab environment.

## Background

Monitoring helps identify issues before users report them. For a homelab deployment, we need simple but effective monitoring without enterprise complexity.

## Tasks

### 1. Error Tracking Setup (Sentry)

- [ ] Create Sentry account (free tier)
- [ ] Install Sentry SDK in frontend/backend
- [ ] Configure error capture
- [ ] Set up source maps
- [ ] Test error reporting
- [ ] Configure alert rules

### 2. Uptime Monitoring

- [ ] Configure health check endpoints
- [ ] Set up Uptime Kuma monitor
- [ ] Add external monitoring (UptimeRobot)
- [ ] Configure downtime alerts
- [ ] Test alert notifications
- [ ] Document response procedures

### 3. Performance Monitoring

- [ ] Implement custom metrics collection
- [ ] Track API response times
- [ ] Monitor WebSocket stability
- [ ] Track queue processing times
- [ ] Create performance dashboard
- [ ] Set performance thresholds

### 4. Usage Analytics

- [ ] Track user login frequency
- [ ] Monitor feature usage
- [ ] Track media request patterns
- [ ] Monitor download statistics
- [ ] Create usage reports
- [ ] Respect user privacy

### 5. Resource Monitoring

- [ ] Monitor Docker container stats
- [ ] Track disk usage
- [ ] Monitor database size
- [ ] Check Redis memory usage
- [ ] Set up resource alerts
- [ ] Plan capacity increases

### 6. Log Aggregation

- [ ] Configure centralized logging
- [ ] Set up log retention policies
- [ ] Create log search interface
- [ ] Configure important log alerts
- [ ] Document log locations
- [ ] Test log rotation

## Implementation Details

### Sentry Configuration

```typescript
// Frontend (Next.js)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 0.1, // 10% sampling for homelab
  beforeSend(event) {
    // Filter out non-critical errors
    if (event.level === 'warning') {
      return null;
    }
    return event;
  },
});

// Backend (Express)
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
  ],
  tracesSampleRate: 0.1,
});
```

### Health Check Endpoints

```typescript
// Comprehensive health check
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      plex: await checkPlexConnection(),
      overseerr: await checkOverseerrConnection(),
    },
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeConnections: getActiveWebSocketCount(),
    },
  };

  const isHealthy = Object.values(health.services).every((s) => s.status === 'up');
  res.status(isHealthy ? 200 : 503).json(health);
});
```

### Custom Metrics Collection

```typescript
// Performance metrics
interface Metrics {
  apiResponseTimes: Map<string, number[]>;
  queueJobDurations: Map<string, number[]>;
  activeUsers: Set<string>;
  errorCounts: Map<string, number>;
}

// Collect and expose metrics
app.get('/api/metrics', requireAdmin, (req, res) => {
  const metrics = {
    api: calculatePercentiles(apiResponseTimes),
    queue: calculatePercentiles(queueJobDurations),
    users: {
      active: activeUsers.size,
      total: await getUserCount(),
    },
    errors: Object.fromEntries(errorCounts),
  };

  res.json(metrics);
});
```

### Docker Monitoring Script

```bash
#!/bin/bash
# monitor-docker.sh

# Check container health
CONTAINERS="medianest_frontend medianest_backend medianest_postgres medianest_redis"

for container in $CONTAINERS; do
  if ! docker ps | grep -q $container; then
    echo "ALERT: Container $container is not running"
    # Send alert
  fi

  # Check resource usage
  STATS=$(docker stats --no-stream --format "{{.Container}}: {{.CPUPerc}} {{.MemUsage}}" $container)
  echo $STATS
done

# Check disk usage
DISK_USAGE=$(df -h /var/lib/docker | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
  echo "ALERT: Disk usage is at ${DISK_USAGE}%"
fi
```

## Alert Configuration

### Critical Alerts (Immediate)

- Application down
- Database connection lost
- Disk space >90%
- Error rate spike

### Warning Alerts (Within 1 hour)

- High memory usage
- Slow API responses
- Queue backlog growing
- Failed login attempts

### Info Alerts (Daily summary)

- Usage statistics
- Performance trends
- Error summaries
- Resource usage

## Success Criteria

- [ ] All errors tracked in Sentry
- [ ] Uptime monitoring active
- [ ] Performance metrics collected
- [ ] Alerts configured and tested
- [ ] Logs searchable
- [ ] Resource usage visible

## Notes

- Keep monitoring simple for homelab
- Focus on actionable alerts
- Avoid alert fatigue
- Use free tiers where possible
- Document what each metric means
