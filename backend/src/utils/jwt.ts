import { randomBytes } from 'crypto';

import jwt from 'jsonwebtoken';

import { AppError } from './errors';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  plexId?: string;
}

interface JWTOptions {
  expiresIn?: string | number;
  issuer?: string;
  audience?: string;
}

// Get JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'medianest';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'medianest-users';

// Default expiry times
const DEFAULT_TOKEN_EXPIRY = '24h';
const REMEMBER_ME_TOKEN_EXPIRY = '30d';

export function generateToken(
  payload: JWTPayload,
  rememberMe: boolean = false,
  options?: JWTOptions,
): string {
  const expiresIn = rememberMe ? REMEMBER_ME_TOKEN_EXPIRY : DEFAULT_TOKEN_EXPIRY;

  const tokenOptions: jwt.SignOptions = {
    expiresIn: (options?.expiresIn || expiresIn) as string | number | undefined,
    issuer: options?.issuer || JWT_ISSUER,
    audience: options?.audience || JWT_AUDIENCE,
    algorithm: 'HS256',
  };

  return jwt.sign(payload, JWT_SECRET, tokenOptions);
}

export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'],
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Token has expired', 401, 'TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }
    throw new AppError('Token verification failed', 401, 'TOKEN_VERIFICATION_FAILED');
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
  // Generate a random refresh token
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
