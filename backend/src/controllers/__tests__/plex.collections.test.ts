import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

import { plexController } from '../plex.controller';
import { plexService } from '@/services/plex.service';
import { AppError } from '@medianest/shared';

vi.mock('@/services/plex.service');
vi.mock('@/utils/logger');

describe('PlexController - Collections', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: any;
  let mockStatus: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnThis();

    mockRequest = {
      user: { id: 'test-user-id' },
      params: {},
      query: {},
    };

    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };
  });

  describe('getCollections', () => {
    it('should return collections for a library', async () => {
      const mockCollections = [
        {
          ratingKey: '1',
          key: '/library/metadata/1',
          title: 'Marvel Movies',
          summary: 'All Marvel movies',
          childCount: 25,
          addedAt: 1234567890,
        },
        {
          ratingKey: '2',
          key: '/library/metadata/2',
          title: 'DC Movies',
          summary: 'All DC movies',
          childCount: 15,
          addedAt: 1234567890,
        },
      ];

      mockRequest.params = { libraryKey: '1' };
      vi.mocked(plexService.getCollections).mockResolvedValue(mockCollections);

      await plexController.getCollections(mockRequest as Request, mockResponse as Response);

      expect(plexService.getCollections).toHaveBeenCalledWith('test-user-id', '1', {
        search: undefined,
        sort: undefined,
      });
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockCollections,
        meta: {
          count: 2,
        },
      });
    });

    it('should apply search and sort filters', async () => {
      const mockCollections = [
        {
          ratingKey: '1',
          key: '/library/metadata/1',
          title: 'Marvel Movies',
          childCount: 25,
        },
      ];

      mockRequest.params = { libraryKey: '1' };
      mockRequest.query = { search: 'marvel', sort: 'title' };
      vi.mocked(plexService.getCollections).mockResolvedValue(mockCollections);

      await plexController.getCollections(mockRequest as Request, mockResponse as Response);

      expect(plexService.getCollections).toHaveBeenCalledWith('test-user-id', '1', {
        search: 'marvel',
        sort: 'title',
      });
    });

    it('should handle service errors', async () => {
      mockRequest.params = { libraryKey: '1' };
      vi.mocked(plexService.getCollections).mockRejectedValue(new Error('Plex connection failed'));

      await expect(
        plexController.getCollections(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(AppError);
    });
  });

  describe('getCollectionDetails', () => {
    it('should return collection details with items', async () => {
      const mockCollectionDetails = {
        ratingKey: '1',
        key: '/library/metadata/1',
        title: 'Marvel Movies',
        summary: 'All Marvel movies',
        childCount: 25,
        items: [
          {
            ratingKey: '101',
            title: 'Iron Man',
            year: 2008,
            type: 'movie',
          },
          {
            ratingKey: '102',
            title: 'Thor',
            year: 2011,
            type: 'movie',
          },
        ],
      };

      mockRequest.params = { collectionKey: '/library/metadata/1' };
      vi.mocked(plexService.getCollectionDetails).mockResolvedValue(mockCollectionDetails);

      await plexController.getCollectionDetails(mockRequest as Request, mockResponse as Response);

      expect(plexService.getCollectionDetails).toHaveBeenCalledWith(
        'test-user-id',
        '/library/metadata/1',
      );
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockCollectionDetails,
      });
    });

    it('should handle collection not found', async () => {
      mockRequest.params = { collectionKey: '/library/metadata/999' };
      vi.mocked(plexService.getCollectionDetails).mockRejectedValue(
        new AppError('Collection not found', 404),
      );

      await expect(
        plexController.getCollectionDetails(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(AppError);
    });
  });
});
