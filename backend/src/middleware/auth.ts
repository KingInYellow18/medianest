import { Request, Response, NextFunction } from 'express';

import { SessionTokenRepository } from '../repositories/session-token.repository';
import { UserRepository } from '../repositories/user.repository';
import { AuthenticationError } from '../utils/errors';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { DeviceSessionService } from '../services/device-session.service';

// Import modular auth utilities
import {
  validateToken,
  extractTokenOptional,
  TokenValidationContext,
} from './auth/token-validator';
import { validateUser, validateUserOptional } from './auth/user-validator';
import {
  validateSessionToken,
  registerAndAssessDevice,
  updateSessionActivity,
  SessionUpdateContext,
} from './auth/device-session-manager';
import { handleTokenRotation, TokenRotationContext } from './auth/token-rotator';

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
      deviceId?: string;
      sessionId?: string;
      correlationId?: string;
    }
  }
}

// Repository instances - these should ideally be injected in production
const userRepository = new UserRepository();
const sessionTokenRepository = new SessionTokenRepository();
const deviceSessionService = new DeviceSessionService(userRepository, sessionTokenRepository);

export function authMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Create validation context
      const context: TokenValidationContext = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };

      // Validate token (extract, verify JWT, check blacklist)
      const { token, payload, metadata } = validateToken(req, context);

      // Validate user exists and is active
      const user = await validateUser(payload.userId, userRepository, context);

      // Validate session token
      await validateSessionToken(token, metadata, sessionTokenRepository, {
        userId: payload.userId,
        ...context,
      });

      // Register device and assess risk
      const deviceRegistration = await registerAndAssessDevice(user.id, req, deviceSessionService);

      // Update session activity
      const sessionContext: SessionUpdateContext = {
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params,
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent') || '',
      };
      await updateSessionActivity(payload.sessionId, sessionContext, deviceSessionService);

      // Handle token rotation if needed
      const rotationContext: TokenRotationContext = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: payload.sessionId,
        deviceId: deviceRegistration.deviceId,
      };
      await handleTokenRotation(
        token,
        payload,
        user.id,
        rotationContext,
        sessionTokenRepository,
        res,
      );

      // Attach user info to request
      req.user = user;
      req.token = token;
      req.deviceId = deviceRegistration.deviceId;
      req.sessionId = payload.sessionId;

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
      // Extract token (returns null if not found)
      const token = extractTokenOptional(req);

      if (!token) {
        // No token, but that's OK for optional auth
        return next();
      }

      // Verify JWT token
      const payload = verifyToken(token);

      // Validate user (returns null if not found/inactive)
      const user = await validateUserOptional(payload.userId, userRepository);

      if (user) {
        // Attach user info to request
        req.user = user;
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
