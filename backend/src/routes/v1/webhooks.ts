import crypto from 'crypto';

import { AppError } from '@medianest/shared';
import { Router } from 'express';

import { env } from '@/config/env';
import { overseerrService } from '@/services/overseerr.service';
import { asyncHandler } from '@/utils/async-handler';
import { logger } from '@/utils/logger';

const router = Router();

// Webhook signature verification middleware
const verifyOverseerrSignature = (req: any, res: any, next: any) => {
  const signature = req.headers['x-overseerr-signature'] as string;
  const webhookSecret = env.OVERSEERR_WEBHOOK_SECRET;

  // Require webhook secret to be configured
  if (!webhookSecret) {
    logger.error('Overseerr webhook secret not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // Require signature header
  if (!signature) {
    logger.warn('Missing webhook signature', { ip: req.ip });
    return res.status(401).json({ error: 'Missing signature' });
  }

  try {
    // Verify HMAC signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature))) {
      logger.warn('Invalid webhook signature', { ip: req.ip, provided: providedSignature });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  } catch (error) {
    logger.error('Signature verification failed', { error, ip: req.ip });
    return res.status(401).json({ error: 'Signature verification failed' });
  }
};

// POST /api/webhooks/overseerr - Overseerr webhook endpoint with signature verification
router.post(
  '/overseerr',
  verifyOverseerrSignature,
  asyncHandler(async (req, res) => {
    try {
      // Validate payload structure
      if (!req.body.notification_type) {
        throw new AppError('Invalid webhook payload: missing notification_type', 400);
      }

      logger.info('Received Overseerr webhook', {
        type: req.body.notification_type,
        mediaId: req.body.media?.tmdbId,
        ip: req.ip,
      });

      await overseerrService.handleWebhook(req.body);

      res.status(200).json({ success: true });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      logger.error('Webhook processing failed', { error, ip: req.ip });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }),
);

export default router;
