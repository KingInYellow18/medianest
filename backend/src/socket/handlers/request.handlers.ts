import { Server, Socket } from 'socket.io';

import { logger } from '@/utils/logger';

export function requestHandlers(io: Server, socket: Socket): void {
  // Subscribe to request updates
  socket.on('subscribe:request', (requestId: string) => {
    if (!requestId) {
      socket.emit('error', { message: 'Request ID is required' });
      return;
    }

    // Join room for this specific request
    socket.join(`request:${requestId}`);
    logger.debug('Client subscribed to request updates', {
      requestId,
      userId: socket.data.user?.id,
      socketId: socket.id,
    });
  });

  // Unsubscribe from request updates
  socket.on('unsubscribe:request', (requestId: string) => {
    if (!requestId) return;

    socket.leave(`request:${requestId}`);
    logger.debug('Client unsubscribed from request updates', {
      requestId,
      userId: socket.data.user?.id,
      socketId: socket.id,
    });
  });

  // Subscribe to all user's requests
  socket.on('subscribe:user-requests', () => {
    const userId = socket.data.user?.id;
    if (!userId) {
      socket.emit('error', { message: 'User ID not found' });
      return;
    }

    socket.join(`user-requests:${userId}`);
    logger.debug('Client subscribed to user request updates', {
      userId,
      socketId: socket.id,
    });
  });

  // Unsubscribe from user's requests
  socket.on('unsubscribe:user-requests', () => {
    const userId = socket.data.user?.id;
    if (!userId) return;

    socket.leave(`user-requests:${userId}`);
    logger.debug('Client unsubscribed from user request updates', {
      userId,
      socketId: socket.id,
    });
  });
}

// Helper function to emit request status updates
export function emitRequestStatusUpdate(
  io: Server,
  requestId: string,
  userId: string,
  update: any,
): void {
  // Emit to specific request room
  io.to(`request:${requestId}`).emit(`request:${requestId}:status`, update);

  // Also emit to user's request room
  io.to(`user-requests:${userId}`).emit('request:status', {
    requestId,
    ...update,
  });

  logger.debug('Emitted request status update', {
    requestId,
    userId,
    status: update.status,
  });
}