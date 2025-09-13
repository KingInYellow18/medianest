/**
 * Authentication Middleware - JWT-based authentication and authorization
 *
 * This module provides comprehensive authentication middleware for the MediaNest application:
 * - JWT token validation and rotation
 * - Role-based access control (RBAC)
 * - Optional authentication for public endpoints
 * - Session management and device tracking
 * - Request logging for authenticated users
 *
 * @fileoverview Express middleware for authentication and authorization
 * @version 2.0.0
 * @author MediaNest Team
 * @since 1.0.0
 */

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

/**
 * Repository instances with proper Prisma client injection
 * @description Initialize all authentication-related repositories and services
 */
const userRepository = new UserRepository(prisma);
const sessionTokenRepository = new SessionTokenRepository(prisma);
const deviceSessionService = new DeviceSessionService(userRepository, sessionTokenRepository);

/**
 * Authentication facade instance
 * @description Unified authentication facade that orchestrates all auth operations
 */
const authFacade = new AuthenticationFacade(
  userRepository,
  sessionTokenRepository,
  deviceSessionService,
);

/**
 * Primary authentication middleware
 *
 * @function authMiddleware
 * @description Validates JWT tokens, attaches user data to request, and handles token rotation
 * @returns {Function} Express middleware function
 *
 * @example
 * // Protect a route with authentication
 * router.get('/protected', authMiddleware(), (req, res) => {
 *   res.json({ user: req.user });
 * });
 *
 * @example
 * // Chain with role-based access control
 * router.delete('/admin', authMiddleware(), requireAdmin(), adminController.deleteUser);
 *
 * @middleware
 * - Extracts JWT token from Authorization header or cookies
 * - Validates token signature and expiration
 * - Attaches user, token, deviceId, and sessionId to request object
 * - Performs automatic token rotation when needed
 * - Handles device session tracking
 *
 * @throws {AuthenticationError} When token is invalid, expired, or missing
 * @throws {AuthenticationError} When user account is disabled or deleted
 *
 * @security Uses secure token rotation to prevent token replay attacks
 * @security Tracks device sessions for multi-device support
 * @version 2.0.0
 */
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

/**
 * Backward compatibility alias for authMiddleware
 * @deprecated Use authMiddleware() instead for clarity
 * @alias authMiddleware
 */
export const authenticate = authMiddleware;

/**
 * Role-based access control middleware
 *
 * @function requireRole
 * @description Ensures the authenticated user has one of the specified roles
 * @param {...string} roles - Array of acceptable role names
 * @returns {Function} Express middleware function
 *
 * @example
 * // Require admin or moderator role
 * router.get('/moderate', authMiddleware(), requireRole('admin', 'moderator'), handler);
 *
 * @example
 * // Require specific role
 * router.delete('/system', authMiddleware(), requireRole('admin'), systemController.reset);
 *
 * @throws {AuthenticationError} When user is not authenticated
 * @throws {AuthenticationError} When user lacks required role
 *
 * @security Must be used after authMiddleware() to ensure user is authenticated
 * @version 2.0.0
 */
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

/**
 * Admin role requirement middleware
 *
 * @function requireAdmin
 * @description Convenience middleware for requiring admin access
 * @returns {Function} Express middleware function that requires 'admin' or 'ADMIN' role
 *
 * @example
 * // Protect admin-only endpoint
 * router.get('/admin/users', authMiddleware(), requireAdmin(), adminController.getAllUsers);
 *
 * @throws {AuthenticationError} When user is not authenticated
 * @throws {AuthenticationError} When user is not an administrator
 *
 * @security Accepts both 'admin' and 'ADMIN' role variants for flexibility
 * @version 2.0.0
 */
export function requireAdmin() {
  return requireRole('admin', 'ADMIN');
}

/**
 * User role requirement middleware
 *
 * @function requireUser
 * @description Convenience middleware for requiring user or admin access
 * @returns {Function} Express middleware function that accepts user or admin roles
 *
 * @example
 * // Allow both users and admins
 * router.get('/profile', authMiddleware(), requireUser(), userController.getProfile);
 *
 * @throws {AuthenticationError} When user is not authenticated
 * @throws {AuthenticationError} When user has no valid role
 *
 * @security Accepts 'user', 'USER', 'admin', and 'ADMIN' role variants
 * @version 2.0.0
 */
export function requireUser() {
  return requireRole('user', 'USER', 'admin', 'ADMIN');
}

/**
 * Optional authentication middleware
 *
 * @function optionalAuth
 * @description Attempts authentication but continues if it fails (for public endpoints with optional user context)
 * @returns {Function} Express middleware function
 *
 * @example
 * // Public endpoint that shows different content for authenticated users
 * router.get('/public-content', optionalAuth(), (req, res) => {
 *   if (req.user) {
 *     res.json({ content: 'personalized', user: req.user.email });
 *   } else {
 *     res.json({ content: 'public' });
 *   }
 * });
 *
 * @example
 * // CSRF token generation (works for both authenticated and anonymous users)
 * router.get('/csrf-token', optionalAuth(), csrfController.generateToken);
 *
 * @middleware
 * - Attempts to validate JWT token if present
 * - Attaches user data to request if authentication succeeds
 * - Continues processing even if authentication fails
 * - Logs authentication failures for debugging
 *
 * @security Does not throw errors on authentication failure
 * @security Suitable for public endpoints that benefit from user context
 * @version 2.0.0
 */
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

/**
 * Authenticated request logging middleware
 *
 * @function logAuthenticatedRequest
 * @description Logs request details for authenticated users (security audit trail)
 * @returns {Function} Express middleware function
 *
 * @example
 * // Add audit logging to sensitive endpoints
 * router.delete('/user/:id', authMiddleware(), requireAdmin(), logAuthenticatedRequest(), userController.deleteUser);
 *
 * @example
 * // Log all authenticated requests in an admin section
 * router.use('/admin/*', authMiddleware(), requireAdmin(), logAuthenticatedRequest());
 *
 * @middleware
 * - Logs user ID, request method, path, and IP address
 * - Only logs if user is authenticated (req.user exists)
 * - Uses structured logging for easy parsing and analysis
 *
 * @security Provides audit trail for authenticated actions
 * @security Logs IP addresses for security monitoring
 * @version 2.0.0
 */
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
