import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppError } from '@medianest/shared';

// Setup mocks BEFORE imports to prevent hoisting issues
vi.mock('@/config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('@/integrations/plex/plex.client', () => ({
  PlexClient: vi.fn().mockImplementation(() => ({
    testConnection: vi.fn(),
    getLibraries: vi.fn(),
    getLibraryItems: vi.fn(),
    search: vi.fn(),
    getRecentlyAdded: vi.fn(),
    refreshLibrary: vi.fn(),
    scanDirectory: vi.fn(),
    getCollections: vi.fn(),
    getCollectionDetails: vi.fn(),
    createCollection: vi.fn(),
  })),
}));

vi.mock('@/repositories', () => ({
  userRepository: {
    findById: vi.fn(),
  },
  serviceConfigRepository: {
    findByName: vi.fn(),
  },
}));

vi.mock('@/services/encryption.service', () => ({
  encryptionService: {
    decrypt: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Now import the service and dependencies
import { PlexService } from '../../services/plex.service';
import { PlexClient } from '../../integrations/plex/plex.client';
import { redisClient } from '@/config/redis';
import { userRepository, serviceConfigRepository } from '@/repositories';
import { encryptionService } from '@/services/encryption.service';
import { logger } from '@/utils/logger';

describe('PlexService Integration Tests', () => {
  let plexService: PlexService;
  let mockPlexClientInstanceInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock client instance
    mockPlexClientInstanceInstance = {
      testConnection: vi.fn(),
      getLibraries: vi.fn(),
      getLibraryItems: vi.fn(),
      search: vi.fn(),
      getRecentlyAdded: vi.fn(),
      refreshLibrary: vi.fn(),
      scanDirectory: vi.fn(),
      getCollections: vi.fn(),
      getCollectionDetails: vi.fn(),
      createCollection: vi.fn(),
    };

    // Reset the PlexClient mock to return our instance
    vi.mocked(PlexClient).mockReturnValue(mockPlexClientInstanceInstance);

    plexService = new PlexService();

    // Default mocks
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: 'test-user-id',
      plexToken: 'encrypted-token',
    } as any);

    vi.mocked(serviceConfigRepository.findByName).mockResolvedValue({
      serviceUrl: 'http://localhost:32400',
    } as any);

    vi.mocked(encryptionService.decrypt).mockResolvedValue('decrypted-plex-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getClientForUser', () => {
    it('should create and cache new client for user', async () => {
      const mockServerInfo = {
        name: 'Test Plex Server',
        machineIdentifier: 'test-machine-id',
        version: '1.32.0',
        platform: 'Linux',
        updatedAt: 1641234567,
      };

      mockPlexClientInstanceInstance.testConnection.mockResolvedValue(mockServerInfo);

      const client = await plexService.getClientForUser('test-user-id');

      expect(client).toBeDefined();
      expect(userRepository.findById).toHaveBeenCalledWith('test-user-id');
      expect(serviceConfigRepository.findByName).toHaveBeenCalledWith('plex');
      expect(encryptionService.decrypt).toHaveBeenCalledWith('encrypted-token');
      expect(PlexClient).toHaveBeenCalledWith('http://localhost:32400', 'decrypted-plex-token');
      expect(mockPlexClientInstanceInstance.testConnection).toHaveBeenCalled();
    });

    it('should return cached client for subsequent calls', async () => {
      mockPlexClientInstance.testConnection.mockResolvedValue({});

      // First call
      const client1 = await plexService.getClientForUser('test-user-id');

      // Second call should return cached client
      const client2 = await plexService.getClientForUser('test-user-id');

      expect(client1).toBe(client2);
      expect(mockPlexClientInstance.testConnection).toHaveBeenCalledTimes(1);
    });

    it('should throw error if user not found', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      await expect(plexService.getClientForUser('nonexistent-user')).rejects.toThrow(
        new AppError('User not found or missing Plex token', 401),
      );
    });

    it('should throw error if user has no Plex token', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue({
        id: 'test-user-id',
        plexToken: null,
      } as any);

      await expect(plexService.getClientForUser('test-user-id')).rejects.toThrow(
        new AppError('User not found or missing Plex token', 401),
      );
    });

    it('should throw error if Plex server not configured', async () => {
      vi.mocked(serviceConfigRepository.findByName).mockResolvedValue(null);

      await expect(plexService.getClientForUser('test-user-id')).rejects.toThrow(
        new AppError('Plex server not configured', 500),
      );
    });

    it('should handle connection test failure', async () => {
      mockPlexClientInstance.testConnection.mockRejectedValue(new Error('Connection failed'));

      await expect(plexService.getClientForUser('test-user-id')).rejects.toThrow(
        new AppError('Failed to connect to Plex server', 503),
      );

      expect(logger.error).toHaveBeenCalledWith('Failed to connect to Plex', {
        userId: 'test-user-id',
        error: expect.any(Error),
      });
    });
  });

  describe('getServerInfo', () => {
    it('should get server info and cache it', async () => {
      const mockServerInfo = {
        name: 'Test Plex Server',
        machineIdentifier: 'test-machine-id',
        version: '1.32.0',
        platform: 'Linux',
        updatedAt: 1641234567,
      };

      vi.mocked(redisClient.get).mockResolvedValue(null);
      mockPlexClientInstance.testConnection.mockResolvedValue(mockServerInfo);

      const result = await plexService.getServerInfo('test-user-id');

      expect(result).toEqual(mockServerInfo);
      expect(redisClient.setex).toHaveBeenCalledWith(
        'plex:server:test-user-id',
        3600,
        JSON.stringify(mockServerInfo),
      );
    });

    it('should return cached server info', async () => {
      const cachedServerInfo = { name: 'Cached Server' };
      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(cachedServerInfo));

      const result = await plexService.getServerInfo('test-user-id');

      expect(result).toEqual(cachedServerInfo);
      expect(mockPlexClientInstance.testConnection).not.toHaveBeenCalled();
    });
  });

  describe('getLibraries', () => {
    it('should get libraries and cache them', async () => {
      const mockLibraries = [
        { key: '1', type: 'movie', title: 'Movies', uuid: 'uuid-1', updatedAt: 1641234567 },
        { key: '2', type: 'show', title: 'TV Shows', uuid: 'uuid-2', updatedAt: 1641234567 },
      ];

      vi.mocked(redisClient.get).mockResolvedValue(null);
      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.getLibraries.mockResolvedValue(mockLibraries);

      const result = await plexService.getLibraries('test-user-id');

      expect(result).toEqual(mockLibraries);
      expect(redisClient.setex).toHaveBeenCalledWith(
        'plex:libraries:test-user-id',
        3600,
        JSON.stringify(mockLibraries),
      );
    });

    it('should return cached libraries', async () => {
      const cachedLibraries = [{ title: 'Cached Library' }];
      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(cachedLibraries));

      const result = await plexService.getLibraries('test-user-id');

      expect(result).toEqual(cachedLibraries);
      expect(mockPlexClientInstance.getLibraries).not.toHaveBeenCalled();
    });
  });

  describe('getLibraryItems', () => {
    it('should get library items with pagination and cache them', async () => {
      const mockItems = {
        items: [
          {
            ratingKey: '1',
            key: '/library/metadata/1',
            guid: 'plex://movie/123',
            type: 'movie' as const,
            title: 'Test Movie',
            addedAt: 1641234567,
          },
        ],
        totalSize: 1,
      };

      vi.mocked(redisClient.get).mockResolvedValue(null);
      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.getLibraryItems.mockResolvedValue(mockItems);

      const result = await plexService.getLibraryItems('test-user-id', '1', {
        offset: 0,
        limit: 50,
      });

      expect(result).toEqual(mockItems);
      expect(mockPlexClientInstance.getLibraryItems).toHaveBeenCalledWith('1', {
        offset: 0,
        limit: 50,
      });
      expect(redisClient.setex).toHaveBeenCalledWith(
        'plex:items:test-user-id:1:0:50',
        1800,
        JSON.stringify(mockItems),
      );
    });

    it('should use default pagination options', async () => {
      vi.mocked(redisClient.get).mockResolvedValue(null);
      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.getLibraryItems.mockResolvedValue({ items: [], totalSize: 0 });

      await plexService.getLibraryItems('test-user-id', '1');

      expect(mockPlexClientInstance.getLibraryItems).toHaveBeenCalledWith('1', {
        offset: 0,
        limit: 50,
      });
    });

    it('should return cached library items', async () => {
      const cachedItems = { items: [{ title: 'Cached Movie' }], totalSize: 1 };
      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(cachedItems));

      const result = await plexService.getLibraryItems('test-user-id', '1');

      expect(result).toEqual(cachedItems);
      expect(mockPlexClientInstance.getLibraryItems).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should search and cache results', async () => {
      const mockResults = [
        {
          ratingKey: '1',
          key: '/library/metadata/1',
          guid: 'plex://movie/123',
          type: 'movie' as const,
          title: 'Search Result',
          addedAt: 1641234567,
        },
      ];

      vi.mocked(redisClient.get).mockResolvedValue(null);
      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.search.mockResolvedValue(mockResults);

      const result = await plexService.search('test-user-id', 'test query');

      expect(result).toEqual(mockResults);
      expect(mockPlexClientInstance.search).toHaveBeenCalledWith('test query');
      expect(redisClient.setex).toHaveBeenCalledWith(
        'plex:search:test-user-id:test query',
        300,
        JSON.stringify(mockResults),
      );
    });

    it('should return cached search results', async () => {
      const cachedResults = [{ title: 'Cached Search Result' }];
      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(cachedResults));

      const result = await plexService.search('test-user-id', 'cached query');

      expect(result).toEqual(cachedResults);
      expect(mockPlexClientInstance.search).not.toHaveBeenCalled();
    });
  });

  describe('getRecentlyAdded', () => {
    it('should get recently added items and cache them', async () => {
      const mockRecentItems = [
        {
          ratingKey: '1',
          key: '/library/metadata/1',
          guid: 'plex://movie/123',
          type: 'movie' as const,
          title: 'New Movie',
          addedAt: 1641234567,
        },
      ];

      vi.mocked(redisClient.get).mockResolvedValue(null);
      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.getRecentlyAdded.mockResolvedValue(mockRecentItems);

      const result = await plexService.getRecentlyAdded('test-user-id');

      expect(result).toEqual(mockRecentItems);
      expect(mockPlexClientInstance.getRecentlyAdded).toHaveBeenCalled();
      expect(redisClient.setex).toHaveBeenCalledWith(
        'plex:recent:test-user-id',
        1800,
        JSON.stringify(mockRecentItems),
      );
    });

    it('should return cached recently added items', async () => {
      const cachedItems = [{ title: 'Cached Recent Movie' }];
      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(cachedItems));

      const result = await plexService.getRecentlyAdded('test-user-id');

      expect(result).toEqual(cachedItems);
      expect(mockPlexClientInstance.getRecentlyAdded).not.toHaveBeenCalled();
    });
  });

  describe('library management', () => {
    it('should refresh library and clear cache', async () => {
      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.refreshLibrary.mockResolvedValue();

      await plexService.refreshLibrary('test-user-id', '1');

      expect(mockPlexClientInstance.refreshLibrary).toHaveBeenCalledWith('1');
      expect(redisClient.del).toHaveBeenCalledWith('plex:libraries:test-user-id');
    });

    it('should scan directory and clear related caches', async () => {
      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.scanDirectory.mockResolvedValue();

      await plexService.scanDirectory('test-user-id', '1', '/path/to/scan');

      expect(mockPlexClientInstance.scanDirectory).toHaveBeenCalledWith('1', '/path/to/scan');
      expect(redisClient.del).toHaveBeenCalledWith([
        'plex:libraries:test-user-id',
        'plex:recent:test-user-id',
      ]);
    });
  });

  describe('collections', () => {
    it('should get collections and apply filters', async () => {
      const mockCollections = [
        { title: 'Action Movies', childCount: 25, addedAt: 1641234567 },
        { title: 'Comedy Shows', childCount: 15, addedAt: 1641234568 },
        { title: 'Drama Collection', childCount: 30, addedAt: 1641234569 },
      ];

      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.getCollections.mockResolvedValue(mockCollections);

      const result = await plexService.getCollections('test-user-id', '1', {
        search: 'action',
        sort: 'title',
      });

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Action Movies');
    });

    it('should sort collections by different criteria', async () => {
      const mockCollections = [
        { title: 'B Collection', childCount: 10, addedAt: 1641234569 },
        { title: 'A Collection', childCount: 20, addedAt: 1641234567 },
        { title: 'C Collection', childCount: 15, addedAt: 1641234568 },
      ];

      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.getCollections.mockResolvedValue(mockCollections);

      // Test title sort
      const titleSorted = await plexService.getCollections('test-user-id', '1', {
        sort: 'title',
      });
      expect(titleSorted[0].title).toBe('A Collection');

      // Reset mock
      mockPlexClientInstance.getCollections.mockResolvedValue(mockCollections);

      // Test childCount sort
      const childCountSorted = await plexService.getCollections('test-user-id', '1', {
        sort: 'childCount',
      });
      expect(childCountSorted[0].childCount).toBe(20);

      // Reset mock
      mockPlexClientInstance.getCollections.mockResolvedValue(mockCollections);

      // Test addedAt sort
      const addedAtSorted = await plexService.getCollections('test-user-id', '1', {
        sort: 'addedAt',
      });
      expect(addedAtSorted[0].addedAt).toBe(1641234569);
    });

    it('should get collection details with items', async () => {
      const mockCollectionDetails = {
        title: 'Test Collection',
        items: [{ title: 'Movie 1' }],
      };

      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.getCollectionDetails.mockResolvedValue(mockCollectionDetails);

      const result = await plexService.getCollectionDetails(
        'test-user-id',
        '/library/collections/1',
      );

      expect(result).toEqual(mockCollectionDetails);
      expect(mockPlexClientInstance.getCollectionDetails).toHaveBeenCalledWith(
        '/library/collections/1',
      );
    });

    it('should create collection', async () => {
      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.createCollection.mockResolvedValue();

      await plexService.createCollection('test-user-id', '1', 'New Collection', ['123', '456']);

      expect(mockPlexClientInstance.createCollection).toHaveBeenCalledWith('1', 'New Collection', [
        '123',
        '456',
      ]);
    });
  });

  describe('findYouTubeLibrary', () => {
    it('should find YouTube library by type', async () => {
      const mockLibraries = [
        { key: '1', type: 'movie', title: 'Movies' },
        { key: '2', type: 'youtube', title: 'YouTube Downloads' },
        { key: '3', type: 'show', title: 'TV Shows' },
      ];

      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.getLibraries.mockResolvedValue(mockLibraries);
      vi.mocked(redisClient.get).mockResolvedValue(null);

      const result = await plexService.findYouTubeLibrary('test-user-id');

      expect(result).toBe('2');
    });

    it('should find library by title containing youtube', async () => {
      const mockLibraries = [
        { key: '1', type: 'movie', title: 'Movies' },
        { key: '2', type: 'other', title: 'YouTube Collection' },
      ];

      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.getLibraries.mockResolvedValue(mockLibraries);
      vi.mocked(redisClient.get).mockResolvedValue(null);

      const result = await plexService.findYouTubeLibrary('test-user-id');

      expect(result).toBe('2');
    });

    it('should return null if no YouTube library found', async () => {
      const mockLibraries = [
        { key: '1', type: 'movie', title: 'Movies' },
        { key: '2', type: 'show', title: 'TV Shows' },
      ];

      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.getLibraries.mockResolvedValue(mockLibraries);
      vi.mocked(redisClient.get).mockResolvedValue(null);

      const result = await plexService.findYouTubeLibrary('test-user-id');

      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle Redis errors gracefully for caching operations', async () => {
      vi.mocked(redisClient.get).mockRejectedValue(new Error('Redis connection failed'));
      vi.mocked(redisClient.setex).mockRejectedValue(new Error('Redis write failed'));

      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.getLibraries.mockResolvedValue([]);

      // Should still work even if Redis fails
      const result = await plexService.getLibraries('test-user-id');

      expect(result).toEqual([]);
      expect(mockPlexClientInstance.getLibraries).toHaveBeenCalled();
    });

    it('should propagate Plex client connection errors', async () => {
      mockPlexClientInstance.testConnection.mockRejectedValue(new Error('Plex server unreachable'));

      await expect(plexService.getServerInfo('test-user-id')).rejects.toThrow();
    });

    it('should handle encryption service errors', async () => {
      vi.mocked(encryptionService.decrypt).mockRejectedValue(new Error('Decryption failed'));

      await expect(plexService.getClientForUser('test-user-id')).rejects.toThrow();
    });

    it('should handle database errors', async () => {
      vi.mocked(userRepository.findById).mockRejectedValue(new Error('Database connection failed'));

      await expect(plexService.getClientForUser('test-user-id')).rejects.toThrow();
    });
  });

  describe('client caching and cleanup', () => {
    it('should cache clients per user', async () => {
      mockPlexClientInstance.testConnection.mockResolvedValue({});

      const client1 = await plexService.getClientForUser('user1');
      const client2 = await plexService.getClientForUser('user2');
      const client1Again = await plexService.getClientForUser('user1');

      expect(client1).toBe(client1Again);
      expect(client1).not.toBe(client2);
    });

    it('should start cleanup timer', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      plexService.startCleanupTimer();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        30 * 60 * 1000, // 30 minutes
      );

      setIntervalSpy.mockRestore();
    });
  });

  describe('cache key generation', () => {
    it('should generate correct cache keys for different operations', async () => {
      vi.mocked(redisClient.get).mockResolvedValue(null);
      mockPlexClientInstance.testConnection.mockResolvedValue({});

      await plexService.getServerInfo('user123');
      expect(redisClient.get).toHaveBeenCalledWith('plex:server:user123');

      await plexService.getLibraries('user456');
      expect(redisClient.get).toHaveBeenCalledWith('plex:libraries:user456');

      await plexService.search('user789', 'test search');
      expect(redisClient.get).toHaveBeenCalledWith('plex:search:user789:test search');
    });

    it('should include pagination in library items cache key', async () => {
      vi.mocked(redisClient.get).mockResolvedValue(null);
      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.getLibraryItems.mockResolvedValue({ items: [], totalSize: 0 });

      await plexService.getLibraryItems('user123', 'lib456', { offset: 10, limit: 25 });

      expect(redisClient.get).toHaveBeenCalledWith('plex:items:user123:lib456:10:25');
    });
  });

  describe('service integration scenarios', () => {
    it('should handle mixed success and failure operations', async () => {
      // Setup mixed success/failure scenario
      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.getLibraries.mockResolvedValue([{ key: '1', title: 'Movies' }]);
      mockPlexClientInstance.getLibraryItems.mockRejectedValue(new Error('Library unavailable'));

      // Should succeed for libraries
      const libraries = await plexService.getLibraries('test-user');
      expect(libraries).toHaveLength(1);

      // Should fail for library items
      await expect(plexService.getLibraryItems('test-user', '1')).rejects.toThrow();
    });

    it('should handle concurrent requests to same resources', async () => {
      vi.mocked(redisClient.get).mockResolvedValue(null);
      mockPlexClientInstance.testConnection.mockResolvedValue({});
      mockPlexClientInstance.getLibraries.mockResolvedValue([]);

      // Make concurrent requests
      const promises = Array(5)
        .fill(null)
        .map(() => plexService.getLibraries('concurrent-user'));

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result).toEqual([]);
      });

      // Client should only be created once due to caching
      expect(PlexClient).toHaveBeenCalledTimes(1);
    });

    it('should handle service configuration changes', async () => {
      // Initial setup
      mockPlexClientInstance.testConnection.mockResolvedValue({});
      await plexService.getClientForUser('test-user');

      // Change service configuration
      vi.mocked(serviceConfigRepository.findByName).mockResolvedValue({
        serviceUrl: 'http://new-server:32400',
      } as any);

      // Should create new client with new URL
      const newClient = await plexService.getClientForUser('different-user');
      expect(PlexClient).toHaveBeenCalledWith('http://new-server:32400', 'decrypted-plex-token');
    });
  });
});
