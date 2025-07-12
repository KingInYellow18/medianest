import { Router } from 'express';

import { dashboardController } from '@/controllers/dashboard.controller';
import { asyncHandler } from '@/utils/async-handler';

const router = Router();

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', asyncHandler(dashboardController.getDashboardStats));

// GET /api/dashboard/status - Get all service statuses
router.get('/status', asyncHandler(dashboardController.getServiceStatuses));

// GET /api/dashboard/status/:service - Get specific service status
router.get('/status/:service', asyncHandler(dashboardController.getServiceStatus));

// GET /api/dashboard/notifications - Get user notifications
router.get('/notifications', asyncHandler(dashboardController.getNotifications));

export default router;
