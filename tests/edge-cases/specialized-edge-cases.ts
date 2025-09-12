/**
 * Specialized Edge Case Tests for MediaNest
 * Domain-specific edge cases and advanced boundary testing
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

import { app } from '../../backend/src/app';
import {
  createTestUser,
  generateAuthToken,
  generateExtremeInputs,
  createConcurrentRequests,
  testTransactionIsolation,
  validateSecurityHeaders,
  generateTestFileBuffer,
} from '../utils/test-helpers';

describe('🎯 Specialized MediaNest Edge Cases', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let authToken: string;
  let adminToken: string;
  let userId: string;
  let adminUserId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    redis = new Redis({ db: 1 });

    // Create test users
    const user = await createTestUser(prisma, 'USER');
    const admin = await createTestUser(prisma, 'ADMIN');

    userId = user.id;
    adminUserId = admin.id;
    authToken = generateAuthToken(user);
    adminToken = generateAuthToken(admin);
  });

  afterAll(async () => {
    await redis.flushdb();
    await prisma.user.deleteMany({
      where: { id: { in: [userId, adminUserId] } },
    });
    await prisma.$disconnect();
    await redis.disconnect();
  });

  describe('🎬 Media-Specific Edge Cases', () => {
    test('YouTube URL validation boundaries', async () => {
      const testUrls = [
        // Valid URLs
        { url: 'https://youtube.com/playlist?list=PLtest123', valid: true },
        { url: 'https://www.youtube.com/playlist?list=PLtest123', valid: true },
        { url: 'https://music.youtube.com/playlist?list=PLtest123', valid: true },

        // Invalid URLs
        { url: '', valid: false },
        { url: 'not-a-url', valid: false },
        { url: 'http://example.com/fake-playlist', valid: false },
        { url: 'javascript:alert("xss")', valid: false },
        { url: 'data:text/html,<script>alert("xss")</script>', valid: false },
        { url: 'file:///etc/passwd', valid: false },

        // Edge cases
        { url: 'https://youtube.com/playlist?list=' + 'A'.repeat(1000), valid: false },
        { url: 'https://youtube.com/playlist?list=\x00\x00\x00', valid: false },
        { url: 'https://youtube.com/playlist?list=<script>', valid: false },
      ];

      for (const testCase of testUrls) {
        const response = await request(app)
          .post('/api/v1/youtube/download')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ playlistUrl: testCase.url });

        if (testCase.valid) {
          expect(response.status).toBeLessThan(400);
        } else {
          expect(response.status).toBeGreaterThanOrEqual(400);
        }
      }
    });

    test('TMDB ID edge cases', async () => {
      const tmdbTestCases = [
        { tmdbId: '123456', valid: true },
        { tmdbId: '0', valid: false },
        { tmdbId: '-1', valid: false },
        { tmdbId: 'abc', valid: false },
        { tmdbId: '999999999999999', valid: false }, // Too large
        { tmdbId: '', valid: false },
        { tmdbId: null, valid: true }, // Nullable field
        { tmdbId: '<script>alert("xss")</script>', valid: false },
      ];

      for (const testCase of tmdbTestCases) {
        const response = await request(app)
          .post('/api/v1/media/request')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Test Movie',
            mediaType: 'movie',
            tmdbId: testCase.tmdbId,
          });

        if (testCase.valid) {
          expect(response.status).toBeLessThan(400);
        } else {
          expect(response.status).toBeGreaterThanOrEqual(400);
        }
      }
    });

    test('Media type validation', async () => {
      const mediaTypes = [
        { type: 'movie', valid: true },
        { type: 'tv', valid: true },
        { type: 'MOVIE', valid: true }, // Case insensitive
        { type: 'TV', valid: true },
        { type: 'invalid', valid: false },
        { type: '', valid: false },
        { type: null, valid: false },
        { type: '<script>alert("xss")</script>', valid: false },
        { type: 'movie\x00', valid: false },
      ];

      for (const testCase of mediaTypes) {
        const response = await request(app)
          .post('/api/v1/media/request')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Test Media',
            mediaType: testCase.type,
          });

        if (testCase.valid) {
          expect(response.status).toBeLessThan(400);
        } else {
          expect(response.status).toBeGreaterThanOrEqual(400);
        }
      }
    });
  });

  describe('🔐 Authentication & Authorization Edge Cases', () => {
    test('Token expiration boundary conditions', async () => {
      // Test tokens with various expiration times
      const jwt = await import('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'test-secret';

      const tokenTests = [
        {
          name: 'expired-1-second-ago',
          token: jwt.sign({ userId, email: 'test@test.com', role: 'USER' }, secret, {
            expiresIn: '-1s',
          }),
          shouldWork: false,
        },
        {
          name: 'expires-in-1-second',
          token: jwt.sign({ userId, email: 'test@test.com', role: 'USER' }, secret, {
            expiresIn: '1s',
          }),
          shouldWork: true,
        },
        {
          name: 'very-long-expiry',
          token: jwt.sign({ userId, email: 'test@test.com', role: 'USER' }, secret, {
            expiresIn: '100y',
          }),
          shouldWork: true,
        },
      ];

      for (const tokenTest of tokenTests) {
        const response = await request(app)
          .get('/api/v1/dashboard')
          .set('Authorization', `Bearer ${tokenTest.token}`);

        if (tokenTest.shouldWork) {
          expect(response.status).toBeLessThan(400);
        } else {
          expect(response.status).toBe(401);
        }

        // Test the 1-second token after waiting
        if (tokenTest.name === 'expires-in-1-second') {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const delayedResponse = await request(app)
            .get('/api/v1/dashboard')
            .set('Authorization', `Bearer ${tokenTest.token}`);
          expect(delayedResponse.status).toBe(401);
        }
      }
    });

    test('Role escalation attempts', async () => {
      const jwt = await import('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'test-secret';

      // Attempt to create admin token with user ID
      const fakeAdminToken = jwt.sign(
        { userId, email: 'test@test.com', role: 'ADMIN' }, // Wrong role
        secret,
        { expiresIn: '1h' },
      );

      // Try to access admin endpoint
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${fakeAdminToken}`);

      // Should be denied - role should come from database, not token
      expect(response.status).toBe(403);
    });

    test('Session fixation attempts', async () => {
      // Attempt to use same session ID across different users
      const sessionId = 'fixed-session-id-12345';

      const jwt = await import('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'test-secret';

      const userToken = jwt.sign(
        { userId, email: 'user@test.com', role: 'USER', sessionId },
        secret,
        { expiresIn: '1h' },
      );

      const adminTokenWithSameSession = jwt.sign(
        { userId: adminUserId, email: 'admin@test.com', role: 'ADMIN', sessionId },
        secret,
        { expiresIn: '1h' },
      );

      // Use tokens simultaneously
      const [userResponse, adminResponse] = await Promise.all([
        request(app).get('/api/v1/dashboard').set('Authorization', `Bearer ${userToken}`),
        request(app)
          .get('/api/v1/admin/users')
          .set('Authorization', `Bearer ${adminTokenWithSameSession}`),
      ]);

      // Both should work independently - no session collision
      expect(userResponse.status).toBeLessThan(400);
      expect(adminResponse.status).toBeLessThan(400);
    });
  });

  describe('⚡ Performance & Resource Edge Cases', () => {
    test('Rate limiting accuracy under load', async () => {
      // Test rate limiting with precise timing
      const startTime = Date.now();
      const requests = [];

      // Make requests as fast as possible
      for (let i = 0; i < 200; i++) {
        requests.push(
          request(app).get('/api/v1/health').set('Authorization', `Bearer ${authToken}`),
        );
      }

      const responses = await Promise.allSettled(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successful = responses.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 200,
      ).length;

      const rateLimited = responses.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 429,
      ).length;

      console.log(
        `Rate limiting test: ${successful} successful, ${rateLimited} rate limited in ${duration}ms`,
      );

      // Should have some rate limiting if requests were fast enough
      if (duration < 1000) {
        expect(rateLimited).toBeGreaterThan(0);
      }
    });

    test('Memory usage during large responses', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Request potentially large dataset
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ limit: 10000 }); // Request large limit

      const peakMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = peakMemory - initialMemory;

      console.log(`Memory increase during large response: ${memoryIncrease / 1024 / 1024}MB`);

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB

      // Response should be successful but limited
      expect(response.status).toBeLessThan(400);
      if (response.body.data) {
        expect(response.body.data.length).toBeLessThanOrEqual(100); // Should be limited
      }
    });

    test('Database connection pool exhaustion handling', async () => {
      // Create many concurrent database-heavy requests
      const heavyRequests = Array.from({ length: 50 }, () =>
        request(app)
          .get('/api/v1/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .timeout(10000),
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(heavyRequests);
      const endTime = Date.now();

      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 200,
      ).length;

      const failed = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status >= 500),
      ).length;

      console.log(
        `Connection pool test: ${successful} successful, ${failed} failed in ${endTime - startTime}ms`,
      );

      // Most requests should succeed even under load
      expect(successful).toBeGreaterThan(heavyRequests.length * 0.8);
    });
  });

  describe('🛡️ Security Boundary Testing', () => {
    test('Request size limits', async () => {
      const sizes = [
        { size: 1024, shouldWork: true }, // 1KB
        { size: 100 * 1024, shouldWork: true }, // 100KB
        { size: 1024 * 1024, shouldWork: false }, // 1MB - should exceed limit
        { size: 10 * 1024 * 1024, shouldWork: false }, // 10MB - definitely too large
      ];

      for (const testCase of sizes) {
        const largePayload = {
          title: 'A'.repeat(Math.min(testCase.size, 1000)),
          description: 'B'.repeat(Math.max(0, testCase.size - 1000)),
          mediaType: 'movie',
        };

        try {
          const response = await request(app)
            .post('/api/v1/media/request')
            .set('Authorization', `Bearer ${authToken}`)
            .send(largePayload)
            .timeout(5000);

          if (testCase.shouldWork) {
            expect(response.status).toBeLessThan(400);
          } else {
            expect(response.status).toBeGreaterThanOrEqual(400);
          }
        } catch (error) {
          if (testCase.shouldWork) {
            throw error;
          }
          // Expected for oversized requests
          expect(error.message).toMatch(/(timeout|size|limit)/i);
        }
      }
    });

    test('Header injection attempts', async () => {
      const maliciousHeaders = {
        'X-Forwarded-For': '127.0.0.1\r\nSet-Cookie: evil=true',
        'User-Agent': 'Mozilla/5.0\r\n\r\n<script>alert("xss")</script>',
        Authorization: `Bearer ${authToken}\r\nX-Admin: true`,
        'Content-Type': 'application/json\r\nX-Inject: malicious',
      };

      for (const [headerName, headerValue] of Object.entries(maliciousHeaders)) {
        const response = await request(app).get('/api/v1/health').set(headerName, headerValue);

        // Should not have injected headers in response
        expect(response.headers['set-cookie']).not.toContain('evil=true');
        expect(response.headers['x-admin']).toBeUndefined();
        expect(response.headers['x-inject']).toBeUndefined();

        // Response should still work normally
        expect(response.status).toBeLessThan(500);
      }
    });

    test('CSRF protection edge cases', async () => {
      // Test state-changing requests without proper CSRF protection
      const stateChangingEndpoints = [
        { method: 'POST', path: '/api/v1/media/request' },
        { method: 'PUT', path: '/api/v1/admin/users/settings' },
        { method: 'DELETE', path: '/api/v1/media/request/fake-id' },
      ];

      for (const endpoint of stateChangingEndpoints) {
        // Request from different origin without CSRF token
        const response = await request(app)
          [endpoint.method.toLowerCase()](endpoint.path)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Origin', 'https://evil.com')
          .set('Referer', 'https://evil.com/attack')
          .send({ title: 'CSRF Test', mediaType: 'movie' });

        // Should be blocked by CORS or CSRF protection
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    test('Path traversal in file operations', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/passwd',
        'C:\\windows\\system32\\config\\sam',
        '\x00/etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd', // URL encoded
      ];

      for (const maliciousPath of maliciousPaths) {
        // Test in various contexts where file paths might be used
        const testCases = [
          {
            endpoint: '/api/v1/youtube/download',
            payload: {
              playlistUrl: 'https://youtube.com/playlist?list=test',
              outputPath: maliciousPath,
            },
          },
          {
            endpoint: '/api/v1/media/search',
            query: { q: maliciousPath },
          },
        ];

        for (const testCase of testCases) {
          try {
            let response;
            if (testCase.payload) {
              response = await request(app)
                .post(testCase.endpoint)
                .set('Authorization', `Bearer ${authToken}`)
                .send(testCase.payload);
            } else {
              response = await request(app)
                .get(testCase.endpoint)
                .set('Authorization', `Bearer ${authToken}`)
                .query(testCase.query || {});
            }

            // Should not access system files
            expect(response.body).not.toMatch(/root:x:/); // Unix passwd format
            expect(response.body).not.toMatch(/Administrator:/); // Windows user
            expect(response.status).not.toBe(200);
          } catch (error) {
            // Errors are acceptable for malicious inputs
            expect(error.message).not.toContain('root:x:');
          }
        }
      }
    });
  });

  describe('🔄 Data Consistency Edge Cases', () => {
    test('Concurrent media request creation', async () => {
      const mediaTitle = `Concurrent Test Movie ${Date.now()}`;

      // Create multiple identical media requests simultaneously
      const concurrentRequests = createConcurrentRequests(
        () =>
          request(app)
            .post('/api/v1/media/request')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              title: mediaTitle,
              mediaType: 'movie',
              tmdbId: '12345',
            }),
        10, // 10 concurrent requests
      );

      const results = await concurrentRequests;
      const successful = results.filter((r) => r.success && r.result.status < 400);

      // Should handle duplicates appropriately
      expect(successful.length).toBeGreaterThan(0);
      expect(successful.length).toBeLessThanOrEqual(10);

      // Verify only one media request was actually created
      const dbRequests = await prisma.mediaRequest.findMany({
        where: {
          userId,
          title: mediaTitle,
        },
      });

      expect(dbRequests.length).toBe(1);
    });

    test('Database transaction isolation', async () => {
      const isolationResults = await testTransactionIsolation(prisma, userId);

      const successful = isolationResults.filter((r) => r.status === 'fulfilled');
      const failed = isolationResults.filter((r) => r.status === 'rejected');

      console.log(
        `Transaction isolation: ${successful.length} successful, ${failed.length} failed`,
      );

      // Most transactions should succeed
      expect(successful.length).toBeGreaterThan(isolationResults.length / 2);
    });

    test('Redis cache consistency under load', async () => {
      const cacheKey = `test-consistency-${Date.now()}`;
      const testValue = { data: 'consistency-test', timestamp: Date.now() };

      // Set value in cache
      await redis.setex(cacheKey, 60, JSON.stringify(testValue));

      // Perform concurrent reads and writes
      const operations = [];

      // Add read operations
      for (let i = 0; i < 20; i++) {
        operations.push(
          redis.get(cacheKey).then((value) => ({
            type: 'read',
            value: value ? JSON.parse(value) : null,
          })),
        );
      }

      // Add write operations
      for (let i = 0; i < 5; i++) {
        operations.push(
          redis
            .setex(
              cacheKey,
              60,
              JSON.stringify({
                ...testValue,
                updateIndex: i,
              }),
            )
            .then(() => ({ type: 'write', success: true })),
        );
      }

      const results = await Promise.allSettled(operations);
      const successful = results.filter((r) => r.status === 'fulfilled');

      expect(successful.length).toBe(operations.length);

      // Final value should be consistent
      const finalValue = await redis.get(cacheKey);
      expect(finalValue).toBeTruthy();

      if (finalValue) {
        const parsed = JSON.parse(finalValue);
        expect(parsed.data).toBe('consistency-test');
      }
    });
  });
});
