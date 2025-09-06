import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlexService } from '../../services/plex.service';
import { PlexClient } from '../../integrations/plex/plex.client';
import { AppError } from '@medianest/shared';

// Mock dependencies
const mockRedisClient = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
};

const mockPlexClient = {
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

const mockUserRepository = {
  findById: vi.fn(),
};

const mockServiceConfigRepository = {
  findByName: vi.fn(),
};

const mockEncryptionService = {
  decrypt: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

// Setup mocks
vi.mock('@/config/redis', () => ({
  redisClient: mockRedisClient,
}));

vi.mock('@/integrations/plex/plex.client', () => ({
  PlexClient: vi.fn(() => mockPlexClient),
}));

vi.mock('@/repositories', () => ({
  userRepository: mockUserRepository,
  serviceConfigRepository: mockServiceConfigRepository,
}));

vi.mock('@/services/encryption.service', () => ({
  encryptionService: mockEncryptionService,
}));

vi.mock('@/utils/logger', () => ({
  logger: mockLogger,
}));

describe('PlexService Integration Tests', () => {
  let plexService: PlexService;

  beforeEach(() => {
    vi.clearAllMocks();
    plexService = new PlexService();

    // Default mocks
    mockUserRepository.findById.mockResolvedValue({
      id: 'test-user-id',
      plexToken: 'encrypted-token',
    });

    mockServiceConfigRepository.findByName.mockResolvedValue({
      serviceUrl: 'http://localhost:32400',
    });

    mockEncryptionService.decrypt.mockResolvedValue('decrypted-plex-token');
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

      mockPlexClient.testConnection.mockResolvedValue(mockServerInfo);

      const client = await plexService.getClientForUser('test-user-id');

      expect(client).toBeDefined();
      expect(mockUserRepository.findById).toHaveBeenCalledWith('test-user-id');
      expect(mockServiceConfigRepository.findByName).toHaveBeenCalledWith('plex');
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-token');
      expect(PlexClient).toHaveBeenCalledWith('http://localhost:32400', 'decrypted-plex-token');
      expect(mockPlexClient.testConnection).toHaveBeenCalled();
    });

    it('should return cached client for subsequent calls', async () => {
      mockPlexClient.testConnection.mockResolvedValue({});

      // First call
      const client1 = await plexService.getClientForUser('test-user-id');

      // Second call should return cached client
      const client2 = await plexService.getClientForUser('test-user-id');

      expect(client1).toBe(client2);
      expect(mockPlexClient.testConnection).toHaveBeenCalledTimes(1);
    });

    it('should throw error if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(plexService.getClientForUser('nonexistent-user')).rejects.toThrow(
        new AppError('User not found or missing Plex token', 401),
      );
    });

    it('should throw error if user has no Plex token', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'test-user-id',
        plexToken: null,
      });

      await expect(plexService.getClientForUser('test-user-id')).rejects.toThrow(
        new AppError('User not found or missing Plex token', 401),
      );
    });

    it('should throw error if Plex server not configured', async () => {
      mockServiceConfigRepository.findByName.mockResolvedValue(null);

      await expect(plexService.getClientForUser('test-user-id')).rejects.toThrow(
        new AppError('Plex server not configured', 500),
      );
    });

    it('should handle connection test failure', async () => {
      mockPlexClient.testConnection.mockRejectedValue(new Error('Connection failed'));

      await expect(plexService.getClientForUser('test-user-id')).rejects.toThrow(
        new AppError('Failed to connect to Plex server', 503),
      );

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to connect to Plex', {
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

      mockRedisClient.get.mockResolvedValue(null);
      mockPlexClient.testConnection.mockResolvedValue(mockServerInfo);

      const result = await plexService.getServerInfo('test-user-id');

      expect(result).toEqual(mockServerInfo);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'plex:server:test-user-id',
        3600,
        JSON.stringify(mockServerInfo),
      );
    });

    it('should return cached server info', async () => {
      const cachedServerInfo = { name: 'Cached Server' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedServerInfo));

      const result = await plexService.getServerInfo('test-user-id');

      expect(result).toEqual(cachedServerInfo);
      expect(mockPlexClient.testConnection).not.toHaveBeenCalled();
    });
  });

  describe('getLibraries', () => {
    it('should get libraries and cache them', async () => {
      const mockLibraries = [
        { key: '1', type: 'movie', title: 'Movies', uuid: 'uuid-1', updatedAt: 1641234567 },
        { key: '2', type: 'show', title: 'TV Shows', uuid: 'uuid-2', updatedAt: 1641234567 },
      ];

      mockRedisClient.get.mockResolvedValue(null);
      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getLibraries.mockResolvedValue(mockLibraries);

      const result = await plexService.getLibraries('test-user-id');

      expect(result).toEqual(mockLibraries);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'plex:libraries:test-user-id',
        3600,
        JSON.stringify(mockLibraries),
      );
    });

    it('should return cached libraries', async () => {
      const cachedLibraries = [{ title: 'Cached Library' }];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedLibraries));

      const result = await plexService.getLibraries('test-user-id');

      expect(result).toEqual(cachedLibraries);
      expect(mockPlexClient.getLibraries).not.toHaveBeenCalled();
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

      mockRedisClient.get.mockResolvedValue(null);
      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getLibraryItems.mockResolvedValue(mockItems);

      const result = await plexService.getLibraryItems('test-user-id', '1', {
        offset: 0,
        limit: 50,
      });

      expect(result).toEqual(mockItems);
      expect(mockPlexClient.getLibraryItems).toHaveBeenCalledWith('1', { offset: 0, limit: 50 });
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'plex:items:test-user-id:1:0:50',
        1800,
        JSON.stringify(mockItems),
      );
    });

    it('should use default pagination options', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getLibraryItems.mockResolvedValue({ items: [], totalSize: 0 });

      await plexService.getLibraryItems('test-user-id', '1');

      expect(mockPlexClient.getLibraryItems).toHaveBeenCalledWith('1', { offset: 0, limit: 50 });
    });

    it('should return cached library items', async () => {
      const cachedItems = { items: [{ title: 'Cached Movie' }], totalSize: 1 };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedItems));

      const result = await plexService.getLibraryItems('test-user-id', '1');

      expect(result).toEqual(cachedItems);
      expect(mockPlexClient.getLibraryItems).not.toHaveBeenCalled();
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

      mockRedisClient.get.mockResolvedValue(null);
      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.search.mockResolvedValue(mockResults);

      const result = await plexService.search('test-user-id', 'test query');

      expect(result).toEqual(mockResults);
      expect(mockPlexClient.search).toHaveBeenCalledWith('test query');
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'plex:search:test-user-id:test query',
        300,
        JSON.stringify(mockResults),
      );
    });

    it('should return cached search results', async () => {
      const cachedResults = [{ title: 'Cached Search Result' }];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedResults));

      const result = await plexService.search('test-user-id', 'cached query');

      expect(result).toEqual(cachedResults);
      expect(mockPlexClient.search).not.toHaveBeenCalled();
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

      mockRedisClient.get.mockResolvedValue(null);
      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getRecentlyAdded.mockResolvedValue(mockRecentItems);

      const result = await plexService.getRecentlyAdded('test-user-id');

      expect(result).toEqual(mockRecentItems);
      expect(mockPlexClient.getRecentlyAdded).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'plex:recent:test-user-id',
        1800,
        JSON.stringify(mockRecentItems),
      );
    });

    it('should return cached recently added items', async () => {
      const cachedItems = [{ title: 'Cached Recent Movie' }];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedItems));

      const result = await plexService.getRecentlyAdded('test-user-id');

      expect(result).toEqual(cachedItems);
      expect(mockPlexClient.getRecentlyAdded).not.toHaveBeenCalled();
    });
  });

  describe('library management', () => {
    it('should refresh library and clear cache', async () => {
      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.refreshLibrary.mockResolvedValue();

      await plexService.refreshLibrary('test-user-id', '1');

      expect(mockPlexClient.refreshLibrary).toHaveBeenCalledWith('1');
      expect(mockRedisClient.del).toHaveBeenCalledWith('plex:libraries:test-user-id');
    });

    it('should scan directory and clear related caches', async () => {
      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.scanDirectory.mockResolvedValue();

      await plexService.scanDirectory('test-user-id', '1', '/path/to/scan');

      expect(mockPlexClient.scanDirectory).toHaveBeenCalledWith('1', '/path/to/scan');
      expect(mockRedisClient.del).toHaveBeenCalledWith([
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

      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getCollections.mockResolvedValue(mockCollections);

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

      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getCollections.mockResolvedValue(mockCollections);

      // Test title sort
      const titleSorted = await plexService.getCollections('test-user-id', '1', {
        sort: 'title',
      });
      expect(titleSorted[0].title).toBe('A Collection');

      // Reset mock
      mockPlexClient.getCollections.mockResolvedValue(mockCollections);

      // Test childCount sort
      const childCountSorted = await plexService.getCollections('test-user-id', '1', {
        sort: 'childCount',
      });
      expect(childCountSorted[0].childCount).toBe(20);

      // Reset mock
      mockPlexClient.getCollections.mockResolvedValue(mockCollections);

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

      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getCollectionDetails.mockResolvedValue(mockCollectionDetails);

      const result = await plexService.getCollectionDetails(
        'test-user-id',
        '/library/collections/1',
      );

      expect(result).toEqual(mockCollectionDetails);
      expect(mockPlexClient.getCollectionDetails).toHaveBeenCalledWith('/library/collections/1');
    });

    it('should create collection', async () => {
      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.createCollection.mockResolvedValue();

      await plexService.createCollection('test-user-id', '1', 'New Collection', ['123', '456']);

      expect(mockPlexClient.createCollection).toHaveBeenCalledWith('1', 'New Collection', [
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

      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getLibraries.mockResolvedValue(mockLibraries);
      mockRedisClient.get.mockResolvedValue(null);

      const result = await plexService.findYouTubeLibrary('test-user-id');

      expect(result).toBe('2');
    });

    it('should find library by title containing youtube', async () => {
      const mockLibraries = [
        { key: '1', type: 'movie', title: 'Movies' },
        { key: '2', type: 'other', title: 'YouTube Collection' },
      ];

      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getLibraries.mockResolvedValue(mockLibraries);
      mockRedisClient.get.mockResolvedValue(null);

      const result = await plexService.findYouTubeLibrary('test-user-id');

      expect(result).toBe('2');
    });

    it('should find fallback library by other or video type', async () => {
      const mockLibraries = [
        { key: '1', type: 'movie', title: 'Movies' },
        { key: '2', type: 'other', title: 'Other Videos' },
      ];

      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getLibraries.mockResolvedValue(mockLibraries);
      mockRedisClient.get.mockResolvedValue(null);

      const result = await plexService.findYouTubeLibrary('test-user-id');

      expect(result).toBe('2');
    });

    it('should return null if no YouTube library found', async () => {
      const mockLibraries = [
        { key: '1', type: 'movie', title: 'Movies' },
        { key: '2', type: 'show', title: 'TV Shows' },
      ];

      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getLibraries.mockResolvedValue(mockLibraries);
      mockRedisClient.get.mockResolvedValue(null);

      const result = await plexService.findYouTubeLibrary('test-user-id');

      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle Redis errors gracefully for caching operations', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));
      mockRedisClient.setex.mockRejectedValue(new Error('Redis write failed'));

      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getLibraries.mockResolvedValue([]);

      // Should still work even if Redis fails
      const result = await plexService.getLibraries('test-user-id');

      expect(result).toEqual([]);
      expect(mockPlexClient.getLibraries).toHaveBeenCalled();
    });

    it('should propagate Plex client connection errors', async () => {
      mockPlexClient.testConnection.mockRejectedValue(new Error('Plex server unreachable'));

      await expect(plexService.getServerInfo('test-user-id')).rejects.toThrow();
    });

    it('should handle encryption service errors', async () => {
      mockEncryptionService.decrypt.mockRejectedValue(new Error('Decryption failed'));

      await expect(plexService.getClientForUser('test-user-id')).rejects.toThrow();
    });

    it('should handle database errors', async () => {
      mockUserRepository.findById.mockRejectedValue(new Error('Database connection failed'));

      await expect(plexService.getClientForUser('test-user-id')).rejects.toThrow();
    });
  });

  describe('client caching and cleanup', () => {
    it('should cache clients per user', async () => {
      mockPlexClient.testConnection.mockResolvedValue({});

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

    it('should clear clients when limit exceeded', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      let cleanupFn: (() => void) | null = null;

      setIntervalSpy.mockImplementation((fn) => {
        cleanupFn = fn as () => void;
        return {} as any;
      });

      plexService.startCleanupTimer();

      // Simulate having many clients
      mockPlexClient.testConnection.mockResolvedValue({});
      for (let i = 0; i < 12; i++) {
        await plexService.getClientForUser(`user${i}`);
      }

      // Trigger cleanup
      if (cleanupFn) {
        cleanupFn();
        expect(mockLogger.info).toHaveBeenCalledWith('Clearing Plex client cache', {
          count: 12,
        });
      }

      setIntervalSpy.mockRestore();
    });
  });

  describe('cache key generation', () => {
    it('should generate correct cache keys for different operations', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getServerInfo = mockPlexClient.testConnection; // Alias for compatibility

      await plexService.getServerInfo('user123');
      expect(mockRedisClient.get).toHaveBeenCalledWith('plex:server:user123');

      await plexService.getLibraries('user456');
      expect(mockRedisClient.get).toHaveBeenCalledWith('plex:libraries:user456');

      await plexService.search('user789', 'test search');
      expect(mockRedisClient.get).toHaveBeenCalledWith('plex:search:user789:test search');
    });

    it('should include pagination in library items cache key', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getLibraryItems.mockResolvedValue({ items: [], totalSize: 0 });

      await plexService.getLibraryItems('user123', 'lib456', { offset: 10, limit: 25 });

      expect(mockRedisClient.get).toHaveBeenCalledWith('plex:items:user123:lib456:10:25');
    });
  });

  describe('service integration scenarios', () => {
    it('should handle mixed success and failure operations', async () => {
      // Setup mixed success/failure scenario
      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getLibraries.mockResolvedValue([{ key: '1', title: 'Movies' }]);
      mockPlexClient.getLibraryItems.mockRejectedValue(new Error('Library unavailable'));

      // Should succeed for libraries
      const libraries = await plexService.getLibraries('test-user');
      expect(libraries).toHaveLength(1);

      // Should fail for library items
      await expect(plexService.getLibraryItems('test-user', '1')).rejects.toThrow();
    });

    it('should handle concurrent requests to same resources', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPlexClient.testConnection.mockResolvedValue({});
      mockPlexClient.getLibraries.mockResolvedValue([]);

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
      mockPlexClient.testConnection.mockResolvedValue({});
      await plexService.getClientForUser('test-user');

      // Change service configuration
      mockServiceConfigRepository.findByName.mockResolvedValue({
        serviceUrl: 'http://new-server:32400',
      });

      // Should create new client with new URL
      const newClient = await plexService.getClientForUser('different-user');
      expect(PlexClient).toHaveBeenCalledWith('http://new-server:32400', 'decrypted-plex-token');
    });
  });
});
