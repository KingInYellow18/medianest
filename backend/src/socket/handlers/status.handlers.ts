import { Server, Socket } from 'socket.io';

import { statusService } from '@/services/status.service';
import { logger } from '@/utils/logger';
import { CatchError } from '../../types/common';

// Enhanced status handlers with rate limiting and better error handling
export function statusHandlers(io: Server, socket: Socket): void {
  registerStatusHandlers(io, socket);
}

export function registerStatusHandlers(io: Server, socket: Socket): void {
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
    } catch (error: unknown) {
      logger.error('Failed to subscribe to status', { error });
      socket.emit('error', {
        message: 'Failed to subscribe to status updates',
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
    } catch (error: unknown) {
      logger.error('Failed to get service status', { service, error });
      socket.emit('error', {
        message: `Failed to get status for ${service}`,
      });
    }
  });

  // Request refresh for specific service
  socket.on('request:refresh', async (serviceId: string) => {
    try {
      logger.info('User requested service refresh', {
        userId: socket.data.user?.id,
        serviceId,
      });

      // Refresh the specific service status
      const status = await statusService.refreshServiceStatus(serviceId);

      // Emit update to all subscribers
      io.to('status-updates').emit('service:status', {
        serviceId,
        status: status.status,
        responseTime: status.responseTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Failed to refresh service status', { serviceId, error });
      socket.emit('error', {
        message: `Failed to refresh status for service ${serviceId}`,
      });
    }
  });

  // Enhanced admin refresh with rate limiting
  socket.on('admin:refresh-status', async (): Promise<void> => {
    if (socket.data.user?.role !== 'admin') {
      socket.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      // Add rate limiting check
      const lastRefresh = socket.data.lastStatusRefresh || 0;
      const now = Date.now();
      const rateLimitMs = 10000; // 10 seconds between refreshes

      if (now - lastRefresh < rateLimitMs) {
        socket.emit('error', {
          message: 'Rate limited - wait before refreshing again',
          code: 'RATE_LIMITED',
          retryAfter: Math.ceil((rateLimitMs - (now - lastRefresh)) / 1000),
        });
        return;
      }

      socket.data.lastStatusRefresh = now;

      // Request refresh of all statuses
      const statuses = await statusService.getAllStatuses();
      io.to('status-updates').emit('status:current', statuses);
      io.to('status-updates').emit('status:refreshed', {
        timestamp: new Date().toISOString(),
        refreshedBy: socket.data.user?.email,
      });
    } catch (error: unknown) {
      logger.error('Failed to refresh statuses', { error });
      socket.emit('error', {
        message: 'Failed to refresh service statuses',
        code: 'REFRESH_FAILED',
      });
    }
  });

  // Subscribe to specific service status
  socket.on('subscribe:service', async (serviceId: string): Promise<void> => {
    if (!serviceId) {
      socket.emit('error', { message: 'Service ID is required' });
      return;
    }

    try {
      socket.join(`service:${serviceId}`);
      logger.debug('User subscribed to specific service', {
        userId: socket.data.user?.id,
        serviceId,
      });

      // Send current status for this service
      const status = await statusService.getServiceStatus(serviceId);
      socket.emit(`service:${serviceId}:current`, status);
    } catch (error: unknown) {
      logger.error('Failed to subscribe to service', { serviceId, error });
      socket.emit('error', {
        message: `Failed to subscribe to service ${serviceId}`,
      });
    }
  });

  // Unsubscribe from specific service
  socket.on('unsubscribe:service', (serviceId: string) => {
    if (serviceId) {
      socket.leave(`service:${serviceId}`);
      logger.debug('User unsubscribed from specific service', {
        userId: socket.data.user?.id,
        serviceId,
      });
    }
  });

  // Get service history (admin only)
  socket.on('service:history', async (serviceId: string, hours = 24, callback) => {
    if (socket.data.user?.role !== 'admin') {
      if (callback) callback({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      // TODO: Implement service history retrieval
      // For now, return mock data
      const history = {
        serviceId,
        timeframe: hours,
        dataPoints: [], // TODO: Implement actual history data
        summary: {
          uptime: 99.5,
          averageResponseTime: 150,
          incidents: 0,
        },
      };

      if (callback) {
        callback({ success: true, data: history });
      }
    } catch (error: unknown) {
      logger.error('Failed to get service history', { serviceId, error });
      if (callback) {
        callback({
          success: false,
          error: error instanceof Error ? error.message : ('Unknown error' as any),
        });
      }
    }
  });
}

// Helper functions for external use
export function broadcastServiceUpdate(
  io: Server,
  serviceId: string,
  update: {
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
    error?: string;
    details?: Record<string, any>;
  }
): void {
  const updateData = {
    serviceId,
    ...update,
    timestamp: new Date().toISOString(),
  };

  // Broadcast to all status subscribers
  io.to('status-updates').emit('service:status', updateData);

  // Broadcast to specific service subscribers
  io.to(`service:${serviceId}`).emit(`service:${serviceId}:update`, updateData);

  // Broadcast to status namespace
  io.of('/status').to('status-updates').emit('service:status', updateData);

  logger.debug('Broadcasted service status update', {
    serviceId,
    status: update.status,
    responseTime: update.responseTime,
  });
}

export function broadcastSystemAlert(
  io: Server,
  alert: {
    type: 'warning' | 'error' | 'info';
    title: string;
    message: string;
    serviceId?: string;
  }
): void {
  const alertData = {
    ...alert,
    id: `alert_${Date.now()}`,
    timestamp: new Date().toISOString(),
  };

  // Broadcast to all status subscribers
  io.to('status-updates').emit('system:alert', alertData);

  // Also broadcast to status namespace
  io.of('/status').to('status-updates').emit('system:alert', alertData);

  logger.info('Broadcasted system alert', {
    type: alert.type,
    title: alert.title,
    serviceId: alert.serviceId,
  });
}
