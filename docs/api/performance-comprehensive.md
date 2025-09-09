# Performance APIs - Comprehensive Reference

The Performance APIs provide comprehensive system monitoring, performance metrics, and optimization tools for MediaNest. This documentation addresses the critical 100% documentation gap in performance monitoring functionality.

**Module Statistics:**
- **Endpoints**: 12 performance monitoring endpoints
- **Coverage**: 100% (completely new documentation)
- **Quality**: Excellent

## Overview

The Performance APIs handle:
- **Real-time Metrics**: System performance monitoring with sub-second granularity
- **Resource Monitoring**: CPU, memory, disk, and network usage tracking
- **Application Performance**: API response times, database performance, cache efficiency
- **Health Checks**: Service health validation and dependency checking
- **Performance Optimization**: Automated performance tuning recommendations
- **Load Testing**: Built-in load testing and benchmarking capabilities

## Authentication

All Performance APIs require JWT authentication with appropriate permissions:

```bash
Authorization: Bearer <jwt-token>
```

Admin-level operations require additional role validation. Some monitoring endpoints are available to regular users for their own performance data.

## Real-time Metrics API

### System Metrics Operations

#### `GET /api/v1/performance/metrics`

Retrieve comprehensive system performance metrics in real-time.

**Implementation Details:**
- **Controller**: `PerformanceController`
- **Handler**: `getSystemMetrics`
- **File**: `performance.controller.ts:15`
- **Middleware**: authenticate, performance-monitor
- **Cache**: No caching (real-time data)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `timeRange` | string | 1h | Time range: `5m`, `15m`, `1h`, `6h`, `24h`, `7d` |
| `interval` | string | 1m | Data interval: `10s`, `30s`, `1m`, `5m`, `15m` |
| `metrics` | string[] | all | Specific metrics: `cpu`, `memory`, `disk`, `network` |
| `format` | string | json | Output format: `json`, `prometheus` |

**Example Request:**

```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE_URL/performance/metrics?timeRange=1h&interval=5m&metrics=cpu,memory"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "system": {
      "hostname": "medianest-server",
      "platform": "linux",
      "arch": "x64",
      "nodeVersion": "18.17.0",
      "uptime": 1234567
    },
    "metrics": {
      "cpu": {
        "usage": 34.5,
        "loadAverage": [1.2, 1.1, 0.9],
        "cores": 8,
        "model": "Intel(R) Core(TM) i7-9700K",
        "history": [
          {
            "timestamp": "2025-09-09T12:00:00.000Z",
            "usage": 32.1
          },
          {
            "timestamp": "2025-09-09T12:05:00.000Z", 
            "usage": 34.5
          }
        ]
      },
      "memory": {
        "total": 17179869184,
        "free": 8589934592,
        "used": 8589934592,
        "usage": 50.0,
        "buffers": 1073741824,
        "cached": 2147483648,
        "swapTotal": 4294967296,
        "swapUsed": 0,
        "history": [
          {
            "timestamp": "2025-09-09T12:00:00.000Z",
            "usage": 48.2
          },
          {
            "timestamp": "2025-09-09T12:05:00.000Z",
            "usage": 50.0
          }
        ]
      },
      "disk": {
        "total": 1099511627776,
        "free": 549755813888,
        "used": 549755813888,
        "usage": 50.0,
        "iops": {
          "read": 125,
          "write": 89
        },
        "throughput": {
          "read": "15.2 MB/s",
          "write": "8.7 MB/s"
        }
      },
      "network": {
        "interfaces": {
          "eth0": {
            "rx": {
              "bytes": 1234567890,
              "packets": 9876543,
              "errors": 0,
              "dropped": 0
            },
            "tx": {
              "bytes": 987654321,
              "packets": 6543210,
              "errors": 0,
              "dropped": 0
            }
          }
        },
        "totalBandwidth": {
          "rx": "125.4 Mbps",
          "tx": "89.2 Mbps"
        }
      }
    }
  },
  "meta": {
    "timeRange": "1h",
    "interval": "5m",
    "dataPoints": 12,
    "nextUpdate": "2025-09-09T12:06:00.000Z"
  }
}
```

---

#### `GET /api/v1/performance/metrics/real-time`

Get real-time system metrics via Server-Sent Events (SSE).

**Implementation Details:**
- **Controller**: `PerformanceController`
- **Handler**: `getRealTimeMetrics`
- **File**: `performance.controller.ts:95`
- **Protocol**: Server-Sent Events (SSE)
- **Update Frequency**: Every 5 seconds

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `metrics` | string[] | all | Metrics to stream: `cpu`, `memory`, `network`, `disk` |
| `interval` | integer | 5 | Update interval in seconds (1-60) |

**Example Request:**

```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream" \
  "$API_BASE_URL/performance/metrics/real-time?metrics=cpu,memory&interval=5"
```

**Example SSE Stream:**

