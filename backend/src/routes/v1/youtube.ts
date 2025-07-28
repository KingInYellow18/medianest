import { Router } from 'express';

import { YouTubeController } from '@/controllers/youtube.controller';
import { authenticate } from '@/middleware/auth';
import { rateLimiter } from '@/middleware/rate-limiter';
import { validate } from '@/middleware/validate';
import { retryDownloadSchema, downloadProgressSchema } from '@/validations/youtube.validation';

const router = Router();
const youtubeController = new YouTubeController();

// All YouTube routes require authentication
router.use(authenticate);

// POST /api/v1/youtube/download - Create a new download
router.post(
  '/download',
  rateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }), // 5 per hour
  youtubeController.createDownload,
);

// GET /api/v1/youtube/downloads - Get user's download history
router.get('/downloads', youtubeController.getDownloads);

// GET /api/v1/youtube/downloads/:id - Get specific download details
router.get('/downloads/:id', youtubeController.getDownload);

// DELETE /api/v1/youtube/downloads/:id - Cancel/delete a download
router.delete('/downloads/:id', youtubeController.deleteDownload);

// POST /api/v1/youtube/downloads/:id/retry - Retry failed download
router.post(
  '/downloads/:id/retry',
  validate(retryDownloadSchema, 'params'),
  youtubeController.retryDownload,
);

// GET /api/v1/youtube/downloads/:id/progress - Real-time progress
router.get(
  '/downloads/:id/progress',
  validate(downloadProgressSchema, 'params'),
  youtubeController.getDownloadProgress,
);

// GET /api/v1/youtube/metadata - Get video metadata without downloading
router.get('/metadata', youtubeController.getMetadata);

export default router;
