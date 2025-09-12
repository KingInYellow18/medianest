# Dashboard API Endpoints

The Dashboard API provides endpoints for retrieving system statistics, service status information, and user notifications.

## Overview

Dashboard endpoints provide real-time and cached data about system health, performance metrics, and user notifications. Different endpoints use different caching strategies based on data volatility.

**Base Path**: `/api/v1/dashboard`

## Caching Strategy

- **Stats**: 5-minute cache (medium volatility)
- **Service Status**: 1-minute cache (high volatility)
- **Notifications**: No cache (real-time data)

## Endpoints

### Get Dashboard Statistics

Get overall dashboard statistics and system metrics.

```http
GET /api/v1/dashboard/stats
```

#### Example Request

```bash
curl "http://localhost:3001/api/v1/dashboard/stats" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "totalRequests": 1247,
  "pendingRequests": 23,
  "completedRequests": 1198,
  "totalUsers": 156,
  "activeUsers": 42,
  "systemUptime": 2593847,
  "diskUsage": {
    "total": 2000000000000,
    "used": 1200000000000,
    "available": 800000000000
  },
  "memoryUsage": {
    "total": 16777216000,
    "used": 8388608000,
    "free": 8388608000
  }
}
```

#### Response Schema

| Field                 | Type    | Description                       |
| --------------------- | ------- | --------------------------------- |
| `totalRequests`       | integer | Total number of media requests    |
| `pendingRequests`     | integer | Number of pending requests        |
| `completedRequests`   | integer | Number of completed requests      |
| `totalUsers`          | integer | Total registered users            |
| `activeUsers`         | integer | Users active in last 24 hours     |
| `systemUptime`        | number  | System uptime in seconds          |
| `diskUsage`           | object  | Disk space information in bytes   |
| `diskUsage.total`     | number  | Total disk space                  |
| `diskUsage.used`      | number  | Used disk space                   |
| `diskUsage.available` | number  | Available disk space              |
| `memoryUsage`         | object  | Memory usage information in bytes |
| `memoryUsage.total`   | number  | Total system memory               |
| `memoryUsage.used`    | number  | Used memory                       |
| `memoryUsage.free`    | number  | Free memory                       |

---

### Get All Service Statuses

Get the current status of all monitored services.

```http
GET /api/v1/dashboard/status
```

#### Example Request

```bash
curl "http://localhost:3001/api/v1/dashboard/status" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
[
  {
    "id": "plex",
    "name": "Plex Media Server",
    "status": "up",
    "responseTime": 145,
    "lastChecked": "2023-12-01T10:30:00Z",
    "uptime": 99.8,
    "error": null
  },
  {
    "id": "overseerr",
    "name": "Overseerr",
    "status": "up",
    "responseTime": 89,
    "lastChecked": "2023-12-01T10:30:00Z",
    "uptime": 99.5,
    "error": null
  },
  {
    "id": "database",
    "name": "Database",
    "status": "up",
    "responseTime": 12,
    "lastChecked": "2023-12-01T10:30:00Z",
    "uptime": 100.0,
    "error": null
  },
  {
    "id": "redis",
    "name": "Redis Cache",
    "status": "degraded",
    "responseTime": 567,
    "lastChecked": "2023-12-01T10:30:00Z",
    "uptime": 95.2,
    "error": "High response time detected"
  }
]
```

#### Service Status Schema

| Field          | Type   | Description                                 |
| -------------- | ------ | ------------------------------------------- |
| `id`           | string | Unique service identifier                   |
| `name`         | string | Human-readable service name                 |
| `status`       | string | Service status: `up`, `down`, or `degraded` |
| `responseTime` | number | Response time in milliseconds               |
| `lastChecked`  | string | ISO timestamp of last health check          |
| `uptime`       | number | Uptime percentage (last 24 hours)           |
| `error`        | string | Error message if service has issues         |

---

### Get Specific Service Status

Get the current status of a specific service.

```http
GET /api/v1/dashboard/status/{service}
```

#### Parameters

| Parameter | Type   | Required | Description                                                |
| --------- | ------ | -------- | ---------------------------------------------------------- |
| `service` | string | Yes      | Service identifier (e.g., `plex`, `overseerr`, `database`) |

#### Example Request

```bash
curl "http://localhost:3001/api/v1/dashboard/status/plex" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "id": "plex",
  "name": "Plex Media Server",
  "status": "up",
  "responseTime": 145,
  "lastChecked": "2023-12-01T10:30:00Z",
  "uptime": 99.8,
  "error": null
}
```

---

### Get User Notifications

Get notifications for the current user.

```http
GET /api/v1/dashboard/notifications
```

#### Parameters

| Parameter | Type    | Required | Description                                            |
| --------- | ------- | -------- | ------------------------------------------------------ |
| `limit`   | integer | No       | Number of notifications to return (1-100, default: 20) |
| `unread`  | boolean | No       | Filter for unread notifications only                   |

