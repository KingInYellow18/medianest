import { Server as HttpServer } from 'http';

import { Server, Socket } from 'socket.io';

import { logger } from '@/utils/logger';

import { registerHandlers } from './handlers';
import { authenticateSocket } from './middleware';
import { setSocketServer } from './server';
import { setupNamespaces } from './namespaces';

export function initializeSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6,
    allowEIO3: true,
  });

  // Store the socket server instance
  setSocketServer(io);

  // Setup namespaces for feature isolation
  setupNamespaces(io);

  // JWT authentication middleware for main namespace
  io.use(authenticateSocket);

  // Main namespace connection handling
  io.on('connection', (socket: Socket) => {
    logger.info('Client connected', {
      userId: socket.data.user?.id,
      socketId: socket.id,
      userRole: socket.data.user?.role,
      userAgent: socket.handshake.headers['user-agent'],
      ip: socket.handshake.address,
    });

    // Join user to their personal room for notifications
    socket.join(`user:${socket.data.user?.id}`);

    // Join role-based rooms
    if (socket.data.user?.role) {
      socket.join(`role:${socket.data.user.role}`);
    }

    // Track connection stats
    socket.emit('connection:established', {
      socketId: socket.id,
      timestamp: new Date().toISOString(),
      serverTime: Date.now(),
    });

    // Register event handlers
    registerHandlers(io, socket);

    // Enhanced disconnect handling
    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected', {
        userId: socket.data.user?.id,
        socketId: socket.id,
        reason,
        connectedFor: Date.now() - (socket.data.connectedAt || Date.now()),
      });

      // Leave all rooms
      socket.leave(`user:${socket.data.user?.id}`);
      if (socket.data.user?.role) {
        socket.leave(`role:${socket.data.user.role}`);
      }
    });

    // Enhanced error handling
    socket.on('error', (error) => {
      logger.error('Socket error', {
        error: error.message,
        stack: error.stack,
        userId: socket.data.user?.id,
        socketId: socket.id,
      });

      socket.emit('error', {
        message: 'Connection error occurred',
        code: 'SOCKET_ERROR',
        timestamp: new Date().toISOString(),
      });
    });

    // Heartbeat/ping handling
    socket.on('ping', (callback) => {
      const timestamp = Date.now();
      if (typeof callback === 'function') {
        callback({ timestamp, serverTime: timestamp });
      }
    });

    // Store connection timestamp
    socket.data.connectedAt = Date.now();
  });

  return io;
}
