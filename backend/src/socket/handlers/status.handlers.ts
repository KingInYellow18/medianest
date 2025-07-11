import { Server, Socket } from 'socket.io';
import { logger } from '@/utils/logger';
import { serviceStatusRepository } from '@/repositories';

async function getServiceStatuses() {
  try {
    const statuses = await serviceStatusRepository.findMany();
    return statuses.map((status) => ({
      service: status.serviceName,
      status: status.status,
      responseTime: status.responseTimeMs,
      lastCheck: status.lastCheckAt,
      uptime: status.uptimePercentage,
    }));
  } catch (error) {
    logger.error('Failed to get service statuses', { error });
    return [];
  }
}

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