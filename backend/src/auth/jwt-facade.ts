import * as crypto from 'crypto';

import { AppError } from '@medianest/shared';
import * as jwt from 'jsonwebtoken';

import { configService } from '../config/config.service';
import { logger } from '../utils/logger';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  plexId?: string;
  sessionId?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  tokenVersion?: number;
  iat?: number;
  jti?: string;
}

export interface JWTOptions {
  expiresIn?: string;
  issuer?: string;
  audience?: string;
  sessionId?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface TokenRotationInfo {
  newToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface TokenMetadata {
  userId?: string;
  sessionId?: string;
  deviceId?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  tokenId?: string;
}

/**
 * Simplified JWT Facade - consolidates all JWT operations
 */
export class JWTFacade {
  private readonly jwtSecret: string;
  private readonly jwtSecretRotation?: string;
  private readonly jwtIssuer: string;
  private readonly jwtAudience: string;
  private readonly tokenBlacklist = new Set<string>();

  // Token expiry constants
  private readonly DEFAULT_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly REMEMBER_ME_TOKEN_EXPIRY = '30d';
  private readonly TOKEN_ROTATION_THRESHOLD = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const jwtConfig = configService.getAuthConfig();
    this.jwtSecret = jwtConfig.JWT_SECRET;
    this.jwtSecretRotation = jwtConfig.JWT_SECRET_ROTATION;
    this.jwtIssuer = jwtConfig.JWT_ISSUER;
    this.jwtAudience = jwtConfig.JWT_AUDIENCE;

    this.validateConfiguration();
  }

  /**
   * Validate JWT configuration at startup
   */
  private validateConfiguration(): void {
    if (!this.jwtSecret || this.jwtSecret === 'dev-secret') {
      throw new Error(
        'JWT_SECRET is required and cannot be the default dev value. Generate one with: openssl rand -base64 32',
      );
    }
  }

  /**
   * Generate access token with enhanced security metadata
   */
  generateToken(payload: JWTPayload, rememberMe: boolean = false, options?: JWTOptions): string {
    const expiresIn = rememberMe ? this.REMEMBER_ME_TOKEN_EXPIRY : this.DEFAULT_TOKEN_EXPIRY;

    const enhancedPayload: JWTPayload = {
      ...payload,
      sessionId: options?.sessionId || this.generateSecureId(),
      deviceId: options?.deviceId,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent ? this.hashUserAgent(options.userAgent) : undefined,
      tokenVersion: 1,
      iat: Math.floor(Date.now() / 1000),
      jti: this.generateSecureId(),
    };

    const tokenOptions = {
      expiresIn: options?.expiresIn || expiresIn,
      issuer: options?.issuer || this.jwtIssuer,
      audience: options?.audience || this.jwtAudience,
      algorithm: 'HS256' as const,
      notBefore: '0s',
    } as jwt.SignOptions;

    const token = jwt.sign(enhancedPayload, this.jwtSecret, tokenOptions);

    logger.info('JWT token generated', {
      userId: payload.userId,
      sessionId: enhancedPayload.sessionId,
      expiresIn,
      rememberMe,
      ipAddress: options?.ipAddress,
    });

    return token;
  }

  /**
   * Verify token with optional rotation support
   */
  verifyToken(
    token: string,
    options?: {
      allowRotation?: boolean;
      ipAddress?: string;
      userAgent?: string;
    },
  ): JWTPayload {
    try {
      let decoded = this.verifyWithSecret(token, this.jwtSecret);

      // Try rotation secret if primary verification fails
      if (!decoded && this.jwtSecretRotation && options?.allowRotation) {
        decoded = this.verifyWithSecret(token, this.jwtSecretRotation);
        if (decoded) {
          logger.info('Token verified with rotation secret', {
            userId: decoded.userId,
            sessionId: decoded.sessionId,
          });
        }
      }

      if (!decoded) {
        throw new AppError('INVALID_TOKEN', 'Invalid token', 401);
      }

      // Additional security validations
      this.validateTokenSecurity(decoded, options);

      return decoded;
    } catch (error: unknown) {
      const err = error as Error;
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError('TOKEN_EXPIRED', 'Token has expired', 401);
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new AppError('INVALID_TOKEN', 'Invalid token', 401);
      }
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError('TOKEN_VERIFICATION_FAILED', 'Token verification failed', 401);
    }
  }

