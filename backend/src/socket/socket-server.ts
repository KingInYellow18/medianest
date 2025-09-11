import { Server as HttpServer } from 'http';

import { Server as SocketIOServer, Socket } from 'socket.io';

import {
  handleSocketDisconnect,
  socketAuthMiddleware,
  socketOptionalAuthMiddleware,
  socketRateLimit,
  socketRequireAdmin,
  socketRequireUser,
} from '../middleware/socket-auth';
import { logger } from '../utils/logger';

export class MediaNestSocketServer {
  private io: SocketIOServer;
  private connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      // Security configurations
      transports: ['websocket', 'polling'],
      allowEIO3: false, // Force Engine.IO v4
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 10000,
      maxHttpBufferSize: 1e6, // 1MB max message size
      // Additional security headers
      serveClient: false, // Don't serve client files
    });

    this.setupMiddleware();
    this.setupNamespaces();
  }

  private setupMiddleware() {
    // Global rate limiting
    this.io.use(socketRateLimit(100, 60000)); // 100 events per minute

    // CORS validation middleware
    this.io.use((socket, next) => {
      const origin = socket.handshake.headers.origin;
      const allowedOrigins = (
        process.env.ALLOWED_ORIGINS ||
        process.env.FRONTEND_URL ||
        'http://localhost:3000'
      )
        .split(',')
        .map((o) => o.trim());

      if (!origin || allowedOrigins.includes(origin)) {
        next();
      } else {
        logger.warn('Socket connection rejected - invalid origin', {
          origin,
          allowedOrigins,
          ip: socket.handshake.address,
        });
        next(new Error('CORS: Origin not allowed'));
      }
    });

    // Default namespace uses optional auth
    this.io.use(socketOptionalAuthMiddleware);
  }

  private setupNamespaces() {
    // Default namespace - public events (optional auth)
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket, 'public');
    });

    // Authenticated namespace - requires valid JWT
    const authenticatedNs = this.io.of('/authenticated');
    authenticatedNs.use(socketAuthMiddleware);
    authenticatedNs.use(socketRequireUser());
    authenticatedNs.on('connection', (socket: Socket) => {
      this.handleConnection(socket, 'authenticated');
    });

    // Admin namespace - requires admin role
    const adminNs = this.io.of('/admin');
    adminNs.use(socketAuthMiddleware);
    adminNs.use(socketRequireAdmin());
    adminNs.on('connection', (socket: Socket) => {
      this.handleConnection(socket, 'admin');
    });

    // Media events namespace - for real-time media updates
    const mediaNs = this.io.of('/media');
    mediaNs.use(socketAuthMiddleware);
    mediaNs.use(socketRequireUser());
    mediaNs.on('connection', (socket: Socket) => {
      this.handleConnection(socket, 'media');
      this.setupMediaEvents(socket);
    });

    // System events namespace - for system monitoring
    const systemNs = this.io.of('/system');
    systemNs.use(socketAuthMiddleware);
    systemNs.use(socketRequireAdmin());
    systemNs.on('connection', (socket: Socket) => {
      this.handleConnection(socket, 'system');
      this.setupSystemEvents(socket);
    });
  }

  private handleConnection(socket: Socket, namespace: string) {
    const user = socket.user;

    logger.info(`Socket connected to ${namespace} namespace`, {
      socketId: socket.id,
      namespace,
      userId: user?.id,
      userEmail: user?.email,
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
    });

    // Track authenticated connections
    if (user) {
      if (!this.connectedUsers.has(user.id)) {
        this.connectedUsers.set(user.id, new Set());
      }
      this.connectedUsers.get(user.id)!.add(socket.id);
    }

    // Setup common event handlers
    this.setupCommonEvents(socket, namespace);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, namespace, reason);
    });

    // Send welcome message for authenticated users
    if (user && namespace !== 'public') {
      socket.emit('welcome', {
        message: `Welcome to MediaNest ${namespace} channel`,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        serverTime: new Date().toISOString(),
      });
    }
  }

  private setupCommonEvents(socket: Socket, namespace: string) {
    // Ping/pong for health checking
    socket.on('ping', (data) => {
      socket.emit('pong', { ...data, serverTime: new Date().toISOString() });
    });

    // Echo test event
    socket.on('echo', (data) => {
      socket.emit('echo', data);
    });

    // User info request
    socket.on('user-info', () => {
      if (socket.user) {
        socket.emit('user-info', {
          user: socket.user,
          namespace,
          connectedAt: new Date().toISOString(),
        });
      } else {
        socket.emit('error', { message: 'User not authenticated' });
      }
    });
  }

  private setupMediaEvents(socket: Socket) {
    // Join media-specific rooms based on user permissions
    socket.on('join-media-room', (data: { roomId: string }) => {
      const { roomId } = data;

      // Validate room ID
      if (typeof roomId !== 'string' || !roomId.match(/^[a-zA-Z0-9_-]+$/)) {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      socket.join(`media:${roomId}`);
      socket.emit('joined-room', { roomId });

      logger.info('User joined media room', {
        userId: socket.user?.id,
        socketId: socket.id,
        roomId,
      });
    });

    socket.on('leave-media-room', (data: { roomId: string }) => {
      const { roomId } = data;
      socket.leave(`media:${roomId}`);
      socket.emit('left-room', { roomId });
    });

    // Media playback status events
    socket.on('media-status', (data) => {
      // Broadcast to other users in the same rooms
      socket.rooms.forEach((room) => {
        if (room.startsWith('media:')) {
          socket.to(room).emit('media-status', {
            ...data,
            userId: socket.user?.id,
            timestamp: new Date().toISOString(),
          });
        }
      });
    });
  }

  private setupSystemEvents(socket: Socket) {
    // System health monitoring
    socket.on('system-health', () => {
      const health = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        timestamp: new Date().toISOString(),
      };
      socket.emit('system-health', health);
    });

    // Server logs streaming (admin only)
    socket.on('subscribe-logs', (data: { level?: string }) => {
      socket.join('logs');
      socket.emit('subscribed-logs', { level: data.level || 'info' });
    });

    socket.on('unsubscribe-logs', () => {
      socket.leave('logs');
      socket.emit('unsubscribed-logs');
    });
  }

  private handleDisconnection(socket: Socket, namespace: string, reason: string) {
    const user = socket.user;

    logger.info(`Socket disconnected from ${namespace} namespace`, {
      socketId: socket.id,
      namespace,
      reason,
      userId: user?.id,
      userEmail: user?.email,
    });

    // Clean up user tracking
    if (user && this.connectedUsers.has(user.id)) {
      const userSockets = this.connectedUsers.get(user.id)!;
      userSockets.delete(socket.id);

      if (userSockets.size === 0) {
        this.connectedUsers.delete(user.id);
        logger.info('User fully disconnected', { userId: user.id });
      }
    }

    handleSocketDisconnect(socket);
  }

  // Public methods for emitting events

  /**
   * Emit event to all authenticated users
   */
  public emitToAuthenticated(event: string, data: unknown) {
    this.io.of('/authenticated').emit(event, data);
  }

  /**
   * Emit event to all admin users
   */
  public emitToAdmins(event: string, data: unknown) {
    this.io.of('/admin').emit(event, data);
  }

  /**
   * Emit event to specific user across all their connections
   */
  public emitToUser(userId: string, event: string, data: unknown) {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.forEach((socketId) => {
        this.io.to(socketId).emit(event, data);
      });
    }
  }

  /**
   * Emit event to media namespace
   */
  public emitToMedia(event: string, data: unknown, roomId?: string) {
    const target = roomId ? this.io.of('/media').to(`media:${roomId}`) : this.io.of('/media');
    target.emit(event, data);
  }

  /**
   * Emit system event to admins
   */
  public emitSystemEvent(event: string, data: unknown) {
    this.io.of('/system').emit(event, data);
  }

  /**
   * Broadcast log message to subscribed admins
   */
  public broadcastLog(level: string, message: string, meta?: any) {
    this.io.of('/system').to('logs').emit('log', {
      level,
      message,
      meta,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    return {
      totalConnections: this.io.engine.clientsCount,
      authenticatedUsers: this.connectedUsers.size,
      namespaces: {
        public: this.io.sockets.sockets.size,
        authenticated: this.io.of('/authenticated').sockets.size,
        admin: this.io.of('/admin').sockets.size,
        media: this.io.of('/media').sockets.size,
        system: this.io.of('/system').sockets.size,
      },
    };
  }

  /**
   * Graceful shutdown
   */
  public async close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        logger.info('Socket.IO server closed');
        resolve();
      });
    });
  }
}
