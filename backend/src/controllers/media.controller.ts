import { AppError } from '@medianest/shared';
import { Request, Response } from 'express';

import { CatchError } from '../types/common';

import { mediaRequestRepository } from '@/repositories';
import { overseerrService } from '@/services/overseerr.service';
import { logger } from '@/utils/logger';

/**
 * Media Controller - Handles all media-related HTTP requests
 * 
 * This controller manages:
 * - Media search functionality through Overseerr integration
 * - Media request creation and management
 * - User request history and details
 * - Admin request oversight
 * 
 * @class MediaController
 * @description RESTful controller for media management operations
 * @version 2.0.0
 * @author MediaNest Team
 */
export class MediaController {
  /**
   * Search for media content through external APIs
   * 
   * @async
   * @method searchMedia
   * @description Searches for movies and TV shows using Overseerr integration
   * @param {Request} req - Express request object containing search query and pagination
   * @param {Response} res - Express response object
   * @returns {Promise<void>} JSON response with search results and metadata
   * 
   * @example
   * GET /api/v1/media/search?query=inception&page=1
   * 
   * @throws {AppError} VALIDATION_ERROR - When search query is missing or invalid
   * @throws {AppError} INTERNAL_ERROR - When search operation fails
   */
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

  /**
   * Retrieve detailed information for a specific media item
   * 
   * @async
   * @method getMediaDetails
   * @description Fetches comprehensive media details including metadata, cast, and availability
   * @param {Request} req - Express request object with mediaType and tmdbId parameters
   * @param {Response} res - Express response object
   * @returns {Promise<void>} JSON response with detailed media information
   * 
   * @example
   * GET /api/v1/media/movie/123456
   * 
   * @throws {AppError} VALIDATION_ERROR - When media type is invalid or missing
   * @throws {AppError} INTERNAL_ERROR - When detail retrieval fails
   */
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
        Number(tmdbId),
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

  /**
   * Create a new media request for download/availability
   * 
   * @async
   * @method requestMedia
   * @description Submits a request for media content to be downloaded or made available
   * @param {Request} req - Express request object with media details and user context
   * @param {Response} res - Express response object
   * @returns {Promise<void>} JSON response with created request details
   * 
   * @example
   * POST /api/v1/media/request
   * Body: { mediaType: 'movie', tmdbId: 123456, seasons: [1,2] }
   * 
   * @throws {AppError} VALIDATION_ERROR - When required fields are missing or invalid
   * @throws {AppError} INTERNAL_ERROR - When request creation fails
   * 
   * @security Requires valid JWT authentication
   */
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

  /**
   * Retrieve media requests for the authenticated user
   * 
   * @async
   * @method getUserRequests
   * @description Fetches paginated list of user's media requests with filtering and sorting
   * @param {Request} req - Express request object with query parameters for filtering
   * @param {Response} res - Express response object
   * @returns {Promise<void>} JSON response with user's requests and pagination metadata
   * 
   * @example
   * GET /api/v1/media/requests?page=1&status=pending&mediaType=movie
   * 
   * Query Parameters:
   * - page: Page number (default: 1)
   * - pageSize: Items per page (default: 20)
   * - status: Filter by request status (pending, approved, declined)
   * - mediaType: Filter by media type (movie, tv)
   * - search: Search in request titles
   * - startDate/endDate: Date range filtering
   * - sortBy: Sort field (date, title, status)
   * - sortOrder: Sort direction (asc, desc)
   * 
   * @throws {AppError} INTERNAL_ERROR - When request retrieval fails
   * 
   * @security Requires valid JWT authentication
   */
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

  /**
   * Retrieve detailed information for a specific media request
   * 
   * @async
   * @method getRequestDetails
   * @description Fetches comprehensive details for a single media request with access control
   * @param {Request} req - Express request object with requestId parameter
   * @param {Response} res - Express response object
   * @returns {Promise<void>} JSON response with request details
   * 
   * @example
   * GET /api/v1/media/requests/abc123
   * 
   * @throws {AppError} VALIDATION_ERROR - When request ID is missing
   * @throws {AppError} NOT_FOUND - When request doesn't exist
   * @throws {AppError} ACCESS_DENIED - When user lacks permission to view request
   * @throws {AppError} INTERNAL_ERROR - When detail retrieval fails
   * 
   * @security Requires valid JWT authentication
   * @security Users can only view their own requests (unless admin)
   */
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

  /**
   * Delete a pending media request
   * 
   * @async
   * @method deleteRequest
   * @description Removes a media request that is still in pending status
   * @param {Request} req - Express request object with requestId parameter
   * @param {Response} res - Express response object
   * @returns {Promise<void>} JSON response confirming deletion
   * 
   * @example
   * DELETE /api/v1/media/requests/abc123
   * 
   * @throws {AppError} VALIDATION_ERROR - When request ID is missing or request is not pending
   * @throws {AppError} NOT_FOUND - When request doesn't exist
   * @throws {AppError} ACCESS_DENIED - When user lacks permission to delete request
   * @throws {AppError} INTERNAL_ERROR - When deletion fails
   * 
   * @security Requires valid JWT authentication
   * @security Users can only delete their own pending requests (unless admin)
   * @constraint Only pending requests can be deleted
   */
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

  /**
   * Retrieve all media requests (admin only)
   * 
   * @async
   * @method getAllRequests
   * @description Fetches paginated list of all media requests with advanced filtering for administrators
   * @param {Request} req - Express request object with query parameters for filtering
   * @param {Response} res - Express response object
   * @returns {Promise<void>} JSON response with all requests and pagination metadata
   * 
   * @example
   * GET /api/v1/media/admin/requests?page=1&userId=user123&status=pending
   * 
   * Query Parameters:
   * - All parameters from getUserRequests plus:
   * - userId: Filter by specific user ID
   * 
   * @throws {AppError} ACCESS_DENIED - When user is not an administrator
   * @throws {AppError} INTERNAL_ERROR - When request retrieval fails
   * 
   * @security Requires valid JWT authentication
   * @security Requires administrator role
   */
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
