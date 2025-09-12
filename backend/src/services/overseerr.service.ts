import { AppError } from '@medianest/shared';



import { redisClient } from '@/config/redis';
import { OverseerrClient } from '@/integrations/overseerr/overseerr.client';
import { serviceConfigRepository, mediaRequestRepository } from '@/repositories';
import { socketService } from '@/services/socket.service';
import { logger } from '@/utils/logger';

import { encryptionService } from './encryption.service';
import { CatchError, UnknownRecord } from '../types/common';

export class OverseerrService {
  private client?: OverseerrClient;
  private isAvailable = false;
  private cachePrefix = 'overseerr:';
  private cacheTTL = {
    search: 60, // 1 minute
    details: 300, // 5 minutes
    requests: 30, // 30 seconds
  };

  async initialize(): Promise<void> {
    try {
      const config = await serviceConfigRepository.findByName('overseerr');
      if (!config || !config.enabled) {
        logger.warn('Overseerr service is disabled');
        return;
      }

      // Decrypt API key if needed
      const apiKey = config.apiKey ? encryptionService.decryptFromStorage(config.apiKey) : '';

      this.client = new OverseerrClient({
        url: config.serviceUrl,
        apiKey,
      });

      this.isAvailable = await this.client.testConnection();
      logger.info('Overseerr service initialized', { available: this.isAvailable });
    } catch (error: CatchError) {
      logger.error('Failed to initialize Overseerr', { error });
      this.isAvailable = false;
    }
  }

  async searchMedia(query: string, page = 1) {
    this.ensureAvailable();

    // Check cache first
    const cacheKey = `${this.cachePrefix}search:${query}:${page}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const results = await this.client!.searchMedia(query, page);

      // Cache for 1 minute
      await redisClient.setex(cacheKey, this.cacheTTL.search.toString(), JSON.stringify(results));

      return results;
    } catch (error: CatchError) {
      logger.error('Media search failed', { query, error });
      throw new AppError('SEARCH_FAILED', 'Failed to search media', 503);
    }
  }

  async getMediaDetails(mediaType: 'movie' | 'tv', tmdbId: number) {
    this.ensureAvailable();

    // Check cache first
    const cacheKey = `${this.cachePrefix}details:${mediaType}:${tmdbId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const details = await this.client!.getMediaDetails(mediaType, tmdbId);

      // Cache for 5 minutes
      await redisClient.setex(cacheKey, this.cacheTTL.details.toString(), JSON.stringify(details));

      return details;
    } catch (error: CatchError) {
      logger.error('Failed to get media details', { mediaType, tmdbId, error });
      throw new AppError('MEDIA_DETAILS_FAILED', 'Failed to get media details', 503);
    }
  }

  async requestMedia(
    userId: string,
    request: {
      mediaType: 'movie' | 'tv';
      tmdbId: number;
      seasons?: number[];
    },
  ) {
    this.ensureAvailable();

    try {
      // Check if already requested in our database
      const existing = await mediaRequestRepository.findByTmdbId(
        String(request.tmdbId),
        request.mediaType,
      );

      if (existing && existing.status !== 'failed') {
        throw new AppError('ALREADY_REQUESTED', 'Media already requested', 409);
      }

      // Get media details first
      const mediaDetails = await this.getMediaDetails(request.mediaType, request.tmdbId);

      // Submit to Overseerr
      const overseerrRequest = await this.client!.requestMedia({
        mediaType: request.mediaType,
        mediaId: request.tmdbId,
        seasons: request.seasons,
      });

      // Save to our database
      const savedRequest = await mediaRequestRepository.create({
        userId,
        tmdbId: String(request.tmdbId),
        mediaType: request.mediaType,
        title: mediaDetails.title,
        overseerrId: String(overseerrRequest.id),
      });

      // Notify user via WebSocket
      socketService.emitToUser(userId, 'request:created', savedRequest);
      // Also emit to request-specific room
      socketService.emitToRoom(`request:${savedRequest.id}`, `request:${savedRequest.id}:status`, {
        status: savedRequest.status,
        updatedAt: savedRequest.createdAt,
      });

      return savedRequest;
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to request media', { userId, request, error });
      throw new AppError('REQUEST_FAILED', 'Failed to submit media request', 500);
    }
  }

  async getUserRequests(userId: string, options: UnknownRecord = {}) {
    // Always use local database for user-specific filtering
    // Overseerr doesn't have built-in user filtering for API
    return mediaRequestRepository.findByUser(userId, {
      page: Number(options.page) || 1,
      limit: Number(options.limit) || 20,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Webhook handler for status updates
  async handleWebhook(payload: any): Promise<void> {
    logger.info('Received Overseerr webhook', {
      type: payload.notification_type,
      mediaId: payload.media?.tmdbId,
    });

    // Map webhook types to our status
    const statusMap: Record<string, string> = {
      MEDIA_APPROVED: 'approved',
      MEDIA_AVAILABLE: 'available',
      MEDIA_DECLINED: 'failed',
      MEDIA_FAILED: 'failed',
    };

    const newStatus = statusMap[payload.notification_type];
    if (!newStatus) {
      logger.warn('Unknown webhook type', { type: payload.notification_type });
      return;
    }

    // Find request by overseerr ID or TMDB ID
    let request;
    if (payload.request?.id) {
      request = await mediaRequestRepository.findByOverseerrId(String(payload.request.id));
    } else if (payload.media?.tmdbId) {
      request = await mediaRequestRepository.findByTmdbId(
        String(payload.media.tmdbId),
        payload.media.mediaType,
      );
    }

    if (request) {
      await mediaRequestRepository.update(request.id, {
        status: newStatus,
        completedAt: newStatus === 'available' ? new Date() : undefined,
      });

      // Notify user
      socketService.emitToUser(request.userId, 'request:update', {
        requestId: request.id,
        status: newStatus,
        title: request.title,
      });
      // Also emit to request-specific room
      socketService.emitToRoom(`request:${request.id}`, `request:${request.id}:status`, {
        status: newStatus,
        updatedAt: new Date(),
      });
    }
  }

  isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  private ensureAvailable(): void {
    if (!this.isAvailable || !this.client) {
      throw new AppError('SERVICE_UNAVAILABLE', 'Overseerr service unavailable', 503);
    }
  }
}

export const overseerrService = new OverseerrService();
