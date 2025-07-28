import { AppError } from '@medianest/shared';
import { Request, Response } from 'express';

import { mediaRequestRepository } from '@/repositories';
import { overseerrService } from '@/services/overseerr.service';
import { logger } from '@/utils/logger';

export class MediaController {
  async searchMedia(req: Request, res: Response) {
    try {
      const { query, page = 1 } = req.query;

      if (!query || typeof query !== 'string') {
        throw new AppError('BAD_REQUEST', 'Search query is required', 400);
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
    } catch (error) {
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

      if (!tmdbId) {
        throw new AppError('BAD_REQUEST', 'TMDB ID is required', 400);
      }

      if (!['movie', 'tv'].includes(mediaType)) {
        throw new AppError('BAD_REQUEST', 'Invalid media type', 400);
      }

      const details = await overseerrService.getMediaDetails(mediaType as 'movie' | 'tv', tmdbId);

      res.json({
        success: true,
        data: details,
      });
    } catch (error) {
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
      const { mediaType, tmdbId, seasons } = req.body;

      if (!mediaType || !tmdbId) {
        throw new AppError('BAD_REQUEST', 'mediaType and tmdbId are required', 400);
      }

      if (!['movie', 'tv'].includes(mediaType)) {
        throw new AppError('BAD_REQUEST', 'Invalid media type', 400);
      }

      const request = await overseerrService.requestMedia(userId, {
        mediaType,
        tmdbId: String(tmdbId),
        seasons,
      });

      res.status(201).json({
        success: true,
        data: request,
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

      const requests = await mediaRequestRepository.findMany({
        where: filters,
        skip,
        take: Number(pageSize),
        orderBy,
      });

      res.json({
        success: true,
        data: {
          requests,
          totalCount,
          totalPages,
          currentPage: Number(page),
        },
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
        data: request,
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
        message: 'Request deleted successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to delete request', { error });
      throw new AppError('Failed to delete request', 500);
    }
  }

  async updateRequest(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { requestId } = req.params;
      const { status, adminNote } = req.body;

      if (!status) {
        throw new AppError('Status is required', 400);
      }

      const validStatuses = ['pending', 'approved', 'rejected', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new AppError('Invalid status', 400);
      }

      const request = await mediaRequestRepository.findById(requestId);

      if (!request) {
        throw new AppError('Request not found', 404);
      }

      // Only admins can update status to approved/rejected/completed
      // Users can only cancel their own pending requests
      if (userRole !== 'admin') {
        if (request.userId !== userId) {
          throw new AppError('Access denied', 403);
        }
        if (status !== 'cancelled' || request.status !== 'pending') {
          throw new AppError('Users can only cancel their own pending requests', 403);
        }
      }

      const updateData: any = { status };
      if (adminNote && userRole === 'admin') {
        updateData.adminNote = adminNote;
      }
      if (status === 'completed') {
        updateData.completedAt = new Date();
      }

      const updatedRequest = await mediaRequestRepository.update(requestId, updateData);

      res.json({
        success: true,
        data: updatedRequest,
        message: `Request ${status} successfully`,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to update request', { error });
      throw new AppError('Failed to update request', 500);
    }
  }

  async getRequestStatus(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { requestId } = req.params;

      const request = await mediaRequestRepository.findById(requestId);

      if (!request) {
        throw new AppError('Request not found', 404);
      }

      // Ensure user can only see their own requests (unless admin)
      if (request.userId !== userId && userRole !== 'admin') {
        throw new AppError('Access denied', 403);
      }

      // Calculate status details
      const statusHistory = [
        {
          status: 'pending',
          timestamp: request.requestedAt,
          message: 'Request submitted',
        },
      ];

      if (request.status === 'approved' && request.updatedAt > request.requestedAt) {
        statusHistory.push({
          status: 'approved',
          timestamp: request.updatedAt,
          message: 'Request approved by admin',
        });
      }

      if (request.status === 'rejected' && request.updatedAt > request.requestedAt) {
        statusHistory.push({
          status: 'rejected',
          timestamp: request.updatedAt,
          message: request.adminNote || 'Request rejected by admin',
        });
      }

      if (request.status === 'completed' && request.completedAt) {
        statusHistory.push({
          status: 'completed',
          timestamp: request.completedAt,
          message: 'Media successfully added to library',
        });
      }

      if (request.status === 'cancelled' && request.updatedAt > request.requestedAt) {
        statusHistory.push({
          status: 'cancelled',
          timestamp: request.updatedAt,
          message: 'Request cancelled',
        });
      }

      const estimatedTime = request.status === 'pending' ? '2-24 hours' : null;
      const progress =
        {
          pending: 25,
          approved: 50,
          downloading: 75,
          completed: 100,
          rejected: 0,
          cancelled: 0,
        }[request.status] || 0;

      res.json({
        success: true,
        data: {
          requestId: request.id,
          currentStatus: request.status,
          progress,
          estimatedTime,
          statusHistory,
          adminNote: request.adminNote,
          requestedAt: request.requestedAt,
          completedAt: request.completedAt,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get request status', { error });
      throw new AppError('Failed to get request status', 500);
    }
  }

  async getAllRequests(req: Request, res: Response) {
    try {
      // Only admins can access this endpoint
      if (req.user!.role !== 'admin') {
        throw new AppError('Access denied', 403);
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

      const requests = await mediaRequestRepository.findMany({
        where: filters,
        skip,
        take: Number(pageSize),
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              plexUsername: true,
              email: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: {
          requests,
          totalCount,
          totalPages,
          currentPage: Number(page),
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to get all requests', { error });
      throw new AppError('Failed to get requests', 500);
    }
  }
}

export const mediaController = new MediaController();
