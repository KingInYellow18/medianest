import { Router } from 'express';

import { mediaController } from '@/controllers/media.controller';
import { authenticate, requireAdmin } from '@/middleware/auth';
import { asyncHandler } from '@/utils/async-handler';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin/users - List all users
router.get('/users', async (req, res) => {
  // TODO: Implement list users
  res.json({ message: 'Admin users endpoint' });
});

// GET /api/admin/services - Get all service configs
router.get('/services', async (req, res) => {
  // TODO: Implement get services
  res.json({ message: 'Admin services endpoint' });
});

// GET /api/admin/requests - Get all media requests
router.get('/requests', asyncHandler(mediaController.getAllRequests));

export default router;
