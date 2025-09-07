import { Server, Socket } from 'socket.io';

import { logger } from '@/utils/logger';

interface RequestStatusUpdate {
  requestId: string;
  status: string;
  progress?: number;
  message?: string;
  data?: any;
  error?: string;
  updatedAt: Date;
}

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
  socket.on('subscribe:user-requests', async () => {
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

    // Send current user requests
    try {
      // TODO: Implement mediaRequestRepository.findByUserId when repository is available
      const requests = []; // await mediaRequestRepository.findByUserId(userId);
      socket.emit('user-requests:current', requests);
    } catch (error: any) {
      logger.error('Failed to get user requests', { userId, error });
    }
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

  // Get request history for user
  socket.on(
    'requests:history',
    async (options: { limit?: number; offset?: number; status?: string } = {}, callback) => {
      const userId = socket.data.user?.id;
      if (!userId) {
        if (callback) callback({ success: false, error: 'User ID not found' });
        return;
      }

      try {
        const { limit = 50, offset = 0, status } = options;

        // TODO: Implement request history retrieval when repository is available
        const history = {
          requests: [], // await mediaRequestRepository.findByUserId(userId, { limit, offset, status })
          total: 0,
          hasMore: false,
        };

        if (callback) {
          callback({ success: true, data: history });
        }
      } catch (error: any) {
        logger.error('Failed to get request history', {
          userId,
          error: error.message as any,
        });

        if (callback) {
          callback({ success: false, error: error.message as any });
        }
      }
    },
  );

  // Cancel a request
  socket.on('request:cancel', async (requestId: string, callback) => {
    const userId = socket.data.user?.id;
    if (!userId) {
      if (callback) callback({ success: false, error: 'User ID not found' });
      return;
    }

    try {
      if (!requestId) {
        if (callback) callback({ success: false, error: 'Request ID is required' });
        return;
      }

      // TODO: Implement request cancellation logic
      logger.info('Request cancellation requested', { userId, requestId });

      // Emit cancellation update
      const update: RequestStatusUpdate = {
        requestId,
        status: 'cancelled',
        message: 'Request cancelled by user',
        updatedAt: new Date(),
      };

      emitRequestStatusUpdate(io, requestId, userId, update);

      if (callback) {
        callback({ success: true });
      }
    } catch (error: any) {
      logger.error('Failed to cancel request', {
        userId,
        requestId,
        error: error.message as any,
      });

      if (callback) {
        callback({ success: false, error: error.message as any });
      }
    }
  });

  // Retry a failed request
  socket.on('request:retry', async (requestId: string, callback) => {
    const userId = socket.data.user?.id;
    if (!userId) {
      if (callback) callback({ success: false, error: 'User ID not found' });
      return;
    }

    try {
      if (!requestId) {
        if (callback) callback({ success: false, error: 'Request ID is required' });
        return;
      }

      // TODO: Implement request retry logic
      logger.info('Request retry requested', { userId, requestId });

      // Emit retry update
      const update: RequestStatusUpdate = {
        requestId,
        status: 'pending',
        message: 'Request retrying',
        updatedAt: new Date(),
      };

      emitRequestStatusUpdate(io, requestId, userId, update);

      if (callback) {
        callback({ success: true });
      }
    } catch (error: any) {
      logger.error('Failed to retry request', {
        userId,
        requestId,
        error: error.message as any,
      });

      if (callback) {
        callback({ success: false, error: error.message as any });
      }
    }
  });
}

// Enhanced helper function to emit request status updates
export function emitRequestStatusUpdate(
  io: Server,
  requestId: string,
  userId: string,
  update: RequestStatusUpdate,
): void {
  // Emit to specific request room
  io.to(`request:${requestId}`).emit(`request:${requestId}:status`, update);

  // Also emit to user's request room
  io.to(`user-requests:${userId}`).emit('request:status', {
    requestId,
    ...update,
  });

  // Emit to requests namespace if available
  io.of('/requests')
    ?.to(`user-requests:${userId}`)
    .emit('request:status', {
      requestId,
      ...update,
    });

  logger.debug('Emitted request status update', {
    requestId,
    userId,
    status: update.status,
    progress: update.progress,
  });
}

// Helper function to emit request completion
export function emitRequestCompletion(
  io: Server,
  requestId: string,
  userId: string,
  result: {
    status: 'completed' | 'failed';
    message: string;
    data?: any;
    error?: string;
  },
): void {
  const update: RequestStatusUpdate = {
    requestId,
    status: result.status,
    progress: result.status === 'completed' ? 100 : undefined,
    message: result.message,
    data: result.data,
    error: result.error,
    updatedAt: new Date(),
  };

  emitRequestStatusUpdate(io, requestId, userId, update);

  logger.info('Request completion emitted', {
    requestId,
    userId,
    status: result.status,
  });
}

// Helper function to emit bulk request updates
export function emitBulkRequestUpdates(
  io: Server,
  userId: string,
  updates: RequestStatusUpdate[],
): void {
  // Emit to user's request room
  io.to(`user-requests:${userId}`).emit('requests:bulk-update', updates);

  // Also emit to requests namespace
  io.of('/requests')?.to(`user-requests:${userId}`).emit('requests:bulk-update', updates);

  logger.debug('Emitted bulk request updates', {
    userId,
    updateCount: updates.length,
  });
}
