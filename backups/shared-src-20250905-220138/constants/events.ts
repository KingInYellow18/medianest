// WebSocket event names

export const SOCKET_EVENTS = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Service status events
  SERVICE_STATUS: 'service:status',
  SERVICE_STATUS_ALL: 'service:status:all',
  SERVICE_ERROR: 'service:error',
  SERVICE_RECONNECTED: 'service:reconnected',

  // Request events
  REQUEST_UPDATE: 'request:update',
  REQUEST_CREATED: 'request:created',
  REQUEST_APPROVED: 'request:approved',
  REQUEST_DENIED: 'request:denied',
  REQUEST_AVAILABLE: 'request:available',
  REQUEST_FAILED: 'request:failed',

  // Download events
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_STARTED: 'download:started',
  DOWNLOAD_COMPLETED: 'download:completed',
  DOWNLOAD_FAILED: 'download:failed',
  DOWNLOAD_CANCELLED: 'download:cancelled',

  // User events
  USER_NOTIFICATION: 'user:notification',
  USER_SESSION_EXPIRED: 'user:session:expired',

  // System events
  SYSTEM_MAINTENANCE: 'system:maintenance',
  SYSTEM_UPDATE: 'system:update',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
