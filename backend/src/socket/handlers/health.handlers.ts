import { Server, Socket } from 'socket.io';

import { healthService } from '@/services/health.service';
import { logger } from '@/utils/logger';

export function healthHandlers(io: Server, socket: Socket): void {
  // Subscribe to health updates
  socket.on('subscribe:health', async () => {
    try {
      socket.join('health-updates');
      logger.info('User subscribed to health updates', {
        userId: socket.data.user?.id,
      });

      // Send current health status immediately
      const health = await healthService.checkHealth(false);
      socket.emit('health:current', health);
    } catch (error) {
      logger.error('Failed to subscribe to health', { error });
      socket.emit('error', {
        message: 'Failed to subscribe to health updates',
      });
    }
  });

  // Unsubscribe from health updates
  socket.on('unsubscribe:health', () => {
    socket.leave('health-updates');
    logger.info('User unsubscribed from health updates', {
      userId: socket.data.user?.id,
    });
  });

  // Get detailed health status
  socket.on('health:detailed', async () => {
    try {
      const health = await healthService.checkHealth(true);
      socket.emit('health:detailed', health);
    } catch (error) {
      logger.error('Failed to get detailed health', { error });
      socket.emit('error', {
        message: 'Failed to get detailed health status',
      });
    }
  });

  // Request health refresh
  socket.on('health:refresh', async () => {
    try {
      logger.info('User requested health refresh', {
        userId: socket.data.user?.id,
      });

      // Perform health check
      const health = await healthService.checkHealth(false);

      // Emit update to all subscribers
      io.to('health-updates').emit('health:updated', health);
    } catch (error) {
      logger.error('Failed to refresh health status', { error });
      socket.emit('error', {
        message: 'Failed to refresh health status',
      });
    }
  });

  // Admin-only: Force detailed health refresh
  socket.on('admin:refresh-health', async () => {
    if (socket.data.user?.role !== 'admin') {
      return socket.emit('error', { message: 'Unauthorized' });
    }

    try {
      // Request detailed health check
      const health = await healthService.checkHealth(true);
      io.to('health-updates').emit('health:detailed', health);
      io.to('health-updates').emit('health:refreshed');
    } catch (error) {
      logger.error('Failed to refresh health', { error });
      socket.emit('error', {
        message: 'Failed to refresh health status',
      });
    }
  });
}

// Helper function to emit health updates periodically
export function startHealthMonitoring(io: Server, intervalMs: number = 30000): NodeJS.Timer {
  return setInterval(async () => {
    try {
      const health = await healthService.checkHealth(false);
      io.to('health-updates').emit('health:updated', health);
    } catch (error) {
      logger.error('Failed to emit health update', { error });
    }
  }, intervalMs);
}