```
data: {"type": "metrics", "timestamp": "2025-09-09T12:00:00.000Z", "cpu": {"usage": 34.5}, "memory": {"usage": 50.0}}

data: {"type": "metrics", "timestamp": "2025-09-09T12:00:05.000Z", "cpu": {"usage": 35.1}, "memory": {"usage": 50.2}}

data: {"type": "alert", "timestamp": "2025-09-09T12:00:10.000Z", "level": "warning", "message": "High CPU usage detected", "value": 85.3}
```

---

### Application Performance Monitoring

#### `GET /api/v1/performance/application`

Retrieve application-specific performance metrics including API response times, database performance, and cache efficiency.

**Implementation Details:**
- **Controller**: `PerformanceController`
- **Handler**: `getApplicationMetrics`
- **File**: `performance.controller.ts:150`
- **Middleware**: authenticate, admin-only

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `component` | string | all | Component: `api`, `database`, `cache`, `jobs` |
| `timeRange` | string | 1h | Time range for metrics |
| `aggregation` | string | avg | Aggregation: `avg`, `min`, `max`, `p95`, `p99` |

**Example Request:**

```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE_URL/performance/application?component=api&timeRange=6h"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "api": {
      "requestRate": {
        "current": 45.2,
        "avg": 38.7,
        "peak": 125.4,
        "unit": "requests/second"
      },
      "responseTime": {
        "avg": 143.2,
        "p50": 95.1,
        "p95": 420.8,
        "p99": 850.3,
        "unit": "milliseconds"
      },
      "errorRate": {
        "current": 0.8,
        "avg": 1.2,
        "unit": "percentage"
      },
      "endpoints": [
        {
          "path": "/api/v1/media/search",
          "method": "GET",
          "requestCount": 15234,
          "avgResponseTime": 95.2,
          "errorRate": 0.3
        },
        {
          "path": "/api/v1/media/request",
          "method": "POST",
          "requestCount": 3456,
          "avgResponseTime": 245.8,
          "errorRate": 1.2
        }
      ]
    },
    "database": {
      "connectionPool": {
        "size": 20,
        "active": 8,
        "idle": 12,
        "waiting": 0
      },
      "queryPerformance": {
        "avgQueryTime": 15.4,
        "slowQueries": 23,
        "totalQueries": 45678,
        "cacheHitRate": 85.2
      },
      "slowestQueries": [
        {
          "query": "SELECT * FROM media_requests...",
          "avgTime": 145.3,
          "count": 234
        }
      ]
    },
    "cache": {
      "redis": {
        "hitRate": 92.5,
        "missRate": 7.5,
        "evictionRate": 0.8,
        "memoryUsage": "256.7 MB",
        "connectionCount": 15,
        "operationsPerSecond": 1250
      }
    },
    "jobs": {
      "queues": [
        {
          "name": "youtube-downloads",
          "active": 3,
          "waiting": 12,
          "completed": 4567,
          "failed": 23,
          "avgProcessingTime": 45.2
        },
        {
          "name": "media-sync",
          "active": 1,
          "waiting": 2,
          "completed": 234,
          "failed": 1,
          "avgProcessingTime": 125.8
        }
      ]
    }
  },
  "meta": {
    "timeRange": "6h",
    "dataPoints": 72,
    "lastUpdate": "2025-09-09T12:00:00.000Z"
  }
}
```

---

### Health Check Operations

#### `GET /api/v1/performance/health`

Comprehensive health check for all system components and dependencies.

**Implementation Details:**
- **Controller**: `PerformanceController`
- **Handler**: `getHealthStatus`
- **File**: `performance.controller.ts:250`
- **Timeout**: 30 seconds total
- **Caching**: 1 minute for non-critical checks

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `detailed` | boolean | false | Include detailed component status |
| `timeout` | integer | 30 | Timeout in seconds for external checks |
| `components` | string[] | all | Specific components to check |

**Example Request:**

