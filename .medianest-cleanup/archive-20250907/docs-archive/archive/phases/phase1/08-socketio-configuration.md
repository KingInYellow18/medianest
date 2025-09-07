# Task: Configure Socket.io Server

**Priority:** High  
**Estimated Duration:** 1 day  
**Dependencies:** Express server must be running  
**Phase:** 1 (Week 4)

## Objective

Set up Socket.io server with JWT authentication, implement room-based subscriptions, and prepare for real-time service status updates in Phase 2.

## Background

Socket.io is installed but not configured. This is needed for real-time updates from Uptime Kuma and other services. Must integrate with existing JWT authentication.

## Detailed Requirements

### 1. Socket.io Server Initialization

```typescript
// backend/src/socket/index.ts
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { authenticateSocket } from './middleware';
import { registerHandlers } from './handlers';
import { logger } from '@/utils/logger';

export function initializeSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // JWT authentication middleware
  io.use(authenticateSocket);

  // Connection handling
  io.on('connection', (socket: Socket) => {
    logger.info('Client connected', {
      userId: socket.data.user?.id,
      socketId: socket.id,
    });

    // Register event handlers
    registerHandlers(io, socket);

    socket.on('disconnect', () => {
      logger.info('Client disconnected', {
        userId: socket.data.user?.id,
        socketId: socket.id,
      });
    });

    socket.on('error', (error) => {
      logger.error('Socket error', {
        error: error.message,
        userId: socket.data.user?.id,
      });
    });
  });

  return io;
}
```

### 2. Socket Authentication Middleware

```typescript
// backend/src/socket/middleware.ts
import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import jwt from 'jsonwebtoken';
import { userService } from '@/services/user.service';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export async function authenticateSocket(
  socket: Socket,
  next: (err?: ExtendedError) => void
): Promise<void> {
  try {
    const token =
      socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    // Verify JWT
    const decoded = jwt.verify(token, config.jwt.secret) as any;

    // Get user from database
    const user = await userService.findById(decoded.userId);

    if (!user || user.status !== 'active') {
      return next(new Error('User not found or inactive'));
    }

    // Attach user to socket
    socket.data.user = {
      id: user.id,
      role: user.role,
      email: user.email,
    };

    next();
  } catch (error) {
    logger.error('Socket authentication failed', { error });
    next(new Error('Authentication failed'));
  }
}
```

### 3. Event Handlers

```typescript
// backend/src/socket/handlers/index.ts
import { Server, Socket } from 'socket.io';
import { statusHandlers } from './status.handlers';
import { notificationHandlers } from './notification.handlers';

export function registerHandlers(io: Server, socket: Socket): void {
  // Service status subscriptions
  statusHandlers(io, socket);

  // User notifications
  notificationHandlers(io, socket);

  // Future: YouTube download progress, media request updates, etc.
}
```

### 4. Status Update Handlers

```typescript
// backend/src/socket/handlers/status.handlers.ts
import { Server, Socket } from 'socket.io';
import { logger } from '@/utils/logger';

export function statusHandlers(io: Server, socket: Socket): void {
  // Subscribe to service status updates
  socket.on('subscribe:status', async () => {
    socket.join('status-updates');
    logger.info('User subscribed to status updates', {
      userId: socket.data.user.id,
    });

    // Send current status immediately
    socket.emit('status:current', await getServiceStatuses());
  });

  // Unsubscribe from status updates
  socket.on('unsubscribe:status', () => {
    socket.leave('status-updates');
    logger.info('User unsubscribed from status updates', {
      userId: socket.data.user.id,
    });
  });

  // Admin-only: Force status refresh
  socket.on('admin:refresh-status', async () => {
    if (socket.data.user.role !== 'admin') {
      return socket.emit('error', { message: 'Unauthorized' });
    }

    // Trigger status refresh (to be implemented in Phase 2)
    io.to('status-updates').emit('status:refreshing');
  });
}
```

### 5. Notification Handlers

```typescript
// backend/src/socket/handlers/notification.handlers.ts
export function notificationHandlers(io: Server, socket: Socket): void {
  // Join user's personal notification room
  socket.on('subscribe:notifications', () => {
    socket.join(`user:${socket.data.user.id}`);
  });

  // Mark notification as read
  socket.on('notification:read', async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId, socket.data.user.id);
      socket.emit('notification:read:success', notificationId);
    } catch (error) {
      socket.emit('notification:read:error', {
        id: notificationId,
        error: error.message,
      });
    }
  });
}
```

