import { Server, Socket } from 'socket.io';

import { healthHandlers } from './health.handlers';
import { notificationHandlers } from './notification.handlers';
import { requestHandlers } from './request.handlers';
import { statusHandlers } from './status.handlers';
import { registerYouTubeHandlers } from './youtube.handler';

export function registerHandlers(io: Server, socket: Socket): void {
  // Service status subscriptions
  statusHandlers(io, socket);

  // Health monitoring subscriptions
  healthHandlers(io, socket);

  // User notifications
  notificationHandlers(io, socket);

  // Media request status updates
  requestHandlers(io, socket);

  // YouTube download events
  registerYouTubeHandlers(io, socket);
}