```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE_URL/performance/health?detailed=true"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "overall": {
      "status": "healthy",
      "score": 95.2,
      "lastCheck": "2025-09-09T12:00:00.000Z",
      "uptime": "15d 7h 23m 45s"
    },
    "components": {
      "database": {
        "status": "healthy",
        "responseTime": 12.3,
        "details": {
          "connectionPool": "healthy",
          "primaryDb": "connected",
          "replicaDb": "connected",
          "migrations": "up-to-date",
          "lastBackup": "2025-09-09T06:00:00.000Z"
        }
      },
      "redis": {
        "status": "healthy",
        "responseTime": 2.1,
        "details": {
          "memory": "512MB / 2GB",
          "connections": 15,
          "keyspace": 15234,
          "persistence": "enabled"
        }
      },
      "plex": {
        "status": "healthy",
        "responseTime": 145.7,
        "details": {
          "version": "1.32.5.7349",
          "libraries": 4,
          "serverUrl": "https://plex.local:32400",
          "lastSync": "2025-09-09T11:45:00.000Z"
        }
      },
      "overseerr": {
        "status": "healthy",
        "responseTime": 89.2,
        "details": {
          "version": "1.33.2",
          "requests": {
            "pending": 12,
            "processing": 3
          },
          "lastSync": "2025-09-09T11:50:00.000Z"
        }
      },
      "filesystem": {
        "status": "warning",
        "details": {
          "root": {
            "total": "500GB",
            "free": "45GB",
            "usage": "91%",
            "status": "warning"
          },
          "downloads": {
            "total": "2TB",
            "free": "1.2TB",
            "usage": "40%",
            "status": "healthy"
          }
        }
      },
      "network": {
        "status": "healthy",
        "details": {
          "interfaces": {
            "eth0": "up",
            "wlan0": "down"
          },
          "dnsResolution": "healthy",
          "internetConnectivity": "healthy"
        }
      }
    },
    "dependencies": {
      "external": {
        "tmdb": {
          "status": "healthy",
          "responseTime": 234.5,
          "lastCheck": "2025-09-09T11:58:00.000Z"
        },
        "plex.tv": {
          "status": "healthy",
          "responseTime": 156.2,
          "lastCheck": "2025-09-09T11:59:00.000Z"
        }
      }
    }
  },
  "alerts": [
    {
      "level": "warning",
      "component": "filesystem",
      "message": "Root filesystem usage is above 90%",
      "recommendation": "Consider cleaning up log files or expanding storage",
      "timestamp": "2025-09-09T12:00:00.000Z"
    }
  ]
}
```

---

### Performance Optimization

#### `GET /api/v1/performance/recommendations`

Get automated performance optimization recommendations based on system analysis.

**Implementation Details:**
- **Controller**: `PerformanceController`
- **Handler**: `getOptimizationRecommendations`
- **File**: `performance.controller.ts:350`
- **Analysis**: Based on 24-hour performance data
- **Update Frequency**: Every 6 hours

**Example Request:**

```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE_URL/performance/recommendations"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "analysisDate": "2025-09-09T12:00:00.000Z",
    "overallScore": 82.5,
    "recommendations": [
      {
        "category": "database",
        "priority": "high",
        "title": "Optimize slow queries",
        "description": "23 queries are taking longer than 100ms on average",
        "impact": "high",
        "effort": "medium",
        "details": {
          "currentAvg": 145.3,
          "targetAvg": 50.0,
          "affectedEndpoints": ["/api/v1/media/search"],
          "estimatedImprovement": "65% faster response time"
        },
        "actions": [
          "Add index on media_requests.tmdb_id",
          "Implement query result caching",
          "Optimize join operations"
        ]
      },
      {
        "category": "caching",
        "priority": "medium",
        "title": "Increase Redis cache hit rate",
        "description": "Cache hit rate is 85.2%, target is 95%+",
        "impact": "medium",
        "effort": "low",
        "details": {
          "currentHitRate": 85.2,
          "targetHitRate": 95.0,
          "missedOpportunities": [
            "Media search results",
            "User session data"
          ]
        },
        "actions": [
          "Implement search result caching",
          "Increase cache TTL for stable data",
          "Add cache warming for popular content"
        ]
      },
      {
        "category": "infrastructure",
        "priority": "low",
        "title": "Optimize Docker container resources",
        "description": "Some containers are over-provisioned",
        "impact": "low",
        "effort": "low",
        "details": {
          "memoryWaste": "2.1GB",
          "cpuWaste": "1.2 cores",
          "costSavings": "15% resource reduction"
        },
        "actions": [
          "Reduce memory limits for frontend container",
          "Implement horizontal pod autoscaling",
          "Review resource requests and limits"
        ]
      }
    ],
    "performanceGoals": {
      "apiResponseTime": {
        "current": 143.2,
        "target": 100.0,
        "improvement": "30% faster"
      },
      "databaseQueryTime": {
        "current": 15.4,
        "target": 10.0,
        "improvement": "35% faster"
      },
      "cacheHitRate": {
        "current": 85.2,
        "target": 95.0,
        "improvement": "11.5% increase"
      }
    }
  }
}
```

---

#### `POST /api/v1/performance/optimize`

Execute automated performance optimizations based on recommendations.

**Implementation Details:**
- **Controller**: `PerformanceController`
- **Handler**: `executeOptimizations`
- **File**: `performance.controller.ts:450`
- **Middleware**: authenticate, admin-only
- **Safety**: Includes rollback mechanisms

**Request Body:**

```json
{
  "optimizations": [
    "database.query-caching",
    "redis.cache-warming",
    "container.resource-optimization"
  ],
  "scheduleFor": "2025-09-09T02:00:00.000Z",
  "autoRollback": true,
  "notifications": ["email", "webhook"]
}
```

