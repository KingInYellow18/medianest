import { Request, Response } from 'express';
import { overseerrService } from '@/services/overseerr.service';
import { mediaRequestRepository } from '@/repositories';
import { logger } from '@/utils/logger';
import { AppError } from '@/utils/errors';

export class MediaController {
  async searchMedia(req: Request, res: Response) {
    try {
      const { query, page = 1 } = req.query;

      if (!query || typeof query !== 'string') {
        throw new AppError('Search query is required', 400);
      }

      const results = await overseerrService.searchMedia(query, Number(page));

      res.json({
        success: true,
        data: results.results,
        meta: {
          query,
          page: Number(page),
          totalPages: results.totalPages
        }
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Media search failed', { error });
      throw new AppError('Search failed', 500);
    }
  }

  async getMediaDetails(req: Request, res: Response) {
    try {
      const { mediaType, tmdbId } = req.params;

      if (!['movie', 'tv'].includes(mediaType)) {
        throw new AppError('Invalid media type', 400);
      }

      const details = await overseerrService.getMediaDetails(
        mediaType as 'movie' | 'tv',
        Number(tmdbId)
      );

      res.json({
        success: true,
        data: details
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get media details', { error });
      throw new AppError('Failed to get media details', 500);
    }
  }

  async requestMedia(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { mediaType, tmdbId, seasons } = req.body;

      if (!mediaType || !tmdbId) {
        throw new AppError('mediaType and tmdbId are required', 400);
      }

      if (!['movie', 'tv'].includes(mediaType)) {
        throw new AppError('Invalid media type', 400);
      }

      const request = await overseerrService.requestMedia(userId, {
        mediaType,
        tmdbId: Number(tmdbId),
        seasons
      });

      res.status(201).json({
        success: true,
        data: request
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to request media', { error });
      throw new AppError('Failed to submit media request', 500);
    }
  }

  async getUserRequests(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { skip = 0, take = 20 } = req.query;

      const requests = await overseerrService.getUserRequests(userId, {
        skip: Number(skip),
        take: Number(take)
      });

      res.json({
        success: true,
        data: requests,
        meta: {
          skip: Number(skip),
          take: Number(take)
        }
      });
    } catch (error) {
      logger.error('Failed to get user requests', { error });
      throw new AppError('Failed to get requests', 500);
    }
  }

  async getRequestDetails(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { requestId } = req.params;

      const request = await mediaRequestRepository.findById(requestId);

      if (!request) {
        throw new AppError('Request not found', 404);
      }

      // Ensure user can only see their own requests
      if (request.userId !== userId && req.user!.role !== 'admin') {
        throw new AppError('Access denied', 403);
      }

      res.json({
        success: true,
        data: request
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get request details', { error });
      throw new AppError('Failed to get request details', 500);
    }
  }

  async deleteRequest(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { requestId } = req.params;

      const request = await mediaRequestRepository.findById(requestId);

      if (!request) {
        throw new AppError('Request not found', 404);
      }

      // Ensure user can only delete their own requests
      if (request.userId !== userId && req.user!.role !== 'admin') {
        throw new AppError('Access denied', 403);
      }

      // Only allow deletion of pending requests
      if (request.status !== 'pending') {
        throw new AppError('Can only delete pending requests', 400);
      }

      await mediaRequestRepository.delete(requestId);

      res.json({
        success: true,
        message: 'Request deleted successfully'
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to delete request', { error });
      throw new AppError('Failed to delete request', 500);
    }
  }
}

export const mediaController = new MediaController();