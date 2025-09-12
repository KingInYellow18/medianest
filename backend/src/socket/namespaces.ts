import { Server } from 'socket.io';

import { logger } from '@/utils/logger';

import { registerAdminHandlers } from './handlers/admin.handlers';
import { registerDownloadHandlers } from './handlers/download.handlers';
import { registerNotificationHandlers } from './handlers/notification.handlers';
import { registerStatusHandlers } from './handlers/status.handlers';
import { authenticateSocket, authenticateAdminSocket } from './middleware';


/**
 * Setup Socket.IO namespaces for feature isolation and better organization
 */
export function setupNamespaces(io: Server): void {
  // Admin namespace for administrative operations
  const adminNs = io.of('/admin');
  adminNs.use(authenticateAdminSocket);

  adminNs.on('connection', (socket) => {
    logger.info('Admin connected to admin namespace', {
      userId: socket.data.user?.id,
      socketId: socket.id,
    });

    socket.join('admin-room');
    registerAdminHandlers(adminNs as any, socket);

    socket.on('disconnect', (reason) => {
      logger.info('Admin disconnected from admin namespace', {
        userId: socket.data.user?.id,
        socketId: socket.id,
        reason,
      });
    });
  });

  // Status namespace for service monitoring
  const statusNs = io.of('/status');
  statusNs.use(authenticateSocket);

  statusNs.on('connection', (socket) => {
    logger.debug('Client connected to status namespace', {
      userId: socket.data.user?.id,
      socketId: socket.id,
    });

    registerStatusHandlers(statusNs as any, socket);

    socket.on('disconnect', () => {
      logger.debug('Client disconnected from status namespace', {
        userId: socket.data.user?.id,
        socketId: socket.id,
      });
    });
  });

  // Downloads namespace for YouTube and media downloads
  const downloadsNs = io.of('/downloads');
  downloadsNs.use(authenticateSocket);

  downloadsNs.on('connection', (socket) => {
    logger.debug('Client connected to downloads namespace', {
      userId: socket.data.user?.id,
      socketId: socket.id,
    });

    // Join user-specific download room
    const userId = socket.data.user?.id;
    if (userId) {
      socket.join(`downloads:user:${userId}`);
    }

    registerDownloadHandlers(downloadsNs as any, socket);

    socket.on('disconnect', () => {
      logger.debug('Client disconnected from downloads namespace', {
        userId: socket.data.user?.id,
        socketId: socket.id,
      });
    });
  });

  // Notifications namespace for real-time notifications
  const notificationsNs = io.of('/notifications');
  notificationsNs.use(authenticateSocket);

  notificationsNs.on('connection', (socket) => {
    logger.debug('Client connected to notifications namespace', {
      userId: socket.data.user?.id,
      socketId: socket.id,
    });

    // Join user-specific notification room
    const userId = socket.data.user?.id;
    if (userId) {
      socket.join(`notifications:user:${userId}`);
    }

    registerNotificationHandlers(notificationsNs as any, socket);

    socket.on('disconnect', () => {
      logger.debug('Client disconnected from notifications namespace', {
        userId: socket.data.user?.id,
        socketId: socket.id,
      });
    });
  });

  logger.info('Socket.IO namespaces configured', {
    namespaces: ['/admin', '/status', '/downloads', '/notifications'],
  });
}
