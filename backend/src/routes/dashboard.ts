import { Router } from 'express';

const router = Router();

// GET /api/dashboard/status - Get all service statuses
router.get('/status', async (req, res) => {
  // TODO: Implement service status check
  res.json({ message: 'Dashboard status endpoint' });
});

export default router;
