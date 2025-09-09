# Dashboard API

The MediaNest Dashboard API provides real-time system statistics, service status monitoring, and notification management for administrative oversight and user awareness.

## Overview

The Dashboard API offers:
- Real-time system statistics and performance metrics
- Service status monitoring and health checks
- User notification management
- System-wide activity summaries

All dashboard endpoints require authentication and implement performance-optimized caching.

## Base Endpoint

```
/api/v1/dashboard
```

## Dashboard Statistics

### Get Dashboard Stats

Retrieve comprehensive dashboard statistics including system overview, recent activity, and performance metrics.

```http
GET /api/v1/dashboard/stats
```

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Response

**Status:** `200 OK`
**Cache:** 5 minutes

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 45,
      "activeUsers": 23,
      "totalRequests": 1847,
      "pendingRequests": 12,
      "processingRequests": 3,
      "completedToday": 8,
      "systemUptime": "15d 8h 32m",
      "lastUpdate": "2024-01-01T12:30:00.000Z"
    },
    "mediaLibrary": {
      "totalMovies": 2156,
      "totalTvShows": 487,
      "totalEpisodes": 15423,
      "totalSize": "45.8 TB",
      "newAdditions": {
        "today": 5,
        "thisWeek": 32,
        "thisMonth": 127
      },
      "libraries": [
        {
          "id": "movies-4k",
          "name": "Movies (4K)",
          "type": "movie",
          "count": 856,
          "size": "18.2 TB"
        },
        {
          "id": "tv-shows",
          "name": "TV Shows", 
          "type": "tv",
          "count": 487,
          "size": "22.1 TB"
        }
      ]
    },
    "systemResources": {
      "cpu": {
        "usage": 15.6,
        "cores": 16,
        "load": [1.2, 1.8, 2.1],
        "temperature": 58.4
      },
      "memory": {
        "used": 12.8,
        "total": 32.0,
        "available": 19.2,
        "percentage": 40.0
      },
      "storage": [
        {
          "mount": "/data/media",
          "used": 41.2,
          "total": 50.0,
          "available": 8.8,
          "percentage": 82.4
        },
        {
          "mount": "/data/downloads",
          "used": 2.1,
          "total": 5.0,
          "available": 2.9,
          "percentage": 42.0
        }
      ],
      "network": {
        "bytesIn": 1048576000,
        "bytesOut": 524288000,
        "packetsIn": 1000000,
        "packetsOut": 800000
      }
    },
    "requestStats": {
      "byStatus": {
        "pending": 12,
        "approved": 8,
        "processing": 3,
        "completed": 1824,
        "failed": 5
      },
      "byType": {
        "movies": 1234,
        "tvShows": 618
      },
      "topRequesters": [
        {
          "username": "john_doe",
          "requests": 47,
          "completionRate": 91.5
        },
        {
          "username": "jane_smith",
          "requests": 32,
          "completionRate": 96.8
        }
      ],
      "recentActivity": [
        {
          "type": "request_completed",
          "title": "The Matrix",
          "user": "john_doe",
          "timestamp": "2024-01-01T12:15:00.000Z"
        },
        {
          "type": "request_submitted",
          "title": "Breaking Bad Season 6",
          "user": "jane_smith",
          "timestamp": "2024-01-01T12:10:00.000Z"
        }
      ]
    },
    "downloadActivity": {
      "active": 3,
      "queued": 7,
      "totalSpeed": "45.2 MB/s",
      "todayDownloaded": "127.6 GB",
      "activeDownloads": [
        {
          "id": "download-123",
          "title": "The Batman (2022)",
          "progress": 67.5,
          "speed": "25.6 MB/s",
          "eta": "00:42:15",
          "size": "12.4 GB"
        },
        {
          "id": "download-456",
          "title": "Stranger Things S04E09",
          "progress": 23.1,
          "speed": "19.6 MB/s",
          "eta": "01:28:33",
          "size": "2.8 GB"
        }
      ]
    },
    "performance": {
      "responseTime": {
        "api": 245,
        "database": 12,
        "plex": 890
      },
      "cacheHitRate": 87.3,
      "errorRate": 0.12,
      "requestsPerMinute": 156
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-stats-123",
    "cacheAge": 124,
    "nextUpdate": "2024-01-01T12:35:00.000Z"
  }
}
```

## Service Status

### Get All Service Statuses

Retrieve status information for all integrated services and system components.

```http
GET /api/v1/dashboard/status
```

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### Response

**Status:** `200 OK`
**Cache:** 1 minute

```json
{
  "success": true,
  "data": {
    "overall": {
      "status": "healthy",
      "uptime": "15d 8h 32m",
      "lastCheck": "2024-01-01T12:30:00.000Z",
      "healthScore": 95.2
    },
    "services": {
      "plex": {
        "status": "up",
        "responseTime": 890,
        "version": "1.32.7.7621",
        "url": "https://plex.example.com:32400",
        "lastCheck": "2024-01-01T12:30:00.000Z",
        "features": {
          "libraries": true,
          "transcoding": true,
          "remote_access": true
        },
        "stats": {
          "sessions": 3,
          "bandwidth": 12500000,
          "transcodingSessions": 1
        }
      },
      "overseerr": {
        "status": "up",
        "responseTime": 245,
        "version": "1.33.2",
        "url": "https://overseerr.example.com",
        "lastCheck": "2024-01-01T12:30:00.000Z",
        "stats": {
          "totalRequests": 1847,
          "pendingRequests": 12
        }
      },
      "database": {
        "status": "up",
        "responseTime": 12,
        "type": "PostgreSQL",
        "version": "15.3",
        "connections": {
          "active": 8,
          "idle": 12,
          "max": 100
        },
        "lastCheck": "2024-01-01T12:30:00.000Z"
      },
      "redis": {
        "status": "up",
        "responseTime": 3,
        "version": "7.0.11",
        "memory": {
          "used": 45.2,
          "peak": 67.8,
          "limit": 1024.0
        },
        "keyspace": {
          "keys": 1547,
          "expires": 892
        },
        "lastCheck": "2024-01-01T12:30:00.000Z"
      },
      "downloadClients": {
        "qbittorrent": {
          "status": "up",
          "responseTime": 156,
          "version": "4.5.4",
          "url": "https://qbittorrent.example.com",
          "stats": {
            "downloadSpeed": 45200000,
            "uploadSpeed": 12800000,
            "activeTorrents": 3,
            "queuedTorrents": 7
          },
          "lastCheck": "2024-01-01T12:30:00.000Z"
        }
      }
    },
    "systemHealth": {
      "disk": {
        "status": "warning",
        "usage": 82.4,
        "threshold": 85.0,
        "message": "Disk usage approaching threshold"
      },
      "memory": {
        "status": "healthy",
        "usage": 40.0,
        "threshold": 80.0
      },
      "cpu": {
        "status": "healthy",
        "usage": 15.6,
        "threshold": 70.0
      },
      "network": {
        "status": "healthy",
        "latency": 23.4,
        "threshold": 100.0
      }
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-status-123",
    "cacheAge": 45
  }
}
```

### Get Specific Service Status

Retrieve detailed status information for a specific service.

```http
GET /api/v1/dashboard/status/:service
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `service` | string | Yes | Service name (`plex`, `overseerr`, `database`, `redis`, etc.) |

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**URL:**
```
/api/v1/dashboard/status/plex
```

#### Response

**Status:** `200 OK`
**Cache:** 1 minute

```json
{
  "success": true,
  "data": {
    "service": "plex",
    "status": "up",
    "responseTime": 890,
    "version": "1.32.7.7621",
    "url": "https://plex.example.com:32400",
    "lastCheck": "2024-01-01T12:30:00.000Z",
    "uptime": "12d 15h 22m",
    "configuration": {
      "server_name": "MediaNest Plex Server",
      "machine_identifier": "abcd1234-efgh-5678-ijkl-9012mnop3456",
      "platform": "Linux",
      "platform_version": "Ubuntu 22.04.3 LTS"
    },
    "features": {
      "libraries": {
        "enabled": true,
        "count": 8,
        "lastScan": "2024-01-01T08:00:00.000Z"
      },
      "transcoding": {
        "enabled": true,
        "sessions": 1,
        "hwAcceleration": "enabled"
      },
      "remote_access": {
        "enabled": true,
        "publicUrl": "https://app.plex.tv/...",
        "mapping_state": "mapped"
      }
    },
    "libraries": [
      {
        "id": "1",
        "title": "Movies",
        "type": "movie",
        "count": 2156,
        "size": 23456789012,
        "lastScan": "2024-01-01T08:00:00.000Z"
      },
      {
        "id": "2", 
        "title": "TV Shows",
        "type": "show",
        "count": 487,
        "size": 18734567890,
        "lastScan": "2024-01-01T08:30:00.000Z"
      }
    ],
    "currentActivity": {
      "sessions": [
        {
          "sessionKey": "12345",
          "type": "episode",
          "title": "Breaking Bad - Pilot",
          "user": "john_doe",
          "player": "Plex Web",
          "state": "playing",
          "progress": 1245000,
          "transcoding": true
        }
      ],
      "totalBandwidth": 12500000,
      "transcodingSessions": 1
    },
    "performance": {
      "responseTime": {
        "min": 234,
        "max": 1456,
        "avg": 890,
        "p95": 1200
      },
      "requests": {
        "total": 15678,
        "successful": 15234,
        "failed": 444,
        "successRate": 97.2
      }
    },
    "alerts": [
      {
        "type": "warning",
        "message": "High transcoding load detected",
        "timestamp": "2024-01-01T12:15:00.000Z"
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-plex-status-123"
  }
}
```

## Notifications

### Get Notifications

Retrieve user notifications and system alerts.

```http
GET /api/v1/dashboard/notifications
```

#### Request

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
```
?unread=true&limit=50&type=system
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `unread` | boolean | No | Filter for unread notifications only |
| `limit` | number | No | Maximum notifications to return (default: 50) |
| `type` | enum | No | Notification type filter (`system`, `request`, `download`, `alert`) |

#### Response

**Status:** `200 OK`
**Cache:** No cache (real-time data)

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif-123",
        "type": "request_completed",
        "title": "Request Completed",
        "message": "Your request for 'The Matrix' has been completed and is now available.",
        "read": false,
        "priority": "normal",
        "createdAt": "2024-01-01T12:15:00.000Z",
        "data": {
          "requestId": "request-789",
          "mediaTitle": "The Matrix",
          "mediaType": "movie"
        },
        "actions": [
          {
            "type": "view",
            "label": "View in Plex",
            "url": "/plex/movie/the-matrix"
          }
        ]
      },
      {
        "id": "notif-456", 
        "type": "system_alert",
        "title": "Storage Warning",
        "message": "Media storage is 85% full. Consider adding more storage space.",
        "read": false,
        "priority": "high",
        "createdAt": "2024-01-01T11:30:00.000Z",
        "data": {
          "storageUsed": 42.5,
          "storageTotal": 50.0,
          "storagePercentage": 85.0
        },
        "actions": [
          {
            "type": "acknowledge",
            "label": "Acknowledge",
            "endpoint": "/api/v1/dashboard/notifications/notif-456/acknowledge"
          }
        ]
      },
      {
        "id": "notif-789",
        "type": "download_failed",
        "title": "Download Failed",
        "message": "Failed to download 'Stranger Things S04E10' after 3 attempts.",
        "read": true,
        "priority": "high",
        "createdAt": "2024-01-01T10:45:00.000Z",
        "readAt": "2024-01-01T11:00:00.000Z",
        "data": {
          "downloadId": "download-999",
          "mediaTitle": "Stranger Things S04E10",
          "error": "Connection timeout"
        },
        "actions": [
          {
            "type": "retry",
            "label": "Retry Download",
            "endpoint": "/api/v1/downloads/download-999/retry"
          }
        ]
      }
    ],
    "summary": {
      "total": 47,
      "unread": 23,
      "byType": {
        "system_alert": 8,
        "request_completed": 15,
        "download_failed": 3,
        "download_completed": 21
      },
      "byPriority": {
        "high": 11,
        "normal": 32,
        "low": 4
      }
    }
  },
  "metadata": {
    "timestamp": "2024-01-01T12:30:00.000Z",
    "requestId": "req-notifications-123"
  }
}
```

## Data Models

### Dashboard Statistics

```typescript
interface DashboardStats {
  overview: SystemOverview;
  mediaLibrary: MediaLibraryStats;
  systemResources: SystemResources;
  requestStats: RequestStatistics;
  downloadActivity: DownloadActivity;
  performance: PerformanceMetrics;
}

interface SystemOverview {
  totalUsers: number;
  activeUsers: number;
  totalRequests: number;
  pendingRequests: number;
  processingRequests: number;
  completedToday: number;
  systemUptime: string;
  lastUpdate: string;
}

interface MediaLibraryStats {
  totalMovies: number;
  totalTvShows: number;
  totalEpisodes: number;
  totalSize: string;
  newAdditions: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  libraries: LibraryInfo[];
}

interface LibraryInfo {
  id: string;
  name: string;
  type: 'movie' | 'tv';
  count: number;
  size: string;
}
```

### Service Status

```typescript
interface ServiceStatus {
  overall: OverallStatus;
  services: Record<string, ServiceInfo>;
  systemHealth: SystemHealthCheck;
}

interface ServiceInfo {
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  version?: string;
  url?: string;
  lastCheck: string;
  uptime?: string;
  stats?: Record<string, any>;
  alerts?: Alert[];
}

interface SystemHealthCheck {
  disk: HealthMetric;
  memory: HealthMetric;
  cpu: HealthMetric;
  network: HealthMetric;
}

interface HealthMetric {
  status: 'healthy' | 'warning' | 'critical';
  usage: number;
  threshold: number;
  message?: string;
}
```

### Notification

```typescript
interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
  createdAt: string;
  readAt?: string;
  data?: Record<string, any>;
  actions?: NotificationAction[];
}

type NotificationType = 
  | 'system_alert'
  | 'request_completed'
  | 'request_failed'
  | 'download_completed'
  | 'download_failed'
  | 'service_down'
  | 'service_restored';

interface NotificationAction {
  type: 'view' | 'acknowledge' | 'retry' | 'dismiss';
  label: string;
  url?: string;
  endpoint?: string;
}
```

## Performance Optimization

The Dashboard API implements several performance optimizations:

### Caching Strategy

- **Statistics**: 5-minute cache with background refresh
- **Service Status**: 1-minute cache with health check polling
- **Notifications**: Real-time (no cache) with efficient queries

### Response Headers

```
Cache-Control: max-age=300, public
X-Cache-Status: HIT
X-Cache-Age: 124
X-Response-Time: 23ms
```

### Background Jobs

- Service health checks run every 30 seconds
- Statistics aggregation runs every 5 minutes  
- Notification cleanup runs daily

## Error Handling

### Common Error Codes

| Code | Description | Status |
|------|-------------|---------|
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable | 503 |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions | 403 |
| `STATS_UNAVAILABLE` | Statistics temporarily unavailable | 503 |
| `INVALID_SERVICE` | Unknown service name | 404 |

## Rate Limiting

Dashboard API endpoints have generous rate limits due to caching:

- **Dashboard Stats**: 60 requests per minute per user
- **Service Status**: 120 requests per minute per user
- **Notifications**: 300 requests per minute per user

## Real-time Updates

For real-time dashboard updates, consider using WebSocket connections:

```javascript
const ws = new WebSocket('wss://api.medianest.com/ws/dashboard');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  
  switch (update.type) {
    case 'stats_update':
      updateDashboardStats(update.data);
      break;
    case 'service_status_change':
      updateServiceStatus(update.service, update.status);
      break;
    case 'new_notification':
      showNotification(update.notification);
      break;
  }
};
```