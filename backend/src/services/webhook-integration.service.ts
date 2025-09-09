import { Request, Response } from 'express';
import { webhookSecurity } from '@/config/webhook-security';
import { logger } from '@/utils/logger';
import { redisClient } from '@/config/redis';
import { plexService } from '@/services/plex.service';
import { getSocketServer } from '@/socket/server';
import { AppError } from '@medianest/shared';

interface WebhookPayload {
  event: string;
  timestamp: number;
  source: 'overseerr' | 'plex' | 'github' | 'custom';
  data: Record<string, any>;
}

interface WebhookConfig {
  retryAttempts: number;
  retryDelay: number;
  timeoutMs: number;
  enableLogging: boolean;
}

interface WebhookRetryRecord {
  id: string;
  payload: WebhookPayload;
  attempts: number;
  lastAttempt: number;
  nextRetry: number;
}

export class WebhookIntegrationService {
  private readonly config: WebhookConfig;
  private readonly retryQueue = new Map<string, WebhookRetryRecord>();
  private readonly rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  constructor(config: Partial<WebhookConfig> = {}) {
    this.config = {
      retryAttempts: 3,
      retryDelay: 5000, // 5 seconds
      timeoutMs: 10000, // 10 seconds
      enableLogging: true,
      ...config,
    };

    // Process retry queue every minute
    setInterval(() => this.processRetryQueue(), 60000);
    
    // Clean up old rate limit entries every hour
    setInterval(() => this.cleanupRateLimits(), 3600000);
  }

