// @ts-nocheck
import { Router } from 'express';
import { healthController } from '@/controllers/health.controller';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate } from '@/middleware/auth';
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