  /**
   * Generate refresh token (structured or random)
   */
  generateRefreshToken(payload?: { userId: string; sessionId: string }): string {
    if (payload) {
      const refreshPayload = {
        userId: payload.userId,
        sessionId: payload.sessionId,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
        jti: this.generateSecureId(),
      };

      return jwt.sign(refreshPayload, this.jwtSecret, {
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        issuer: this.jwtIssuer,
        audience: this.jwtAudience,
        algorithm: 'HS256',
      });
    }

    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(refreshToken: string): { userId: string; sessionId: string } {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret, {
        issuer: this.jwtIssuer,
        audience: this.jwtAudience,
        algorithms: ['HS256'],
      }) as jwt.JwtPayload & { type: string; userId: string; sessionId: string };

      if (decoded.type !== 'refresh') {
        throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid refresh token type', 401);
      }

      return {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
      };
    } catch (error: unknown) {
      const err = error as Error;
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError('REFRESH_TOKEN_EXPIRED', 'Refresh token has expired', 401);
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid refresh token', 401);
      }
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(
        'REFRESH_TOKEN_VERIFICATION_FAILED',
        'Refresh token verification failed',
        401,
      );
    }
  }

  /**
   * Get comprehensive token metadata
   */
  getTokenMetadata(token: string): TokenMetadata {
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload | null;
      if (!decoded) return {};

      return {
        userId: (decoded as any).userId,
        sessionId: (decoded as any).sessionId,
        deviceId: (decoded as any).deviceId,
        issuedAt: decoded.iat ? new Date(decoded.iat * 1000) : undefined,
        expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : undefined,
        tokenId: (decoded as any).jti,
      };
    } catch {
      return {};
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const metadata = this.getTokenMetadata(token);
    if (!metadata.expiresAt) return true;
    return metadata.expiresAt < new Date();
  }

  /**
   * Check if token needs rotation
   */
  shouldRotateToken(token: string): boolean {
    const metadata = this.getTokenMetadata(token);
    if (!metadata.expiresAt) return true;

    const timeUntilExpiry = metadata.expiresAt.getTime() - Date.now();
    return timeUntilExpiry <= this.TOKEN_ROTATION_THRESHOLD;
  }

  /**
   * Rotate token if needed
   */
  rotateTokenIfNeeded(
    token: string,
    payload: JWTPayload,
    options?: JWTOptions,
  ): TokenRotationInfo | null {
    if (!this.shouldRotateToken(token)) {
      return null;
    }

    const newToken = this.generateToken(payload, false, options);
    const refreshToken = this.generateRefreshToken({
      userId: payload.userId,
      sessionId: payload.sessionId || this.generateSecureId(),
    });
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    logger.info('Token rotated', {
      userId: payload.userId,
      sessionId: payload.sessionId,
      oldTokenExpiry: this.getTokenMetadata(token).expiresAt,
      newTokenExpiry: expiresAt,
    });

    return { newToken, refreshToken, expiresAt };
  }

  /**
   * Blacklist token
   */
  blacklistToken(tokenId: string): void {
    this.tokenBlacklist.add(tokenId);
    logger.info('Token blacklisted', { tokenId });
  }

  /**
   * Check if token is blacklisted
   */
  isTokenBlacklisted(tokenId: string): boolean {
    return this.tokenBlacklist.has(tokenId);
  }

  /**
   * Decode token without verification
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Private: Verify token with specific secret
   */
  private verifyWithSecret(token: string, secret: string): JWTPayload | null {
    try {
      return jwt.verify(token, secret, {
        issuer: this.jwtIssuer,
        audience: this.jwtAudience,
        algorithms: ['HS256'],
      }) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Private: Validate token security context
   */
  private validateTokenSecurity(
    decoded: JWTPayload,
    options?: { ipAddress?: string; userAgent?: string },
  ): void {
    if (!options) return;

    // Verify IP address if provided
    if (options.ipAddress && decoded.ipAddress && decoded.ipAddress !== options.ipAddress) {
      logger.warn('Token IP address mismatch', {
        userId: decoded.userId,
        tokenIP: decoded.ipAddress,
        requestIP: options.ipAddress,
        sessionId: decoded.sessionId,
      });
      throw new AppError('TOKEN_IP_MISMATCH', 'Token IP mismatch', 401);
    }

    // Verify user agent hash if provided
    if (options.userAgent && decoded.userAgent) {
      const hashedUA = this.hashUserAgent(options.userAgent);
      if (hashedUA !== decoded.userAgent) {
        logger.warn('Token user agent mismatch', {
          userId: decoded.userId,
          sessionId: decoded.sessionId,
        });
        // Don't fail on user agent mismatch, just log for monitoring
      }
    }
  }

  /**
   * Private: Generate secure ID
   */
  private generateSecureId(length: number = 16): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Private: Hash user agent for privacy
   */
  private hashUserAgent(userAgent: string): string {
    return crypto.createHash('sha256').update(userAgent).digest('hex').substring(0, 16);
  }
}

// Export singleton instance
export const jwtFacade = new JWTFacade();

// Export legacy functions for backward compatibility
export function generateToken(
  payload: JWTPayload,
  rememberMe?: boolean,
  options?: JWTOptions,
): string {
  return jwtFacade.generateToken(payload, rememberMe, options);
}

export function verifyToken(
  token: string,
  options?: { allowRotation?: boolean; ipAddress?: string; userAgent?: string },
): JWTPayload {
  return jwtFacade.verifyToken(token, options);
}

export function generateRefreshToken(payload?: { userId: string; sessionId: string }): string {
  return jwtFacade.generateRefreshToken(payload);
}

export function verifyRefreshToken(refreshToken: string): { userId: string; sessionId: string } {
  return jwtFacade.verifyRefreshToken(refreshToken);
}

export function getTokenMetadata(token: string): TokenMetadata {
  return jwtFacade.getTokenMetadata(token);
}

export function isTokenExpired(token: string): boolean {
  return jwtFacade.isTokenExpired(token);
}

export function shouldRotateToken(token: string): boolean {
  return jwtFacade.shouldRotateToken(token);
}

export function rotateTokenIfNeeded(
  token: string,
  payload: JWTPayload,
  options?: JWTOptions,
): TokenRotationInfo | null {
  return jwtFacade.rotateTokenIfNeeded(token, payload, options);
}

export function blacklistToken(tokenId: string): void {
  return jwtFacade.blacklistToken(tokenId);
}

export function isTokenBlacklisted(tokenId: string): boolean {
  return jwtFacade.isTokenBlacklisted(tokenId);
}

export function decodeToken(token: string): JWTPayload | null {
  return jwtFacade.decodeToken(token);
}

// Legacy exports
export function getTokenExpiry(token: string): Date | null {
  return jwtFacade.getTokenMetadata(token).expiresAt || null;
}

export function getTokenIssuedAt(token: string): Date | null {
  return jwtFacade.getTokenMetadata(token).issuedAt || null;
}
