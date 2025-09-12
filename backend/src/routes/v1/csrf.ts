import { Router } from 'express';

import { csrfController } from '@/controllers/csrf.controller';
import { authenticate, requireAdmin, optionalAuth } from '@/middleware/auth';
import { generateCSRFToken, refreshCSRFToken } from '@/middleware/csrf';

const router = Router();

/**
 * @swagger
 * /api/v1/csrf/token:
 *   get:
 *     summary: Get CSRF token
 *     description: Get a CSRF token for form submissions. Available for both authenticated and unauthenticated users.
 *     tags:
 *       - CSRF
 *     responses:
 *       200:
 *         description: CSRF token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: CSRF token
 *                     expiresIn:
 *                       type: number
 *                       description: Token expiration in seconds
 *       500:
 *         description: Server error
 */
router.get('/token', optionalAuth(), generateCSRFToken, csrfController.getToken);

/**
 * @swagger
 * /api/v1/csrf/refresh:
 *   post:
 *     summary: Refresh CSRF token
 *     description: Generate a new CSRF token, invalidating the current one.
 *     tags:
 *       - CSRF
 *     responses:
 *       200:
 *         description: CSRF token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: New CSRF token
 *                     expiresIn:
 *                       type: number
 *                       description: Token expiration in seconds
 *       500:
 *         description: Server error
 */
router.post('/refresh', optionalAuth(), refreshCSRFToken, csrfController.refreshToken);

/**
 * @swagger
 * /api/v1/csrf/stats:
 *   get:
 *     summary: Get CSRF statistics
 *     description: Get statistics about CSRF token usage (admin only).
 *     tags:
 *       - CSRF
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: CSRF statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalTokens:
 *                       type: number
 *                       description: Total active tokens
 *                     averageAgeSeconds:
 *                       type: number
 *                       description: Average token age in seconds
 *                     protection:
 *                       type: string
 *                       description: CSRF protection pattern used
 *                     tokenTtlSeconds:
 *                       type: number
 *                       description: Token TTL in seconds
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */
router.get('/stats', authenticate, requireAdmin(), csrfController.getStats);

export { router };
