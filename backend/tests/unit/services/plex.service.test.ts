import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { PlexService } from '../../../src/services/plex.service';
import { redisClient } from '../../../src/config/redis';
import { PlexClient } from '../../../src/integrations/plex/plex.client';
import { userRepository, serviceConfigRepository } from '../../../src/repositories';
import { AppError } from '@medianest/shared';
import { logger } from '../../../src/utils/logger';
import { encryptionService } from '../../../src/services/encryption.service';

// Mock dependencies
vi.mock('../../../src/config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../../../src/integrations/plex/plex.client', () => ({
  PlexClient: vi.fn().mockImplementation(() => ({
    getServerInfo: vi.fn(),
    getLibraries: vi.fn(),
    getLibraryItems: vi.fn(),
    search: vi.fn(),
    getRecentlyAdded: vi.fn(),
    getCollections: vi.fn(),
    getCollectionDetails: vi.fn(),
  })),
}));

vi.mock('../../../src/repositories', () => ({
  userRepository: {
    findById: vi.fn(),
  },
  serviceConfigRepository: {
    findByServiceName: vi.fn(),
  },
}));

vi.mock('../../../src/services/encryption.service', () => ({
  encryptionService: {
    decryptFromStorage: vi.fn(),
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('PlexService', () => {
  let plexService: PlexService;
  let mockPlexClient: any;
  let mockUser: any;

  beforeEach(() => {
    vi.clearAllMocks();
    plexService = new PlexService();

    mockPlexClient = {
      getServerInfo: vi.fn(),
      getLibraries: vi.fn(),
      getLibraryItems: vi.fn(),
      search: vi.fn(),
      getRecentlyAdded: vi.fn(),
      getCollections: vi.fn(),
      getCollectionDetails: vi.fn(),
    };

    mockUser = {
      id: 'user-123',
      plexId: 'plex-123',
      plexToken: 'encrypted-token',
      plexUsername: 'testuser',
    };

    (PlexClient as Mock).mockImplementation(() => mockPlexClient);
    (userRepository.findById as Mock).mockResolvedValue(mockUser);
    (encryptionService.decryptFromStorage as Mock).mockReturnValue('decrypted-token');
  });

  describe('getClientForUser', () => {
    it('should create and cache Plex client for user', async () => {
      const result = await plexService.getClientForUser('user-123');

      expect(result.success).toBe(true);
      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      expect(encryptionService.decryptFromStorage).toHaveBeenCalledWith('encrypted-token');
      expect(PlexClient).toHaveBeenCalledWith('decrypted-token', expect.any(String));
    });

    it('should return cached client for subsequent calls', async () => {
      // First call
      const result1 = await plexService.getClientForUser('user-123');
      expect(result1.success).toBe(true);

      // Second call should use cached client
      const result2 = await plexService.getClientForUser('user-123');
      expect(result2.success).toBe(true);

      // Should only create client once
      expect(PlexClient).toHaveBeenCalledTimes(1);
      expect(userRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('should handle user not found', async () => {
      (userRepository.findById as Mock).mockResolvedValue(null);

      const result = await plexService.getClientForUser('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error.code).toBe('USER_NOT_FOUND');
    });

    it('should handle missing Plex token', async () => {
      (userRepository.findById as Mock).mockResolvedValue({
        ...mockUser,
        plexToken: null,
      });

      const result = await plexService.getClientForUser('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error.code).toBe('PLEX_TOKEN_MISSING');
    });

    it('should handle decryption errors', async () => {
      (encryptionService.decryptFromStorage as Mock).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await plexService.getClientForUser('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AppError);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      (userRepository.findById as Mock).mockRejectedValue(new Error('Database error'));

      const result = await plexService.getClientForUser('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AppError);
    });
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

      mockPlexClient.getServerInfo.mockResolvedValue(mockServerInfo);
      (redisClient.get as Mock).mockResolvedValue(null); // Cache miss

      const result = await plexService.getServerInfo('user-123');

      expect(result).toEqual(mockServerInfo);
      expect(mockPlexClient.getServerInfo).toHaveBeenCalled();
      expect(redisClient.setex).toHaveBeenCalledWith(
        'plex:server-info:user-123',
        3600, // 1 hour TTL
        JSON.stringify(mockServerInfo),
      );
    });

    it('should return cached server info', async () => {
      const mockServerInfo = {
        name: 'My Plex Server',
        version: '1.32.5.7516',
        platform: 'Linux',
      };

      (redisClient.get as Mock).mockResolvedValue(JSON.stringify(mockServerInfo));

      const result = await plexService.getServerInfo('user-123');

      expect(result).toEqual(mockServerInfo);
      expect(mockPlexClient.getServerInfo).not.toHaveBeenCalled();
      expect(redisClient.get).toHaveBeenCalledWith('plex:server-info:user-123');
    });

    it('should handle client creation failure', async () => {
      (userRepository.findById as Mock).mockResolvedValue(null);

      await expect(plexService.getServerInfo('user-123')).rejects.toThrow(AppError);
    });

    it('should handle Plex client errors', async () => {
      const plexError = new Error('Plex server unreachable');
      mockPlexClient.getServerInfo.mockRejectedValue(plexError);
      (redisClient.get as Mock).mockResolvedValue(null);

      await expect(plexService.getServerInfo('user-123')).rejects.toThrow(AppError);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle cache errors gracefully', async () => {
      const mockServerInfo = { name: 'Server' };
      mockPlexClient.getServerInfo.mockResolvedValue(mockServerInfo);
      (redisClient.get as Mock).mockRejectedValue(new Error('Redis error'));

      const result = await plexService.getServerInfo('user-123');

      expect(result).toEqual(mockServerInfo);
      expect(mockPlexClient.getServerInfo).toHaveBeenCalled();
    });
  });

  describe('getLibraries', () => {
    it('should get libraries successfully', async () => {
      const mockLibraries = [
        {
          key: '1',
          title: 'Movies',
          type: 'movie',
        },
        {
          key: '2',
          title: 'TV Shows',
          type: 'show',
        },
      ];

      mockPlexClient.getLibraries.mockResolvedValue(mockLibraries);
      (redisClient.get as Mock).mockResolvedValue(null);

      const result = await plexService.getLibraries('user-123');

      expect(result).toEqual(mockLibraries);
      expect(mockPlexClient.getLibraries).toHaveBeenCalled();
      expect(redisClient.setex).toHaveBeenCalledWith(
        'plex:libraries:user-123',
        3600,
        JSON.stringify(mockLibraries),
      );
    });

    it('should return cached libraries', async () => {
      const mockLibraries = [{ key: '1', title: 'Movies' }];
      (redisClient.get as Mock).mockResolvedValue(JSON.stringify(mockLibraries));

      const result = await plexService.getLibraries('user-123');

      expect(result).toEqual(mockLibraries);
      expect(mockPlexClient.getLibraries).not.toHaveBeenCalled();
    });

    it('should handle empty libraries', async () => {
      mockPlexClient.getLibraries.mockResolvedValue([]);
      (redisClient.get as Mock).mockResolvedValue(null);

      const result = await plexService.getLibraries('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('getLibraryItems', () => {
    it('should get library items successfully', async () => {
      const mockResult = {
        items: [
          { key: '1', title: 'Movie 1' },
          { key: '2', title: 'Movie 2' },
        ],
        totalSize: 100,
      };

      const options = { offset: 0, limit: 50 };
      mockPlexClient.getLibraryItems.mockResolvedValue(mockResult);
      (redisClient.get as Mock).mockResolvedValue(null);

      const result = await plexService.getLibraryItems('user-123', '1', options);

      expect(result).toEqual(mockResult);
      expect(mockPlexClient.getLibraryItems).toHaveBeenCalledWith('1', options);
    });

    it('should use cache for library items', async () => {
      const mockResult = { items: [], totalSize: 0 };
      const cacheKey = 'plex:library-items:user-123:1:0:50';

      (redisClient.get as Mock).mockResolvedValue(JSON.stringify(mockResult));

      const result = await plexService.getLibraryItems('user-123', '1', {
        offset: 0,
        limit: 50,
      });

      expect(result).toEqual(mockResult);
      expect(redisClient.get).toHaveBeenCalledWith(cacheKey);
      expect(mockPlexClient.getLibraryItems).not.toHaveBeenCalled();
    });

    it('should handle pagination options', async () => {
      const options = { offset: 100, limit: 25 };
      const mockResult = { items: [], totalSize: 1000 };

      mockPlexClient.getLibraryItems.mockResolvedValue(mockResult);
      (redisClient.get as Mock).mockResolvedValue(null);

      await plexService.getLibraryItems('user-123', '1', options);

      expect(mockPlexClient.getLibraryItems).toHaveBeenCalledWith('1', options);
      expect(redisClient.setex).toHaveBeenCalledWith(
        'plex:library-items:user-123:1:100:25',
        1800, // 30 minutes TTL
        JSON.stringify(mockResult),
      );
    });
  });

  describe('search', () => {
    it('should search successfully', async () => {
      const query = 'matrix';
      const mockResults = [
        { key: '1', title: 'The Matrix', type: 'movie' },
        { key: '2', title: 'The Matrix Reloaded', type: 'movie' },
      ];

      mockPlexClient.search.mockResolvedValue(mockResults);
      (redisClient.get as Mock).mockResolvedValue(null);

      const result = await plexService.search('user-123', query);

      expect(result).toEqual(mockResults);
      expect(mockPlexClient.search).toHaveBeenCalledWith(query);
      expect(redisClient.setex).toHaveBeenCalledWith(
        'plex:search:user-123:matrix',
        300, // 5 minutes TTL
        JSON.stringify(mockResults),
      );
    });

    it('should return cached search results', async () => {
      const query = 'cached-query';
      const mockResults = [{ key: '1', title: 'Cached Result' }];

      (redisClient.get as Mock).mockResolvedValue(JSON.stringify(mockResults));

      const result = await plexService.search('user-123', query);

      expect(result).toEqual(mockResults);
      expect(mockPlexClient.search).not.toHaveBeenCalled();
    });

    it('should handle empty search results', async () => {
      const query = 'nonexistent';
      mockPlexClient.search.mockResolvedValue([]);
      (redisClient.get as Mock).mockResolvedValue(null);

      const result = await plexService.search('user-123', query);

      expect(result).toEqual([]);
    });

    it('should handle search errors', async () => {
      const query = 'error-query';
      mockPlexClient.search.mockRejectedValue(new Error('Search failed'));
      (redisClient.get as Mock).mockResolvedValue(null);

      await expect(plexService.search('user-123', query)).rejects.toThrow(AppError);
    });
  });

  describe('getRecentlyAdded', () => {
    it('should get recently added items successfully', async () => {
      const mockItems = [
        { key: '1', title: 'New Movie', addedAt: 1234567890 },
        { key: '2', title: 'New Episode', addedAt: 1234567880 },
      ];

      mockPlexClient.getRecentlyAdded.mockResolvedValue(mockItems);
      (redisClient.get as Mock).mockResolvedValue(null);

      const result = await plexService.getRecentlyAdded('user-123');

      expect(result).toEqual(mockItems);
      expect(mockPlexClient.getRecentlyAdded).toHaveBeenCalled();
      expect(redisClient.setex).toHaveBeenCalledWith(
        'plex:recently-added:user-123',
        1800, // 30 minutes TTL
        JSON.stringify(mockItems),
      );
    });

    it('should return cached recently added items', async () => {
      const mockItems = [{ key: '1', title: 'Cached Item' }];
      (redisClient.get as Mock).mockResolvedValue(JSON.stringify(mockItems));

      const result = await plexService.getRecentlyAdded('user-123');

      expect(result).toEqual(mockItems);
      expect(mockPlexClient.getRecentlyAdded).not.toHaveBeenCalled();
    });
  });

  describe('getCollections', () => {
    it('should get collections successfully', async () => {
      const libraryKey = '1';
      const options = { search: 'marvel', sort: 'titleSort' };
      const mockCollections = [
        { key: '1', title: 'Marvel Movies', childCount: 25 },
        { key: '2', title: 'Marvel Shows', childCount: 10 },
      ];

      mockPlexClient.getCollections.mockResolvedValue(mockCollections);
      (redisClient.get as Mock).mockResolvedValue(null);

      const result = await plexService.getCollections('user-123', libraryKey, options);

      expect(result).toEqual(mockCollections);
      expect(mockPlexClient.getCollections).toHaveBeenCalledWith(libraryKey, options);
    });

    it('should use cache for collections', async () => {
      const libraryKey = '1';
      const options = { search: undefined, sort: undefined };
      const mockCollections = [{ key: '1', title: 'Collection' }];

      (redisClient.get as Mock).mockResolvedValue(JSON.stringify(mockCollections));

      const result = await plexService.getCollections('user-123', libraryKey, options);

      expect(result).toEqual(mockCollections);
      expect(mockPlexClient.getCollections).not.toHaveBeenCalled();
    });
  });

  describe('getCollectionDetails', () => {
    it('should get collection details successfully', async () => {
      const collectionKey = '1';
      const mockCollection = {
        key: '1',
        title: 'Marvel Movies',
        summary: 'Collection of Marvel superhero movies',
        children: [
          { key: '101', title: 'Iron Man' },
          { key: '102', title: 'Thor' },
        ],
      };

      mockPlexClient.getCollectionDetails.mockResolvedValue(mockCollection);
      (redisClient.get as Mock).mockResolvedValue(null);

      const result = await plexService.getCollectionDetails('user-123', collectionKey);

      expect(result).toEqual(mockCollection);
      expect(mockPlexClient.getCollectionDetails).toHaveBeenCalledWith(collectionKey);
      expect(redisClient.setex).toHaveBeenCalledWith(
        'plex:collection-details:user-123:1',
        3600,
        JSON.stringify(mockCollection),
      );
    });

    it('should return cached collection details', async () => {
      const collectionKey = '1';
      const mockCollection = { key: '1', title: 'Cached Collection' };

      (redisClient.get as Mock).mockResolvedValue(JSON.stringify(mockCollection));

      const result = await plexService.getCollectionDetails('user-123', collectionKey);

      expect(result).toEqual(mockCollection);
      expect(mockPlexClient.getCollectionDetails).not.toHaveBeenCalled();
    });

    it('should handle collection not found', async () => {
      const collectionKey = 'nonexistent';
      mockPlexClient.getCollectionDetails.mockResolvedValue(null);
      (redisClient.get as Mock).mockResolvedValue(null);

      const result = await plexService.getCollectionDetails('user-123', collectionKey);

      expect(result).toBeNull();
    });
  });

  describe('clearUserCache', () => {
    it('should clear all cache keys for user', async () => {
      await plexService.clearUserCache('user-123');

      const expectedKeys = [
        'plex:server-info:user-123',
        'plex:libraries:user-123',
        'plex:recently-added:user-123',
      ];

      // Should attempt to delete all user-specific cache keys
      expect(redisClient.del).toHaveBeenCalledWith(
        expect.arrayContaining(expectedKeys.map(expect.stringContaining)),
      );
    });

    it('should handle cache deletion errors gracefully', async () => {
      (redisClient.del as Mock).mockRejectedValue(new Error('Cache deletion failed'));

      // Should not throw
      await expect(plexService.clearUserCache('user-123')).resolves.toBeUndefined();
    });
  });
});
