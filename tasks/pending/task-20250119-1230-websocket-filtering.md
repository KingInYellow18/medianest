# Task: WebSocket Event Filtering for Monitor Visibility

## Task ID

task-20250119-1230-websocket-filtering

## Status

- [ ] Not Started
- [ ] In Progress
- [ ] Testing
- [ ] Completed

## Priority

P1 (High)

## Description

Implement role-based WebSocket event filtering to ensure that real-time status updates respect monitor visibility settings. This system will create separate event streams for admin and regular users, ensuring that sensitive monitor information is only broadcast to authorized users while maintaining real-time functionality.

## Acceptance Criteria

### WebSocket Room Management

- [ ] Separate socket rooms for admin and regular users
- [ ] Automatic room assignment based on user role
- [ ] Dynamic room switching when user roles change
- [ ] Proper cleanup when users disconnect
- [ ] Room membership validation for security

### Event Filtering

- [ ] Status updates filtered by monitor visibility before broadcast
- [ ] Admin users receive all monitor events
- [ ] Regular users receive only public monitor events
- [ ] Bulk status updates respect filtering rules
- [ ] Service discovery events properly filtered

### Real-time Functionality

- [ ] Immediate visibility change reflection across connected clients
- [ ] Admin visibility changes trigger filtered broadcasts
- [ ] Service status changes broadcast to appropriate audiences
- [ ] Connection state management with role awareness
- [ ] Efficient event distribution to minimize server load

### Security & Performance

- [ ] Validate user permissions before joining rooms
- [ ] Prevent unauthorized access to admin events
- [ ] Efficient filtering to avoid performance degradation
- [ ] Rate limiting for WebSocket events
- [ ] Audit logging for security events

## Technical Requirements

### WebSocket Room Architecture

#### Room Structure

```typescript
// Room naming convention
const ROOMS = {
  ADMIN: 'admin',
  USERS: 'users',
  AUTHENTICATED: 'authenticated', // Base room for all authenticated users
  SERVICE_SPECIFIC: (serviceName: string) => `service:${serviceName}`,
  USER_SPECIFIC: (userId: number) => `user:${userId}`,
} as const;
```

#### Enhanced Socket Handler

