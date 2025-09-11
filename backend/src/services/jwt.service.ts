import jwt from 'jsonwebtoken';

import { config } from '@/config';

/**
 * JWT Payload interface defining the structure of JWT token claims
 * 
 * @interface JwtPayload
 * @description Defines all possible claims that can be included in JWT tokens
 * @version 2.0.0
 */
export interface JwtPayload {
  /** Unique identifier for the user */
  userId: string;
  /** User's email address */
  email: string;
  /** User's role (admin, user, etc.) */
  role: string;
  /** Optional Plex user identifier for media server integration */
  plexId?: string;
  /** Optional session identifier for tracking user sessions */
  sessionId?: string;
  /** Optional device identifier for multi-device support */
  deviceId?: string;
  /** Optional IP address where token was issued */
  ipAddress?: string;
  /** Optional user agent string for security tracking */
  userAgent?: string;
  /** Optional token version for invalidation support */
  tokenVersion?: number;
  /** Standard JWT issued at timestamp */
  iat?: number;
  /** Standard JWT unique identifier */
  jti?: string;
}

/**
 * JWT Service - Handles JSON Web Token operations
 * 
 * This service provides:
 * - Access token generation (24h expiry)
 * - Remember token generation (90d expiry)
 * - Token verification and validation
 * - Backward compatibility support
 * 
 * @class JwtService
 * @description Centralized JWT management for authentication and authorization
 * @version 2.0.0
 * @author MediaNest Team
 * 
 * @security Uses HS256 algorithm with configurable secrets
 * @security Validates issuer and audience claims
 * @security Provides token version support for revocation
 */
export class JwtService {
  /** JWT signing secret from configuration */
  private readonly secret: string;
  /** JWT issuer claim for token validation */
  private readonly issuer: string;
  /** JWT audience claim for token validation */
  private readonly audience: string;

  /**
   * Initialize JWT service with configuration
   * 
   * @constructor
   * @throws {Error} When JWT_SECRET is not configured
   * @description Sets up JWT signing parameters from application configuration
   */
  constructor() {
    if (!config.jwt?.secret) {
      throw new Error('JWT_SECRET is required for authentication');
    }

    this.secret = config.jwt.secret;
    this.issuer = config.jwt?.issuer || 'medianest';
    this.audience = config.jwt?.audience || 'medianest-users';
  }

  /**
   * Generate a short-lived access token
   * 
   * @method generateAccessToken
   * @description Creates a JWT token with 24-hour expiration for API access
   * @param {JwtPayload} payload - User information and claims to encode
   * @returns {string} Signed JWT token
   * 
   * @throws {Error} When required payload fields are missing (userId, email, role)
   * 
   * @example
   * const token = jwtService.generateAccessToken({
   *   userId: 'user123',
   *   email: 'user@example.com',
   *   role: 'user'
   * });
   * 
   * @security Token expires in 24 hours
   * @security Includes issuer and audience validation
   */
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

  /**
   * Generate a long-lived remember token
   * 
   * @method generateRememberToken
   * @description Creates a JWT token with 90-day expiration for persistent login
   * @param {JwtPayload} payload - User information and claims to encode
   * @returns {string} Signed JWT token
   * 
   * @throws {Error} When required payload fields are missing (userId, email, role)
   * 
   * @example
   * const rememberToken = jwtService.generateRememberToken({
   *   userId: 'user123',
   *   email: 'user@example.com',
   *   role: 'user',
   *   deviceId: 'device456'
   * });
   * 
   * @security Token expires in 90 days
   * @security Should be stored securely (httpOnly cookie)
   * @security Includes device tracking for security
   */
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

  /**
   * Verify and decode a JWT token
   * 
   * @method verifyToken
   * @description Validates JWT signature and claims, returns decoded payload
   * @param {string} token - JWT token to verify
   * @returns {JwtPayload} Decoded and validated token payload
   * 
   * @throws {Error} When token is invalid, expired, or malformed
   * @throws {Error} When issuer or audience claims don't match
   * @throws {Error} When required userId claim is missing
   * 
   * @example
   * try {
   *   const payload = jwtService.verifyToken(authToken);
   *   console.log('User:', payload.userId);
   * } catch (error) {
   *   console.error('Invalid token:', error.message);
   * }
   * 
   * @security Validates signature using configured secret
   * @security Checks issuer and audience claims
   * @security Provides backward compatibility for legacy tokens
   */
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
