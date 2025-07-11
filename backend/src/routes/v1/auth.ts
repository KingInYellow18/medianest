import { Router } from 'express'
import { authController } from '@/controllers/auth.controller'
import { authenticate } from '@/middleware/auth'
import { asyncHandler } from '@/utils/async-handler'

const router = Router()

// POST /api/v1/auth/plex/pin - Generate Plex PIN for OAuth
router.post('/plex/pin', asyncHandler(authController.generatePin))

// POST /api/v1/auth/plex/verify - Verify Plex PIN and create session
router.post('/plex/verify', asyncHandler(authController.verifyPin))

// POST /api/v1/auth/logout - Logout
router.post('/logout', authenticate, asyncHandler(authController.logout))

// GET /api/v1/auth/session - Get current session
router.get('/session', authenticate, asyncHandler(authController.getSession))

export default router