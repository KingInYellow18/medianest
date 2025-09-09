# MediaNest Performance API Reference

**Version:** 1.0.0  
**Last Updated:** January 15, 2025

!!! info "Admin Access Required"
    Most performance endpoints require administrator privileges. Performance monitoring is available to all authenticated users with limited metrics.

## Overview

The MediaNest Performance API provides comprehensive system monitoring, optimization controls, and performance analytics. This API enables real-time performance tracking, automated optimization, and detailed system health insights for production deployments.

### Key Features

- **Real-time Metrics**: Live performance data with sub-second granularity
- **Automated Optimization**: AI-driven performance improvements
- **Trend Analysis**: Historical performance analysis and forecasting
- **Alert System**: Configurable performance thresholds and notifications
- **Resource Monitoring**: CPU, memory, database, and cache analytics

## Base URL

```
https://api.medianest.com/api/v1/performance
```

For local development:
```
http://localhost:4000/api/v1/performance
```

## Authentication

All performance endpoints require authentication. Most detailed metrics require admin role.

```bash
# Example authenticated request
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://api.medianest.com/api/v1/performance/metrics
```

## Endpoints

### Get Performance Metrics

#### `GET /api/v1/performance/metrics`

Get comprehensive system performance metrics (admin only).

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-01-15T12:00:00.000Z",
    "api": {
      "requestsPerMinute": 45,
      "averageResponseTime": 234,
      "p95ResponseTime": 456,
      "p99ResponseTime": 789,
      "errorRate": 0.02,
      "activeConnections": 12,
      "slowestEndpoints": [
        {
          "path": "/api/v1/media/search",
          "averageTime": 450,
          "count": 125
        }
      ]
    },
    "database": {
      "averageQueryTime": 25,
      "slowQueries": 2,
      "connectionPoolUsage": 45.5,
      "activeConnections": 8,
      "queryStats": {
        "selects": 1240,
        "inserts": 45,
        "updates": 23,
        "deletes": 8
      }
    },
    "system": {
      "cpu": {
        "usage": 25.5,
        "cores": 8,
        "loadAverage": [1.2, 1.5, 1.8]
      },
      "memory": {
        "total": 16777216000,
        "used": 8388608000,
        "free": 8388608000,
        "percentage": 50.0,
        "heapUsed": 256000000,
        "heapTotal": 512000000
      },
      "disk": {
        "total": 1000000000000,
        "used": 500000000000,
        "free": 500000000000,
        "percentage": 50.0
      }
    },
    "cache": {
      "hitRate": 0.85,
      "totalKeys": 1245,
      "memoryUsage": "128MB",
      "evictions": 12,
      "operations": {
        "gets": 5420,
        "sets": 234,
        "deletes": 45
      }
    }
  }
}
```

**Error Responses:**
- `403 Forbidden` - Admin access required
- `500 Internal Server Error` - Metrics collection failed

### Get Performance Summary

#### `GET /api/v1/performance/summary`

Get performance summary with trends and recommendations.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "optimal",
    "score": 92,
    "currentMetrics": {
      "responseTime": 234,
      "memoryUsage": 50.0,
      "cpuUsage": 25.5,
      "errorRate": 0.02
    },
    "trends": {
      "responseTime": {
        "trend": "improving",
        "change": -12.5,
        "period": "24h"
      },
      "memory": {
        "trend": "stable",
        "change": 2.1,
        "period": "24h"
      },
      "cache": {
        "trend": "improving",
        "change": 5.8,
        "period": "24h"
      }
    },
    "recentOptimizations": [
      {
        "timestamp": "2025-01-15T11:45:00.000Z",
        "action": "cache_optimization",
        "description": "Extended TTL for frequently accessed endpoints",
        "impact": "Improved response time by 15ms"
      }
    ],
    "recommendations": [
      "All performance metrics are within optimal ranges",
      "Consider implementing additional caching for /media/search endpoint"
    ],
    "alerts": []
  }
}
```

### Get Historical Performance Data

#### `GET /api/v1/performance/history`

Get historical performance data for trend analysis.

**Authentication:** Required (Admin)

**Query Parameters:**
- `period` (optional) - Time period: 1h, 24h, 7d, 30d (default: 24h)
- `metric` (optional) - Specific metric: response_time, memory, cpu, cache_hit_rate
- `granularity` (optional) - Data granularity: 1m, 5m, 1h (default: 5m)

