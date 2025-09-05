import axios from 'axios';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { config } from '@/config';
import { AppError } from '@medianest/shared';
import { userRepository } from '@/repositories/instances';
import { encryptionService } from '@/services/encryption.service';
import { jwtService } from '@/services/jwt.service';
import { AuthenticatedRequest } from '@/types';
import { logger } from '@/utils/logger';

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
      const { clientName } = generatePinSchema.parse(req.body);

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
        timeout: 5000,
      });

      // Parse XML response (Plex returns XML for this endpoint)
      const responseData = response.data as string;
      const pinMatch = responseData.match(/<id>(\d+)<\/id>/);
      const codeMatch = responseData.match(/<code>([A-Z0-9]+)<\/code>/);

      if (!pinMatch || !codeMatch) {
        throw new AppError('Invalid response from Plex', 500, 'PLEX_ERROR');
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to generate Plex PIN', { error: errorMessage });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 503 || error.code === 'ECONNREFUSED') {
          next(
            new AppError(
              'Cannot connect to Plex server. Please try again.',
              503,
              'PLEX_UNREACHABLE',
            ),
          );
          return;
        }
      }

      next(error instanceof Error ? error : new Error(errorMessage));
    }
  }

  /**
   * Verify Plex PIN and create/update user
   */
  async verifyPin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pinId, rememberMe } = verifyPinSchema.parse(req.body);

      // Check PIN status
      const pinResponse = await axios.get(`https://plex.tv/pins/${pinId}.xml`, {
        headers: {
          'X-Plex-Client-Identifier': config.plex?.clientId || 'medianest',
          Accept: 'application/json',
        },
        timeout: 5000,
      });

      // Parse auth token from response
      const pinResponseData = pinResponse.data as string;
      const authTokenMatch = pinResponseData.match(/<authToken>([^<]+)<\/authToken>/);

      if (!authTokenMatch) {
        throw new AppError(
          'PIN has not been authorized yet. Please complete authorization on plex.tv/link',
          400,
          'PIN_NOT_AUTHORIZED',
        );
      }

      const plexToken = authTokenMatch[1];

      // Get user info from Plex
      const userResponse = await axios.get('https://plex.tv/users/account.xml', {
        headers: {
          'X-Plex-Token': plexToken,
          Accept: 'application/json',
        },
        timeout: 5000,
      });

      // Parse user data from XML
      const userResponseData = userResponse.data as string;
      const plexIdMatch = userResponseData.match(/<id>([^<]+)<\/id>/);
      const usernameMatch = userResponseData.match(/<username>([^<]+)<\/username>/);
      const emailMatch = userResponseData.match(/<email>([^<]+)<\/email>/);

      if (!plexIdMatch || !usernameMatch) {
        throw new AppError('Invalid user data from Plex', 500, 'PLEX_ERROR');
      }

      const plexId = plexIdMatch[1];
      const username = usernameMatch[1];
      const email = emailMatch?.[1] || null;

      // Check if user exists
      let user = await userRepository.findByPlexId(plexId);

      if (user) {
        // Update existing user
        user = await userRepository.update(user.id, {
          username,
          email,
          plexToken: encryptionService.encryptForStorage(plexToken),
          lastLoginAt: new Date(),
        });
      } else {
        // Create new user
        const isFirstUser = await userRepository.isFirstUser();
        user = await userRepository.create({
          plexId,
          username,
          email,
          plexToken: encryptionService.encryptForStorage(plexToken),
          role: isFirstUser ? 'admin' : 'user',
          lastLoginAt: new Date(),
        });
      }

      // Generate JWT tokens
      const token = jwtService.generateAccessToken({
        userId: user.id,
        role: user.role,
      });

      const rememberToken = rememberMe
        ? jwtService.generateRememberToken({
            userId: user.id,
            role: user.role,
          })
        : null;

      // Set secure cookies
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to verify Plex PIN', { error: errorMessage });

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        next(new AppError('Invalid or expired PIN', 400, 'INVALID_PIN'));
      } else if (error instanceof AppError) {
        next(error);
      } else {
        next(new AppError('Authentication failed. Please try again.', 500, 'AUTH_ERROR'));
      }
    }
  }

  /**
   * Logout user
   */
  async logout(req: Request, res: Response): Promise<void> {
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
      throw new AppError('User not found in request', 401, 'UNAUTHORIZED');
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
