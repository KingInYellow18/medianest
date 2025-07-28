import { Router } from 'express';

import { healthController } from '@/controllers/health.controller';
import { authenticate } from '@/middleware/auth';
import { asyncHandler } from '@/utils/async-handler';

import { authorize } from '@/middleware/rbac';

const router = Router();

// Basic health check - no auth required
router.get('/', asyncHandler(healthController.getHealth));

// Kubernetes/Docker health probes - no auth required
router.get('/ready', asyncHandler(healthController.getReadiness));
router.get('/live', asyncHandler(healthController.getLiveness));

// Detailed health check - no auth for basic info, detailed requires admin
router.get(
  '/details',
  asyncHandler(async (req, res) => {
    // If detailed info is requested, require admin auth
    if (req.query.detailed === 'true') {
      // Check if user is authenticated and is admin
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Authentication required for detailed health info' });
      }

      // Let the auth middleware handle the actual authentication
      return authenticate(req, res, () => {
        authorize(['ADMIN'])(req, res, () => {
          healthController.getDetailedHealth(req, res);
        });
      });
    }

    // Basic health details don't require auth
    return healthController.getDetailedHealth(req, res);
  }),
);

// Metrics endpoint - admin only
router.get(
  '/metrics',
  authenticate,
  authorize(['ADMIN']),
  asyncHandler(healthController.getMetrics),
);

// SLA metrics endpoint - admin only
router.get(
  '/sla',
  authenticate,
  authorize(['ADMIN']),
  asyncHandler(healthController.getSLAMetrics),
);

export default router;
