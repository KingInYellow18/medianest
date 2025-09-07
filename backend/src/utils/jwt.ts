// @ts-nocheck
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import { AppError } from './errors';
import { logger } from './logger';

interface JWTPayload {
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

interface JWTOptions {
  expiresIn?: string | number;
  issuer?: string;
  audience?: string;
  sessionId?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface TokenRotationInfo {
  newToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// Get JWT secret from environment - MUST be provided, no fallbacks
if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. Generate one with: openssl rand -base64 32'
  );
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_SECRET_ROTATION = process.env.JWT_SECRET_ROTATION;
const JWT_ISSUER = process.env.JWT_ISSUER || 'medianest';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'medianest-users';

// Default expiry times
const DEFAULT_TOKEN_EXPIRY = '15m'; // Shorter for security
const REFRESH_TOKEN_EXPIRY = '7d';
const REMEMBER_ME_TOKEN_EXPIRY = '30d';
const TOKEN_ROTATION_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

export function generateToken(
  payload: JWTPayload,
  rememberMe: boolean = false,
  options?: JWTOptions
): string {
  const expiresIn = rememberMe ? REMEMBER_ME_TOKEN_EXPIRY : DEFAULT_TOKEN_EXPIRY;

  // Enhanced payload with security metadata
  const enhancedPayload: JWTPayload = {
    ...payload,
    sessionId: options?.sessionId || generateSecureId(),
    deviceId: options?.deviceId,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent ? hashUserAgent(options.userAgent) : undefined,
    tokenVersion: 1,
    iat: Math.floor(Date.now() / 1000),
    jti: generateSecureId(), // JWT ID for tracking
  };

  const tokenOptions: jwt.SignOptions = {
    expiresIn: options?.expiresIn || expiresIn,
    issuer: options?.issuer || JWT_ISSUER,
    audience: options?.audience || (JWT_AUDIENCE as any),
    algorithm: 'HS256',
    notBefore: '0s', // Token valid immediately
  };

  const token = jwt.sign(enhancedPayload, JWT_SECRET, tokenOptions);

  // Log token generation for security audit
  logger.info('JWT token generated', {
    userId: payload.userId,
    sessionId: enhancedPayload.sessionId,
    expiresIn,
    rememberMe,
    ipAddress: options?.ipAddress,
  });

  return token;
}

export function verifyToken(
  token: string,
  options?: {
    allowRotation?: boolean;
    ipAddress?: string;
    userAgent?: string;
  }
): JWTPayload {
  try {
    let decoded: JWTPayload;

    try {
      // Try with current secret first
      decoded = jwt.verify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithms: ['HS256'],
      }) as JWTPayload;
    } catch (error: any) {
      // If rotation secret exists, try with old secret
      if (JWT_SECRET_ROTATION && error instanceof jwt.JsonWebTokenError) {
        try {
          decoded = jwt.verify(token, JWT_SECRET_ROTATION, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
            algorithms: ['HS256'],
          }) as JWTPayload;

          logger.info('Token verified with rotation secret', {
            userId: decoded.userId,
            sessionId: decoded.sessionId,
          });
        } catch {
          throw error; // Throw original error if both secrets fail
        }
      } else {
        throw error;
      }
    }

    // Additional security validations
    if (options) {
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
        const hashedUA = hashUserAgent(options.userAgent);
        if (hashedUA !== decoded.userAgent) {
          logger.warn('Token user agent mismatch', {
            userId: decoded.userId,
            sessionId: decoded.sessionId,
          });
          // Don't fail on user agent mismatch, just log for monitoring
        }
      }
    }

    return decoded;
  } catch (error: any) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('TOKEN_EXPIRED', 'Token has expired', 401);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('INVALID_TOKEN', 'Invalid token', 401);
    }
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('TOKEN_VERIFICATION_FAILED', 'Token verification failed', 401);
  }
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(payload?: { userId: string; sessionId: string }): string {
  if (payload) {
    // Generate structured refresh token with payload
    const refreshPayload = {
      userId: payload.userId,
      sessionId: payload.sessionId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      jti: generateSecureId(),
    };

    return jwt.sign(refreshPayload, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256',
    });
  } else {
    // Generate a random refresh token
    return crypto.randomBytes(32).toString('hex');
  }
}

export function getTokenExpiry(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as any;
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  } catch {
    return null;
  }
}

// Get token issued at time
export function getTokenIssuedAt(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as any;
    if (decoded && decoded.iat) {
      return new Date(decoded.iat * 1000);
    }
    return null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;
  return expiry < new Date();
}

// Check if token needs rotation
export function shouldRotateToken(token: string): boolean {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;

  const timeUntilExpiry = expiry.getTime() - Date.now();
  return timeUntilExpiry <= TOKEN_ROTATION_THRESHOLD;
}

// Rotate token if needed
export function rotateTokenIfNeeded(
  token: string,
  payload: JWTPayload,
  options?: JWTOptions
): TokenRotationInfo | null {
  if (!shouldRotateToken(token)) {
    return null;
  }

  const newToken = generateToken(payload, false, options);
  const refreshToken = generateRefreshToken({
    userId: payload.userId,
    sessionId: payload.sessionId || generateSecureId(),
  });
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  logger.info('Token rotated', {
    userId: payload.userId,
    sessionId: payload.sessionId,
    oldTokenExpiry: getTokenExpiry(token),
    newTokenExpiry: expiresAt,
  });

  return {
    newToken,
    refreshToken,
    expiresAt,
  };
}

// Verify refresh token
export function verifyRefreshToken(refreshToken: string): { userId: string; sessionId: string } {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'],
    }) as any;

    if (decoded.type !== 'refresh') {
      throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid refresh token type', 401);
    }

    return {
      userId: decoded.userId,
      sessionId: decoded.sessionId,
    };
  } catch (error: any) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('REFRESH_TOKEN_EXPIRED', 'Refresh token has expired', 401);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid refresh token', 401);
    }
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      'REFRESH_TOKEN_VERIFICATION_FAILED',
      'Refresh token verification failed',
      401
    );
  }
}

// Generate secure ID
function generateSecureId(length: number = 16): string {
  return crypto.randomBytes(length).toString('base64url');
}

// Hash user agent for privacy
function hashUserAgent(userAgent: string): string {
  return crypto.createHash('sha256').update(userAgent).digest('hex').substring(0, 16);
}

// Blacklist token (would typically be stored in Redis)
const tokenBlacklist = new Set<string>();

export function blacklistToken(tokenId: string): void {
  tokenBlacklist.add(tokenId);
  logger.info('Token blacklisted', { tokenId });
}

export function isTokenBlacklisted(tokenId: string): boolean {
  return tokenBlacklist.has(tokenId);
}

// Get token metadata
export function getTokenMetadata(token: string): {
  userId?: string;
  sessionId?: string;
  deviceId?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  tokenId?: string;
} {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded) return {};

    return {
      userId: decoded.userId,
      sessionId: decoded.sessionId,
      deviceId: decoded.deviceId,
      issuedAt: decoded.iat ? new Date(decoded.iat * 1000) : undefined,
      expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : undefined,
      tokenId: decoded.jti,
    };
  } catch {
    return {};
  }
}
