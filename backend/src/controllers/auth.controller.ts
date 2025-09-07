import axios from 'axios';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { config } from '@/config';
import { AppError } from '../utils/errors';
import { userRepository } from '@/repositories/instances';
import { encryptionService } from '@/services/encryption.service';
import { jwtService } from '@/services/jwt.service';
import { AuthenticatedRequest } from '@/types';
import { logger } from '@/utils/logger';
import { CatchError } from '../types/common';

// Validation schemas
const generatePinSchema = z.object({
  clientName: z.string().optional().default('MediaNest'),
});

const verifyPinSchema = z.object({
  pinId: z.string(),
  rememberMe: z.boolean().optional().default(false),
});

export class AuthController {
  /**
   * Generate a Plex PIN for OAuth authentication
   */
  async generatePin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate input with fallback
      let clientName = 'MediaNest';
      try {
        const parsed = generatePinSchema.parse(req.body);
        clientName = parsed.clientName;
      } catch (validationError) {
        logger.warn('Invalid input for generatePin, using defaults', { error: validationError });
      }

      // Generate PIN with Plex API
      const response = await axios.post('https://plex.tv/pins.xml', null, {
        headers: {
          'X-Plex-Client-Identifier': config.plex?.clientId || 'medianest',
          'X-Plex-Product': 'MediaNest',
          'X-Plex-Version': '1.0.0',
          'X-Plex-Device': 'Web',
          'X-Plex-Device-Name': clientName,
          'X-Plex-Platform': 'Web',
          'X-Plex-Platform-Version': 'Chrome',
          Accept: 'application/json',
        },
        timeout: 10000, // Increased timeout for stability
      });

      // Parse XML response (Plex returns XML for this endpoint)
      const responseData = response.data as string;
      const pinMatch = responseData.match(/<id>(\d+)<\/id>/);
      const codeMatch = responseData.match(/<code>([A-Z0-9]+)<\/code>/);

      if (!pinMatch || !codeMatch) {
        throw new AppError('PLEX_ERROR', 'Invalid response from Plex', 502);
      }

      const pinId = pinMatch[1];
      const code = codeMatch[1];

