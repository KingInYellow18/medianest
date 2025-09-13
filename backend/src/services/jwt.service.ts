import jwt from 'jsonwebtoken';

import { config } from '../config';

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
  /** Standard JWT expiration timestamp */
  exp?: number;
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
    if (!config.JWT_SECRET) {
      throw new Error('JWT_SECRET is required for authentication');
    }

    this.secret = config.JWT_SECRET;
    this.issuer = config.JWT_ISSUER || 'medianest';
    this.audience = config.JWT_AUDIENCE || 'medianest-users';
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
      exp: decoded.exp,
      jti: decoded.jti,
    };

    return validatedPayload;
  }

  /**
   * Decode JWT token without verification
   *
   * @method decodeToken
   * @description Extracts payload from JWT token without signature validation
   * @param {string} token - JWT token to decode
   * @returns {JwtPayload | null} Decoded payload or null if invalid
   *
   * @example
   * const payload = jwtService.decodeToken(token);
   * if (payload) {
   * }
   *
   * @warning Does not verify token signature - use only for non-security-critical operations
   */
  decodeToken(token: string): JwtPayload | null {
    if (!token) {
      return null;
    }

    try {
      const decoded = jwt.decode(token) as JwtPayload;
      return decoded;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Refresh a JWT token with new expiration
   *
   * @method refreshToken
   * @description Creates a new token from an existing token's payload
   * @param {string} oldToken - Existing JWT token to refresh
   * @returns {string} New JWT token with updated expiration
   *
   * @throws {Error} When old token is invalid or missing required fields
   *
   * @example
   * try {
   *   const newToken = jwtService.refreshToken(oldToken);
   *   // Use newToken for authenticated requests
   * } catch (error) {
   *   // Handle token refresh failure
   * }
   *
   * @security Excludes timing-sensitive claims (iat, exp, jti) from refresh
   */
  refreshToken(oldToken: string): string {
    const decoded = this.decodeToken(oldToken);

    if (!decoded) {
      throw new Error('Invalid token for refresh');
    }

    // Validate required fields
    if (!decoded.userId || !decoded.email || !decoded.role) {
      throw new Error('JWT payload must include userId, email, and role');
    }

    // Create fresh payload without timing-sensitive fields
    const refreshPayload: JwtPayload = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      plexId: decoded.plexId,
      sessionId: decoded.sessionId,
      deviceId: decoded.deviceId,
      ipAddress: decoded.ipAddress,
      userAgent: decoded.userAgent,
      tokenVersion: decoded.tokenVersion,
      // Exclude: iat, exp, jti (will be regenerated)
    };

    return this.generateAccessToken(refreshPayload);
  }

  /**
   * Check if a JWT token has expired
   *
   * @method isTokenExpired
   * @description Determines if token has passed its expiration time
   * @param {string} token - JWT token to check
   * @returns {boolean} True if token is expired or invalid
   *
   * @example
   * if (jwtService.isTokenExpired(token)) {
   *   // Token needs refresh or re-authentication
   * } else {
   *   // Token is still valid
   * }
   *
   * @security Returns true for any invalid token to err on the side of caution
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token);

      if (!decoded || !decoded.exp) {
        return true;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get token expiration timestamp
   *
   * @method getTokenExpirationTime
   * @description Extracts the expiration timestamp from a JWT token
   * @param {string} token - JWT token to examine
   * @returns {number | null} Unix timestamp of expiration or null if not available
   *
   * @example
   * const expTime = jwtService.getTokenExpirationTime(token);
   * if (expTime) {
   *   const expDate = new Date(expTime * 1000);
   * }
   */
  getTokenExpirationTime(token: string): number | null {
    try {
      const decoded = this.decodeToken(token);
      return decoded?.exp || null;
    } catch (error) {
      return null;
    }
  }
}

export const jwtService = new JwtService();
