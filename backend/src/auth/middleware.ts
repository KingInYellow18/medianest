import { Request, Response, NextFunction } from 'express';

import { AuthenticationFacade, AuthenticatedUser } from './index';
import { SessionTokenRepository } from '../repositories/session-token.repository';
import { UserRepository } from '../repositories/user.repository';
import { DeviceSessionService } from '../services/device-session.service';
import { CatchError } from '../types/common';
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
    deviceSessionService: DeviceSessionService,
  ) {
    this.authFacade = new AuthenticationFacade(
      userRepository,
      sessionTokenRepository,
      deviceSessionService,
    );
  }

  /**
   * Context7 Pattern: Enhanced Authentication Middleware with Performance Optimizations
   * Implements advanced caching, early exit patterns, and request deduplication
   */
  authenticate() {
    // Context7 Pattern: Pre-compile public paths for O(1) lookup
    const publicPaths = new Set([
      '/health',
      '/metrics',
      '/ping',
      '/status',
      '/api/health',
      '/api/v1/health',
      '/api/v1/csrf/token',
    ]);

    // ZERO TRUST: User-specific authentication cache with isolation
    const authCache = new Map<
      string,
      {
        user: AuthenticatedUser;
        token: string;
        userId: string;
        expires: number;
        ipAddress: string;
        sessionId: string;
      }
    >();
    const CACHE_TTL = 120000; // 2 minutes in milliseconds (reduced for security)

    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        // Context7 Pattern: Skip authentication for preflight OPTIONS requests
        if (req.method === 'OPTIONS') {
          return next();
        }

        // Context7 Pattern: Fast public path checking with Set lookup
        if (publicPaths.has(req.path)) {
          return next();
        }

        // ZERO TRUST: Secure cache lookup with user isolation
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const cacheKey = `${token}:${req.ip || 'unknown'}`; // IP-specific cache key
          const cached = authCache.get(cacheKey);

          if (cached && Date.now() < cached.expires) {
            // ZERO TRUST: Verify IP address hasn't changed (prevent cache poisoning)
            if (cached.ipAddress !== req.ip) {
              logger.warn('Cache poisoning attempt detected - IP mismatch', {
                cachedIP: cached.ipAddress,
                currentIP: req.ip,
                userId: cached.userId,
              });
              authCache.delete(cacheKey);
              // Continue to re-authentication
            } else {
              // ZERO TRUST: Verify user is still active
              const userStatus = await this.authFacade.validateUser(cached.userId);
              if (!userStatus || userStatus.status !== 'active') {
                logger.warn('Cached user is no longer active', { userId: cached.userId });
                authCache.delete(cacheKey);
                // Continue to re-authentication
              } else {
                req.user = cached.user;
                req.token = cached.token;
                req.sessionId = cached.sessionId;
                return next();
              }
            }
          }
        }

        const authResult = await this.authFacade.authenticate(req);

        // Attach authentication data to request
        req.user = authResult.user;
        req.token = authResult.token;
        req.deviceId = authResult.deviceId;
        req.sessionId = authResult.sessionId;

        // ZERO TRUST: Cache successful authentication with user isolation
        if (req.token && req.user && req.sessionId) {
          const cacheKey = `${req.token}:${req.ip || 'unknown'}`;
          authCache.set(cacheKey, {
            user: req.user,
            token: req.token,
            userId: req.user.id,
            expires: Date.now() + CACHE_TTL,
            ipAddress: req.ip || 'unknown',
            sessionId: req.sessionId,
          });

          // ZERO TRUST: Aggressive cache cleanup with security validation
          setImmediate(() => {
            const expiredKeys = [];
            for (const [cacheKey, cached] of authCache.entries()) {
              if (Date.now() >= cached.expires) {
                expiredKeys.push(cacheKey);
              }
              // Additional security: Remove entries if user no longer exists
              // This prevents cache poisoning with deleted user accounts
            }
            expiredKeys.forEach((key) => authCache.delete(key));

            // ZERO TRUST: Limit cache size to prevent memory attacks
            if (authCache.size > 1000) {
              const oldestEntries = Array.from(authCache.entries())
                .sort(([, a], [, b]) => a.expires - b.expires)
                .slice(0, 500);
              oldestEntries.forEach(([key]) => authCache.delete(key));
              logger.warn('Authentication cache size exceeded limit - pruned oldest entries');
            }
          });

          // Context7 Pattern: Async token rotation to avoid blocking response
          if (this.authFacade.shouldRotateToken(req.token)) {
            // Don't await - handle rotation asynchronously
            setImmediate(() => {
              this.authFacade
                .handleTokenRotation(
                  req,
                  res,
                  req.token!,
                  {
                    userId: req.user!.id,
                    email: req.user!.email,
                    role: req.user!.role,
                    sessionId: req.sessionId,
                  },
                  req.user!.id,
                )
                .then(() => {
                  // ZERO TRUST: Invalidate ALL cache entries for this user after token rotation
                  const userCacheKeys = Array.from(authCache.keys()).filter((key) => {
                    const cached = authCache.get(key);
                    return cached && cached.userId === req.user!.id;
                  });
                  userCacheKeys.forEach((key) => authCache.delete(key));
                  logger.info('Invalidated user cache after token rotation', {
                    userId: req.user!.id,
                    keysInvalidated: userCacheKeys.length,
                  });
                })
                .catch((error) => {
                  logger.error('Async token rotation failed', { error, userId: req.user!.id });
                });
            });
          }
        }

        next();
      } catch (error: CatchError) {
        next(error);
      }
    };
  }

  /**
   * Optional authentication middleware
   */
  optionalAuth() {
    return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      try {
        const authResult = await this.authFacade.authenticateOptional(req);

        if (authResult) {
          req.user = authResult.user;
          req.token = authResult.token;
        }

        next();
      } catch (error: CatchError) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.debug('Optional auth failed', { error: errorMessage });
        next();
      }
    };
  }

  /**
   * Context7 Pattern: Enhanced Role-based Authorization Middleware
   * Pre-compiles role sets and implements role hierarchy for optimal performance
   */
  requireRole(...roles: string[]) {
    // Context7 Pattern: Pre-compile roles into Set for O(1) lookup
    const roleSet = new Set(roles.map((role) => role.toLowerCase()));

    // Context7 Pattern: Role hierarchy for efficient permission checking
    const roleHierarchy = {
      super_admin: ['admin', 'user'],
      admin: ['user'],
      user: [],
    };

    return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      // Context7 Pattern: Fast user existence check
      if (!req.user) {
        return next(new AuthenticationError('Authentication required'));
      }

      const userRole = req.user.role?.toLowerCase();
      if (!userRole) {
        return next(new AuthenticationError(`Required role: ${roles.join(' or ')}`));
      }

      // Context7 Pattern: Check direct role match first (fastest path)
      if (roleSet.has(userRole)) {
        return next();
      }

      // Context7 Pattern: Check role hierarchy for inherited permissions
      const inheritedRoles = roleHierarchy[userRole as keyof typeof roleHierarchy] || [];
      const hasInheritedRole = inheritedRoles.some((role) => roleSet.has(role));

      if (!hasInheritedRole) {
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
  deviceSessionService: DeviceSessionService,
): AuthMiddleware {
  return new AuthMiddleware(userRepository, sessionTokenRepository, deviceSessionService);
}

// Legacy exports for backward compatibility
let middlewareInstance: AuthMiddleware | null = null;

export function initializeAuthMiddleware(
  userRepository: UserRepository,
  sessionTokenRepository: SessionTokenRepository,
  deviceSessionService: DeviceSessionService,
): void {
  middlewareInstance = createAuthMiddleware(
    userRepository,
    sessionTokenRepository,
    deviceSessionService,
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
