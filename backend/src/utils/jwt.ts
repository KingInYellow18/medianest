import { randomBytes } from 'crypto';

import jwt from 'jsonwebtoken';

import { getJWTConfig } from '../config';

import { AppError } from '@medianest/shared';

interface JWTPayload {
  userId: string;
  email?: string;
  role: string;
  plexId?: string;
}

interface JWTOptions {
  expiresIn?: string | number;
  issuer?: string;
  audience?: string;
}

// Default expiry times
const DEFAULT_TOKEN_EXPIRY = '24h';
const REMEMBER_ME_TOKEN_EXPIRY = '30d';

/**
 * Get JWT configuration from centralized config
 */
const getJWTSettings = () => {
  const config = getJWTConfig();
  return {
    secret: config.secret,
    issuer: config.issuer,
    audience: config.audience,
    defaultExpiry: config.expiresIn || DEFAULT_TOKEN_EXPIRY,
  };
};

export function generateToken(
  payload: JWTPayload,
  rememberMe: boolean = false,
  options?: JWTOptions,
): string {
  const settings = getJWTSettings();
  const expiresIn = rememberMe ? REMEMBER_ME_TOKEN_EXPIRY : settings.defaultExpiry;

  const tokenOptions: jwt.SignOptions = {
    expiresIn: options?.expiresIn || expiresIn,
    issuer: options?.issuer || settings.issuer,
    audience: options?.audience || settings.audience,
    algorithm: 'HS256',
  };

  return jwt.sign(payload, settings.secret, tokenOptions);
}

export function verifyToken(token: string, options?: Partial<JWTOptions>): JWTPayload {
  try {
    const settings = getJWTSettings();

    const decoded = jwt.verify(token, settings.secret, {
      issuer: options?.issuer || settings.issuer,
      audience: options?.audience || settings.audience,
      algorithms: ['HS256'],
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('TOKEN_EXPIRED', 'Token has expired', 401);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('INVALID_TOKEN', 'Invalid token', 401);
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new AppError('TOKEN_NOT_ACTIVE', 'Token not active yet', 401);
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

export function generateRefreshToken(): string {
  // Generate a cryptographically secure random refresh token
  return randomBytes(32).toString('hex');
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

export function isTokenExpired(token: string): boolean {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;
  return expiry < new Date();
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

/**
 * Create a JWT token payload from user data
 */
export function createTokenPayload(user: {
  id: string;
  email?: string | null;
  role: string;
  plexId?: string | null;
}): JWTPayload {
  return {
    userId: user.id,
    email: user.email || undefined,
    role: user.role,
    plexId: user.plexId || undefined,
  };
}

/**
 * Validate JWT configuration at startup
 */
export function validateJWTConfig(): void {
  const settings = getJWTSettings();

  if (!settings.secret || settings.secret.length < 32) {
    throw new Error('JWT secret must be at least 32 characters long');
  }

  if (!settings.issuer) {
    throw new Error('JWT issuer is required');
  }

  if (!settings.audience) {
    throw new Error('JWT audience is required');
  }
}

/**
 * Get JWT configuration for external use (without secret)
 */
export function getJWTInfo() {
  const settings = getJWTSettings();
  return {
    issuer: settings.issuer,
    audience: settings.audience,
    defaultExpiry: settings.defaultExpiry,
  };
}
