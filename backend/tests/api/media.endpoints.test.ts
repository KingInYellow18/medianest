import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '@/app';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

const prisma = new PrismaClient();

describe('API Endpoints: Media (/api/v1/media)', () => {
  let authToken: string;
  let userId: string;
  let adminToken: string;

  beforeAll(async () => {
    // Clean test database
    await prisma.mediaRequest.deleteMany();
    await prisma.serviceConfiguration.deleteMany();
    await prisma.user.deleteMany();

    // Create test users
    const user = await prisma.user.create({
      data: {
        plexId: 'media-test-user',
        username: 'mediauser',
        email: 'media@example.com',
        role: 'user',
        status: 'active',
      },
    });
    userId = user.id;
    authToken = global.createTestJWT({ userId: user.id, role: user.role });

    const admin = await prisma.user.create({
      data: {
        plexId: 'media-admin-user',
        username: 'mediaadmin',
        email: 'mediaadmin@example.com',
        role: 'admin',
        status: 'active',
      },
    });
    adminToken = global.createTestJWT({ userId: admin.id, role: admin.role });

    // Configure Overseerr service
    await prisma.serviceConfiguration.create({
      data: {
        service: 'overseerr',
        url: 'http://overseerr.local',
        apiKey: 'test-api-key',
        enabled: true,
        isConfigured: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  describe('GET /api/v1/media/search', () => {
    it('should search for media with query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ q: 'The Matrix' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        results: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            title: expect.stringContaining('Matrix'),
            mediaType: expect.stringMatching(/^(movie|tv)$/),
            posterPath: expect.any(String),
          }),
        ]),
        page: 1,
        totalPages: expect.any(Number),
        totalResults: expect.any(Number),
      });
    });

    it('should support pagination', async () => {
      const page1 = await request(app)
        .get('/api/v1/media/search')
        .query({ q: 'Star Wars', page: 1 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const page2 = await request(app)
        .get('/api/v1/media/search')
        .query({ q: 'Star Wars', page: 2 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(page1.body.page).toBe(1);
      expect(page2.body.page).toBe(2);

      // Results should be different
      if (page1.body.results.length > 0 && page2.body.results.length > 0) {
        expect(page1.body.results[0].id).not.toBe(page2.body.results[0].id);
      }
    });

    it('should validate query parameters', async () => {
      // Missing query
      await request(app)
        .get('/api/v1/media/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      // Invalid page
      await request(app)
        .get('/api/v1/media/search')
        .query({ q: 'test', page: -1 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle Overseerr errors gracefully', async () => {
      server.use(
        http.get(/overseerr.*search/, () => {
          return HttpResponse.json({ error: 'Service Unavailable' }, { status: 503 });
        }),
      );

      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ q: 'test' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(503);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('Search service'),
        retryAfter: expect.any(Number),
      });
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/media/search').query({ q: 'test' }).expect(401);
    });
  });

  describe('GET /api/v1/media/:type/:id', () => {
    it('should get movie details', async () => {
      const response = await request(app)
        .get('/api/v1/media/movie/603')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 603,
        title: 'The Matrix',
        mediaType: 'movie',
        overview: expect.any(String),
        releaseDate: expect.any(String),
        runtime: expect.any(Number),
        genres: expect.any(Array),
        mediaInfo: expect.objectContaining({
          status: expect.any(Number),
        }),
      });
    });

    it('should validate media type', async () => {
      await request(app)
        .get('/api/v1/media/invalid/123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle non-existent media', async () => {
      server.use(
        http.get(/overseerr.*movie\/99999/, () => {
          return HttpResponse.json({ error: 'Not Found' }, { status: 404 });
        }),
      );

      const response = await request(app)
        .get('/api/v1/media/movie/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/v1/media/request', () => {
    it('should create a new media request', async () => {
      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          mediaId: 550,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        userId,
        mediaType: 'movie',
        mediaId: 550,
        status: 'pending',
        requestedAt: expect.any(String),
      });

      // Verify request was saved to database
      const dbRequest = await prisma.mediaRequest.findUnique({
        where: { id: response.body.id },
      });
      expect(dbRequest).toBeTruthy();
    });

    it('should support TV show requests with seasons', async () => {
      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'tv',
          mediaId: 1399,
          seasons: [1, 2, 3],
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toMatchObject({
        mediaType: 'tv',
        mediaId: 1399,
        seasons: [1, 2, 3],
      });
    });

    it('should prevent duplicate requests', async () => {
      // First request
      await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          mediaId: 551,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Duplicate request
      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          mediaId: 551,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(response.body.error).toContain('already requested');
    });

    it('should validate request body', async () => {
      const invalidRequests = [
        { body: {}, expectedError: 'mediaType is required' },
        { body: { mediaType: 'movie' }, expectedError: 'mediaId is required' },
        { body: { mediaType: 'invalid', mediaId: 123 }, expectedError: 'Invalid media type' },
        {
          body: { mediaType: 'tv', mediaId: 123, seasons: 'all' },
          expectedError: 'must be an array',
        },
      ];

      for (const { body, expectedError } of invalidRequests) {
        const response = await request(app)
          .post('/api/v1/media/request')
          .send(body)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.error).toContain(expectedError);
      }
    });

    it('should enforce rate limiting', async () => {
      // Create 5 requests quickly
      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .post('/api/v1/media/request')
            .send({
              mediaType: 'movie',
              mediaId: 1000 + i,
            })
            .set('Authorization', `Bearer ${authToken}`),
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/media/requests', () => {
    beforeEach(async () => {
      // Create test requests
      await prisma.mediaRequest.createMany({
        data: [
          {
            userId,
            externalId: 1,
            mediaType: 'movie',
            mediaId: 100,
            title: 'Test Movie 1',
            status: 'pending',
            requestedAt: new Date(),
          },
          {
            userId,
            externalId: 2,
            mediaType: 'tv',
            mediaId: 200,
            title: 'Test TV Show',
            status: 'approved',
            requestedAt: new Date(),
          },
        ],
      });
    });

    it("should return user's media requests", async () => {
      const response = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        requests: expect.arrayContaining([
          expect.objectContaining({
            userId,
            title: expect.any(String),
            status: expect.any(String),
          }),
        ]),
        total: expect.any(Number),
        page: 1,
        totalPages: expect.any(Number),
      });
    });

    it('should support filtering by status', async () => {
      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.requests.every((r: any) => r.status === 'pending')).toBe(true);
    });

    it('should support filtering by media type', async () => {
      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ mediaType: 'movie' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.requests.every((r: any) => r.mediaType === 'movie')).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ page: 1, limit: 1 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.requests).toHaveLength(1);
      expect(response.body.page).toBe(1);
      expect(response.body.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('should allow admin to view all requests', async () => {
      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ all: true })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Admin should see all users' requests
      expect(response.body.requests.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/v1/media/requests/:id', () => {
    let requestId: string;

    beforeEach(async () => {
      const mediaRequest = await prisma.mediaRequest.create({
        data: {
          userId,
          externalId: 123,
          mediaType: 'movie',
          mediaId: 123,
          title: 'Specific Request',
          status: 'pending',
          requestedAt: new Date(),
        },
      });
      requestId = mediaRequest.id;
    });

    it('should return specific request details', async () => {
      const response = await request(app)
        .get(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: requestId,
        title: 'Specific Request',
        mediaType: 'movie',
        status: 'pending',
      });
    });

    it('should return 404 for non-existent request', async () => {
      await request(app)
        .get('/api/v1/media/requests/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should prevent access to other users requests', async () => {
      // Create request for different user
      const otherUser = await prisma.user.create({
        data: {
          plexId: 'other-media-user',
          username: 'otheruser',
          email: 'other@example.com',
          role: 'user',
          status: 'active',
        },
      });

      const otherRequest = await prisma.mediaRequest.create({
        data: {
          userId: otherUser.id,
          externalId: 456,
          mediaType: 'movie',
          mediaId: 456,
          title: 'Other User Request',
          status: 'pending',
          requestedAt: new Date(),
        },
      });

      await request(app)
        .get(`/api/v1/media/requests/${otherRequest.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/v1/media/requests/:id', () => {
    let requestId: string;

    beforeEach(async () => {
      const mediaRequest = await prisma.mediaRequest.create({
        data: {
          userId,
          externalId: 789,
          mediaType: 'movie',
          mediaId: 789,
          title: 'Deletable Request',
          status: 'pending',
          requestedAt: new Date(),
        },
      });
      requestId = mediaRequest.id;
    });

    it('should allow user to cancel pending request', async () => {
      const response = await request(app)
        .delete(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('cancelled');

      // Verify request was deleted
      const deleted = await prisma.mediaRequest.findUnique({
        where: { id: requestId },
      });
      expect(deleted).toBeNull();
    });

    it('should prevent cancelling approved requests', async () => {
      // Update request to approved
      await prisma.mediaRequest.update({
        where: { id: requestId },
        data: { status: 'approved' },
      });

      const response = await request(app)
        .delete(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toContain('Cannot cancel');
    });

    it('should allow admin to cancel any request', async () => {
      await request(app)
        .delete(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('POST /api/v1/media/webhooks/overseerr', () => {
    it('should handle Overseerr webhook notifications', async () => {
      // Create a media request
      const mediaRequest = await prisma.mediaRequest.create({
        data: {
          userId,
          externalId: 999,
          mediaType: 'movie',
          mediaId: 999,
          title: 'Webhook Test Movie',
          status: 'pending',
          requestedAt: new Date(),
        },
      });

      const response = await request(app)
        .post('/api/v1/media/webhooks/overseerr')
        .send({
          notification_type: 'MEDIA_APPROVED',
          request: {
            id: 999,
            status: 4,
          },
          media: {
            tmdbId: 999,
            mediaType: 'movie',
          },
        })
        .set('X-Overseerr-Signature', 'test-signature')
        .expect(200);

      expect(response.body.message).toContain('processed');

      // Verify status was updated
      const updated = await prisma.mediaRequest.findUnique({
        where: { id: mediaRequest.id },
      });
      expect(updated?.status).toBe('approved');
    });

    it('should validate webhook signature', async () => {
      await request(app)
        .post('/api/v1/media/webhooks/overseerr')
        .send({
          notification_type: 'MEDIA_APPROVED',
          request: { id: 1 },
        })
        .expect(401);
    });
  });
});