```typescript
// backend/src/socket/handlers/status.handler.ts (major updates)
export class StatusHandler {
  constructor(
    private io: Server,
    private statusService: StatusService,
    private monitorVisibilityService: MonitorVisibilityService,
    private logger: Logger,
  ) {}

  async handleConnection(socket: Socket, user: User): Promise<void> {
    try {
      // Join base authenticated room
      await socket.join(ROOMS.AUTHENTICATED);

      // Join role-specific room
      const roleRoom = user.role === 'ADMIN' ? ROOMS.ADMIN : ROOMS.USERS;
      await socket.join(roleRoom);

      // Join user-specific room for targeted messages
      await socket.join(ROOMS.USER_SPECIFIC(user.id));

      // Store user context in socket
      socket.data.user = user;
      socket.data.rooms = [ROOMS.AUTHENTICATED, roleRoom, ROOMS.USER_SPECIFIC(user.id)];

      // Send initial filtered status
      await this.sendInitialStatus(socket, user);

      // Set up event handlers
      this.setupEventHandlers(socket, user);

      this.logger.info('User connected to WebSocket', {
        userId: user.id,
        role: user.role,
        rooms: socket.data.rooms,
      });
    } catch (error) {
      this.logger.error('Failed to handle WebSocket connection', {
        userId: user.id,
        error: error.message,
      });
      socket.disconnect();
    }
  }

  async handleDisconnection(socket: Socket): Promise<void> {
    const user = socket.data.user;
    if (user) {
      this.logger.info('User disconnected from WebSocket', {
        userId: user.id,
        rooms: socket.data.rooms,
      });
    }
  }

  async handleRoleChange(userId: number, newRole: string): Promise<void> {
    // Find all sockets for this user
    const userSockets = await this.io.in(ROOMS.USER_SPECIFIC(userId)).fetchSockets();

    for (const socket of userSockets) {
      // Leave old role room
      const oldRoleRoom = socket.data.user.role === 'ADMIN' ? ROOMS.ADMIN : ROOMS.USERS;
      await socket.leave(oldRoleRoom);

      // Join new role room
      const newRoleRoom = newRole === 'ADMIN' ? ROOMS.ADMIN : ROOMS.USERS;
      await socket.join(newRoleRoom);

      // Update socket data
      socket.data.user.role = newRole;
      socket.data.rooms = socket.data.rooms.map((room) =>
        room === oldRoleRoom ? newRoleRoom : room,
      );

      // Send updated initial status
      await this.sendInitialStatus(socket, socket.data.user);
    }

    this.logger.info('User role changed, updated WebSocket rooms', {
      userId,
      newRole,
    });
  }

  private async sendInitialStatus(socket: Socket, user: User): Promise<void> {
    const filteredStatuses = await this.statusService.getFilteredStatuses(user.role);
    socket.emit('service:status:initial', {
      statuses: filteredStatuses,
      timestamp: new Date().toISOString(),
      filtered: user.role !== 'ADMIN',
    });
  }

  private setupEventHandlers(socket: Socket, user: User): void {
    // Handle manual status refresh requests
    socket.on('service:status:refresh', async () => {
      await this.sendInitialStatus(socket, user);
    });

    // Handle subscription to specific services (with permission check)
    socket.on('service:subscribe', async (serviceName: string) => {
      const hasAccess = await this.statusService.canAccessService(serviceName, user.role);
      if (hasAccess) {
        await socket.join(ROOMS.SERVICE_SPECIFIC(serviceName));
        socket.emit('service:subscribed', { serviceName });
      } else {
        socket.emit('service:subscription:denied', { serviceName });
      }
    });

    socket.on('service:unsubscribe', async (serviceName: string) => {
      await socket.leave(ROOMS.SERVICE_SPECIFIC(serviceName));
      socket.emit('service:unsubscribed', { serviceName });
    });
  }
}
```

### Enhanced Status Broadcasting

```typescript
// backend/src/services/status.service.ts (WebSocket integration)
export class StatusService {
  constructor(
    // ... existing dependencies
    private io: Server,
  ) {}

  private async broadcastStatusUpdate(status: ServiceStatus): Promise<void> {
    try {
      // Determine which users should receive this update
      const monitorId = this.getMonitorIdForService(status.serviceName);

      if (monitorId) {
        const isPublic = await this.monitorVisibilityService.isMonitorPublic(monitorId);

        if (isPublic) {
          // Broadcast to all authenticated users
          this.io.to(ROOMS.AUTHENTICATED).emit('service:status', status);
        } else {
          // Only broadcast to admin users
          this.io.to(ROOMS.ADMIN).emit('service:status', status);
        }

        // Also broadcast to service-specific subscribers (with implicit permission)
        this.io.to(ROOMS.SERVICE_SPECIFIC(status.serviceName)).emit('service:status', status);
      } else {
        // If no monitor ID mapping, assume it's public (backward compatibility)
        this.io.to(ROOMS.AUTHENTICATED).emit('service:status', status);
      }
    } catch (error) {
      this.logger.error('Failed to broadcast status update', {
        serviceName: status.serviceName,
        error: error.message,
      });
    }
  }

  async broadcastVisibilityChange(monitorId: string, isPublic: boolean): Promise<void> {
    try {
      const monitor = await this.monitorVisibilityService.getMonitorById(monitorId);
      if (!monitor) return;

      const serviceName = this.getServiceNameForMonitor(monitor.monitorName);
      if (!serviceName) return;

      if (isPublic) {
        // Monitor became public - send current status to all users
        const status = await this.getServiceStatus(serviceName);
        this.io.to(ROOMS.AUTHENTICATED).emit('service:status', status);
      } else {
        // Monitor became private - send removal event to regular users
        this.io.to(ROOMS.USERS).emit('service:removed', {
          serviceName,
          reason: 'visibility_changed',
        });
      }

      // Notify admins of visibility change
      this.io.to(ROOMS.ADMIN).emit('monitor:visibility:changed', {
        monitorId,
        monitorName: monitor.monitorName,
        isPublic,
        serviceName,
      });
    } catch (error) {
      this.logger.error('Failed to broadcast visibility change', {
        monitorId,
        isPublic,
        error: error.message,
      });
    }
  }
}
```

