import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../../helpers/database-cleanup';
import { createAuthToken, createAdminToken } from '../../helpers/auth';
import { testUsers } from '../../fixtures/test-data';

describe('Media Request Flow - Critical Path', () => {
  let userToken: string;
  let adminToken: string;
  let testUser: any;
  let adminUser: any;

  beforeAll(async () => {
    await databaseCleanup.cleanAll();

    // Create test users
    testUser = await prisma.user.create({
      data: {
        plexId: testUsers[0].plexId,
        plexUsername: testUsers[0].username,
        email: testUsers[0].email,
        role: testUsers[0].role,
        status: testUsers[0].status,
        plexToken: 'encrypted-token',
      },
    });

    adminUser = await prisma.user.create({
      data: {
        plexId: testUsers[1].plexId,
        plexUsername: testUsers[1].username,
        email: testUsers[1].email,
        role: testUsers[1].role,
        status: testUsers[1].status,
        plexToken: 'encrypted-admin-token',
      },
    });

    userToken = createAuthToken(testUser);
    adminToken = createAuthToken(adminUser);
  });

  afterAll(async () => {
    await databaseCleanup.cleanAll();
    await prisma.$disconnect();
  });

  describe('Media Request Creation via Overseerr', () => {
    it('should complete full media request workflow', async () => {
      // Step 1: Search for media
      const searchResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'Test Movie', page: 1 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(searchResponse.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            title: expect.any(String),
            mediaType: expect.any(String),
          }),
        ]),
        meta: {
          query: 'Test Movie',
          page: 1,
        },
      });

      const movieResult = searchResponse.body.data.find((item: any) => item.mediaType === 'movie');
      expect(movieResult).toBeDefined();

      // Step 2: Get detailed information about the movie
      const detailsResponse = await request(app)
        .get(`/api/v1/media/movie/${movieResult.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(detailsResponse.body).toMatchObject({
        success: true,
        data: {
          id: movieResult.id,
          title: expect.any(String),
          overview: expect.any(String),
          releaseDate: expect.any(String),
        },
      });

      // Step 3: Submit media request
      const requestResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: movieResult.id,
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(requestResponse.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(Number),
          status: expect.any(Number),
          media: {
            id: expect.any(Number),
            tmdbId: movieResult.id,
            mediaType: 'movie',
          },
          requestedBy: {
            id: expect.any(Number),
          },
        },
      });

      const requestId = requestResponse.body.data.id;

      // Step 4: Verify request appears in user's request history
      const historyResponse = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(historyResponse.body).toMatchObject({
        success: true,
        data: {
          requests: expect.arrayContaining([
            expect.objectContaining({
              id: requestId,
            }),
          ]),
        },
      });

      // Step 5: Admin can see request in admin panel
      const adminHistoryResponse = await request(app)
        .get('/api/v1/media/requests/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(adminHistoryResponse.body.success).toBe(true);
      const adminRequests = adminHistoryResponse.body.data.requests;
      const userRequest = adminRequests.find((req: any) => req.id === requestId);
      expect(userRequest).toBeDefined();
      expect(userRequest.requestedBy.id).toBe(testUser.id);
    });

    it('should handle TV show requests with seasons', async () => {
      // Search for TV show
      const searchResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'Test Show' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const tvResult = searchResponse.body.data.find((item: any) => item.mediaType === 'tv');
      expect(tvResult).toBeDefined();

      // Get TV show details
      const detailsResponse = await request(app)
        .get(`/api/v1/media/tv/${tvResult.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(detailsResponse.body.data).toHaveProperty('seasons');
      expect(detailsResponse.body.data.seasons).toBeInstanceOf(Array);

      // Request specific seasons
      const requestResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'tv',
          tmdbId: tvResult.id,
          seasons: [1, 2],
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(requestResponse.body.success).toBe(true);
      expect(requestResponse.body.data.media.mediaType).toBe('tv');
    });

    it('should prevent duplicate requests', async () => {
      const requestData = {
        mediaType: 'movie',
        tmdbId: 123456,
      };

      // First request should succeed
      const firstResponse = await request(app)
        .post('/api/v1/media/request')
        .send(requestData)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(firstResponse.body.success).toBe(true);

      // Second identical request should be handled gracefully
      const secondResponse = await request(app)
        .post('/api/v1/media/request')
        .send(requestData)
        .set('Authorization', `Bearer ${userToken}`);

      // Depending on implementation, this could be 409 (conflict) or 200 (already exists)
      expect([200, 409]).toContain(secondResponse.status);
    });

    it('should validate request data', async () => {
      // Missing required fields
      const response1 = await request(app)
        .post('/api/v1/media/request')
        .send({})
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response1.body).toMatchObject({
        success: false,
        error: {
          message: 'mediaType and tmdbId are required',
        },
      });

      // Invalid media type
      const response2 = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'invalid',
          tmdbId: 123456,
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response2.body).toMatchObject({
        success: false,
        error: {
          message: 'Invalid media type',
        },
      });
    });
  });

  describe('Media Request Status Tracking', () => {
    let testRequest: any;

    beforeAll(async () => {
      // Create a test request in the database
      testRequest = await prisma.mediaRequest.create({
        data: {
          userId: testUser.id,
          title: 'Status Test Movie',
          mediaType: 'movie',
          tmdbId: '999999',
          status: 'pending',
          requestedAt: new Date(),
        },
      });
    });

    it('should track request status changes', async () => {
      // Get initial status
      const initialResponse = await request(app)
        .get(`/api/v1/media/requests/${testRequest.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(initialResponse.body).toMatchObject({
        success: true,
        data: {
          id: testRequest.id,
          status: 'pending',
        },
      });

      // Admin updates status (simulating Overseerr webhook or manual update)
      await prisma.mediaRequest.update({
        where: { id: testRequest.id },
        data: { status: 'approved' },
      });

      // Get updated status
      const updatedResponse = await request(app)
        .get(`/api/v1/media/requests/${testRequest.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(updatedResponse.body.data.status).toBe('approved');
    });

    it('should filter requests by status', async () => {
      // Create requests with different statuses
      await prisma.mediaRequest.createMany({
        data: [
          {
            userId: testUser.id,
            title: 'Pending Movie',
            mediaType: 'movie',
            tmdbId: '111111',
            status: 'pending',
            requestedAt: new Date(),
          },
          {
            userId: testUser.id,
            title: 'Approved Movie',
            mediaType: 'movie',
            tmdbId: '222222',
            status: 'approved',
            requestedAt: new Date(),
          },
          {
            userId: testUser.id,
            title: 'Completed Movie',
            mediaType: 'movie',
            tmdbId: '333333',
            status: 'available',
            requestedAt: new Date(),
          },
        ],
      });

      // Filter by pending status
      const pendingResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(pendingResponse.body.success).toBe(true);
      const pendingRequests = pendingResponse.body.data.requests;
      pendingRequests.forEach((request: any) => {
        expect(request.status).toBe('pending');
      });

      // Filter by approved status
      const approvedResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ status: 'approved' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const approvedRequests = approvedResponse.body.data.requests;
      approvedRequests.forEach((request: any) => {
        expect(request.status).toBe('approved');
      });
    });

    it('should support request sorting and pagination', async () => {
      // Test sorting by date (newest first)
      const newestFirstResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ sortBy: 'date', sortOrder: 'desc', pageSize: 5 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(newestFirstResponse.body.success).toBe(true);
      const requests = newestFirstResponse.body.data.requests;

      // Verify sorting (assuming we have multiple requests)
      if (requests.length > 1) {
        for (let i = 0; i < requests.length - 1; i++) {
          const currentDate = new Date(requests[i].requestedAt);
          const nextDate = new Date(requests[i + 1].requestedAt);
          expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
        }
      }

      // Test pagination
      const paginatedResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ page: 1, pageSize: 2 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(paginatedResponse.body.data.requests).toHaveLength(
        Math.min(2, paginatedResponse.body.data.totalCount),
      );
      expect(paginatedResponse.body.data).toHaveProperty('totalPages');
      expect(paginatedResponse.body.data).toHaveProperty('currentPage', 1);
    });

    it('should search requests by title', async () => {
      const searchResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ search: 'Status Test' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      const foundRequests = searchResponse.body.data.requests;
      foundRequests.forEach((request: any) => {
        expect(request.title.toLowerCase()).toContain('status test');
      });
    });
  });

  describe('Request Management', () => {
    it('should allow users to delete their own pending requests', async () => {
      // Create a pending request
      const pendingRequest = await prisma.mediaRequest.create({
        data: {
          userId: testUser.id,
          title: 'Deletable Movie',
          mediaType: 'movie',
          tmdbId: '444444',
          status: 'pending',
          requestedAt: new Date(),
        },
      });

      const deleteResponse = await request(app)
        .delete(`/api/v1/media/requests/${pendingRequest.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(deleteResponse.body).toMatchObject({
        success: true,
        message: 'Request deleted successfully',
      });

      // Verify request is deleted
      const checkResponse = await request(app)
        .get(`/api/v1/media/requests/${pendingRequest.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(checkResponse.body.success).toBe(false);
    });

    it('should prevent deletion of approved/completed requests', async () => {
      const approvedRequest = await prisma.mediaRequest.create({
        data: {
          userId: testUser.id,
          title: 'Approved Movie',
          mediaType: 'movie',
          tmdbId: '555555',
          status: 'approved',
          requestedAt: new Date(),
        },
      });

      const deleteResponse = await request(app)
        .delete(`/api/v1/media/requests/${approvedRequest.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(deleteResponse.body).toMatchObject({
        success: false,
        error: {
          message: 'Can only delete pending requests',
        },
      });
    });

    it('should enforce user isolation for requests', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          plexId: 'other-user-isolation',
          plexUsername: 'otheruser',
          email: 'other@example.com',
          role: 'user',
          status: 'active',
          plexToken: 'encrypted-other-token',
        },
      });

      // Create request by other user
      const otherRequest = await prisma.mediaRequest.create({
        data: {
          userId: otherUser.id,
          title: 'Other User Movie',
          mediaType: 'movie',
          tmdbId: '666666',
          status: 'pending',
          requestedAt: new Date(),
        },
      });

      // Test user should not be able to access other user's request
      const accessResponse = await request(app)
        .get(`/api/v1/media/requests/${otherRequest.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(accessResponse.body).toMatchObject({
        success: false,
        error: {
          message: 'Access denied',
        },
      });

      // Test user should not be able to delete other user's request
      const deleteResponse = await request(app)
        .delete(`/api/v1/media/requests/${otherRequest.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(deleteResponse.body).toMatchObject({
        success: false,
        error: {
          message: 'Access denied',
        },
      });
    });

    it('should allow admin access to all requests', async () => {
      const adminAllResponse = await request(app)
        .get('/api/v1/media/requests/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(adminAllResponse.body.success).toBe(true);
      expect(adminAllResponse.body.data.requests).toBeInstanceOf(Array);

      // Admin should be able to access any specific request
      if (adminAllResponse.body.data.requests.length > 0) {
        const firstRequestId = adminAllResponse.body.data.requests[0].id;
        const specificResponse = await request(app)
          .get(`/api/v1/media/requests/${firstRequestId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(specificResponse.body.success).toBe(true);
      }
    });
  });
});
