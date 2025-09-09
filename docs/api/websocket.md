# WebSocket Events Documentation

MediaNest provides real-time updates through WebSocket connections using Socket.IO. This enables live updates for media request status, service health monitoring, and user notifications.

## Connection

### Endpoint
```
ws://localhost:3001
```
or
```
wss://api.medianest.io
```

### Authentication
WebSocket connections require authentication via JWT tokens:

```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'your-jwt-token-here'
  }
});
```

### Connection Events

#### Client Connection
```javascript
socket.on('connect', () => {
  console.log('Connected to MediaNest WebSocket');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

#### Reconnection Handling
```javascript
socket.on('client:reconnection-confirmed', (data) => {
  console.log('Reconnection confirmed:', data.timestamp);
});

// Notify server of reconnection
socket.emit('client:reconnected', {
  previousSocketId: 'old-socket-id',
  disconnectedFor: 30000 // milliseconds
});
```

## Namespaces

MediaNest uses multiple Socket.IO namespaces for different types of events:

| Namespace | Purpose |
|-----------|---------|
| `/` (default) | General events, authentication |
| `/notifications` | User notifications |
| `/status` | Service status updates |
| `/requests` | Media request updates |
| `/downloads` | Download progress events |

### Connecting to Namespaces

```javascript
const notificationsSocket = io('/notifications', { auth: { token } });
const statusSocket = io('/status', { auth: { token } });
```

## Event Categories

### 1. Connection Management

#### Ping/Pong Heartbeat
```javascript
// Client sends ping
socket.emit('client:ping', Date.now(), (response) => {
  console.log('Server response time:', response.latency, 'ms');
});

// Server response includes:
// { timestamp: 1638360000000, latency: 45, serverId: 'socket-123' }
```

#### Connection Quality Check
```javascript
socket.emit('connection:quality-check', (response) => {
  if (response.success) {
    console.log('Connection quality:', response.responseTime, 'ms');
  }
});
```

### 2. Media Request Events

#### Subscribe to Request Updates
```javascript
// Subscribe to specific request
socket.emit('subscribe:request', requestId);

// Subscribe to all user requests
socket.emit('subscribe:user-requests');

// Listen for status updates
socket.on(`request:${requestId}:status`, (update) => {
  console.log('Request status update:', {
    requestId: update.requestId,
    status: update.status,
    progress: update.progress,
    message: update.message
  });
});
```

#### Request Status Update Schema
```typescript
interface RequestStatusUpdate {
  requestId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number; // 0-100
  message?: string;
  data?: any;
  error?: string;
  updatedAt: Date;
}
```

#### Request Management
```javascript
// Cancel a request
socket.emit('request:cancel', requestId, (response) => {
  if (response.success) {
    console.log('Request cancelled successfully');
  }
});

// Retry a failed request
socket.emit('request:retry', requestId, (response) => {
  if (response.success) {
    console.log('Request retry initiated');
  }
});

// Get request history
socket.emit('requests:history', { limit: 20, offset: 0 }, (response) => {
  if (response.success) {
    console.log('Request history:', response.data);
  }
});
```

#### Unsubscribe from Request Updates
```javascript
socket.emit('unsubscribe:request', requestId);
socket.emit('unsubscribe:user-requests');
```

### 3. Service Status Events

#### Subscribe to Service Status
```javascript
// Subscribe to all service status updates
socket.emit('subscribe:status');

// Subscribe to specific service
socket.emit('subscribe:service', 'plex');

// Listen for status updates
socket.on('status:current', (statuses) => {
  statuses.forEach(status => {
    console.log(`${status.name}: ${status.status}`);
  });
});

socket.on('service:status', (update) => {
  console.log('Service update:', {
    serviceId: update.serviceId,
    status: update.status,
    responseTime: update.responseTime
  });
});
```

#### Service Status Schema
```typescript
interface ServiceStatusUpdate {
  serviceId: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
  timestamp: string;
}
```

#### Admin Service Management
```javascript
// Admin: Refresh all service statuses
socket.emit('admin:refresh-status');

// Admin: Get service history
socket.emit('service:history', 'plex', 24, (response) => {
  if (response.success) {
    console.log('Service history:', response.data);
  }
});
```

#### System Alerts
```javascript
socket.on('system:alert', (alert) => {
  console.log('System alert:', {
    type: alert.type, // 'warning' | 'error' | 'info'
    title: alert.title,
    message: alert.message,
    serviceId: alert.serviceId
  });
});
```

### 4. Notification Events

#### Subscribe to Notifications
```javascript
// Subscribe to user notifications
socket.emit('subscribe:notifications');

// Listen for new notifications
socket.on('notification:new', (notification) => {
  console.log('New notification:', {
    id: notification.id,
    type: notification.type, // 'info' | 'success' | 'warning' | 'error'
    title: notification.title,
    message: notification.message
  });
});

// System-wide notifications
socket.on('notification:system', (notification) => {
  console.log('System notification:', notification);
});
```

#### Notification Schema
```typescript
interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: any;
  actions?: Array<{
    label: string;
    action: string;
    style?: 'primary' | 'secondary' | 'danger';
  }>;
  persistent?: boolean;
  expiresAt?: Date;
  createdAt: Date;
  readAt?: Date;
}
```

#### Notification Management
```javascript
// Mark notification as read
socket.emit('notification:read', notificationId, (response) => {
  if (response.success) {
    console.log('Notification marked as read');
  }
});

// Mark all notifications as read
socket.emit('notifications:read-all', (response) => {
  console.log('Marked', response.readCount, 'notifications as read');
});

