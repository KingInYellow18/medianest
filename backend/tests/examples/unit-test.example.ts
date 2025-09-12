/**
 * Example: Unit Testing a Service
 *
 * This example demonstrates how to unit test a service with mocked dependencies.
 * Key concepts:
 * - Mocking repositories
 * - Testing business logic in isolation
 * - Verifying method calls
 * - Testing error scenarios
 */

import { BadRequestError, NotFoundError } from '@medianest/shared';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MediaRequestRepository } from '@/repositories/media-request.repository';

import { OverseerrClient } from '@/integrations/overseerr/client';
import { MediaRequestService } from '@/services/media-request.service';
// @ts-ignore

// Mock the dependencies
vi.mock('@/repositories/media-request.repository');
vi.mock('@/integrations/overseerr/client');

describe('MediaRequestService - Unit Test Example', () => {
  let service: MediaRequestService;
  let mockRepository: jest.Mocked<MediaRequestRepository>;
  let mockOverseerrClient: jest.Mocked<OverseerrClient>;

  beforeEach(() => {
    // Create fresh mocks for each test
    mockRepository = new MediaRequestRepository() as jest.Mocked<MediaRequestRepository>;
    mockOverseerrClient = new OverseerrClient({} as any) as jest.Mocked<OverseerrClient>;

    // Create service instance with mocked dependencies
    service = new MediaRequestService(mockRepository, mockOverseerrClient);

    // Clear all mocks between tests
    vi.clearAllMocks();
  });

  describe('createRequest', () => {
    it('should create a media request successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const requestData = {
        mediaType: 'movie' as const,
        tmdbId: 550,
        title: 'Fight Club',
      };

      const overseerrResponse = {
        id: 'overseerr-123',
        status: 'pending',
        media: {
          tmdbId: 550,
          title: 'Fight Club',
          mediaType: 'movie',
        },
      };

      const savedRequest = {
        id: 'request-123',
        userId,
        overseerrId: 'overseerr-123',
        ...requestData,
        status: 'pending',
        createdAt: new Date(),
      };

      // Mock the external API call
      mockOverseerrClient.createRequest.mockResolvedValue(overseerrResponse);

      // Mock the database save
      mockRepository.create.mockResolvedValue(savedRequest);

      // Act
      const result = await service.createRequest(userId, requestData);

      // Assert
      expect(result).toEqual(savedRequest);

      // Verify the Overseerr client was called correctly
      expect(mockOverseerrClient.createRequest).toHaveBeenCalledWith({
        mediaType: 'movie',
        mediaId: 550,
        userId,
      });

      // Verify the repository was called with correct data
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId,
        overseerrId: 'overseerr-123',
        mediaType: 'movie',
        tmdbId: 550,
        title: 'Fight Club',
        status: 'pending',
      });
    });

    it('should handle Overseerr API errors gracefully', async () => {
      // Arrange
      const userId = 'user-123';
      const requestData = {
        mediaType: 'movie' as const,
        tmdbId: 550,
        title: 'Fight Club',
      };

      // Mock Overseerr to throw an error
      mockOverseerrClient.createRequest.mockRejectedValue(new Error('Overseerr unavailable'));

      // Act & Assert
      await expect(service.createRequest(userId, requestData)).rejects.toThrow(BadRequestError);

      // Verify repository was not called when external API fails
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should validate request data before processing', async () => {
      // Arrange
      const userId = 'user-123';
      const invalidData = {
        mediaType: 'invalid' as any,
        tmdbId: -1,
        title: '',
      };

      // Act & Assert
      await expect(service.createRequest(userId, invalidData)).rejects.toThrow(BadRequestError);

      // Verify no external calls were made
      expect(mockOverseerrClient.createRequest).not.toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getRequestStatus', () => {
    it('should return request status with updated Overseerr data', async () => {
      // Arrange
      const requestId = 'request-123';
      const dbRequest = {
        id: requestId,
        userId: 'user-123',
        overseerrId: 'overseerr-123',
        status: 'pending',
        mediaType: 'movie',
        tmdbId: 550,
        title: 'Fight Club',
        createdAt: new Date(),
      };

      const overseerrStatus = {
        id: 'overseerr-123',
        status: 'approved',
        media: {
          downloadStatus: {
            downloaded: true,
            downloading: false,
          },
        },
      };

      mockRepository.findById.mockResolvedValue(dbRequest);
      mockOverseerrClient.getRequestStatus.mockResolvedValue(overseerrStatus);

      // Act
      const result = await service.getRequestStatus(requestId);

      // Assert
      expect(result).toEqual({
        ...dbRequest,
        status: 'approved',
        downloadStatus: {
          downloaded: true,
          downloading: false,
        },
      });

      // Verify status was updated in database
      expect(mockRepository.update).toHaveBeenCalledWith(requestId, {
        status: 'approved',
      });
    });

    it('should throw NotFoundError for non-existent request', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getRequestStatus('non-existent')).rejects.toThrow(NotFoundError);

      // Verify no external API call was made
      expect(mockOverseerrClient.getRequestStatus).not.toHaveBeenCalled();
    });
  });

  describe('getUserRequests', () => {
    it('should return paginated user requests', async () => {
      // Arrange
      const userId = 'user-123';
      const mockRequests = [
        { id: '1', title: 'Movie 1', status: 'pending' },
        { id: '2', title: 'Movie 2', status: 'approved' },
      ];

      mockRepository.findByUser.mockResolvedValue({
        items: mockRequests,
        total: 2,
        page: 1,
        pageSize: 10,
      });

      // Act
      const result = await service.getUserRequests(userId, { page: 1, limit: 10 });

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);

      expect(mockRepository.findByUser).toHaveBeenCalledWith(userId, {
        page: 1,
        limit: 10,
        orderBy: 'createdAt',
        order: 'desc',
      });
    });

    it('should apply filters correctly', async () => {
      // Arrange
      const userId = 'user-123';
      const filters = {
        status: 'pending' as const,
        mediaType: 'movie' as const,
      };

      mockRepository.findByUser.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });

      // Act
      await service.getUserRequests(userId, {
        page: 1,
        limit: 10,
        ...filters,
      });

      // Assert
      expect(mockRepository.findByUser).toHaveBeenCalledWith(userId, {
        page: 1,
        limit: 10,
        orderBy: 'createdAt',
        order: 'desc',
        status: 'pending',
        mediaType: 'movie',
      });
    });
  });
});

/**
 * Testing Best Practices Demonstrated:
 *
 * 1. **Isolation**: Service is tested without real dependencies
 * 2. **Mocking**: All external dependencies are mocked
 * 3. **Coverage**: Both success and error paths are tested
 * 4. **Assertions**: Verify both return values and method calls
 * 5. **Clarity**: Test names clearly describe what is being tested
 * 6. **Setup**: Fresh mocks for each test prevent interference
 * 7. **Edge Cases**: Invalid input and error scenarios covered
 */
