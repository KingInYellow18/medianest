import { Server, Socket } from 'socket.io';

import { notificationHandlers } from './notification.handlers';
import { requestHandlers } from './request.handlers';
import { statusHandlers } from './status.handlers';

export function registerHandlers(io: Server, socket: Socket): void {
  // Service status subscriptions
  statusHandlers(io, socket);

  // User notifications
  notificationHandlers(io, socket);

  // Media request status updates
  requestHandlers(io, socket);

  // Future: YouTube download progress, etc.
}
