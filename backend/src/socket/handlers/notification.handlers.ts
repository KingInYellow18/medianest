import { Server, Socket } from 'socket.io';
import { logger } from '@/utils/logger';

export function notificationHandlers(io: Server, socket: Socket): void {
  // Join user's personal notification room
  socket.on('subscribe:notifications', () => {
    socket.join(`user:${socket.data.user.id}`);
    logger.info('User subscribed to notifications', {
      userId: socket.data.user.id,
    });
  });

  // Mark notification as read
  socket.on('notification:read', async (notificationId: string) => {
    try {
      // TODO: Implement notification service in Phase 2
      logger.info('Marking notification as read', {
        notificationId,
        userId: socket.data.user.id,
      });
      socket.emit('notification:read:success', notificationId);
    } catch (error: any) {
      socket.emit('notification:read:error', {
        id: notificationId,
        error: error.message,
      });
    }
  });
}