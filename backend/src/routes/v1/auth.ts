import { Router } from 'express';

import { authController } from '@/controllers/auth.controller';
import { authenticate } from '@/middleware/auth';
import { asyncHandler } from '@/utils/async-handler';
import { validateCSRFToken, generateCSRFToken } from '@/middleware/csrf';

const router = Router();

// POST /api/v1/auth/plex/pin - Generate Plex PIN for OAuth
router.post('/plex/pin', asyncHandler(authController.generatePin));

// POST /api/v1/auth/plex/verify - Verify Plex PIN and create session
router.post(
  '/plex/verify',
  generateCSRFToken,
  validateCSRFToken,
  asyncHandler(authController.verifyPin),
);

// POST /api/v1/auth/logout - Logout
router.post('/logout', authenticate, validateCSRFToken, asyncHandler(authController.logout));

// GET /api/v1/auth/session - Get current session
router.get('/session', authenticate, asyncHandler(authController.getSession));

export default router;
