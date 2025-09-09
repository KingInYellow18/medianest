# Health Check API

The MediaNest Health Check API provides comprehensive system health monitoring, service status verification, and performance metrics collection for operational oversight and debugging.

## Overview

The Health API offers:
- Basic health status for load balancers and monitoring systems
- Detailed system metrics and service health information
- Performance monitoring and bottleneck identification
- Administrative health insights with security controls

## Base Endpoint

```
/api/v1/health
```

## Public Health Check

### Basic Health Status

A lightweight endpoint for load balancers, container orchestrators, and monitoring systems.

```http
GET /api/v1/health
```

#### Request

**Headers:** None required (public endpoint)

#### Response

**Status:** `200 OK` (Healthy) or `503 Service Unavailable` (Unhealthy)

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T12:30:00.000Z",
    "uptime": "15d 8h 32m",
    "version": "2.0.0",
    "environment": "production"
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "health-check-123",
    "responseTime": "12ms"
  }
}
```

#### Unhealthy Response

**Status:** `503 Service Unavailable`

```json
{
  "success": false,
  "data": {
    "status": "unhealthy",
    "timestamp": "2024-01-01T12:30:00.000Z",
    "uptime": "15d 8h 32m",
    "version": "2.0.0",
    "environment": "production",
    "issues": [
      {
        "service": "database",
        "status": "down",
        "error": "Connection timeout"
      },
      {
        "service": "plex",
        "status": "degraded", 
        "error": "High response time"
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "health-check-456"
  }
}
```

## Simple Health Check

### Minimal Health Endpoint

An ultra-lightweight health check for Docker containers and Kubernetes probes.

```http
GET /api/v1/simple-health
```

#### Response

**Status:** `200 OK`

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:30:00.000Z"
}
```

**Status:** `503 Service Unavailable`

```json
{
  "status": "error",
  "timestamp": "2024-01-01T12:30:00.000Z"
}
```

## Detailed Health Metrics

### Comprehensive Health Report

Detailed system health information requiring administrative privileges.

```http
GET /api/v1/health/metrics
```

#### Request

**Headers:**
```
Authorization: Bearer <admin-jwt-token>
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "system": {
      "status": "healthy",
      "uptime": "15d 8h 32m",
      "version": "2.0.0",
      "environment": "production",
      "nodeVersion": "18.19.0",
      "platform": "linux",
      "architecture": "x64",
      "processId": 12345,
      "parentProcessId": 1
    },
    "performance": {
      "cpu": {
        "usage": 15.6,
        "cores": 16,
        "loadAverage": [1.2, 1.8, 2.1],
        "model": "Intel(R) Xeon(R) CPU E5-2686 v4 @ 2.30GHz",
        "speed": 2300,
        "times": {
          "user": 123456789,
          "nice": 0,
          "sys": 98765432,
          "idle": 987654321,
          "irq": 0
        }
      },
      "memory": {
        "total": 34359738368,
        "free": 12884901888,
        "used": 21474836480,
        "percentage": 62.5,
        "buffers": 2147483648,
        "cached": 8589934592,
        "available": 19327352832,
        "swapTotal": 2147483648,
        "swapUsed": 0,
        "swapFree": 2147483648
      },
      "disk": [
        {
          "filesystem": "/dev/sda1",
          "mount": "/",
          "type": "ext4",
          "total": 53687091200,
          "used": 21474836480,
          "available": 29622615040,
          "percentage": 42.0,
          "inodes": {
            "total": 3276800,
            "used": 1234567,
            "available": 2042233,
            "percentage": 37.7
          }
        },
        {
          "filesystem": "/dev/sdb1",
          "mount": "/data/media",
          "type": "ext4", 
          "total": 53687091200000,
          "used": 44253476044800,
          "available": 8858097459200,
          "percentage": 83.3,
          "inodes": {
            "total": 327680000,
            "used": 15678900,
            "available": 312001100,
            "percentage": 4.8
          }
        }
      ],
      "network": {
        "interfaces": [
          {
            "name": "eth0",
            "internal": false,
            "mac": "02:42:ac:11:00:02",
            "addresses": [
              {
                "address": "172.17.0.2",
                "family": "IPv4",
                "internal": false
              }
            ],
            "stats": {
              "bytesReceived": 1048576000,
              "bytesSent": 524288000,
              "packetsReceived": 1000000,
              "packetsSent": 800000,
              "errorsReceived": 0,
              "errorsSent": 0,
              "droppedReceived": 0,
              "droppedSent": 0
            }
          }
        ]
      }
    },
    "services": {
      "database": {
        "status": "healthy",
        "type": "PostgreSQL",
        "version": "15.3",
        "responseTime": 12,
        "lastCheck": "2024-01-01T12:30:00.000Z",
        "connections": {
          "active": 8,
          "idle": 12,
          "max": 100,
          "waiting": 0
        },
        "metrics": {
          "queries": {
            "total": 1547892,
            "successful": 1546234,
            "failed": 1658,
            "averageTime": 15.6
          },
          "cache": {
            "hitRate": 94.2,
            "size": 134217728,
            "used": 89478485
          }
        }
      },
      "redis": {
        "status": "healthy",
        "version": "7.0.11",
        "responseTime": 3,
        "lastCheck": "2024-01-01T12:30:00.000Z",
        "memory": {
          "used": 47423068,
          "peak": 71303168,
          "limit": 1073741824,
          "percentage": 4.4
        },
        "keyspace": {
          "db0": {
            "keys": 1547,
            "expires": 892,
            "averageTtl": 3600
          }
        },
        "stats": {
          "connections": {
            "received": 15478,
            "current": 8
          },
          "commands": {
            "processed": 1234567,
            "failed": 23
          }
        }
      },
      "plex": {
        "status": "healthy",
        "version": "1.32.7.7621",
        "responseTime": 890,
        "lastCheck": "2024-01-01T12:30:00.000Z",
        "url": "https://plex.example.com:32400",
        "features": {
          "transcoding": true,
          "remoteAccess": true,
          "libraries": true
        },
        "activity": {
          "sessions": 3,
          "bandwidth": 12500000,
          "transcodingSessions": 1
        },
        "libraries": [
          {
            "id": "1",
            "name": "Movies",
            "count": 2156,
            "lastScan": "2024-01-01T08:00:00.000Z"
          },
          {
            "id": "2",
            "name": "TV Shows",
            "count": 487,
            "lastScan": "2024-01-01T08:30:00.000Z"
          }
        ]
      },
      "overseerr": {
        "status": "healthy",
        "version": "1.33.2",
        "responseTime": 245,
        "lastCheck": "2024-01-01T12:30:00.000Z",
        "url": "https://overseerr.example.com",
        "stats": {
          "requests": {
            "total": 1847,
            "pending": 12,
            "approved": 8,
            "processing": 3
          }
        }
      }
    },
    "application": {
      "nodejs": {
        "version": "18.19.0",
        "uptime": 1324567.89,
        "memory": {
          "rss": 134217728,
          "heapTotal": 67108864,
          "heapUsed": 45678901,
          "external": 2345678,
          "arrayBuffers": 1234567
        },
        "gc": {
          "collections": {
            "scavenge": 1234,
            "markSweep": 56,
            "incrementalMarking": 78
          }
        }
      },
      "eventLoop": {
        "delay": 1.23,
        "utilization": 0.67
      },
      "handles": {
        "active": 45,
        "ref": 23,
        "unref": 22
      }
    },
    "api": {
      "requests": {
        "total": 1547892,
        "successful": 1546234,
        "failed": 1658,
        "rate": 156.7,
        "averageResponseTime": 245
      },
      "endpoints": {
        "health": {
          "requests": 45678,
          "averageTime": 12,
          "errors": 0
        },
        "auth": {
          "requests": 12345,
          "averageTime": 345,
          "errors": 23
        },
        "media": {
          "requests": 678901,
          "averageTime": 890,
          "errors": 456
        }
      }
    },
    "security": {
      "authentication": {
        "activeSessions": 23,
        "failedLogins": {
          "lastHour": 3,
          "lastDay": 12
        }
      },
      "rateLimit": {
        "blocked": {
          "lastHour": 5,
          "lastDay": 47
        }
      }
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "health-metrics-123",
    "generatedIn": "156ms",
    "dataFreshness": {
      "system": "realtime",
      "services": "30s",
      "api": "1m"
    }
  }
}
```

## Health Check Status Codes

### Overall System Status

The system health is determined by evaluating multiple factors:

```typescript
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface HealthCriteria {
  database: {
    status: 'up' | 'down' | 'slow';
    responseTime: number;
    threshold: 1000; // milliseconds
  };
  memory: {
    usage: number;
    threshold: 90; // percentage
  };
  disk: {
    usage: number;
    threshold: 95; // percentage
  };
  services: {
    plex: HealthStatus;
    overseerr: HealthStatus;
  };
}
```

### Status Determination Logic

1. **Healthy**: All services operational, resource usage within limits
2. **Degraded**: Some services slow or non-critical issues present
3. **Unhealthy**: Critical services down or severe resource constraints

## Kubernetes Integration

### Liveness Probe

Configure Kubernetes liveness probe:

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/simple-health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### Readiness Probe

Configure Kubernetes readiness probe:

```yaml
readinessProbe:
  httpGet:
    path: /api/v1/health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

### Startup Probe

Configure Kubernetes startup probe:

```yaml
startupProbe:
  httpGet:
    path: /api/v1/simple-health
    port: 8080
  initialDelaySeconds: 60
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 10
```

## Docker Health Checks

### Dockerfile Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/api/v1/simple-health || exit 1
```

### Docker Compose Health Check

```yaml
services:
  medianest:
    image: medianest:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/v1/simple-health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

## Load Balancer Integration

### HAProxy Health Check

```
backend medianest_servers
    balance roundrobin
    option httpchk GET /api/v1/health
    http-check expect status 200
    server medianest1 192.168.1.10:8080 check
    server medianest2 192.168.1.11:8080 check
```

### Nginx Health Check

```nginx
upstream medianest_backend {
    server 192.168.1.10:8080;
    server 192.168.1.11:8080;
}

server {
    location /health-check {
        access_log off;
        proxy_pass http://medianest_backend/api/v1/health;
        proxy_set_header Host $host;
    }
}
```

## Monitoring Integration

### Prometheus Metrics

Health check metrics are exposed for Prometheus scraping:

```
# HELP medianest_health_status System health status (1=healthy, 0.5=degraded, 0=unhealthy)
# TYPE medianest_health_status gauge
medianest_health_status 1

# HELP medianest_service_up Service availability (1=up, 0=down)
# TYPE medianest_service_up gauge
medianest_service_up{service="database"} 1
medianest_service_up{service="redis"} 1
medianest_service_up{service="plex"} 1
medianest_service_up{service="overseerr"} 1

# HELP medianest_response_time_seconds Service response time in seconds
# TYPE medianest_response_time_seconds gauge
medianest_response_time_seconds{service="database"} 0.012
medianest_response_time_seconds{service="redis"} 0.003
medianest_response_time_seconds{service="plex"} 0.890
medianest_response_time_seconds{service="overseerr"} 0.245
```

### Grafana Dashboard

Example Grafana query for health monitoring:

```promql
# System health over time
medianest_health_status

# Service availability 
sum(medianest_service_up) / count(medianest_service_up)

# Average response times
avg(medianest_response_time_seconds) by (service)
```

## Custom Health Checks

### Extending Health Checks

Add custom health checks by implementing the health check interface:

```typescript
interface HealthCheck {
  name: string;
  check(): Promise<HealthCheckResult>;
  timeout: number;
  critical: boolean;
}

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: any;
  error?: string;
}

// Example custom health check
class PlexLibraryHealthCheck implements HealthCheck {
  name = 'plex_libraries';
  timeout = 5000;
  critical = false;

  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const libraries = await plexService.getLibraries();
      const responseTime = Date.now() - startTime;
      
      if (libraries.length === 0) {
        return {
          status: 'degraded',
          responseTime,
          details: { message: 'No libraries found' }
        };
      }
      
      return {
        status: 'healthy',
        responseTime,
        details: { libraryCount: libraries.length }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }
}
```

## Performance Considerations

### Health Check Optimization

1. **Caching**: Cache health check results for 30 seconds
2. **Parallel Execution**: Run service checks in parallel
3. **Timeouts**: Implement reasonable timeouts for each check
4. **Circuit Breakers**: Skip checks for consistently failing services

### Resource Usage

Health checks are designed to be lightweight:
- Basic health check: < 5ms response time
- Detailed metrics: < 100ms response time
- Memory usage: < 1MB additional overhead
- CPU usage: < 1% during health checks

## Troubleshooting

### Common Health Check Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Health check timeout | Service overloaded | Increase timeout or reduce load |
| Intermittent failures | Network issues | Check network connectivity |
| Memory warnings | Memory leak | Investigate memory usage patterns |
| Database health fails | Connection pool exhausted | Increase pool size or reduce connections |

### Debug Health Checks

Enable detailed health check logging:

```bash
# Set log level to debug
export LOG_LEVEL=debug

# Enable health check specific logging
export HEALTH_CHECK_DEBUG=true
```

View health check logs:

```bash
# Follow health check logs
docker logs -f medianest | grep "health-check"

# Check specific service health
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8080/api/v1/health/metrics | jq '.data.services.database'
```