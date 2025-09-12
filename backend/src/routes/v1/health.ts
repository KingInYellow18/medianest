// @ts-nocheck
import { Router } from 'express';

import { healthController } from '@/controllers/health.controller';
import { authenticate } from '@/middleware/auth';
import { asyncHandler } from '@/utils/async-handler';

import { authorize } from '@/middleware/rbac';

const router = Router();

// Basic health check - no auth required
router.get('/', asyncHandler(healthController.getHealth));

// Metrics endpoint - admin only
router.get(
  '/metrics',
  authenticate,
  authorize(['ADMIN']),
  asyncHandler(healthController.getMetrics),
);

export default router;
