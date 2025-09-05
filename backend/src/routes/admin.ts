import { Router } from 'express';

const router = Router();

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

export default router;
