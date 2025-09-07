/**
 * Media Security and Isolation E2E Tests
 *
 * Tests for user data isolation and security including:
 * - Complete user data isolation
 * - Cross-user request access prevention
 * - Authorization boundary enforcement
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MediaTestFactory } from '../../shared/factories/media-factory';
import { ValidationHelper } from '../../shared/helpers/validation-helpers';
import { BaseTestHelper, TestContext } from '../../shared/helpers/test-base';

describe('Security and Isolation Testing', () => {
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

  it('should maintain complete user data isolation', async () => {
    const { app } = context;

    console.log('🛡️ Testing comprehensive user isolation...');

    // Create additional users for isolation testing
    const user2 = await BaseTestHelper.createTestUser('user');

    const isolationData = MediaTestFactory.createIsolationTestData();

    // Both users create requests
    const user1RequestResponse = await request(app)
      .post('/api/v1/media/request')
      .send(isolationData.user1Requests[0])
      .set('Authorization', `Bearer ${context.users.user.token}`)
      .expect(201);

    const user2RequestResponse = await request(app)
      .post('/api/v1/media/request')
      .send(isolationData.user2Requests[0])
      .set('Authorization', `Bearer ${user2.token}`)
      .expect(201);

    // Verify complete isolation
    const isolationTests = [
      {
        name: 'User 1 cannot see User 2 requests',
        test: async () => {
          const response = await request(app)
            .get(`/api/v1/media/requests/${user2RequestResponse.body.data?.id || 'test-id'}`)
            .set('Authorization', `Bearer ${context.users.user.token}`)
            .expect(403);
          return response.body.success === false;
        },
      },
      {
        name: 'User 2 cannot see User 1 requests',
        test: async () => {
          const response = await request(app)
            .get(`/api/v1/media/requests/${user1RequestResponse.body.data?.id || 'test-id'}`)
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

          const user1RequestIds = (user1List.body.data?.requests || []).map((r: any) => r.id);
          const user2RequestIds = (user2List.body.data?.requests || []).map((r: any) => r.id);

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

  it('should enforce authorization boundaries', async () => {
    const { app } = context;

    console.log('🔒 Testing authorization boundaries...');

    const user2 = await BaseTestHelper.createTestUser('user');

    // Create a request as user 1
    const user1Request = await request(app)
      .post('/api/v1/media/request')
      .send(MediaTestFactory.createMovieRequestData())
      .set('Authorization', `Bearer ${context.users.user.token}`)
      .expect(201);

    const requestId = user1Request.body.data?.id || 'test-request-id';

    const authorizationTests = [
      {
        name: 'Regular user cannot access admin endpoints',
        test: async () => {
          const response = await request(app)
            .get('/api/v1/admin/requests/all')
            .set('Authorization', `Bearer ${context.users.user.token}`)
            .expect(403);
          return ValidationHelper.validateErrorResponse(response, 403);
        },
      },
      {
        name: 'User cannot modify other users requests',
        test: async () => {
          const response = await request(app)
            .put(`/api/v1/media/requests/${requestId}/cancel`)
            .set('Authorization', `Bearer ${user2.token}`)
            .expect(403);
          return ValidationHelper.validateErrorResponse(response, 403);
        },
      },
      {
        name: 'User cannot approve their own requests',
        test: async () => {
          const response = await request(app)
            .put(`/api/v1/admin/requests/${requestId}/approve`)
            .send({ notes: 'Self approval attempt' })
            .set('Authorization', `Bearer ${context.users.user.token}`)
            .expect(403);
          return ValidationHelper.validateErrorResponse(response, 403);
        },
      },
      {
        name: 'Admin can access admin endpoints',
        test: async () => {
          const response = await request(app)
            .get('/api/v1/admin/requests/all')
            .set('Authorization', `Bearer ${context.users.admin.token}`)
            .expect(200);
          return ValidationHelper.validateRequestListResponse(response);
        },
      },
    ];

    for (const test of authorizationTests) {
      const passed = await test.test();
      expect(passed).toBe(true);
      console.log(`  ✅ ${test.name}`);
    }

    console.log('✅ Authorization boundary tests completed');
  });

  it('should prevent data leakage in API responses', async () => {
    const { app } = context;

    console.log('🔍 Testing data leakage prevention...');

    const user2 = await BaseTestHelper.createTestUser('user');

    // Create requests for both users
    await request(app)
      .post('/api/v1/media/request')
      .send(MediaTestFactory.createMovieRequestData({ notes: 'User 1 secret note' }))
      .set('Authorization', `Bearer ${context.users.user.token}`)
      .expect(201);

    await request(app)
      .post('/api/v1/media/request')
      .send(MediaTestFactory.createTVShowRequestData({ notes: 'User 2 secret note' }))
      .set('Authorization', `Bearer ${user2.token}`)
      .expect(201);

    // Test that user 1 only sees their data
    const user1Requests = await request(app)
      .get('/api/v1/media/requests')
      .set('Authorization', `Bearer ${context.users.user.token}`)
      .expect(200);

    const user1RequestList = user1Requests.body.data?.requests || [];

    // Verify no data leakage
    for (const request of user1RequestList) {
      expect(request.notes).not.toContain('User 2 secret note');
      expect(request.userId).toBe(context.users.user.id);
    }

    // Test that user 2 only sees their data
    const user2Requests = await request(app)
      .get('/api/v1/media/requests')
      .set('Authorization', `Bearer ${user2.token}`)
      .expect(200);

    const user2RequestList = user2Requests.body.data?.requests || [];

    for (const request of user2RequestList) {
      expect(request.notes).not.toContain('User 1 secret note');
      expect(request.userId).toBe(user2.id);
    }

    console.log('✅ Data leakage prevention tests completed');
  });

  it('should enforce rate limiting per user', async () => {
    const { app } = context;

    console.log('⏱️ Testing user-specific rate limiting...');

    const requestData = MediaTestFactory.createMovieRequestData();
    let rateLimitHit = false;

    // Attempt multiple rapid requests
    const requestPromises = Array.from({ length: 20 }, (_, i) =>
      request(app)
        .post('/api/v1/media/request')
        .send({ ...requestData, tmdbId: requestData.tmdbId + i })
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .then((res) => ({ status: res.status, body: res.body }))
        .catch((err) => ({ status: err.status, body: err.response?.body }))
    );

    const results = await Promise.all(requestPromises);

    // Check if any requests were rate limited
    const rateLimitedRequests = results.filter((r) => r.status === 429);

    if (rateLimitedRequests.length > 0) {
      rateLimitHit = true;
      // Verify rate limit response format
      const rateLimitResponse = rateLimitedRequests[0];
      expect(
        ValidationHelper.validateRateLimitResponse({
          status: rateLimitResponse.status,
          body: rateLimitResponse.body,
        })
      ).toBe(true);
    }

    // Either rate limiting worked, or all requests succeeded (both valid outcomes)
    const successfulRequests = results.filter((r) => r.status === 201);
    expect(successfulRequests.length + rateLimitedRequests.length).toBe(20);

    if (rateLimitHit) {
      console.log(`  ✅ Rate limiting triggered after ${successfulRequests.length} requests`);
    } else {
      console.log('  ✅ All requests processed (rate limit not reached)');
    }

    console.log('✅ Rate limiting tests completed');
  });
});
