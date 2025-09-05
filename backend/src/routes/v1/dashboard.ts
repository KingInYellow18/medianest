import { Router } from 'express';

import { dashboardController } from '@/controllers/dashboard.controller';
import { asyncHandler } from '@/utils/async-handler';
import { cachePresets } from '@/middleware/cache-headers';

const router = Router();

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', cachePresets.userData, asyncHandler(dashboardController.getDashboardStats));

// GET /api/dashboard/status - Get all service statuses
router.get('/status', cachePresets.apiShort, asyncHandler(dashboardController.getServiceStatuses));

// GET /api/dashboard/status/:service - Get specific service status
router.get('/status/:service', cachePresets.apiShort, asyncHandler(dashboardController.getServiceStatus));

// GET /api/dashboard/notifications - Get user notifications
router.get('/notifications', cachePresets.userData, asyncHandler(dashboardController.getNotifications));

export default router;
