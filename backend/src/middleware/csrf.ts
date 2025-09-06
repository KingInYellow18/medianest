import type { Request, Response, NextFunction } from 'express';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/error';

// CSRF token store for session-based tokens
const csrfTokenStore = new Map<string, { token: string; createdAt: number }>();

// Token TTL (1 hour)
const CSRF_TOKEN_TTL = 60 * 60 * 1000;

// Cleanup interval (10 minutes)
const CLEANUP_INTERVAL = 10 * 60 * 1000;

// Setup periodic cleanup of expired tokens
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, tokenData] of csrfTokenStore.entries()) {
    if (now - tokenData.createdAt > CSRF_TOKEN_TTL) {
      csrfTokenStore.delete(sessionId);
    }
  }
}, CLEANUP_INTERVAL);

interface CSRFOptions {
  cookieName?: string;
  headerName?: string;
  sessionIdExtractor?: (req: Request) => string;
  ignoreMethods?: string[];
  ignoreRoutes?: (string | RegExp)[];
  doubleSubmit?: boolean;
}

export class CSRFProtection {
  private options: Required<CSRFOptions>;

  constructor(options: CSRFOptions = {}) {
    this.options = {
      cookieName: options.cookieName || 'csrf-token',
      headerName: options.headerName || 'x-csrf-token',
      sessionIdExtractor: options.sessionIdExtractor || this.defaultSessionExtractor,
      ignoreMethods: options.ignoreMethods || ['GET', 'HEAD', 'OPTIONS'],
      ignoreRoutes: options.ignoreRoutes || [],
      doubleSubmit: options.doubleSubmit ?? true,
    };
  }

  private defaultSessionExtractor(req: Request): string {
    // Extract session ID from JWT token or create a temporary one
    if (req.user?.id) {
      return req.user.id;
    }
    // For unauthenticated requests, use IP + User-Agent as fallback
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return createHash('sha256').update(`${ip}-${userAgent}`).digest('hex');
  }

  /**
   * Generate a cryptographically secure CSRF token
   */
  generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Verify CSRF token using timing-safe comparison
   */
  private verifyToken(token1: string, token2: string): boolean {
    if (token1.length !== token2.length) {
      return false;
    }

    const buffer1 = Buffer.from(token1, 'hex');
    const buffer2 = Buffer.from(token2, 'hex');

    return timingSafeEqual(buffer1, buffer2);
  }

  /**
   * Check if route should be ignored
   */
  private shouldIgnoreRoute(path: string): boolean {
    return this.options.ignoreRoutes.some((route) => {
      if (typeof route === 'string') {
        return path.startsWith(route);
      }
      return route.test(path);
    });
  }