### 6. Socket Service for Emitting Events

```typescript
// backend/src/services/socket.service.ts
import { Server } from 'socket.io';

let io: Server | null = null;

export const socketService = {
  initialize(socketServer: Server): void {
    io = socketServer;
  },

  // Emit to all clients in a room
  emitToRoom(room: string, event: string, data: any): void {
    if (!io) {
      console.warn('Socket.io not initialized');
      return;
    }
    io.to(room).emit(event, data);
  },

  // Emit to specific user
  emitToUser(userId: string, event: string, data: any): void {
    this.emitToRoom(`user:${userId}`, event, data);
  },

  // Broadcast service status update
  broadcastStatusUpdate(service: string, status: any): void {
    this.emitToRoom('status-updates', 'service:status', {
      service,
      status,
      timestamp: new Date().toISOString(),
    });
  },

  // Send notification to user
  sendNotification(userId: string, notification: any): void {
    this.emitToUser(userId, 'notification:new', notification);
  },
};
```

### 7. Update Server Initialization

```typescript
// backend/src/index.ts
import { createServer } from 'http';
import { initializeSocketServer } from './socket';
import { socketService } from './services/socket.service';

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.io
const io = initializeSocketServer(httpServer);
socketService.initialize(io);

// Start server
httpServer.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Close Socket.io connections
  io.close(() => {
    logger.info('Socket.io connections closed');
  });

  // Close HTTP server
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
```

### 8. Frontend Socket Client

```typescript
// frontend/src/lib/socket/client.ts
import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;

  connect(token: string): void {
    if (this.socket?.connected) return;

    this.socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.socket?.emit('subscribe:status');
      this.socket?.emit('subscribe:notifications');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  on(event: string, handler: (...args: any[]) => void): void {
    this.socket?.on(event, handler);
  }

  emit(event: string, ...args: any[]): void {
    this.socket?.emit(event, ...args);
  }
}

export const socketClient = new SocketClient();
```

## Technical Implementation Details

### Socket.io Namespaces (Future)

```typescript
// For future organization of different feature areas
const statusNamespace = io.of('/status');
const mediaNamespace = io.of('/media');
const youtubeNamespace = io.of('/youtube');
```

### Rate Limiting for Socket Events

```typescript
// backend/src/socket/middleware/rate-limit.ts
const socketRateLimiter = new Map<string, number[]>();

export function rateLimitSocket(event: string, limit: number, window: number) {
  return (socket: Socket, next: (err?: Error) => void) => {
    const key = `${socket.data.user.id}:${event}`;
    const now = Date.now();
    const timestamps = socketRateLimiter.get(key) || [];

    // Remove old timestamps
    const validTimestamps = timestamps.filter((t) => now - t < window);

    if (validTimestamps.length >= limit) {
      return next(new Error('Rate limit exceeded'));
    }

    validTimestamps.push(now);
    socketRateLimiter.set(key, validTimestamps);
    next();
  };
}
```

## Acceptance Criteria

1. ✅ Socket.io server initializes with Express HTTP server
2. ✅ JWT authentication works for socket connections
3. ✅ Clients can subscribe to status updates room
4. ✅ Socket service can emit events to rooms and users
5. ✅ Proper error handling and logging
6. ✅ Graceful shutdown closes socket connections
7. ✅ Frontend client connects and authenticates
8. ✅ Reconnection logic works on connection loss

## Testing Requirements

1. **Unit Tests:**

   - Socket authentication middleware
   - Event handler logic
   - Socket service methods

2. **Integration Tests:**
   - Full socket connection flow
   - Authentication success/failure
   - Room subscription/unsubscription
   - Event emission and reception

## Security Considerations

- JWT validation on every connection
- Rate limiting for socket events
- Input validation for all socket events
- No sensitive data in socket payloads

## Dependencies

- `socket.io` - Already installed
- `socket.io-client` - For frontend

## References

- [Socket.io Documentation](https://socket.io/docs/v4/)
- [Socket.io with JWT](https://socket.io/docs/v4/middlewares/#sending-credentials)

## Status

- [ ] Not Started
- [ ] In Progress
- [x] Completed
- [ ] Blocked

## Implementation Notes

- Socket.io server configured with JWT authentication
- Implemented authentication middleware for socket connections
- Created handler structure for status and notification events
- CORS configured for frontend connection
- Supports both WebSocket and polling transports
