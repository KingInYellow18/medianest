# MediaNest WebSocket API Reference

**Version:** 1.0.0  
**Socket.IO Version:** 4.8.1  
**Base URL:** `ws://localhost:4000`

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Namespaces](#namespaces)
- [Connection Setup](#connection-setup)
- [Event Types](#event-types)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)
- [Best Practices](#best-practices)

## Overview

MediaNest uses Socket.IO for real-time communication between the client and server. The WebSocket API provides live updates for media requests, system status, notifications, and administrative events.

### Key Features
- **Real-time Updates** - Live status updates for media requests
- **System Monitoring** - Service health and performance metrics
- **User Notifications** - Instant notifications for important events
- **Admin Dashboard** - Real-time admin metrics and alerts
- **Media Progress** - Download and processing progress updates

## Authentication

WebSocket connections require authentication using the same JWT tokens as the REST API. The token is automatically sent via cookies when establishing the connection.

### Authentication Flow
1. Authenticate via REST API to get JWT token
2. Token is stored in httpOnly cookie
3. Socket.IO connection automatically includes cookie
4. Server validates JWT and assigns user to appropriate rooms

## Namespaces

MediaNest uses multiple Socket.IO namespaces to organize different types of events:

### `/` (Root Namespace)
**Access Level:** Public  
**Purpose:** General system events and health checks

### `/authenticated`  
**Access Level:** Authenticated users only  
**Purpose:** User-specific events and notifications

### `/admin`
**Access Level:** Admin users only  
**Purpose:** Administrative events and system management

### `/media`
**Access Level:** Authenticated users  
**Purpose:** Media-related events (requests, downloads, etc.)

### `/system`
**Access Level:** Admin users  
**Purpose:** System monitoring and performance metrics

## Connection Setup

### JavaScript/TypeScript Client
```javascript
import io from 'socket.io-client';

// Connect to main namespace
const socket = io('http://localhost:4000', {
  withCredentials: true,
  transports: ['websocket', 'polling']
});

// Connect to authenticated namespace
const authSocket = io('http://localhost:4000/authenticated', {
  withCredentials: true
});

// Connect to admin namespace (admin users only)
const adminSocket = io('http://localhost:4000/admin', {
  withCredentials: true
});
```

### Connection Events
```javascript
socket.on('connect', () => {
  console.log('Connected to MediaNest');
});

socket.on('connect_error', (error) => {
  console.error('Connection failed:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

## Event Types

### System Events (Root Namespace)

#### `system:health`
System health status updates.

**Frequency:** Every 30 seconds  
**Data:**
```json
{
  "timestamp": "2025-01-15T12:00:00.000Z",
  "status": "healthy",
  "services": {
    "database": "online",
    "redis": "online",
    "plex": "online"
  },
  "metrics": {
    "uptime": 3600,
    "memory": "256MB",
    "cpu": "15%"
  }
}
```

#### `system:status`
Service status changes.

**Frequency:** On status change  
**Data:**
```json
{
  "service": "plex",
  "previousStatus": "online",
  "currentStatus": "offline",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "reason": "Connection timeout",
  "impact": "Media requests temporarily disabled"
}
```

### User Events (Authenticated Namespace)

#### `user:notification`
User-specific notifications.

**Frequency:** On event occurrence  
**Data:**
```json
{
  "id": "notification-uuid",
  "type": "media_request_approved",
  "title": "Media Request Approved",
  "message": "Your request for 'Inception' has been approved",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "metadata": {
    "requestId": "request-uuid",
    "mediaType": "movie",
    "tmdbId": "27205"
  },
  "actions": [
    {
      "label": "View Details",
      "url": "/requests/request-uuid"
    }
  ]
}
```

#### `user:session`
Session-related events.

**Frequency:** On session events  
**Data:**
```json
{
  "event": "token_refresh",
  "expiresAt": "2025-01-16T12:00:00.000Z",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

### Media Events (Media Namespace)

#### `media:request:status`
Media request status updates.

**Frequency:** On status change  
**Data:**
```json
{
  "requestId": "request-uuid",
  "userId": "user-uuid",
  "previousStatus": "pending",
  "currentStatus": "approved",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "request": {
    "title": "Inception",
    "mediaType": "movie",
    "tmdbId": "27205"
  },
  "approvedBy": "admin-user-id",
  "estimatedCompletion": "2025-01-15T18:00:00.000Z"
}
```

#### `media:download:progress`
Media download progress updates.

**Frequency:** Every 5 seconds during download  
**Data:**
```json
{
  "requestId": "request-uuid",
  "downloadId": "download-uuid",
  "progress": {
    "percentage": 45.2,
    "downloadedBytes": 1024000000,
    "totalBytes": 2265678000,
    "speed": "5.2 MB/s",
    "eta": "00:03:45"
  },
  "currentFile": "Inception.2010.1080p.BluRay.x264.mkv",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

#### `media:plex:sync`
Plex library sync events.

**Frequency:** During library sync  
**Data:**
```json
{
  "event": "sync_started",
  "libraryId": "1",
  "libraryName": "Movies",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

#### `media:search:result`
Real-time search results (for instant search).

**Frequency:** As user types (debounced)  
**Data:**
```json
{
  "query": "incep",
  "results": [
    {
      "id": "movie-27205",
      "title": "Inception",
      "type": "movie",
      "year": 2010,
      "match": 0.95
    }
  ],
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

### Admin Events (Admin Namespace)

#### `admin:user:activity`
User activity monitoring.

**Frequency:** On user actions  
**Data:**
```json
{
  "userId": "user-uuid",
  "username": "johndoe",
  "action": "media_request_submitted",
  "details": {
    "requestId": "request-uuid",
    "mediaTitle": "Inception",
    "mediaType": "movie"
  },
  "timestamp": "2025-01-15T12:00:00.000Z",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

#### `admin:system:alert`
System alerts and warnings.

**Frequency:** On alert conditions  
**Data:**
```json
{
  "id": "alert-uuid",
  "severity": "warning",
  "category": "performance",
  "title": "High Memory Usage",
  "message": "System memory usage is above 80%",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "metrics": {
    "memoryUsage": 85.4,
    "threshold": 80.0
  },
  "recommendations": [
    "Consider restarting services",
    "Check for memory leaks"
  ]
}
```

#### `admin:service:performance`
Service performance metrics.

**Frequency:** Every 60 seconds  
**Data:**
```json
{
  "timestamp": "2025-01-15T12:00:00.000Z",
  "services": [
    {
      "name": "database",
      "responseTime": 15,
      "throughput": 150,
      "errorRate": 0.001,
      "connections": 12
    },
    {
      "name": "plex",
      "responseTime": 234,
      "throughput": 45,
      "errorRate": 0.02,
      "connections": 3
    }
  ]
}
```

### System Events (System Namespace)

#### `system:metrics`
Detailed system metrics.

**Frequency:** Every 30 seconds  
**Data:**
```json
{
  "timestamp": "2025-01-15T12:00:00.000Z",
  "cpu": {
    "usage": 25.5,
    "cores": 8,
    "loadAverage": [1.2, 1.5, 1.8]
  },
  "memory": {
    "total": 16777216000,
    "used": 8388608000,
    "free": 8388608000,
    "percentage": 50.0
  },
  "disk": {
    "total": 1000000000000,
    "used": 500000000000,
    "free": 500000000000,
    "percentage": 50.0
  },
  "network": {
    "bytesReceived": 1048576,
    "bytesSent": 2097152,
    "packetsReceived": 1024,
    "packetsSent": 2048
  }
}
```

#### `system:logs`
Real-time log streaming.

**Frequency:** On log events  
**Data:**
```json
{
  "timestamp": "2025-01-15T12:00:00.000Z",
  "level": "info",
  "service": "media-service",
  "message": "Media request processed successfully",
  "correlationId": "req-abc123",
  "metadata": {
    "userId": "user-uuid",
    "requestId": "request-uuid",
    "duration": 1250
  }
}
```

## Error Handling

### Connection Errors
```javascript
socket.on('connect_error', (error) => {
  console.error('Socket connection failed:', error.message);
  
  if (error.message === 'Authentication failed') {
    // Redirect to login
    window.location.href = '/login';
  }
});
```

### Event Errors
```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
  
  // Handle specific error types
  switch (error.code) {
    case 'UNAUTHORIZED':
      // Handle unauthorized access
      break;
    case 'RATE_LIMITED':
      // Handle rate limiting
      break;
    default:
      // Handle general errors
      break;
  }
});
```

### Automatic Reconnection
```javascript
const socket = io('http://localhost:4000', {
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});
```

## Code Examples

### React Hook for Socket Management
```typescript
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

export const useSocket = (namespace = '/') => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(`http://localhost:4000${namespace}`, {
      withCredentials: true
    });

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [namespace]);

  return { socket, connected };
};
```

### Media Request Status Component
```typescript
import React, { useEffect, useState } from 'react';
import { useSocket } from './hooks/useSocket';

interface MediaRequest {
  id: string;
  title: string;
  status: string;
}

const MediaRequestTracker: React.FC<{ requestId: string }> = ({ requestId }) => {
  const { socket } = useSocket('/media');
  const [request, setRequest] = useState<MediaRequest | null>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('media:request:status', (data) => {
      if (data.requestId === requestId) {
        setRequest(prev => ({
          ...prev,
          ...data.request,
          status: data.currentStatus
        }));
      }
    });

    return () => {
      socket.off('media:request:status');
    };
  }, [socket, requestId]);

  if (!request) return <div>Loading...</div>;

  return (
    <div className="request-tracker">
      <h3>{request.title}</h3>
      <div className={`status status-${request.status}`}>
        Status: {request.status}
      </div>
    </div>
  );
};
```

### Admin Dashboard Real-time Metrics
```typescript
import React, { useEffect, useState } from 'react';
import { useSocket } from './hooks/useSocket';

const AdminDashboard: React.FC = () => {
  const { socket } = useSocket('/admin');
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('admin:service:performance', (data) => {
      setMetrics(data);
    });

    socket.on('admin:system:alert', (alert) => {
      setAlerts(prev => [alert, ...prev.slice(0, 9)]); // Keep last 10 alerts
    });

    return () => {
      socket.off('admin:service:performance');
      socket.off('admin:system:alert');
    };
  }, [socket]);

  return (
    <div className="admin-dashboard">
      <div className="metrics-section">
        <h2>Service Performance</h2>
        {metrics?.services.map(service => (
          <div key={service.name} className="service-metric">
            <span>{service.name}</span>
            <span>{service.responseTime}ms</span>
            <span>{(service.errorRate * 100).toFixed(2)}%</span>
          </div>
        ))}
      </div>

      <div className="alerts-section">
        <h2>System Alerts</h2>
        {alerts.map(alert => (
          <div key={alert.id} className={`alert alert-${alert.severity}`}>
            <strong>{alert.title}</strong>
            <p>{alert.message}</p>
            <small>{new Date(alert.timestamp).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Best Practices

### Connection Management
- **Single Connection Per Namespace**: Avoid creating multiple connections to the same namespace
- **Proper Cleanup**: Always disconnect sockets when components unmount
- **Error Handling**: Implement comprehensive error handling for all connection states

### Event Handling
```javascript
// ✅ Good: Specific event handlers
socket.on('media:request:status', handleRequestStatus);
socket.on('user:notification', handleNotification);

// ❌ Avoid: Generic catch-all handlers
socket.onAny((event, data) => {
  // Hard to maintain and debug
});
```

### Performance Optimization
```javascript
// ✅ Good: Debounce frequent events
const debouncedHandler = debounce((data) => {
  updateUI(data);
}, 100);

socket.on('media:search:result', debouncedHandler);

// ✅ Good: Unsubscribe when not needed
useEffect(() => {
  if (isVisible) {
    socket.on('media:download:progress', handleProgress);
  } else {
    socket.off('media:download:progress', handleProgress);
  }
}, [isVisible]);
```

### Security Considerations
- **Authentication**: Ensure proper JWT token validation
- **Rate Limiting**: Implement client-side rate limiting for frequent events
- **Data Validation**: Always validate incoming socket data
- **CORS Configuration**: Properly configure CORS for WebSocket connections

### Error Recovery
```javascript
const handleConnectionError = (error) => {
  console.error('Socket error:', error);
  
  // Implement exponential backoff
  const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
  
  setTimeout(() => {
    socket.connect();
    retryCount++;
  }, retryDelay);
};
```

## Testing WebSocket Connections

### Browser Developer Tools
1. Open Network tab
2. Filter by WS (WebSocket)
3. Monitor connection status and messages

### Socket.IO Client Tool
```bash
npm install -g socket.io-client-tool
sioc http://localhost:4000 --namespace /authenticated
```

### Automated Testing
```javascript
// Jest + Socket.IO testing
import { io } from 'socket.io-client';

describe('Socket.IO Events', () => {
  let socket;

  beforeAll((done) => {
    socket = io('http://localhost:4000', {
      withCredentials: true
    });
    socket.on('connect', done);
  });

  afterAll(() => {
    socket.close();
  });

  it('should receive user notifications', (done) => {
    socket.on('user:notification', (data) => {
      expect(data).toHaveProperty('type');
      expect(data).toHaveProperty('message');
      done();
    });

    // Trigger notification somehow
    triggerNotification();
  });
});
```

---

## Connection Limits & Performance

- **Max Connections Per User**: 10
- **Max Connections Per IP**: 100
- **Heartbeat Interval**: 25 seconds
- **Heartbeat Timeout**: 60 seconds
- **Max Event Listeners**: 50 per socket

## WebSocket URLs

| Environment | URL |
|------------|-----|
| Development | `ws://localhost:4000` |
| Staging | `wss://staging-api.medianest.app` |
| Production | `wss://api.medianest.app` |

---

**Last Updated:** January 15, 2025  
**WebSocket API Version:** 1.0.0  
**Documentation Version:** 1.0.0