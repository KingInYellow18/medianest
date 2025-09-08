import jwt from 'jsonwebtoken';

import { config } from '@/config';

export interface JwtPayload {
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

export class JwtService {
  private readonly secret: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor() {
    if (!config.jwt?.secret) {
      throw new Error('JWT_SECRET is required for authentication');
    }

    this.secret = config.jwt.secret;
    this.issuer = config.jwt?.issuer || 'medianest';
    this.audience = config.jwt?.audience || 'medianest-users';
  }

  generateAccessToken(payload: JwtPayload): string {
    // Ensure required fields are present
    if (!payload.userId || !payload.email || !payload.role) {
      throw new Error('JWT payload must include userId, email, and role');
    }

    return jwt.sign(payload, this.secret, {
      expiresIn: '24h',
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  generateRememberToken(payload: JwtPayload): string {
    // Ensure required fields are present
    if (!payload.userId || !payload.email || !payload.role) {
      throw new Error('JWT payload must include userId, email, and role');
    }

    return jwt.sign(payload, this.secret, {
      expiresIn: '90d',
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  verifyToken(token: string): JwtPayload {
    const decoded = jwt.verify(token, this.secret, {
      issuer: this.issuer,
      audience: this.audience,
    }) as JwtPayload;

    // Validate that decoded token has required fields
    if (!decoded.userId) {
      throw new Error('Invalid token: missing userId');
    }

    // For backward compatibility, provide defaults for missing fields
    const validatedPayload: JwtPayload = {
      userId: decoded.userId,
      email: decoded.email || '',
      role: decoded.role || 'user',
      plexId: decoded.plexId,
      sessionId: decoded.sessionId,
      deviceId: decoded.deviceId,
      ipAddress: decoded.ipAddress,
      userAgent: decoded.userAgent,
      tokenVersion: decoded.tokenVersion,
      iat: decoded.iat,
      jti: decoded.jti,
    };

    return validatedPayload;
  }
}

export const jwtService = new JwtService();