// Dismiss notification
socket.emit('notification:dismiss', notificationId);

// Handle notification action
socket.emit('notification:action', {
  notificationId: 'notif_123',
  action: 'view'
}, (response) => {
  if (response.success) {
    console.log('Action handled successfully');
  }
});

// Get notification history
socket.emit('notifications:history', { limit: 50, offset: 0 }, (response) => {
  if (response.success) {
    console.log('Notification history:', response.data);
  }
});
```

### 5. Download Events

#### Subscribe to Download Updates
```javascript
// These events are emitted by the server for download progress
socket.on('download:progress', (data) => {
  console.log('Download progress:', {
    id: data.id,
    title: data.title,
    progress: data.progress, // 0-100
    speed: data.speed,
    eta: data.eta
  });
});

socket.on('download:complete', (data) => {
  console.log('Download complete:', {
    id: data.id,
    title: data.title,
    path: data.path,
    size: data.size
  });
});

socket.on('download:failed', (data) => {
  console.log('Download failed:', {
    id: data.id,
    title: data.title,
    error: data.error
  });
});
```

### 6. YouTube Download Events (Legacy)

#### YouTube Download Schema
```typescript
interface YouTubeDownloadEvent {
  id: string;
  title: string;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed';
  progress?: number;
  downloadSpeed?: string;
  eta?: string;
  error?: string;
}
```

### 7. Admin Events

Admin users have access to additional events:

#### Admin Activity Monitoring
```javascript
// Admin activity events (automatically emitted for admin actions)
socket.on('admin:activity', (activity) => {
  console.log('Admin activity:', {
    action: activity.action,
    userId: activity.userId,
    details: activity.details
  });
});
```

## Error Handling

### Connection Errors
```javascript
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
  
  if (error.message === 'Authentication failed') {
    // Refresh token and retry
    refreshAuthToken().then(newToken => {
      socket.auth.token = newToken;
      socket.connect();
    });
  }
});
```

### Event Errors
```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Most events support callback error handling
socket.emit('some:event', data, (response) => {
  if (!response.success) {
    console.error('Event failed:', response.error);
  }
});
```

## Rate Limiting

WebSocket events are rate-limited to prevent abuse:

- **Connection attempts**: 5 per minute
- **Event emissions**: 100 per minute per connection
- **Admin events**: 10 per minute (e.g., `admin:refresh-status`)

Rate limit exceeded responses:
```json
{
  "success": false,
  "error": "Rate limited - wait before trying again",
  "code": "RATE_LIMITED",
  "retryAfter": 30
}
```

## Best Practices

### Connection Management
```javascript
// Reconnection with exponential backoff
const socket = io('http://localhost:3001', {
  auth: { token: getAuthToken() },
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 5
});
```

### Memory Management
```javascript
// Clean up event listeners
socket.off('notification:new');

// Or remove all listeners for an event
socket.removeAllListeners('service:status');

// Disconnect when done
socket.disconnect();
```

### Subscription Management
```javascript
class SocketManager {
  constructor() {
    this.subscriptions = new Set();
  }

  subscribeToRequest(requestId) {
    if (!this.subscriptions.has(`request:${requestId}`)) {
      socket.emit('subscribe:request', requestId);
      this.subscriptions.add(`request:${requestId}`);
    }
  }

  cleanup() {
    this.subscriptions.forEach(sub => {
      const [type, id] = sub.split(':');
      socket.emit(`unsubscribe:${type}`, id);
    });
    this.subscriptions.clear();
  }
}
```

## Integration Examples

### React Hook for WebSocket
```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function useSocket(token) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const newSocket = io('http://localhost:3001', {
      auth: { token }
    });

    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => setConnected(false));

    setSocket(newSocket);

    return () => newSocket.close();
  }, [token]);

  return { socket, connected };
}

// Usage in component
function MediaRequests() {
  const { socket, connected } = useSocket(authToken);

  useEffect(() => {
    if (!socket || !connected) return;

    socket.emit('subscribe:user-requests');

    socket.on('request:status', (update) => {
      // Update UI with request status
      updateRequestStatus(update);
    });

    return () => {
      socket.emit('unsubscribe:user-requests');
      socket.off('request:status');
    };
  }, [socket, connected]);

  return <div>...</div>;
}
```

### Service Status Monitor
```javascript
class ServiceStatusMonitor {
  constructor(socket) {
    this.socket = socket;
    this.services = new Map();
  }

  start() {
    this.socket.emit('subscribe:status');

    this.socket.on('status:current', (statuses) => {
      statuses.forEach(status => {
        this.services.set(status.id, status);
      });
      this.updateUI();
    });

    this.socket.on('service:status', (update) => {
      this.services.set(update.serviceId, {
        ...this.services.get(update.serviceId),
        ...update
      });
      this.updateUI();
    });
  }

  updateUI() {
    // Update dashboard with current service statuses
    this.services.forEach((status, serviceId) => {
      document.getElementById(`status-${serviceId}`)
        .className = `status-${status.status}`;
    });
  }
}
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Ensure JWT token is valid and not expired
   - Check token format in auth header

2. **Connection Timeouts**
   - Verify server is running and accessible
   - Check firewall settings for WebSocket traffic

3. **Missing Events**
   - Confirm subscription to event types
   - Check if user has required permissions

4. **High Memory Usage**
   - Remove event listeners when components unmount
   - Limit number of concurrent subscriptions

### Debug Mode
```javascript
// Enable debug logging
localStorage.debug = 'socket.io-client:socket';

// Or for all socket.io logs
localStorage.debug = 'socket.io-client:*';
```