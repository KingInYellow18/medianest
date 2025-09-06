import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { MediaController } from '../../controllers/media.controller';
import {
  mockPrismaClient,
  mockRedisClient,
  createTestUser,
  createTestRequest,
  createTestResponse,
  createTestMediaRequest,
} from '../setup';

vi.mock('../../config/database', () => ({
  prisma: mockPrismaClient,
}));

vi.mock('../../config/redis', () => ({
  redis: mockRedisClient,
}));

describe('MediaController', () => {
  let mediaController: MediaController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let testUser: any;

  beforeEach(() => {
    mediaController = new MediaController();
    testUser = createTestUser();
    mockRequest = createTestRequest({ user: testUser });
    mockResponse = createTestResponse();
  });

  describe('getMediaRequests', () => {
    it('should return paginated media requests', async () => {
      const testRequests = [
        createTestMediaRequest({ id: '1', title: 'Movie 1' }),
        createTestMediaRequest({ id: '2', title: 'Movie 2' }),
      ];

      mockRequest.query = { page: '1', limit: '10' };
      mockPrismaClient.mediaRequest.findMany.mockResolvedValueOnce(testRequests);

      await mediaController.getMediaRequests(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: testRequests,
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
          }),
        }),
      );
    });

    it('should filter requests by user if role is user', async () => {
      const userRequests = [createTestMediaRequest({ userId: testUser.id })];

      mockRequest.user = { ...testUser, role: 'user' };
      mockRequest.query = {};
      mockPrismaClient.mediaRequest.findMany.mockResolvedValueOnce(userRequests);

      await mediaController.getMediaRequests(mockRequest as Request, mockResponse as Response);

      expect(mockPrismaClient.mediaRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: testUser.id,
          }),
        }),
      );
    });

    it('should return all requests for admin users', async () => {
      const allRequests = [
        createTestMediaRequest({ userId: 'user1' }),
        createTestMediaRequest({ userId: 'user2' }),
      ];

      mockRequest.user = { ...testUser, role: 'admin' };
      mockRequest.query = {};
      mockPrismaClient.mediaRequest.findMany.mockResolvedValueOnce(allRequests);

      await mediaController.getMediaRequests(mockRequest as Request, mockResponse as Response);

      expect(mockPrismaClient.mediaRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            userId: expect.any(String),
          }),
        }),
      );
    });

    it('should handle database errors', async () => {
      mockPrismaClient.mediaRequest.findMany.mockRejectedValueOnce(new Error('Database error'));

      await mediaController.getMediaRequests(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Failed to fetch'),
        }),
      );
    });

    it('should validate pagination parameters', async () => {
      mockRequest.query = { page: 'invalid', limit: 'invalid' };

      await mediaController.getMediaRequests(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid pagination'),
        }),
      );
    });
  });

  describe('createMediaRequest', () => {
    it('should create a new media request successfully', async () => {
      const requestData = {
        mediaType: 'movie',
        tmdbId: '12345',
        title: 'New Movie',
        overview: 'A great movie',
      };

      mockRequest.body = requestData;
      const createdRequest = createTestMediaRequest(requestData);
      mockPrismaClient.mediaRequest.create.mockResolvedValueOnce(createdRequest);

      await mediaController.createMediaRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: createdRequest,
        }),
      );
      expect(mockPrismaClient.mediaRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ...requestData,
            userId: testUser.id,
            status: 'pending',
          }),
        }),
      );
    });

    it('should validate required fields', async () => {
      mockRequest.body = {
        mediaType: 'movie',
        // missing tmdbId and title
      };

      await mediaController.createMediaRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('required'),
        }),
      );
    });

    it('should validate media type', async () => {
      mockRequest.body = {
        mediaType: 'invalid',
        tmdbId: '12345',
        title: 'Movie',
      };

      await mediaController.createMediaRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid media type'),
        }),
      );
    });

    it('should prevent duplicate requests', async () => {
      const requestData = {
        mediaType: 'movie',
        tmdbId: '12345',
        title: 'Duplicate Movie',
      };

      mockRequest.body = requestData;
      mockPrismaClient.mediaRequest.findFirst = vi
        .fn()
        .mockResolvedValueOnce(createTestMediaRequest({ tmdbId: requestData.tmdbId }));

      await mediaController.createMediaRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('already requested'),
        }),
      );
    });
  });

  describe('updateMediaRequest', () => {
    it('should update media request status as admin', async () => {
      const requestId = 'test-request-id';
      const updateData = { status: 'approved' };

      mockRequest.user = { ...testUser, role: 'admin' };
      mockRequest.params = { id: requestId };
      mockRequest.body = updateData;

      const existingRequest = createTestMediaRequest({ id: requestId });
      const updatedRequest = { ...existingRequest, ...updateData };

      mockPrismaClient.mediaRequest.findUnique.mockResolvedValueOnce(existingRequest);
      mockPrismaClient.mediaRequest.update.mockResolvedValueOnce(updatedRequest);

      await mediaController.updateMediaRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: updatedRequest,
        }),
      );
    });

    it('should only allow users to update their own requests', async () => {
      const requestId = 'test-request-id';
      const updateData = { status: 'cancelled' };

      mockRequest.user = { ...testUser, role: 'user' };
      mockRequest.params = { id: requestId };
      mockRequest.body = updateData;

      const otherUserRequest = createTestMediaRequest({
        id: requestId,
        userId: 'other-user-id',
      });

      mockPrismaClient.mediaRequest.findUnique.mockResolvedValueOnce(otherUserRequest);

      await mediaController.updateMediaRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('permission'),
        }),
      );
    });

    it('should return 404 for non-existent request', async () => {
      mockRequest.params = { id: 'non-existent-id' };
      mockRequest.body = { status: 'approved' };
      mockPrismaClient.mediaRequest.findUnique.mockResolvedValueOnce(null);

      await mediaController.updateMediaRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('not found'),
        }),
      );
    });

    it('should validate status values', async () => {
      const requestId = 'test-request-id';

      mockRequest.params = { id: requestId };
      mockRequest.body = { status: 'invalid-status' };

      const existingRequest = createTestMediaRequest({ id: requestId, userId: testUser.id });
      mockPrismaClient.mediaRequest.findUnique.mockResolvedValueOnce(existingRequest);

      await mediaController.updateMediaRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid status'),
        }),
      );
    });
  });

  describe('deleteMediaRequest', () => {
    it('should delete media request as admin', async () => {
      const requestId = 'test-request-id';

      mockRequest.user = { ...testUser, role: 'admin' };
      mockRequest.params = { id: requestId };

      const existingRequest = createTestMediaRequest({ id: requestId });
      mockPrismaClient.mediaRequest.findUnique.mockResolvedValueOnce(existingRequest);
      mockPrismaClient.mediaRequest.delete.mockResolvedValueOnce(existingRequest);

      await mediaController.deleteMediaRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('deleted'),
        }),
      );
    });

    it('should allow users to delete their own pending requests', async () => {
      const requestId = 'test-request-id';

      mockRequest.user = { ...testUser, role: 'user' };
      mockRequest.params = { id: requestId };

      const userRequest = createTestMediaRequest({
        id: requestId,
        userId: testUser.id,
        status: 'pending',
      });

      mockPrismaClient.mediaRequest.findUnique.mockResolvedValueOnce(userRequest);
      mockPrismaClient.mediaRequest.delete.mockResolvedValueOnce(userRequest);

      await mediaController.deleteMediaRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should prevent users from deleting approved requests', async () => {
      const requestId = 'test-request-id';

      mockRequest.user = { ...testUser, role: 'user' };
      mockRequest.params = { id: requestId };

      const approvedRequest = createTestMediaRequest({
        id: requestId,
        userId: testUser.id,
        status: 'approved',
      });

      mockPrismaClient.mediaRequest.findUnique.mockResolvedValueOnce(approvedRequest);

      await mediaController.deleteMediaRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Cannot delete'),
        }),
      );
    });
  });

  describe('searchMedia', () => {
    it('should search media using external API', async () => {
      const searchQuery = 'test movie';
      const mockResults = [
        { id: 1, title: 'Test Movie 1', overview: 'Description 1' },
        { id: 2, title: 'Test Movie 2', overview: 'Description 2' },
      ];

      mockRequest.query = { q: searchQuery, type: 'movie' };

      // Mock the external API call
      const axios = await import('axios');
      vi.mocked(axios.default.get).mockResolvedValueOnce({
        data: { results: mockResults },
      });

      await mediaController.searchMedia(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockResults,
        }),
      );
    });

    it('should validate search query', async () => {
      mockRequest.query = {}; // missing query

      await mediaController.searchMedia(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Search query required'),
        }),
      );
    });

    it('should handle external API errors', async () => {
      mockRequest.query = { q: 'test', type: 'movie' };

      const axios = await import('axios');
      vi.mocked(axios.default.get).mockRejectedValueOnce(new Error('API Error'));

      await mediaController.searchMedia(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Search failed'),
        }),
      );
    });

    it('should cache search results', async () => {
      const searchQuery = 'cached movie';
      const cachedResults = [{ id: 1, title: 'Cached Movie' }];

      mockRequest.query = { q: searchQuery, type: 'movie' };
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedResults));

      await mediaController.searchMedia(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: cachedResults,
          cached: true,
        }),
      );

      // Should not call external API
      const axios = await import('axios');
      expect(axios.default.get).not.toHaveBeenCalled();
    });
  });
});
