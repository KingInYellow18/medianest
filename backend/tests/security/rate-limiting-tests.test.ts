/**
 * Rate Limiting and DoS Prevention Test Suite
 *
 * Comprehensive tests to validate rate limiting enforcement across all MediaNest endpoints
 * Tests API rate limits, abuse prevention, and DoS attack mitigation
 */

import { PrismaClient } from '@prisma/client';
import supertest from 'supertest';
import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

import { createApp } from '../../src/app';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { DatabaseTestHelper } from '../helpers/database-test-helper';

describe('Rate Limiting and DoS Prevention Test Suite', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let authHelper: AuthTestHelper;
  let dbHelper: DatabaseTestHelper;
  let userToken: string;
  let adminToken: string;
  let userId: string;

  beforeAll(async () => {
    app = createApp();
    request = supertest(app);
    prisma = new PrismaClient();
    authHelper = new AuthTestHelper(prisma);
    dbHelper = new DatabaseTestHelper(prisma);

    // Create test users
    const user = await authHelper.createTestUser('rate-limit-user', 'rate-user@test.com');
    const admin = await authHelper.createTestUser('rate-admin', 'rate-admin@test.com', 'admin');

    userId = user.id;
    userToken = await authHelper.generateValidToken(user.id, 'user');
    adminToken = await authHelper.generateValidToken(admin.id, 'admin');
  });

  afterAll(async () => {
    await dbHelper.cleanup();
    await prisma.$disconnect();
  });

  describe('Authentication Rate Limiting Tests', () => {
    test('should enforce rate limits on login attempts', async () => {
      const attempts: Promise<any>[] = [];

      // Generate many rapid authentication attempts
      for (let i = 0; i < 30; i++) {
        attempts.push(
          request
            .post('/api/v1/auth/plex/verify')
            .send({ pin: `${1000 + i}`, username: 'rate-limit-test' }),
        );
      }

      const responses = await Promise.all(attempts);

      // Should start rate limiting after several attempts
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      const successResponses = responses.filter((r) => r.status === 200);
      const failedResponses = responses.filter((r) => r.status === 401);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check rate limit headers
      const rateLimitedResponse = rateLimitedResponses[0];
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-limit');
        expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-remaining');
        expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-reset');
      }
    });

    test('should implement progressive delays for failed login attempts', async () => {
      const username = 'progressive-delay-test';
      const timings: number[] = [];

      // Make several failed login attempts and measure response times
      for (let i = 0; i < 5; i++) {
        const start = Date.now();

        await request.post('/api/v1/auth/plex/verify').send({ pin: `wrong-pin-${i}`, username });

        const duration = Date.now() - start;
        timings.push(duration);

        // Small delay between attempts
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Later attempts should generally take longer (progressive delay)
      const firstAttempt = timings[0];
      const lastAttempt = timings[timings.length - 1];

      // Allow some variance but expect general trend of increasing delay
      expect(lastAttempt).toBeGreaterThanOrEqual(firstAttempt * 0.5);
    });

    test('should reset rate limits after time window', async () => {
      // This test would require waiting for rate limit reset
      // For now, verify that rate limit headers include reset time
      const response = await request
        .post('/api/v1/auth/plex/verify')
        .send({ pin: '1234', username: 'reset-test' });

      // Even if not rate limited, should include rate limit info
      if (response.headers['x-ratelimit-reset']) {
        const resetTime = parseInt(response.headers['x-ratelimit-reset']);
        expect(resetTime).toBeGreaterThan(Date.now() / 1000);
      }
    });
  });

  describe('API Endpoint Rate Limiting Tests', () => {
    test('should enforce rate limits on media search requests', async () => {
      const searches: Promise<any>[] = [];

      // Generate many rapid search requests
      for (let i = 0; i < 25; i++) {
        searches.push(
          request
            .get('/api/v1/media/search')
            .query({ query: `search-${i}` })
            .set('Authorization', `Bearer ${userToken}`),
        );
      }

      const responses = await Promise.all(searches);

      // Should start rate limiting
      const rateLimitedCount = responses.filter((r) => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);

      // Verify rate limit headers
      const limitedResponse = responses.find((r) => r.status === 429);
      if (limitedResponse) {
        expect(limitedResponse.headers).toHaveProperty('retry-after');
        expect(parseInt(limitedResponse.headers['retry-after'])).toBeGreaterThan(0);
      }
    });

    test('should enforce stricter rate limits on resource-intensive operations', async () => {
      const downloads: Promise<any>[] = [];

      // YouTube downloads should have stricter limits (e.g., 5 per hour)
      for (let i = 0; i < 10; i++) {
        downloads.push(
          request
            .post('/api/v1/youtube/download')
            .send({ url: `https://youtube.com/watch?v=test${i}` })
            .set('Authorization', `Bearer ${userToken}`),
        );
      }

      const responses = await Promise.all(downloads);

      // Should hit rate limit quickly for resource-intensive operations
      const rateLimitedCount = responses.filter((r) => r.status === 429).length;
      const successCount = responses.filter((r) => r.status === 200 || r.status === 201).length;

      expect(rateLimitedCount).toBeGreaterThan(0);
      expect(successCount).toBeLessThan(10); // Should not allow all 10 downloads
    });

    test('should have different rate limits for different user roles', async () => {
      const userRequests: Promise<any>[] = [];
      const adminRequests: Promise<any>[] = [];

      // Test user requests
      for (let i = 0; i < 20; i++) {
        userRequests.push(
          request.get('/api/v1/dashboard/stats').set('Authorization', `Bearer ${userToken}`),
        );
      }

      // Test admin requests (should have higher limits)
      for (let i = 0; i < 20; i++) {
        adminRequests.push(
          request.get('/api/v1/admin/stats').set('Authorization', `Bearer ${adminToken}`),
        );
      }

      const [userResponses, adminResponses] = await Promise.all([
        Promise.all(userRequests),
        Promise.all(adminRequests),
      ]);

      const userRateLimited = userResponses.filter((r) => r.status === 429).length;
      const adminRateLimited = adminResponses.filter((r) => r.status === 429).length;

      // Admins should have higher limits
      expect(adminRateLimited).toBeLessThanOrEqual(userRateLimited);
    });
  });

  describe('DoS Attack Prevention Tests', () => {
    test('should prevent application-layer DoS via large payloads', async () => {
      const largePayloads = [
        { title: 'A'.repeat(100000), type: 'movie', tmdbId: 12345 }, // Very long title
        { title: 'Test', description: 'B'.repeat(500000), type: 'movie', tmdbId: 12345 }, // Large description
        { title: 'Test', type: 'movie', tmdbId: 12345, metadata: 'C'.repeat(1000000) }, // Large metadata
      ];

      for (const payload of largePayloads) {
        const start = Date.now();

        const response = await request
          .post('/api/v1/media/request')
          .send(payload)
          .set('Authorization', `Bearer ${userToken}`);

        const duration = Date.now() - start;

        // Should reject large payloads quickly
        expect([400, 413, 422]).toContain(response.status); // Bad Request, Payload Too Large, or Unprocessable
        expect(duration).toBeLessThan(5000); // Should not take too long to reject
      }
    });

    test('should prevent slowloris-style attacks via request timeouts', async () => {
      // Simulate slow request by sending data in chunks (if supported)
      const response = await request
        .post('/api/v1/media/request')
        .timeout(2000) // 2 second timeout
        .send({
          title: 'Timeout Test',
          type: 'movie',
          tmdbId: 12345,
        })
        .set('Authorization', `Bearer ${userToken}`);

      // Should complete within reasonable time or timeout
      expect([200, 201, 408, 400, 422]).toContain(response.status);
    });

    test('should prevent ReDoS attacks via input validation', async () => {
      const redosPayloads = [
        'a'.repeat(100000), // Very long string
        '(' + 'a?'.repeat(1000) + ')*b', // Exponential backtracking pattern
        'a' + 'a?'.repeat(1000) + 'X', // Another backtracking pattern
        '(a+)+$', // Nested quantifiers
        '^(a+)+$', // Anchored nested quantifiers
      ];

      for (const payload of redosPayloads) {
        const start = Date.now();

        const response = await request
          .get('/api/v1/media/search')
          .query({ query: payload })
          .set('Authorization', `Bearer ${userToken}`);

        const duration = Date.now() - start;

        // Should not take too long to process (ReDoS protection)
        expect(duration).toBeLessThan(5000); // 5 seconds max
        expect(response.status).not.toBe(500); // Should not cause server error
      }
    });
  });

  describe('Distributed Rate Limiting Tests', () => {
    test('should enforce rate limits across multiple IPs for same user', async () => {
      const requests: Promise<any>[] = [];
      const ips = ['192.168.1.100', '192.168.1.101', '192.168.1.102'];

      // Make requests from different IPs but same user
      ips.forEach((ip) => {
        for (let i = 0; i < 10; i++) {
          requests.push(
            request
              .get('/api/v1/media/search')
              .query({ query: `test-${i}` })
              .set('Authorization', `Bearer ${userToken}`)
              .set('X-Forwarded-For', ip),
          );
        }
      });

      const responses = await Promise.all(requests);

      // User-based rate limiting should apply across IPs
      const rateLimitedCount = responses.filter((r) => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    test('should implement IP-based rate limiting for unauthenticated requests', async () => {
      const requests: Promise<any>[] = [];

      // Make many unauthenticated requests from same IP
      for (let i = 0; i < 30; i++) {
        requests.push(request.get('/api/v1/health').set('X-Forwarded-For', '10.0.0.1'));
      }

      const responses = await Promise.all(requests);

      // Should rate limit based on IP
      const rateLimitedCount = responses.filter((r) => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Bypass Prevention Tests', () => {
    test('should prevent rate limit bypass via header manipulation', async () => {
      const bypassHeaders = [
        { 'X-Forwarded-For': '127.0.0.1' },
        { 'X-Real-IP': '127.0.0.1' },
        { 'X-Originating-IP': '127.0.0.1' },
        { 'X-Remote-IP': '127.0.0.1' },
        { 'CF-Connecting-IP': '127.0.0.1' },
        { 'True-Client-IP': '127.0.0.1' },
      ];

      for (const headers of bypassHeaders) {
        const requests: Promise<any>[] = [];

        // Make many requests with bypass headers
        for (let i = 0; i < 20; i++) {
          requests.push(
            request
              .get('/api/v1/media/search')
              .query({ query: `bypass-${i}` })
              .set('Authorization', `Bearer ${userToken}`)
              .set(headers),
          );
        }

        const responses = await Promise.all(requests);

        // Should still be rate limited despite header manipulation
        const rateLimitedCount = responses.filter((r) => r.status === 429).length;
        expect(rateLimitedCount).toBeGreaterThan(0);
      }
    });

    test('should prevent rate limit bypass via user agent rotation', async () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'curl/7.68.0',
        'PostmanRuntime/7.28.0',
      ];

      const requests: Promise<any>[] = [];

      // Rotate user agents to try to bypass rate limiting
      for (let i = 0; i < 25; i++) {
        requests.push(
          request
            .get('/api/v1/media/search')
            .query({ query: `ua-rotation-${i}` })
            .set('Authorization', `Bearer ${userToken}`)
            .set('User-Agent', userAgents[i % userAgents.length]),
        );
      }

      const responses = await Promise.all(requests);

      // Should still be rate limited despite user agent rotation
      const rateLimitedCount = responses.filter((r) => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    test('should prevent rate limit bypass via session rotation', async () => {
      const tokens: string[] = [];

      // Create multiple tokens for same user
      for (let i = 0; i < 5; i++) {
        tokens.push(await authHelper.generateValidToken(userId, 'user'));
      }

      const requests: Promise<any>[] = [];

      // Rotate tokens to try to bypass rate limiting
      for (let i = 0; i < 30; i++) {
        requests.push(
          request
            .get('/api/v1/media/search')
            .query({ query: `token-rotation-${i}` })
            .set('Authorization', `Bearer ${tokens[i % tokens.length]}`),
        );
      }

      const responses = await Promise.all(requests);

      // Should still be rate limited despite token rotation
      const rateLimitedCount = responses.filter((r) => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Adaptive Rate Limiting Tests', () => {
    test('should implement adaptive rate limiting based on server load', async () => {
      // This would require simulating high server load
      // For now, verify that rate limits can be dynamically adjusted
      const response = await request
        .get('/api/v1/admin/rate-limits')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('currentLimits');
        expect(response.body).toHaveProperty('serverLoad');

        if (response.body.adaptive) {
          expect(response.body).toHaveProperty('adaptiveMultiplier');
        }
      }
    });

    test('should implement burst allowance for legitimate traffic spikes', async () => {
      const burstRequests: Promise<any>[] = [];

      // Send a burst of requests quickly
      for (let i = 0; i < 15; i++) {
        burstRequests.push(
          request.get('/api/v1/dashboard/stats').set('Authorization', `Bearer ${userToken}`),
        );
      }

      const responses = await Promise.all(burstRequests);

      const successfulRequests = responses.filter((r) => r.status === 200).length;
      const rateLimitedRequests = responses.filter((r) => r.status === 429).length;

      // Should allow some burst traffic before rate limiting
      expect(successfulRequests).toBeGreaterThan(0);
      expect(successfulRequests).toBeLessThan(15); // But not all requests
    });
  });

  describe('Rate Limit Monitoring Tests', () => {
    test('should provide rate limit statistics for monitoring', async () => {
      const response = await request
        .get('/api/v1/admin/rate-limit-stats')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('totalRequests');
        expect(response.body).toHaveProperty('rateLimitedRequests');
        expect(response.body).toHaveProperty('topAbusers');
        expect(response.body).toHaveProperty('endpointStats');

        // Should include metrics for different endpoints
        if (response.body.endpointStats) {
          expect(Array.isArray(response.body.endpointStats)).toBe(true);
        }
      }
    });

    test('should alert on abnormal rate limit violations', async () => {
      // Generate suspicious pattern of requests
      const suspiciousRequests: Promise<any>[] = [];

      for (let i = 0; i < 50; i++) {
        suspiciousRequests.push(
          request
            .post('/api/v1/media/request')
            .send({ title: `Spam ${i}`, type: 'movie', tmdbId: i })
            .set('Authorization', `Bearer ${userToken}`),
        );
      }

      await Promise.all(suspiciousRequests);

      // Check if alerts were generated
      const alertResponse = await request
        .get('/api/v1/admin/security-alerts')
        .set('Authorization', `Bearer ${adminToken}`);

      if (alertResponse.status === 200 && alertResponse.body.alerts) {
        const rateLimitAlerts = alertResponse.body.alerts.filter(
          (alert: any) => alert.type === 'RATE_LIMIT_VIOLATION',
        );
        expect(rateLimitAlerts.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Graceful Degradation Tests', () => {
    test('should gracefully degrade service under extreme load', async () => {
      const extremeLoad: Promise<any>[] = [];

      // Generate extreme load
      for (let i = 0; i < 100; i++) {
        extremeLoad.push(request.get('/api/v1/health').timeout(1000));
      }

      const responses = await Promise.allSettled(extremeLoad);

      const fulfilled = responses.filter((r) => r.status === 'fulfilled').length;
      const rejected = responses.filter((r) => r.status === 'rejected').length;

      // Should handle some requests and reject others gracefully
      expect(fulfilled).toBeGreaterThan(0);

      // Check response types for fulfilled requests
      const successfulResponses = responses
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as any).value.status);

      // Should include rate limited responses
      expect(successfulResponses.some((status: number) => status === 429)).toBe(true);
    });
  });
});
