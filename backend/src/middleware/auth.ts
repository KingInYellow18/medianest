import { Request, Response, NextFunction } from 'express';

import { SessionTokenRepository } from '../repositories/session-token.repository';
import { UserRepository } from '../repositories/user.repository';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { verifyToken, rotateTokenIfNeeded, isTokenBlacklisted, getTokenMetadata } from '../utils/jwt';
import { logger } from '../utils/logger';
import { logSecurityEvent, generateDeviceFingerprint } from '../utils/security';
import { DeviceSessionService } from '../services/device-session.service';

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

      // Get token metadata
      const tokenMetadata = getTokenMetadata(token);
      
      // Check if token is blacklisted
      if (tokenMetadata.tokenId && isTokenBlacklisted(tokenMetadata.tokenId)) {
        logSecurityEvent('BLACKLISTED_TOKEN_USED', {
          tokenId: tokenMetadata.tokenId,
          userId: tokenMetadata.userId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }, 'error');
        throw new AuthenticationError('Token has been revoked');
      }

      // Verify JWT token with enhanced security
      const payload = verifyToken(token, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      // Verify user still exists and is active
      const user = await userRepository.findById(payload.userId);
      if (!user || user.status !== 'active') {
        logSecurityEvent('INACTIVE_USER_TOKEN_USED', {
          userId: payload.userId,
          userStatus: user?.status || 'not_found',
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }, 'warn');
        throw new AuthenticationError('User not found or inactive');
      }

      // Verify session token exists and is valid
      const sessionToken = await sessionTokenRepository.validate(token);
      if (!sessionToken) {
        logSecurityEvent('INVALID_SESSION_TOKEN_USED', {
          userId: payload.userId,
          tokenId: tokenMetadata.tokenId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }, 'warn');
        throw new AuthenticationError('Invalid session');
      }

      // Register device and update session activity
      const deviceRegistration = await deviceSessionService.registerDevice(user.id, {
        userAgent: req.get('user-agent') || '',
        ipAddress: req.ip || '',
        acceptLanguage: req.get('accept-language')
      });

      // Check device risk assessment
      if (deviceRegistration.riskAssessment.shouldBlock) {
        logSecurityEvent('HIGH_RISK_DEVICE_BLOCKED', {
          userId: user.id,
          deviceId: deviceRegistration.deviceId,
          riskScore: deviceRegistration.riskAssessment.riskScore,
          riskFactors: deviceRegistration.riskAssessment.factors,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }, 'error');
        throw new AuthenticationError('Device blocked due to high risk score');
      }

      // Update session activity
      if (payload.sessionId) {
        await deviceSessionService.updateSessionActivity(payload.sessionId, {
          action: `${req.method} ${req.path}`,
          resource: req.path,
          ipAddress: req.ip || '',
          userAgent: req.get('user-agent') || '',
          metadata: {
            query: req.query,
            params: req.params
          }
        });
      }

      // Check for token rotation
      const rotationResult = rotateTokenIfNeeded(token, payload, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: payload.sessionId,
        deviceId: deviceRegistration.deviceId
      });

      if (rotationResult) {
        // Update session token in database
        await sessionTokenRepository.create({
          userId: user.id,
          hashedToken: rotationResult.newToken,
          expiresAt: rotationResult.expiresAt,
          deviceId: deviceRegistration.deviceId
        });

        // Set new token in cookie
        res.cookie('auth-token', rotationResult.newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 15 * 60 * 1000 // 15 minutes
        });

        // Add rotation headers
        res.setHeader('X-Token-Rotated', 'true');
        res.setHeader('X-New-Token', rotationResult.newToken);
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
      return next(
        new AuthorizationError(`Required role: ${roles.join(' or ')}`)
      );
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
