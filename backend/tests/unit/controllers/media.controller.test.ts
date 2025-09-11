import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Request, Response } from 'express';
import { MediaController, mediaController } from '../../../src/controllers/media.controller';
import { mediaRequestRepository } from '../../../src/repositories';
import { overseerrService } from '../../../src/services/overseerr.service';
import { AppError } from '@medianest/shared';
import { logger } from '../../../src/utils/logger';

// Mock dependencies
vi.mock('../../../src/repositories', () => ({
  mediaRequestRepository: {
    count: vi.fn(),
    findMany: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../src/services/overseerr.service', () => ({
  overseerrService: {
    searchMedia: vi.fn(),
    getMediaDetails: vi.fn(),
    requestMedia: vi.fn(),
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('MediaController', () => {
  let controller: MediaController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new MediaController();
    
    mockRequest = {
      query: {},
      params: {},
      body: {},
      user: {
        id: 'user-123',
        role: 'user',
        email: 'test@example.com',
      },
    };

    mockResponse = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
  });

  describe('searchMedia', () => {
    it('should search media successfully', async () => {
      const mockResults = {
        results: [
          { id: 1, title: 'Test Movie', mediaType: 'movie' },
          { id: 2, title: 'Test Show', mediaType: 'tv' },
        ],
        totalPages: 1,
      };

      mockRequest.query = { query: 'test', page: '1' };
      (overseerrService.searchMedia as Mock).mockResolvedValue(mockResults);

      await controller.searchMedia(mockRequest as Request, mockResponse as Response);

      expect(overseerrService.searchMedia).toHaveBeenCalledWith('test', 1);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResults.results,
        meta: {
          query: 'test',
          page: 1,
          totalPages: 1,
        },
      });
    });

    it('should throw validation error for missing query', async () => {
      mockRequest.query = {};

      await expect(
        controller.searchMedia(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);

      expect(overseerrService.searchMedia).not.toHaveBeenCalled();
    });

    it('should throw validation error for non-string query', async () => {
      mockRequest.query = { query: 123 };

      await expect(
        controller.searchMedia(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);
    });

    it('should handle service errors', async () => {
      mockRequest.query = { query: 'test' };
      (overseerrService.searchMedia as Mock).mockRejectedValue(new Error('Service error'));

      await expect(
        controller.searchMedia(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should re-throw AppError without modification', async () => {
      const appError = new AppError('SEARCH_ERROR', 'Search failed', 400);
      mockRequest.query = { query: 'test' };
      (overseerrService.searchMedia as Mock).mockRejectedValue(appError);

      await expect(
        controller.searchMedia(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(appError);
    });
  });

  describe('getMediaDetails', () => {
    it('should get media details successfully', async () => {
      const mockDetails = {
        id: 1,
        title: 'Test Movie',
        overview: 'Test description',
        releaseDate: '2023-01-01',
      };

      mockRequest.params = { mediaType: 'movie', tmdbId: '123' };
      (overseerrService.getMediaDetails as Mock).mockResolvedValue(mockDetails);

      await controller.getMediaDetails(mockRequest as Request, mockResponse as Response);

      expect(overseerrService.getMediaDetails).toHaveBeenCalledWith('movie', 123);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockDetails,
      });
    });

    it('should throw validation error for missing mediaType', async () => {
      mockRequest.params = { tmdbId: '123' };

      await expect(
        controller.getMediaDetails(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);
    });

    it('should throw validation error for invalid mediaType', async () => {
      mockRequest.params = { mediaType: 'invalid', tmdbId: '123' };

      await expect(
        controller.getMediaDetails(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);
    });

    it('should handle service errors', async () => {
      mockRequest.params = { mediaType: 'movie', tmdbId: '123' };
      (overseerrService.getMediaDetails as Mock).mockRejectedValue(new Error('Service error'));

      await expect(
        controller.getMediaDetails(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('requestMedia', () => {
    it('should request media successfully', async () => {
      const mockRequest = {
        id: 'request-123',
        userId: 'user-123',
        mediaType: 'movie',
        tmdbId: 456,
        status: 'pending',
      };

      mockRequest.body = { mediaType: 'movie', tmdbId: 456 };
      (overseerrService.requestMedia as Mock).mockResolvedValue(mockRequest);

      await controller.requestMedia(mockRequest as Request, mockResponse as Response);

      expect(overseerrService.requestMedia).toHaveBeenCalledWith('user-123', {
        mediaType: 'movie',
        tmdbId: 456,
        seasons: undefined,
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockRequest,
        meta: {
          timestamp: expect.any(String),
        },
      });
    });

    it('should support backward compatibility with mediaId', async () => {
      const mockRequestData = {
        id: 'request-123',
        userId: 'user-123',
        mediaType: 'movie',
        tmdbId: 456,
        status: 'pending',
      };

      mockRequest.body = { mediaType: 'movie', mediaId: 456 };
      (overseerrService.requestMedia as Mock).mockResolvedValue(mockRequestData);

      await controller.requestMedia(mockRequest as Request, mockResponse as Response);

      expect(overseerrService.requestMedia).toHaveBeenCalledWith('user-123', {
        mediaType: 'movie',
        tmdbId: 456,
        seasons: undefined,
      });
    });

    it('should include seasons for TV shows', async () => {
      const mockRequestData = {
        id: 'request-123',
        userId: 'user-123',
        mediaType: 'tv',
        tmdbId: 456,
        seasons: [1, 2, 3],
        status: 'pending',
      };

      mockRequest.body = { mediaType: 'tv', tmdbId: 456, seasons: [1, 2, 3] };
      (overseerrService.requestMedia as Mock).mockResolvedValue(mockRequestData);

      await controller.requestMedia(mockRequest as Request, mockResponse as Response);

      expect(overseerrService.requestMedia).toHaveBeenCalledWith('user-123', {
        mediaType: 'tv',
        tmdbId: 456,
        seasons: [1, 2, 3],
      });
    });

    it('should throw validation error for missing required fields', async () => {
      mockRequest.body = { mediaType: 'movie' };

      await expect(
        controller.requestMedia(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);
    });

    it('should throw validation error for invalid mediaType', async () => {
      mockRequest.body = { mediaType: 'invalid', tmdbId: 456 };

      await expect(
        controller.requestMedia(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);
    });
  });

  describe('getUserRequests', () => {
    it('should get user requests with default pagination', async () => {
      const mockRequests = [
        { id: 'req-1', title: 'Movie 1', status: 'pending' },
        { id: 'req-2', title: 'Movie 2', status: 'approved' },
      ];

      (mediaRequestRepository.count as Mock).mockResolvedValue(10);
      (mediaRequestRepository.findMany as Mock).mockResolvedValue(mockRequests);

      await controller.getUserRequests(mockRequest as Request, mockResponse as Response);

      expect(mediaRequestRepository.count).toHaveBeenCalledWith({ userId: 'user-123' });
      expect(mediaRequestRepository.findMany).toHaveBeenCalledWith(
        { userId: 'user-123' },
        {
          skip: 0,
          take: 20,
          orderBy: { requestedAt: 'desc' },
        }
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockRequests,
        meta: {
          totalCount: 10,
          totalPages: 1,
          currentPage: 1,
          timestamp: expect.any(String),
        },
      });
    });

    it('should filter requests by status', async () => {
      mockRequest.query = { status: 'pending' };
      (mediaRequestRepository.count as Mock).mockResolvedValue(5);
      (mediaRequestRepository.findMany as Mock).mockResolvedValue([]);

      await controller.getUserRequests(mockRequest as Request, mockResponse as Response);

      expect(mediaRequestRepository.count).toHaveBeenCalledWith({
        userId: 'user-123',
        status: 'pending',
      });
    });

    it('should filter requests by search term', async () => {
      mockRequest.query = { search: 'matrix' };
      (mediaRequestRepository.count as Mock).mockResolvedValue(1);
      (mediaRequestRepository.findMany as Mock).mockResolvedValue([]);

      await controller.getUserRequests(mockRequest as Request, mockResponse as Response);

      expect(mediaRequestRepository.count).toHaveBeenCalledWith({
        userId: 'user-123',
        title: { contains: 'matrix', mode: 'insensitive' },
      });
    });

    it('should filter requests by date range', async () => {
      mockRequest.query = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
      };
      (mediaRequestRepository.count as Mock).mockResolvedValue(3);
      (mediaRequestRepository.findMany as Mock).mockResolvedValue([]);

      await controller.getUserRequests(mockRequest as Request, mockResponse as Response);

      expect(mediaRequestRepository.count).toHaveBeenCalledWith({
        userId: 'user-123',
        requestedAt: {
          gte: new Date('2023-01-01'),
          lte: new Date('2023-12-31'),
        },
      });
    });

    it('should handle pagination correctly', async () => {
      mockRequest.query = { page: '2', pageSize: '10' };
      (mediaRequestRepository.count as Mock).mockResolvedValue(25);
      (mediaRequestRepository.findMany as Mock).mockResolvedValue([]);

      await controller.getUserRequests(mockRequest as Request, mockResponse as Response);

      expect(mediaRequestRepository.findMany).toHaveBeenCalledWith(
        { userId: 'user-123' },
        {
          skip: 10,
          take: 10,
          orderBy: { requestedAt: 'desc' },
        }
      );
    });
  });

  describe('getRequestDetails', () => {
    it('should get request details for user own request', async () => {
      const mockRequest = {
        id: 'req-123',
        userId: 'user-123',
        title: 'Test Movie',
        status: 'pending',
      };

      mockRequest.params = { requestId: 'req-123' };
      (mediaRequestRepository.findById as Mock).mockResolvedValue(mockRequest);

      await controller.getRequestDetails(mockRequest as Request, mockResponse as Response);

      expect(mediaRequestRepository.findById).toHaveBeenCalledWith('req-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockRequest,
      });
    });

    it('should allow admin to view any request', async () => {
      const mockRequestData = {
        id: 'req-123',
        userId: 'other-user',
        title: 'Test Movie',
        status: 'pending',
      };

      mockRequest.params = { requestId: 'req-123' };
      mockRequest.user = { id: 'admin-123', role: 'admin' };
      (mediaRequestRepository.findById as Mock).mockResolvedValue(mockRequestData);

      await controller.getRequestDetails(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockRequestData,
      });
    });

    it('should throw access denied for other users requests', async () => {
      const mockRequestData = {
        id: 'req-123',
        userId: 'other-user',
        title: 'Test Movie',
        status: 'pending',
      };

      mockRequest.params = { requestId: 'req-123' };
      (mediaRequestRepository.findById as Mock).mockResolvedValue(mockRequestData);

      await expect(
        controller.getRequestDetails(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);
    });

    it('should throw not found for non-existent request', async () => {
      mockRequest.params = { requestId: 'non-existent' };
      (mediaRequestRepository.findById as Mock).mockResolvedValue(null);

      await expect(
        controller.getRequestDetails(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);
    });

    it('should throw validation error for missing requestId', async () => {
      mockRequest.params = {};

      await expect(
        controller.getRequestDetails(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);
    });
  });

  describe('deleteRequest', () => {
    it('should delete pending request successfully', async () => {
      const mockRequestData = {
        id: 'req-123',
        userId: 'user-123',
        title: 'Test Movie',
        status: 'pending',
      };

      mockRequest.params = { requestId: 'req-123' };
      (mediaRequestRepository.findById as Mock).mockResolvedValue(mockRequestData);
      (mediaRequestRepository.delete as Mock).mockResolvedValue(undefined);

      await controller.deleteRequest(mockRequest as Request, mockResponse as Response);

      expect(mediaRequestRepository.delete).toHaveBeenCalledWith('req-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Request deleted successfully',
      });
    });

    it('should allow admin to delete any pending request', async () => {
      const mockRequestData = {
        id: 'req-123',
        userId: 'other-user',
        title: 'Test Movie',
        status: 'pending',
      };

      mockRequest.params = { requestId: 'req-123' };
      mockRequest.user = { id: 'admin-123', role: 'admin' };
      (mediaRequestRepository.findById as Mock).mockResolvedValue(mockRequestData);
      (mediaRequestRepository.delete as Mock).mockResolvedValue(undefined);

      await controller.deleteRequest(mockRequest as Request, mockResponse as Response);

      expect(mediaRequestRepository.delete).toHaveBeenCalledWith('req-123');
    });

    it('should throw error for non-pending requests', async () => {
      const mockRequestData = {
        id: 'req-123',
        userId: 'user-123',
        title: 'Test Movie',
        status: 'approved',
      };

      mockRequest.params = { requestId: 'req-123' };
      (mediaRequestRepository.findById as Mock).mockResolvedValue(mockRequestData);

      await expect(
        controller.deleteRequest(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);

      expect(mediaRequestRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('getAllRequests', () => {
    it('should get all requests for admin', async () => {
      const mockRequests = [
        { id: 'req-1', userId: 'user-1', title: 'Movie 1' },
        { id: 'req-2', userId: 'user-2', title: 'Movie 2' },
      ];

      mockRequest.user = { id: 'admin-123', role: 'admin' };
      (mediaRequestRepository.count as Mock).mockResolvedValue(2);
      (mediaRequestRepository.findMany as Mock).mockResolvedValue(mockRequests);

      await controller.getAllRequests(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockRequests,
        meta: {
          totalCount: 2,
          totalPages: 1,
          currentPage: 1,
          timestamp: expect.any(String),
        },
      });
    });

    it('should throw access denied for non-admin users', async () => {
      mockRequest.user = { id: 'user-123', role: 'user' };

      await expect(
        controller.getAllRequests(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(AppError);
    });

    it('should filter by userId when provided', async () => {
      mockRequest.user = { id: 'admin-123', role: 'admin' };
      mockRequest.query = { userId: 'user-123' };
      (mediaRequestRepository.count as Mock).mockResolvedValue(5);
      (mediaRequestRepository.findMany as Mock).mockResolvedValue([]);

      await controller.getAllRequests(mockRequest as Request, mockResponse as Response);

      expect(mediaRequestRepository.count).toHaveBeenCalledWith({
        userId: 'user-123',
      });
    });
  });
});