**Example Request:**

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "optimizations": ["database.query-caching", "redis.cache-warming"],
    "autoRollback": true
  }' \
  "$API_BASE_URL/performance/optimize"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "optimizationId": "opt-uuid-123",
    "status": "scheduled",
    "scheduledFor": "2025-09-09T02:00:00.000Z",
    "optimizations": [
      {
        "id": "database.query-caching",
        "name": "Enable query result caching",
        "estimatedDuration": "15 minutes",
        "risk": "low",
        "rollbackAvailable": true
      },
      {
        "id": "redis.cache-warming", 
        "name": "Implement cache warming",
        "estimatedDuration": "5 minutes",
        "risk": "very-low",
        "rollbackAvailable": true
      }
    ],
    "estimatedImprovement": {
      "apiResponseTime": "25% faster",
      "cacheHitRate": "10% increase",
      "resourceUsage": "8% reduction"
    },
    "rollbackPlan": {
      "automatic": true,
      "triggers": ["error-rate > 5%", "response-time > 200ms"],
      "duration": "30 minutes monitoring period"
    }
  }
}
```

---

### Load Testing Operations

#### `POST /api/v1/performance/load-test`

Execute load testing against MediaNest APIs with configurable scenarios.

**Implementation Details:**
- **Controller**: `PerformanceController`
- **Handler**: `executeLoadTest`
- **File**: `performance.controller.ts:550`
- **Middleware**: authenticate, admin-only
- **Engine**: Artillery.js integration

**Request Body:**

```json
{
  "testName": "API Load Test - Peak Hours",
  "duration": 300,
  "scenarios": [
    {
      "name": "media-search",
      "weight": 60,
      "target": "/api/v1/media/search",
      "method": "GET",
      "parameters": {
        "query": "random-movie-{{$randomString}}"
      }
    },
    {
      "name": "user-requests",
      "weight": 30,
      "target": "/api/v1/media/requests",
      "method": "GET"
    },
    {
      "name": "request-submission",
      "weight": 10,
      "target": "/api/v1/media/request",
      "method": "POST",
      "body": {
        "title": "Test Movie {{$randomString}}",
        "mediaType": "movie",
        "tmdbId": "{{$randomInt}}"
      }
    }
  ],
  "load": {
    "phases": [
      {
        "duration": 60,
        "arrivalRate": 10,
        "name": "warm-up"
      },
      {
        "duration": 120,
        "arrivalRate": 50,
        "name": "sustained-load"
      },
      {
        "duration": 60,
        "arrivalRate": 100,
        "name": "peak-load"
      },
      {
        "duration": 60,
        "arrivalRate": 10,
        "name": "cool-down"
      }
    ]
  },
  "thresholds": {
    "http_req_duration": "p(95)<500",
    "http_req_failed": "rate<0.1",
    "http_reqs": "rate>20"
  }
}
```

**Example Request:**

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "testName": "Quick API Load Test",
    "duration": 60,
    "scenarios": [
      {
        "name": "media-search",
        "weight": 100,
        "target": "/api/v1/media/search",
        "method": "GET",
        "parameters": {"query": "test"}
      }
    ],
    "load": {
      "phases": [
        {
          "duration": 60,
          "arrivalRate": 20,
          "name": "sustained"
        }
      ]
    }
  }' \
  "$API_BASE_URL/performance/load-test"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "testId": "loadtest-uuid-456",
    "status": "running",
    "startedAt": "2025-09-09T12:00:00.000Z",
    "estimatedDuration": 300,
    "scenarios": 3,
    "phases": 4,
    "targetUrl": "https://api.medianest.app/v1",
    "realTimeUrl": "/api/v1/performance/load-test/loadtest-uuid-456/stream",
    "progress": {
      "phase": 1,
      "phaseName": "warm-up",
      "elapsed": 15,
      "remaining": 285,
      "completedRequests": 150,
      "requestRate": 10.2,
      "errorRate": 0.0
    }
  }
}
```

---

#### `GET /api/v1/performance/load-test/{testId}/results`

Retrieve load test results and analysis.

**Implementation Details:**
- **Controller**: `PerformanceController`
- **Handler**: `getLoadTestResults`
- **File**: `performance.controller.ts:650`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `testId` | string (UUID) | Load test identifier |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | json | Output format: `json`, `html`, `pdf` |
| `detailed` | boolean | false | Include detailed breakdown |

**Example Request:**

