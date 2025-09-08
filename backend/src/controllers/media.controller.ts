import { Request, Response } from 'express';

import { mediaRequestRepository } from '@/repositories';
import { overseerrService } from '@/services/overseerr.service';
import { AppError } from '@medianest/shared';
import { logger } from '@/utils/logger';
import { CatchError } from '../types/common';

export class MediaController {
  async searchMedia(req: Request, res: Response) {
    try {
      const { query, page = 1 } = req.query;

      if (!query || typeof query !== 'string') {
        throw new AppError('VALIDATION_ERROR', 'Search query is required', 400);
      }

      const results = await overseerrService.searchMedia(query, Number(page));

      res.json({
        success: true,
        data: results.results,
        meta: {
          query,
          page: Number(page),
          totalPages: results.totalPages,
        },
      });
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Media search failed', { error });
      throw new AppError('INTERNAL_ERROR', 'Search failed', 500);
    }
  }

  async getMediaDetails(req: Request, res: Response) {
    try {
      const { mediaType, tmdbId } = req.params;

      if (!mediaType) {
        throw new AppError('VALIDATION_ERROR', 'Media type is required', 400);
      }

      if (!['movie', 'tv'].includes(mediaType)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid media type', 400);
      }

      const details = await overseerrService.getMediaDetails(
        mediaType as 'movie' | 'tv',
        Number(tmdbId)
      );

      res.json({
        success: true,
        data: details,
      });
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get media details', { error });
      throw new AppError('INTERNAL_ERROR', 'Failed to get media details', 500);
    }
  }

