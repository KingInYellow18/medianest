/**
 * PLEX API INTEGRATION TESTS
 *
 * Comprehensive integration tests for Plex integration endpoints
 * Covers server info, libraries, search, collections, and external API mocking
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createServer } from '../../src/server';
import { DatabaseTestHelper } from '../helpers/database-test-helper';
import { AuthTestHelper } from '../helpers/auth-test-helper';

const prisma = new PrismaClient();
let app: any;
let server: any;
let dbHelper: DatabaseTestHelper;
let authHelper: AuthTestHelper;

describe('Plex API Integration Tests', () => {
  beforeAll(async () => {
    dbHelper = new DatabaseTestHelper();
    authHelper = new AuthTestHelper();

    await dbHelper.setupTestDatabase();
    app = await createServer();
    server = app.listen(0);
  });

  afterAll(async () => {
    await server?.close();
    await dbHelper.cleanupTestDatabase();
    await authHelper.disconnect();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await dbHelper.seedTestData();
    vi.clearAllMocks();
  });

  describe('Authentication Requirements', () => {
    test('should require authentication for all Plex routes', async () => {
      const plexEndpoints = [
        '/api/v1/plex/server',
        '/api/v1/plex/libraries',
        '/api/v1/plex/libraries/1/items',
        '/api/v1/plex/search',
        '/api/v1/plex/recently-added',
        '/api/v1/plex/libraries/1/collections',
        '/api/v1/plex/collections/1',
      ];

      for (const endpoint of plexEndpoints) {
        await request(app).get(endpoint).expect(401);
      }
    });

    test('should allow access with valid authentication', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Mock Plex API responses
      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getServerInfo: vi.fn().mockResolvedValue({
            friendlyName: 'Test Plex Server',
            version: '1.25.0.0000',
          }),
        },
      }));

      await request(app)
        .get('/api/v1/plex/server')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe('GET /api/v1/plex/server', () => {
    test('should get Plex server information successfully', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Mock successful Plex server response
      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getServerInfo: vi.fn().mockResolvedValue({
            friendlyName: 'My Plex Server',
            version: '1.25.2.5319',
            platform: 'Linux',
            platformVersion: 'Ubuntu 20.04',
            machineIdentifier: 'test-machine-id',
            size: '125GB',
            myPlex: true,
            transcoderActiveVideoSessions: 0,
            updatedAt: new Date().toISOString(),
          }),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/server')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('friendlyName', 'My Plex Server');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('platform');
      expect(response.body.data).toHaveProperty('machineIdentifier');
      expect(response.body.data).toHaveProperty('myPlex', true);
      expect(response.body.data).toHaveProperty('transcoderActiveVideoSessions', 0);
    });

    test('should handle Plex server unavailable', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getServerInfo: vi.fn().mockRejectedValue(new Error('Plex server unreachable')),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/server')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(503);

      expect(response.body.error).toContain('Plex server unavailable');
    });

    test('should handle unauthorized Plex access', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getServerInfo: vi.fn().mockRejectedValue({ status: 401, message: 'Unauthorized' }),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/server')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body.error).toContain('Plex authentication failed');
    });

    test('should include proper cache headers', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getServerInfo: vi.fn().mockResolvedValue({ friendlyName: 'Test' }),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/server')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify cache headers for long-term caching
      expect(response.headers).toHaveProperty('cache-control');
      expect(response.headers['cache-control']).toContain('max-age');
    });
  });

  describe('GET /api/v1/plex/libraries', () => {
    test('should get all Plex libraries', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const mockLibraries = [
        {
          key: '1',
          title: 'Movies',
          type: 'movie',
          agent: 'com.plexapp.agents.imdb',
          scanner: 'Plex Movie Scanner',
          language: 'en',
          uuid: 'library-uuid-1',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          scannedAt: new Date().toISOString(),
          thumb: '/library/sections/1/composite/1234567890',
          art: '/library/sections/1/art/1234567890',
          filters: true,
          refreshing: false,
        },
        {
          key: '2',
          title: 'TV Shows',
          type: 'show',
          agent: 'com.plexapp.agents.thetvdb',
          scanner: 'Plex Series Scanner',
          language: 'en',
          uuid: 'library-uuid-2',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          scannedAt: new Date().toISOString(),
          thumb: '/library/sections/2/composite/1234567890',
          art: '/library/sections/2/art/1234567890',
          filters: true,
          refreshing: false,
        },
      ];

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getLibraries: vi.fn().mockResolvedValue(mockLibraries),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.libraries)).toBe(true);
      expect(response.body.data.libraries).toHaveLength(2);

      const movieLibrary = response.body.data.libraries.find((lib: any) => lib.type === 'movie');
      expect(movieLibrary).toHaveProperty('key', '1');
      expect(movieLibrary).toHaveProperty('title', 'Movies');
      expect(movieLibrary).toHaveProperty('type', 'movie');
      expect(movieLibrary).toHaveProperty('agent');
      expect(movieLibrary).toHaveProperty('scanner');
    });

    test('should handle empty libraries response', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getLibraries: vi.fn().mockResolvedValue([]),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.libraries).toEqual([]);
    });

    test('should handle Plex API timeout', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getLibraries: vi.fn().mockRejectedValue({ code: 'ETIMEDOUT' }),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(504);

      expect(response.body.error).toContain('timeout');
    });
  });

  describe('GET /api/v1/plex/libraries/:libraryKey/items', () => {
    test('should get items from specific library', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const mockItems = [
        {
          ratingKey: '12345',
          key: '/library/metadata/12345',
          guid: 'plex://movie/5d7768ba96b655001fbcb912',
          studio: 'Warner Bros.',
          type: 'movie',
          title: 'Inception',
          titleSort: 'Inception',
          contentRating: 'PG-13',
          summary: 'A thief who steals corporate secrets...',
          rating: 8.8,
          audienceRating: 9.3,
          year: 2010,
          tagline: 'Your mind is the scene of the crime',
          thumb: '/library/metadata/12345/thumb/1234567890',
          art: '/library/metadata/12345/art/1234567890',
          duration: 8880000,
          originallyAvailableAt: '2010-07-16',
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          Media: [
            {
              id: 123,
              duration: 8880000,
              bitrate: 10000,
              width: 1920,
              height: 1080,
              aspectRatio: 1.78,
              audioChannels: 6,
              audioCodec: 'dca',
              videoCodec: 'h264',
              videoResolution: '1080p',
              container: 'mkv',
              videoFrameRate: '24p',
              Part: [
                {
                  id: 456,
                  key: '/library/parts/456/1234567890/file.mkv',
                  duration: 8880000,
                  file: '/movies/Inception (2010)/Inception.mkv',
                  size: 12884901888,
                  container: 'mkv',
                },
              ],
            },
          ],
        },
      ];

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getLibraryItems: vi.fn().mockResolvedValue({
            items: mockItems,
            totalSize: 1,
            size: 1,
          }),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/libraries/1/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('totalSize', 1);
      expect(Array.isArray(response.body.data.items)).toBe(true);

      const movie = response.body.data.items[0];
      expect(movie).toHaveProperty('title', 'Inception');
      expect(movie).toHaveProperty('year', 2010);
      expect(movie).toHaveProperty('type', 'movie');
      expect(movie).toHaveProperty('rating', 8.8);
      expect(movie).toHaveProperty('Media');
      expect(Array.isArray(movie.Media)).toBe(true);
    });

    test('should support pagination parameters', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getLibraryItems: vi.fn().mockResolvedValue({
            items: [],
            totalSize: 100,
            size: 25,
          }),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/libraries/1/items')
        .query({
          start: 25,
          size: 25,
          sort: 'titleSort:asc',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('totalSize', 100);
      expect(response.body.data).toHaveProperty('size', 25);
    });

    test('should handle invalid library key', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getLibraryItems: vi.fn().mockRejectedValue({ status: 404 }),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/libraries/999/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.error).toContain('Library not found');
    });

    test('should validate library key parameter', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      await request(app)
        .get('/api/v1/plex/libraries/invalid/items')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/plex/search', () => {
    test('should search across all libraries', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const mockSearchResults = [
        {
          ratingKey: '12345',
          title: 'Inception',
          type: 'movie',
          year: 2010,
          librarySectionTitle: 'Movies',
          librarySectionKey: '1',
          thumb: '/library/metadata/12345/thumb/1234567890',
        },
        {
          ratingKey: '67890',
          title: 'Breaking Bad',
          type: 'show',
          year: 2008,
          librarySectionTitle: 'TV Shows',
          librarySectionKey: '2',
          thumb: '/library/metadata/67890/thumb/1234567890',
        },
      ];

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          searchAll: vi.fn().mockResolvedValue(mockSearchResults),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/search')
        .query({ query: 'inception' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.results)).toBe(true);
      expect(response.body.data.results).toHaveLength(2);

      const movie = response.body.data.results.find((item: any) => item.type === 'movie');
      expect(movie).toHaveProperty('title', 'Inception');
      expect(movie).toHaveProperty('librarySectionTitle', 'Movies');
    });

    test('should require search query parameter', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/plex/search')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.error).toContain('query parameter is required');
    });

    test('should handle empty search results', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          searchAll: vi.fn().mockResolvedValue([]),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/search')
        .query({ query: 'nonexistentmovie123' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.results).toEqual([]);
    });

    test('should implement search rate limiting', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          searchAll: vi.fn().mockResolvedValue([]),
        },
      }));

      // Make rapid search requests
      const requests = Array(10)
        .fill(null)
        .map(() =>
          request(app)
            .get('/api/v1/plex/search')
            .query({ query: 'test' })
            .set('Authorization', `Bearer ${accessToken}`),
        );

      const responses = await Promise.all(
        requests.map((req) => req.then((res) => res.status).catch(() => 429)),
      );

      const rateLimitedCount = responses.filter((status) => status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/plex/recently-added', () => {
    test('should get recently added items', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const mockRecentItems = [
        {
          ratingKey: '12345',
          title: 'New Movie',
          type: 'movie',
          year: 2023,
          addedAt: new Date().toISOString(),
          librarySectionTitle: 'Movies',
        },
        {
          ratingKey: '67890',
          title: 'New TV Show',
          type: 'show',
          year: 2023,
          addedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          librarySectionTitle: 'TV Shows',
        },
      ];

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getRecentlyAdded: vi.fn().mockResolvedValue(mockRecentItems),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/recently-added')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items).toHaveLength(2);

      // Verify items are sorted by addedAt descending
      const items = response.body.data.items;
      expect(new Date(items[0].addedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(items[1].addedAt).getTime(),
      );
    });

    test('should support limit parameter', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getRecentlyAdded: vi.fn().mockResolvedValue([]),
        },
      }));

      await request(app)
        .get('/api/v1/plex/recently-added')
        .query({ limit: 50 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify the service was called with the limit
      const mockService = require('../../src/services/plex.service');
      expect(mockService.plexService.getRecentlyAdded).toHaveBeenCalledWith(50);
    });

    test('should validate limit parameter', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Invalid limit (too high)
      await request(app)
        .get('/api/v1/plex/recently-added')
        .query({ limit: 1000 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      // Invalid limit (not a number)
      await request(app)
        .get('/api/v1/plex/recently-added')
        .query({ limit: 'invalid' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/plex/libraries/:libraryKey/collections', () => {
    test('should get collections for library', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const mockCollections = [
        {
          ratingKey: '123',
          key: '/library/collections/123',
          guid: 'collection://123',
          type: 'collection',
          title: 'Marvel Movies',
          subtype: 'movie',
          summary: 'Marvel Cinematic Universe movies',
          index: 1,
          ratingCount: 25,
          thumb: '/library/collections/123/composite/1234567890',
          art: '/library/collections/123/art/1234567890',
          childCount: 25,
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getCollections: vi.fn().mockResolvedValue(mockCollections),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/libraries/1/collections')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.collections)).toBe(true);
      expect(response.body.data.collections).toHaveLength(1);

      const collection = response.body.data.collections[0];
      expect(collection).toHaveProperty('title', 'Marvel Movies');
      expect(collection).toHaveProperty('type', 'collection');
      expect(collection).toHaveProperty('childCount', 25);
    });

    test('should handle library with no collections', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getCollections: vi.fn().mockResolvedValue([]),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/libraries/1/collections')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.collections).toEqual([]);
    });
  });

  describe('GET /api/v1/plex/collections/:collectionKey', () => {
    test('should get collection details with items', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const mockCollectionDetails = {
        ratingKey: '123',
        title: 'Marvel Movies',
        summary: 'Marvel Cinematic Universe movies',
        childCount: 2,
        items: [
          {
            ratingKey: '456',
            title: 'Iron Man',
            year: 2008,
            type: 'movie',
          },
          {
            ratingKey: '789',
            title: 'Thor',
            year: 2011,
            type: 'movie',
          },
        ],
      };

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getCollectionDetails: vi.fn().mockResolvedValue(mockCollectionDetails),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/collections/123')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('title', 'Marvel Movies');
      expect(response.body.data).toHaveProperty('childCount', 2);
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
    });

    test('should handle non-existent collection', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getCollectionDetails: vi.fn().mockRejectedValue({ status: 404 }),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/collections/999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.error).toContain('Collection not found');
    });
  });

  describe('External API Integration Tests', () => {
    test('should handle Plex API network failures gracefully', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getServerInfo: vi.fn().mockRejectedValue({ code: 'ECONNREFUSED' }),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/server')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(503);

      expect(response.body.error).toContain('service unavailable');
    });

    test('should handle Plex API rate limiting', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getServerInfo: vi.fn().mockRejectedValue({ status: 429, message: 'Too Many Requests' }),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/server')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(429);

      expect(response.body.error).toContain('rate limit');
    });

    test('should handle malformed Plex API responses', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getServerInfo: vi.fn().mockResolvedValue(null), // Invalid response
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/server')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(500);

      expect(response.body.error).toContain('Invalid response');
    });
  });

  describe('Performance and Caching Tests', () => {
    test('should implement proper caching for server info', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const mockServerInfo = { friendlyName: 'Test Server' };
      const mockGetServerInfo = vi.fn().mockResolvedValue(mockServerInfo);

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: { getServerInfo: mockGetServerInfo },
      }));

      // First request
      await request(app)
        .get('/api/v1/plex/server')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Second request (should use cache)
      const response = await request(app)
        .get('/api/v1/plex/server')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify cache headers
      expect(response.headers['cache-control']).toBeDefined();
      expect(response.headers['etag']).toBeDefined();
    });

    test('should handle concurrent requests efficiently', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getLibraries: vi.fn().mockResolvedValue([]),
        },
      }));

      const startTime = Date.now();

      // Make 10 concurrent requests
      const requests = Array(10)
        .fill(null)
        .map(() =>
          request(app).get('/api/v1/plex/libraries').set('Authorization', `Bearer ${accessToken}`),
        );

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('Data Validation and Security', () => {
    test('should sanitize Plex data before returning', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const mockServerInfo = {
        friendlyName: '<script>alert("xss")</script>Plex Server',
        version: '1.25.0.0000',
        accessToken: 'sensitive-token-should-be-removed',
      };

      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          getServerInfo: vi.fn().mockResolvedValue(mockServerInfo),
        },
      }));

      const response = await request(app)
        .get('/api/v1/plex/server')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Should sanitize XSS attempts
      expect(response.body.data.friendlyName).not.toContain('<script>');

      // Should not expose sensitive data
      expect(response.body.data).not.toHaveProperty('accessToken');
    });

    test('should validate request parameters properly', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Test various invalid parameters
      const invalidRequests = [
        { endpoint: '/api/v1/plex/libraries/abc/items', error: 'Invalid library key' },
        { endpoint: '/api/v1/plex/collections/xyz', error: 'Invalid collection key' },
        { endpoint: '/api/v1/plex/search', query: {}, error: 'query parameter is required' },
      ];

      for (const { endpoint, query, error } of invalidRequests) {
        const req = request(app).get(endpoint).set('Authorization', `Bearer ${accessToken}`);

        if (query) {
          req.query(query);
        }

        const response = await req.expect(400);
        expect(response.body.error).toContain(error);
      }
    });
  });
});