### Monitor Discovery Broadcasting

```typescript
// backend/src/services/monitor-visibility.service.ts (WebSocket integration)
export class MonitorVisibilityService {
  async broadcastMonitorDiscovery(newMonitors: MonitorWithVisibility[]): Promise<void> {
    if (newMonitors.length === 0) return;

    // Separate public and admin-only monitors
    const publicMonitors = newMonitors.filter((m) => m.isPublic);
    const adminOnlyMonitors = newMonitors.filter((m) => !m.isPublic);

    // Broadcast public monitors to all users
    if (publicMonitors.length > 0) {
      this.io.to(ROOMS.AUTHENTICATED).emit('monitors:discovered', {
        monitors: publicMonitors,
        count: publicMonitors.length,
      });
    }

    // Broadcast all monitors to admins
    this.io.to(ROOMS.ADMIN).emit('monitors:discovered', {
      monitors: newMonitors,
      count: newMonitors.length,
      breakdown: {
        public: publicMonitors.length,
        adminOnly: adminOnlyMonitors.length,
      },
    });
  }

  async broadcastMonitorRemoval(removedMonitorIds: string[]): Promise<void> {
    if (removedMonitorIds.length === 0) return;

    // Get monitor details before removal
    const monitors = await Promise.all(
      removedMonitorIds.map((id) => this.repository.findByMonitorId(id)),
    );

    const validMonitors = monitors.filter(Boolean) as MonitorVisibility[];

    // Broadcast removal to appropriate audiences
    for (const monitor of validMonitors) {
      const serviceName = this.statusService.getServiceNameForMonitor(monitor.monitorName);

      if (monitor.isPublic && serviceName) {
        // Notify all users about public service removal
        this.io.to(ROOMS.AUTHENTICATED).emit('service:removed', {
          serviceName,
          monitorName: monitor.monitorName,
          reason: 'monitor_removed',
        });
      }

      // Notify admins about any monitor removal
      this.io.to(ROOMS.ADMIN).emit('monitor:removed', {
        monitorId: monitor.monitorId,
        monitorName: monitor.monitorName,
        wasPublic: monitor.isPublic,
      });
    }
  }
}
```

## Files to Modify/Create

### Backend WebSocket Updates

- `backend/src/socket/handlers/status.handler.ts` - Enhanced room management and filtering
- `backend/src/socket/rooms.ts` - Room constants and utilities
- `backend/src/services/status.service.ts` - Add WebSocket broadcasting with filtering
- `backend/src/services/monitor-visibility.service.ts` - Add WebSocket event broadcasting

### Frontend WebSocket Client Updates

```typescript
// frontend/src/lib/hooks/useWebSocket.ts (major updates)
export function useWebSocket() {
  const { user } = useAuth();
  const [connectionState, setConnectionState] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('disconnected');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;

    const socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      auth: {
        token: getAuthToken(),
      },
    });

    socket.on('connect', () => {
      setConnectionState('connected');
      // Socket automatically joins appropriate rooms based on server-side user role
    });

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
    });

    // Handle initial status with filtering info
    socket.on(
      'service:status:initial',
      (data: { statuses: ServiceStatus[]; timestamp: string; filtered: boolean }) => {
        // Update dashboard with initial filtered data
        updateServiceStatuses(data.statuses);
        setIsFiltered(data.filtered);
      },
    );

    // Handle real-time status updates
    socket.on('service:status', (status: ServiceStatus) => {
      updateServiceStatus(status);
    });

    // Handle service removal (for visibility changes)
    socket.on('service:removed', (data: { serviceName: string; reason: string }) => {
      removeServiceFromDashboard(data.serviceName);
    });

    // Admin-only events
    if (user.role === 'ADMIN') {
      socket.on('monitor:visibility:changed', (data) => {
        handleVisibilityChange(data);
      });

      socket.on('monitors:discovered', (data) => {
        handleNewMonitorsDiscovered(data);
      });

      socket.on('monitor:removed', (data) => {
        handleMonitorRemoved(data);
      });
    }

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  return {
    socket: socketRef.current,
    connectionState,
    isConnected: connectionState === 'connected',
  };
}
```

