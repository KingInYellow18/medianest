import { Router } from 'express';

import { authenticate } from '../../middleware/auth';
import { rateLimiter } from '../../middleware/rate-limiter';
import { YouTubeController } from '../../controllers/youtube.controller';

const router = Router();
const youtubeController = new YouTubeController();

// All YouTube routes require authentication
router.use(authenticate);

// POST /api/v1/youtube/download - Create a new download
router.post(
  '/download',
  rateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }), // 5 per hour
  youtubeController.createDownload
);

// GET /api/v1/youtube/downloads - Get user's download history
router.get('/downloads', youtubeController.getDownloads);

// GET /api/v1/youtube/downloads/:id - Get specific download details
router.get('/downloads/:id', youtubeController.getDownload);

// DELETE /api/v1/youtube/downloads/:id - Cancel/delete a download
router.delete('/downloads/:id', youtubeController.deleteDownload);

// GET /api/v1/youtube/metadata - Get video metadata without downloading
router.get('/metadata', youtubeController.getMetadata);

export default router;
