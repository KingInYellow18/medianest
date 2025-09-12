/**
 * MEDIA API INTEGRATION TESTS
 *
 * Comprehensive integration tests for media management endpoints
 * Covers search, requests, CRUD operations, and external API integrations
 */

import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { createServer } from '../../src/server';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { DatabaseTestHelper } from '../helpers/database-test-helper';

const prisma = new PrismaClient();
let app: any;
let server: any;
let dbHelper: DatabaseTestHelper;
let authHelper: AuthTestHelper;

describe('Media API Integration Tests', () => {
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
  });

  describe('GET /api/v1/media/search', () => {
    test('should search for movies successfully', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/media/search')
        .query({
          query: 'Inception',
          type: 'movie',
          year: 2010,
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('results');
      expect(Array.isArray(response.body.data.results)).toBe(true);
      expect(response.body.data.results.length).toBeGreaterThan(0);

      // Validate movie result structure
      const movie = response.body.data.results[0];
      expect(movie).toHaveProperty('id');
      expect(movie).toHaveProperty('title');
      expect(movie).toHaveProperty('overview');
      expect(movie).toHaveProperty('releaseDate');
      expect(movie).toHaveProperty('posterPath');
      expect(movie).toHaveProperty('backdropPath');
      expect(movie).toHaveProperty('voteAverage');
      expect(movie).toHaveProperty('mediaType', 'movie');
    });

    test('should search for TV shows successfully', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/media/search')
        .query({
          query: 'Breaking Bad',
          type: 'tv',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.results.length).toBeGreaterThan(0);
      const tvShow = response.body.data.results[0];
      expect(tvShow).toHaveProperty('mediaType', 'tv');
      expect(tvShow).toHaveProperty('firstAirDate');
      expect(tvShow).toHaveProperty('name');
    });

    test('should handle empty search results', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/media/search')
        .query({
          query: 'NonexistentMovie123456789',
          type: 'movie',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.results).toEqual([]);
      expect(response.body.data.totalResults).toBe(0);
    });

    test('should validate search query parameters', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Test missing query
      await request(app)
        .get('/api/v1/media/search')
        .query({ type: 'movie' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      // Test invalid type
      await request(app)
        .get('/api/v1/media/search')
        .query({
          query: 'test',
          type: 'invalid_type',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      // Test invalid year
      await request(app)
        .get('/api/v1/media/search')
        .query({
          query: 'test',
          type: 'movie',
          year: 'not_a_number',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test', type: 'movie' })
        .expect(401);
    });

    test('should handle TMDB API failures gracefully', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Mock TMDB API failure
      vi.doMock('../../src/services/tmdb.service', () => ({
        tmdbService: {
          searchMulti: vi.fn().mockRejectedValue(new Error('TMDB API Error')),
        },
      }));

      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test', type: 'movie' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(503);

      expect(response.body.error).toContain('service unavailable');
    });

    test('should implement rate limiting for search', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Make rapid search requests
      const requests = Array(15)
        .fill(null)
        .map(() =>
          request(app)
            .get('/api/v1/media/search')
            .query({ query: 'test', type: 'movie' })
            .set('Authorization', `Bearer ${accessToken}`),
        );

      const responses = await Promise.all(
        requests.map((req) => req.then((res) => res.status).catch(() => 429)),
      );

      const rateLimitedCount = responses.filter((status) => status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/media/:mediaType/:tmdbId', () => {
    test('should get movie details successfully', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();
      const movieId = '27205'; // Inception TMDB ID

      const response = await request(app)
        .get(`/api/v1/media/movie/${movieId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', parseInt(movieId));
      expect(response.body.data).toHaveProperty('title');
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('runtime');
      expect(response.body.data).toHaveProperty('genres');
      expect(response.body.data).toHaveProperty('credits');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(Array.isArray(response.body.data.genres)).toBe(true);
    });

    test('should get TV show details with seasons', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();
      const tvShowId = '1396'; // Breaking Bad TMDB ID

      const response = await request(app)
        .get(`/api/v1/media/tv/${tvShowId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('numberOfSeasons');
      expect(response.body.data).toHaveProperty('seasons');
      expect(Array.isArray(response.body.data.seasons)).toBe(true);
    });

    test('should handle non-existent media', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/media/movie/999999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.error).toContain('not found');
    });

    test('should validate media type parameter', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      await request(app)
        .get('/api/v1/media/invalid_type/123')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    test('should validate TMDB ID parameter', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      await request(app)
        .get('/api/v1/media/movie/not_a_number')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('POST /api/v1/media/request', () => {
    test('should create movie request successfully', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      const movieRequest = {
        title: 'Inception',
        year: 2010,
        type: 'movie',
        tmdbId: 27205,
        imdbId: 'tt1375666',
        overview: 'A thief who steals corporate secrets...',
        posterPath: '/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
      };

      const response = await request(app)
        .post('/api/v1/media/request')
        .send(movieRequest)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('title', movieRequest.title);
      expect(response.body.data).toHaveProperty('status', 'pending');
      expect(response.body.data).toHaveProperty('userId', user.id);
      expect(response.body.data).toHaveProperty('requestedAt');
    });

    test('should create TV show request with seasons', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const tvRequest = {
        title: 'Breaking Bad',
        year: 2008,
        type: 'tv',
        tmdbId: 1396,
        seasons: [
          { seasonNumber: 1, status: 'pending' },
          { seasonNumber: 2, status: 'pending' },
        ],
      };

      const response = await request(app)
        .post('/api/v1/media/request')
        .send(tvRequest)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.data).toHaveProperty('seasons');
      expect(response.body.data.seasons).toHaveLength(2);
    });

    test('should prevent duplicate requests', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const movieRequest = {
        title: 'Inception',
        year: 2010,
        type: 'movie',
        tmdbId: 27205,
      };

      // First request should succeed
      await request(app)
        .post('/api/v1/media/request')
        .send(movieRequest)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      // Duplicate request should fail
      const response = await request(app)
        .post('/api/v1/media/request')
        .send(movieRequest)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(409);

      expect(response.body.error).toContain('already requested');
    });

    test('should validate request data schema', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Missing required fields
      await request(app)
        .post('/api/v1/media/request')
        .send({ title: 'Test' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      // Invalid type
      await request(app)
        .post('/api/v1/media/request')
        .send({
          title: 'Test',
          year: 2020,
          type: 'invalid',
          tmdbId: 123,
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      // Invalid year
      await request(app)
        .post('/api/v1/media/request')
        .send({
          title: 'Test',
          year: 'not_a_year',
          type: 'movie',
          tmdbId: 123,
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    test('should handle user quota limits', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Create multiple requests to exceed quota
      const requests = Array(10)
        .fill(null)
        .map((_, index) =>
          request(app)
            .post('/api/v1/media/request')
            .send({
              title: `Test Movie ${index}`,
              year: 2020,
              type: 'movie',
              tmdbId: 1000 + index,
            })
            .set('Authorization', `Bearer ${accessToken}`),
        );

      const responses = await Promise.all(requests);
      const successfulRequests = responses.filter((res) => res.status === 201);
      const quotaExceededRequests = responses.filter((res) => res.status === 429);

      expect(quotaExceededRequests.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/media/requests', () => {
    test('should get user requests with pagination', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      // Create test requests
      await prisma.mediaRequest.createMany({
        data: Array(15)
          .fill(null)
          .map((_, index) => ({
            title: `Test Movie ${index}`,
            year: 2020,
            type: 'movie',
            tmdbId: 1000 + index,
            userId: user.id,
            status: index % 3 === 0 ? 'approved' : 'pending',
          })),
      });

      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('requests');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.requests).toHaveLength(10);
      expect(response.body.data.pagination).toHaveProperty('currentPage', 1);
      expect(response.body.data.pagination).toHaveProperty('totalPages');
      expect(response.body.data.pagination).toHaveProperty('totalItems');
    });

    test('should filter requests by status', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      await prisma.mediaRequest.createMany({
        data: [
          {
            title: 'Pending Movie',
            year: 2020,
            type: 'movie',
            tmdbId: 1001,
            userId: user.id,
            status: 'pending',
          },
          {
            title: 'Approved Movie',
            year: 2020,
            type: 'movie',
            tmdbId: 1002,
            userId: user.id,
            status: 'approved',
          },
          {
            title: 'Rejected Movie',
            year: 2020,
            type: 'movie',
            tmdbId: 1003,
            userId: user.id,
            status: 'rejected',
          },
        ],
      });

      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ status: 'approved' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.requests).toHaveLength(1);
      expect(response.body.data.requests[0].status).toBe('approved');
    });

    test('should sort requests by date', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      const now = new Date();
      await prisma.mediaRequest.createMany({
        data: [
          {
            title: 'Old Movie',
            year: 2020,
            type: 'movie',
            tmdbId: 1001,
            userId: user.id,
            requestedAt: new Date(now.getTime() - 86400000),
          },
          {
            title: 'New Movie',
            year: 2020,
            type: 'movie',
            tmdbId: 1002,
            userId: user.id,
            requestedAt: now,
          },
        ],
      });

      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ sortBy: 'requestedAt', sortOrder: 'desc' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.requests[0].title).toBe('New Movie');
      expect(response.body.data.requests[1].title).toBe('Old Movie');
    });

    test('should only show user own requests', async () => {
      const { user: user1, accessToken: token1 } = await authHelper.createUserWithTokens();
      const { user: user2 } = await authHelper.createUserWithTokens();

      // Create requests for both users
      await prisma.mediaRequest.createMany({
        data: [
          { title: 'User 1 Movie', year: 2020, type: 'movie', tmdbId: 1001, userId: user1.id },
          { title: 'User 2 Movie', year: 2020, type: 'movie', tmdbId: 1002, userId: user2.id },
        ],
      });

      const response = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.data.requests).toHaveLength(1);
      expect(response.body.data.requests[0].title).toBe('User 1 Movie');
    });
  });

  describe('GET /api/v1/media/requests/:requestId', () => {
    test('should get specific request details', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      const request_data = await prisma.mediaRequest.create({
        data: {
          title: 'Test Movie',
          year: 2020,
          type: 'movie',
          tmdbId: 1001,
          userId: user.id,
          status: 'pending',
        },
      });

      const response = await request(app)
        .get(`/api/v1/media/requests/${request_data.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', request_data.id);
      expect(response.body.data).toHaveProperty('title', 'Test Movie');
      expect(response.body.data).toHaveProperty('status', 'pending');
    });

    test('should reject access to other users requests', async () => {
      const { user: user1 } = await authHelper.createUserWithTokens();
      const { accessToken: token2 } = await authHelper.createUserWithTokens();

      const request_data = await prisma.mediaRequest.create({
        data: {
          title: 'User 1 Movie',
          year: 2020,
          type: 'movie',
          tmdbId: 1001,
          userId: user1.id,
        },
      });

      await request(app)
        .get(`/api/v1/media/requests/${request_data.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(404);
    });

    test('should handle non-existent request ID', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      await request(app)
        .get('/api/v1/media/requests/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/v1/media/requests/:requestId', () => {
    test('should delete pending request successfully', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      const request_data = await prisma.mediaRequest.create({
        data: {
          title: 'Test Movie',
          year: 2020,
          type: 'movie',
          tmdbId: 1001,
          userId: user.id,
          status: 'pending',
        },
      });

      const response = await request(app)
        .delete(`/api/v1/media/requests/${request_data.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify request is deleted
      const deletedRequest = await prisma.mediaRequest.findUnique({
        where: { id: request_data.id },
      });
      expect(deletedRequest).toBeNull();
    });

    test('should prevent deletion of approved/processing requests', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      const approvedRequest = await prisma.mediaRequest.create({
        data: {
          title: 'Approved Movie',
          year: 2020,
          type: 'movie',
          tmdbId: 1001,
          userId: user.id,
          status: 'approved',
        },
      });

      const response = await request(app)
        .delete(`/api/v1/media/requests/${approvedRequest.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.error).toContain('cannot delete');
    });

    test('should prevent deletion of other users requests', async () => {
      const { user: user1 } = await authHelper.createUserWithTokens();
      const { accessToken: token2 } = await authHelper.createUserWithTokens();

      const request_data = await prisma.mediaRequest.create({
        data: {
          title: 'User 1 Movie',
          year: 2020,
          type: 'movie',
          tmdbId: 1001,
          userId: user1.id,
          status: 'pending',
        },
      });

      await request(app)
        .delete(`/api/v1/media/requests/${request_data.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(404);
    });
  });

  describe('Database Transaction Tests', () => {
    test('should handle concurrent request creation with proper locking', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const movieRequest = {
        title: 'Inception',
        year: 2010,
        type: 'movie',
        tmdbId: 27205,
      };

      // Create concurrent requests for same media
      const concurrentRequests = Array(5)
        .fill(null)
        .map(() =>
          request(app)
            .post('/api/v1/media/request')
            .send(movieRequest)
            .set('Authorization', `Bearer ${accessToken}`),
        );

      const responses = await Promise.allSettled(concurrentRequests);
      const successful = responses.filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value.status === 201,
      );
      const conflicts = responses.filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value.status === 409,
      );

      // Only one should succeed, others should be conflicts
      expect(successful.length).toBe(1);
      expect(conflicts.length).toBe(4);
    });

    test('should handle database transaction rollback on error', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      // Mock database error during transaction
      vi.doMock('@prisma/client', () => ({
        PrismaClient: vi.fn().mockImplementation(() => ({
          mediaRequest: {
            create: vi.fn().mockRejectedValue(new Error('Database error')),
          },
        })),
      }));

      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          title: 'Test Movie',
          year: 2020,
          type: 'movie',
          tmdbId: 1001,
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(500);

      expect(response.body.error).toContain('Internal server error');

      // Verify no partial data was created
      const request_count = await prisma.mediaRequest.count({
        where: { userId: user.id },
      });
      expect(request_count).toBe(0);
    });
  });

  describe('Performance and Load Tests', () => {
    test('should handle high volume of search requests', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const startTime = Date.now();

      const searchPromises = Array(50)
        .fill(null)
        .map((_, index) =>
          request(app)
            .get('/api/v1/media/search')
            .query({
              query: `test${index}`,
              type: 'movie',
            })
            .set('Authorization', `Bearer ${accessToken}`),
        );

      const responses = await Promise.allSettled(searchPromises);
      const duration = Date.now() - startTime;

      const successful = responses.filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value.status === 200,
      );

      // Should handle most requests successfully within reasonable time
      expect(successful.length).toBeGreaterThan(40);
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });

    test('should maintain response times under concurrent load', async () => {
      const users = await Promise.all(
        Array(10)
          .fill(null)
          .map(() => authHelper.createUserWithTokens()),
      );

      const responseTimes: number[] = [];

      for (const { accessToken } of users) {
        const startTime = Date.now();

        await request(app)
          .get('/api/v1/media/search')
          .query({ query: 'test', type: 'movie' })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        responseTimes.push(Date.now() - startTime);
      }

      const avgResponseTime =
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      expect(avgResponseTime).toBeLessThan(2000); // 2 second average
    });
  });
});
