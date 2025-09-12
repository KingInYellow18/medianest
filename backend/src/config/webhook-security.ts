import crypto from 'crypto';

import { AppError } from '@medianest/shared';

import { configService } from './config.service';
import { logger } from '../utils/logger';


/**
 * Webhook signature verification utility
 * Implements HMAC-SHA256 signature validation for secure webhook processing
 */
export class WebhookSecurity {
  private static instance: WebhookSecurity;

  private constructor() {}

  public static getInstance(): WebhookSecurity {
    if (!WebhookSecurity.instance) {
      WebhookSecurity.instance = new WebhookSecurity();
    }
    return WebhookSecurity.instance;
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  public verifySignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: string = 'sha256',
  ): boolean {
    try {
      if (!signature || !secret || !payload) {
        logger.warn('Missing required parameters for webhook signature verification');
        return false;
      }

      // Create HMAC signature
      const hmac = crypto.createHmac(algorithm, secret);
      hmac.update(payload, 'utf8');
      const calculatedSignature = hmac.digest('hex');

      // Compare signatures using timing-safe comparison
      const expectedSignature = signature.replace('sha256=', '');
      return crypto.timingSafeEqual(
        Buffer.from(calculatedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch (error) {
      logger.error('Webhook signature verification failed', { error });
      return false;
    }
  }

  /**
   * Verify Overseerr webhook signature
   */
  public verifyOverseerrSignature(payload: string, signature: string): boolean {
    const webhookSecret = (configService as any).get('WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new AppError(
        'WEBHOOK_SECRET_NOT_CONFIGURED',
        'Webhook secret not configured for signature verification',
        500,
      );
    }

    return this.verifySignature(payload, signature, webhookSecret);
  }

  /**
   * Verify GitHub webhook signature
   */
  public verifyGitHubSignature(payload: string, signature: string): boolean {
    const githubSecret = (configService as any).get('GITHUB_WEBHOOK_SECRET');
    if (!githubSecret) {
      throw new AppError(
        'GITHUB_WEBHOOK_SECRET_NOT_CONFIGURED',
        'GitHub webhook secret not configured',
        500,
      );
    }

    return this.verifySignature(payload, signature, githubSecret);
  }

  /**
   * Rate limiting for webhook endpoints
   */
  public isRateLimited(_clientIp: string): boolean {
    // Implement rate limiting logic here
    // This is a placeholder for webhook-specific rate limiting
    return false;
  }

  /**
   * Sanitize webhook payload for logging
   */
  public sanitizePayloadForLogging(payload: any): any {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const sanitized = { ...payload };

    // Remove sensitive fields that might be in webhook payloads
    const sensitiveFields = ['token', 'secret', 'password', 'apiKey', 'api_key'];

    const sanitizeObject = (obj: any): void => {
      if (typeof obj !== 'object' || obj === null) return;

      Object.keys(obj).forEach((key) => {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some((field) => lowerKey.includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      });
    };

    sanitizeObject(sanitized);
    return sanitized;
  }
}

export const webhookSecurity = WebhookSecurity.getInstance();