  /**
   * Handle incoming webhook with comprehensive security and error handling
   */
  async handleWebhook(req: Request, res: Response, source: string): Promise<void> {
    const startTime = Date.now();
    const webhookId = this.generateWebhookId();
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    try {
      // Rate limiting check
      if (this.isRateLimited(clientIp)) {
        logger.warn('Webhook rate limit exceeded', { clientIp, source });
        res.status(429).json({ error: 'Rate limit exceeded' });
        return;
      }

      // Get raw body for signature verification
      const rawBody = JSON.stringify(req.body);
      const signature = req.headers['x-hub-signature-256'] as string || 
                       req.headers['x-signature'] as string ||
                       req.headers['signature'] as string;

      // Verify signature based on source
      if (!this.verifyWebhookSignature(rawBody, signature, source)) {
        logger.error('Webhook signature verification failed', { 
          source, 
          clientIp,
          hasSignature: !!signature 
        });
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Parse and validate payload
      const payload = this.parseWebhookPayload(req.body, source);
      
      // Log webhook reception
      if (this.config.enableLogging) {
        logger.info('Webhook received', {
          webhookId,
          source,
          event: payload.event,
          timestamp: payload.timestamp,
          clientIp: clientIp.replace(/[.:]/g, 'x'), // Anonymize IP
          payloadSize: rawBody.length,
        });
      }

      // Process webhook asynchronously
      await this.processWebhook(payload, webhookId);

      // Send success response
      res.status(200).json({ 
        success: true, 
        id: webhookId,
        processed: true,
        processingTime: Date.now() - startTime
      });

    } catch (error: unknown) {
      const processingTime = Date.now() - startTime;
      
      // Type guard for AppError with proper type checking
      if (error instanceof AppError) {
        const appError = error as AppError;
        logger.error('Webhook processing error', {
          webhookId,
          source,
          error: appError.message,
          code: appError.code,
          processingTime,
        });
        res.status(appError.statusCode).json({ 
          error: appError.message, 
          id: webhookId 
        });
      } else {
        // Handle unknown error types safely
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Unexpected webhook error', {
          webhookId,
          source,
          error: errorMessage,
          processingTime,
        });
        res.status(500).json({ 
          error: 'Internal server error', 
          id: webhookId 
        });
      }

      // Add to retry queue if retryable
      if (this.isRetryableError(error)) {
        const retryPayload = this.parseWebhookPayload(req.body, source);
        this.addToRetryQueue(webhookId, retryPayload);
      }
    }
  }

  /**
   * Verify webhook signature based on source
   */
  private verifyWebhookSignature(payload: string, signature: string, source: string): boolean {
    if (!signature) {
      logger.warn('No signature provided for webhook', { source });
      return false;
    }

    try {
      switch (source) {
        case 'overseerr':
          return webhookSecurity.verifyOverseerrSignature(payload, signature);
        case 'github':
          return webhookSecurity.verifyGitHubSignature(payload, signature);
        case 'plex':
          // Plex webhooks use different verification method
          return this.verifyPlexWebhook(payload, signature);
        default:
          // Generic HMAC verification
          const secret = process.env.GENERIC_WEBHOOK_SECRET;
          return secret ? webhookSecurity.verifySignature(payload, signature, secret) : false;
      }
    } catch (error) {
      logger.error('Signature verification failed', { source, error });
      return false;
    }
  }

  /**
   * Verify Plex webhook (different signature method)
   */
  private verifyPlexWebhook(payload: string, signature: string): boolean {
    // Plex uses a different signature method - implement based on your Plex setup
    // This is a placeholder - adjust based on your actual Plex webhook configuration
    const plexSecret = process.env.PLEX_WEBHOOK_SECRET;
    if (!plexSecret) {
      logger.warn('Plex webhook secret not configured');
      return false;
    }
    
    return webhookSecurity.verifySignature(payload, signature, plexSecret);
  }

  /**
   * Parse and validate webhook payload
   */
  private parseWebhookPayload(body: any, source: string): WebhookPayload {
    try {
      return {
        event: body.event || body.type || 'unknown',
        timestamp: body.timestamp || Date.now(),
        source: source as WebhookPayload['source'],
        data: webhookSecurity.sanitizePayloadForLogging(body),
      };
    } catch (error) {
      throw new AppError('INVALID_PAYLOAD', 'Invalid webhook payload format', 400);
    }
  }

  /**
   * Process webhook based on source and event type
   */
  private async processWebhook(payload: WebhookPayload, webhookId: string): Promise<void> {
    try {
      switch (payload.source) {
        case 'overseerr':
          await this.handleOverseerrWebhook(payload);
          break;
        case 'plex':
          await this.handlePlexWebhook(payload);
          break;
        case 'github':
          await this.handleGitHubWebhook(payload);
          break;
        default:
          await this.handleGenericWebhook(payload);
          break;
      }

      // Cache successful processing
      await redisClient.setex(`webhook:success:${webhookId}`, 3600, JSON.stringify({
        processed: true,
        timestamp: Date.now(),
        source: payload.source,
        event: payload.event,
      }));

    } catch (error) {
      logger.error('Webhook processing failed', {
        webhookId,
        source: payload.source,
        event: payload.event,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle Overseerr webhooks (media requests, approvals, etc.)
   */
  private async handleOverseerrWebhook(payload: WebhookPayload): Promise<void> {
    const io = getSocketServer();

    switch (payload.event) {
      case 'media.requested':
        logger.info('Media request received from Overseerr', {
          title: payload.data.media?.title,
          type: payload.data.media?.mediaType,
          requestedBy: payload.data.request?.requestedBy?.displayName,
        });
        
        // Emit real-time notification
        io.emit('media:requested', {
          title: payload.data.media?.title,
          type: payload.data.media?.mediaType,
          poster: payload.data.media?.posterPath,
          requestId: payload.data.request?.id,
          timestamp: payload.timestamp,
        });
        break;

      case 'media.approved':
        logger.info('Media request approved', {
          title: payload.data.media?.title,
          approvedBy: payload.data.request?.modifiedBy?.displayName,
        });
        
        io.emit('media:approved', {
          title: payload.data.media?.title,
          requestId: payload.data.request?.id,
          timestamp: payload.timestamp,
        });
        break;

      case 'media.available':
        // Trigger Plex library refresh for the relevant section
        await this.triggerPlexRefresh(payload.data.media);
        
        io.emit('media:available', {
          title: payload.data.media?.title,
          type: payload.data.media?.mediaType,
          timestamp: payload.timestamp,
        });
        break;

      default:
        logger.debug('Unhandled Overseerr event', { event: payload.event });
    }
  }

  /**
   * Handle Plex webhooks (media events, user activity, etc.)
   */
  private async handlePlexWebhook(payload: WebhookPayload): Promise<void> {
    const io = getSocketServer();

    switch (payload.event) {
      case 'library.new':
        logger.info('New media added to Plex', {
          title: payload.data.Metadata?.[0]?.title,
          type: payload.data.Metadata?.[0]?.type,
          library: payload.data.Metadata?.[0]?.librarySectionTitle,
        });

        io.emit('plex:library:new', {
          title: payload.data.Metadata?.[0]?.title,
          type: payload.data.Metadata?.[0]?.type,
          library: payload.data.Metadata?.[0]?.librarySectionTitle,
          timestamp: payload.timestamp,
        });
        break;

      case 'media.play':
      case 'media.resume':
        io.emit('plex:playback:start', {
          title: payload.data.Metadata?.[0]?.title,
          user: payload.data.Account?.title,
          timestamp: payload.timestamp,
        });
        break;

      case 'media.stop':
        io.emit('plex:playback:stop', {
          title: payload.data.Metadata?.[0]?.title,
          user: payload.data.Account?.title,
          timestamp: payload.timestamp,
        });
        break;

      default:
        logger.debug('Unhandled Plex event', { event: payload.event });
    }
  }

  /**
   * Handle GitHub webhooks (repository events, deployments, etc.)
   */
  private async handleGitHubWebhook(payload: WebhookPayload): Promise<void> {
    const io = getSocketServer();

    switch (payload.event) {
      case 'push':
        logger.info('GitHub push received', {
          repository: payload.data.repository?.full_name,
          branch: payload.data.ref?.replace('refs/heads/', ''),
          commits: payload.data.commits?.length || 0,
        });

        io.emit('github:push', {
          repository: payload.data.repository?.full_name,
          branch: payload.data.ref?.replace('refs/heads/', ''),
          commits: payload.data.commits?.length || 0,
          timestamp: payload.timestamp,
        });
        break;

      case 'deployment':
        io.emit('github:deployment', {
          repository: payload.data.repository?.full_name,
          environment: payload.data.deployment?.environment,
          state: payload.data.deployment_status?.state,
          timestamp: payload.timestamp,
        });
        break;

      default:
        logger.debug('Unhandled GitHub event', { event: payload.event });
    }
  }

  /**
   * Handle generic webhooks
   */
  private async handleGenericWebhook(payload: WebhookPayload): Promise<void> {
    logger.info('Generic webhook processed', {
      event: payload.event,
      source: payload.source,
      dataKeys: Object.keys(payload.data),
    });

    // Emit generic webhook event
    const io = getSocketServer();
    io.emit('webhook:generic', {
      event: payload.event,
      source: payload.source,
      timestamp: payload.timestamp,
    });
  }

  /**
   * Trigger Plex library refresh when media becomes available
   */
  private async triggerPlexRefresh(mediaData: any): Promise<void> {
    try {
      // This is a simplified implementation
      // In reality, you'd need to determine which Plex library section to refresh
      // based on the media type and your library configuration
      
      const mediaType = mediaData?.mediaType;
      let libraryKey: string | null = null;

      // Map media type to library section
      // This would need to be configured based on your Plex setup
      switch (mediaType) {
        case 'movie':
          libraryKey = process.env.PLEX_MOVIES_LIBRARY_KEY || '1';
          break;
        case 'tv':
          libraryKey = process.env.PLEX_TV_LIBRARY_KEY || '2';
          break;
        default:
          logger.warn('Unknown media type for Plex refresh', { mediaType });
          return;
      }

      if (libraryKey) {
        // Get admin user ID for Plex operations
        const adminUserId = process.env.PLEX_ADMIN_USER_ID;
        if (adminUserId) {
          await plexService.refreshLibrary(adminUserId, libraryKey);
          logger.info('Plex library refresh triggered', { libraryKey, mediaType });
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to trigger Plex refresh', {
        error: errorMessage,
        mediaData: mediaData,
      });
    }
  }

  /**
   * Rate limiting for webhook endpoints
   */
  private isRateLimited(clientIp: string): boolean {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 100; // Max requests per window

    const key = `webhook:rate:${clientIp}`;
    const current = this.rateLimitMap.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > current.resetTime) {
      current.count = 1;
      current.resetTime = now + windowMs;
    } else {
      current.count++;
    }

    this.rateLimitMap.set(key, current);
    return current.count > maxRequests;
  }

  /**
   * Clean up old rate limit entries
   */
  private cleanupRateLimits(): void {
    const now = Date.now();
    const entries = Array.from(this.rateLimitMap.entries());
    for (const [key, value] of entries) {
      if (now > value.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof AppError) {
      // Don't retry client errors (4xx)
      return error.statusCode >= 500;
    }
    
    // Retry on network errors, timeouts, etc.
    return true;
  }

  /**
   * Add failed webhook to retry queue
   */
  private addToRetryQueue(webhookId: string, payload: WebhookPayload): void {
    const retryRecord: WebhookRetryRecord = {
      id: webhookId,
      payload,
      attempts: 0,
      lastAttempt: 0,
      nextRetry: Date.now() + this.config.retryDelay,
    };

    this.retryQueue.set(webhookId, retryRecord);
    logger.info('Webhook added to retry queue', { webhookId, event: payload.event });
  }

  /**
   * Process retry queue
   */
  private async processRetryQueue(): Promise<void> {
    const now = Date.now();
    const toRetry = Array.from(this.retryQueue.values()).filter(
      record => record.nextRetry <= now && record.attempts < this.config.retryAttempts
    );

    for (const record of toRetry) {
      try {
        record.attempts++;
        record.lastAttempt = now;
        
        await this.processWebhook(record.payload, record.id);
        
        // Success - remove from retry queue
        this.retryQueue.delete(record.id);
        logger.info('Webhook retry successful', { 
          webhookId: record.id, 
          attempts: record.attempts 
        });
        
      } catch (error) {
        if (record.attempts >= this.config.retryAttempts) {
          // Max attempts reached - remove from queue
          this.retryQueue.delete(record.id);
          logger.error('Webhook retry failed permanently', {
            webhookId: record.id,
            attempts: record.attempts,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        } else {
          // Schedule next retry with exponential backoff
          record.nextRetry = now + (this.config.retryDelay * Math.pow(2, record.attempts - 1));
          logger.warn('Webhook retry failed, will retry again', {
            webhookId: record.id,
            attempts: record.attempts,
            nextRetry: new Date(record.nextRetry).toISOString(),
          });
        }
      }
    }
  }

  /**
   * Generate unique webhook ID
   */
  private generateWebhookId(): string {
    return `wh_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get webhook processing statistics
   */
  async getWebhookStats(): Promise<{
    processed: number;
    failed: number;
    retryQueue: number;
    rateLimited: number;
  }> {
    // This is a basic implementation - you might want to use Redis for persistence
    const keys = await redisClient.keys('webhook:success:*');
    const processed = keys.length;
    
    return {
      processed,
      failed: 0, // Would need persistent storage to track
      retryQueue: this.retryQueue.size,
      rateLimited: this.rateLimitMap.size,
    };
  }
}

export const webhookIntegrationService = new WebhookIntegrationService();