import { Server as HttpServer } from 'http';

import { Server, Socket } from 'socket.io';

import { logger } from '@/utils/logger';

import { registerHandlers } from './handlers';
import { authenticateSocket } from './middleware';
import { setSocketServer } from './server';

export function initializeSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Store the socket server instance
  setSocketServer(io);

  // JWT authentication middleware
  io.use(authenticateSocket);

  // Connection handling
  io.on('connection', (socket: Socket) => {
    logger.info('Client connected', {
      userId: socket.data.user?.id,
      socketId: socket.id,
    });

    // Register event handlers
    registerHandlers(io, socket);

    socket.on('disconnect', () => {
      logger.info('Client disconnected', {
        userId: socket.data.user?.id,
        socketId: socket.id,
      });
    });

    socket.on('error', (error) => {
      logger.error('Socket error', {
        error: error.message,
        userId: socket.data.user?.id,
      });
    });
  });

  return io;
}
