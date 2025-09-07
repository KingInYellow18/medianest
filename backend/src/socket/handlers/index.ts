import { Server, Socket } from 'socket.io';

import { logger } from '@/utils/logger';
import { notificationHandlers } from './notification.handlers';
import { requestHandlers } from './request.handlers';
import { statusHandlers } from './status.handlers';
import { registerYouTubeHandlers } from './youtube.handler';
import { registerDownloadHandlers } from './download.handlers';
import { registerAdminHandlers } from './admin.handlers';
import { CatchError } from '../types/common';

export function registerHandlers(io: Server, socket: Socket): void {
  // Service status subscriptions
  statusHandlers(io, socket);

  // User notifications
  notificationHandlers(io, socket);

  // Media request status updates
  requestHandlers(io, socket);

  // YouTube download events (legacy handler)
  registerYouTubeHandlers(io, socket);

  // Enhanced download handlers
  registerDownloadHandlers(io, socket);

  // Admin-only handlers (only registered for admin users)
  if (socket.data.user?.role === 'admin') {
    registerAdminHandlers(io, socket);
  }

  // Connection management handlers
  registerConnectionHandlers(io, socket);
}

/**
 * Register connection management and heartbeat handlers
 */
function registerConnectionHandlers(io: Server, socket: Socket): void {
  // Client heartbeat/ping
  socket.on('client:ping', (timestamp, callback) => {
    const serverTime = Date.now();
    const latency = serverTime - (timestamp || serverTime);

    if (typeof callback === 'function') {
      callback({
        timestamp: serverTime,
        latency,
        serverId: socket.id,
      });
    }
  });

  // Connection quality check
  socket.on('connection:quality-check', async (callback) => {
    try {
      const start = Date.now();

      // Simulate some async work to measure response time
      await new Promise((resolve) => setTimeout(resolve, 1));

      const responseTime = Date.now() - start;

      if (callback) {
        callback({
          success: true,
          responseTime,
          timestamp: new Date().toISOString(),
          serverId: socket.id,
          roomCount: socket.rooms.size,
        });
      }
    } catch (error: CatchError) {
      if (callback) {
        callback({
          success: false,
          error: error instanceof Error ? error.message : ('Unknown error' as any),
        });
      }
    }
  });

  // Client reconnection handling
  socket.on('client:reconnected', (data) => {
    logger.info('Client reconnected', {
      userId: socket.data.user?.id,
      socketId: socket.id,
      previousSocketId: data?.previousSocketId,
      disconnectedFor: data?.disconnectedFor,
    });

    // Re-join necessary rooms
    const userId = socket.data.user?.id;
    if (userId) {
      socket.join(`user:${userId}`);
      if (socket.data.user?.role) {
        socket.join(`role:${socket.data.user.role}`);
      }
    }

    // Emit reconnection confirmation
    socket.emit('client:reconnection-confirmed', {
      timestamp: new Date().toISOString(),
      serverId: socket.id,
    });
  });
}

// Export all handler registration functions for namespace use
export {
  notificationHandlers,
  statusHandlers,
  requestHandlers,
  registerYouTubeHandlers,
  registerDownloadHandlers,
  registerAdminHandlers,
};

// Export helper functions
export { broadcastServiceUpdate, broadcastSystemAlert } from './status.handlers';

export {
  sendNotificationToUser,
  sendNotificationToUsers,
  broadcastNotificationToRole,
  broadcastSystemNotification,
} from './notification.handlers';

export {
  emitDownloadProgress,
  emitDownloadComplete,
  emitDownloadFailure,
} from './download.handlers';

export { emitAdminActivity } from './admin.handlers';

export { emitRequestStatusUpdate } from './request.handlers';
