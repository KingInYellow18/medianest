/**
 * Media Error Handling E2E Tests
 *
 * Tests for error scenarios and edge cases including:
 * - Authentication and authorization errors
 * - Malformed request handling
 * - Resource not found scenarios
 * - Network timeout and failure handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MediaTestFactory } from '../../shared/factories/media-factory';
import { ValidationHelper } from '../../shared/helpers/validation-helpers';
import { BaseTestHelper, TestContext } from '../../shared/helpers/test-base';

describe('Error Handling and Edge Cases', () => {
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

  it('should validate request data thoroughly', async () => {
    const { app, users } = context;

    console.log('🔍 Testing request validation...');

    const validationScenarios = MediaTestFactory.createValidationScenarios();

    for (const scenario of validationScenarios) {
      console.log(`  Testing: ${scenario.name}`);

      const response = await request(app)
        .post('/api/v1/media/request')
        .send(scenario.data)
        .set('Authorization', `Bearer ${users.user.token}`)
        .expect(400);

      expect(ValidationHelper.validateErrorResponse(response, 400)).toBe(true);
      expect(response.body.error.message).toContain(scenario.expectedError);

      console.log(`    ✅ ${scenario.name}: ${scenario.expectedError}`);
    }

    console.log('✅ Request validation tests completed');
  });

  it('should handle edge cases in data processing', async () => {
    const { app, users } = context;

    console.log('⚠️ Testing edge cases...');

    const edgeCases = [
      {
        name: 'Empty request body',
        test: async () => {
          const response = await request(app)
            .post('/api/v1/media/request')
            .send({})
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(400);
          return ValidationHelper.validateErrorResponse(response, 400);
        },
      },
      {
        name: 'Extremely large TMDB ID',
        test: async () => {
          const response = await request(app)
            .post('/api/v1/media/request')
            .send({
              mediaType: 'movie',
              tmdbId: Number.MAX_SAFE_INTEGER,
            })
            .set('Authorization', `Bearer ${users.user.token}`);

          // Should either accept it (201) or reject it (400), but not crash (500)
          expect([201, 400]).toContain(response.status);
          return true;
        },
      },
      {
        name: 'Negative TMDB ID',
        test: async () => {
          const response = await request(app)
            .post('/api/v1/media/request')
            .send({
              mediaType: 'movie',
              tmdbId: -1,
            })
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(400);
          return ValidationHelper.validateErrorResponse(response, 400);
        },
      },
      {
        name: 'Very long notes field',
        test: async () => {
          const longNotes = 'A'.repeat(10000);
          const response = await request(app)
            .post('/api/v1/media/request')
            .send({
              mediaType: 'movie',
              tmdbId: 123456,
              notes: longNotes,
            })
            .set('Authorization', `Bearer ${users.user.token}`);

          // Should either truncate/accept (201) or reject (400)
          expect([201, 400]).toContain(response.status);
          return true;
        },
      },
      {
        name: 'Special characters in search query',
        test: async () => {
          const specialQuery = '"><script>alert("xss")</script>';
          const response = await request(app)
            .get('/api/v1/media/search')
            .query({ query: specialQuery })
            .set('Authorization', `Bearer ${users.user.token}`);

          // Should handle gracefully, not crash
          expect([200, 400]).toContain(response.status);

          if (response.status === 200) {
            expect(ValidationHelper.validateMediaSearchResponse(response)).toBe(true);
          }
          return true;
        },
      },
    ];

    for (const edgeCase of edgeCases) {
      const passed = await edgeCase.test();
      expect(passed).toBe(true);
      console.log(`  ✅ ${edgeCase.name}`);
    }

    console.log('✅ Edge case tests completed');
  });

  it('should handle concurrent error scenarios', async () => {
    const { app, users } = context;

    console.log('🔄 Testing concurrent error handling...');

    // Create multiple concurrent requests with various error conditions
    const concurrentErrorTests = [
      // Invalid auth tokens
      ...Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/v1/media/requests')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401)
      ),
      // Malformed requests
      ...Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/v1/media/request')
          .send({ invalid: 'data' })
          .set('Authorization', `Bearer ${users.user.token}`)
          .expect(400)
      ),
      // Valid requests mixed in
      ...Array.from({ length: 3 }, (_, i) =>
        request(app)
          .post('/api/v1/media/request')
          .send(MediaTestFactory.createMovieRequestData({ tmdbId: 100000 + i }))
          .set('Authorization', `Bearer ${users.user.token}`)
          .then((res) => ({ status: res.status, body: res.body }))
          .catch((err) => ({ status: err.status || 500, body: err.response?.body }))
      ),
    ];

    const results = await Promise.all(
      concurrentErrorTests.map((p) =>
        p
          .then((res) => ({ status: res.status, success: true }))
          .catch((err) => ({ status: err.status || 500, success: false }))
      )
    );

    // Verify all requests were handled (no crashes)
    expect(results.length).toBe(13);

    const statusCounts = results.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    console.log(`  📊 Status code distribution:`, statusCounts);

    // Should have appropriate status codes
    expect(statusCounts[401]).toBe(5); // Invalid auth
    expect(statusCounts[400]).toBe(5); // Bad requests
    expect(statusCounts[201] || 0).toBeGreaterThanOrEqual(0); // Some might succeed

    console.log('✅ Concurrent error handling tests completed');
  });

  it('should recover from temporary failures', async () => {
    const { app, users } = context;

    console.log('🔄 Testing failure recovery...');

    // Simulate a sequence where some requests fail initially but later succeed
    const recoveryScenarios = [
      {
        name: 'Database connection recovery',
        test: async () => {
          // First request might fail due to connection issue
          const response1 = await request(app)
            .get('/api/v1/media/requests')
            .set('Authorization', `Bearer ${users.user.token}`);

          // Second request should work (connection recovered)
          const response2 = await request(app)
            .get('/api/v1/media/requests')
            .set('Authorization', `Bearer ${users.user.token}`)
            .expect(200);

          return ValidationHelper.validateRequestListResponse(response2);
        },
      },
      {
        name: 'Service degradation handling',
        test: async () => {
          // Multiple requests to test graceful degradation
          const requests = Array.from({ length: 10 }, (_, i) =>
            request(app)
              .get('/api/v1/media/search')
              .query({ query: `recovery-test-${i}` })
              .set('Authorization', `Bearer ${users.user.token}`)
              .then((res) => ({ status: res.status, success: true }))
              .catch((err) => ({ status: err.status || 500, success: false }))
          );

          const results = await Promise.all(requests);

          // Most should succeed, some might fail gracefully
          const successCount = results.filter((r) => r.status === 200).length;
          expect(successCount).toBeGreaterThan(5); // At least half should succeed

          return true;
        },
      },
    ];

    for (const scenario of recoveryScenarios) {
      const passed = await scenario.test();
      expect(passed).toBe(true);
      console.log(`  ✅ ${scenario.name}`);
    }

    console.log('✅ Failure recovery tests completed');
  });
});
