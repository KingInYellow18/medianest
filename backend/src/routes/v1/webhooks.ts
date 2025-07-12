import { Router } from 'express';

import { overseerrService } from '@/services/overseerr.service';
import { asyncHandler } from '@/utils/async-handler';
import { logger } from '@/utils/logger';

const router = Router();

// Webhooks don't require authentication but should verify signatures

// POST /api/webhooks/overseerr - Overseerr webhook endpoint
router.post(
  '/overseerr',
  asyncHandler(async (req, res) => {
    try {
      // TODO: Implement webhook signature verification
      // const signature = req.headers['x-overseerr-signature'];

      logger.info('Received Overseerr webhook', {
        type: req.body.notification_type,
        mediaId: req.body.media?.tmdbId,
      });

      await overseerrService.handleWebhook(req.body);

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Webhook processing failed', { error });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }),
);

export default router;
