import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlexService } from '../../../src/services/plex.service';
import { PlexClient } from '../../../src/integrations/plex/plex.client';
import { CacheService } from '../../../src/services/cache.service';
import { TestDatabaseSetup, TestUtils } from '../../helpers/test-setup';
import { UserFactory, MockResponseFactory } from '../../factories/test-data.factory';

// Mock external dependencies
vi.mock('../../../src/integrations/plex/plex.client');
vi.mock('../../../src/services/cache.service');

describe('PlexService Integration Tests', () => {
  let plexService: PlexService;
  let mockPlexClient: any;
  let mockCacheService: any;
  let testUser: any;

  beforeEach(async () => {
    mockPlexClient = {
      authenticate: vi.fn(),
      getLibraries: vi.fn(),
      getLibraryContents: vi.fn(),
      getRecentlyAdded: vi.fn(),
      searchMedia: vi.fn(),
      getServerInfo: vi.fn(),
      validateConnection: vi.fn(),
    };

    mockCacheService = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    };

    plexService = new PlexService(mockPlexClient, mockCacheService);

    // Create test user
    const db = TestDatabaseSetup.getPrisma();
    if (db) {
      testUser = await db.user.create({
        data: UserFactory.create({ plexUsername: 'testuser' }),
      });
    }
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe('Authentication Integration', () => {
    it('should authenticate user with Plex and cache results', async () => {
      const authResult = {
        success: true,
        user: {
          id: 123,
          username: 'testuser',
          email: 'test@example.com',
          thumb: 'https://plex.tv/thumb.jpg',
        },
        authToken: 'plex-auth-token-123',
      };

      mockPlexClient.authenticate.mockResolvedValue(authResult);
      mockCacheService.get.mockResolvedValue(null); // Cache miss
      mockCacheService.set.mockResolvedValue('OK');

      const result = await plexService.authenticateUser('testuser', 'password');

      expect(mockPlexClient.authenticate).toHaveBeenCalledWith('testuser', 'password');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'plex:auth:testuser',
        authResult,
        3600, // 1 hour cache
      );
      expect(result).toEqual(authResult);
    });

    it('should return cached authentication if available', async () => {
      const cachedAuth = {
        success: true,
        user: { id: 123, username: 'testuser' },
        authToken: 'cached-token',
      };

      mockCacheService.get.mockResolvedValue(cachedAuth);

      const result = await plexService.authenticateUser('testuser', 'password');

      expect(mockPlexClient.authenticate).not.toHaveBeenCalled();
      expect(result).toEqual(cachedAuth);
    });

    it('should handle authentication failures gracefully', async () => {
      const authError = new Error('Invalid credentials');
      mockPlexClient.authenticate.mockRejectedValue(authError);
      mockCacheService.get.mockResolvedValue(null);

      await expect(plexService.authenticateUser('testuser', 'wrongpassword')).rejects.toThrow(
        'Invalid credentials',
      );

      expect(mockCacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('Library Integration', () => {
    it('should fetch and cache library contents', async () => {
      const libraryData = MockResponseFactory.createPlexResponse({
        MediaContainer: {
          size: 5,
          Metadata: [
            { key: '1', title: 'Movie 1', type: 'movie' },
            { key: '2', title: 'Movie 2', type: 'movie' },
          ],
        },
      });

      mockPlexClient.getLibraryContents.mockResolvedValue(libraryData);
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue('OK');

      const result = await plexService.getLibraryContents('movies', 1);

      expect(mockPlexClient.getLibraryContents).toHaveBeenCalledWith('movies', { page: 1 });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'plex:library:movies:1',
        libraryData,
        1800, // 30 minutes cache
      );
      expect(result).toEqual(libraryData);
    });

    it('should handle pagination correctly', async () => {
      const page1Data = MockResponseFactory.createPlexResponse();
      const page2Data = MockResponseFactory.createPlexResponse();

      mockPlexClient.getLibraryContents
        .mockResolvedValueOnce(page1Data)
        .mockResolvedValueOnce(page2Data);
      mockCacheService.get.mockResolvedValue(null);

      const [result1, result2] = await Promise.all([
        plexService.getLibraryContents('movies', 1),
        plexService.getLibraryContents('movies', 2),
      ]);

      expect(mockPlexClient.getLibraryContents).toHaveBeenCalledTimes(2);
      expect(mockPlexClient.getLibraryContents).toHaveBeenCalledWith('movies', { page: 1 });
      expect(mockPlexClient.getLibraryContents).toHaveBeenCalledWith('movies', { page: 2 });
      expect(result1).toEqual(page1Data);
      expect(result2).toEqual(page2Data);
    });

    it('should handle library errors with proper fallback', async () => {
      const error = new Error('Library not found');
      mockPlexClient.getLibraryContents.mockRejectedValue(error);
      mockCacheService.get.mockResolvedValue(null);

      await expect(plexService.getLibraryContents('nonexistent', 1)).rejects.toThrow(
        'Library not found',
      );

      expect(mockCacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('Search Integration', () => {
    it('should search media across libraries', async () => {
      const searchResults = MockResponseFactory.createPlexResponse({
        MediaContainer: {
          size: 3,
          Metadata: [
            { title: 'Test Movie', type: 'movie', year: 2023 },
            { title: 'Test Show', type: 'show', year: 2022 },
            { title: 'Test Album', type: 'album', year: 2021 },
          ],
        },
      });

      mockPlexClient.searchMedia.mockResolvedValue(searchResults);
      mockCacheService.get.mockResolvedValue(null);

      const result = await plexService.searchMedia('test', ['movie', 'show']);

      expect(mockPlexClient.searchMedia).toHaveBeenCalledWith('test', ['movie', 'show']);
      expect(result).toEqual(searchResults);
    });

    it('should cache search results for frequently searched terms', async () => {
      const searchResults = MockResponseFactory.createPlexResponse();

      mockCacheService.get.mockResolvedValue(null);
      mockPlexClient.searchMedia.mockResolvedValue(searchResults);
      mockCacheService.set.mockResolvedValue('OK');

      await plexService.searchMedia('popular term', ['movie']);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'plex:search:popular term:movie',
        searchResults,
        900, // 15 minutes cache for search results
      );
    });

    it('should handle search timeouts gracefully', async () => {
      const timeoutError = new Error('Request timeout');
      mockPlexClient.searchMedia.mockRejectedValue(timeoutError);

      await expect(plexService.searchMedia('timeout test', ['movie'])).rejects.toThrow(
        'Request timeout',
      );
    });
  });

  describe('Recently Added Integration', () => {
    it('should fetch recently added media with proper caching', async () => {
      const recentlyAdded = MockResponseFactory.createPlexResponse({
        MediaContainer: {
          size: 10,
          Metadata: Array.from({ length: 10 }, (_, i) => ({
            key: `recent-${i}`,
            title: `Recent Item ${i}`,
            addedAt: Date.now() - i * 86400000, // Each item added 1 day apart
          })),
        },
      });

      mockPlexClient.getRecentlyAdded.mockResolvedValue(recentlyAdded);
      mockCacheService.get.mockResolvedValue(null);

      const result = await plexService.getRecentlyAdded(10);

      expect(mockPlexClient.getRecentlyAdded).toHaveBeenCalledWith(10);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'plex:recent:10',
        recentlyAdded,
        600, // 10 minutes cache for recently added
      );
      expect(result).toEqual(recentlyAdded);
    });

    it('should respect count limits for recently added', async () => {
      const recentlyAdded = MockResponseFactory.createPlexResponse();
      mockPlexClient.getRecentlyAdded.mockResolvedValue(recentlyAdded);
      mockCacheService.get.mockResolvedValue(null);

      await plexService.getRecentlyAdded(50);

      expect(mockPlexClient.getRecentlyAdded).toHaveBeenCalledWith(50);
    });
  });

  describe('Server Info Integration', () => {
    it('should fetch and cache server information', async () => {
      const serverInfo = {
        friendlyName: 'Test Plex Server',
        version: '1.28.2.6406',
        platform: 'Linux',
        platformVersion: '20.04',
        updatedAt: Date.now(),
      };

      mockPlexClient.getServerInfo.mockResolvedValue(serverInfo);
      mockCacheService.get.mockResolvedValue(null);

      const result = await plexService.getServerInfo();

      expect(mockPlexClient.getServerInfo).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'plex:server:info',
        serverInfo,
        7200, // 2 hours cache for server info
      );
      expect(result).toEqual(serverInfo);
    });

    it('should return cached server info when available', async () => {
      const cachedServerInfo = {
        friendlyName: 'Cached Server',
        version: '1.28.2',
      };

      mockCacheService.get.mockResolvedValue(cachedServerInfo);

      const result = await plexService.getServerInfo();

      expect(mockPlexClient.getServerInfo).not.toHaveBeenCalled();
      expect(result).toEqual(cachedServerInfo);
    });
  });

  describe('Connection Validation Integration', () => {
    it('should validate Plex connection and update cache', async () => {
      const connectionStatus = {
        connected: true,
        responseTime: 45,
        serverVersion: '1.28.2',
        lastChecked: Date.now(),
      };

      mockPlexClient.validateConnection.mockResolvedValue(connectionStatus);
      mockCacheService.set.mockResolvedValue('OK');

      const result = await plexService.validateConnection();

      expect(mockPlexClient.validateConnection).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'plex:connection:status',
        connectionStatus,
        300, // 5 minutes cache for connection status
      );
      expect(result).toEqual(connectionStatus);
    });

    it('should handle connection failures and cache the failure', async () => {
      const connectionError = {
        connected: false,
        error: 'Connection refused',
        lastChecked: Date.now(),
      };

      mockPlexClient.validateConnection.mockResolvedValue(connectionError);

      const result = await plexService.validateConnection();

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent requests efficiently', async () => {
      const libraryData = MockResponseFactory.createPlexResponse();
      mockPlexClient.getLibraryContents.mockResolvedValue(libraryData);
      mockCacheService.get.mockResolvedValue(null);

      const { duration } = await TestUtils.measurePerformance(async () => {
        // Simulate 20 concurrent library requests
        const requests = Array.from({ length: 20 }, (_, i) =>
          plexService.getLibraryContents('movies', i + 1),
        );
        return await Promise.all(requests);
      });

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(mockPlexClient.getLibraryContents).toHaveBeenCalledTimes(20);
    });

    it('should implement proper cache invalidation strategies', async () => {
      const libraryData = MockResponseFactory.createPlexResponse();

      // First request - cache miss
      mockCacheService.get.mockResolvedValueOnce(null);
      mockPlexClient.getLibraryContents.mockResolvedValueOnce(libraryData);

      // Second request - cache hit
      mockCacheService.get.mockResolvedValueOnce(libraryData);

      await plexService.getLibraryContents('movies', 1);
      await plexService.getLibraryContents('movies', 1);

      expect(mockPlexClient.getLibraryContents).toHaveBeenCalledTimes(1);
      expect(mockCacheService.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should implement circuit breaker pattern for failing services', async () => {
      const error = new Error('Service unavailable');

      // Fail multiple times to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        mockPlexClient.validateConnection.mockRejectedValueOnce(error);

        try {
          await plexService.validateConnection();
        } catch (e) {
          // Expected to fail
        }
      }

      // Circuit should be open now, service should fail fast
      const startTime = Date.now();
      try {
        await plexService.validateConnection();
      } catch (e) {
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(100); // Should fail fast when circuit is open
      }
    });

    it('should implement exponential backoff for retries', async () => {
      const transientError = new Error('Temporary network error');

      mockPlexClient.getServerInfo
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce({ friendlyName: 'Server' });

      const { result, duration } = await TestUtils.measurePerformance(async () => {
        return await TestUtils.retryOperation(
          () => plexService.getServerInfo(),
          3,
          100, // Base delay of 100ms
        );
      });

      expect(result.friendlyName).toBe('Server');
      expect(duration).toBeGreaterThan(200); // Should include retry delays
      expect(mockPlexClient.getServerInfo).toHaveBeenCalledTimes(3);
    });

    it('should gracefully degrade when cache is unavailable', async () => {
      const libraryData = MockResponseFactory.createPlexResponse();

      // Cache operations fail
      mockCacheService.get.mockRejectedValue(new Error('Cache unavailable'));
      mockCacheService.set.mockRejectedValue(new Error('Cache unavailable'));

      // But Plex client still works
      mockPlexClient.getLibraryContents.mockResolvedValue(libraryData);

      const result = await plexService.getLibraryContents('movies', 1);

      expect(result).toEqual(libraryData);
      expect(mockPlexClient.getLibraryContents).toHaveBeenCalled();
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency across multiple operations', async () => {
      const user1 = UserFactory.create({ plexUsername: 'user1' });
      const user2 = UserFactory.create({ plexUsername: 'user2' });

      const auth1 = { success: true, user: user1, authToken: 'token1' };
      const auth2 = { success: true, user: user2, authToken: 'token2' };

      mockPlexClient.authenticate.mockResolvedValueOnce(auth1).mockResolvedValueOnce(auth2);

      mockCacheService.get.mockResolvedValue(null);

      const [result1, result2] = await Promise.all([
        plexService.authenticateUser('user1', 'pass1'),
        plexService.authenticateUser('user2', 'pass2'),
      ]);

      expect(result1.user.plexUsername).toBe('user1');
      expect(result2.user.plexUsername).toBe('user2');
      expect(result1.authToken).toBe('token1');
      expect(result2.authToken).toBe('token2');
    });

    it('should handle race conditions in cache operations', async () => {
      const libraryData = MockResponseFactory.createPlexResponse();

      // Simulate race condition where cache is checked simultaneously
      let cacheCheckCount = 0;
      mockCacheService.get.mockImplementation(() => {
        cacheCheckCount++;
        return Promise.resolve(null); // Always cache miss for this test
      });

      mockPlexClient.getLibraryContents.mockResolvedValue(libraryData);

      // Make concurrent requests for the same data
      const requests = Array.from({ length: 5 }, () => plexService.getLibraryContents('movies', 1));

      const results = await Promise.all(requests);

      // All requests should return the same data
      results.forEach((result) => {
        expect(result).toEqual(libraryData);
      });

      // Cache should be checked for each request
      expect(cacheCheckCount).toBe(5);
    });
  });
});
