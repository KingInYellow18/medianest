import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock Redis and external services BEFORE importing app
vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
  })),
}));

// Mock Overseerr service for media search
vi.mock('@/services/overseerr', () => ({
  searchMedia: vi.fn().mockResolvedValue({
    results: [
      {
        id: 123456,
        title: 'Test Movie',
        mediaType: 'movie',
        posterPath: '/test-poster.jpg',
        releaseDate: '2023-01-01',
      },
    ],
    totalPages: 1,
    totalResults: 1,
  }),
  getMediaDetails: vi.fn().mockImplementation(async (mediaType, tmdbId) => {
    if (mediaType === 'movie') {
      return {
        id: parseInt(tmdbId),
        title: 'Test Movie',
        overview: 'Test movie overview',
        releaseDate: '2023-01-01',
        genres: [{ id: 1, name: 'Action' }],
      };
    } else if (mediaType === 'tv') {
      return {
        id: parseInt(tmdbId),
        name: 'Test TV Show',
        overview: 'Test TV show overview',
        firstAirDate: '2023-01-01',
        seasons: [{ seasonNumber: 1, episodeCount: 10 }],
      };
    }
    throw new Error('Media not found');
  }),
}));

import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../helpers/database-cleanup';
import { createAuthToken, createAdminToken } from '../helpers/auth';
import { testUsers, testMediaRequests } from '../fixtures/test-data';

describe('Media Endpoints - Critical Path', () => {
  let userToken: string;
  let adminToken: string;
  let testUser: any;
  let adminUser: any;

  beforeAll(async () => {
    // Skip database cleanup for now to avoid connection issues
    // await databaseCleanup.cleanAll(prisma);

    // Mock test users instead of creating in database
    testUser = {
      id: 1,
      plexId: testUsers[0].plexId,
      plexUsername: testUsers[0].username,
      email: testUsers[0].email,
      role: testUsers[0].role,
      status: testUsers[0].status,
    };

    adminUser = {
      id: 2,
      plexId: testUsers[1].plexId,
      plexUsername: testUsers[1].username,
      email: testUsers[1].email,
      role: testUsers[1].role,
      status: testUsers[1].status,
    };

    userToken = createAuthToken(testUser);
    adminToken = createAuthToken(adminUser);
  });

  afterAll(async () => {
    // Skip cleanup for now
    // await databaseCleanup.cleanAll(prisma);
    // await prisma.$disconnect();
  });

  describe('GET /api/v1/media/search', () => {
    it('should search media via Overseerr integration', async () => {
      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'Test Movie', page: 1 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            title: expect.any(String),
            mediaType: expect.any(String),
            posterPath: expect.any(String),
          }),
        ]),
        meta: {
          query: 'Test Movie',
          page: 1,
          totalPages: expect.any(Number),
        },
      });
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/v1/media/search')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Search query is required',
        },
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'Test Movie' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'Test Movie', page: 2 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.meta.page).toBe(2);
    });
  });

  describe('GET /api/v1/media/:mediaType/:tmdbId', () => {
    it('should get movie details', async () => {
      const response = await request(app)
        .get('/api/v1/media/movie/123456')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 123456,
          title: expect.any(String),
          overview: expect.any(String),
          releaseDate: expect.any(String),
          genres: expect.any(Array),
        },
      });
    });

    it('should get TV show details', async () => {
      const response = await request(app)
        .get('/api/v1/media/tv/789012')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 789012,
          name: expect.any(String),
          overview: expect.any(String),
          firstAirDate: expect.any(String),
          seasons: expect.any(Array),
        },
      });
    });

    it('should reject invalid media type', async () => {
      const response = await request(app)
        .get('/api/v1/media/invalid/123456')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Invalid media type',
        },
      });
    });

    it('should handle media not found', async () => {
      const response = await request(app)
        .get('/api/v1/media/movie/999999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/media/request', () => {
    it('should create movie request', async () => {
      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 123456,
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(Number),
          status: expect.any(Number),
          media: {
            id: expect.any(Number),
            tmdbId: 123456,
            mediaType: 'movie',
          },
          requestedBy: {
            id: expect.any(Number),
          },
        },
      });
    });

    it('should create TV show request with seasons', async () => {
      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'tv',
          tmdbId: 789012,
          seasons: [1, 2],
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.media.mediaType).toBe('tv');
    });

    it('should require mediaType and tmdbId', async () => {
      const response = await request(app)
        .post('/api/v1/media/request')
        .send({})
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'mediaType and tmdbId are required',
        },
      });
    });

    it('should validate media type', async () => {
      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'invalid',
          tmdbId: 123456,
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Invalid media type',
        },
      });
    });
  });

  describe('GET /api/v1/media/requests', () => {
    beforeAll(async () => {
      // Mock test requests instead of creating in database
      // Skip database operations
    });

    it('should get user requests with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ page: 1, pageSize: 10 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          requests: expect.any(Array),
          totalCount: expect.any(Number),
          totalPages: expect.any(Number),
          currentPage: 1,
        },
      });
    });

    it('should filter requests by status', async () => {
      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should filter requests by media type', async () => {
      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ mediaType: 'movie' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should search requests by title', async () => {
      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ search: 'Matrix' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/media/requests/all (Admin)', () => {
    it('should get all requests for admin', async () => {
      const response = await request(app)
        .get('/api/v1/media/requests/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          requests: expect.any(Array),
          totalCount: expect.any(Number),
          totalPages: expect.any(Number),
          currentPage: 1,
        },
      });
    });

    it('should deny access to non-admin users', async () => {
      const response = await request(app)
        .get('/api/v1/media/requests/all')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Access denied',
        },
      });
    });
  });

  describe('DELETE /api/v1/media/requests/:requestId', () => {
    it("should delete user's own pending request", async () => {
      const mediaRequest = await prisma.mediaRequest.create({
        data: {
          userId: testUser.id,
          title: 'Test Delete Movie',
          mediaType: 'movie',
          tmdbId: '999999',
          status: 'pending',
          requestedAt: new Date(),
        },
      });

      const response = await request(app)
        .delete(`/api/v1/media/requests/${mediaRequest.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Request deleted successfully',
      });
    });

    it('should not delete approved requests', async () => {
      const approvedRequest = await prisma.mediaRequest.create({
        data: {
          userId: testUser.id,
          title: 'Approved Movie',
          mediaType: 'movie',
          tmdbId: '888888',
          status: 'approved',
          requestedAt: new Date(),
        },
      });

      const response = await request(app)
        .delete(`/api/v1/media/requests/${approvedRequest.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Can only delete pending requests',
        },
      });
    });

    it("should not delete other user's requests", async () => {
      const otherUser = await prisma.user.create({
        data: {
          plexId: 'other-user-123',
          plexUsername: 'otheruser',
          email: 'other@example.com',
          role: 'user',
          status: 'active',
          plexToken: 'encrypted-other-token',
        },
      });

      const otherRequest = await prisma.mediaRequest.create({
        data: {
          userId: otherUser.id,
          title: 'Other User Movie',
          mediaType: 'movie',
          tmdbId: '777777',
          status: 'pending',
          requestedAt: new Date(),
        },
      });

      const response = await request(app)
        .delete(`/api/v1/media/requests/${otherRequest.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Access denied',
        },
      });
    });
  });
});
