import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { getRepositories } from '../config/database';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { logger } from '../utils/logger';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        plexId?: string;
      };
      token?: string;
    }
  }
}

export function authenticate() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : null;

      if (!token) {
        throw new AuthenticationError('No token provided');
      }

      // Verify JWT token
      const payload = verifyToken(token);

      // Verify user still exists and is active
      const { userRepository } = getRepositories();
      const user = await userRepository.findById(payload.userId);

      if (!user || user.status !== 'active') {
        throw new AuthenticationError('User not found or inactive');
      }

      // Attach user info to request
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        plexId: user.plexId || undefined
      };
      req.token = token;

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
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
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : null;

      if (!token) {
        // No token, but that's OK for optional auth
        return next();
      }

      // Verify JWT token
      const payload = verifyToken(token);

      // Verify user still exists and is active
      const { userRepository } = getRepositories();
      const user = await userRepository.findById(payload.userId);

      if (user && user.status === 'active') {
        // Attach user info to request
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          plexId: user.plexId || undefined
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
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user) {
      logger.info('Authenticated request', {
        userId: req.user.id,
        method: req.method,
        path: req.path,
        ip: req.ip
      });
    }
    next();
  };
}