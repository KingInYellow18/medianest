/**
 * MediaNest E2E Test Suite - Media Request Workflows
 *
 * Comprehensive end-to-end testing for all media request workflows in MediaNest.
 * This test suite covers the complete user journey from search to request fulfillment.
 *
 * Test Coverage:
 * - Search and Browse Media
 * - Request Creation and Validation
 * - Request Management and Status Tracking
 * - Plex Integration and Library Browsing
 * - User Isolation and Security
 * - Admin Workflows and Management
 * - Visual Regression Testing
 * - Responsive Behavior Testing
 * - Performance and Load Testing
 *
 * Usage:
 *   npm run test tests/e2e/media-request.spec.ts
 *   npm run test:e2e
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import {
  setupE2EEnvironment,
  E2ETestContext,
  createAdditionalTestUser,
  VisualRegression,
  ResponsiveTestHelper,
  PerformanceTestHelper,
  DataValidationHelper,
  ScenarioBuilder,
  viewports,
} from './utils/e2e-helpers';

describe('MediaNest E2E Test Suite - Media Request Workflows', () => {
  let context: E2ETestContext;

  beforeAll(async () => {
    console.log('🚀 Setting up MediaNest E2E Test Environment...');
    context = await setupE2EEnvironment();
    console.log('✅ E2E Test Environment Ready');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up E2E Test Environment...');
    await context.cleanup();
    console.log('✅ E2E Test Environment Cleaned');
  });

  describe('🎬 Complete Media Request User Journey', () => {
    it('should execute end-to-end media request workflow', async () => {
      const { app, users } = context;

      console.log('🎯 Starting complete E2E workflow test...');

      const completeWorkflow = new ScenarioBuilder()
        .step('userAuthentication', async () => {
          console.log('🔐 Testing user authentication...');

          const authResponse = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);

          expect(authResponse.body).toMatchObject({
            success: true,
            data: expect.objectContaining({
              id: users.user.id,
              plexUsername: users.user.plexUsername,
              role: 'user',
            }),
          });

          return { authenticated: true };
        })
        .step('searchMedia', async () => {
          console.log('🔍 Testing media search...');

          return request(app)
            .get('/api/v1/media/search')
            .query({ query: 'action movie', mediaType: 'movie', page: 1 })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);
        })
        .step('viewMediaDetails', async (context) => {
          console.log('📋 Testing media details view...');

          const searchResults = context.searchMedia.body.data;
          expect(searchResults.length).toBeGreaterThan(0);

          const firstMovie = searchResults[0];
          expect(firstMovie.mediaType).toBe('movie');

          return request(app)
            .get(`/api/v1/media/movie/${firstMovie.id}`)
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);
        })
        .step('createRequest', async (context) => {
          console.log('📝 Testing request creation...');

          const selectedMovie = context.searchMedia.body.data[0];

          return request(app)
            .post('/api/v1/media/request')
            .send({
              mediaType: 'movie',
              tmdbId: selectedMovie.id,
              quality: 'HD',
              notes: 'E2E test request',
            })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(201);
        })
        .step('verifyRequestInHistory', async (context) => {
          console.log('📚 Testing request history...');

          const createdRequest = context.createRequest.body.data;

          const historyResponse = await request(app)
            .get('/api/v1/media/requests')
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);

          expect(DataValidationHelper.validateRequestListResponse(historyResponse)).toBe(true);

          const userRequests = historyResponse.body.data.requests;
          const foundRequest = userRequests.find((req: any) => req.id === createdRequest.id);

          expect(foundRequest).toBeDefined();
          expect(foundRequest.media.tmdbId).toBe(context.searchMedia.body.data[0].id);

          return { requestId: createdRequest.id };
        })
        .step('adminApproval', async (context) => {
          console.log('👨‍💼 Testing admin approval workflow...');

          const requestId = context.verifyRequestInHistory.requestId;

          // Admin views all requests
          const allRequestsResponse = await request(app)
            .get('/api/v1/media/requests/all')
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);

          const adminRequests = allRequestsResponse.body.data.requests;
          const targetRequest = adminRequests.find((req: any) => req.id === requestId);
          expect(targetRequest).toBeDefined();

          // Admin approves the request
          const approvalResponse = await request(app)
            .put(`/api/v1/admin/requests/${requestId}/approve`)
            .send({
              notes: 'Approved via E2E test workflow',
              priority: 'normal',
            })
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);

          expect(approvalResponse.body.data.status).toBe('approved');

          return { approved: true };
        })
        .step('userSeesStatusUpdate', async (context) => {
          console.log('🔄 Testing status update visibility...');

          const requestId = context.verifyRequestInHistory.requestId;

          const statusResponse = await request(app)
            .get(`/api/v1/media/requests/${requestId}`)
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);

          expect(statusResponse.body.data.status).toBe('approved');
          expect(statusResponse.body.data.approvedBy).toBe(users.admin.id);

          return { workflowComplete: true };
        });

      const result = await completeWorkflow.execute();

      expect(result.userAuthentication.authenticated).toBe(true);
      expect(result.adminApproval.approved).toBe(true);
      expect(result.userSeesStatusUpdate.workflowComplete).toBe(true);

      console.log('✅ Complete E2E workflow test passed');
    });
  });

  describe('🔒 Security and Isolation Testing', () => {
    it('should maintain complete user data isolation', async () => {
      const { app } = context;

      console.log('🛡️ Testing comprehensive user isolation...');

      // Create additional users for isolation testing
      const user2 = await createAdditionalTestUser(context);

      // Both users create requests
      const user1RequestResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 100001,
        })
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(201);

      const user2RequestResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'tv',
          tmdbId: 200001,
          seasons: [1],
        })
        .set('Authorization', `Bearer ${user2.token}`)
        .expect(201);

      // Verify complete isolation
      const isolationTests = [
        {
          name: 'User 1 cannot see User 2 requests',
          test: async () => {
            const response = await request(app)
              .get(`/api/v1/media/requests/${user2RequestResponse.body.data.id}`)
              .set('Authorization', `Bearer ${context.users.user.token}`)
              .expect(403);
            return response.body.success === false;
          },
        },
        {
          name: 'User 2 cannot see User 1 requests',
          test: async () => {
            const response = await request(app)
              .get(`/api/v1/media/requests/${user1RequestResponse.body.data.id}`)
              .set('Authorization', `Bearer ${user2.token}`)
              .expect(403);
            return response.body.success === false;
          },
        },
        {
          name: 'User request lists are isolated',
          test: async () => {
            const user1List = await request(app)
              .get('/api/v1/media/requests')
              .set('Authorization', `Bearer ${context.users.user.token}`)
              .expect(200);

            const user2List = await request(app)
              .get('/api/v1/media/requests')
              .set('Authorization', `Bearer ${user2.token}`)
              .expect(200);

            const user1RequestIds = user1List.body.data.requests.map((r: any) => r.id);
            const user2RequestIds = user2List.body.data.requests.map((r: any) => r.id);

            const overlap = user1RequestIds.filter((id: number) => user2RequestIds.includes(id));
            return overlap.length === 0;
          },
        },
      ];

      for (const test of isolationTests) {
        const passed = await test.test();
        expect(passed).toBe(true);
        console.log(`  ✅ ${test.name}`);
      }

      console.log('✅ User isolation tests completed');
    });
  });

  describe('📱 Responsive and Visual Testing', () => {
    it('should work consistently across different viewport sizes', async () => {
      const { app, users } = context;

      console.log('📱 Testing responsive behavior...');

      const testResponsiveSearch = async (viewport: any) => {
        const pageSize = viewport.name === 'mobile' ? 5 : 20;

        return request(app)
          .get('/api/v1/media/search')
          .query({
            query: 'popular',
            pageSize,
            page: 1,
          })
          .set('Authorization', `Bearer ${users.user.token}`)
          .set('User-Agent', viewport.userAgent || '')
          .expect(200);
      };

      const results = await ResponsiveTestHelper.testAcrossViewports(testResponsiveSearch);

      // Verify all viewports work
      Object.entries(results).forEach(([viewportName, response]) => {
        expect(response.body.success).toBe(true);
        expect(DataValidationHelper.validateMediaSearchResponse(response)).toBe(true);

        const pageSize = response.body.meta.pageSize || response.body.data.length;
        if (viewportName === 'mobile') {
          expect(pageSize).toBeLessThanOrEqual(10);
        }

        console.log(`  ✅ ${viewportName}: ${pageSize} items per page`);
      });

      console.log('✅ Responsive behavior tests completed');
    });

    it('should maintain consistent API response structures', async () => {
      const { app, users } = context;

      console.log('🎨 Testing visual regression (API structure)...');

      const testEndpoints = [
        {
          name: 'media-search',
          test: () =>
            request(app)
              .get('/api/v1/media/search')
              .query({ query: 'test', page: 1 })
              .set('Authorization', `Bearer ${users.user.token}`)
              .expect(200),
        },
        {
          name: 'user-requests',
          test: () =>
            request(app)
              .get('/api/v1/media/requests')
              .query({ pageSize: 10 })
              .set('Authorization', `Bearer ${users.user.token}`)
              .expect(200),
        },
        {
          name: 'admin-dashboard',
          test: () =>
            request(app)
              .get('/api/v1/admin/dashboard/stats')
              .set('Authorization', `Bearer ${users.admin.token}`)
              .expect(200),
        },
      ];

      for (const endpoint of testEndpoints) {
        const response = await endpoint.test();

        const visualResult = await VisualRegression.compareResponse(response, {
          name: endpoint.name,
          threshold: 0.9,
        });

        expect(visualResult.match).toBe(true);
        console.log(`  ✅ ${endpoint.name}: Structure consistent`);
      }

      console.log('✅ Visual regression tests completed');
    });
  });

  describe('⚡ Performance and Load Testing', () => {
    it('should handle concurrent operations efficiently', async () => {
      const { app, users } = context;

      console.log('⚡ Testing performance under load...');

      // Test concurrent searches
      const searchLoad = async () => {
        const concurrentSearches = Array.from({ length: 10 }, (_, i) =>
          request(app)
            .get('/api/v1/media/search')
            .query({ query: `test${i}`, page: 1 })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200),
        );

        const results = await Promise.all(concurrentSearches);

        results.forEach((result) => {
          expect(result.body.success).toBe(true);
          expect(DataValidationHelper.validateMediaSearchResponse(result)).toBe(true);
        });

        return results.length;
      };

      const loadResult = await PerformanceTestHelper.measureResponseTime(searchLoad);

      expect(loadResult.duration).toBeLessThan(5000); // 5 seconds for 10 concurrent requests
      expect(loadResult.response).toBe(10); // All requests completed

      console.log(`  ✅ 10 concurrent searches completed in ${loadResult.duration}ms`);

      // Test request creation performance
      const requestCreationTest = async () => {
        return request(app)
          .post('/api/v1/media/request')
          .send({
            mediaType: 'movie',
            tmdbId: Math.floor(Math.random() * 100000),
          })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(201);
      };

      const createResult = await PerformanceTestHelper.measureResponseTime(requestCreationTest);

      expect(createResult.duration).toBeLessThan(2000); // 2 seconds max
      expect(DataValidationHelper.validateRequestResponse(createResult.response)).toBe(true);

      console.log(`  ✅ Request creation completed in ${createResult.duration}ms`);
      console.log('✅ Performance tests completed');
    });

    it('should maintain performance with large datasets', async () => {
      const { app, users } = context;

      console.log('📊 Testing performance with large datasets...');

      // Test pagination performance
      const largePaginationTest = async () => {
        return request(app)
          .get('/api/v1/media/requests')
          .query({ pageSize: 100, page: 1 })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(200);
      };

      const paginationResult = await PerformanceTestHelper.measureResponseTime(largePaginationTest);

      expect(paginationResult.duration).toBeLessThan(3000);
      expect(DataValidationHelper.validateRequestListResponse(paginationResult.response)).toBe(
        true,
      );

      console.log(`  ✅ Large pagination completed in ${paginationResult.duration}ms`);

      // Test admin operations performance
      const adminPerformanceTest = async () => {
        return request(app)
          .get('/api/v1/media/requests/all')
          .query({ pageSize: 50 })
          .set('Authorization', `Bearer ${users.admin.token}`)
          .expect(200);
      };

      const adminResult = await PerformanceTestHelper.measureResponseTime(adminPerformanceTest);

      expect(adminResult.duration).toBeLessThan(4000);
      expect(DataValidationHelper.validateRequestListResponse(adminResult.response)).toBe(true);

      console.log(`  ✅ Admin operations completed in ${adminResult.duration}ms`);
      console.log('✅ Large dataset performance tests completed');
    });
  });

  describe('🔄 Error Handling and Edge Cases', () => {
    it('should handle all error scenarios gracefully', async () => {
      const { app, users } = context;

      console.log('🚨 Testing error handling...');

      const errorScenarios = [
        {
          name: 'Invalid authentication',
          test: async () => {
            const response = await request(app)
              .get('/api/v1/media/requests')
              .set('Authorization', 'Bearer invalid-token')
              .expect(401);
            return response.body.success === false;
          },
        },
        {
          name: 'Malformed request data',
          test: async () => {
            const response = await request(app)
              .post('/api/v1/media/request')
              .send({
                mediaType: 'invalid-type',
                tmdbId: 'not-a-number',
              })
              .set('Authorization', `Bearer ${users.user.token}`)
              .expect(400);
            return response.body.success === false;
          },
        },
        {
          name: 'Non-existent resource',
          test: async () => {
            const response = await request(app)
              .get('/api/v1/media/requests/999999999')
              .set('Authorization', `Bearer ${users.user.token}`)
              .expect(404);
            return response.body.success === false;
          },
        },
        {
          name: 'Insufficient privileges',
          test: async () => {
            const response = await request(app)
              .get('/api/v1/admin/users')
              .set('Authorization', `Bearer ${users.user.token}`)
              .expect(403);
            return response.body.success === false;
          },
        },
      ];

      for (const scenario of errorScenarios) {
        const passed = await scenario.test();
        expect(passed).toBe(true);
        console.log(`  ✅ ${scenario.name}`);
      }

      console.log('✅ Error handling tests completed');
    });
  });

  describe('📈 Integration Health Check', () => {
    it('should verify all system components are working', async () => {
      const { app, users } = context;

      console.log('🏥 Running system health checks...');

      const healthChecks = [
        {
          name: 'Database connectivity',
          test: async () => {
            const response = await request(app).get('/api/v1/health').expect(200);
            return response.body.status === 'healthy';
          },
        },
        {
          name: 'Authentication system',
          test: async () => {
            const response = await request(app)
              .get('/api/v1/auth/me')
              .set('Authorization', `Bearer ${users.user.token}`)
              .expect(200);
            return response.body.success === true;
          },
        },
        {
          name: 'Admin functionality',
          test: async () => {
            const response = await request(app)
              .get('/api/v1/admin/dashboard/stats')
              .set('Authorization', `Bearer ${users.admin.token}`)
              .expect(200);
            return response.body.success === true;
          },
        },
        {
          name: 'Media search integration',
          test: async () => {
            const response = await request(app)
              .get('/api/v1/media/search')
              .query({ query: 'test' })
              .set('Authorization', `Bearer ${users.user.token}`)
              .expect(200);
            return response.body.success === true;
          },
        },
      ];

      let passedChecks = 0;

      for (const check of healthChecks) {
        try {
          const passed = await check.test();
          if (passed) {
            passedChecks++;
            console.log(`  ✅ ${check.name}`);
          } else {
            console.log(`  ❌ ${check.name} - Failed`);
          }
          expect(passed).toBe(true);
        } catch (error) {
          console.log(`  ❌ ${check.name} - Error: ${error}`);
          throw error;
        }
      }

      expect(passedChecks).toBe(healthChecks.length);
      console.log(`✅ All ${passedChecks}/${healthChecks.length} health checks passed`);
    });
  });
});

// Export for potential use in other test files
export { setupE2EEnvironment } from './utils/e2e-helpers';
