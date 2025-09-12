/**
 * Media Integration Health Check E2E Tests
 *
 * Tests for system health validation including:
 * - Database connectivity verification
 * - Authentication system validation
 * - Admin functionality testing
 * - Service integration checks
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MediaTestFactory } from '../../shared/factories/media-factory';
import { ValidationHelper } from '../../shared/helpers/validation-helpers';
import { BaseTestHelper, TestContext } from '../../shared/helpers/test-base';

describe('Integration Health Check', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = {
      app: {}, // Mock Express app
      users: {
        admin: await BaseTestHelper.createTestUser('admin'),
        user: await BaseTestHelper.createTestUser('user'),
      },
      cleanup: async () => {
        await BaseTestHelper.cleanupTestEnvironment();
      },
    } as TestContext;
  });

  afterAll(async () => {
    await context.cleanup();
  });

  it('should verify all system components are working', async () => {
    const { app, users } = context;

    console.log('🏥 Running system health checks...');

    const healthChecks = MediaTestFactory.createHealthCheckEndpoints();

    let passedChecks = 0;

    for (const check of healthChecks) {
      try {
        console.log(`  Checking: ${check.name}...`);

        let requestBuilder = request(app).get(check.endpoint);

        if (check.requiresAuth) {
          const token = check.requiresAdmin ? users.admin.token : users.user.token;
          requestBuilder = requestBuilder.set('Authorization', `Bearer ${token}`);
        }

        if (check.query) {
          requestBuilder = requestBuilder.query(check.query);
        }

        const response = await requestBuilder.expect(check.expectedStatus);

        // Validate response structure
        if (check.expectedResponse) {
          Object.keys(check.expectedResponse).forEach((key) => {
            expect(response.body).toHaveProperty(key);
            if (check.expectedResponse[key] !== undefined) {
              expect(response.body[key]).toBe(check.expectedResponse[key]);
            }
          });
        }

        passedChecks++;
        console.log(`  ✅ ${check.name}`);
      } catch (error) {
        console.log(`  ❌ ${check.name} - Failed: ${error}`);
        throw error;
      }
    }

    expect(passedChecks).toBe(healthChecks.length);
    console.log(`✅ All ${passedChecks}/${healthChecks.length} health checks passed`);
  });

  it('should validate complete system integration', async () => {
    const { app, users } = context;

    console.log('🔗 Testing system integration...');

    const integrationTests = [
      {
        name: 'User Authentication Flow',
        test: async () => {
          const response = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);

          return ValidationHelper.validateAuthResponse(response);
        },
      },
      {
        name: 'Media Search Integration',
        test: async () => {
          const response = await request(app)
            .get('/api/v1/media/search')
            .query({ query: 'integration test', page: 1 })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);

          return ValidationHelper.validateMediaSearchResponse(response);
        },
      },
      {
        name: 'Request Management System',
        test: async () => {
          // Create a request
          const createResponse = await request(app)
            .post('/api/v1/media/request')
            .send(MediaTestFactory.createMovieRequestData())
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(201);

          expect(ValidationHelper.validateRequestResponse(createResponse)).toBe(true);

          // Verify it appears in user's request list
          const listResponse = await request(app)
            .get('/api/v1/media/requests')
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);

          expect(ValidationHelper.validateRequestListResponse(listResponse)).toBe(true);
          return true;
        },
      },
      {
        name: 'Admin Management Interface',
        test: async () => {
          const response = await request(app)
            .get('/api/v1/admin/dashboard/stats')
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);

          return ValidationHelper.validateDashboardStatsResponse(response);
        },
      },
      {
        name: 'Error Handling System',
        test: async () => {
          const response = await request(app)
            .get('/api/v1/media/requests/nonexistent')
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(404);

          return ValidationHelper.validateErrorResponse(response, 404);
        },
      },
    ];

    for (const test of integrationTests) {
      console.log(`  Testing: ${test.name}...`);
      const result = await test.test();
      expect(result).toBe(true);
      console.log(`  ✅ ${test.name}`);
    }

    console.log('✅ System integration tests completed');
  });

  it('should verify data consistency across operations', async () => {
    const { app, users } = context;

    console.log('📊 Testing data consistency...');

    // Create a request and track it through various operations
    const requestData = MediaTestFactory.createMovieRequestData({
      notes: 'Consistency test request',
    });

    // Step 1: Create request
    const createResponse = await request(app)
      .post('/api/v1/media/request')
      .send(requestData)
      .set('Authorization', `Bearer ${users.user.token}`)
      .expect(201);

    const requestId = createResponse.body.data.id;
    const originalData = createResponse.body.data;

    // Step 2: Verify in user's request list
    const listResponse = await request(app)
      .get('/api/v1/media/requests')
      .set('Authorization', `Bearer ${users.user.token}`)
      .expect(200);

    const requestInList = listResponse.body.data.requests.find((r: any) => r.id === requestId);
    expect(requestInList).toBeDefined();
    expect(requestInList.notes).toBe(requestData.notes);

    // Step 3: Verify in admin view
    const adminListResponse = await request(app)
      .get('/api/v1/admin/requests/all')
      .set('Authorization', `Bearer ${users.admin.token}`)
      .expect(200);

    const requestInAdminList = adminListResponse.body.data.requests.find(
      (r: any) => r.id === requestId,
    );
    expect(requestInAdminList).toBeDefined();
    expect(requestInAdminList.notes).toBe(requestData.notes);

    // Step 4: Test status update consistency
    const statusUpdate = MediaTestFactory.createStatusUpdateData('approved');
    await request(app)
      .put(`/api/v1/admin/requests/${requestId}/status`)
      .send(statusUpdate)
      .set('Authorization', `Bearer ${users.admin.token}`)
      .expect(200);

    // Step 5: Verify status update is reflected everywhere
    const updatedResponse = await request(app)
      .get(`/api/v1/media/requests/${requestId}`)
      .set('Authorization', `Bearer ${users.user.token}`)
      .expect(200);

    expect(updatedResponse.body.data.status).toBe('approved');

    // Verify data consistency
    expect(
      ValidationHelper.validateDataConsistency(originalData, updatedResponse.body.data, [
        'status',
        'updatedAt',
      ]),
    ).toBe(true);

    console.log('  ✅ Request creation consistency verified');
    console.log('  ✅ Cross-view data consistency verified');
    console.log('  ✅ Status update consistency verified');
    console.log('✅ Data consistency tests completed');
  });

  it('should validate security boundaries in integration', async () => {
    const { app, users } = context;

    console.log('🔒 Testing security integration...');

    const securityTests = [
      {
        name: 'Unauthenticated access blocked',
        test: async () => {
          const response = await request(app).get('/api/v1/media/requests').expect(401);
          return ValidationHelper.validateErrorResponse(response, 401);
        },
      },
      {
        name: 'Invalid token rejected',
        test: async () => {
          const response = await request(app)
            .get('/api/v1/media/requests')
            .set('Authorization', 'Bearer invalid-token-123')
            .expect(401);
          return ValidationHelper.validateErrorResponse(response, 401);
        },
      },
      {
        name: 'Role-based access enforced',
        test: async () => {
          const response = await request(app)
            .get('/api/v1/admin/users')
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(403);
          return ValidationHelper.validateErrorResponse(response, 403);
        },
      },
      {
        name: 'Admin access granted appropriately',
        test: async () => {
          const response = await request(app)
            .get('/api/v1/admin/dashboard/stats')
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);
          return response.body.success === true;
        },
      },
    ];

    for (const test of securityTests) {
      console.log(`  Testing: ${test.name}...`);
      const result = await test.test();
      expect(result).toBe(true);
      console.log(`  ✅ ${test.name}`);
    }

    console.log('✅ Security integration tests completed');
  });

  it('should validate performance under normal load', async () => {
    const { app, users } = context;

    console.log('⚡ Testing integration performance...');

    const performanceTests = [
      {
        name: 'API response times',
        test: async () => {
          const start = Date.now();

          await request(app)
            .get('/api/v1/media/search')
            .query({ query: 'performance test' })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);

          const duration = Date.now() - start;
          expect(duration).toBeLessThan(3000); // Under 3 seconds
          return true;
        },
      },
      {
        name: 'Concurrent request handling',
        test: async () => {
          const requests = Array.from({ length: 5 }, () =>
            request(app)
              .get('/api/v1/media/requests')
              .set('Authorization', `Bearer ${users.user.token}`)
              .expect(200),
          );

          const start = Date.now();
          await Promise.all(requests);
          const duration = Date.now() - start;

          expect(duration).toBeLessThan(5000); // All 5 requests under 5 seconds
          return true;
        },
      },
      {
        name: 'Database operation performance',
        test: async () => {
          const start = Date.now();

          // Create and immediately query
          const createResponse = await request(app)
            .post('/api/v1/media/request')
            .send(MediaTestFactory.createMovieRequestData())
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(201);

          await request(app)
            .get(`/api/v1/media/requests/${createResponse.body.data.id}`)
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);

          const duration = Date.now() - start;
          expect(duration).toBeLessThan(2000); // Under 2 seconds
          return true;
        },
      },
    ];

    for (const test of performanceTests) {
      console.log(`  Testing: ${test.name}...`);
      const result = await test.test();
      expect(result).toBe(true);
      console.log(`  ✅ ${test.name}`);
    }

    console.log('✅ Integration performance tests completed');
  });
});