  /**
   * Token generation middleware
   */
  generateTokenMiddleware = () => {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = this.options.sessionIdExtractor(req);

        // Generate new token
        const token = this.generateToken();
        const createdAt = Date.now();

        // Store token
        csrfTokenStore.set(sessionId, { token, createdAt });

        // Set token in cookie for double-submit pattern
        if (this.options.doubleSubmit) {
          res.cookie(this.options.cookieName, token, {
            httpOnly: false, // Needs to be readable by frontend
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: CSRF_TOKEN_TTL,
          });
        }

        // Add token to response
        res.locals.csrfToken = token;

        next();
      } catch (error) {
        logger.error('CSRF token generation failed', { error });
        next(new AppError('Token generation failed', 500, 'CSRF_GENERATION_ERROR'));
      }
    };
  };

  /**
   * Token validation middleware
   */
  validateTokenMiddleware = () => {
    return (req: Request, _res: Response, next: NextFunction) => {
      try {
        // Skip validation for ignored methods
        if (this.options.ignoreMethods.includes(req.method)) {
          return next();
        }

        // Skip validation for ignored routes
        if (this.shouldIgnoreRoute(req.path)) {
          return next();
        }

        const sessionId = this.options.sessionIdExtractor(req);
        const storedTokenData = csrfTokenStore.get(sessionId);

        if (!storedTokenData) {
          throw new AppError('CSRF token not found', 403, 'CSRF_TOKEN_NOT_FOUND');
        }

        // Check token expiration
        if (Date.now() - storedTokenData.createdAt > CSRF_TOKEN_TTL) {
          csrfTokenStore.delete(sessionId);
          throw new AppError('CSRF token expired', 403, 'CSRF_TOKEN_EXPIRED');
        }

        let clientToken: string | undefined;

        if (this.options.doubleSubmit) {
          // Double-submit pattern: check both cookie and header/body
          const cookieToken = req.cookies[this.options.cookieName];
          const headerToken = req.get(this.options.headerName);
          const bodyToken = req.body?.csrfToken;

          clientToken = headerToken || bodyToken;

          if (!cookieToken || !clientToken) {
            throw new AppError('CSRF token missing', 403, 'CSRF_TOKEN_MISSING');
          }

          // Verify cookie matches header/body token
          if (!this.verifyToken(cookieToken, clientToken)) {
            throw new AppError('CSRF token mismatch', 403, 'CSRF_TOKEN_MISMATCH');
          }

          // Verify against stored token
          if (!this.verifyToken(storedTokenData.token, clientToken)) {
            throw new AppError('Invalid CSRF token', 403, 'CSRF_TOKEN_INVALID');
          }
        } else {
          // Synchronizer token pattern: check header/body against stored token
          const headerToken = req.get(this.options.headerName);
          const bodyToken = req.body?.csrfToken;

          clientToken = headerToken || bodyToken;

          if (!clientToken) {
            throw new AppError('CSRF token missing', 403, 'CSRF_TOKEN_MISSING');
          }

          if (!this.verifyToken(storedTokenData.token, clientToken)) {
            throw new AppError('Invalid CSRF token', 403, 'CSRF_TOKEN_INVALID');
          }
        }

        // Token is valid, proceed
        next();
      } catch (error) {
        if (error instanceof AppError) {
          logger.warn('CSRF validation failed', {
            path: req.path,
            method: req.method,
            sessionId: this.options.sessionIdExtractor(req),
            error: error.message,
          });
          next(error);
        } else {
          logger.error('CSRF validation error', { error });
          next(new AppError('CSRF validation failed', 500, 'CSRF_VALIDATION_ERROR'));
        }
      }
    };
  };

  /**
   * Token refresh middleware
   */
  refreshTokenMiddleware = () => {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = this.options.sessionIdExtractor(req);
        const storedTokenData = csrfTokenStore.get(sessionId);

        // Generate new token if current one is missing or close to expiry
        const shouldRefresh =
          !storedTokenData || Date.now() - storedTokenData.createdAt > CSRF_TOKEN_TTL * 0.75;

        if (shouldRefresh) {
          const token = this.generateToken();
          const createdAt = Date.now();

          csrfTokenStore.set(sessionId, { token, createdAt });

          if (this.options.doubleSubmit) {
            res.cookie(this.options.cookieName, token, {
              httpOnly: false,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
              maxAge: CSRF_TOKEN_TTL,
            });
          }

          res.locals.csrfToken = token;
        } else {
          res.locals.csrfToken = storedTokenData.token;
        }

        next();
      } catch (error) {
        logger.error('CSRF token refresh failed', { error });
        next();
      }
    };
  };

  /**
   * Get current token for a session
   */
  getToken(sessionId: string): string | null {
    const tokenData = csrfTokenStore.get(sessionId);
    if (!tokenData || Date.now() - tokenData.createdAt > CSRF_TOKEN_TTL) {
      return null;
    }
    return tokenData.token;
  }

  /**
   * Clear token for a session
   */
  clearToken(sessionId: string): void {
    csrfTokenStore.delete(sessionId);
  }

  /**
   * Get statistics about token store
   */
  getStats(): { totalTokens: number; avgAge: number } {
    const now = Date.now();
    const tokens = Array.from(csrfTokenStore.values());
    const totalTokens = tokens.length;
    const avgAge =
      totalTokens > 0
        ? tokens.reduce((sum, token) => sum + (now - token.createdAt), 0) / totalTokens / 1000
        : 0;

    return { totalTokens, avgAge };
  }
}

// Default CSRF protection instance
export const csrfProtection = new CSRFProtection({
  doubleSubmit: true,
  ignoreRoutes: [
    '/api/v1/health',
    '/api/v1/auth/pin/generate', // Allow PIN generation without CSRF
    '/api/v1/webhooks', // Webhooks from external services
  ],
});

// Convenience middleware exports
export const generateCSRFToken = csrfProtection.generateTokenMiddleware();
export const validateCSRFToken = csrfProtection.validateTokenMiddleware();
export const refreshCSRFToken = csrfProtection.refreshTokenMiddleware();
