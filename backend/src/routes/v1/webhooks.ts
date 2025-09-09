import { Router } from 'express';
import crypto from 'crypto';

import { overseerrService } from '@/services/overseerr.service';
import { asyncHandler } from '@/utils/async-handler';
import { logger } from '@/utils/logger';
import { CatchError } from '../../types/common';

const router = Router();

// Webhook signature verification utility
function verifyWebhookSignature(
  payload: string, 
  signature: string | undefined, 
  secret: string | undefined
): boolean {
  if (!signature || !secret) {
    logger.warn('Webhook signature verification failed: missing signature or secret');
    return false;
  }
  
  try {
    // Remove 'sha256=' prefix if present
    const cleanSignature = signature.replace(/^sha256=/, '');
    
    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    
    // Use timingSafeEqual to prevent timing attacks
    const signatureBuffer = Buffer.from(cleanSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    logger.warn('Webhook signature verification error:', error);
    return false;
  }
}

// Webhooks don't require authentication but should verify signatures

// POST /api/webhooks/overseerr - Overseerr webhook endpoint
router.post(
  '/overseerr',
  asyncHandler(async (req, res) => {
    try {
      // Implement webhook signature verification
      const signature = req.headers['x-overseerr-signature'] as string;
      const webhookSecret = process.env.OVERSEERR_WEBHOOK_SECRET;
      const payload = JSON.stringify(req.body);
      
      // Verify webhook signature for security
      if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
        logger.warn('Overseerr webhook signature verification failed', {
          hasSignature: !!signature,
          hasSecret: !!webhookSecret,
          userAgent: req.headers['user-agent']
        });
        return res.status(401).json({ 
          error: 'Webhook signature verification failed' 
        });
      }

      logger.info('Received Overseerr webhook', {
        type: req.body.notification_type,
        mediaId: req.body.media?.tmdbId,
        verified: true
      });

      await overseerrService.handleWebhook(req.body);

      res.status(200).json({ success: true });
    } catch (error: CatchError) {
      logger.error('Webhook processing failed', { error });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  })
);

export default router;