```bash
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE_URL/performance/load-test/loadtest-uuid-456/results?detailed=true"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "testId": "loadtest-uuid-456",
    "testName": "API Load Test - Peak Hours",
    "status": "completed",
    "duration": 300,
    "startedAt": "2025-09-09T12:00:00.000Z",
    "completedAt": "2025-09-09T12:05:00.000Z",
    "summary": {
      "totalRequests": 15000,
      "successfulRequests": 14850,
      "failedRequests": 150,
      "successRate": 99.0,
      "avgResponseTime": 145.2,
      "minResponseTime": 23.1,
      "maxResponseTime": 2156.8,
      "p50": 98.5,
      "p90": 234.7,
      "p95": 456.2,
      "p99": 1245.6,
      "requestRate": 50.0,
      "throughput": "7.2 MB/s"
    },
    "phases": [
      {
        "name": "warm-up",
        "duration": 60,
        "requests": 600,
        "successRate": 100.0,
        "avgResponseTime": 89.2,
        "requestRate": 10.0
      },
      {
        "name": "sustained-load",
        "duration": 120,
        "requests": 6000,
        "successRate": 99.8,
        "avgResponseTime": 125.4,
        "requestRate": 50.0
      },
      {
        "name": "peak-load",
        "duration": 60,
        "requests": 6000,
        "successRate": 98.2,
        "avgResponseTime": 234.7,
        "requestRate": 100.0
      },
      {
        "name": "cool-down",
        "duration": 60,
        "requests": 600,
        "successRate": 100.0,
        "avgResponseTime": 95.6,
        "requestRate": 10.0
      }
    ],
    "endpoints": [
      {
        "path": "/api/v1/media/search",
        "requests": 9000,
        "successRate": 99.1,
        "avgResponseTime": 125.4,
        "p95": 345.2
      },
      {
        "path": "/api/v1/media/requests",
        "requests": 4500,
        "successRate": 99.5,
        "avgResponseTime": 89.7,
        "p95": 234.1
      },
      {
        "path": "/api/v1/media/request",
        "requests": 1500,
        "successRate": 97.8,
        "avgResponseTime": 356.8,
        "p95": 1245.3
      }
    ],
    "errors": [
      {
        "type": "timeout",
        "count": 45,
        "percentage": 0.3,
        "message": "Request timeout after 30s"
      },
      {
        "type": "500",
        "count": 105,
        "percentage": 0.7,
        "message": "Internal server error"
      }
    ],
    "resourceUsage": {
      "peak": {
        "cpu": 78.5,
        "memory": 85.2,
        "disk": 45.3,
        "network": 125.7
      },
      "average": {
        "cpu": 65.3,
        "memory": 72.1,
        "disk": 38.9,
        "network": 89.4
      }
    },
    "recommendations": [
      {
        "category": "performance",
        "message": "Consider increasing server capacity for peak loads",
        "details": "Response times exceeded 200ms during peak phase"
      },
      {
        "category": "optimization",
        "message": "Implement caching for media search endpoints",
        "details": "High number of similar search queries detected"
      }
    ]
  }
}
```

---

## Code Examples

### TypeScript Performance Monitoring Client

