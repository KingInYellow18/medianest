import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { server, http, HttpResponse } from '../msw/setup';
import { generateToken } from '@/utils/jwt.util';
import prisma from '@/config/database';
import { redisClient } from '@/config/redis';

// Mock Redis and Prisma
vi.mock('@/config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    eval: vi.fn(),
  },
}));

vi.mock('@/config/database', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    userSession: {
      findFirst: vi.fn(),
    },
    mediaRequest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    serviceConfig: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Media Endpoints', () => {
  let authToken: string;
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    authToken = generateToken({ id: 'user-1', role: 'USER' });
    adminToken = generateToken({ id: 'admin-1', role: 'ADMIN' });

    // Default auth setup for regular user
    (prisma.userSession.findFirst as any).mockImplementation(({ where }) => {
      if (where.token === authToken) {
        return Promise.resolve({
          id: 'session-1',
          userId: 'user-1',
          token: authToken,
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
          user: {
            id: 'user-1',
            email: 'test@example.com',
            username: 'testuser',
            displayName: 'Test User',
            role: 'USER',
            isActive: true,
            plexToken: 'encrypted:token:data',
          },
        });
      }
      if (where.token === adminToken) {
        return Promise.resolve({
          id: 'session-2',
          userId: 'admin-1',
          token: adminToken,
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            username: 'admin',
            displayName: 'Admin User',
            role: 'ADMIN',
            isActive: true,
            plexToken: 'encrypted:admin:token',
          },
        });
      }
      return null;
    });

    // Mock service config
    (prisma.serviceConfig.findUnique as any).mockResolvedValue({
      id: 'overseerr-config',
      service: 'OVERSEERR',
      url: 'https://overseerr.example.com',
      apiKey: 'encrypted:api:key',
      isActive: true,
    });
  });

  describe('GET /api/v1/media/search', () => {
    it('should search for media successfully', async () => {
      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test', page: 1 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          page: 1,
          totalPages: 1,
          totalResults: 2,
          results: expect.arrayContaining([
            expect.objectContaining({
              id: 123456,
              mediaType: 'movie',
              title: 'Test Movie',
            }),
            expect.objectContaining({
              id: 789012,
              mediaType: 'tv',
              name: 'Test Show',
            }),
          ]),
        },
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test' })
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should validate query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/media/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('query'),
        },
      });
    });

    it('should handle Overseerr service errors', async () => {
      server.use(
        http.get('*/api/v1/search/multi', () => {
          return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
        }),
      );

      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(503);

      expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should handle missing Overseerr configuration', async () => {
      (prisma.serviceConfig.findUnique as any).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(503);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Overseerr service not configured',
        },
      });
    });
  });

  describe('GET /api/v1/media/movie/:id', () => {
    it('should get movie details successfully', async () => {
      const response = await request(app)
        .get('/api/v1/media/movie/123456')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 123456,
          title: 'Test Movie',
          overview: 'A test movie overview',
          releaseDate: '2023-01-01',
          voteAverage: 8.5,
          mediaInfo: {
            status: 1, // AVAILABLE
          },
        },
      });
    });

    it('should handle non-existent movie', async () => {
      const response = await request(app)
        .get('/api/v1/media/movie/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Movie not found',
        },
      });
    });

    it('should validate movie ID', async () => {
      const response = await request(app)
        .get('/api/v1/media/movie/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/media/tv/:id', () => {
    it('should get TV show details successfully', async () => {
      const response = await request(app)
        .get('/api/v1/media/tv/789012')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 789012,
          name: 'Test Show',
          overview: 'A test TV show overview',
          firstAirDate: '2023-01-01',
          voteAverage: 9.0,
          numberOfSeasons: 1,
          mediaInfo: {
            status: 2, // PARTIALLY_AVAILABLE
          },
        },
      });
    });
  });

  describe('POST /api/v1/media/request', () => {
    beforeEach(() => {
      // Mock rate limiter to allow requests
      (redisClient.eval as any).mockResolvedValue([1, 5, 4, 3600]);
    });

    it('should create a media request successfully', async () => {
      (prisma.mediaRequest.count as any).mockResolvedValue(0);
      (prisma.mediaRequest.create as any).mockResolvedValue({
        id: 'request-1',
        userId: 'user-1',
        mediaType: 'movie',
        mediaId: 123456,
        title: 'Test Movie',
        status: 'PENDING',
        overseerrRequestId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          mediaId: 123456,
          is4k: false,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'request-1',
          mediaType: 'movie',
          mediaId: 123456,
          status: 'PENDING',
        },
      });

      expect(prisma.mediaRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          mediaType: 'movie',
          mediaId: 123456,
          overseerrRequestId: 1,
        }),
      });
    });

    it('should handle TV show requests with seasons', async () => {
      (prisma.mediaRequest.count as any).mockResolvedValue(0);
      (prisma.mediaRequest.create as any).mockResolvedValue({
        id: 'request-2',
        userId: 'user-1',
        mediaType: 'tv',
        mediaId: 789012,
        title: 'Test Show',
        status: 'PENDING',
        overseerrRequestId: 2,
        seasons: [1],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'tv',
          mediaId: 789012,
          seasons: [1],
          is4k: false,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.data.seasons).toEqual([1]);
    });

    it('should enforce request rate limits', async () => {
      // Mock rate limiter to return limit exceeded
      (redisClient.eval as any).mockResolvedValue([0, 5, 5, 3599]);

      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          mediaId: 123456,
          is4k: false,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(429);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Request limit exceeded. Maximum 5 requests per hour.',
        },
      });
    });

    it('should prevent duplicate requests', async () => {
      (prisma.mediaRequest.count as any).mockResolvedValue(1);

      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          mediaId: 123456,
          is4k: false,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'You have already requested this media',
        },
      });
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'invalid',
          mediaId: 'not-a-number',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle Overseerr API errors', async () => {
      (prisma.mediaRequest.count as any).mockResolvedValue(0);

      server.use(
        http.post('*/api/v1/request', () => {
          return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
        }),
      );

      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          mediaId: 123456,
          is4k: false,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error.message).toContain('Failed to create media request');
    });
  });

  describe('GET /api/v1/media/requests', () => {
    it('should get user requests successfully', async () => {
      (prisma.mediaRequest.findMany as any).mockResolvedValue([
        {
          id: 'request-1',
          userId: 'user-1',
          mediaType: 'movie',
          mediaId: 123456,
          title: 'Test Movie',
          status: 'APPROVED',
          overseerrRequestId: 1,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-02'),
        },
        {
          id: 'request-2',
          userId: 'user-1',
          mediaType: 'tv',
          mediaId: 789012,
          title: 'Test Show',
          status: 'PENDING',
          overseerrRequestId: 2,
          seasons: [1],
          createdAt: new Date('2023-01-03'),
          updatedAt: new Date('2023-01-03'),
        },
      ]);
      (prisma.mediaRequest.count as any).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          requests: expect.arrayContaining([
            expect.objectContaining({
              id: 'request-1',
              mediaType: 'movie',
              status: 'APPROVED',
            }),
            expect.objectContaining({
              id: 'request-2',
              mediaType: 'tv',
              status: 'PENDING',
            }),
          ]),
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
          },
        },
      });
    });

    it('should filter by status', async () => {
      (prisma.mediaRequest.findMany as any).mockResolvedValue([
        {
          id: 'request-1',
          userId: 'user-1',
          mediaType: 'movie',
          mediaId: 123456,
          title: 'Test Movie',
          status: 'PENDING',
          overseerrRequestId: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      (prisma.mediaRequest.count as any).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ status: 'PENDING' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.requests).toHaveLength(1);
      expect(response.body.data.requests[0].status).toBe('PENDING');

      expect(prisma.mediaRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            status: 'PENDING',
          },
        }),
      );
    });

    it('should allow admins to see all requests', async () => {
      (prisma.mediaRequest.findMany as any).mockResolvedValue([
        {
          id: 'request-1',
          userId: 'user-1',
          mediaType: 'movie',
          mediaId: 123456,
          title: 'Test Movie',
          status: 'PENDING',
          user: {
            username: 'testuser',
            email: 'test@example.com',
          },
        },
        {
          id: 'request-2',
          userId: 'user-2',
          mediaType: 'tv',
          mediaId: 789012,
          title: 'Test Show',
          status: 'APPROVED',
          user: {
            username: 'otheruser',
            email: 'other@example.com',
          },
        },
      ]);
      (prisma.mediaRequest.count as any).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ all: true })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.requests).toHaveLength(2);
      expect(prisma.mediaRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {}, // No user filter for admins
          include: { user: true },
        }),
      );
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ page: 0, limit: 1000 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/media/requests/:id', () => {
    it('should get request details successfully', async () => {
      (prisma.mediaRequest.findUnique as any).mockResolvedValue({
        id: 'request-1',
        userId: 'user-1',
        mediaType: 'movie',
        mediaId: 123456,
        title: 'Test Movie',
        status: 'APPROVED',
        overseerrRequestId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .get('/api/v1/media/requests/request-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'request-1',
          mediaType: 'movie',
          status: 'APPROVED',
        },
      });
    });

    it('should prevent access to other users requests', async () => {
      (prisma.mediaRequest.findUnique as any).mockResolvedValue({
        id: 'request-1',
        userId: 'other-user',
        mediaType: 'movie',
        mediaId: 123456,
        title: 'Test Movie',
        status: 'APPROVED',
      });

      const response = await request(app)
        .get('/api/v1/media/requests/request-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied',
        },
      });
    });

    it('should allow admins to access any request', async () => {
      (prisma.mediaRequest.findUnique as any).mockResolvedValue({
        id: 'request-1',
        userId: 'other-user',
        mediaType: 'movie',
        mediaId: 123456,
        title: 'Test Movie',
        status: 'APPROVED',
        user: {
          username: 'otheruser',
          email: 'other@example.com',
        },
      });

      const response = await request(app)
        .get('/api/v1/media/requests/request-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.id).toBe('request-1');
    });

    it('should handle non-existent request', async () => {
      (prisma.mediaRequest.findUnique as any).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/media/requests/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/media/requests/:id', () => {
    it('should allow users to cancel their pending requests', async () => {
      (prisma.mediaRequest.findUnique as any).mockResolvedValue({
        id: 'request-1',
        userId: 'user-1',
        mediaType: 'movie',
        mediaId: 123456,
        status: 'PENDING',
        overseerrRequestId: 1,
      });
      (prisma.mediaRequest.update as any).mockResolvedValue({
        id: 'request-1',
        status: 'CANCELLED',
      });

      const response = await request(app)
        .delete('/api/v1/media/requests/request-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Request cancelled successfully',
        },
      });
    });

    it('should prevent cancelling approved requests', async () => {
      (prisma.mediaRequest.findUnique as any).mockResolvedValue({
        id: 'request-1',
        userId: 'user-1',
        status: 'APPROVED',
      });

      const response = await request(app)
        .delete('/api/v1/media/requests/request-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Cannot cancel request in current status',
        },
      });
    });
  });
});
