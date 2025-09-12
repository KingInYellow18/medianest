/**
 * MediaNest Third-Party Integration Tests
 *
 * Comprehensive integration testing for external services:
 * - TMDB API integration and caching
 * - Plex API integration and OAuth flow
 * - External CDN integration validation
 * - Monitoring service integration (Uptime Kuma, etc.)
 * - Circuit breaker patterns and failure handling
 * - Rate limiting and API quota management
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import axios, { AxiosInstance } from 'axios';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import request from 'supertest';
import { createApp } from '@/app';
import { DatabaseTestHelper } from '../helpers/database-test-helper';
import { RedisTestHelper } from '../helpers/redis-test-helper';
import { testUsers } from '../fixtures/test-data';
import nock from 'nock';

// Mock external service responses
const MOCK_RESPONSES = {
  tmdb: {
    searchMovie: {
      page: 1,
      results: [
        {
          id: 603,
          title: 'The Matrix',
          overview:
            'A computer hacker learns from mysterious rebels about the true nature of his reality.',
          release_date: '1999-03-30',
          poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
          backdrop_path: '/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
          genre_ids: [28, 878],
          vote_average: 8.2,
          vote_count: 15420,
        },
      ],
      total_pages: 1,
      total_results: 1,
    },
    movieDetails: {
      id: 603,
      title: 'The Matrix',
      overview:
        'A computer hacker learns from mysterious rebels about the true nature of his reality.',
      release_date: '1999-03-30',
      runtime: 136,
      genres: [
        { id: 28, name: 'Action' },
        { id: 878, name: 'Science Fiction' },
      ],
      production_companies: [{ id: 79, name: 'Village Roadshow Pictures' }],
      vote_average: 8.2,
      vote_count: 15420,
    },
  },
  plex: {
    pinCreation: `<?xml version="1.0" encoding="UTF-8"?>
      <pin>
        <id>test-pin-123</id>
        <code>ABCD</code>
        <product>Plex Web</product>
        <trusted>1</trusted>
        <clientName>MediaNest</clientName>
        <expiresIn>300</expiresIn>
      </pin>`,
    pinVerification: `<?xml version="1.0" encoding="UTF-8"?>
      <pin>
        <authToken>test-auth-token-12345</authToken>
      </pin>`,
    userInfo: `<?xml version="1.0" encoding="UTF-8"?>
      <user>
        <id>test-user-123</id>
        <uuid>test-uuid-456</uuid>
        <username>testuser</username>
        <email>test@example.com</email>
        <title>Test User</title>
        <thumb>https://plex.tv/users/avatar/test.jpg</thumb>
      </user>`,
  },
};

describe('Third-Party Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let redis: Redis;
  let dbHelper: DatabaseTestHelper;
  let redisHelper: RedisTestHelper;
  let userToken: string;
  let adminToken: string;
  let tmdbAxios: AxiosInstance;

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

    // Initialize helpers
    dbHelper = new DatabaseTestHelper(prisma);
    redisHelper = new RedisTestHelper(redis);

    // Setup test environment
    await dbHelper.setupTestDatabase();
    await redisHelper.clearTestData();

    // Create test users and tokens
    const userInfo = await dbHelper.createTestUser(testUsers[0]);
    const adminInfo = await dbHelper.createTestUser(testUsers[1]);

    // Generate tokens (simplified for testing)
    userToken = 'test-user-token';
    adminToken = 'test-admin-token';

    // Create TMDB axios instance
    tmdbAxios = axios.create({
      baseURL: 'https://api.themoviedb.org/3',
      timeout: 5000,
    });

    console.log('✅ Third-party integration test environment ready');
  });

  afterAll(async () => {
    await dbHelper.cleanup();
    await redisHelper.cleanup();
    await prisma.$disconnect();
    await redis.quit();
    nock.cleanAll();
  });

  beforeEach(async () => {
    await dbHelper.clearTestData();
    await redisHelper.clearTestData();
    nock.cleanAll();
  });

  describe('TMDB API Integration', () => {
    test('should search movies via TMDB API with proper caching', async () => {
      // Mock TMDB API response
      nock('https://api.themoviedb.org/3')
        .get('/search/movie')
        .query(true)
        .reply(200, MOCK_RESPONSES.tmdb.searchMovie);

      const searchQuery = 'The Matrix';

      // First request should hit TMDB API
      const firstResponse = await request(app)
        .get('/api/v1/media/search')
        .query({
          query: searchQuery,
          mediaType: 'movie',
          page: 1,
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(firstResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({
              id: 603,
              title: 'The Matrix',
            }),
          ]),
        }),
      });

      // Verify cache miss header
      expect(firstResponse.headers['x-cache']).toBe('MISS');

      // Second identical request should hit cache
      const secondResponse = await request(app)
        .get('/api/v1/media/search')
        .query({
          query: searchQuery,
          mediaType: 'movie',
          page: 1,
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should return same data
      expect(secondResponse.body).toEqual(firstResponse.body);
      // Should be from cache
      expect(secondResponse.headers['x-cache']).toBe('HIT');

      // Verify cache entry exists in Redis
      const cacheKey = `search:${Buffer.from(searchQuery).toString('base64')}:movie:1`;
      const cachedData = await redis.get(cacheKey);
      expect(cachedData).toBeTruthy();

      const parsedCacheData = JSON.parse(cachedData!);
      expect(parsedCacheData.results[0].title).toBe('The Matrix');
    });

    test('should fetch movie details with cast and crew', async () => {
      // Mock movie details API
      nock('https://api.themoviedb.org/3')
        .get('/movie/603')
        .query(true)
        .reply(200, MOCK_RESPONSES.tmdb.movieDetails);

      // Mock credits API
      nock('https://api.themoviedb.org/3')
        .get('/movie/603/credits')
        .query(true)
        .reply(200, {
          cast: [
            {
              id: 6384,
              name: 'Keanu Reeves',
              character: 'Neo',
              profile_path: '/4D0PpNI0kmP58hgrwGC3wCjxhnm.jpg',
            },
          ],
          crew: [
            {
              id: 905,
              name: 'Lana Wachowski',
              job: 'Director',
              department: 'Directing',
            },
          ],
        });

      const detailsResponse = await request(app)
        .get('/api/v1/media/movie/603')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(detailsResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: 603,
          title: 'The Matrix',
          runtime: 136,
          genres: expect.arrayContaining([expect.objectContaining({ name: 'Action' })]),
          cast: expect.arrayContaining([
            expect.objectContaining({
              name: 'Keanu Reeves',
              character: 'Neo',
            }),
          ]),
          crew: expect.arrayContaining([
            expect.objectContaining({
              name: 'Lana Wachowski',
              job: 'Director',
            }),
          ]),
        }),
      });
    });

    test('should handle TMDB API rate limiting gracefully', async () => {
      // Mock rate limit response
      nock('https://api.themoviedb.org/3').get('/search/movie').query(true).reply(
        429,
        {
          status_message: 'Your request count (41) is over the allowed limit of 40.',
          status_code: 25,
        },
        {
          'Retry-After': '1',
        },
      );

      const rateLimitResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test', mediaType: 'movie' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(429);

      expect(rateLimitResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'RATE_LIMITED',
          message: expect.stringMatching(/rate limit/i),
        }),
      });

      // Should include retry-after information
      expect(rateLimitResponse.body.error.retryAfter).toBeTruthy();
    });

    test('should handle TMDB API service unavailability', async () => {
      // Mock service unavailable
      nock('https://api.themoviedb.org/3')
        .get('/search/movie')
        .query(true)
        .reply(503, 'Service Temporarily Unavailable');

      const serviceErrorResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test', mediaType: 'movie' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(503);

      expect(serviceErrorResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'SERVICE_UNAVAILABLE',
          message: expect.stringMatching(/temporarily unavailable/i),
        }),
      });
    });

    test('should implement circuit breaker for TMDB API failures', async () => {
      // Mock multiple consecutive failures to trigger circuit breaker
      nock('https://api.themoviedb.org/3')
        .get('/search/movie')
        .query(true)
        .times(5)
        .reply(500, 'Internal Server Error');

      // Make 5 consecutive requests to trigger circuit breaker
      const failurePromises = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/v1/media/search')
          .query({ query: 'circuit-breaker-test', mediaType: 'movie' })
          .set('Authorization', `Bearer ${userToken}`),
      );

      const failureResponses = await Promise.all(failurePromises);

      // All should return service error
      failureResponses.forEach((response) => {
        expect(response.status).toBeGreaterThanOrEqual(500);
      });

      // Next request should return circuit breaker error without hitting API
      const circuitBreakerResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'after-circuit-breaker', mediaType: 'movie' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(503);

      expect(circuitBreakerResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'CIRCUIT_BREAKER_OPEN',
          message: expect.stringMatching(/circuit breaker/i),
        }),
      });
    });

    test('should validate TMDB API responses and handle malformed data', async () => {
      // Mock malformed response
      nock('https://api.themoviedb.org/3')
        .get('/search/movie')
        .query(true)
        .reply(200, {
          // Missing required fields
          results: [
            {
              id: 'invalid-id', // Should be number
              title: null, // Should be string
              // missing other required fields
            },
          ],
        });

      const malformedResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'malformed-test', mediaType: 'movie' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(502);

      expect(malformedResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'INVALID_EXTERNAL_RESPONSE',
          message: expect.stringMatching(/invalid.*response/i),
        }),
      });
    });
  });

  describe('Plex API Integration', () => {
    test('should complete Plex OAuth PIN flow', async () => {
      // Mock Plex PIN creation
      nock('https://plex.tv')
        .post('/pins.xml')
        .query(true)
        .reply(200, MOCK_RESPONSES.plex.pinCreation);

      // Step 1: Create PIN
      const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      expect(pinResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: 'test-pin-123',
          code: 'ABCD',
          expires: expect.any(String),
          url: expect.stringContaining('plex.tv'),
        }),
      });

      const pinId = pinResponse.body.data.id;

      // Mock PIN verification
      nock('https://plex.tv')
        .get(`/pins/${pinId}.xml`)
        .query(true)
        .reply(200, MOCK_RESPONSES.plex.pinVerification);

      // Mock user info retrieval
      nock('https://plex.tv')
        .get('/users/account.xml')
        .query(true)
        .reply(200, MOCK_RESPONSES.plex.userInfo);

      // Step 2: Verify PIN
      const verifyResponse = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ pinId })
        .expect(200);

      expect(verifyResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            plexId: 'test-user-123',
            plexUsername: 'testuser',
            email: 'test@example.com',
          }),
        }),
      });

      // Verify user was created in database
      const dbUser = await prisma.user.findUnique({
        where: { plexId: 'test-user-123' },
      });

      expect(dbUser).toBeTruthy();
      expect(dbUser!.plexUsername).toBe('testuser');
      expect(dbUser!.email).toBe('test@example.com');
    });

    test('should handle unauthorized PIN attempts', async () => {
      // Mock PIN creation
      nock('https://plex.tv')
        .post('/pins.xml')
        .query(true)
        .reply(200, MOCK_RESPONSES.plex.pinCreation);

      const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      const pinId = pinResponse.body.data.id;

      // Mock unauthorized PIN (no auth token)
      nock('https://plex.tv')
        .get(`/pins/${pinId}.xml`)
        .query(true)
        .reply(
          200,
          `<?xml version="1.0" encoding="UTF-8"?>
          <pin>
            <id>${pinId}</id>
            <code>ABCD</code>
          </pin>`,
        );

      const unauthorizedResponse = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ pinId })
        .expect(400);

      expect(unauthorizedResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'PIN_NOT_AUTHORIZED',
          message: expect.stringMatching(/not.*authorized/i),
        }),
      });
    });

    test('should handle PIN expiration', async () => {
      // Mock expired PIN
      nock('https://plex.tv').get('/pins/expired-pin-123.xml').query(true).reply(404, 'Not Found');

      const expiredResponse = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ pinId: 'expired-pin-123' })
        .expect(404);

      expect(expiredResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'PIN_EXPIRED',
          message: expect.stringMatching(/expired.*not found/i),
        }),
      });
    });

    test('should validate Plex server connectivity for existing users', async () => {
      // Create test user with Plex token
      const testUser = await dbHelper.createTestUser({
        plexId: 'plex-connectivity-test',
        username: 'connectivitytest',
        email: 'connectivity@test.com',
        role: 'user',
        status: 'active',
        plexToken: 'test-plex-token-connectivity',
      });

      // Mock successful Plex server validation
      nock('https://plex.tv')
        .get('/users/account.xml')
        .query(true)
        .reply(200, MOCK_RESPONSES.plex.userInfo);

      const connectivityResponse = await request(app)
        .get('/api/v1/auth/plex/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(connectivityResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          connected: true,
          serverAccessible: true,
          userValid: true,
        }),
      });
    });

    test('should handle Plex API authentication errors', async () => {
      // Mock authentication failure
      nock('https://plex.tv').get('/users/account.xml').query(true).reply(401, 'Unauthorized');

      const authErrorResponse = await request(app)
        .get('/api/v1/auth/plex/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401);

      expect(authErrorResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'PLEX_AUTH_FAILED',
          message: expect.stringMatching(/plex.*authentication.*failed/i),
        }),
      });
    });
  });

  describe('CDN Integration', () => {
    test('should validate CDN asset delivery', async () => {
      const cdnBaseUrl = process.env.CDN_BASE_URL || 'https://cdn.example.com';

      // Mock CDN response for poster image
      nock(cdnBaseUrl)
        .get('/posters/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg')
        .reply(200, 'fake-image-data', {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000',
          ETag: '"test-etag"',
        });

      const cdnResponse = await request(app)
        .get('/api/v1/media/poster/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(cdnResponse.headers['content-type']).toBe('image/jpeg');
      expect(cdnResponse.headers['cache-control']).toContain('public');
      expect(cdnResponse.text).toBe('fake-image-data');
    });

    test('should handle CDN failures with fallback', async () => {
      const cdnBaseUrl = process.env.CDN_BASE_URL || 'https://cdn.example.com';

      // Mock CDN failure
      nock(cdnBaseUrl).get('/posters/unavailable-poster.jpg').reply(404, 'Not Found');

      // Mock fallback CDN
      nock('https://image.tmdb.org')
        .get('/t/p/w500/unavailable-poster.jpg')
        .reply(200, 'fallback-image-data', {
          'Content-Type': 'image/jpeg',
        });

      const fallbackResponse = await request(app)
        .get('/api/v1/media/poster/unavailable-poster.jpg')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(fallbackResponse.headers['x-served-by']).toBe('fallback-cdn');
      expect(fallbackResponse.text).toBe('fallback-image-data');
    });

    test('should implement CDN response caching', async () => {
      const cdnBaseUrl = process.env.CDN_BASE_URL || 'https://cdn.example.com';
      const imageUrl = '/posters/cached-image.jpg';

      // Mock CDN response
      nock(cdnBaseUrl).get(imageUrl).reply(200, 'cached-image-data', {
        'Content-Type': 'image/jpeg',
        ETag: '"cached-etag"',
      });

      // First request should hit CDN
      const firstResponse = await request(app)
        .get(`/api/v1/media/poster/cached-image.jpg`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(firstResponse.headers['x-cache']).toBe('MISS');

      // Second request should be cached
      const secondResponse = await request(app)
        .get(`/api/v1/media/poster/cached-image.jpg`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(secondResponse.headers['x-cache']).toBe('HIT');
      expect(secondResponse.text).toBe('cached-image-data');
    });
  });

  describe('Monitoring Service Integration', () => {
    test('should report system health to monitoring service', async () => {
      const monitoringUrl = process.env.MONITORING_WEBHOOK_URL || 'https://monitoring.example.com';

      // Mock monitoring service webhook
      let receivedHealthData: any = null;
      nock(monitoringUrl)
        .post('/webhook/health')
        .reply(200, (uri, requestBody) => {
          receivedHealthData = requestBody;
          return { status: 'received' };
        });

      // Trigger health check reporting
      const healthResponse = await request(app)
        .post('/api/v1/admin/health/report')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(healthResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          reported: true,
          monitoringService: 'connected',
        }),
      });

      // Verify monitoring service received correct data
      expect(receivedHealthData).toMatchObject({
        service: 'medianest',
        status: 'healthy',
        timestamp: expect.any(String),
        metrics: expect.objectContaining({
          database: expect.objectContaining({ status: 'connected' }),
          redis: expect.objectContaining({ status: 'connected' }),
          external_apis: expect.any(Object),
        }),
      });
    });

    test('should handle monitoring service unavailability', async () => {
      const monitoringUrl = process.env.MONITORING_WEBHOOK_URL || 'https://monitoring.example.com';

      // Mock monitoring service failure
      nock(monitoringUrl).post('/webhook/health').reply(503, 'Service Unavailable');

      const failedReportResponse = await request(app)
        .post('/api/v1/admin/health/report')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200); // Should not fail the request

      expect(failedReportResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          reported: false,
          monitoringService: 'unavailable',
          error: expect.stringMatching(/monitoring.*unavailable/i),
        }),
      });
    });

    test('should send alerts for critical system issues', async () => {
      const alertUrl = process.env.ALERT_WEBHOOK_URL || 'https://alerts.example.com';

      let receivedAlert: any = null;
      nock(alertUrl)
        .post('/webhook/alert')
        .reply(200, (uri, requestBody) => {
          receivedAlert = requestBody;
          return { status: 'alert_received' };
        });

      // Simulate critical error that should trigger alert
      const alertResponse = await request(app)
        .post('/api/v1/admin/system/simulate-critical-error')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ errorType: 'database_connection_lost' })
        .expect(200);

      // Wait for alert to be sent
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(receivedAlert).toMatchObject({
        service: 'medianest',
        level: 'critical',
        message: expect.stringMatching(/database.*connection/i),
        timestamp: expect.any(String),
        details: expect.any(Object),
      });
    });
  });

  describe('API Quota and Rate Limiting', () => {
    test('should track and respect TMDB API quota', async () => {
      // Mock TMDB responses with quota headers
      nock('https://api.themoviedb.org/3')
        .get('/search/movie')
        .query(true)
        .times(3)
        .reply(200, MOCK_RESPONSES.tmdb.searchMovie, {
          'X-RateLimit-Limit': '1000',
          'X-RateLimit-Remaining': '997',
          'X-RateLimit-Reset': Math.floor(Date.now() / 1000) + 3600,
        });

      // Make multiple requests
      const requests = Array.from({ length: 3 }, () =>
        request(app)
          .get('/api/v1/media/search')
          .query({ query: 'quota-test', mediaType: 'movie' })
          .set('Authorization', `Bearer ${userToken}`),
      );

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Check quota tracking in admin endpoint
      const quotaResponse = await request(app)
        .get('/api/v1/admin/external-services/quota')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(quotaResponse.body.data).toMatchObject({
        tmdb: expect.objectContaining({
          limit: 1000,
          remaining: expect.any(Number),
          resetTime: expect.any(String),
          usage: expect.objectContaining({
            requests: expect.any(Number),
            period: expect.any(String),
          }),
        }),
      });
    });

    test('should implement progressive backoff for rate limits', async () => {
      let requestCount = 0;

      // Mock progressive rate limit responses
      nock('https://api.themoviedb.org/3')
        .get('/search/movie')
        .query(true)
        .times(5)
        .reply(() => {
          requestCount++;
          if (requestCount <= 2) {
            return [200, MOCK_RESPONSES.tmdb.searchMovie];
          } else {
            return [
              429,
              {
                status_message: 'Request rate limit exceeded',
                status_code: 25,
              },
              { 'Retry-After': '2' },
            ];
          }
        });

      // First two requests should succeed
      await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'backoff-test-1', mediaType: 'movie' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'backoff-test-2', mediaType: 'movie' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Third request should be rate limited
      const rateLimitedResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'backoff-test-3', mediaType: 'movie' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(429);

      expect(rateLimitedResponse.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'RATE_LIMITED',
          retryAfter: expect.any(Number),
        }),
      });

      // Verify backoff is implemented in Redis
      const backoffKey = 'api_backoff:tmdb';
      const backoffData = await redis.get(backoffKey);
      expect(backoffData).toBeTruthy();

      const backoffInfo = JSON.parse(backoffData!);
      expect(backoffInfo.retryAfter).toBeGreaterThan(0);
    });

    test('should distribute API calls across multiple keys/tokens', async () => {
      // This would test API key rotation for higher quotas
      // Mock responses for different API keys
      nock('https://api.themoviedb.org/3')
        .get('/search/movie')
        .query((obj) => obj.api_key === 'key1')
        .reply(200, MOCK_RESPONSES.tmdb.searchMovie, {
          'X-RateLimit-Remaining': '10',
        });

      nock('https://api.themoviedb.org/3')
        .get('/search/movie')
        .query((obj) => obj.api_key === 'key2')
        .reply(200, MOCK_RESPONSES.tmdb.searchMovie, {
          'X-RateLimit-Remaining': '15',
        });

      // Make requests that should use key rotation
      const keyRotationResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'key-rotation-test', mediaType: 'movie' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(keyRotationResponse.body.success).toBe(true);
      expect(keyRotationResponse.headers['x-api-key-used']).toMatch(/key[12]/);
    });
  });

  describe('Service Recovery and Resilience', () => {
    test('should recover gracefully from temporary service outages', async () => {
      let requestCount = 0;

      // Mock service recovery scenario
      nock('https://api.themoviedb.org/3')
        .get('/search/movie')
        .query(true)
        .times(5)
        .reply(() => {
          requestCount++;
          if (requestCount <= 2) {
            // First requests fail
            return [503, 'Service Temporarily Unavailable'];
          } else {
            // Later requests succeed
            return [200, MOCK_RESPONSES.tmdb.searchMovie];
          }
        });

      // First request should fail
      await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'recovery-test', mediaType: 'movie' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(503);

      // Wait for potential recovery backoff
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Second request should succeed (service recovered)
      const recoveredResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'recovery-test', mediaType: 'movie' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(recoveredResponse.body.success).toBe(true);
      expect(recoveredResponse.headers['x-service-recovery']).toBe('true');
    });

    test('should maintain service degradation mode during outages', async () => {
      // Mock all external services as unavailable
      nock('https://api.themoviedb.org/3')
        .get(() => true)
        .reply(503, 'Service Unavailable')
        .persist();

      // Application should still function in degraded mode
      const degradedResponse = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(degradedResponse.body.success).toBe(true);
      expect(degradedResponse.headers['x-service-mode']).toBe('degraded');

      // Some features should show degradation warnings
      expect(degradedResponse.body.warnings).toContainEqual(
        expect.objectContaining({
          code: 'EXTERNAL_SERVICE_UNAVAILABLE',
          message: expect.stringMatching(/external.*service.*unavailable/i),
        }),
      );
    });

    test('should validate service dependencies on startup', async () => {
      const startupResponse = await request(app).get('/api/v1/health/startup').expect(200);

      expect(startupResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          services: expect.objectContaining({
            database: expect.objectContaining({
              status: 'connected',
              responseTime: expect.any(Number),
            }),
            redis: expect.objectContaining({
              status: 'connected',
              responseTime: expect.any(Number),
            }),
            tmdb: expect.objectContaining({
              status: expect.stringMatching(/connected|available/),
              responseTime: expect.any(Number),
            }),
          }),
          readiness: true,
        }),
      });
    });
  });
});
