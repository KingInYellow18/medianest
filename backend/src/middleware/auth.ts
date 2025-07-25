import type { Request, Response, NextFunction } from 'express';

import { AppError } from '@/middleware/error';
import { userRepository } from '@/repositories/instances';
import { jwtService } from '@/services/jwt.service';
import { logger } from '@/utils/logger';

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

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      throw new AppError('No token provided', 401, 'NO_TOKEN');
    }

    // Verify JWT token
    const payload = jwtService.verifyToken(token);

    // Verify user still exists and is active
    const user = await userRepository.findById(payload.userId);

    if (!user || user.status !== 'active') {
      throw new AppError('User not found or inactive', 401, 'USER_NOT_FOUND');
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email || '',
      role: user.role,
      plexId: user.plexId || undefined,
    };
    req.token = token;

    next();
  } catch (error) {
    next(error);
  }
};

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(`Required role: ${roles.join(' or ')}`, 403, 'FORBIDDEN'));
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
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      if (!token) {
        // No token, but that's OK for optional auth
        return next();
      }

      // Verify JWT token
      const payload = jwtService.verifyToken(token);

      // Verify user still exists and is active
      const user = await userRepository.findById(payload.userId);

      if (user && user.status === 'active') {
        // Attach user info to request
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          plexId: user.plexId || undefined,
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
        ip: req.ip,
      });
    }
    next();
  };
}