      res.json({
        success: true,
        data: {
          id: pinId,
          code,
          qrUrl: `https://plex.tv/link/?pin=${code}`,
          expiresIn: 900, // 15 minutes
        },
      });
    } catch (error: CatchError) {
      const errorMessage = (error as Error) ? (error.message as any) : 'Unknown error';
      logger.error('Failed to generate Plex PIN', { error: errorMessage });

      // Handle specific error cases
      if (axios.isAxiosError(error)) {
        if (
          error.response?.status === 503 ||
          ((error as any).code as any) === 'ECONNREFUSED' ||
          ((error as any).code as any) === 'ENOTFOUND'
        ) {
          return next(
            new AppError(
              'PLEX_UNREACHABLE',
              'Cannot connect to Plex server. Please try again.',
              503
            )
          );
        }
        if (
          ((error as any).code as any) === 'ECONNABORTED' ||
          ((error as any).code as any) === 'ETIMEDOUT'
        ) {
          return next(
            new AppError('PLEX_TIMEOUT', 'Plex server connection timed out. Please try again.', 504)
          );
        }
      }

      // Return application error instead of raw error to prevent 500
      if (error instanceof AppError) {
        return next(error);
      }

      next(new AppError('AUTH_ERROR', 'Authentication service temporarily unavailable', 503));
    }
  }

  /**
   * Verify Plex PIN and create/update user
   */
  async verifyPin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate input with better error handling
      let pinId: string;
      let rememberMe = false;

      try {
        const parsed = verifyPinSchema.parse(req.body);
        pinId = parsed.pinId;
        rememberMe = parsed.rememberMe;
      } catch (validationError) {
        logger.warn('Invalid input for verifyPin', { error: validationError });
        return next(new AppError('VALIDATION_ERROR', 'Invalid request data', 400));
      }

      // Check PIN status with better error handling
      const pinResponse = await axios.get(`https://plex.tv/pins/${pinId}.xml`, {
        headers: {
          'X-Plex-Client-Identifier': config.plex?.clientId || 'medianest',
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      // Parse auth token from response
      const pinResponseData = pinResponse.data as string;
      const authTokenMatch = pinResponseData.match(/<authToken>([^<]+)<\/authToken>/);

      if (!authTokenMatch || !authTokenMatch[1]) {
        return next(
          new AppError(
            'PIN_NOT_AUTHORIZED',
            'PIN has not been authorized yet. Please complete authorization on plex.tv/link',
            400
          )
        );
      }

      const plexToken = authTokenMatch[1];

      // Get user info from Plex with retry logic
      let userResponse;
      try {
        userResponse = await axios.get('https://plex.tv/users/account.xml', {
          headers: {
            'X-Plex-Token': plexToken,
            Accept: 'application/json',
          },
          timeout: 10000,
        });
      } catch (userError) {
        logger.error('Failed to get user info from Plex', { error: userError });
        return next(
          new AppError('PLEX_ERROR', 'Failed to retrieve user information from Plex', 502)
        );
      }

      // Parse user data from XML with validation
      const userResponseData = userResponse.data as string;
      const plexIdMatch = userResponseData.match(/<id>([^<]+)<\/id>/);
      const usernameMatch = userResponseData.match(/<username>([^<]+)<\/username>/);
      const emailMatch = userResponseData.match(/<email>([^<]+)<\/email>/);

      if (!plexIdMatch || !usernameMatch || !plexIdMatch[1] || !usernameMatch[1]) {
        logger.error('Invalid user data from Plex', { userResponseData });
        return next(new AppError('PLEX_ERROR', 'Invalid user data from Plex', 502));
      }

      const plexId = plexIdMatch[1];
      const username = usernameMatch[1];
      const email = emailMatch?.[1] || undefined;

      // Database operations with error handling
      let user;
      try {
        user = await userRepository.findByPlexId(plexId);

        if (user) {
          // Update existing user
          user = await userRepository.update(user.id, {
            plexUsername: username,
            email: email || undefined,
            plexToken: encryptionService.encryptForStorage(plexToken),
            lastLoginAt: new Date(),
          });
        } else {
          // Create new user
          const isFirstUser = await userRepository.isFirstUser();
          user = await userRepository.create({
            plexId,
            plexUsername: username,
            email: email || '',
            plexToken: encryptionService.encryptForStorage(plexToken),
            role: isFirstUser ? 'admin' : 'user',
          });
        }
      } catch (dbError) {
        logger.error('Database error during user creation/update', { error: dbError });
        return next(new AppError('DATABASE_ERROR', 'Failed to save user information', 503));
      }

      // Generate JWT tokens with error handling
      let token: string;
      let rememberToken: string | null = null;

      try {
        token = jwtService.generateAccessToken({
          userId: user.id,
          role: user.role,
        });

        if (rememberMe) {
          rememberToken = jwtService.generateRememberToken({
            userId: user.id,
            role: user.role,
          });
        }
      } catch (jwtError) {
        logger.error('JWT generation failed', { error: jwtError });
        return next(new AppError('TOKEN_ERROR', 'Failed to generate authentication tokens', 503));
      }

      // Set secure cookies
      try {
        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000, // 1 day
        });

        if (rememberToken) {
          res.cookie('rememberToken', rememberToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
          });
        }
      } catch (cookieError) {
        logger.warn('Failed to set cookies', { error: cookieError });
        // Continue anyway, cookies are optional
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.plexUsername || user.email || '',
            email: user.email,
            role: user.role,
          },
          token,
          rememberToken,
          csrfToken: res.locals.csrfToken, // Include CSRF token in response
        },
      });
    } catch (error: CatchError) {
      const errorMessage = (error as Error) ? (error.message as any) : 'Unknown error';
      logger.error('Failed to verify Plex PIN', { error: errorMessage });

      // Handle Axios errors
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return next(new AppError('INVALID_PIN', 'Invalid or expired PIN', 400));
        }
        if (error.response?.status! >= 500) {
          return next(
            new AppError('PLEX_UNAVAILABLE', 'Plex service temporarily unavailable', 503)
          );
        }
        if (
          ((error as any).code as any) === 'ECONNREFUSED' ||
          ((error as any).code as any) === 'ENOTFOUND'
        ) {
          return next(new AppError('PLEX_UNREACHABLE', 'Cannot connect to Plex server', 503));
        }
        if (
          ((error as any).code as any) === 'ECONNABORTED' ||
          ((error as any).code as any) === 'ETIMEDOUT'
        ) {
          return next(new AppError('PLEX_TIMEOUT', 'Plex server connection timed out', 504));
        }
      }

      // Handle known application errors
      if (error instanceof AppError) {
        return next(error);
      }

      // Default to service error instead of 500
      next(new AppError('AUTH_ERROR', 'Authentication service temporarily unavailable', 503));
    }
  }

  /**
   * Logout user
   */
  async logout(_req: Request, res: Response): Promise<void> {
    // Clear cookies
    res.clearCookie('token');
    res.clearCookie('rememberToken');

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  /**
   * Get current session
   */
  async getSession(req: Request, res: Response): Promise<void> {
    // This would be called after auth middleware has validated the token
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;

    if (!user) {
      throw new AppError('UNAUTHORIZED', 'User not found in request', 401);
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.plexUsername || user.email || '',
          email: user.email,
          role: user.role,
        },
      },
    });
  }
}

export const authController = new AuthController();
