import { Server } from 'socket.io';

let io: Server | null = null;

export const socketService = {
  initialize(socketServer: Server): void {
    io = socketServer;
  },

  // Emit to all clients in a room
  emitToRoom(room: string, event: string, data: any): void {
    if (!io) {
      console.warn('Socket.io not initialized');
      return;
    }
    io.to(room).emit(event, data);
  },

  // Emit to specific user
  emitToUser(userId: string, event: string, data: any): void {
    this.emitToRoom(`user:${userId}`, event, data);
  },

  // Broadcast service status update
  broadcastStatusUpdate(service: string, status: any): void {
    this.emitToRoom('status-updates', 'service:status', {
      service,
      status,
      timestamp: new Date().toISOString(),
    });
  },

  // Send notification to user
  sendNotification(userId: string, notification: any): void {
    this.emitToUser(userId, 'notification:new', notification);
  },
};