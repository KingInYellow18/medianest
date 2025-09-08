import { Server, Socket } from 'socket.io';

import { logger } from '@/utils/logger';
import { CatchError } from '../../types/common';

interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: any;
  actions?: {
    label: string;
    action: string;
    style?: 'primary' | 'secondary' | 'danger';
  }[];
  persistent?: boolean;
  expiresAt?: Date;
  createdAt: Date;
  readAt?: Date;
}

export function notificationHandlers(io: Server, socket: Socket): void {
  registerNotificationHandlers(io, socket);
}

export function registerNotificationHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.user?.id;

  if (!userId) {
    logger.warn('Notification handlers registered for unauthenticated socket');
    return;
  }

  // Join user's personal notification room
  socket.on('subscribe:notifications', () => {
    socket.join(`notifications:user:${userId}`);
    logger.info('User subscribed to notifications', { userId });

    // Send any pending notifications
    // TODO: Implement notification persistence and retrieval
    socket.emit('notifications:subscribed', {
      timestamp: new Date().toISOString(),
      pending: [], // TODO: Get pending notifications from database
    });
  });

  // Unsubscribe from notifications
  socket.on('unsubscribe:notifications', () => {
    socket.leave(`notifications:user:${userId}`);
    logger.info('User unsubscribed from notifications', { userId });
  });

  // Mark notification as read
  socket.on('notification:read', async (notificationId: string, callback) => {
    try {
      if (!notificationId) {
        if (callback) callback({ success: false, error: 'Notification ID is required' });
        return;
      }

      // TODO: Implement notification service in Phase 2
      logger.info('Marking notification as read', {
        notificationId,
        userId,
      });

      // For now, just acknowledge
      if (callback) {
        callback({ success: true });
      }

      socket.emit('notification:read:success', {
        id: notificationId,
        readAt: new Date().toISOString(),
      });
    } catch (error: CatchError) {
      logger.error('Failed to mark notification as read', {
        notificationId,
        userId,
        error: error instanceof Error ? error.message : ('Unknown error' as any),
      });

      if (callback) {
        callback({
          success: false,
          error: error instanceof Error ? error.message : ('Unknown error' as any),
        });
      }

      socket.emit('notification:read:error', {
        id: notificationId,
        error: error instanceof Error ? error.message : ('Unknown error' as any),
      });
    }
  });

  // Mark all notifications as read
  socket.on('notifications:read-all', async (callback) => {
    try {
      // TODO: Implement bulk read functionality
      logger.info('Marking all notifications as read', { userId });

      if (callback) {
        callback({ success: true, readCount: 0 }); // TODO: Return actual count
      }

      socket.emit('notifications:all-read', {
        timestamp: new Date().toISOString(),
      });
    } catch (error: CatchError) {
      logger.error('Failed to mark all notifications as read', {
        userId,
        error: error instanceof Error ? error.message : ('Unknown error' as any),
      });

      if (callback) {
        callback({
          success: false,
          error: error instanceof Error ? error.message : ('Unknown error' as any),
        });
      }
    }
  });

  // Dismiss notification (remove from UI without marking as read)
  socket.on('notification:dismiss', async (notificationId: string, callback) => {
    try {
      if (!notificationId) {
        if (callback) callback({ success: false, error: 'Notification ID is required' });
        return;
      }

      logger.debug('Dismissing notification', { notificationId, userId });

      if (callback) {
        callback({ success: true });
      }
    } catch (error: CatchError) {
      logger.error('Failed to dismiss notification', {
        notificationId,
        userId,
        error: error instanceof Error ? error.message : ('Unknown error' as any),
      });

      if (callback) {
        callback({
          success: false,
          error: error instanceof Error ? error.message : ('Unknown error' as any),
        });
      }
    }
  });

  // Get notification history
  socket.on(
    'notifications:history',
    async (options: { limit?: number; offset?: number } = {}, callback) => {
      try {
        const { limit = 50, offset = 0 } = options;

        // TODO: Implement notification history retrieval
        const history = {
          notifications: [], // TODO: Get from database
          total: 0,
          unread: 0,
          hasMore: false,
        };

        if (callback) {
          callback({ success: true, data: history });
        }
      } catch (error: CatchError) {
        logger.error('Failed to get notification history', {
          userId,
          error: error instanceof Error ? error.message : ('Unknown error' as any),
        });

        if (callback) {
          callback({
            success: false,
            error: error instanceof Error ? error.message : ('Unknown error' as any),
          });
        }
      }
    }
  );

  // Handle notification action (like "View" or "Retry")
  socket.on(
    'notification:action',
    async (data: { notificationId: string; action: string }, callback) => {
      try {
        const { notificationId, action } = data;

        if (!notificationId || !action) {
          if (callback)
            callback({ success: false, error: 'Notification ID and action are required' });
          return;
        }

        logger.info('Notification action triggered', {
          notificationId,
          action,
          userId,
        });

        // TODO: Implement action handling based on notification type
        // For now, just acknowledge
        if (callback) {
          callback({ success: true });
        }
      } catch (error: CatchError) {
        logger.error('Failed to handle notification action', {
          notificationId: data?.notificationId,
          action: data?.action,
          userId,
          error: error instanceof Error ? error.message : ('Unknown error' as any),
        });

        if (callback) {
          callback({
            success: false,
            error: error instanceof Error ? error.message : ('Unknown error' as any),
          });
        }
      }
    }
  );
}

// Helper function to send notification to user
export function sendNotificationToUser(
  io: Server,
  userId: string,
  notification: Omit<NotificationData, 'id' | 'createdAt'>
): void {
  const notificationData: NotificationData = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    ...notification,
  };

  // Send to user's notification room in notifications namespace
  io.of('/notifications')
    .to(`notifications:user:${userId}`)
    .emit('notification:new', notificationData);

  // Also send to main namespace for backward compatibility
  io.to(`user:${userId}`).emit('notification:new', notificationData);

  logger.info('Notification sent to user', {
    userId,
    notificationId: notificationData.id,
    type: notification.type,
    title: notification.title,
  });
}

// Helper function to send notification to multiple users
export function sendNotificationToUsers(
  io: Server,
  userIds: string[],
  notification: Omit<NotificationData, 'id' | 'createdAt'>
): void {
  userIds.forEach((userId) => {
    sendNotificationToUser(io, userId, notification);
  });
}

// Helper function to broadcast notification to role
export function broadcastNotificationToRole(
  io: Server,
  role: string,
  notification: Omit<NotificationData, 'id' | 'createdAt'>
): void {
  const notificationData: NotificationData = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    ...notification,
  };

  // Send to role room in main namespace
  io.to(`role:${role}`).emit('notification:new', notificationData);

  // Also send to notifications namespace
  io.of('/notifications').emit('notification:new', notificationData);

  logger.info('Notification broadcasted to role', {
    role,
    notificationId: notificationData.id,
    type: notification.type,
    title: notification.title,
  });
}

// Helper function to broadcast system-wide notification
export function broadcastSystemNotification(
  io: Server,
  notification: Omit<NotificationData, 'id' | 'createdAt'>
): void {
  const notificationData: NotificationData = {
    id: `sysnotif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    ...notification,
  };

  // Broadcast to all connected clients
  io.emit('notification:system', notificationData);

  // Also broadcast to all namespaces
  io.of('/notifications').emit('notification:system', notificationData);
  io.of('/status').emit('notification:system', notificationData);
  io.of('/downloads').emit('notification:system', notificationData);

  logger.info('System notification broadcasted', {
    notificationId: notificationData.id,
    type: notification.type,
    title: notification.title,
  });
}
