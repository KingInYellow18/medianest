import { Server, Socket } from 'socket.io';
import { logger } from '@/utils/logger';
import { statusService } from '@/services/status.service';
import { userRepository } from '@/repositories';

interface AdminBroadcastData {
  type: 'announcement' | 'maintenance' | 'warning' | 'info';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  expiresAt?: Date;
  targetUsers?: string[];
  targetRoles?: string[];
}

interface SystemStatusData {
  services: {
    id: string;
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
    lastError?: string;
  }[];
  systemHealth: {
    memory: number;
    cpu: number;
    disk: number;
    uptime: number;
  };
  activeConnections: number;
  timestamp: string;
}

export function registerAdminHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.user?.id;
  const userRole = socket.data.user?.role;

  if (userRole !== 'admin') {
    logger.warn('Non-admin user attempted to register admin handlers', { userId });
    return;
  }

  logger.info('Registering admin handlers', { userId, socketId: socket.id });

  // Broadcast message to all users or specific groups
  socket.on('admin:broadcast', async (data: AdminBroadcastData, callback) => {
    try {
      logger.info('Admin broadcasting message', {
        adminId: userId,
        type: data.type,
        priority: data.priority,
        hasTargetUsers: !!data.targetUsers?.length,
        hasTargetRoles: !!data.targetRoles?.length,
      });

      const broadcastMessage = {
        id: `broadcast_${Date.now()}`,
        type: data.type,
        title: data.title,
        message: data.message,
        priority: data.priority,
        fromAdmin: socket.data.user?.email,
        timestamp: new Date().toISOString(),
        expiresAt: data.expiresAt?.toISOString(),
      };

      // Determine target rooms
      const targetRooms: string[] = [];

      if (data.targetUsers?.length) {
        // Target specific users
        data.targetUsers.forEach((userId) => {
          targetRooms.push(`user:${userId}`);
        });
      } else if (data.targetRoles?.length) {
        // Target specific roles
        data.targetRoles.forEach((role) => {
          targetRooms.push(`role:${role}`);
        });
      } else {
        // Broadcast to all users (main namespace)
        io.emit('admin:broadcast:message', broadcastMessage);

        // Also broadcast to all namespaces
        io.of('/status').emit('admin:broadcast:message', broadcastMessage);
        io.of('/downloads').emit('admin:broadcast:message', broadcastMessage);
        io.of('/notifications').emit('admin:broadcast:message', broadcastMessage);

        if (callback) {
          callback({ success: true, messageId: broadcastMessage.id });
        }
        return;
      }

      // Send to specific rooms
      let sentCount = 0;
      for (const room of targetRooms) {
        const sockets = await io.in(room).fetchSockets();
        if (sockets.length > 0) {
          io.to(room).emit('admin:broadcast:message', broadcastMessage);
          sentCount += sockets.length;
        }
      }

      if (callback) {
        callback({
          success: true,
          messageId: broadcastMessage.id,
          recipientCount: sentCount,
        });
      }
    } catch (error: any) {
      logger.error('Failed to broadcast admin message', {
        adminId: userId,
        error: error.message as any,
      });

      if (callback) {
        callback({ success: false, error: error.message as any });
      }
    }
  });

  // Force refresh all service statuses
  socket.on('admin:refresh:all-services', async (callback) => {
    try {
      logger.info('Admin requesting full service refresh', { adminId: userId });

      // Refresh all services
      const statuses = await statusService.refreshAllStatuses();

      // Broadcast to all status namespace subscribers
      io.of('/status').to('status-updates').emit('status:bulk-update', statuses);

      // Also broadcast to main namespace
      io.to('status-updates').emit('status:bulk-update', statuses);

      if (callback) {
        callback({ success: true, serviceCount: statuses.length });
      }
    } catch (error: any) {
      logger.error('Failed to refresh all services', {
        adminId: userId,
        error: error.message as any,
      });

      if (callback) {
        callback({ success: false, error: error.message as any });
      }
    }
  });

  // Get system overview data
  socket.on('admin:system:overview', async (callback) => {
    try {
      const statuses = await statusService.getAllStatuses();
      const activeConnections = await io.fetchSockets();

      const systemStatus: SystemStatusData = {
        services: statuses.map((service) => ({
          id: service.id,
          status: service.status,
          responseTime: service.responseTime || undefined,
          lastError: service.error || undefined,
        })),
        systemHealth: {
          memory: process.memoryUsage().heapUsed / 1024 / 1024, // MB
          cpu: process.cpuUsage().user / 1000000, // seconds
          disk: 0, // TODO: implement disk usage
          uptime: process.uptime(),
        },
        activeConnections: activeConnections.length,
        timestamp: new Date().toISOString(),
      };

      if (callback) {
        callback({ success: true, data: systemStatus });
      }
    } catch (error: any) {
      logger.error('Failed to get system overview', {
        adminId: userId,
        error: error.message as any,
      });

      if (callback) {
        callback({ success: false, error: error.message as any });
      }
    }
  });

  // Get connected users information
  socket.on('admin:users:connected', async (callback) => {
    try {
      const sockets = await io.fetchSockets();
      const connectedUsers = sockets
        .map((s) => ({
          socketId: s.id,
          userId: s.data.user?.id,
          userEmail: s.data.user?.email,
          userRole: s.data.user?.role,
          connectedAt: s.data.connectedAt,
          rooms: Array.from(s.rooms).filter((room) => room !== s.id),
        }))
        .filter((user) => user.userId); // Only authenticated users

      if (callback) {
        callback({
          success: true,
          data: {
            totalConnections: sockets.length,
            authenticatedUsers: connectedUsers.length,
            users: connectedUsers,
          },
        });
      }
    } catch (error: any) {
      logger.error('Failed to get connected users', {
        adminId: userId,
        error: error.message as any,
      });

      if (callback) {
        callback({ success: false, error: error.message as any });
      }
    }
  });

  // Force disconnect user
  socket.on('admin:user:disconnect', async (targetUserId: string, callback) => {
    try {
      logger.info('Admin forcing user disconnect', {
        adminId: userId,
        targetUserId,
      });

      const sockets = await io.fetchSockets();
      const userSockets = sockets.filter((s) => s.data.user?.id === targetUserId);

      let disconnectedCount = 0;
      for (const userSocket of userSockets) {
        userSocket.emit('admin:force-disconnect', {
          reason: 'Disconnected by administrator',
          adminId: userId,
          timestamp: new Date().toISOString(),
        });
        userSocket.disconnect(true);
        disconnectedCount++;
      }

      if (callback) {
        callback({
          success: true,
          disconnectedSockets: disconnectedCount,
        });
      }
    } catch (error: any) {
      logger.error('Failed to disconnect user', {
        adminId: userId,
        targetUserId,
        error: error.message as any,
      });

      if (callback) {
        callback({ success: false, error: error.message as any });
      }
    }
  });

  // Subscribe to admin activity feed
  socket.on('admin:subscribe:activity', () => {
    socket.join('admin-activity');
    logger.debug('Admin subscribed to activity feed', { adminId: userId });
  });

  // Unsubscribe from admin activity feed
  socket.on('admin:unsubscribe:activity', () => {
    socket.leave('admin-activity');
    logger.debug('Admin unsubscribed from activity feed', { adminId: userId });
  });
}

// Helper function to emit admin activity
export function emitAdminActivity(
  io: Server,
  activity: {
    type: 'user_action' | 'system_event' | 'error' | 'warning';
    description: string;
    userId?: string;
    metadata?: Record<string, any>;
  },
): void {
  io.of('/admin')
    .to('admin-activity')
    .emit('admin:activity', {
      ...activity,
      timestamp: new Date().toISOString(),
      id: `activity_${Date.now()}`,
    });
}
