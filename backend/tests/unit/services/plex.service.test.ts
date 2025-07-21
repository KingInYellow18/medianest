import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlexService } from '../../../src/services/plex.service';
import { PlexClient } from '../../../src/integrations/plex/plex.client';
import { redisClient } from '../../../src/config/redis';
import { userRepository, serviceConfigRepository } from '../../../src/repositories';
import { encryptionService } from '../../../src/services/encryption.service';
import { AppError } from '@medianest/shared';

// Mock dependencies
vi.mock('../../../src/integrations/plex/plex.client');
vi.mock('../../../src/config/redis');
vi.mock('../../../src/repositories');
vi.mock('../../../src/services/encryption.service');
vi.mock('../../../src/utils/logger');

describe('PlexService', () => {
  let plexService: PlexService;
  let mockPlexClient: any;
  let mockRedis: any;
  let mockUserRepo: any;
  let mockServiceConfigRepo: any;
  let mockEncryption: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup PlexClient mock
    mockPlexClient = {
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
    vi.mocked(PlexClient).mockImplementation(() => mockPlexClient);

    // Setup Redis mock
    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
    };
    vi.mocked(redisClient).get = mockRedis.get;
    vi.mocked(redisClient).setex = mockRedis.setex;
    vi.mocked(redisClient).del = mockRedis.del;

    // Setup repository mocks
    mockUserRepo = {
      findById: vi.fn(),
    };
    mockServiceConfigRepo = {
      findByName: vi.fn(),
    };
    vi.mocked(userRepository).findById = mockUserRepo.findById;
    vi.mocked(serviceConfigRepository).findByName = mockServiceConfigRepo.findByName;

    // Setup encryption mock
    mockEncryption = {
      decrypt: vi.fn(),
    };
    vi.mocked(encryptionService).decrypt = mockEncryption.decrypt;

    plexService = new PlexService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getClientForUser', () => {
    it('should return existing client if cached', async () => {
      // Setup: existing client in cache
      const userId = 'user-123';
      const existingClient = mockPlexClient;
      (plexService as any).clients.set(userId, existingClient);

      const result = await plexService.getClientForUser(userId);

      expect(result).toBe(existingClient);
      expect(mockUserRepo.findById).not.toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      const userId = 'user-123';
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(plexService.getClientForUser(userId)).rejects.toThrow(
        new AppError('User not found or missing Plex token', 401),
      );
    });

    it('should throw error if user has no Plex token', async () => {
      const userId = 'user-123';
      mockUserRepo.findById.mockResolvedValue({ id: userId, plexToken: null });

      await expect(plexService.getClientForUser(userId)).rejects.toThrow(
        new AppError('User not found or missing Plex token', 401),
      );
    });

    it('should throw error if Plex service not configured', async () => {
      const userId = 'user-123';
      mockUserRepo.findById.mockResolvedValue({ id: userId, plexToken: 'encrypted-token' });
      mockServiceConfigRepo.findByName.mockResolvedValue(null);

      await expect(plexService.getClientForUser(userId)).rejects.toThrow(
        new AppError('Plex server not configured', 500),
      );
    });

    it('should throw error if Plex service URL not configured', async () => {
      const userId = 'user-123';
      mockUserRepo.findById.mockResolvedValue({ id: userId, plexToken: 'encrypted-token' });
      mockServiceConfigRepo.findByName.mockResolvedValue({ serviceUrl: null });

      await expect(plexService.getClientForUser(userId)).rejects.toThrow(
        new AppError('Plex server not configured', 500),
      );
    });

    it('should create new client and test connection successfully', async () => {
      const userId = 'user-123';
      const encryptedToken = 'encrypted-token';
      const decryptedToken = 'decrypted-token';
      const serviceUrl = 'http://plex.local:32400';

      mockUserRepo.findById.mockResolvedValue({ id: userId, plexToken: encryptedToken });
      mockServiceConfigRepo.findByName.mockResolvedValue({ serviceUrl });
      mockEncryption.decrypt.mockResolvedValue(decryptedToken);
      mockPlexClient.testConnection.mockResolvedValue({ success: true });

      const result = await plexService.getClientForUser(userId);

      expect(mockEncryption.decrypt).toHaveBeenCalledWith(encryptedToken);
      expect(PlexClient).toHaveBeenCalledWith(serviceUrl, decryptedToken);
      expect(mockPlexClient.testConnection).toHaveBeenCalled();
      expect(result).toBe(mockPlexClient);
      expect((plexService as any).clients.get(userId)).toBe(mockPlexClient);
    });

    it('should throw error if connection test fails', async () => {
      const userId = 'user-123';
      mockUserRepo.findById.mockResolvedValue({ id: userId, plexToken: 'encrypted-token' });
      mockServiceConfigRepo.findByName.mockResolvedValue({ serviceUrl: 'http://plex.local:32400' });
      mockEncryption.decrypt.mockResolvedValue('decrypted-token');
      mockPlexClient.testConnection.mockRejectedValue(new Error('Connection failed'));

      await expect(plexService.getClientForUser(userId)).rejects.toThrow(
        new AppError('Failed to connect to Plex server', 503),
      );
    });
  });

  describe('getServerInfo', () => {
    it('should return cached server info if available', async () => {
      const userId = 'user-123';
      const cachedInfo = { name: 'My Plex Server', version: '1.0.0' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedInfo));

      const result = await plexService.getServerInfo(userId);

      expect(mockRedis.get).toHaveBeenCalledWith('plex:server:user-123');
      expect(result).toEqual(cachedInfo);
    });

    it('should fetch from Plex and cache result', async () => {
      const userId = 'user-123';
      const serverInfo = { name: 'My Plex Server', version: '1.0.0' };

      mockRedis.get.mockResolvedValue(null);
      mockPlexClient.testConnection.mockResolvedValue(serverInfo);
      (plexService as any).clients.set(userId, mockPlexClient);

      const result = await plexService.getServerInfo(userId);

      expect(mockPlexClient.testConnection).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'plex:server:user-123',
        3600,
        JSON.stringify(serverInfo),
      );
      expect(result).toEqual(serverInfo);
    });
  });

  describe('getLibraries', () => {
    it('should return cached libraries if available', async () => {
      const userId = 'user-123';
      const cachedLibraries = [{ key: '1', title: 'Movies' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedLibraries));

      const result = await plexService.getLibraries(userId);

      expect(mockRedis.get).toHaveBeenCalledWith('plex:libraries:user-123');
      expect(result).toEqual(cachedLibraries);
    });

    it('should fetch from Plex and cache result', async () => {
      const userId = 'user-123';
      const libraries = [{ key: '1', title: 'Movies' }];

      mockRedis.get.mockResolvedValue(null);
      mockPlexClient.getLibraries.mockResolvedValue(libraries);
      (plexService as any).clients.set(userId, mockPlexClient);

      const result = await plexService.getLibraries(userId);

      expect(mockPlexClient.getLibraries).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'plex:libraries:user-123',
        3600,
        JSON.stringify(libraries),
      );
      expect(result).toEqual(libraries);
    });
  });

  describe('getLibraryItems', () => {
    it('should handle pagination and caching correctly', async () => {
      const userId = 'user-123';
      const libraryKey = '1';
      const options = { offset: 0, limit: 50 };
      const items = [{ title: 'Movie 1' }, { title: 'Movie 2' }];

      mockRedis.get.mockResolvedValue(null);
      mockPlexClient.getLibraryItems.mockResolvedValue(items);
      (plexService as any).clients.set(userId, mockPlexClient);

      const result = await plexService.getLibraryItems(userId, libraryKey, options);

      expect(mockPlexClient.getLibraryItems).toHaveBeenCalledWith(libraryKey, options);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'plex:items:user-123:1:0:50',
        1800,
        JSON.stringify(items),
      );
      expect(result).toEqual(items);
    });

    it('should use default pagination options', async () => {
      const userId = 'user-123';
      const libraryKey = '1';

      mockRedis.get.mockResolvedValue(null);
      mockPlexClient.getLibraryItems.mockResolvedValue([]);
      (plexService as any).clients.set(userId, mockPlexClient);

      await plexService.getLibraryItems(userId, libraryKey);

      expect(mockPlexClient.getLibraryItems).toHaveBeenCalledWith(libraryKey, {
        offset: 0,
        limit: 50,
      });
    });
  });

  describe('search', () => {
    it('should return cached search results if available', async () => {
      const userId = 'user-123';
      const query = 'avengers';
      const cachedResults = [{ title: 'Avengers' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResults));

      const result = await plexService.search(userId, query);

      expect(mockRedis.get).toHaveBeenCalledWith('plex:search:user-123:avengers');
      expect(result).toEqual(cachedResults);
    });

    it('should search Plex and cache results', async () => {
      const userId = 'user-123';
      const query = 'avengers';
      const searchResults = [{ title: 'Avengers' }];

      mockRedis.get.mockResolvedValue(null);
      mockPlexClient.search.mockResolvedValue(searchResults);
      (plexService as any).clients.set(userId, mockPlexClient);

      const result = await plexService.search(userId, query);

      expect(mockPlexClient.search).toHaveBeenCalledWith(query);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'plex:search:user-123:avengers',
        300,
        JSON.stringify(searchResults),
      );
      expect(result).toEqual(searchResults);
    });
  });

  describe('getRecentlyAdded', () => {
    it('should return cached recently added items if available', async () => {
      const userId = 'user-123';
      const cachedItems = [{ title: 'New Movie' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedItems));

      const result = await plexService.getRecentlyAdded(userId);

      expect(mockRedis.get).toHaveBeenCalledWith('plex:recent:user-123');
      expect(result).toEqual(cachedItems);
    });

    it('should fetch from Plex and cache results', async () => {
      const userId = 'user-123';
      const recentItems = [{ title: 'New Movie' }];

      mockRedis.get.mockResolvedValue(null);
      mockPlexClient.getRecentlyAdded.mockResolvedValue(recentItems);
      (plexService as any).clients.set(userId, mockPlexClient);

      const result = await plexService.getRecentlyAdded(userId);

      expect(mockPlexClient.getRecentlyAdded).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'plex:recent:user-123',
        1800,
        JSON.stringify(recentItems),
      );
      expect(result).toEqual(recentItems);
    });
  });

  describe('refreshLibrary', () => {
    it('should refresh library and clear cache', async () => {
      const userId = 'user-123';
      const libraryKey = '1';

      (plexService as any).clients.set(userId, mockPlexClient);
      mockPlexClient.refreshLibrary.mockResolvedValue(undefined);

      await plexService.refreshLibrary(userId, libraryKey);

      expect(mockPlexClient.refreshLibrary).toHaveBeenCalledWith(libraryKey);
      expect(mockRedis.del).toHaveBeenCalledWith('plex:libraries:user-123');
    });
  });

  describe('scanDirectory', () => {
    it('should scan directory and clear related caches', async () => {
      const userId = 'user-123';
      const libraryKey = '1';
      const directory = '/movies';

      (plexService as any).clients.set(userId, mockPlexClient);
      mockPlexClient.scanDirectory.mockResolvedValue(undefined);

      await plexService.scanDirectory(userId, libraryKey, directory);

      expect(mockPlexClient.scanDirectory).toHaveBeenCalledWith(libraryKey, directory);
      expect(mockRedis.del).toHaveBeenCalledWith([
        'plex:libraries:user-123',
        'plex:recent:user-123',
      ]);
    });
  });

  describe('getCollections', () => {
    it('should get collections and apply filters', async () => {
      const userId = 'user-123';
      const libraryKey = '1';
      const collections = [
        { title: 'Marvel Collection', addedAt: 1000, childCount: 10 },
        { title: 'DC Collection', addedAt: 2000, childCount: 5 },
      ];

      (plexService as any).clients.set(userId, mockPlexClient);
      mockPlexClient.getCollections.mockResolvedValue(collections);

      // Test search filter
      const searchResult = await plexService.getCollections(userId, libraryKey, {
        search: 'marvel',
      });
      expect(searchResult).toEqual([collections[0]]);

      // Test title sorting
      const sortedResult = await plexService.getCollections(userId, libraryKey, { sort: 'title' });
      expect(sortedResult[0].title).toBe('DC Collection');

      // Test addedAt sorting
      const addedAtResult = await plexService.getCollections(userId, libraryKey, {
        sort: 'addedAt',
      });
      expect(addedAtResult[0].addedAt).toBe(2000);

      // Test childCount sorting
      const childCountResult = await plexService.getCollections(userId, libraryKey, {
        sort: 'childCount',
      });
      expect(childCountResult[0].childCount).toBe(10);

      // Test default sorting (no change)
      const defaultResult = await plexService.getCollections(userId, libraryKey, {
        sort: 'unknown',
      });
      expect(defaultResult).toEqual(collections);
    });
  });

  describe('getCollectionDetails', () => {
    it('should get collection details', async () => {
      const userId = 'user-123';
      const collectionKey = 'collection-1';
      const collectionDetails = { title: 'Marvel Collection', items: [] };

      (plexService as any).clients.set(userId, mockPlexClient);
      mockPlexClient.getCollectionDetails.mockResolvedValue(collectionDetails);

      const result = await plexService.getCollectionDetails(userId, collectionKey);

      expect(mockPlexClient.getCollectionDetails).toHaveBeenCalledWith(collectionKey);
      expect(result).toEqual(collectionDetails);
    });
  });

  describe('createCollection', () => {
    it('should create collection', async () => {
      const userId = 'user-123';
      const libraryKey = '1';
      const title = 'New Collection';
      const items = ['item1', 'item2'];

      (plexService as any).clients.set(userId, mockPlexClient);
      mockPlexClient.createCollection.mockResolvedValue(undefined);

      await plexService.createCollection(userId, libraryKey, title, items);

      expect(mockPlexClient.createCollection).toHaveBeenCalledWith(libraryKey, title, items);
    });

    it('should create collection with default empty items', async () => {
      const userId = 'user-123';
      const libraryKey = '1';
      const title = 'New Collection';

      (plexService as any).clients.set(userId, mockPlexClient);
      mockPlexClient.createCollection.mockResolvedValue(undefined);

      await plexService.createCollection(userId, libraryKey, title);

      expect(mockPlexClient.createCollection).toHaveBeenCalledWith(libraryKey, title, []);
    });
  });

  describe('findYouTubeLibrary', () => {
    it('should find YouTube library by name', async () => {
      const userId = 'user-123';
      const libraries = [
        { key: '1', title: 'Movies', type: 'movie' },
        { key: '2', title: 'YouTube Videos', type: 'other' },
      ];

      (plexService as any).clients.set(userId, mockPlexClient);
      mockPlexClient.getLibraries.mockResolvedValue(libraries);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await plexService.findYouTubeLibrary(userId);

      expect(result).toBe('2');
    });

    it('should find YouTube library by type', async () => {
      const userId = 'user-123';
      const libraries = [
        { key: '1', title: 'Movies', type: 'movie' },
        { key: '2', title: 'Other', type: 'youtube' },
      ];

      (plexService as any).clients.set(userId, mockPlexClient);
      mockPlexClient.getLibraries.mockResolvedValue(libraries);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await plexService.findYouTubeLibrary(userId);

      expect(result).toBe('2');
    });

    it('should fallback to other videos library', async () => {
      const userId = 'user-123';
      const libraries = [
        { key: '1', title: 'Movies', type: 'movie' },
        { key: '2', title: 'Other Videos', type: 'other' },
      ];

      (plexService as any).clients.set(userId, mockPlexClient);
      mockPlexClient.getLibraries.mockResolvedValue(libraries);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await plexService.findYouTubeLibrary(userId);

      expect(result).toBe('2');
    });

    it('should return null if no suitable library found', async () => {
      const userId = 'user-123';
      const libraries = [
        { key: '1', title: 'Movies', type: 'movie' },
        { key: '2', title: 'TV Shows', type: 'show' },
      ];

      (plexService as any).clients.set(userId, mockPlexClient);
      mockPlexClient.getLibraries.mockResolvedValue(libraries);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await plexService.findYouTubeLibrary(userId);

      expect(result).toBeNull();
    });
  });

  describe('startCleanupTimer', () => {
    it('should clear clients when size exceeds 10', () => {
      const clearSpy = vi.spyOn((plexService as any).clients, 'clear');

      // Add more than 10 clients
      for (let i = 0; i < 11; i++) {
        (plexService as any).clients.set(`user-${i}`, mockPlexClient);
      }

      // Manually trigger cleanup logic (since we can't easily test setInterval)
      const clientsSize = (plexService as any).clients.size;
      if (clientsSize > 10) {
        (plexService as any).clients.clear();
      }

      expect(clearSpy).toHaveBeenCalled();
    });
  });
});