  async requestMedia(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { mediaId, mediaType, tmdbId, seasons } = req.body;

      // Support both mediaId and tmdbId for backward compatibility
      const finalTmdbId = tmdbId || mediaId;

      if (!mediaType || !finalTmdbId) {
        throw new AppError('VALIDATION_ERROR', 'mediaType and mediaId/tmdbId are required', 400);
      }

      if (!['movie', 'tv'].includes(mediaType)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid media type', 400);
      }

      const request = await overseerrService.requestMedia(userId, {
        mediaType,
        tmdbId: Number(finalTmdbId),
        seasons,
      });

      res.status(201).json({
        success: true,
        data: request,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to request media', { error });
      throw new AppError('INTERNAL_ERROR', 'Failed to submit media request', 500);
    }
  }

  async getUserRequests(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const {
        page = 1,
        pageSize = 20,
        status,
        mediaType,
        search,
        startDate,
        endDate,
        sortBy = 'date',
        sortOrder = 'desc',
      } = req.query;

      // Build filters
      const filters: Record<string, any> = { userId };

      if (status && status !== 'all') {
        filters.status = status as string;
      }

      if (mediaType && mediaType !== 'all') {
        filters.mediaType = mediaType as string;
      }

      if (search) {
        filters.title = { contains: search as string, mode: 'insensitive' };
      }

      if (startDate || endDate) {
        filters.requestedAt = {};
        if (startDate) {
          filters.requestedAt.gte = new Date(startDate as string);
        }
        if (endDate) {
          filters.requestedAt.lte = new Date(endDate as string);
        }
      }

      // Calculate skip
      const skip = (Number(page) - 1) * Number(pageSize);

      // Get total count for pagination
      const totalCount = await mediaRequestRepository.count(filters);
      const totalPages = Math.ceil(totalCount / Number(pageSize));

      // Get requests with sorting
      const orderBy: Record<string, any> = {};
      if (sortBy === 'date') {
        orderBy.requestedAt = sortOrder;
      } else if (sortBy === 'title') {
        orderBy.title = sortOrder;
      } else if (sortBy === 'status') {
        orderBy.status = sortOrder;
      }

      const requests = await mediaRequestRepository.findMany(filters, {
        skip,
        take: Number(pageSize),
        orderBy,
      });

      res.json({
        success: true,
        data: requests,
        meta: {
          totalCount,
          totalPages,
          currentPage: Number(page),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: CatchError) {
      logger.error('Failed to get user requests', { error });
      throw new AppError('INTERNAL_ERROR', 'Failed to get requests', 500);
    }
  }

  async getRequestDetails(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { requestId } = req.params;

      if (!requestId) {
        throw new AppError('VALIDATION_ERROR', 'Request ID is required', 400);
      }

      const request = await mediaRequestRepository.findById(requestId);

      if (!request) {
        throw new AppError('NOT_FOUND', 'Request not found', 404);
      }

      // Ensure user can only see their own requests
      if (request.userId !== userId && (req.user as any).role !== 'admin') {
        throw new AppError('ACCESS_DENIED', 'Access denied', 403);
      }

      res.json({
        success: true,
        data: request,
      });
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get request details', { error });
      throw new AppError('INTERNAL_ERROR', 'Failed to get request details', 500);
    }
  }

  async deleteRequest(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { requestId } = req.params;

      if (!requestId) {
        throw new AppError('VALIDATION_ERROR', 'Request ID is required', 400);
      }

      const request = await mediaRequestRepository.findById(requestId);

      if (!request) {
        throw new AppError('NOT_FOUND', 'Request not found', 404);
      }

      // Ensure user can only delete their own requests
      if (request.userId !== userId && (req.user as any).role !== 'admin') {
        throw new AppError('ACCESS_DENIED', 'Access denied', 403);
      }

      // Only allow deletion of pending requests
      if (request.status !== 'pending') {
        throw new AppError('VALIDATION_ERROR', 'Can only delete pending requests', 400);
      }

      await mediaRequestRepository.delete(requestId);

      res.json({
        success: true,
        message: 'Request deleted successfully',
      });
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to delete request', { error });
      throw new AppError('INTERNAL_ERROR', 'Failed to delete request', 500);
    }
  }

  async getAllRequests(req: Request, res: Response) {
    try {
      // Only admins can access this endpoint
      if ((req.user as any).role !== 'admin') {
        throw new AppError('ACCESS_DENIED', 'Access denied', 403);
      }

      const {
        page = 1,
        pageSize = 20,
        status,
        mediaType,
        search,
        startDate,
        endDate,
        sortBy = 'date',
        sortOrder = 'desc',
        userId,
      } = req.query;

      // Build filters
      const filters: Record<string, any> = {};

      if (userId) {
        filters.userId = userId as string;
      }

      if (status && status !== 'all') {
        filters.status = status as string;
      }

      if (mediaType && mediaType !== 'all') {
        filters.mediaType = mediaType as string;
      }

      if (search) {
        filters.title = { contains: search as string, mode: 'insensitive' };
      }

      if (startDate || endDate) {
        filters.requestedAt = {};
        if (startDate) {
          filters.requestedAt.gte = new Date(startDate as string);
        }
        if (endDate) {
          filters.requestedAt.lte = new Date(endDate as string);
        }
      }

      // Calculate skip
      const skip = (Number(page) - 1) * Number(pageSize);

      // Get total count for pagination
      const totalCount = await mediaRequestRepository.count(filters);
      const totalPages = Math.ceil(totalCount / Number(pageSize));

      // Get requests with sorting
      const orderBy: Record<string, any> = {};
      if (sortBy === 'date') {
        orderBy.requestedAt = sortOrder;
      } else if (sortBy === 'title') {
        orderBy.title = sortOrder;
      } else if (sortBy === 'status') {
        orderBy.status = sortOrder;
      }

      const requests = await mediaRequestRepository.findMany(filters, {
        skip,
        take: Number(pageSize),
        orderBy,
      });

      res.json({
        success: true,
        data: requests,
        meta: {
          totalCount,
          totalPages,
          currentPage: Number(page),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: CatchError) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get all requests', { error });
      throw new AppError('INTERNAL_ERROR', 'Failed to get requests', 500);
    }
  }
}

export const mediaController = new MediaController();
