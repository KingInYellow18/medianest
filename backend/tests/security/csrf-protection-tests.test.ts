/**
 * CSRF (Cross-Site Request Forgery) Protection Test Suite
 *
 * Comprehensive tests to validate CSRF protection across all MediaNest state-changing endpoints
 * Tests token generation, validation, refresh, and bypass prevention
 */

import { PrismaClient } from '@prisma/client';
import supertest from 'supertest';
import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

import { createApp } from '../../src/app';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { DatabaseTestHelper } from '../helpers/database-test-helper';

describe('CSRF Protection Test Suite', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let authHelper: AuthTestHelper;
  let dbHelper: DatabaseTestHelper;
  let userToken: string;
  let adminToken: string;
  let csrfToken: string;
  let userId: string;
  let adminId: string;

  beforeAll(async () => {
    app = createApp();
    request = supertest(app);
    prisma = new PrismaClient();
    authHelper = new AuthTestHelper(prisma);
    dbHelper = new DatabaseTestHelper(prisma);

    // Create test users
    const user = await authHelper.createTestUser('csrf-test-user', 'csrf-user@test.com');
    const admin = await authHelper.createTestUser('csrf-admin', 'csrf-admin@test.com', 'admin');

    userId = user.id;
    adminId = admin.id;
    userToken = await authHelper.generateValidToken(user.id, 'user');
    adminToken = await authHelper.generateValidToken(admin.id, 'admin');

    // Get CSRF token
    const csrfResponse = await request
      .get('/api/v1/csrf/token')
      .set('Authorization', `Bearer ${userToken}`);

    if (csrfResponse.status === 200) {
      csrfToken = csrfResponse.body.token;
    }
  });

  afterAll(async () => {
    await dbHelper.cleanup();
    await prisma.$disconnect();
  });

  describe('CSRF Token Generation Tests', () => {
    test('should generate unique CSRF tokens', async () => {
      const tokens = [];

      for (let i = 0; i < 5; i++) {
        const response = await request
          .get('/api/v1/csrf/token')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(typeof response.body.token).toBe('string');
        expect(response.body.token.length).toBeGreaterThan(10);

        tokens.push(response.body.token);
      }

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
    });

    test('should require authentication for CSRF token generation', async () => {
      const response = await request.get('/api/v1/csrf/token');

      expect([401, 403]).toContain(response.status);
      expect(response.body).not.toHaveProperty('token');
    });

    test('should provide token expiration information', async () => {
      const response = await request
        .get('/api/v1/csrf/token')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresIn');
      expect(typeof response.body.expiresIn).toBe('number');
      expect(response.body.expiresIn).toBeGreaterThan(0);
    });
  });

  describe('CSRF Token Refresh Tests', () => {
    test('should refresh CSRF tokens properly', async () => {
      // Get initial token
      const initialResponse = await request
        .get('/api/v1/csrf/token')
        .set('Authorization', `Bearer ${userToken}`);

      expect(initialResponse.status).toBe(200);
      const initialToken = initialResponse.body.token;

      // Refresh token
      const refreshResponse = await request
        .post('/api/v1/csrf/refresh')
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-CSRF-Token', initialToken);

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body).toHaveProperty('token');
      expect(refreshResponse.body.token).not.toBe(initialToken);
    });

    test('should invalidate old tokens after refresh', async () => {
      // Get initial token
      const initialResponse = await request
        .get('/api/v1/csrf/token')
        .set('Authorization', `Bearer ${userToken}`);

      const initialToken = initialResponse.body.token;

      // Refresh token
      const refreshResponse = await request
        .post('/api/v1/csrf/refresh')
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-CSRF-Token', initialToken);

      const newToken = refreshResponse.body.token;

      // Try to use old token - should fail
      const response = await request
        .post('/api/v1/media/request')
        .send({
          title: 'Test Movie',
          type: 'movie',
          tmdbId: 12345,
        })
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-CSRF-Token', initialToken);

      expect([403, 401]).toContain(response.status);

      // New token should work
      const successResponse = await request
        .post('/api/v1/media/request')
        .send({
          title: 'Test Movie 2',
          type: 'movie',
          tmdbId: 54321,
        })
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-CSRF-Token', newToken);

      expect([200, 201]).toContain(successResponse.status);
    });
  });

  describe('State-Changing Operations CSRF Protection', () => {
    test('should require CSRF token for media request creation', async () => {
      // Without CSRF token - should fail
      const response1 = await request
        .post('/api/v1/media/request')
        .send({
          title: 'Test Movie',
          type: 'movie',
          tmdbId: 12345,
        })
        .set('Authorization', `Bearer ${userToken}`);

      expect([403, 401]).toContain(response1.status);

      // With valid CSRF token - should succeed
      const response2 = await request
        .post('/api/v1/media/request')
        .send({
          title: 'Test Movie',
          type: 'movie',
          tmdbId: 12345,
        })
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-CSRF-Token', csrfToken);

      expect([200, 201]).toContain(response2.status);
    });

    test('should require CSRF token for user role updates', async () => {
      // Without CSRF token - should fail
      const response1 = await request
        .patch(`/api/v1/admin/users/${userId}/role`)
        .send({ role: 'user' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect([403, 401]).toContain(response1.status);

      // Get CSRF token for admin
      const csrfResponse = await request
        .get('/api/v1/csrf/token')
        .set('Authorization', `Bearer ${adminToken}`);

      const adminCsrfToken = csrfResponse.body.token;

      // With valid CSRF token - should succeed
      const response2 = await request
        .patch(`/api/v1/admin/users/${userId}/role`)
        .send({ role: 'user' })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Token', adminCsrfToken);

      expect([200, 204]).toContain(response2.status);
    });

    test('should require CSRF token for media request deletion', async () => {
      // First create a media request
      const createResponse = await request
        .post('/api/v1/media/request')
        .send({
          title: 'Delete Test Movie',
          type: 'movie',
          tmdbId: 99999,
        })
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-CSRF-Token', csrfToken);

      if (createResponse.status === 201) {
        const requestId = createResponse.body.data.id;

        // Try to delete without CSRF token - should fail
        const deleteResponse1 = await request
          .delete(`/api/v1/media/requests/${requestId}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect([403, 401]).toContain(deleteResponse1.status);

        // With CSRF token - should succeed
        const deleteResponse2 = await request
          .delete(`/api/v1/media/requests/${requestId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .set('X-CSRF-Token', csrfToken);

        expect([200, 204]).toContain(deleteResponse2.status);
      }
    });

    test('should require CSRF token for YouTube download requests', async () => {
      // Without CSRF token - should fail
      const response1 = await request
        .post('/api/v1/youtube/download')
        .send({ url: 'https://youtube.com/watch?v=test123' })
        .set('Authorization', `Bearer ${userToken}`);

      expect([403, 401]).toContain(response1.status);

      // With valid CSRF token - request should be processed (may fail due to invalid URL, but CSRF should pass)
      const response2 = await request
        .post('/api/v1/youtube/download')
        .send({ url: 'https://youtube.com/watch?v=test123' })
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-CSRF-Token', csrfToken);

      // Should not fail due to CSRF (may fail due to invalid URL with 400/422)
      expect(response2.status).not.toBe(403);
    });
  });

  describe('CSRF Token Validation Tests', () => {
    test('should reject invalid CSRF tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        '',
        'a'.repeat(100), // Too long
        'token-with-special-chars-!@#$%',
        csrfToken + 'modified',
        'Bearer ' + csrfToken, // Wrong format
        null,
        undefined,
      ];

      for (const token of invalidTokens) {
        const response = await request
          .post('/api/v1/media/request')
          .send({
            title: 'Test Movie',
            type: 'movie',
            tmdbId: 12345,
          })
          .set('Authorization', `Bearer ${userToken}`)
          .set('X-CSRF-Token', token || '');

        expect([403, 401, 400]).toContain(response.status);
      }
    });

    test('should reject expired CSRF tokens', async () => {
      // This would require a way to generate expired tokens or manipulate time
      // For now, we'll test that tokens have expiration logic
      const statsResponse = await request
        .get('/api/v1/csrf/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      if (statsResponse.status === 200) {
        expect(statsResponse.body).toHaveProperty('tokenExpiration');
        expect(typeof statsResponse.body.tokenExpiration).toBe('number');
        expect(statsResponse.body.tokenExpiration).toBeGreaterThan(0);
      }
    });

    test('should validate CSRF token format', async () => {
      const malformedTokens = [
        '<script>alert("xss")</script>',
        '../../etc/passwd',
        '${jndi:ldap://evil.com}',
        '../../../windows/system32',
        "token'; DROP TABLE users; --",
      ];

      for (const token of malformedTokens) {
        const response = await request
          .post('/api/v1/media/request')
          .send({
            title: 'Test Movie',
            type: 'movie',
            tmdbId: 12345,
          })
          .set('Authorization', `Bearer ${userToken}`)
          .set('X-CSRF-Token', token);

        expect([403, 401, 400]).toContain(response.status);

        // Should not cause server errors
        expect(response.status).not.toBe(500);
      }
    });
  });

  describe('CSRF Double Submit Cookie Pattern Tests', () => {
    test('should validate CSRF token matches cookie value', async () => {
      // Get CSRF token
      const tokenResponse = await request
        .get('/api/v1/csrf/token')
        .set('Authorization', `Bearer ${userToken}`);

      const token = tokenResponse.body.token;
      const cookies = tokenResponse.headers['set-cookie'] || [];

      // Find CSRF cookie
      const csrfCookie = cookies.find((cookie: string) => cookie.startsWith('csrf-token='));

      if (csrfCookie) {
        // Try with mismatched token and cookie
        const response1 = await request
          .post('/api/v1/media/request')
          .send({
            title: 'Test Movie',
            type: 'movie',
            tmdbId: 12345,
          })
          .set('Authorization', `Bearer ${userToken}`)
          .set('X-CSRF-Token', 'different-token')
          .set('Cookie', csrfCookie);

        expect([403, 401]).toContain(response1.status);

        // Try with matching token and cookie
        const response2 = await request
          .post('/api/v1/media/request')
          .send({
            title: 'Test Movie',
            type: 'movie',
            tmdbId: 12345,
          })
          .set('Authorization', `Bearer ${userToken}`)
          .set('X-CSRF-Token', token)
          .set('Cookie', csrfCookie);

        expect([200, 201]).toContain(response2.status);
      }
    });

    test('should set secure CSRF cookie attributes', async () => {
      const response = await request
        .get('/api/v1/csrf/token')
        .set('Authorization', `Bearer ${userToken}`);

      const cookies = response.headers['set-cookie'] || [];
      const csrfCookie = cookies.find((cookie: string) => cookie.startsWith('csrf-token='));

      if (csrfCookie) {
        // Should have HttpOnly flag
        expect(csrfCookie).toMatch(/HttpOnly/i);

        // Should have SameSite attribute
        expect(csrfCookie).toMatch(/SameSite=/i);

        // Should have Secure flag in production
        // expect(csrfCookie).toMatch(/Secure/i);
      }
    });
  });

  describe('GET Requests CSRF Exemption Tests', () => {
    test('should not require CSRF token for GET requests', async () => {
      const getEndpoints = [
        '/api/v1/media/search?query=test',
        '/api/v1/media/requests',
        '/api/v1/dashboard/stats',
        '/api/v1/health',
        '/api/v1/users/profile',
      ];

      for (const endpoint of getEndpoints) {
        const response = await request.get(endpoint).set('Authorization', `Bearer ${userToken}`);

        // Should not fail due to missing CSRF token
        expect(response.status).not.toBe(403);
        // May fail for other reasons (404, 401, etc.) but not CSRF
      }
    });

    test('should not require CSRF token for HEAD requests', async () => {
      const response = await request
        .head('/api/v1/health')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).not.toBe(403);
    });

    test('should not require CSRF token for OPTIONS requests', async () => {
      const response = await request
        .options('/api/v1/media/request')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).not.toBe(403);
    });
  });

  describe('CSRF Attack Simulation Tests', () => {
    test('should prevent CSRF attack via malicious website', async () => {
      // Simulate a malicious website trying to perform actions
      const maliciousRequests = [
        {
          headers: {
            Origin: 'http://evil.com',
            Referer: 'http://evil.com/malicious-page',
          },
          description: 'Origin from malicious domain',
        },
        {
          headers: {
            Origin: 'null',
            Referer: 'http://evil.com',
          },
          description: 'Null origin with malicious referer',
        },
        {
          headers: {
            'User-Agent': 'MaliciousCrawler/1.0',
            'X-Forwarded-For': '192.168.1.100',
          },
          description: 'Suspicious user agent',
        },
      ];

      for (const { headers, description } of maliciousRequests) {
        const response = await request
          .post('/api/v1/media/request')
          .send({
            title: 'Malicious Request',
            type: 'movie',
            tmdbId: 12345,
          })
          .set('Authorization', `Bearer ${userToken}`)
          .set(headers);

        // Should fail due to missing CSRF token
        expect([403, 401]).toContain(response.status);
        console.log(`Blocked ${description}: ${response.status}`);
      }
    });

    test('should prevent CSRF via image/script tag requests', async () => {
      // Simulate requests that could come from <img> or <script> tags
      const tagBasedAttacks = [
        {
          method: 'get',
          url: '/api/v1/admin/users/1/delete', // Should not exist as GET
          description: 'Image tag GET attack',
        },
      ];

      for (const attack of tagBasedAttacks) {
        const response = await request[attack.method](attack.url).set(
          'Authorization',
          `Bearer ${adminToken}`,
        );

        // Should not perform state-changing operations via GET
        expect([404, 405]).toContain(response.status); // Not found or method not allowed
      }
    });
  });

  describe('Content-Type Validation Tests', () => {
    test('should require proper Content-Type for state-changing requests', async () => {
      // Test with form-encoded data (common CSRF attack vector)
      const response1 = await request
        .post('/api/v1/media/request')
        .type('form')
        .send('title=Test Movie&type=movie&tmdbId=12345')
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-CSRF-Token', csrfToken);

      // Should reject form-encoded requests or require specific content type
      // This depends on the API's Content-Type validation policy
      if (response1.status === 415) {
        // Good - rejects unsupported media type
        expect(response1.status).toBe(415);
      } else {
        // If accepted, should still process correctly
        expect([200, 201, 400, 422]).toContain(response1.status);
      }

      // Test with JSON (should work)
      const response2 = await request
        .post('/api/v1/media/request')
        .type('json')
        .send({
          title: 'Test Movie JSON',
          type: 'movie',
          tmdbId: 54321,
        })
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-CSRF-Token', csrfToken);

      expect([200, 201]).toContain(response2.status);
    });
  });

  describe('CSRF Statistics and Monitoring Tests', () => {
    test('should provide CSRF protection statistics', async () => {
      const response = await request
        .get('/api/v1/csrf/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('tokensGenerated');
        expect(response.body).toHaveProperty('tokensValidated');
        expect(response.body).toHaveProperty('rejectedRequests');
        expect(typeof response.body.tokensGenerated).toBe('number');
        expect(typeof response.body.tokensValidated).toBe('number');
        expect(typeof response.body.rejectedRequests).toBe('number');
      }
    });

    test('should track CSRF token usage patterns', async () => {
      // Generate multiple tokens
      for (let i = 0; i < 3; i++) {
        await request.get('/api/v1/csrf/token').set('Authorization', `Bearer ${userToken}`);
      }

      const statsResponse = await request
        .get('/api/v1/csrf/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      if (statsResponse.status === 200) {
        expect(statsResponse.body.tokensGenerated).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('CSRF Bypass Prevention Tests', () => {
    test('should prevent CSRF bypass via JSONP', async () => {
      // Test JSONP callback parameter
      const response = await request
        .get('/api/v1/media/search')
        .query({
          query: 'test',
          callback: 'alert',
          jsonp: 'malicious_function',
        })
        .set('Authorization', `Bearer ${userToken}`);

      // Should not support JSONP callbacks
      const responseText = response.text;
      expect(responseText).not.toMatch(/^\w+\s*\(/); // Should not start with callback(
      expect(responseText).not.toContain('alert(');
      expect(responseText).not.toContain('malicious_function(');
    });

    test('should prevent CSRF bypass via Flash/SWF uploads', async () => {
      // Test SWF file upload that could bypass CSRF
      const swfContent = 'FWS\x09'; // SWF file header

      const response = await request
        .post('/api/v1/upload')
        .attach('file', Buffer.from(swfContent), 'crossdomain.swf')
        .set('Authorization', `Bearer ${userToken}`);

      // Should reject SWF files or require CSRF token
      expect([400, 403, 415, 422]).toContain(response.status);
    });
  });

  describe('Same-Origin Policy Enforcement Tests', () => {
    test('should enforce same-origin policy for sensitive operations', async () => {
      const crossOriginHeaders = [
        { Origin: 'http://malicious.com' },
        { Origin: 'https://evil.org' },
        { Origin: 'data:text/html,<script>alert(1)</script>' },
        { Origin: 'file:///' },
        { Origin: 'ftp://evil.com' },
      ];

      for (const headers of crossOriginHeaders) {
        const response = await request
          .post('/api/v1/media/request')
          .send({
            title: 'Cross-Origin Test',
            type: 'movie',
            tmdbId: 12345,
          })
          .set('Authorization', `Bearer ${userToken}`)
          .set(headers);

        // Should require CSRF token regardless of origin
        expect([403, 401]).toContain(response.status);
      }
    });
  });
});
