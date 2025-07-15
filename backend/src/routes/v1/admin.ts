import { Router } from 'express';

import { adminController } from '@/controllers/admin.controller';
import { mediaController } from '@/controllers/media.controller';
import { authenticate, requireAdmin } from '@/middleware/auth';
import { asyncHandler } from '@/utils/async-handler';
import { validate } from '@/middleware/validate';
import { getUsersSchema, updateUserRoleSchema, deleteUserSchema } from '@/validations/admin';

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

export default router;
