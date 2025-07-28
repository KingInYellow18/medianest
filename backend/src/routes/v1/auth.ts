import { Router } from 'express';

import { authController } from '@/controllers/auth.controller';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/utils/async-handler';
import { refreshTokenSchema } from '@/validations/auth.validation';

const router = Router();

// POST /api/v1/auth/plex/pin - Generate Plex PIN for OAuth
router.post('/plex/pin', asyncHandler(authController.generatePin));

// POST /api/v1/auth/plex/verify - Verify Plex PIN and create session
router.post('/plex/verify', asyncHandler(authController.verifyPin));

// POST /api/v1/auth/logout - Logout
router.post('/logout', authenticate, asyncHandler(authController.logout));

// GET /api/v1/auth/session - Get current session
router.get('/session', authenticate, asyncHandler(authController.getSession));

// GET /api/v1/auth/me - Get current user profile (alias for session)
router.get('/me', authenticate, asyncHandler(authController.getSession));

// POST /api/v1/auth/refresh - Refresh access token
router.post('/refresh', validate(refreshTokenSchema), asyncHandler(authController.refreshToken));

export default router;
