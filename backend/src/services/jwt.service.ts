import jwt from 'jsonwebtoken';

import { config } from '@/config';

export interface JwtPayload {
  userId: string;
  role: string;
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
    return jwt.sign(payload, this.secret, {
      expiresIn: '24h',
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  generateRememberToken(payload: JwtPayload): string {
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

    return decoded;
  }
}

export const jwtService = new JwtService();