**Example Request:**
```bash
GET /api/v1/performance/history?period=24h&metric=response_time&granularity=5m
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "24h",
    "metric": "response_time",
    "granularity": "5m",
    "dataPoints": [
      {
        "timestamp": "2025-01-15T12:00:00.000Z",
        "value": 234,
        "p95": 456,
        "p99": 789
      }
    ],
    "summary": {
      "average": 245,
      "min": 189,
      "max": 567,
      "p95": 456,
      "p99": 789
    }
  }
}
```

### Performance Optimization Controls

#### `POST /api/v1/performance/optimize`

Trigger manual performance optimization (admin only).

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "optimizations": [
    "cache_strategy",
    "database_queries",
    "memory_cleanup"
  ],
  "aggressive": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "optimizationId": "opt-abc123",
    "status": "started",
    "estimatedDuration": 30,
    "optimizations": [
      {
        "type": "cache_strategy",
        "status": "running",
        "description": "Optimizing cache TTL and eviction policies"
      }
    ]
  }
}
```

#### `GET /api/v1/performance/optimize/{optimizationId}`

Get optimization status and results.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "optimizationId": "opt-abc123",
    "status": "completed",
    "startedAt": "2025-01-15T12:00:00.000Z",
    "completedAt": "2025-01-15T12:00:30.000Z",
    "duration": 30,
    "results": [
      {
        "type": "cache_strategy",
        "status": "completed",
        "improvements": {
          "cacheHitRate": "+5.2%",
          "responseTime": "-12ms"
        },
        "actions": [
          "Extended TTL for frequent endpoints",
          "Optimized cache eviction policy"
        ]
      }
    ]
  }
}
```

### Performance Alerts Configuration

#### `GET /api/v1/performance/alerts`

Get current performance alert configuration.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "thresholds": {
      "responseTime": {
        "warning": 500,
        "critical": 1000,
        "unit": "ms"
      },
      "errorRate": {
        "warning": 0.05,
        "critical": 0.1,
        "unit": "percentage"
      },
      "memoryUsage": {
        "warning": 80,
        "critical": 90,
        "unit": "percentage"
      },
      "cpuUsage": {
        "warning": 80,
        "critical": 95,
        "unit": "percentage"
      },
      "cacheHitRate": {
        "warning": 0.7,
        "critical": 0.5,
        "unit": "percentage"
      }
    },
    "notifications": {
      "email": ["admin@medianest.app"],
      "webhook": "https://hooks.slack.com/services/...",
      "discord": true
    }
  }
}
```

#### `PUT /api/v1/performance/alerts`

Update performance alert configuration.

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "enabled": true,
  "thresholds": {
    "responseTime": {
      "warning": 400,
      "critical": 800
    }
  },
  "notifications": {
    "email": ["admin@medianest.app", "ops@medianest.app"]
  }
}
```

### Resource Monitoring

#### `GET /api/v1/performance/resources`

Get detailed resource utilization metrics.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-01-15T12:00:00.000Z",
    "processes": [
      {
        "name": "node",
        "pid": 1234,
        "cpu": 15.5,
        "memory": 256000000,
        "uptime": 3600
      }
    ],
    "network": {
      "bytesReceived": 1048576000,
      "bytesSent": 2097152000,
      "packetsReceived": 1024000,
      "packetsSent": 2048000,
      "errors": 0
    },
    "storage": {
      "reads": 1250,
      "writes": 450,
      "readBytes": 1048576000,
      "writeBytes": 524288000,
      "iops": 125
    },
    "connections": {
      "database": 8,
      "redis": 4,
      "websocket": 12,
      "http": 25
    }
  }
}
```

## Performance Thresholds

### Response Time Targets

| Endpoint Category | Target (P95) | Warning | Critical |
|------------------|--------------|---------|----------|
| Authentication | < 100ms | 200ms | 500ms |
| Search | < 300ms | 500ms | 1000ms |
| Media Requests | < 200ms | 400ms | 800ms |
| Dashboard | < 150ms | 300ms | 600ms |
| Admin Operations | < 500ms | 1000ms | 2000ms |

### Resource Usage Targets

| Resource | Optimal | Warning | Critical |
|----------|---------|---------|----------|
| CPU Usage | < 50% | 80% | 95% |
| Memory Usage | < 70% | 85% | 95% |
| Database Connections | < 50% | 80% | 95% |
| Cache Hit Rate | > 85% | < 70% | < 50% |

## Optimization Strategies

### Automatic Optimizations

The system automatically applies optimizations when performance degrades:

1. **Response Time Optimization**
   - Enable caching for slow endpoints
   - Optimize database queries
   - Implement connection pooling

2. **Memory Management**
   - Force garbage collection
   - Clear unnecessary caches
   - Optimize buffer sizes

3. **Cache Strategy**
   - Extend TTL for frequent data
   - Optimize eviction policies
   - Implement cache warming

4. **Database Performance**
   - Update table statistics
   - Optimize query plans
   - Manage connection pools

### Manual Optimization

Administrators can trigger manual optimizations:

```bash
# Trigger cache optimization
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"optimizations": ["cache_strategy"]}' \
  https://api.medianest.com/api/v1/performance/optimize
