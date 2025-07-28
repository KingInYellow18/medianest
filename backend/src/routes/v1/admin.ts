import { Router } from 'express';

import { adminController } from '@/controllers/admin.controller';
import { mediaController } from '@/controllers/media.controller';
import { authenticate, requireAdmin } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/utils/async-handler';
import {
  getUsersSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  deleteUserSchema,
} from '@/validations/admin';
import {
  updateMonitorVisibilitySchema,
  bulkUpdateMonitorVisibilitySchema,
  resetAllVisibilitySchema,
} from '@/validations/monitor-visibility.validation';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// User management
router.get('/users', validate(getUsersSchema), asyncHandler(adminController.getUsers));
router.patch(
  '/users/:userId/role',
  validate(updateUserRoleSchema),
  asyncHandler(adminController.updateUserRole),
);
router.put(
  '/users/:userId/status',
  validate(updateUserStatusSchema),
  asyncHandler(adminController.updateUserStatus),
);
router.delete(
  '/users/:userId',
  validate(deleteUserSchema),
  asyncHandler(adminController.deleteUser),
);

// Service management
router.get('/services', asyncHandler(adminController.getServices));

// Media requests
router.get('/requests', asyncHandler(mediaController.getAllRequests));

// System statistics
router.get('/stats', asyncHandler(adminController.getSystemStats));

// System health details
router.get('/system/health', asyncHandler(adminController.getSystemHealth));

// Monitor visibility management
router.get('/monitors', asyncHandler(adminController.getMonitorsWithVisibility));
router.patch(
  '/monitors/:id/visibility',
  validate(updateMonitorVisibilitySchema),
  asyncHandler(adminController.updateMonitorVisibility),
);
router.patch(
  '/monitors/bulk-visibility',
  validate(bulkUpdateMonitorVisibilitySchema),
  asyncHandler(adminController.bulkUpdateMonitorVisibility),
);
router.post(
  '/monitors/reset-visibility',
  validate(resetAllVisibilitySchema),
  asyncHandler(adminController.resetAllMonitorVisibility),
);
router.get('/monitors/visibility-stats', asyncHandler(adminController.getVisibilityStats));

export default router;
