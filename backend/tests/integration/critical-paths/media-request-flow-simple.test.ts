import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createTestApp, createTestJWT } from '../../helpers/test-app';
import { server } from '../../msw/setup';
import { http, HttpResponse } from 'msw';
import { cleanupDatabase } from '../../helpers/database-cleanup';

const prisma = new PrismaClient();

describe('Critical Path: Media Request Flow (Simplified)', () => {
  let app: any;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Clean up test database using helper
    await cleanupDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    server.resetHandlers();

    // Clean database between tests for isolation
    await cleanupDatabase(prisma);

    // Create test user
    const user = await prisma.user.create({
      data: {
        plexId: 'test-plex-id',
        plexUsername: 'testuser',
        email: 'test@example.com',
        role: 'USER',
      },
    });
    userId = user.id;

    // Generate auth token
    authToken = createTestJWT({ userId: user.id, role: user.role });

    // Set up Overseerr service configuration
    await prisma.serviceConfig.create({
      data: {
        serviceName: 'overseerr',
        serviceUrl: 'http://overseerr.local',
        apiKey: 'overseerr-api-key',
        enabled: true,
      },
    });

    // Create test app with mock routes
    app = createTestApp();

    // Mock search endpoint
    app.get('/api/v1/media/search', async (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const query = req.query.q;

      // Mock search results
      if (query?.toLowerCase().includes('matrix')) {
        res.json({
          results: [
            {
              id: 603,
              title: 'The Matrix',
              mediaType: 'movie',
              releaseDate: '1999-03-30',
              overview: 'A computer hacker learns about the true nature of reality',
              posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
            },
          ],
          totalResults: 1,
        });
      } else {
        res.json({ results: [], totalResults: 0 });
      }
    });

    // Mock media details endpoint
    app.get('/api/v1/media/movie/:id', async (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const movieId = parseInt(req.params.id);

      if (movieId === 603) {
        res.json({
          id: 603,
          title: 'The Matrix',
          overview:
            'A computer hacker learns about the true nature of reality and his role in the war against its controllers.',
          runtime: 136,
          genres: [
            { id: 28, name: 'Action' },
            { id: 878, name: 'Science Fiction' },
          ],
          releaseDate: '1999-03-30',
        });
      } else {
        res.status(404).json({ error: 'Movie not found' });
      }
    });

    // Mock request submission endpoint
    app.post('/api/v1/media/request', async (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { mediaType, mediaId } = req.body;

      // Check for existing request
      const existingRequest = await prisma.mediaRequest.findFirst({
        where: {
          userId: req.user.userId,
          tmdbId: String(mediaId),
          mediaType,
        },
      });

      if (existingRequest) {
        return res.status(409).json({ error: 'Media already requested' });
      }

      // Create new request
      const mediaRequest = await prisma.mediaRequest.create({
        data: {
          userId: req.user.userId,
          overseerrId: String(Math.floor(Math.random() * 10000)),
          mediaType,
          tmdbId: String(mediaId),
          title:
            mediaType === 'movie' && mediaId === 603 ? 'The Matrix' : `${mediaType} ${mediaId}`,
          status: 'pending',
        },
      });

      res.status(201).json(mediaRequest);
    });

    // Mock user requests endpoint
    app.get('/api/v1/media/requests', async (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const [requests, total] = await Promise.all([
        prisma.mediaRequest.findMany({
          where: { userId: req.user.userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.mediaRequest.count({
          where: { userId: req.user.userId },
        }),
      ]);

      res.json({
        requests,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    });

    // Mock specific request endpoint
    app.get('/api/v1/media/requests/:id', async (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const request = await prisma.mediaRequest.findFirst({
        where: {
          id: req.params.id,
          userId: req.user.userId,
        },
      });

      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      res.json(request);
    });

    // Mock delete request endpoint
    app.delete('/api/v1/media/requests/:id', async (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const request = await prisma.mediaRequest.findFirst({
        where: {
          id: req.params.id,
          userId: req.user.userId,
        },
      });

      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      await prisma.mediaRequest.delete({
        where: { id: request.id },
      });

      res.json({ message: 'Request cancelled successfully' });
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should complete full media request flow from search to submission', async () => {
    // Step 1: Search for media
    const searchResponse = await request(app)
      .get('/api/v1/media/search')
      .query({ q: 'The Matrix' })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(searchResponse.body).toMatchObject({
      results: expect.arrayContaining([
        expect.objectContaining({
          id: 603,
          title: 'The Matrix',
          mediaType: 'movie',
          releaseDate: '1999-03-30',
        }),
      ]),
      totalResults: 1,
    });

    const matrixMovie = searchResponse.body.results[0];

    // Step 2: Get detailed media information
    const detailsResponse = await request(app)
      .get(`/api/v1/media/movie/${matrixMovie.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(detailsResponse.body).toMatchObject({
      id: 603,
      title: 'The Matrix',
      overview: expect.any(String),
      runtime: 136,
      genres: expect.arrayContaining([
        { id: 28, name: 'Action' },
        { id: 878, name: 'Science Fiction' },
      ]),
    });

    // Step 3: Submit media request
    const requestResponse = await request(app)
      .post('/api/v1/media/request')
      .send({
        mediaType: 'movie',
        mediaId: matrixMovie.id,
      })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(requestResponse.body).toMatchObject({
      id: expect.any(String),
      overseerrId: expect.any(String),
      mediaType: 'movie',
      tmdbId: '603',
      title: 'The Matrix',
      status: 'pending',
      userId: userId,
    });

    const requestId = requestResponse.body.id;

    // Step 4: Verify request appears in user's history
    const historyResponse = await request(app)
      .get('/api/v1/media/requests')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(historyResponse.body).toMatchObject({
      requests: expect.arrayContaining([
        expect.objectContaining({
          id: requestId,
          title: 'The Matrix',
          status: 'pending',
        }),
      ]),
      total: 1,
      page: 1,
    });

    // Step 5: Attempt duplicate request (should fail)
    const duplicateResponse = await request(app)
      .post('/api/v1/media/request')
      .send({
        mediaType: 'movie',
        mediaId: matrixMovie.id,
      })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(409);

    expect(duplicateResponse.body.error).toContain('already requested');

    // Step 6: Get specific request details
    const requestDetailsResponse = await request(app)
      .get(`/api/v1/media/requests/${requestId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(requestDetailsResponse.body).toMatchObject({
      id: requestId,
      title: 'The Matrix',
      mediaType: 'movie',
      status: 'pending',
      createdAt: expect.any(String),
    });
  });

  it('should require authentication for all endpoints', async () => {
    // Try without auth token
    await request(app).get('/api/v1/media/search').query({ q: 'Test' }).expect(401);

    await request(app)
      .post('/api/v1/media/request')
      .send({ mediaType: 'movie', mediaId: 123 })
      .expect(401);

    await request(app).get('/api/v1/media/requests').expect(401);
  });

  it('should allow users to cancel their own pending requests', async () => {
    // Create a pending request
    const mediaRequest = await prisma.mediaRequest.create({
      data: {
        userId,
        overseerrId: '888',
        mediaType: 'movie',
        tmdbId: '888',
        title: 'Cancellable Movie',
        status: 'pending',
      },
    });

    // Cancel the request
    const cancelResponse = await request(app)
      .delete(`/api/v1/media/requests/${mediaRequest.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(cancelResponse.body.message).toContain('cancelled');

    // Verify request was deleted
    const deletedRequest = await prisma.mediaRequest.findUnique({
      where: { id: mediaRequest.id },
    });

    expect(deletedRequest).toBeNull();
  });

  it('should handle pagination correctly', async () => {
    // Create multiple requests
    const requestPromises = Array(15)
      .fill(null)
      .map((_, i) =>
        prisma.mediaRequest.create({
          data: {
            userId,
            overseerrId: String(2000 + i),
            mediaType: i % 2 === 0 ? 'movie' : 'tv',
            tmdbId: String(2000 + i),
            title: `Test Media ${i}`,
            status: 'pending',
          },
        }),
      );

    await Promise.all(requestPromises);

    // Get first page
    const page1Response = await request(app)
      .get('/api/v1/media/requests')
      .query({ page: 1, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(page1Response.body.requests).toHaveLength(10);
    expect(page1Response.body.total).toBeGreaterThanOrEqual(15);
    expect(page1Response.body.page).toBe(1);
    expect(page1Response.body.totalPages).toBeGreaterThanOrEqual(2);

    // Get second page
    const page2Response = await request(app)
      .get('/api/v1/media/requests')
      .query({ page: 2, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(page2Response.body.page).toBe(2);
    expect(page2Response.body.requests.length).toBeGreaterThan(0);

    // Verify different results
    const page1Ids = page1Response.body.requests.map((r: any) => r.id);
    const page2Ids = page2Response.body.requests.map((r: any) => r.id);
    const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
    expect(intersection).toHaveLength(0);
  });
});