```

## Monitoring Integration

### Prometheus Metrics

Performance metrics are exported in Prometheus format:

```
GET /api/v1/performance/prometheus
```

**Example Metrics:**
```
# HELP medianest_http_requests_total Total HTTP requests
# TYPE medianest_http_requests_total counter
medianest_http_requests_total{method="GET",route="/api/v1/media/search",status="200"} 1245

# HELP medianest_http_request_duration_seconds HTTP request duration
# TYPE medianest_http_request_duration_seconds histogram
medianest_http_request_duration_seconds_bucket{method="GET",route="/api/v1/media/search",le="0.1"} 892
```

### Grafana Dashboard

Performance metrics can be visualized using the provided Grafana dashboard:

- **Dashboard ID**: `medianest-performance`
- **Datasource**: Prometheus
- **Panels**: Response times, error rates, resource usage, cache performance

### Custom Alerts

Configure custom alerts using AlertManager:

```yaml
groups:
  - name: medianest.performance
    rules:
      - alert: HighResponseTime
        expr: medianest_http_request_duration_seconds{quantile="0.95"} > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
```

## Performance Best Practices

### For API Consumers

1. **Implement Caching**: Cache responses when appropriate
2. **Use Pagination**: Limit large result sets
3. **Batch Requests**: Combine multiple operations
4. **Handle Rate Limits**: Respect rate limiting headers
5. **Monitor Usage**: Track your application's performance impact

### For System Administrators

1. **Regular Monitoring**: Monitor key metrics continuously
2. **Proactive Optimization**: Address performance issues early
3. **Capacity Planning**: Monitor growth trends
4. **Alert Configuration**: Set appropriate thresholds
5. **Regular Reviews**: Analyze performance patterns

## Error Handling

### Performance-Related Error Codes

| Error Code | Description | Resolution |
|------------|-------------|------------|
| `PERFORMANCE_DEGRADED` | System performance is degraded | Request may be slower than usual |
| `RESOURCE_EXHAUSTED` | System resources are exhausted | Retry with exponential backoff |
| `CIRCUIT_BREAKER_OPEN` | Service circuit breaker is open | Wait for circuit breaker reset |
| `OPTIMIZATION_FAILED` | Performance optimization failed | Check optimization logs |

### Example Error Response

```json
{
  "success": false,
  "error": {
    "code": "PERFORMANCE_DEGRADED",
    "message": "System performance is currently degraded",
    "statusCode": 503,
    "details": {
      "responseTime": 756,
      "threshold": 500,
      "retryAfter": 30
    }
  }
}
```

## Support and Troubleshooting

### Common Performance Issues

1. **Slow Response Times**
   - Check database query performance
   - Verify cache hit rates
   - Monitor CPU and memory usage

2. **High Error Rates**
   - Check service dependencies
   - Verify database connectivity
   - Monitor system resources

3. **Memory Issues**
   - Monitor memory leaks
   - Check garbage collection
   - Verify cache sizes

### Getting Help

- **Performance Dashboard**: Monitor real-time metrics
- **Optimization Logs**: Check automated optimization results
- **Support**: Contact support with performance correlation IDs
- **Documentation**: Review performance optimization guides

---

**Last Updated:** January 15, 2025  
**API Version:** 1.0.0  
**Documentation Version:** 1.0.0