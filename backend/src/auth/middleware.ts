import { Request, Response, NextFunction } from 'express';
import { AuthenticationFacade, AuthenticatedUser } from './index';
import { UserRepository } from '../repositories/user.repository';
import { SessionTokenRepository } from '../repositories/session-token.repository';
import { DeviceSessionService } from '../services/device-session.service';
import { AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';

// Extended request interface
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
  deviceId?: string;
  sessionId?: string;
}

/**
 * Simplified Authentication Middleware
 * Uses the Authentication Facade for all operations
 */
export class AuthMiddleware {
  private authFacade: AuthenticationFacade;

  constructor(
    userRepository: UserRepository,
    sessionTokenRepository: SessionTokenRepository,
    deviceSessionService: DeviceSessionService
  ) {
    this.authFacade = new AuthenticationFacade(
      userRepository,
      sessionTokenRepository,
      deviceSessionService
    );
  }

  /**
   * Main authentication middleware
   */
  authenticate() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const authResult = await this.authFacade.authenticate(req);

        // Attach authentication data to request
        req.user = authResult.user;
        req.token = authResult.token;
        req.deviceId = authResult.deviceId;
        req.sessionId = authResult.sessionId;

        // Handle token rotation if needed
        if (req.token && req.user) {
          const tokenInfo = this.authFacade.getTokenInfo(req.token);
          if (this.authFacade.shouldRotateToken(req.token)) {
            await this.authFacade.handleTokenRotation(
              req,
              res,
              req.token,
              {
                userId: req.user.id,
                email: req.user.email,
                role: req.user.role,
                sessionId: req.sessionId,
              },
              req.user.id
            );
          }
        }

        next();
      } catch (error: any) {
        next(error);
      }
    };
  }

  /**
   * Optional authentication middleware
   */
  optionalAuth() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const authResult = await this.authFacade.authenticateOptional(req);

        if (authResult) {
          req.user = authResult.user;
          req.token = authResult.token;
        }

        next();
      } catch (error: any) {
        logger.debug('Optional auth failed', { error: error.message });
        next();
      }
    };
  }

  /**
   * Role-based authorization middleware
   */
  requireRole(...roles: string[]) {
    return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      if (!req.user) {
        return next(new AuthenticationError('Authentication required'));
      }

      if (!this.authFacade.hasRole(req.user, ...roles)) {
        return next(new AuthenticationError(`Required role: ${roles.join(' or ')}`));
      }

      next();
    };
  }

  /**
   * Resource-based authorization middleware
   */
  requirePermission(resource: string, action: string) {
    return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      if (!req.user) {
        return next(new AuthenticationError('Authentication required'));
      }

      if (!this.authFacade.authorize(req.user, resource, action)) {
        return next(new AuthenticationError(`Access denied: ${resource}:${action}`));
      }

      next();
    };
  }

  /**
   * Admin role middleware
   */
  requireAdmin() {
    return this.requireRole('admin', 'ADMIN');
  }

  /**
   * User role middleware
   */
  requireUser() {
    return this.requireRole('user', 'USER', 'admin', 'ADMIN');
  }

  /**
   * Request logging middleware for authenticated users
   */
  logAuthenticatedRequest() {
    return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
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
}

// Factory function for creating middleware instance
export function createAuthMiddleware(
  userRepository: UserRepository,
  sessionTokenRepository: SessionTokenRepository,
  deviceSessionService: DeviceSessionService
): AuthMiddleware {
  return new AuthMiddleware(userRepository, sessionTokenRepository, deviceSessionService);
}

// Legacy exports for backward compatibility
let middlewareInstance: AuthMiddleware | null = null;

export function initializeAuthMiddleware(
  userRepository: UserRepository,
  sessionTokenRepository: SessionTokenRepository,
  deviceSessionService: DeviceSessionService
): void {
  middlewareInstance = createAuthMiddleware(
    userRepository,
    sessionTokenRepository,
    deviceSessionService
  );
}

export function authenticate() {
  if (!middlewareInstance) {
    throw new Error('Auth middleware not initialized. Call initializeAuthMiddleware first.');
  }
  return middlewareInstance.authenticate();
}

export function optionalAuth() {
  if (!middlewareInstance) {
    throw new Error('Auth middleware not initialized. Call initializeAuthMiddleware first.');
  }
  return middlewareInstance.optionalAuth();
}

export function requireRole(...roles: string[]) {
  if (!middlewareInstance) {
    throw new Error('Auth middleware not initialized. Call initializeAuthMiddleware first.');
  }
  return middlewareInstance.requireRole(...roles);
}

export function requireAdmin() {
  if (!middlewareInstance) {
    throw new Error('Auth middleware not initialized. Call initializeAuthMiddleware first.');
  }
  return middlewareInstance.requireAdmin();
}

export function requireUser() {
  if (!middlewareInstance) {
    throw new Error('Auth middleware not initialized. Call initializeAuthMiddleware first.');
  }
  return middlewareInstance.requireUser();
}

export function logAuthenticatedRequest() {
  if (!middlewareInstance) {
    throw new Error('Auth middleware not initialized. Call initializeAuthMiddleware first.');
  }
  return middlewareInstance.logAuthenticatedRequest();
}