## Testing Strategy

### Unit Tests

```typescript
// backend/src/socket/__tests__/status.handler.test.ts
describe('StatusHandler WebSocket Filtering', () => {
  describe('Room Management', () => {
    it('should assign users to correct rooms based on role');
    it('should handle role changes correctly');
    it('should clean up rooms on disconnect');
  });

  describe('Event Filtering', () => {
    it('should broadcast public monitor events to all users');
    it('should broadcast admin-only events to admin room only');
    it('should handle visibility changes correctly');
  });

  describe('Security', () => {
    it('should validate user permissions before room assignment');
    it('should prevent unauthorized access to admin events');
    it('should handle authentication failures gracefully');
  });
});
```

### Integration Tests

```typescript
// backend/src/socket/__tests__/filtering.integration.test.ts
describe('WebSocket Filtering Integration', () => {
  it('should filter events correctly across multiple connected users');
  it('should handle admin visibility changes in real-time');
  it('should maintain consistency between HTTP API and WebSocket events');
  it('should handle monitor discovery and removal events');
});
```

### E2E Tests

```typescript
// frontend/e2e/websocket/filtering.spec.ts
describe('WebSocket Filtering E2E', () => {
  it('should show different real-time updates based on user role');
  it('should handle admin making monitors public/private in real-time');
  it('should maintain connection and filtering across role changes');
  it('should handle multiple users with different roles simultaneously');
});
```

## Security Considerations

### Room Security

- Validate user role before allowing room joins
- Regularly audit room memberships
- Prevent room enumeration attacks
- Implement rate limiting for room operations

### Event Security

- Validate event data before broadcasting
- Prevent event injection attacks
- Audit all admin-level events
- Implement event size limits

### Connection Security

- Validate JWT tokens on connection and periodically
- Handle token expiration gracefully
- Prevent unauthorized reconnections
- Log security-related events

## Performance Considerations

### Efficient Broadcasting

- Use Redis adapter for horizontal scaling
- Implement event batching for bulk operations
- Cache room memberships for faster lookups
- Optimize message serialization

### Memory Management

- Clean up disconnected socket references
- Implement connection pooling limits
- Monitor room membership growth
- Garbage collect unused event handlers

## Progress Log

### 2025-01-19 12:30 - Task Created

- Designed comprehensive WebSocket room architecture
- Planned role-based event filtering system
- Created security measures for real-time communications
- Defined testing strategy for complex WebSocket interactions

## Related Tasks

- Depends on: task-20250119-1210-backend-monitor-visibility-service
- Depends on: task-20250119-1225-dashboard-filtering-updates
- Blocks: task-20250119-1235-testing-integration
- Related: All frontend and backend visibility tasks

## Notes

### Architecture Decisions

1. **Room-based Filtering**: Use Socket.io rooms for efficient event targeting
2. **Security First**: Validate permissions at multiple levels
3. **Real-time Consistency**: Ensure WebSocket events match HTTP API responses
4. **Scalability**: Design for horizontal scaling with Redis adapter

### Performance Optimizations

- Use room-based broadcasting to minimize unnecessary events
- Batch multiple status updates when possible
- Implement efficient serialization for large datasets
- Cache monitor visibility status for faster filtering

### Error Handling

- Graceful degradation when WebSocket connection fails
- Fallback to HTTP polling for critical updates
- Proper error messages for connection issues
- Automatic reconnection with exponential backoff

### Future Enhancements

- WebSocket event compression for large monitor lists
- Custom event priorities for critical alerts
- User-specific monitor subscriptions
- Advanced room management for monitor groups
- Webhook integration for external monitoring systems
