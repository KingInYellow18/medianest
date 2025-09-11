/// <reference path="../types/express.d.ts" />
import { Request, Response, NextFunction } from 'express';

import { AuthenticationFacade, AuthenticatedUser } from '../auth';
import { prisma } from '../lib/prisma';
import { SessionTokenRepository } from '../repositories/session-token.repository';
import { UserRepository } from '../repositories/user.repository';
import { DeviceSessionService } from '../services/device-session.service';
import { CatchError } from '../types/common';
import { AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';

// Import unified authentication facade

// Types are extended in types/express.d.ts

// Repository instances with proper Prisma client injection
const userRepository = new UserRepository(prisma);
const sessionTokenRepository = new SessionTokenRepository(prisma);
const deviceSessionService = new DeviceSessionService(userRepository, sessionTokenRepository);

// Initialize authentication facade
const authFacade = new AuthenticationFacade(
  userRepository,
  sessionTokenRepository,
  deviceSessionService,
);

export function authMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Use facade for simplified authentication
      const authResult = await authFacade.authenticate(req);

      // Attach authentication data to request
      req.user = authResult.user as AuthenticatedUser;
      req.token = authResult.token;
      req.deviceId = authResult.deviceId;
      req.sessionId = authResult.sessionId;

      // Handle token rotation through facade
      if (req.token && req.user) {
        if (authFacade.shouldRotateToken(req.token)) {
          // Ensure user has required properties for token rotation
          const tokenPayload = {
            userId: req.user.id,
            email: req.user.email || '',
            role: req.user.role || 'user',
            plexId: req.user.plexId || undefined,
            sessionId: req.sessionId || '',
            deviceId: req.deviceId,
          };

          await authFacade.handleTokenRotation(req, res, req.token, tokenPayload, req.user.id);
        }
      }

      next();
    } catch (error: CatchError) {
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

    if (!authFacade.hasRole(req.user as AuthenticatedUser, ...roles)) {
      return next(new AuthenticationError(`Required role: ${roles.join(' or ')}`));
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
      const authResult = await authFacade.authenticateOptional(req);

      if (authResult) {
        req.user = authResult.user as AuthenticatedUser;
        req.token = authResult.token;
      }

      next();
    } catch (error: CatchError) {
      // Log error but continue - auth is optional
      logger.debug('Optional auth failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
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
