import { Router } from 'express';

import { mediaController } from '@/controllers/media.controller';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/utils/async-handler';
import { mediaRequestSchema, mediaSearchSchema } from '@/validations/media.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/media/search - Search for media
router.get(
  '/search',
  validate(mediaSearchSchema, 'query'),
  asyncHandler(mediaController.searchMedia),
);

// GET /api/media/:mediaType/:tmdbId - Get media details
router.get('/:mediaType/:tmdbId', asyncHandler(mediaController.getMediaDetails));

// POST /api/media/request - Submit media request
router.post('/request', validate(mediaRequestSchema), asyncHandler(mediaController.requestMedia));

// GET /api/media/requests - Get user's requests
router.get('/requests', asyncHandler(mediaController.getUserRequests));

// GET /api/media/requests/:requestId - Get specific request details
router.get('/requests/:requestId', asyncHandler(mediaController.getRequestDetails));

// DELETE /api/media/requests/:requestId - Delete a pending request
router.delete('/requests/:requestId', asyncHandler(mediaController.deleteRequest));

export default router;
