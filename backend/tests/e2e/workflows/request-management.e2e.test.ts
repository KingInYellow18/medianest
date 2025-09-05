/**
 * E2E Tests: Request Management Workflows
 * 
 * Tests comprehensive request management functionality including:
 * - View request status and progress
 * - Filter requests by status, media type, date
 * - Sort requests by various criteria
 * - Paginate through request results
 * - Cancel/delete pending requests
 * - Track request lifecycle changes
 * - Handle concurrent request operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  setupE2EEnvironment,
  E2ETestContext,
  createTestRequests,
  createAdditionalTestUser,
  VisualRegression,
  ResponsiveTestHelper,
  PerformanceTestHelper,
  DataValidationHelper,
  ScenarioBuilder,
  viewports
} from '../utils/e2e-helpers';
import { 
  requestStatusValues,
  createMockRequest,
  RequestStatus
} from '../fixtures/media-data';
import { prisma } from '@/db/prisma';

describe('E2E: Request Management Workflows', () => {
  let context: E2ETestContext;
  let testRequests: any[];

  beforeAll(async () => {
    context = await setupE2EEnvironment();
    
    // Create diverse test requests for management testing
    testRequests = await createTestRequests(context.users.user.id, 15);
  });

  afterAll(async () => {
    await context.cleanup();
  });

  describe('Request Status Viewing and Tracking', () => {
    it('should display user requests with correct status information', async () => {
      const { app, users } = context;

      const response = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(DataValidationHelper.validateRequestListResponse(response)).toBe(true);

      const requestsData = response.body.data;
      expect(requestsData).toMatchObject({
        requests: expect.any(Array),
        totalCount: expect.any(Number),
        currentPage: expect.any(Number),
        totalPages: expect.any(Number),
        pageSize: expect.any(Number)
      });

      // Verify each request has required fields
      requestsData.requests.forEach((request: any) => {
        expect(request).toMatchObject({
          id: expect.any(Number),
          title: expect.any(String),
          mediaType: expect.stringMatching(/^(movie|tv)$/),
          status: expect.any(String),
          requestedAt: expect.any(String),
          updatedAt: expect.any(String)
        });

        // Status should be a valid status value
        expect(requestStatusValues).toContain(request.status as RequestStatus);
      });

      // Should show user's requests
      expect(requestsData.requests.length).toBeGreaterThan(0);
      expect(requestsData.totalCount).toBeGreaterThanOrEqual(testRequests.length);
    });

    it('should track request status changes over time', async () => {
      const { app, users } = context;

      // Create a new request to track
      const createResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 777001
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(201);

      const requestId = createResponse.body.data.id;
      
      // Get initial status
      const initialStatusResponse = await request(app)
        .get(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(initialStatusResponse.body.data.status).toBe('pending');

      // Simulate status change (would typically happen via webhook or admin action)
      await prisma.mediaRequest.update({
        where: { id: requestId },
        data: { status: 'approved' }
      });

      // Verify status update is reflected
      const updatedStatusResponse = await request(app)
        .get(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(updatedStatusResponse.body.data.status).toBe('approved');

      // Verify status history if available
      if (updatedStatusResponse.body.data.statusHistory) {
        expect(updatedStatusResponse.body.data.statusHistory).toContainEqual(
          expect.objectContaining({
            status: 'pending',
            timestamp: expect.any(String)
          })
        );
      }
    });

    it('should show detailed request information for individual requests', async () => {
      const { app, users } = context;

      if (testRequests.length > 0) {
        const testRequest = testRequests[0];

        const detailResponse = await request(app)
          .get(`/api/v1/media/requests/${testRequest.id}`)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(detailResponse.body.success).toBe(true);
        
        const requestDetail = detailResponse.body.data;
        expect(requestDetail).toMatchObject({
          id: testRequest.id,
          title: expect.any(String),
          mediaType: expect.stringMatching(/^(movie|tv)$/),
          tmdbId: expect.any(String),
          status: expect.any(String),
          requestedAt: expect.any(String),
          requestedBy: expect.objectContaining({
            id: users.user.id,
            plexUsername: expect.any(String)
          })
        });

        // For TV shows, should include season information if applicable
        if (requestDetail.mediaType === 'tv' && requestDetail.seasons) {
          expect(requestDetail.seasons).toBeInstanceOf(Array);
        }
      }
    });

    it('should handle request not found scenarios', async () => {
      const { app, users } = context;

      const nonExistentResponse = await request(app)
        .get('/api/v1/media/requests/999999999')
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(404);

      expect(nonExistentResponse.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringMatching(/not found/i)
        }
      });
    });
  });

  describe('Request Filtering and Searching', () => {
    it('should filter requests by status', async () => {
      const { app, users } = context;

      // Test each status filter
      for (const status of ['pending', 'approved', 'processing', 'available', 'declined']) {
        const response = await request(app)
          .get('/api/v1/media/requests')
          .query({ status, pageSize: 50 })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(DataValidationHelper.validateRequestListResponse(response)).toBe(true);

        // All returned requests should have the filtered status
        response.body.data.requests.forEach((request: any) => {
          expect(request.status).toBe(status);
        });

        // Should include metadata about the filter
        expect(response.body.meta.filters).toMatchObject({
          status
        });
      }
    });

    it('should filter requests by media type', async () => {
      const { app, users } = context;

      // Filter for movies
      const movieResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ mediaType: 'movie' })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      movieResponse.body.data.requests.forEach((request: any) => {
        expect(request.mediaType).toBe('movie');
      });

      // Filter for TV shows
      const tvResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ mediaType: 'tv' })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      tvResponse.body.data.requests.forEach((request: any) => {
        expect(request.mediaType).toBe('tv');
      });
    });

    it('should filter requests by date range', async () => {
      const { app, users } = context;

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const dateFilterResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ 
          startDate: oneWeekAgo.toISOString(),
          endDate: new Date().toISOString()
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(DataValidationHelper.validateRequestListResponse(dateFilterResponse)).toBe(true);

      // Verify all requests are within the date range
      dateFilterResponse.body.data.requests.forEach((request: any) => {
        const requestDate = new Date(request.requestedAt);
        expect(requestDate.getTime()).toBeGreaterThanOrEqual(oneWeekAgo.getTime());
        expect(requestDate.getTime()).toBeLessThanOrEqual(new Date().getTime());
      });
    });

    it('should search requests by title', async () => {
      const { app, users } = context;

      const searchTerm = 'Test Movie';
      const searchResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ search: searchTerm })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(DataValidationHelper.validateRequestListResponse(searchResponse)).toBe(true);

      // Results should contain the search term (case-insensitive)
      searchResponse.body.data.requests.forEach((request: any) => {
        expect(request.title.toLowerCase()).toContain(searchTerm.toLowerCase().split(' ')[0]);
      });
    });

    it('should combine multiple filters effectively', async () => {
      const { app, users } = context;

      const complexFilterResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({
          status: 'pending',
          mediaType: 'movie',
          sortBy: 'requestedAt',
          sortOrder: 'desc'
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(DataValidationHelper.validateRequestListResponse(complexFilterResponse)).toBe(true);

      const requests = complexFilterResponse.body.data.requests;
      
      // Verify all filters are applied
      requests.forEach((request: any) => {
        expect(request.status).toBe('pending');
        expect(request.mediaType).toBe('movie');
      });

      // Verify sorting (newest first)
      if (requests.length > 1) {
        for (let i = 0; i < requests.length - 1; i++) {
          const currentDate = new Date(requests[i].requestedAt);
          const nextDate = new Date(requests[i + 1].requestedAt);
          expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
        }
      }
    });
  });

  describe('Request Sorting and Pagination', () => {
    it('should sort requests by different criteria', async () => {
      const { app, users } = context;

      const sortCriteria = [
        { sortBy: 'requestedAt', sortOrder: 'desc' },
        { sortBy: 'requestedAt', sortOrder: 'asc' },
        { sortBy: 'title', sortOrder: 'asc' },
        { sortBy: 'status', sortOrder: 'asc' }
      ];

      for (const criteria of sortCriteria) {
        const response = await request(app)
          .get('/api/v1/media/requests')
          .query({ ...criteria, pageSize: 10 })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(DataValidationHelper.validateRequestListResponse(response)).toBe(true);

        const requests = response.body.data.requests;
        
        if (requests.length > 1) {
          for (let i = 0; i < requests.length - 1; i++) {
            const current = requests[i];
            const next = requests[i + 1];

            switch (criteria.sortBy) {
              case 'requestedAt':
                const currentDate = new Date(current.requestedAt);
                const nextDate = new Date(next.requestedAt);
                
                if (criteria.sortOrder === 'desc') {
                  expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
                } else {
                  expect(currentDate.getTime()).toBeLessThanOrEqual(nextDate.getTime());
                }
                break;

              case 'title':
                if (criteria.sortOrder === 'asc') {
                  expect(current.title.localeCompare(next.title)).toBeLessThanOrEqual(0);
                }
                break;

              case 'status':
                if (criteria.sortOrder === 'asc') {
                  expect(current.status.localeCompare(next.status)).toBeLessThanOrEqual(0);
                }
                break;
            }
          }
        }
      }
    });

    it('should paginate requests correctly', async () => {
      const { app, users } = context;

      const pageSize = 5;
      let currentPage = 1;
      let allRequestIds: number[] = [];
      let totalPages = 0;

      // Get first page
      const firstPageResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ page: currentPage, pageSize })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(DataValidationHelper.validateRequestListResponse(firstPageResponse)).toBe(true);

      const firstPageData = firstPageResponse.body.data;
      expect(firstPageData.currentPage).toBe(currentPage);
      expect(firstPageData.pageSize).toBe(pageSize);
      expect(firstPageData.requests.length).toBeLessThanOrEqual(pageSize);
      
      totalPages = firstPageData.totalPages;
      allRequestIds = firstPageData.requests.map((r: any) => r.id);

      // Get remaining pages if they exist
      for (currentPage = 2; currentPage <= Math.min(totalPages, 3); currentPage++) {
        const pageResponse = await request(app)
          .get('/api/v1/media/requests')
          .query({ page: currentPage, pageSize })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        expect(pageResponse.body.data.currentPage).toBe(currentPage);
        const pageRequestIds = pageResponse.body.data.requests.map((r: any) => r.id);
        
        // Verify no duplicate IDs across pages
        const duplicates = allRequestIds.filter(id => pageRequestIds.includes(id));
        expect(duplicates).toHaveLength(0);
        
        allRequestIds.push(...pageRequestIds);
      }

      // Verify total count consistency
      expect(allRequestIds.length).toBeLessThanOrEqual(firstPageData.totalCount);
    });

    it('should handle edge cases in pagination', async () => {
      const { app, users } = context;

      // Page 0 or negative page
      const invalidPageResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ page: 0 })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(invalidPageResponse.body.success).toBe(false);

      // Very large page number
      const largePageResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ page: 999999, pageSize: 10 })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      // Should return empty results or handle gracefully
      expect(largePageResponse.body.data.requests).toHaveLength(0);

      // Very large page size
      const largePageSizeResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ page: 1, pageSize: 1000 })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      // Should cap page size to reasonable limit
      expect(largePageSizeResponse.body.data.requests.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Request Cancellation and Deletion', () => {
    it('should allow users to cancel pending requests', async () => {
      const { app, users } = context;

      // Create a new pending request
      const createResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 777002
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(201);

      const requestId = createResponse.body.data.id;

      // Cancel the request
      const cancelResponse = await request(app)
        .delete(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(cancelResponse.body).toMatchObject({
        success: true,
        message: expect.stringMatching(/deleted|cancelled/i)
      });

      // Verify request is no longer accessible
      const verifyResponse = await request(app)
        .get(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(404);

      expect(verifyResponse.body.success).toBe(false);
    });

    it('should prevent deletion of non-pending requests', async () => {
      const { app, users } = context;

      // Find an approved request from test data
      const approvedRequest = testRequests.find(r => r.status === 'approved');
      
      if (approvedRequest) {
        const deleteResponse = await request(app)
          .delete(`/api/v1/media/requests/${approvedRequest.id}`)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(400);

        expect(deleteResponse.body).toMatchObject({
          success: false,
          error: {
            message: expect.stringMatching(/cannot.*delete|only.*pending/i)
          }
        });
      } else {
        // Create and update a request to approved status
        const createResponse = await request(app)
          .post('/api/v1/media/request')
          .send({
            mediaType: 'movie',
            tmdbId: 777003
          })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(201);

        const requestId = createResponse.body.data.id;

        // Update to approved status
        await prisma.mediaRequest.update({
          where: { id: requestId },
          data: { status: 'approved' }
        });

        // Try to delete approved request
        const deleteResponse = await request(app)
          .delete(`/api/v1/media/requests/${requestId}`)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(400);

        expect(deleteResponse.body.success).toBe(false);
      }
    });

    it('should prevent users from deleting other users requests', async () => {
      const { app, users } = context;
      
      // Create second user
      const secondUser = await createAdditionalTestUser(context);

      // Create request with second user
      const createResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 777004
        })
        .set('Authorization', `Bearer ${secondUser.token}`)
        .expect(201);

      const requestId = createResponse.body.data.id;

      // Try to delete with first user
      const deleteResponse = await request(app)
        .delete(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(403);

      expect(deleteResponse.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringMatching(/access denied|forbidden/i)
        }
      });

      // Verify request still exists for the owner
      const verifyResponse = await request(app)
        .get(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${secondUser.token}`)
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
    });

    it('should handle bulk request operations', async () => {
      const { app, users } = context;

      // Create multiple pending requests
      const requests = [];
      for (let i = 0; i < 3; i++) {
        const createResponse = await request(app)
          .post('/api/v1/media/request')
          .send({
            mediaType: 'movie',
            tmdbId: 777100 + i
          })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(201);
        
        requests.push(createResponse.body.data);
      }

      // If bulk deletion is supported
      const bulkDeleteResponse = await request(app)
        .post('/api/v1/media/requests/bulk-delete')
        .send({
          requestIds: requests.map(r => r.id)
        })
        .set('Authorization', `Bearer ${users.user.token}`);

      // Should either support bulk deletion or return appropriate error
      expect([200, 404, 501]).toContain(bulkDeleteResponse.status);
      
      if (bulkDeleteResponse.status === 200) {
        expect(bulkDeleteResponse.body.success).toBe(true);
        
        // Verify all requests are deleted
        for (const request of requests) {
          const verifyResponse = await request(app)
            .get(`/api/v1/media/requests/${request.id}`)
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(404);
        }
      }
    });
  });

  describe('Performance and Responsiveness', () => {
    it('should load request list efficiently', async () => {
      const { app, users } = context;

      const performanceTest = async () => {
        return request(app)
          .get('/api/v1/media/requests')
          .query({ pageSize: 20 })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);
      };

      const result = await PerformanceTestHelper.measureResponseTime(performanceTest);
      
      // Request list should load within 1 second
      expect(result.duration).toBeLessThan(1000);
      expect(DataValidationHelper.validateRequestListResponse(result.response)).toBe(true);
    });

    it('should handle concurrent request operations', async () => {
      const { app, users } = context;

      // Create requests concurrently
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/v1/media/request')
          .send({
            mediaType: 'movie',
            tmdbId: 777200 + i
          })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(201)
      );

      const createdRequests = await Promise.all(createPromises);

      // Read requests concurrently
      const readPromises = createdRequests.map(response =>
        request(app)
          .get(`/api/v1/media/requests/${response.body.data.id}`)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200)
      );

      const readResponses = await Promise.all(readPromises);

      // Verify all reads were successful
      readResponses.forEach((response, index) => {
        expect(response.body.data.id).toBe(createdRequests[index].body.data.id);
      });

      // Delete requests concurrently
      const deletePromises = createdRequests.map(response =>
        request(app)
          .delete(`/api/v1/media/requests/${response.body.data.id}`)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200)
      );

      await Promise.all(deletePromises);
    });

    it('should adapt to different viewport sizes', async () => {
      const { app, users } = context;

      const testForViewport = async (viewport: any) => {
        const pageSize = viewport.name === 'mobile' ? 10 : 25;
        
        return request(app)
          .get('/api/v1/media/requests')
          .query({ pageSize })
          .set('Authorization', `Bearer ${users.user.token}`)
          .set('User-Agent', viewport.userAgent || '')
          .expect(200);
      };

      const results = await ResponsiveTestHelper.testAcrossViewports(testForViewport);

      // Verify appropriate page sizes for different viewports
      Object.entries(results).forEach(([viewportName, response]) => {
        expect(ResponsiveTestHelper.validateResponseForViewport(response, 
          viewports.find(v => v.name === viewportName)!)).toBe(true);
      });
    });
  });

  describe('Visual Regression Testing', () => {
    it('should maintain consistent request list structure', async () => {
      const { app, users } = context;

      const response = await request(app)
        .get('/api/v1/media/requests')
        .query({ pageSize: 10 })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      const visualResult = await VisualRegression.compareResponse(response, {
        name: 'request-list-structure',
        threshold: 0.95
      });

      expect(visualResult.match).toBe(true);
    });

    it('should maintain consistent request detail structure', async () => {
      const { app, users } = context;

      if (testRequests.length > 0) {
        const response = await request(app)
          .get(`/api/v1/media/requests/${testRequests[0].id}`)
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);

        const visualResult = await VisualRegression.compareResponse(response, {
          name: 'request-detail-structure',
          threshold: 0.90
        });

        expect(visualResult.match).toBe(true);
      }
    });
  });

  describe('Complex Request Management Scenarios', () => {
    it('should execute complete request lifecycle workflow', async () => {
      const { app, users } = context;

      const lifecycle = new ScenarioBuilder()
        .step('createRequest', async () => {
          return request(app)
            .post('/api/v1/media/request')
            .send({
              mediaType: 'tv',
              tmdbId: 888001,
              seasons: [1, 2, 3]
            })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(201);
        })
        .step('verifyPendingStatus', async (context) => {
          const requestId = context.createRequest.body.data.id;
          
          const response = await request(app)
            .get(`/api/v1/media/requests/${requestId}`)
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);

          expect(response.body.data.status).toBe('pending');
          return { requestId, status: 'pending' };
        })
        .step('simulateApproval', async (context) => {
          // Simulate external approval process
          await prisma.mediaRequest.update({
            where: { id: context.verifyPendingStatus.requestId },
            data: { status: 'approved' }
          });
          
          return { statusChanged: true };
        })
        .step('verifyApprovedStatus', async (context) => {
          const response = await request(app)
            .get(`/api/v1/media/requests/${context.verifyPendingStatus.requestId}`)
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);

          expect(response.body.data.status).toBe('approved');
          return { lifecycleCompleted: true };
        });

      const result = await lifecycle.execute();
      expect(result.verifyApprovedStatus.lifecycleCompleted).toBe(true);
    });

    it('should handle complex filtering and sorting combinations', async () => {
      const { app, users } = context;

      const complexQuery = {
        status: 'pending',
        mediaType: 'movie',
        sortBy: 'requestedAt',
        sortOrder: 'desc',
        search: 'Test',
        page: 1,
        pageSize: 15
      };

      const response = await request(app)
        .get('/api/v1/media/requests')
        .query(complexQuery)
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(DataValidationHelper.validateRequestListResponse(response)).toBe(true);

      // Verify all filters are applied
      const requests = response.body.data.requests;
      requests.forEach((request: any) => {
        expect(request.status).toBe('pending');
        expect(request.mediaType).toBe('movie');
        expect(request.title.toLowerCase()).toContain('test');
      });

      // Verify sorting
      if (requests.length > 1) {
        for (let i = 0; i < requests.length - 1; i++) {
          const currentDate = new Date(requests[i].requestedAt);
          const nextDate = new Date(requests[i + 1].requestedAt);
          expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
        }
      }
    });

    it('should handle edge cases in request management', async () => {
      const { app, users } = context;

      // Test malformed query parameters
      const malformedResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ 
          page: 'invalid',
          pageSize: 'not-a-number',
          sortOrder: 'invalid-order'
        })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(malformedResponse.body.success).toBe(false);

      // Test very long search terms
      const longSearchResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ search: 'a'.repeat(1000) })
        .set('Authorization', `Bearer ${users.user.token}`);

      expect([200, 400]).toContain(longSearchResponse.status);

      // Test special characters in search
      const specialCharsResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ search: '!@#$%^&*()' })
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(200);

      expect(DataValidationHelper.validateRequestListResponse(specialCharsResponse)).toBe(true);
    });
  });
});