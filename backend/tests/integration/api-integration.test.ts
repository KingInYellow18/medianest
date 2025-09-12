/**
 * MediaNest API Integration Tests
 *
 * Comprehensive integration testing for MediaNest API endpoints covering:
 * - End-to-end API workflow testing
 * - Authentication flow validation
 * - Database integration testing
 * - Error handling and edge case validation
 * - Cross-service communication testing
 */

import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import Redis from 'ioredis';
import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

import { createApp } from '@/app';

import { testUsers, testMediaRequests } from '../fixtures/test-data';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { DatabaseTestHelper } from '../helpers/database-test-helper';
import { RedisTestHelper } from '../helpers/redis-test-helper';

import { AuthService } from '@/services/auth.service';
import { MediaService } from '@/services/media.service';

describe('MediaNest API Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let redis: Redis;
  let dbHelper: DatabaseTestHelper;
  let redisHelper: RedisTestHelper;
  let authHelper: AuthTestHelper;

  // Test context
  let testTokens: Record<string, string>;
  let testUserIds: Record<string, string>;

  beforeAll(async () => {
    // Initialize test environment
    app = await createApp({ env: 'test' });
    prisma = new PrismaClient({
      datasources: {
        db: {
          url:
            process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5433/medianest_test',
        },
      },
    });

    redis = new Redis(process.env.TEST_REDIS_URL || 'redis://localhost:6380');

    // Initialize test helpers
    dbHelper = new DatabaseTestHelper(prisma);
    redisHelper = new RedisTestHelper(redis);
    authHelper = new AuthTestHelper();

    // Setup test data
    await dbHelper.setupTestDatabase();
    await redisHelper.clearTestData();

    // Create test users and tokens
    const authService = new AuthService();
    testTokens = {};
    testUserIds = {};

    for (const userData of testUsers) {
      const user = await dbHelper.createTestUser(userData);
      testUserIds[userData.role] = user.id;
      testTokens[userData.role] = await authService.generateToken(user);
    }
  });

  afterAll(async () => {
    await dbHelper.cleanup();
    await redisHelper.cleanup();
    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    await dbHelper.clearTestData();
    await redisHelper.clearTestData();
  });

  afterEach(async () => {
    await dbHelper.clearTestData();
  });

  describe('Authentication Integration', () => {
    test('should complete full authentication workflow', async () => {
      // Test Plex OAuth PIN generation
      const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      expect(pinResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String),
          code: expect.any(String),
          expires: expect.any(String),
        }),
      });

      const { id: pinId, code } = pinResponse.body.data;

      // Test PIN verification with mock Plex response
      const verifyResponse = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ pinId, mockToken: 'test-plex-token' })
        .expect(200);

      expect(verifyResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            id: expect.any(String),
            plexId: expect.any(String),
            role: expect.any(String),
          }),
        }),
      });

      // Verify token works for authenticated requests
      const profileResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${verifyResponse.body.data.token}`)
        .expect(200);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.user.plexId).toBeTruthy();
    });

    test('should handle session management correctly', async () => {
      const userToken = testTokens.user;

      // Test session creation
      const sessionResponse = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(sessionResponse.body.data.user.id).toBe(testUserIds.user);

      // Test session refresh
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(refreshResponse.body.data.token).toBeTruthy();
      expect(refreshResponse.body.data.token).not.toBe(userToken);

      // Test logout
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify token is invalidated
      await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401);
    });

    test('should enforce role-based authorization', async () => {
      const userToken = testTokens.user;
      const adminToken = testTokens.admin;

      // User should not access admin endpoints
      await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // Admin should access admin endpoints
      const adminResponse = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(adminResponse.body.success).toBe(true);
      expect(Array.isArray(adminResponse.body.data.users)).toBe(true);

      // Both should access user endpoints
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    test('should handle authentication errors gracefully', async () => {
      // Invalid token
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Missing token
      await request(app).get('/api/v1/auth/me').expect(401);

      // Expired token (simulate by using revoked token)
      const expiredToken = await authHelper.createExpiredToken(testUserIds.user);
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Database Integration', () => {
    test('should handle database operations with transactions', async () => {
      const userToken = testTokens.user;

      // Create multiple related records in a transaction
      const mediaRequestData = {
        mediaType: 'movie',
        tmdbId: 12345,
        title: 'Test Movie',
        quality: 'HD',
        notes: 'Integration test request',
      };

      const createResponse = await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send(mediaRequestData)
        .expect(201);

      const requestId = createResponse.body.data.id;

      // Verify request was created with proper relationships
      const getResponse = await request(app)
        .get(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(getResponse.body.data).toMatchObject({
        id: requestId,
        userId: testUserIds.user,
        media: expect.objectContaining({
          tmdbId: mediaRequestData.tmdbId,
          title: mediaRequestData.title,
        }),
        status: 'pending',
      });

      // Verify database constraints
      const dbRequest = await prisma.mediaRequest.findUnique({
        where: { id: requestId },
        include: { user: true, media: true },
      });

      expect(dbRequest).toBeTruthy();
      expect(dbRequest!.user.id).toBe(testUserIds.user);
      expect(dbRequest!.media.tmdbId).toBe(mediaRequestData.tmdbId);
    });

    test('should handle database connection failures gracefully', async () => {
      // Simulate database connection issues
      await dbHelper.simulateConnectionError();

      const userToken = testTokens.user;

      const response = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'DATABASE_ERROR',
          message: expect.any(String),
        }),
      });

      // Restore connection
      await dbHelper.restoreConnection();

      // Verify recovery
      await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });

    test('should maintain data integrity with concurrent operations', async () => {
      const userToken = testTokens.user;
      const adminToken = testTokens.admin;

      // Create initial request
      const createResponse = await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          mediaType: 'movie',
          tmdbId: 67890,
          title: 'Concurrent Test Movie',
        })
        .expect(201);

      const requestId = createResponse.body.data.id;

      // Simulate concurrent operations
      const operations = [
        // User updates notes
        request(app)
          .put(`/api/v1/media/requests/${requestId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ notes: 'Updated by user' }),

        // Admin approves request
        request(app)
          .put(`/api/v1/admin/requests/${requestId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ notes: 'Approved by admin' }),

        // User tries to cancel (should fail if approved)
        request(app)
          .put(`/api/v1/media/requests/${requestId}/cancel`)
          .set('Authorization', `Bearer ${userToken}`),
      ];

      const results = await Promise.all(operations);

      // Verify final state is consistent
      const finalResponse = await request(app)
        .get(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const finalRequest = finalResponse.body.data;

      // Should be approved (admin action takes precedence)
      expect(finalRequest.status).toBe('approved');
      expect(finalRequest.approvedBy).toBe(testUserIds.admin);

      // Verify database consistency
      const dbRequest = await prisma.mediaRequest.findUnique({
        where: { id: requestId },
        include: {
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      });

      expect(dbRequest!.statusHistory.length).toBeGreaterThan(0);
      expect(dbRequest!.statusHistory[0].status).toBe('approved');
    });
  });

  describe('Redis Integration', () => {
    test('should manage session cache correctly', async () => {
      const userToken = testTokens.user;

      // Login should create session cache
      await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify session in Redis
      const sessionKey = `session:${testUserIds.user}`;
      const cachedSession = await redis.get(sessionKey);
      expect(cachedSession).toBeTruthy();

      const sessionData = JSON.parse(cachedSession!);
      expect(sessionData.userId).toBe(testUserIds.user);

      // Logout should clear session cache
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const clearedSession = await redis.get(sessionKey);
      expect(clearedSession).toBeNull();
    });

    test('should handle rate limiting with Redis', async () => {
      const testKey = 'test-rate-limit';

      // Make requests up to the limit
      const requests = Array.from({ length: 10 }, () =>
        request(app).post('/api/v1/auth/plex/pin').set('X-Forwarded-For', '192.168.1.100'),
      );

      const responses = await Promise.all(requests);

      // First requests should succeed
      expect(responses.slice(0, 5).every((r) => r.status === 200)).toBe(true);

      // Later requests should be rate limited
      const rateLimitedResponses = responses.slice(5);
      expect(rateLimitedResponses.some((r) => r.status === 429)).toBe(true);

      // Verify rate limit data in Redis
      const rateLimitKey = 'rate_limit:192.168.1.100:auth_pin';
      const rateLimitData = await redis.get(rateLimitKey);
      expect(rateLimitData).toBeTruthy();
    });

    test('should cache media search results', async () => {
      const userToken = testTokens.user;
      const searchQuery = 'test movie search';

      // First search should hit external API and cache result
      const firstResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: searchQuery, page: 1 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(firstResponse.body.success).toBe(true);
      expect(firstResponse.headers['x-cache']).toBe('MISS');

      // Verify cache entry
      const cacheKey = `search:${Buffer.from(searchQuery).toString('base64')}:1`;
      const cachedResult = await redis.get(cacheKey);
      expect(cachedResult).toBeTruthy();

      // Second identical search should return cached result
      const secondResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: searchQuery, page: 1 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(secondResponse.body).toEqual(firstResponse.body);
      expect(secondResponse.headers['x-cache']).toBe('HIT');
    });

    test('should handle Redis connection failures', async () => {
      // Simulate Redis connection failure
      await redisHelper.simulateConnectionError();

      const userToken = testTokens.user;

      // API should still work without Redis (degraded performance)
      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test search', page: 1 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.headers['x-cache']).toBe('UNAVAILABLE');

      // Restore Redis connection
      await redisHelper.restoreConnection();

      // Verify Redis is working again
      const cachedResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test search redis recovery', page: 1 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(cachedResponse.headers['x-cache']).toBe('MISS');
    });
  });

  describe('Cross-Service Integration', () => {
    test('should handle complete media request workflow', async () => {
      const userToken = testTokens.user;
      const adminToken = testTokens.admin;

      // 1. User searches for media
      const searchResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'Inception', mediaType: 'movie' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const searchResults = searchResponse.body.data;
      expect(searchResults.length).toBeGreaterThan(0);

      const selectedMovie = searchResults[0];

      // 2. User creates request
      const requestResponse = await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          mediaType: 'movie',
          tmdbId: selectedMovie.id,
          title: selectedMovie.title,
          quality: 'HD',
        })
        .expect(201);

      const requestId = requestResponse.body.data.id;

      // 3. Admin reviews request
      const adminRequestsResponse = await request(app)
        .get('/api/v1/admin/requests')
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const pendingRequests = adminRequestsResponse.body.data.requests;
      const targetRequest = pendingRequests.find((req: any) => req.id === requestId);
      expect(targetRequest).toBeTruthy();

      // 4. Admin approves request
      const approvalResponse = await request(app)
        .put(`/api/v1/admin/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Approved for download' })
        .expect(200);

      expect(approvalResponse.body.data.status).toBe('approved');

      // 5. User sees updated status
      const updatedRequestResponse = await request(app)
        .get(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(updatedRequestResponse.body.data.status).toBe('approved');
      expect(updatedRequestResponse.body.data.approvedBy).toBe(testUserIds.admin);

      // 6. Verify notification was sent (mock check)
      const notificationKey = `notification:${testUserIds.user}:${requestId}`;
      const notification = await redis.get(notificationKey);
      expect(notification).toBeTruthy();
    });

    test('should integrate with external services properly', async () => {
      const userToken = testTokens.user;

      // Test TMDB integration via search
      const tmdbResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'The Matrix', mediaType: 'movie' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(tmdbResponse.body.data).toBeTruthy();
      expect(tmdbResponse.body.data[0]).toMatchObject({
        id: expect.any(Number),
        title: expect.any(String),
        overview: expect.any(String),
        poster_path: expect.any(String),
      });

      // Test media details endpoint
      const movieId = tmdbResponse.body.data[0].id;
      const detailsResponse = await request(app)
        .get(`/api/v1/media/movie/${movieId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(detailsResponse.body.data).toMatchObject({
        id: movieId,
        title: expect.any(String),
        genres: expect.any(Array),
        runtime: expect.any(Number),
      });
    });

    test('should handle service circuit breaker patterns', async () => {
      const userToken = testTokens.user;

      // Simulate external service failures to trigger circuit breaker
      const failedRequests = [];
      for (let i = 0; i < 5; i++) {
        try {
          await request(app)
            .get('/api/v1/media/search')
            .query({ query: 'trigger-service-error', page: 1 })
            .set('Authorization', `Bearer ${userToken}`);
        } catch (error) {
          failedRequests.push(error);
        }
      }

      // Circuit breaker should now be open
      const circuitBreakerResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'normal-search', page: 1 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(503);

      expect(circuitBreakerResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'SERVICE_UNAVAILABLE',
          message: expect.stringMatching(/circuit breaker/i),
        }),
      });

      // Wait for circuit breaker recovery (simulate time passage)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Service should recover
      const recoveryResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'recovery-test', page: 1 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(recoveryResponse.body.success).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle validation errors consistently', async () => {
      const userToken = testTokens.user;

      // Test various validation scenarios
      const validationTests = [
        {
          endpoint: '/api/v1/media/request',
          method: 'post',
          data: { mediaType: 'invalid' },
          expectedError: 'VALIDATION_ERROR',
        },
        {
          endpoint: '/api/v1/media/request',
          method: 'post',
          data: { mediaType: 'movie', tmdbId: 'not-a-number' },
          expectedError: 'VALIDATION_ERROR',
        },
        {
          endpoint: '/api/v1/media/requests/invalid-id',
          method: 'get',
          data: {},
          expectedError: 'INVALID_ID',
        },
      ];

      for (const test of validationTests) {
        const response = await request(app)
          [test.method as 'get' | 'post' | 'put'](test.endpoint)
          .set('Authorization', `Bearer ${userToken}`)
          .send(test.data)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.objectContaining({
            code: test.expectedError,
          }),
        });
      }
    });

    test('should handle resource not found scenarios', async () => {
      const userToken = testTokens.user;

      // Test non-existent request
      const notFoundResponse = await request(app)
        .get('/api/v1/media/requests/99999999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(notFoundResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: expect.stringMatching(/request not found/i),
        }),
      });

      // Test non-existent media details
      const mediaNotFoundResponse = await request(app)
        .get('/api/v1/media/movie/99999999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(mediaNotFoundResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'MEDIA_NOT_FOUND',
        }),
      });
    });

    test('should handle permission errors correctly', async () => {
      const userToken = testTokens.user;
      const adminToken = testTokens.admin;

      // Create request as admin
      const adminRequestResponse = await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mediaType: 'movie',
          tmdbId: 12345,
          title: 'Admin Movie Request',
        })
        .expect(201);

      const adminRequestId = adminRequestResponse.body.data.id;

      // User should not be able to access admin's request
      const unauthorizedResponse = await request(app)
        .get(`/api/v1/media/requests/${adminRequestId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(unauthorizedResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'FORBIDDEN',
          message: expect.stringMatching(/access denied/i),
        }),
      });
    });
  });

  describe('Performance Integration', () => {
    test('should handle concurrent requests efficiently', async () => {
      const userToken = testTokens.user;
      const concurrentRequestCount = 10;

      // Create concurrent requests
      const startTime = Date.now();
      const promises = Array.from({ length: concurrentRequestCount }, (_, i) =>
        request(app)
          .get('/api/v1/media/search')
          .query({ query: `concurrent-test-${i}`, page: 1 })
          .set('Authorization', `Bearer ${userToken}`),
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds max

      console.log(`Completed ${concurrentRequestCount} concurrent requests in ${duration}ms`);
    });

    test('should handle large data sets efficiently', async () => {
      const userToken = testTokens.user;

      // Test pagination performance
      const largePageResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ pageSize: 100, page: 1 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(largePageResponse.body.data.requests).toBeTruthy();
      expect(largePageResponse.body.data.pagination).toBeTruthy();

      // Test search performance with broad query
      const startTime = Date.now();
      const broadSearchResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'action', page: 1, pageSize: 50 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      const searchDuration = Date.now() - startTime;

      expect(broadSearchResponse.body.data.length).toBeGreaterThan(0);
      expect(searchDuration).toBeLessThan(3000); // 3 seconds max

      console.log(`Large search completed in ${searchDuration}ms`);
    });
  });
});