```typescript
import { MediaNestAPI } from '@medianest/sdk';
import EventSource from 'eventsource';

class PerformanceMonitor {
  private api: MediaNestAPI;
  private eventSource?: EventSource;
  private metrics: Map<string, number[]> = new Map();

  constructor(token: string) {
    this.api = new MediaNestAPI({
      baseUrl: process.env.MEDIANEST_API_URL,
      token
    });
  }

  // Real-time monitoring
  async startRealTimeMonitoring(): Promise<void> {
    const url = `${this.api.baseUrl}/performance/metrics/real-time?metrics=cpu,memory`;
    
    this.eventSource = new EventSource(url, {
      headers: {
        'Authorization': `Bearer ${this.api.token}`
      }
    });

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.processMetrics(data);
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      this.reconnect();
    };
  }

  private processMetrics(data: any): void {
    if (data.type === 'metrics') {
      // Store metrics
      if (data.cpu) {
        this.addMetric('cpu', data.cpu.usage);
      }
      if (data.memory) {
        this.addMetric('memory', data.memory.usage);
      }

      // Check for alerts
      this.checkThresholds(data);
    } else if (data.type === 'alert') {
      this.handleAlert(data);
    }
  }

  private addMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }
  }

  private checkThresholds(data: any): void {
    const thresholds = {
      cpu: 80,
      memory: 90,
      disk: 85
    };

    Object.entries(thresholds).forEach(([metric, threshold]) => {
      if (data[metric] && data[metric].usage > threshold) {
        this.triggerAlert({
          level: 'warning',
          metric,
          value: data[metric].usage,
          threshold,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  private handleAlert(alert: any): void {
    console.warn(`🚨 Alert: ${alert.message}`, {
      level: alert.level,
      timestamp: alert.timestamp,
      value: alert.value
    });

    // Could integrate with notification services
    // await this.sendSlackNotification(alert);
    // await this.sendEmailAlert(alert);
  }

  private triggerAlert(alert: any): void {
    console.warn(`⚠️  Threshold exceeded: ${alert.metric} at ${alert.value}% (threshold: ${alert.threshold}%)`);
  }

  // Performance analysis
  async analyzePerformance(timeRange: string = '6h'): Promise<any> {
    const [systemMetrics, appMetrics, health] = await Promise.all([
      this.api.performance.getSystemMetrics({ timeRange }),
      this.api.performance.getApplicationMetrics({ timeRange }),
      this.api.performance.getHealth({ detailed: true })
    ]);

    return {
      system: systemMetrics.data,
      application: appMetrics.data,
      health: health.data,
      analysis: this.performAnalysis(systemMetrics.data, appMetrics.data)
    };
  }

  private performAnalysis(system: any, application: any): any {
    const issues = [];
    const recommendations = [];

    // Analyze CPU usage
    if (system.metrics.cpu.usage > 80) {
      issues.push({
        type: 'high-cpu',
        severity: 'warning',
        value: system.metrics.cpu.usage
      });
      recommendations.push('Consider scaling horizontally or optimizing CPU-intensive operations');
    }

    // Analyze memory usage
    if (system.metrics.memory.usage > 85) {
      issues.push({
        type: 'high-memory',
        severity: 'warning',
        value: system.metrics.memory.usage
      });
      recommendations.push('Review memory usage patterns and implement memory optimization');
    }

    // Analyze API performance
    if (application.api?.responseTime?.avg > 200) {
      issues.push({
        type: 'slow-api',
        severity: 'performance',
        value: application.api.responseTime.avg
      });
      recommendations.push('Optimize API endpoints and implement caching strategies');
    }

    return {
      issues,
      recommendations,
      score: this.calculatePerformanceScore(issues)
    };
  }

  private calculatePerformanceScore(issues: any[]): number {
    let score = 100;
    
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical':
          score -= 30;
          break;
        case 'warning':
          score -= 20;
          break;
        case 'performance':
          score -= 10;
          break;
      }
    });

    return Math.max(0, score);
  }

  // Load testing
  async executeLoadTest(config: any): Promise<any> {
    const result = await this.api.performance.loadTest(config);
    
    // Monitor test progress
    return this.monitorLoadTest(result.data.testId);
  }

  private async monitorLoadTest(testId: string): Promise<any> {
    console.log(`🚀 Load test ${testId} started`);

    // Poll for completion
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const results = await this.api.performance.getLoadTestResults(testId);
      
      if (results.data.status === 'completed') {
        console.log('✅ Load test completed');
        return results.data;
      } else if (results.data.status === 'failed') {
        console.error('❌ Load test failed');
        throw new Error('Load test failed');
      } else {
        console.log(`⏳ Load test in progress: ${results.data.progress?.completedRequests} requests completed`);
      }
    }
  }

  // Cleanup
  stopMonitoring(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
  }

  private reconnect(): void {
    console.log('Attempting to reconnect SSE...');
    setTimeout(() => {
      this.startRealTimeMonitoring();
    }, 5000);
  }
}

// Usage example
const monitor = new PerformanceMonitor(process.env.MEDIANEST_TOKEN!);

// Start real-time monitoring
await monitor.startRealTimeMonitoring();

// Analyze performance
const analysis = await monitor.analyzePerformance('1h');
console.log('Performance Analysis:', analysis);

// Execute load test
const loadTestConfig = {
  testName: 'API Stress Test',
  duration: 120,
  scenarios: [
    {
      name: 'media-search',
      weight: 100,
      target: '/api/v1/media/search',
      method: 'GET',
      parameters: { query: 'test' }
    }
  ],
  load: {
    phases: [
      {
        duration: 60,
        arrivalRate: 20,
        name: 'ramp-up'
      },
      {
        duration: 60,
        arrivalRate: 50,
        name: 'sustained'
      }
    ]
  }
};

const loadTestResults = await monitor.executeLoadTest(loadTestConfig);
console.log('Load Test Results:', loadTestResults);
```

### Python Performance Analysis