#### Example Request

```bash
curl "http://localhost:3001/api/v1/dashboard/notifications?limit=5&unread=true" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "notifications": [
    {
      "id": "notif_1638360000_abc123def",
      "type": "success",
      "title": "Request Completed",
      "message": "Your request for 'The Matrix' has been completed successfully",
      "read": false,
      "persistent": false,
      "createdAt": "2023-12-01T10:00:00Z",
      "readAt": null
    },
    {
      "id": "notif_1638359400_def456ghi",
      "type": "info",
      "title": "System Maintenance",
      "message": "Scheduled maintenance will occur tonight from 2-4 AM EST",
      "read": false,
      "persistent": true,
      "createdAt": "2023-12-01T09:50:00Z",
      "readAt": null
    }
  ],
  "unreadCount": 2
}
```

#### Notification Schema

| Field        | Type    | Description                                              |
| ------------ | ------- | -------------------------------------------------------- |
| `id`         | string  | Unique notification identifier                           |
| `type`       | string  | Notification type: `info`, `success`, `warning`, `error` |
| `title`      | string  | Notification title                                       |
| `message`    | string  | Notification message                                     |
| `read`       | boolean | Whether notification has been read                       |
| `persistent` | boolean | Whether notification persists until dismissed            |
| `createdAt`  | string  | ISO timestamp when notification was created              |
| `readAt`     | string  | ISO timestamp when notification was read                 |

## Status Codes

| Status | Description           |
| ------ | --------------------- |
| `200`  | Success               |
| `401`  | Unauthorized          |
| `404`  | Service not found     |
| `500`  | Internal server error |

## Error Responses

### Service Not Found (404)

```json
{
  "error": "Not Found",
  "message": "Service 'unknown-service' not found"
}
```

### Unauthorized (401)

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

## Real-time Updates

Dashboard data supports real-time updates via WebSocket connections:

### Service Status Updates

```javascript
// Subscribe to all service status updates
socket.emit('subscribe:status');

// Listen for status changes
socket.on('service:status', (update) => {
  console.log(`Service ${update.serviceId} is ${update.status}`);
});

// Subscribe to specific service
socket.emit('subscribe:service', 'plex');
socket.on('service:plex:update', (update) => {
  console.log('Plex status update:', update);
});
```

### Notification Updates

```javascript
// Subscribe to notifications
socket.emit('subscribe:notifications');

// Listen for new notifications
socket.on('notification:new', (notification) => {
  console.log('New notification:', notification.title);
});
```

See [WebSocket Documentation](../websocket.md) for complete event details.

## Monitoring Services

The following services are monitored by default:

| Service ID  | Name              | Description                |
| ----------- | ----------------- | -------------------------- |
| `plex`      | Plex Media Server | Media server connectivity  |
| `overseerr` | Overseerr         | Request management service |
| `database`  | Database          | PostgreSQL database health |
| `redis`     | Redis Cache       | Cache service health       |
| `tmdb`      | TMDB API          | Movie database API         |

## Performance Metrics

### System Metrics

- **CPU Usage**: Current CPU utilization percentage
- **Memory Usage**: RAM usage statistics
- **Disk Usage**: Storage space utilization
- **Network I/O**: Network traffic metrics
- **Uptime**: System uptime in seconds

### Application Metrics

- **Request Count**: Total and recent API requests
- **Response Time**: Average API response times
- **Error Rate**: API error percentage
- **Active Sessions**: Currently authenticated users
- **Queue Length**: Pending background jobs

## Caching Behavior

### Stats Endpoint

- **Cache Duration**: 5 minutes
- **Cache Key**: `dashboard:stats:${userId}`
- **Invalidation**: Automatic after cache expiry
- **Headers**: `Cache-Control: private, max-age=300`

### Status Endpoints

- **Cache Duration**: 1 minute
- **Cache Key**: `dashboard:status:all` or `dashboard:status:${serviceId}`
- **Invalidation**: Automatic and on service state change
- **Headers**: `Cache-Control: private, max-age=60`

### Notifications

- **Cache Duration**: None (real-time)
- **Invalidation**: Immediate
- **Headers**: `Cache-Control: no-cache, no-store`

## Admin Features

Admin users have additional capabilities:

### Refresh Service Status

```javascript
// Admin can force refresh all services
socket.emit('admin:refresh-status');
```

### Service History

```javascript
// Get historical data for a service
socket.emit('service:history', 'plex', 24, (response) => {
  console.log('Service history:', response.data);
});
```

## Integration Notes

### External Services

- Service health checks run every 30 seconds
- Timeouts configured per service type
- Retry logic for transient failures
- Circuit breaker pattern for failing services

### Alerting

- Critical service failures trigger notifications
- Admin users receive system alerts
- Webhook integration available for external alerting

### Historical Data

- Service status history stored for 30 days
- Metrics aggregated hourly for reporting
- Export functionality for historical analysis
