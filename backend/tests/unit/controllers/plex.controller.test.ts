import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Request, Response } from 'express';
import { PlexController, plexController } from '../../../src/controllers/plex.controller';
import { plexService } from '../../../src/services/plex.service';
import { AppError } from '@medianest/shared';
import { logger } from '../../../src/utils/logger';

// Mock dependencies
vi.mock('../../../src/services/plex.service', () => ({
  plexService: {
    getServerInfo: vi.fn(),
    getLibraries: vi.fn(),
    getLibraryItems: vi.fn(),
    search: vi.fn(),
    getRecentlyAdded: vi.fn(),
    getCollections: vi.fn(),
    getCollectionDetails: vi.fn(),
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

describe('PlexController', () => {
  let controller: PlexController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new PlexController();

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

  describe('getServerInfo', () => {
    it('should get server info successfully', async () => {
      const mockServerInfo = {
        name: 'My Plex Server',
        version: '1.32.5.7516',
        platform: 'Linux',
        machineIdentifier: 'abc123',
        updatedAt: 1234567890,
      };

      (plexService.getServerInfo as Mock).mockResolvedValue(mockServerInfo);

      await controller.getServerInfo(mockRequest as Request, mockResponse as Response);

      expect(plexService.getServerInfo).toHaveBeenCalledWith('user-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockServerInfo,
      });
    });

    it('should handle service errors', async () => {
      (plexService.getServerInfo as Mock).mockRejectedValue(new Error('Service error'));

      await expect(
        controller.getServerInfo(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(AppError);

      expect(logger.error).toHaveBeenCalledWith('Failed to get server info', expect.any(Object));
    });

    it('should re-throw AppError without modification', async () => {
      const appError = new AppError('PLEX_ERROR', 'Plex server error', 502);
      (plexService.getServerInfo as Mock).mockRejectedValue(appError);

      await expect(
        controller.getServerInfo(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(appError);
    });
  });

  describe('getLibraries', () => {
    it('should get libraries successfully', async () => {
      const mockLibraries = [
        {
          key: '1',
          title: 'Movies',
          type: 'movie',
          agent: 'tv.plex.agents.movie',
          scanner: 'Plex Movie Scanner',
        },
        {
          key: '2',
          title: 'TV Shows',
          type: 'show',
          agent: 'tv.plex.agents.series',
          scanner: 'Plex Series Scanner',
        },
      ];

      (plexService.getLibraries as Mock).mockResolvedValue(mockLibraries);

      await controller.getLibraries(mockRequest as Request, mockResponse as Response);

      expect(plexService.getLibraries).toHaveBeenCalledWith('user-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockLibraries,
        meta: {
          count: 2,
        },
      });
    });

    it('should handle empty libraries', async () => {
      (plexService.getLibraries as Mock).mockResolvedValue([]);

      await controller.getLibraries(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        meta: {
          count: 0,
        },
      });
    });

    it('should handle service errors', async () => {
      (plexService.getLibraries as Mock).mockRejectedValue(new Error('Service error'));

      await expect(
        controller.getLibraries(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(AppError);

      expect(logger.error).toHaveBeenCalledWith('Failed to get libraries', expect.any(Object));
    });
  });

  describe('getLibraryItems', () => {
    it('should get library items with default pagination', async () => {
      const mockResult = {
        items: [
          { key: '1', title: 'Movie 1', year: 2023 },
          { key: '2', title: 'Movie 2', year: 2022 },
        ],
        totalSize: 50,
      };

      mockRequest.params = { libraryKey: '1' };
      (plexService.getLibraryItems as Mock).mockResolvedValue(mockResult);

      await controller.getLibraryItems(mockRequest as Request, mockResponse as Response);

      expect(plexService.getLibraryItems).toHaveBeenCalledWith('user-123', '1', {
        offset: 0,
        limit: 50,
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.items,
        meta: {
          offset: 0,
          limit: 50,
          total: 50,
        },
      });
    });

    it('should get library items with custom pagination', async () => {
      const mockResult = {
        items: [{ key: '3', title: 'Movie 3', year: 2021 }],
        totalSize: 50,
      };

      mockRequest.params = { libraryKey: '1' };
      mockRequest.query = { offset: '10', limit: '25' };
      (plexService.getLibraryItems as Mock).mockResolvedValue(mockResult);

      await controller.getLibraryItems(mockRequest as Request, mockResponse as Response);

      expect(plexService.getLibraryItems).toHaveBeenCalledWith('user-123', '1', {
        offset: 10,
        limit: 25,
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.items,
        meta: {
          offset: 10,
          limit: 25,
          total: 50,
        },
      });
    });

    it('should handle service errors', async () => {
      mockRequest.params = { libraryKey: '1' };
      (plexService.getLibraryItems as Mock).mockRejectedValue(new Error('Service error'));

      await expect(
        controller.getLibraryItems(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(AppError);
    });
  });

  describe('search', () => {
    it('should search successfully', async () => {
      const mockResults = [
        { key: '1', title: 'Test Movie', type: 'movie' },
        { key: '2', title: 'Test Show', type: 'show' },
      ];

      mockRequest.query = { query: 'test' };
      (plexService.search as Mock).mockResolvedValue(mockResults);

      await controller.search(mockRequest as Request, mockResponse as Response);

      expect(plexService.search).toHaveBeenCalledWith('user-123', 'test');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResults,
        meta: {
          query: 'test',
          count: 2,
        },
      });
    });

    it('should throw validation error for missing query', async () => {
      mockRequest.query = {};

      await expect(
        controller.search(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(AppError);

      expect(plexService.search).not.toHaveBeenCalled();
    });

    it('should throw validation error for non-string query', async () => {
      mockRequest.query = { query: 123 };

      await expect(
        controller.search(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(AppError);
    });

    it('should handle empty search results', async () => {
      mockRequest.query = { query: 'nonexistent' };
      (plexService.search as Mock).mockResolvedValue([]);

      await controller.search(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        meta: {
          query: 'nonexistent',
          count: 0,
        },
      });
    });

    it('should handle service errors', async () => {
      mockRequest.query = { query: 'test' };
      (plexService.search as Mock).mockRejectedValue(new Error('Service error'));

      await expect(
        controller.search(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(AppError);

      expect(logger.error).toHaveBeenCalledWith('Search failed', expect.any(Object));
    });
  });

  describe('getRecentlyAdded', () => {
    it('should get recently added items successfully', async () => {
      const mockItems = [
        { key: '1', title: 'New Movie', addedAt: 1234567890 },
        { key: '2', title: 'New Episode', addedAt: 1234567880 },
      ];

      (plexService.getRecentlyAdded as Mock).mockResolvedValue(mockItems);

      await controller.getRecentlyAdded(mockRequest as Request, mockResponse as Response);

      expect(plexService.getRecentlyAdded).toHaveBeenCalledWith('user-123');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockItems,
        meta: {
          count: 2,
        },
      });
    });

    it('should handle empty recently added', async () => {
      (plexService.getRecentlyAdded as Mock).mockResolvedValue([]);

      await controller.getRecentlyAdded(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        meta: {
          count: 0,
        },
      });
    });

    it('should handle service errors', async () => {
      (plexService.getRecentlyAdded as Mock).mockRejectedValue(new Error('Service error'));

      await expect(
        controller.getRecentlyAdded(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(AppError);

      expect(logger.error).toHaveBeenCalledWith('Failed to get recently added', expect.any(Object));
    });
  });

  describe('getCollections', () => {
    it('should get collections successfully', async () => {
      const mockCollections = [
        { key: '1', title: 'Marvel Movies', childCount: 25 },
        { key: '2', title: 'DC Movies', childCount: 15 },
      ];

      mockRequest.params = { libraryKey: '1' };
      (plexService.getCollections as Mock).mockResolvedValue(mockCollections);

      await controller.getCollections(mockRequest as Request, mockResponse as Response);

      expect(plexService.getCollections).toHaveBeenCalledWith('user-123', '1', {
        search: undefined,
        sort: undefined,
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCollections,
        meta: {
          count: 2,
        },
      });
    });

    it('should get collections with search and sort parameters', async () => {
      const mockCollections = [{ key: '1', title: 'Marvel Movies', childCount: 25 }];

      mockRequest.params = { libraryKey: '1' };
      mockRequest.query = { search: 'marvel', sort: 'titleSort' };
      (plexService.getCollections as Mock).mockResolvedValue(mockCollections);

      await controller.getCollections(mockRequest as Request, mockResponse as Response);

      expect(plexService.getCollections).toHaveBeenCalledWith('user-123', '1', {
        search: 'marvel',
        sort: 'titleSort',
      });
    });

    it('should handle service errors', async () => {
      mockRequest.params = { libraryKey: '1' };
      (plexService.getCollections as Mock).mockRejectedValue(new Error('Service error'));

      await expect(
        controller.getCollections(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(AppError);

      expect(logger.error).toHaveBeenCalledWith('Failed to get collections', expect.any(Object));
    });
  });

  describe('getCollectionDetails', () => {
    it('should get collection details successfully', async () => {
      const mockCollection = {
        key: '1',
        title: 'Marvel Movies',
        summary: 'Collection of Marvel superhero movies',
        childCount: 25,
        children: [
          { key: '101', title: 'Iron Man', year: 2008 },
          { key: '102', title: 'Thor', year: 2011 },
        ],
      };

      mockRequest.params = { collectionKey: '1' };
      (plexService.getCollectionDetails as Mock).mockResolvedValue(mockCollection);

      await controller.getCollectionDetails(mockRequest as Request, mockResponse as Response);

      expect(plexService.getCollectionDetails).toHaveBeenCalledWith('user-123', '1');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCollection,
      });
    });

    it('should handle service errors', async () => {
      mockRequest.params = { collectionKey: '1' };
      (plexService.getCollectionDetails as Mock).mockRejectedValue(new Error('Service error'));

      await expect(
        controller.getCollectionDetails(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(AppError);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get collection details',
        expect.any(Object),
      );
    });

    it('should re-throw AppError without modification', async () => {
      const appError = new AppError('NOT_FOUND', 'Collection not found', 404);
      mockRequest.params = { collectionKey: 'nonexistent' };
      (plexService.getCollectionDetails as Mock).mockRejectedValue(appError);

      await expect(
        controller.getCollectionDetails(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(appError);
    });
  });
});
