import { Request, Response } from 'express';
import { UserRepository } from '../repositories/user.repository';
import { SessionTokenRepository } from '../repositories/session-token.repository';
import { DeviceSessionService } from '../services/device-session.service';
import { AuthenticationError, AppError } from '../utils/errors';
import { logger } from '../utils/logger';

// JWT utilities
import {
  generateToken,
  verifyToken,
  generateRefreshToken,
  verifyRefreshToken,
  getTokenMetadata,
  isTokenBlacklisted,
  blacklistToken,
  shouldRotateToken,
  rotateTokenIfNeeded,
  JWTPayload,
  JWTOptions,
  TokenRotationInfo,
} from '../utils/jwt';

// Token validation utilities
import {
  extractToken,
  extractTokenOptional,
  validateToken as validateTokenUtil,
  TokenValidationContext,
  TokenValidationResult,
} from '../middleware/auth/token-validator';

// User validation utilities
import {
  validateUser as validateUserUtil,
  validateUserOptional as validateUserOptionalUtil,
  AuthenticatedUser,
} from '../middleware/auth/user-validator';

// Device session utilities
import {
  validateSessionToken,
  registerAndAssessDevice,
  updateSessionActivity,
  SessionUpdateContext,
} from '../middleware/auth/device-session-manager';

// Token rotation utilities
import { handleTokenRotation, TokenRotationContext } from '../middleware/auth/token-rotator';

/**
 * Authentication Facade - Single entry point for all authentication operations
 * Consolidates JWT operations, user validation, session management, and authorization
 */
export class AuthenticationFacade {
  private userRepository: UserRepository;
  private sessionTokenRepository: SessionTokenRepository;
  private deviceSessionService: DeviceSessionService;

  constructor(
    userRepository: UserRepository,
    sessionTokenRepository: SessionTokenRepository,
    deviceSessionService: DeviceSessionService
  ) {
    this.userRepository = userRepository;
    this.sessionTokenRepository = sessionTokenRepository;
    this.deviceSessionService = deviceSessionService;
  }

