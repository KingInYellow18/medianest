import { Server, Socket } from 'socket.io';
import { statusService } from '@/services/status.service';
import { logger } from '@/utils/logger';

export function statusHandlers(io: Server, socket: Socket): void {
  // Subscribe to service status updates
  socket.on('subscribe:status', async () => {
    try {
      socket.join('status-updates');
      logger.info('User subscribed to status updates', {
        userId: socket.data.user?.id,
      });

      // Send current status immediately
      const statuses = await statusService.getAllStatuses();
      socket.emit('status:current', statuses);
    } catch (error) {
      logger.error('Failed to subscribe to status', { error });
      socket.emit('error', { 
        message: 'Failed to subscribe to status updates' 
      });
    }
  });

  // Unsubscribe from status updates
  socket.on('unsubscribe:status', () => {
    socket.leave('status-updates');
    logger.info('User unsubscribed from status updates', {
      userId: socket.data.user?.id,
    });
  });

  // Get status for specific service
  socket.on('status:get', async (service: string) => {
    try {
      const status = await statusService.getServiceStatus(service);
      socket.emit(`status:${service}`, status);
    } catch (error) {
      logger.error('Failed to get service status', { service, error });
      socket.emit('error', { 
        message: `Failed to get status for ${service}` 
      });
    }
  });

  // Admin-only: Force status refresh
  socket.on('admin:refresh-status', async () => {
    if (socket.data.user?.role !== 'admin') {
      return socket.emit('error', { message: 'Unauthorized' });
    }

    try {
      // Request refresh of all statuses
      const statuses = await statusService.getAllStatuses();
      io.to('status-updates').emit('status:current', statuses);
      io.to('status-updates').emit('status:refreshed');
    } catch (error) {
      logger.error('Failed to refresh statuses', { error });
      socket.emit('error', { 
        message: 'Failed to refresh service statuses' 
      });
    }
  });
}