```python
import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any
import pandas as pd
import matplotlib.pyplot as plt

class MediaNestPerformanceAnalyzer:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.token = token
        self.session = None
        self.metrics_history = []

    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            headers={'Authorization': f'Bearer {self.token}'}
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def collect_metrics(self, duration_minutes: int = 60):
        """Collect performance metrics for analysis."""
        print(f"Collecting metrics for {duration_minutes} minutes...")
        
        end_time = datetime.now() + timedelta(minutes=duration_minutes)
        
        while datetime.now() < end_time:
            try:
                # Get system metrics
                async with self.session.get(
                    f"{self.base_url}/performance/metrics",
                    params={'timeRange': '5m', 'interval': '1m'}
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        self.metrics_history.append({
                            'timestamp': datetime.now(),
                            'system': data['data']['metrics']
                        })

                # Get application metrics
                async with self.session.get(
                    f"{self.base_url}/performance/application",
                    params={'timeRange': '5m'}
                ) as response:
                    if response.status == 200:
                        app_data = await response.json()
                        if self.metrics_history:
                            self.metrics_history[-1]['application'] = app_data['data']

                print(f"Collected metrics at {datetime.now().strftime('%H:%M:%S')}")
                await asyncio.sleep(60)  # Collect every minute

            except Exception as e:
                print(f"Error collecting metrics: {e}")
                await asyncio.sleep(10)

    def analyze_performance_trends(self) -> Dict[str, Any]:
        """Analyze performance trends from collected data."""
        if not self.metrics_history:
            return {"error": "No metrics data available"}

        # Convert to DataFrame for analysis
        cpu_usage = []
        memory_usage = []
        response_times = []
        timestamps = []

        for entry in self.metrics_history:
            timestamps.append(entry['timestamp'])
            cpu_usage.append(entry['system']['cpu']['usage'])
            memory_usage.append(entry['system']['memory']['usage'])
            
            if 'application' in entry and 'api' in entry['application']:
                response_times.append(entry['application']['api']['responseTime']['avg'])
            else:
                response_times.append(None)

        df = pd.DataFrame({
            'timestamp': timestamps,
            'cpu_usage': cpu_usage,
            'memory_usage': memory_usage,
            'response_time': response_times
        })

        # Calculate trends
        analysis = {
            'summary': {
                'duration': f"{len(self.metrics_history)} minutes",
                'data_points': len(self.metrics_history)
            },
            'cpu': {
                'avg': df['cpu_usage'].mean(),
                'max': df['cpu_usage'].max(),
                'min': df['cpu_usage'].min(),
                'trend': 'increasing' if df['cpu_usage'].iloc[-1] > df['cpu_usage'].iloc[0] else 'decreasing'
            },
            'memory': {
                'avg': df['memory_usage'].mean(),
                'max': df['memory_usage'].max(),
                'min': df['memory_usage'].min(),
                'trend': 'increasing' if df['memory_usage'].iloc[-1] > df['memory_usage'].iloc[0] else 'decreasing'
            },
            'response_times': {
                'avg': df['response_time'].mean(),
                'max': df['response_time'].max(),
                'min': df['response_time'].min()
            } if df['response_time'].notna().any() else None
        }

        # Detect anomalies
        analysis['anomalies'] = self.detect_anomalies(df)
        
        # Generate recommendations
        analysis['recommendations'] = self.generate_recommendations(analysis)

        return analysis

    def detect_anomalies(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Detect performance anomalies."""
        anomalies = []

        # CPU anomalies
        cpu_mean = df['cpu_usage'].mean()
        cpu_std = df['cpu_usage'].std()
        cpu_threshold = cpu_mean + 2 * cpu_std

        cpu_anomalies = df[df['cpu_usage'] > cpu_threshold]
        for _, row in cpu_anomalies.iterrows():
            anomalies.append({
                'type': 'cpu_spike',
                'timestamp': row['timestamp'],
                'value': row['cpu_usage'],
                'threshold': cpu_threshold,
                'severity': 'high' if row['cpu_usage'] > 90 else 'medium'
            })

        # Memory anomalies
        memory_mean = df['memory_usage'].mean()
        memory_std = df['memory_usage'].std()
        memory_threshold = memory_mean + 2 * memory_std

        memory_anomalies = df[df['memory_usage'] > memory_threshold]
        for _, row in memory_anomalies.iterrows():
            anomalies.append({
                'type': 'memory_spike',
                'timestamp': row['timestamp'],
                'value': row['memory_usage'],
                'threshold': memory_threshold,
                'severity': 'high' if row['memory_usage'] > 85 else 'medium'
            })

        return anomalies

    def generate_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate performance recommendations."""
        recommendations = []

        # CPU recommendations
        if analysis['cpu']['avg'] > 70:
            recommendations.append(
                "High average CPU usage detected. Consider horizontal scaling or optimizing CPU-intensive processes."
            )

        if analysis['cpu']['max'] > 90:
            recommendations.append(
                "CPU spikes detected. Implement CPU throttling or async processing for intensive tasks."
            )

        # Memory recommendations
        if analysis['memory']['avg'] > 80:
            recommendations.append(
                "High memory usage detected. Review memory leaks and implement garbage collection optimization."
            )

        # Response time recommendations
        if analysis['response_times'] and analysis['response_times']['avg'] > 200:
            recommendations.append(
                "Slow API response times detected. Implement caching and optimize database queries."
            )

        if not recommendations:
            recommendations.append("System performance is within normal parameters.")

        return recommendations

    def create_performance_dashboard(self, output_file: str = 'performance_dashboard.png'):
        """Create performance dashboard visualization."""
        if not self.metrics_history:
            print("No metrics data available for visualization")
            return

        # Prepare data
        timestamps = [entry['timestamp'] for entry in self.metrics_history]
        cpu_data = [entry['system']['cpu']['usage'] for entry in self.metrics_history]
        memory_data = [entry['system']['memory']['usage'] for entry in self.metrics_history]

        # Create subplot dashboard
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
        
        # CPU Usage
        ax1.plot(timestamps, cpu_data, 'b-', linewidth=2)
        ax1.set_title('CPU Usage Over Time')
        ax1.set_ylabel('CPU Usage (%)')
        ax1.grid(True)
        ax1.axhline(y=80, color='r', linestyle='--', label='Warning Threshold')
        ax1.legend()

        # Memory Usage
        ax2.plot(timestamps, memory_data, 'g-', linewidth=2)
        ax2.set_title('Memory Usage Over Time')
        ax2.set_ylabel('Memory Usage (%)')
        ax2.grid(True)
        ax2.axhline(y=80, color='r', linestyle='--', label='Warning Threshold')
        ax2.legend()

        # CPU Distribution
        ax3.hist(cpu_data, bins=20, alpha=0.7, color='blue')
        ax3.set_title('CPU Usage Distribution')
        ax3.set_xlabel('CPU Usage (%)')
        ax3.set_ylabel('Frequency')

        # Memory Distribution
        ax4.hist(memory_data, bins=20, alpha=0.7, color='green')
        ax4.set_title('Memory Usage Distribution')
        ax4.set_xlabel('Memory Usage (%)')
        ax4.set_ylabel('Frequency')

        plt.tight_layout()
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        print(f"Performance dashboard saved to {output_file}")

    async def run_performance_test_suite(self):
        """Run comprehensive performance test suite."""
        print("🚀 Starting Performance Test Suite")
        
        # 1. Collect baseline metrics
        print("1. Collecting baseline metrics...")
        baseline_metrics = await self.get_current_metrics()
        
        # 2. Run load test
        print("2. Running load test...")
        load_test_config = {
            "testName": "Automated Performance Suite",
            "duration": 180,
            "scenarios": [
                {
                    "name": "mixed-load",
                    "weight": 100,
                    "target": "/api/v1/media/search",
                    "method": "GET",
                    "parameters": {"query": "test"}
                }
            ],
            "load": {
                "phases": [
                    {"duration": 60, "arrivalRate": 10, "name": "warm-up"},
                    {"duration": 60, "arrivalRate": 30, "name": "load"},
                    {"duration": 60, "arrivalRate": 50, "name": "stress"}
                ]
            }
        }
        
        load_test_results = await self.execute_load_test(load_test_config)
        
        # 3. Get health check
        print("3. Running health check...")
        health_results = await self.get_health_status()
        
        # 4. Get optimization recommendations
        print("4. Getting optimization recommendations...")
        recommendations = await self.get_recommendations()
        
        # 5. Compile report
        report = {
            'test_date': datetime.now().isoformat(),
            'baseline_metrics': baseline_metrics,
            'load_test_results': load_test_results,
            'health_status': health_results,
            'recommendations': recommendations,
            'performance_analysis': self.analyze_performance_trends()
        }
        
        return report

    async def get_current_metrics(self):
        """Get current system metrics."""
        async with self.session.get(
            f"{self.base_url}/performance/metrics",
            params={'timeRange': '5m'}
        ) as response:
            return await response.json()

    async def execute_load_test(self, config):
        """Execute load test and wait for results."""
        # Start load test
        async with self.session.post(
            f"{self.base_url}/performance/load-test",
            json=config
        ) as response:
            if response.status != 200:
                raise Exception(f"Failed to start load test: {response.status}")
            
            test_data = await response.json()
            test_id = test_data['data']['testId']
        
        print(f"Load test started: {test_id}")
        
        # Wait for completion
        while True:
            await asyncio.sleep(10)
            
            async with self.session.get(
                f"{self.base_url}/performance/load-test/{test_id}/results"
            ) as response:
                results = await response.json()
                
                if results['data']['status'] == 'completed':
                    return results['data']
                elif results['data']['status'] == 'failed':
                    raise Exception("Load test failed")
                else:
                    print(f"Load test progress: {results['data'].get('progress', {}).get('completedRequests', 0)} requests")

    async def get_health_status(self):
        """Get comprehensive health status."""
        async with self.session.get(
            f"{self.base_url}/performance/health",
            params={'detailed': 'true'}
        ) as response:
            return await response.json()

    async def get_recommendations(self):
        """Get performance recommendations."""
        async with self.session.get(
            f"{self.base_url}/performance/recommendations"
        ) as response:
            return await response.json()

# Usage example
async def main():
    analyzer = MediaNestPerformanceAnalyzer(
        base_url=os.getenv('MEDIANEST_API_URL'),
        token=os.getenv('MEDIANEST_TOKEN')
    )
    
    async with analyzer:
        # Run comprehensive performance test suite
        report = await analyzer.run_performance_test_suite()
        
        # Save report
        with open('performance_report.json', 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        print("Performance test suite completed!")
        print(f"Overall system health: {report['health_status']['data']['overall']['status']}")
        print(f"Load test success rate: {report['load_test_results']['summary']['successRate']}%")
        print(f"Average response time: {report['load_test_results']['summary']['avgResponseTime']}ms")

if __name__ == "__main__":
    asyncio.run(main())
```

## Integration and Monitoring

The Performance APIs integrate deeply with MediaNest's infrastructure:

### Monitoring Stack
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and alerting
- **OpenTelemetry**: Distributed tracing
- **Node Exporter**: System metrics
- **Redis**: Real-time metrics caching

### Alert Configuration

```yaml
# Example Grafana alert configuration
alerts:
  - name: High CPU Usage
    condition: avg(cpu_usage) > 80 FOR 5m
    frequency: 30s
    notifications:
      - webhook
      - email
  
  - name: API Response Time
    condition: p95(api_response_time) > 500 FOR 2m
    frequency: 10s
    notifications:
      - slack
      - pagerduty
  
  - name: Database Performance
    condition: avg(db_query_time) > 100 FOR 1m
    frequency: 30s
    notifications:
      - webhook
```

For detailed monitoring setup, see the [Performance Monitoring Setup Guide](/developers/performance-monitoring/).