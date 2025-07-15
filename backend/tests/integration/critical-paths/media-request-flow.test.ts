import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '@/app';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';

const prisma = new PrismaClient();

describe('Critical Path: Media Request Flow', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Clean up test database
    await prisma.mediaRequest.deleteMany();
    await prisma.serviceConfiguration.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    const user = await prisma.user.create({
      data: {
        plexId: 'test-plex-id',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
      },
    });
    userId = user.id;

    // Generate auth token
    authToken = global.createTestJWT({ userId: user.id, role: user.role });

    // Set up Overseerr service configuration
    await prisma.serviceConfiguration.create({
      data: {
        service: 'overseerr',
        url: 'http://overseerr.local',
        apiKey: 'overseerr-api-key',
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
      totalResults: expect.any(Number),
    });

    const matrixMovie = searchResponse.body.results.find((r: any) => r.id === 603);

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
      externalId: expect.any(Number),
      mediaType: 'movie',
      mediaId: 603,
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
      total: expect.any(Number),
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

  it('should handle media request for TV shows with season selection', async () => {
    // Search for TV show
    const searchResponse = await request(app)
      .get('/api/v1/media/search')
      .query({ q: 'Breaking Bad' })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Mock TV show search result
    server.use(
      http.get(/^https?:\/\/[^\/]+\/api\/v1\/search$/, ({ request }) => {
        const url = new URL(request.url);
        const query = url.searchParams.get('query');

        if (query?.toLowerCase().includes('breaking bad')) {
          return HttpResponse.json({
            results: [
              {
                id: 1396,
                mediaType: 'tv',
                name: 'Breaking Bad',
                firstAirDate: '2008-01-20',
                overview: 'A high school chemistry teacher turned meth maker...',
                posterPath: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
                mediaInfo: {
                  status: 1,
                  requests: [],
                },
              },
            ],
            page: 1,
            totalPages: 1,
            totalResults: 1,
          });
        }

        return HttpResponse.json({ results: [], page: 1, totalPages: 0, totalResults: 0 });
      }),
    );

    // Request specific seasons
    const requestResponse = await request(app)
      .post('/api/v1/media/request')
      .send({
        mediaType: 'tv',
        mediaId: 1396,
        seasons: [1, 2, 3],
      })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(requestResponse.body).toMatchObject({
      mediaType: 'tv',
      mediaId: 1396,
      seasons: [1, 2, 3],
    });
  });

  it('should enforce rate limiting on media requests', async () => {
    // Create multiple requests quickly
    const requests = Array(10)
      .fill(null)
      .map((_, i) => ({
        mediaType: 'movie',
        mediaId: 1000 + i, // Different movies
      }));

    // Submit requests
    for (let i = 0; i < requests.length; i++) {
      const response = await request(app)
        .post('/api/v1/media/request')
        .send(requests[i])
        .set('Authorization', `Bearer ${authToken}`);

      if (i < 5) {
        expect(response.status).toBe(201); // First 5 should succeed
      } else {
        expect(response.status).toBe(429); // Rate limited
        expect(response.body.error).toContain('Too many requests');
        break;
      }
    }
  });

  it('should handle Overseerr service unavailability gracefully', async () => {
    // Disable Overseerr in configuration
    await prisma.serviceConfiguration.update({
      where: { service: 'overseerr' },
      data: { enabled: false },
    });

    const response = await request(app)
      .get('/api/v1/media/search')
      .query({ q: 'Test Movie' })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(503);

    expect(response.body.error).toContain('Search service is not available');

    // Re-enable for other tests
    await prisma.serviceConfiguration.update({
      where: { service: 'overseerr' },
      data: { enabled: true },
    });
  });

  it('should track request status updates via webhooks', async () => {
    // Create a media request
    const mediaRequest = await prisma.mediaRequest.create({
      data: {
        userId,
        externalId: 999,
        mediaType: 'movie',
        mediaId: 999,
        title: 'Test Movie',
        status: 'pending',
        requestedAt: new Date(),
      },
    });

    // Simulate Overseerr webhook for status update
    const webhookResponse = await request(app)
      .post('/api/v1/webhooks/overseerr')
      .send({
        notification_type: 'MEDIA_APPROVED',
        request: {
          id: 999,
          status: 4, // Approved in Overseerr
        },
        media: {
          tmdbId: 999,
          mediaType: 'movie',
          status: 3, // Processing
        },
      })
      .set('X-Overseerr-Signature', 'test-signature') // Would need proper signature in production
      .expect(200);

    // Verify request status was updated
    const updatedRequest = await prisma.mediaRequest.findUnique({
      where: { id: mediaRequest.id },
    });

    expect(updatedRequest?.status).toBe('approved');
  });

  it('should allow users to cancel their own pending requests', async () => {
    // Create a pending request
    const mediaRequest = await prisma.mediaRequest.create({
      data: {
        userId,
        externalId: 888,
        mediaType: 'movie',
        mediaId: 888,
        title: 'Cancellable Movie',
        status: 'pending',
        requestedAt: new Date(),
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

  it('should paginate request history correctly', async () => {
    // Create multiple requests
    const requestPromises = Array(25)
      .fill(null)
      .map((_, i) =>
        prisma.mediaRequest.create({
          data: {
            userId,
            externalId: 2000 + i,
            mediaType: i % 2 === 0 ? 'movie' : 'tv',
            mediaId: 2000 + i,
            title: `Test Media ${i}`,
            status: 'pending',
            requestedAt: new Date(Date.now() - i * 1000 * 60), // Stagger creation times
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
    expect(page1Response.body.total).toBeGreaterThanOrEqual(25);
    expect(page1Response.body.page).toBe(1);
    expect(page1Response.body.totalPages).toBeGreaterThanOrEqual(3);

    // Get second page
    const page2Response = await request(app)
      .get('/api/v1/media/requests')
      .query({ page: 2, limit: 10 })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(page2Response.body.requests).toHaveLength(10);
    expect(page2Response.body.page).toBe(2);

    // Verify different results
    const page1Ids = page1Response.body.requests.map((r: any) => r.id);
    const page2Ids = page2Response.body.requests.map((r: any) => r.id);
    const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
    expect(intersection).toHaveLength(0);
  });

  it('should properly filter requests by status and media type', async () => {
    // Create requests with different statuses
    await prisma.mediaRequest.createMany({
      data: [
        {
          userId,
          externalId: 3001,
          mediaType: 'movie',
          mediaId: 3001,
          title: 'Approved Movie',
          status: 'approved',
          requestedAt: new Date(),
        },
        {
          userId,
          externalId: 3002,
          mediaType: 'tv',
          mediaId: 3002,
          title: 'Failed TV Show',
          status: 'failed',
          requestedAt: new Date(),
        },
      ],
    });

    // Filter by status
    const approvedResponse = await request(app)
      .get('/api/v1/media/requests')
      .query({ status: 'approved' })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(approvedResponse.body.requests.every((r: any) => r.status === 'approved')).toBe(true);

    // Filter by media type
    const moviesResponse = await request(app)
      .get('/api/v1/media/requests')
      .query({ mediaType: 'movie' })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(moviesResponse.body.requests.every((r: any) => r.mediaType === 'movie')).toBe(true);
  });
});
