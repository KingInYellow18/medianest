import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OverseerrService } from '../../../src/services/overseerr.service';
import { OverseerrClient } from '../../../src/integrations/overseerr/overseerr.client';
import { redisClient } from '../../../src/config/redis';
import { serviceConfigRepository, mediaRequestRepository } from '../../../src/repositories';
import { socketService } from '../../../src/services/socket.service';
import { encryptionService } from '../../../src/services/encryption.service';
import { AppError } from '@medianest/shared';

// Mock dependencies
vi.mock('../../../src/integrations/overseerr/overseerr.client');
vi.mock('../../../src/config/redis');
vi.mock('../../../src/repositories');
vi.mock('../../../src/services/socket.service');
vi.mock('../../../src/services/encryption.service');
vi.mock('../../../src/utils/logger');

describe('OverseerrService', () => {
  let overseerrService: OverseerrService;
  let mockOverseerrClient: any;
  let mockRedis: any;
  let mockServiceConfigRepo: any;
  let mockMediaRequestRepo: any;
  let mockSocketService: any;
  let mockEncryption: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup OverseerrClient mock
    mockOverseerrClient = {
      testConnection: vi.fn(),
      searchMedia: vi.fn(),
      getMediaDetails: vi.fn(),
      requestMedia: vi.fn(),
    };
    vi.mocked(OverseerrClient).mockImplementation(() => mockOverseerrClient);

    // Setup Redis mock
    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
    };
    vi.mocked(redisClient).get = mockRedis.get;
    vi.mocked(redisClient).setex = mockRedis.setex;

    // Setup repository mocks
    mockServiceConfigRepo = {
      findByName: vi.fn(),
    };
    mockMediaRequestRepo = {
      findByTmdbId: vi.fn(),
      create: vi.fn(),
      findByUser: vi.fn(),
      findByOverseerrId: vi.fn(),
      update: vi.fn(),
    };
    vi.mocked(serviceConfigRepository).findByName = mockServiceConfigRepo.findByName;
    vi.mocked(mediaRequestRepository).findByTmdbId = mockMediaRequestRepo.findByTmdbId;
    vi.mocked(mediaRequestRepository).create = mockMediaRequestRepo.create;
    vi.mocked(mediaRequestRepository).findByUser = mockMediaRequestRepo.findByUser;
    vi.mocked(mediaRequestRepository).findByOverseerrId = mockMediaRequestRepo.findByOverseerrId;
    vi.mocked(mediaRequestRepository).update = mockMediaRequestRepo.update;

    // Setup socket service mock
    mockSocketService = {
      emitToUser: vi.fn(),
      emitToRoom: vi.fn(),
    };
    vi.mocked(socketService).emitToUser = mockSocketService.emitToUser;
    vi.mocked(socketService).emitToRoom = mockSocketService.emitToRoom;

    // Setup encryption mock
    mockEncryption = {
      decrypt: vi.fn(),
    };
    vi.mocked(encryptionService).decrypt = mockEncryption.decrypt;

    overseerrService = new OverseerrService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      const config = {
        enabled: true,
        serviceUrl: 'http://overseerr.local:5055',
        apiKey: 'encrypted-api-key',
      };

      mockServiceConfigRepo.findByName.mockResolvedValue(config);
      mockEncryption.decrypt.mockResolvedValue('decrypted-api-key');
      mockOverseerrClient.testConnection.mockResolvedValue(true);

      await overseerrService.initialize();

      expect(mockServiceConfigRepo.findByName).toHaveBeenCalledWith('overseerr');
      expect(mockEncryption.decrypt).toHaveBeenCalledWith('encrypted-api-key');
      expect(OverseerrClient).toHaveBeenCalledWith({
        url: 'http://overseerr.local:5055',
        apiKey: 'decrypted-api-key',
      });
      expect(mockOverseerrClient.testConnection).toHaveBeenCalled();
    });

    it('should handle disabled service', async () => {
      const config = { enabled: false };
      mockServiceConfigRepo.findByName.mockResolvedValue(config);

      await overseerrService.initialize();

      expect(OverseerrClient).not.toHaveBeenCalled();
    });

    it('should handle missing config', async () => {
      mockServiceConfigRepo.findByName.mockResolvedValue(null);

      await overseerrService.initialize();

      expect(OverseerrClient).not.toHaveBeenCalled();
    });

    it('should handle initialization error', async () => {
      const config = {
        enabled: true,
        serviceUrl: 'http://overseerr.local:5055',
        apiKey: 'encrypted-api-key',
      };

      mockServiceConfigRepo.findByName.mockResolvedValue(config);
      mockEncryption.decrypt.mockResolvedValue('decrypted-api-key');
      mockOverseerrClient.testConnection.mockRejectedValue(new Error('Connection failed'));

      await overseerrService.initialize();

      expect(overseerrService.isServiceAvailable()).toBe(false);
    });

    it('should handle config without API key', async () => {
      const config = {
        enabled: true,
        serviceUrl: 'http://overseerr.local:5055',
        apiKey: null,
      };

      mockServiceConfigRepo.findByName.mockResolvedValue(config);
      mockOverseerrClient.testConnection.mockResolvedValue(true);

      await overseerrService.initialize();

      expect(OverseerrClient).toHaveBeenCalledWith({
        url: 'http://overseerr.local:5055',
        apiKey: '',
      });
    });
  });

  describe('searchMedia', () => {
    beforeEach(() => {
      // Setup service as available
      (overseerrService as any).isAvailable = true;
      (overseerrService as any).client = mockOverseerrClient;
    });

    it('should return cached search results if available', async () => {
      const query = 'avengers';
      const cachedResults = { results: [{ title: 'Avengers' }] };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResults));

      const result = await overseerrService.searchMedia(query);

      expect(mockRedis.get).toHaveBeenCalledWith('overseerr:search:avengers:1');
      expect(result).toEqual(cachedResults);
      expect(mockOverseerrClient.searchMedia).not.toHaveBeenCalled();
    });

    it('should search media and cache results', async () => {
      const query = 'avengers';
      const page = 1;
      const searchResults = { results: [{ title: 'Avengers' }] };

      mockRedis.get.mockResolvedValue(null);
      mockOverseerrClient.searchMedia.mockResolvedValue(searchResults);

      const result = await overseerrService.searchMedia(query, page);

      expect(mockOverseerrClient.searchMedia).toHaveBeenCalledWith(query, page);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'overseerr:search:avengers:1',
        60,
        JSON.stringify(searchResults),
      );
      expect(result).toEqual(searchResults);
    });

    it('should handle search error', async () => {
      const query = 'avengers';
      mockRedis.get.mockResolvedValue(null);
      mockOverseerrClient.searchMedia.mockRejectedValue(new Error('Search failed'));

      await expect(overseerrService.searchMedia(query)).rejects.toThrow(
        new AppError('Failed to search media', 503),
      );
    });

    it('should throw error if service unavailable', async () => {
      (overseerrService as any).isAvailable = false;

      await expect(overseerrService.searchMedia('query')).rejects.toThrow(
        new AppError('Overseerr service unavailable', 503),
      );
    });
  });

  describe('getMediaDetails', () => {
    beforeEach(() => {
      (overseerrService as any).isAvailable = true;
      (overseerrService as any).client = mockOverseerrClient;
    });

    it('should return cached media details if available', async () => {
      const mediaType = 'movie';
      const tmdbId = 12345;
      const cachedDetails = { title: 'Avengers', tmdbId };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedDetails));

      const result = await overseerrService.getMediaDetails(mediaType, tmdbId);

      expect(mockRedis.get).toHaveBeenCalledWith('overseerr:details:movie:12345');
      expect(result).toEqual(cachedDetails);
    });

    it('should fetch media details and cache results', async () => {
      const mediaType = 'tv';
      const tmdbId = 12345;
      const mediaDetails = { title: 'Breaking Bad', tmdbId };

      mockRedis.get.mockResolvedValue(null);
      mockOverseerrClient.getMediaDetails.mockResolvedValue(mediaDetails);

      const result = await overseerrService.getMediaDetails(mediaType, tmdbId);

      expect(mockOverseerrClient.getMediaDetails).toHaveBeenCalledWith(mediaType, tmdbId);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'overseerr:details:tv:12345',
        300,
        JSON.stringify(mediaDetails),
      );
      expect(result).toEqual(mediaDetails);
    });

    it('should handle media details error', async () => {
      const mediaType = 'movie';
      const tmdbId = 12345;
      mockRedis.get.mockResolvedValue(null);
      mockOverseerrClient.getMediaDetails.mockRejectedValue(new Error('Details failed'));

      await expect(overseerrService.getMediaDetails(mediaType, tmdbId)).rejects.toThrow(
        new AppError('Failed to get media details', 503),
      );
    });
  });

  describe('requestMedia', () => {
    beforeEach(() => {
      (overseerrService as any).isAvailable = true;
      (overseerrService as any).client = mockOverseerrClient;
    });

    it('should throw error if media already requested', async () => {
      const userId = 'user-123';
      const request = { mediaType: 'movie' as const, tmdbId: 12345 };
      const existingRequest = { id: 'req-1', status: 'pending' };

      mockMediaRequestRepo.findByTmdbId.mockResolvedValue(existingRequest);

      await expect(overseerrService.requestMedia(userId, request)).rejects.toThrow(
        new AppError('Media already requested', 409),
      );
    });

    it('should allow re-request if previous request failed', async () => {
      const userId = 'user-123';
      const request = { mediaType: 'movie' as const, tmdbId: 12345 };
      const existingRequest = { id: 'req-1', status: 'failed' };
      const mediaDetails = { title: 'Avengers', tmdbId: 12345 };
      const overseerrRequest = { id: 'overseerr-123' };
      const savedRequest = {
        id: 'req-2',
        userId,
        title: 'Avengers',
        status: 'pending',
        createdAt: new Date(),
      };

      mockMediaRequestRepo.findByTmdbId.mockResolvedValue(existingRequest);
      mockOverseerrClient.getMediaDetails.mockResolvedValue(mediaDetails);
      mockOverseerrClient.requestMedia.mockResolvedValue(overseerrRequest);
      mockMediaRequestRepo.create.mockResolvedValue(savedRequest);

      const result = await overseerrService.requestMedia(userId, request);

      expect(mockOverseerrClient.requestMedia).toHaveBeenCalledWith({
        mediaType: 'movie',
        mediaId: 12345,
        seasons: undefined,
      });
      expect(mockMediaRequestRepo.create).toHaveBeenCalledWith({
        userId,
        tmdbId: '12345',
        mediaType: 'movie',
        title: 'Avengers',
        status: 'pending',
        overseerrId: 'overseerr-123',
      });
      expect(mockSocketService.emitToUser).toHaveBeenCalledWith(
        userId,
        'request:created',
        savedRequest,
      );
      expect(result).toEqual(savedRequest);
    });

    it('should handle TV show request with seasons', async () => {
      const userId = 'user-123';
      const request = { mediaType: 'tv' as const, tmdbId: 12345, seasons: [1, 2] };
      const mediaDetails = { title: 'Breaking Bad', tmdbId: 12345 };
      const overseerrRequest = { id: 'overseerr-123' };
      const savedRequest = {
        id: 'req-1',
        userId,
        title: 'Breaking Bad',
        status: 'pending',
        createdAt: new Date(),
      };

      mockMediaRequestRepo.findByTmdbId.mockResolvedValue(null);
      mockOverseerrClient.getMediaDetails.mockResolvedValue(mediaDetails);
      mockOverseerrClient.requestMedia.mockResolvedValue(overseerrRequest);
      mockMediaRequestRepo.create.mockResolvedValue(savedRequest);

      const result = await overseerrService.requestMedia(userId, request);

      expect(mockOverseerrClient.requestMedia).toHaveBeenCalledWith({
        mediaType: 'tv',
        mediaId: 12345,
        seasons: [1, 2],
      });
      expect(result).toEqual(savedRequest);
    });

    it('should handle request error', async () => {
      const userId = 'user-123';
      const request = { mediaType: 'movie' as const, tmdbId: 12345 };

      mockMediaRequestRepo.findByTmdbId.mockResolvedValue(null);
      mockOverseerrClient.getMediaDetails.mockRejectedValue(new Error('Failed to get details'));

      await expect(overseerrService.requestMedia(userId, request)).rejects.toThrow(
        new AppError('Failed to submit media request', 500),
      );
    });

    it('should re-throw AppError instances', async () => {
      const userId = 'user-123';
      const request = { mediaType: 'movie' as const, tmdbId: 12345 };
      const existingRequest = { id: 'req-1', status: 'approved' };

      mockMediaRequestRepo.findByTmdbId.mockResolvedValue(existingRequest);

      await expect(overseerrService.requestMedia(userId, request)).rejects.toThrow(
        new AppError('Media already requested', 409),
      );
    });
  });

  describe('getUserRequests', () => {
    it('should get user requests with default options', async () => {
      const userId = 'user-123';
      const requests = { items: [{ id: 'req-1' }], total: 1 };

      mockMediaRequestRepo.findByUser.mockResolvedValue(requests);

      const result = await overseerrService.getUserRequests(userId);

      expect(mockMediaRequestRepo.findByUser).toHaveBeenCalledWith(userId, {
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(requests);
    });

    it('should get user requests with custom options', async () => {
      const userId = 'user-123';
      const options = { skip: 10, take: 5 };
      const requests = { items: [{ id: 'req-1' }], total: 1 };

      mockMediaRequestRepo.findByUser.mockResolvedValue(requests);

      const result = await overseerrService.getUserRequests(userId, options);

      expect(mockMediaRequestRepo.findByUser).toHaveBeenCalledWith(userId, {
        skip: 10,
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(requests);
    });
  });

  describe('handleWebhook', () => {
    it('should handle MEDIA_APPROVED webhook', async () => {
      const payload = {
        notification_type: 'MEDIA_APPROVED',
        request: { id: 'overseerr-123' },
        media: { tmdbId: 12345, mediaType: 'movie' },
      };
      const request = {
        id: 'req-1',
        userId: 'user-123',
        title: 'Avengers',
      };

      mockMediaRequestRepo.findByOverseerrId.mockResolvedValue(request);

      await overseerrService.handleWebhook(payload);

      expect(mockMediaRequestRepo.findByOverseerrId).toHaveBeenCalledWith('overseerr-123');
      expect(mockMediaRequestRepo.update).toHaveBeenCalledWith('req-1', {
        status: 'approved',
        completedAt: undefined,
      });
      expect(mockSocketService.emitToUser).toHaveBeenCalledWith('user-123', 'request:update', {
        requestId: 'req-1',
        status: 'approved',
        title: 'Avengers',
      });
    });

    it('should handle MEDIA_AVAILABLE webhook', async () => {
      const payload = {
        notification_type: 'MEDIA_AVAILABLE',
        request: { id: 'overseerr-123' },
      };
      const request = {
        id: 'req-1',
        userId: 'user-123',
        title: 'Avengers',
      };

      mockMediaRequestRepo.findByOverseerrId.mockResolvedValue(request);

      await overseerrService.handleWebhook(payload);

      expect(mockMediaRequestRepo.update).toHaveBeenCalledWith('req-1', {
        status: 'available',
        completedAt: expect.any(Date),
      });
    });

    it('should handle webhook with TMDB ID fallback', async () => {
      const payload = {
        notification_type: 'MEDIA_DECLINED',
        media: { tmdbId: 12345, mediaType: 'movie' },
      };
      const request = {
        id: 'req-1',
        userId: 'user-123',
        title: 'Avengers',
      };

      mockMediaRequestRepo.findByOverseerrId.mockResolvedValue(null);
      mockMediaRequestRepo.findByTmdbId.mockResolvedValue(request);

      await overseerrService.handleWebhook(payload);

      expect(mockMediaRequestRepo.findByTmdbId).toHaveBeenCalledWith(12345, 'movie');
      expect(mockMediaRequestRepo.update).toHaveBeenCalledWith('req-1', {
        status: 'failed',
        completedAt: undefined,
      });
    });

    it('should handle unknown webhook type', async () => {
      const payload = {
        notification_type: 'UNKNOWN_TYPE',
      };

      await overseerrService.handleWebhook(payload);

      expect(mockMediaRequestRepo.findByOverseerrId).not.toHaveBeenCalled();
      expect(mockMediaRequestRepo.update).not.toHaveBeenCalled();
    });

    it('should handle webhook with no matching request', async () => {
      const payload = {
        notification_type: 'MEDIA_APPROVED',
        request: { id: 'overseerr-123' },
      };

      mockMediaRequestRepo.findByOverseerrId.mockResolvedValue(null);

      await overseerrService.handleWebhook(payload);

      expect(mockMediaRequestRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('isServiceAvailable', () => {
    it('should return availability status', () => {
      (overseerrService as any).isAvailable = true;
      expect(overseerrService.isServiceAvailable()).toBe(true);

      (overseerrService as any).isAvailable = false;
      expect(overseerrService.isServiceAvailable()).toBe(false);
    });
  });

  describe('ensureAvailable', () => {
    it('should throw error if service not available', () => {
      (overseerrService as any).isAvailable = false;
      (overseerrService as any).client = null;

      expect(() => (overseerrService as any).ensureAvailable()).toThrow(
        new AppError('Overseerr service unavailable', 503),
      );
    });

    it('should throw error if client not initialized', () => {
      (overseerrService as any).isAvailable = true;
      (overseerrService as any).client = null;

      expect(() => (overseerrService as any).ensureAvailable()).toThrow(
        new AppError('Overseerr service unavailable', 503),
      );
    });

    it('should not throw if service available and client initialized', () => {
      (overseerrService as any).isAvailable = true;
      (overseerrService as any).client = mockOverseerrClient;

      expect(() => (overseerrService as any).ensureAvailable()).not.toThrow();
    });
  });
});