  /**
   * Authenticate user with comprehensive validation
   * This is the main authentication method for middleware
   */
  async authenticate(req: Request): Promise<{
    user: AuthenticatedUser;
    token: string;
    deviceId: string;
    sessionId: string;
  }> {
    try {
      // Create validation context
      const context: TokenValidationContext = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      };

      // Validate token (extract, verify JWT, check blacklist)
      const { token, payload, metadata } = validateTokenUtil(req, context);

      // Validate user exists and is active
      const user = await validateUserUtil(payload.userId, this.userRepository, context);

      // Validate session token
      await validateSessionToken(token, metadata, this.sessionTokenRepository, {
        userId: payload.userId,
        ...context,
      });

      // Register device and assess risk
      const deviceRegistration = await registerAndAssessDevice(
        user.id,
        req,
        this.deviceSessionService
      );

      // Update session activity
      const sessionContext: SessionUpdateContext = {
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params,
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent') || '',
      };
      await updateSessionActivity(payload.sessionId, sessionContext, this.deviceSessionService);

      return {
        user,
        token,
        deviceId: deviceRegistration.deviceId,
        sessionId: payload.sessionId,
      };
    } catch (error: any) {
      logger.error('Authentication failed', { error: error.message, ip: req.ip });
      throw error;
    }
  }

  /**
   * Optional authentication - returns null if no valid authentication
   */
  async authenticateOptional(req: Request): Promise<{
    user: AuthenticatedUser;
    token: string;
  } | null> {
    try {
      // Extract token (returns null if not found)
      const token = extractTokenOptional(req);

      if (!token) {
        return null;
      }

      // Verify JWT token
      const payload = verifyToken(token);

      // Validate user (returns null if not found/inactive)
      const user = await validateUserOptionalUtil(payload.userId, this.userRepository);

      if (!user) {
        return null;
      }

      return { user, token };
    } catch (error: any) {
      logger.debug('Optional auth failed', { error: error.message });
      return null;
    }
  }

  /**
   * Authorize user for specific resource and action
   */
  authorize(user: AuthenticatedUser, resource: string, action: string): boolean {
    // Simple RBAC - can be extended with more complex rules
    const permissions = this.getRolePermissions(user.role);
    const permissionKey = `${resource}:${action}`;

    return permissions.includes(permissionKey) || permissions.includes('*:*');
  }

  /**
   * Validate token without full authentication flow
   */
  validateToken(
    token: string,
    options?: {
      allowRotation?: boolean;
      ipAddress?: string;
      userAgent?: string;
    }
  ): JWTPayload {
    return verifyToken(token, options);
  }

  /**
   * Refresh authentication tokens
   */
  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthenticatedUser;
  }> {
    try {
      // Verify refresh token
      const { userId, sessionId } = verifyRefreshToken(refreshToken);

      // Get user
      const user = await validateUserUtil(userId, this.userRepository, {});

      // Generate new tokens
      const newAccessToken = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId,
      });

      const newRefreshToken = generateRefreshToken({ userId: user.id, sessionId });

      logger.info('Token refreshed successfully', { userId: user.id, sessionId });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user,
      };
    } catch (error: any) {
      logger.error('Token refresh failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle token rotation if needed
   */
  async handleTokenRotation(
    req: Request,
    res: Response,
    token: string,
    payload: JWTPayload,
    userId: string
  ): Promise<void> {
    const rotationContext: TokenRotationContext = {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      sessionId: payload.sessionId,
      deviceId: payload.deviceId,
    };

    await handleTokenRotation(
      token,
      payload,
      userId,
      rotationContext,
      this.sessionTokenRepository,
      res
    );
  }

  /**
   * Logout user and invalidate tokens
   */
  async logout(token: string, sessionId?: string): Promise<void> {
    try {
      // Get token metadata
      const metadata = getTokenMetadata(token);

      // Blacklist the token
      if (metadata.tokenId) {
        blacklistToken(metadata.tokenId);
      }

      // Invalidate session if sessionId provided
      if (sessionId) {
        // This would typically update session status in database
        logger.info('Session invalidated', { sessionId });
      }

      logger.info('User logged out successfully', {
        userId: metadata.userId,
        sessionId: metadata.sessionId,
      });
    } catch (error: any) {
      logger.error('Logout failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get role-based permissions
   */
  private getRolePermissions(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      admin: ['*:*'], // Admin has all permissions
      ADMIN: ['*:*'],
      user: [
        'media:read',
        'media:stream',
        'dashboard:read',
        'profile:read',
        'profile:update',
        'plex:read',
        'youtube:read',
        'performance:read',
      ],
      USER: [
        'media:read',
        'media:stream',
        'dashboard:read',
        'profile:read',
        'profile:update',
        'plex:read',
        'youtube:read',
        'performance:read',
      ],
      guest: ['media:read', 'dashboard:read'],
      GUEST: ['media:read', 'dashboard:read'],
    };

    return rolePermissions[role] || [];
  }

  /**
   * Check if user has specific role
   */
  hasRole(user: AuthenticatedUser, ...roles: string[]): boolean {
    return roles.includes(user.role);
  }

  /**
   * Generate authentication tokens for user
   */
  generateTokens(
    user: AuthenticatedUser,
    rememberMe: boolean = false,
    options?: JWTOptions
  ): {
    accessToken: string;
    refreshToken: string;
  } {
    const accessToken = generateToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        plexId: user.plexId,
      },
      rememberMe,
      options
    );

    const refreshToken = generateRefreshToken({
      userId: user.id,
      sessionId: options?.sessionId || 'default',
    });

    return { accessToken, refreshToken };
  }

  /**
   * Get token information
   */
  getTokenInfo(token: string): {
    userId?: string;
    sessionId?: string;
    deviceId?: string;
    issuedAt?: Date;
    expiresAt?: Date;
    tokenId?: string;
  } {
    return getTokenMetadata(token);
  }

  /**
   * Check if token should be rotated
   */
  shouldRotateToken(token: string): boolean {
    return shouldRotateToken(token);
  }

  /**
   * Rotate token if needed
   */
  rotateTokenIfNeeded(
    token: string,
    payload: JWTPayload,
    options?: JWTOptions
  ): TokenRotationInfo | null {
    return rotateTokenIfNeeded(token, payload, options);
  }
}

// Export facade instance factory
export function createAuthenticationFacade(
  userRepository: UserRepository,
  sessionTokenRepository: SessionTokenRepository,
  deviceSessionService: DeviceSessionService
): AuthenticationFacade {
  return new AuthenticationFacade(userRepository, sessionTokenRepository, deviceSessionService);
}

// Export types
export type {
  AuthenticatedUser,
  JWTPayload,
  JWTOptions,
  TokenValidationContext,
  TokenValidationResult,
  TokenRotationInfo,
  SessionUpdateContext,
  TokenRotationContext,
};
