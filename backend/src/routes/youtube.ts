import { Router } from 'express';

const router = Router();

// POST /api/youtube/download - Submit playlist for download
router.post('/download', async (req, res) => {
  // TODO: Implement YouTube download
  res.json({ message: 'YouTube download endpoint' });
});

// GET /api/youtube/downloads - Get user's downloads
router.get('/downloads', async (req, res) => {
  // TODO: Implement get downloads
  res.json({ message: 'Get downloads endpoint' });
});

export default router;
