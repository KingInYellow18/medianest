import { Request, Response, NextFunction } from 'express';

import { SessionTokenRepository } from '../repositories/session-token.repository';
import { UserRepository } from '../repositories/user.repository';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
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
}

// Repository instances - these should ideally be injected in production
const userRepository = new UserRepository();
const sessionTokenRepository = new SessionTokenRepository();

export function authMiddleware() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Extract token from Authorization header or cookie
      let token: string | null = null;

      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (req.cookies['auth-token']) {
        token = req.cookies['auth-token'];
      }

      if (!token) {
        throw new AuthenticationError('Authentication required');
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

      // Attach user info to request
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plexId: user.plexId || undefined,
        plexUsername: user.plexUsername,
      };
      req.token = token;

      next();
    } catch (error) {
      next(error);
    }
  };
}

// Alias for backward compatibility
export const authenticate = authMiddleware;

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AuthorizationError(`Required role: ${roles.join(' or ')}`));
    }

    next();
  };
}

export function requireAdmin() {
  return requireRole('admin', 'ADMIN');
}

export function requireUser() {
  return requireRole('user', 'USER', 'admin', 'ADMIN');
}

export function optionalAuth() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      if (!token) {
        // No token, but that's OK for optional auth
        return next();
      }

      // Verify JWT token
      const payload = verifyToken(token);

      // Verify user still exists and is active
      const user = await userRepository.findById(payload.userId);

      if (user && user.status === 'active') {
        // Attach user info to request
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plexId: user.plexId || undefined,
          plexUsername: user.plexUsername,
        };
        req.token = token;
      }

      next();
    } catch (error) {
      // Log error but continue - auth is optional
      logger.debug('Optional auth failed', { error });
      next();
    }
  };
}

// Middleware to log authenticated requests
export function logAuthenticatedRequest() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user) {
      logger.info('Authenticated request', {
        userId: req.user.id,
        method: req.method,
        path: req.path,
        ip: req.ip,
      });
    }
    next();
  };
}
