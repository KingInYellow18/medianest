import type { Request, Response, NextFunction } from 'express';
import { csrfProtection } from '@/middleware/csrf';
import { logger } from '@/utils/logger';
import { CatchError } from '../types/common';

export class CSRFController {
  /**
   * Get CSRF token for authenticated users
   */
  async getToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract session ID using the same method as CSRF middleware
      const sessionId =
        req.user?.id ||
        (req.ip || req.connection.remoteAddress || 'unknown') +
          '-' +
          (req.get('user-agent') || 'unknown');

      // Get current token or generate new one
      let token = csrfProtection.getToken(sessionId);

      if (!token) {
        // Generate new token through middleware
        const middleware = csrfProtection.generateTokenMiddleware();
        await new Promise<void>((resolve, reject) => {
          middleware(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        token = res.locals.csrfToken;
      }

      res.json({
        success: true,
        data: {
          token,
          expiresIn: 3600, // 1 hour
        },
      });
    } catch (error: CatchError) {
      logger.error('Failed to get CSRF token', { error });
      next(error);
    }
  }

  /**
   * Refresh CSRF token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Force token refresh through middleware
      const middleware = csrfProtection.refreshTokenMiddleware();
      await new Promise<void>((resolve, reject) => {
        middleware(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const token = res.locals.csrfToken;

      res.json({
        success: true,
        data: {
          token,
          expiresIn: 3600,
        },
      });
    } catch (error: CatchError) {
      logger.error('Failed to refresh CSRF token', { error });
      next(error);
    }
  }

  /**
   * Get CSRF protection statistics (admin only)
   */
  async getStats(_req: Request, res: Response): Promise<void> {
    const stats = csrfProtection.getStats();

    res.json({
      success: true,
      data: {
        totalTokens: stats.totalTokens,
        averageAgeSeconds: Math.round(stats.avgAge),
        protection: 'double-submit-cookie',
        tokenTtlSeconds: 3600,
      },
    });
  }
}

export const csrfController = new CSRFController();
