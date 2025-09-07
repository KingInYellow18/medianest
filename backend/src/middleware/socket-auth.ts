import { Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

import { SessionTokenRepository } from '../repositories/session-token.repository';
import { UserRepository } from '../repositories/user.repository';
import { AuthenticationError } from '../utils/errors';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';

// Extend Socket interface
declare module 'socket.io' {
  interface Socket {
    user?: {
      id: string;
      email: string;
      name: string | null;
      role: string;
      plexId?: string;
      plexUsername?: string | null;
    };
    token?: string;
  }
}

// Repository instances - these should ideally be injected in production
// @ts-ignore
const userRepository = new UserRepository(undefined as any);
// @ts-ignore
const sessionTokenRepository = new SessionTokenRepository(undefined as any);

/**
 * Socket.IO authentication middleware using JWT tokens
 * Validates tokens from query params, auth header, or handshake auth
 */
export const socketAuthMiddleware = (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  next: (err?: Error) => void
) => {
  authenticateSocket(socket)
    .then(() => next())
    .catch((error: any) => {
      logger.warn('Socket authentication failed', {
        socketId: socket.id,
        error: error.message as any,
        ip: socket.handshake.address,
      });
      next(new Error('Authentication failed'));
    });
};

/**
 * Optional Socket.IO auth middleware - allows unauthenticated connections
 * but attaches user info if valid token is provided
 */
export const socketOptionalAuthMiddleware = (
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  next: (err?: Error) => void
) => {
  authenticateSocket(socket, true)
    .then(() => next())
    .catch(() => {
      // For optional auth, continue even if authentication fails
      next();
    });
};

/**
 * Core authentication logic for Socket.IO connections
 */
async function authenticateSocket(
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  optional: boolean = false
): Promise<void> {
  try {
    // Extract token from multiple sources
    let token: string | null = null;

    // 1. Check query parameters (most common for socket.io)
    if (socket.handshake.query?.token) {
      token = Array.isArray(socket.handshake.query.token)
        ? socket.handshake.query.token[0] || null
        : (socket.handshake.query.token as string) || null;
    }

    // 2. Check Authorization header
    const authHeader = socket.handshake.headers.authorization;
    if (!token && authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 3. Check handshake auth object
    if (!token && socket.handshake.auth?.token) {
      token = (socket.handshake.auth.token as string) || null;
    }

    // 4. Check cookies
    if (!token && socket.handshake.headers.cookie) {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      token = cookies['auth-token'];
    }

    if (!token) {
      if (optional) {
        return; // No token, but that's OK for optional auth
      }
      throw new AuthenticationError('Authentication token required');
    }

    // Validate token format
    if (typeof token !== 'string' || token.length === 0) {
      throw new AuthenticationError('Invalid token format');
    }

    // Verify JWT token
    const payload = verifyToken(token);

    // Verify user still exists and is active
    const user = await userRepository.findById(payload.userId);
    if (!user || user.status !== 'active') {
      throw new AuthenticationError('User not found or inactive');
    }

    // Verify session token exists and is valid
    const sessionToken = await sessionTokenRepository.validate(token);
    if (!sessionToken) {
      throw new AuthenticationError('Invalid session');
    }

    // Attach user info to socket
    socket.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plexId: user.plexId || undefined,
      plexUsername: user.plexUsername,
    };
    socket.token = token;

    // Log successful authentication
    logger.info('Socket authenticated successfully', {
      socketId: socket.id,
      userId: user.id,
      userEmail: user.email,
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
    });
  } catch (error: any) {
    if (optional) {
      // For optional auth, log but don't throw
      logger.debug('Optional socket auth failed', {
        socketId: socket.id,
        error: (error as Error) ? (error.message as any) : 'Unknown error',
        ip: socket.handshake.address,
      });
      return;
    }
    throw error;
  }
}

/**
 * Middleware to require specific roles for socket connections
 */
export const socketRequireRole = (...roles: string[]) => {
  return (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    next: (err?: Error) => void
  ) => {
    if (!socket.user) {
      return next(new Error('Authentication required'));
    }

    if (!roles.includes(socket.user.role)) {
      logger.warn('Socket authorization failed - insufficient role', {
        socketId: socket.id,
        userId: socket.user.id,
        userRole: socket.user.role,
        requiredRoles: roles,
      });
      return next(new Error(`Required role: ${roles.join(' or ')}`));
    }

    next();
  };
};

/**
 * Middleware to require admin role
 */
export const socketRequireAdmin = () => socketRequireRole('admin', 'ADMIN');

/**
 * Middleware to require user role or higher
 */
export const socketRequireUser = () => socketRequireRole('user', 'USER', 'admin', 'ADMIN');

/**
 * Disconnect handler to clean up user sessions
 */
export const handleSocketDisconnect = (socket: Socket) => {
  if (socket.user) {
    logger.info('Authenticated socket disconnected', {
      socketId: socket.id,
      userId: socket.user.id,
      userEmail: socket.user.email,
    });
  } else {
    logger.debug('Unauthenticated socket disconnected', {
      socketId: socket.id,
      ip: socket.handshake.address,
    });
  }
};

/**
 * Utility to parse cookies from header string
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  cookieHeader.split(';').forEach((cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });

  return cookies;
}

/**
 * Rate limiting for socket events
 */
export const socketRateLimit = (maxEvents: number = 100, windowMs: number = 60000) => {
  const clients = new Map<string, { count: number; resetTime: number }>();

  return (
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    next: (err?: Error) => void
  ) => {
    const clientId = socket.user?.id || socket.handshake.address;
    const now = Date.now();

    const client = clients.get(clientId);

    if (!client || now > client.resetTime) {
      // Reset or initialize counter
      clients.set(clientId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (client.count >= maxEvents) {
      logger.warn('Socket rate limit exceeded', {
        socketId: socket.id,
        clientId,
        count: client.count,
        maxEvents,
      });
      return next(new Error('Rate limit exceeded'));
    }

    client.count++;
    next();
  };
};
