/**
 * SQL Injection Prevention Test Suite
 *
 * Comprehensive tests to validate SQL injection prevention across all MediaNest endpoints
 * Tests both PostgreSQL and Prisma ORM security measures
 */

import { PrismaClient } from '@prisma/client';
import supertest from 'supertest';
import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

import { createApp } from '../../src/app';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { DatabaseTestHelper } from '../helpers/database-test-helper';

describe('SQL Injection Prevention Tests', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let authHelper: AuthTestHelper;
  let dbHelper: DatabaseTestHelper;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = createApp();
    request = supertest(app);
    prisma = new PrismaClient();
    authHelper = new AuthTestHelper(prisma);
    dbHelper = new DatabaseTestHelper(prisma);

    // Create test users
    const user = await authHelper.createTestUser('user', 'user@test.com');
    const admin = await authHelper.createTestUser('admin', 'admin@test.com', 'admin');

    userToken = await authHelper.generateValidToken(user.id, 'user');
    adminToken = await authHelper.generateValidToken(admin.id, 'admin');
  });

  afterAll(async () => {
    await dbHelper.cleanup();
    await prisma.$disconnect();
  });

  describe('Authentication Endpoint SQL Injection Tests', () => {
    test('should prevent SQL injection in login username field', async () => {
      const sqlInjectionPayloads = [
        "admin'; DROP TABLE users; --",
        "admin' OR '1'='1' --",
        "admin' UNION SELECT password FROM users WHERE username='admin' --",
        "admin' AND (SELECT COUNT(*) FROM users) > 0 --",
        "'; UPDATE users SET password='hacked' WHERE username='admin'; --",
        "admin'; INSERT INTO users (username, password) VALUES ('hacker', 'pass'); --",
        "admin' OR username LIKE '%' --",
        "admin' OR 1=1 LIMIT 1 --",
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request.post('/api/v1/auth/plex/verify').send({
          pin: '1234',
          username: payload,
        });

        // Should reject malicious input, not cause database error
        expect([400, 401, 422]).toContain(response.status);
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('users');

        // Verify response doesn't contain SQL error messages
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toMatch(/syntax error|sql|database error|postgresql/i);
      }
    });

    test('should prevent SQL injection in session lookup', async () => {
      const sessionInjectionPayloads = [
        "' OR '1'='1",
        "'; SELECT * FROM users; --",
        "' UNION SELECT session_token FROM sessions --",
        "' OR session_id IS NOT NULL --",
      ];

      for (const payload of sessionInjectionPayloads) {
        const response = await request
          .get('/api/v1/auth/session')
          .set('Authorization', `Bearer ${payload}`);

        expect([401, 403]).toContain(response.status);
        expect(response.body).not.toHaveProperty('users');
        expect(response.body).not.toHaveProperty('sessions');
      }
    });
  });

  describe('Media Search SQL Injection Tests', () => {
    test('should prevent SQL injection in media search queries', async () => {
      const searchInjectionPayloads = [
        "'; DROP TABLE media_requests; --",
        "movie' OR '1'='1' --",
        "movie' UNION SELECT api_key FROM configuration --",
        "movie'; UPDATE media_requests SET status='approved'; --",
        "movie' AND (SELECT COUNT(*) FROM users WHERE role='admin') > 0 --",
        "'; SELECT password FROM users WHERE username='admin'; --",
        "movie' OR tmdb_id IN (SELECT tmdb_id FROM media_requests) --",
      ];

      for (const payload of searchInjectionPayloads) {
        const response = await request
          .get('/api/v1/media/search')
          .query({ query: payload })
          .set('Authorization', `Bearer ${userToken}`);

        // Should handle malicious input gracefully
        expect(response.status).not.toBe(500);
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('api_key');

        if (response.status === 200) {
          expect(Array.isArray(response.body.data)).toBe(true);
          // Results should be properly filtered, not expose internal data
          response.body.data?.forEach((item: any) => {
            expect(item).not.toHaveProperty('password');
            expect(item).not.toHaveProperty('api_key');
            expect(item).not.toHaveProperty('session_token');
          });
        }
      }
    });

    test('should prevent SQL injection in media type filters', async () => {
      const mediaTypeInjectionPayloads = [
        "movie'; DELETE FROM media_requests; --",
        "tv' OR type IS NOT NULL --",
        "movie' UNION SELECT 'injected' as title --",
      ];

      for (const payload of mediaTypeInjectionPayloads) {
        const response = await request
          .get(`/api/v1/media/${payload}/123`)
          .set('Authorization', `Bearer ${userToken}`);

        expect([400, 404, 422]).toContain(response.status);
        expect(response.body).not.toHaveProperty('users');
        expect(response.body).not.toHaveProperty('api_key');
      }
    });
  });

  describe('User Management SQL Injection Tests', () => {
    test('should prevent SQL injection in user ID parameters', async () => {
      const userIdInjectionPayloads = [
        "1'; DELETE FROM users WHERE id != 1; --",
        "1' OR '1'='1' --",
        '1 UNION SELECT password FROM users --',
        "1'; UPDATE users SET role='admin'; --",
        "(SELECT id FROM users WHERE role='admin')",
      ];

      for (const payload of userIdInjectionPayloads) {
        const response = await request
          .patch(`/api/v1/admin/users/${payload}/role`)
          .send({ role: 'user' })
          .set('Authorization', `Bearer ${adminToken}`);

        expect([400, 404, 422]).toContain(response.status);
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('users');
      }
    });

    test('should prevent SQL injection in user search/filters', async () => {
      const userSearchInjectionPayloads = [
        "admin' OR role='admin' --",
        "'; SELECT * FROM users; --",
        "user' UNION SELECT password as email FROM users --",
      ];

      for (const payload of userSearchInjectionPayloads) {
        const response = await request
          .get('/api/v1/admin/users')
          .query({ search: payload })
          .set('Authorization', `Bearer ${adminToken}`);

        if (response.status === 200) {
          expect(Array.isArray(response.body.data)).toBe(true);
          // Ensure no sensitive data is leaked
          response.body.data?.forEach((user: any) => {
            expect(user).not.toHaveProperty('password');
            expect(user).not.toHaveProperty('session_token');
          });
        } else {
          expect([400, 422]).toContain(response.status);
        }
      }
    });
  });

  describe('Media Request SQL Injection Tests', () => {
    test('should prevent SQL injection in media request creation', async () => {
      const requestInjectionPayloads = {
        titles: [
          "Movie'; DELETE FROM media_requests; --",
          "Movie' OR '1'='1' --",
          "'; INSERT INTO users (username, role) VALUES ('hacker', 'admin'); --",
        ],
        descriptions: [
          "Description'; UPDATE media_requests SET status='approved'; --",
          "Desc' UNION SELECT password FROM users --",
        ],
        imdbIds: ["tt123456'; DROP TABLE media_requests; --", "tt123456' OR '1'='1' --"],
      };

      // Test title injection
      for (const title of requestInjectionPayloads.titles) {
        const response = await request
          .post('/api/v1/media/request')
          .send({
            title,
            type: 'movie',
            tmdbId: 12345,
          })
          .set('Authorization', `Bearer ${userToken}`);

        if (response.status === 201) {
          // If request succeeds, verify data is properly sanitized
          expect(response.body.data.title).not.toContain('DELETE');
          expect(response.body.data.title).not.toContain('DROP');
        } else {
          expect([400, 422]).toContain(response.status);
        }
      }

      // Test description injection
      for (const description of requestInjectionPayloads.descriptions) {
        const response = await request
          .post('/api/v1/media/request')
          .send({
            title: 'Test Movie',
            description,
            type: 'movie',
            tmdbId: 12345,
          })
          .set('Authorization', `Bearer ${userToken}`);

        if (response.status === 201) {
          expect(response.body.data.description).not.toContain('UPDATE');
          expect(response.body.data.description).not.toContain('UNION');
        } else {
          expect([400, 422]).toContain(response.status);
        }
      }
    });

    test('should prevent SQL injection in request ID parameters', async () => {
      const requestIdInjectionPayloads = [
        "1'; DELETE FROM media_requests; --",
        '1 OR 1=1 --',
        "1 UNION SELECT id FROM media_requests WHERE status='pending' --",
      ];

      for (const payload of requestIdInjectionPayloads) {
        const response = await request
          .get(`/api/v1/media/requests/${payload}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect([400, 404, 422]).toContain(response.status);
        expect(response.body).not.toHaveProperty('media_requests');
      }
    });
  });

  describe('YouTube Download SQL Injection Tests', () => {
    test('should prevent SQL injection in YouTube URL validation', async () => {
      const urlInjectionPayloads = [
        "https://youtube.com/watch?v=123'; DELETE FROM downloads; --",
        "https://youtube.com/watch?v=123' OR '1'='1' --",
        "'; INSERT INTO downloads (status) VALUES ('completed'); --",
      ];

      for (const payload of urlInjectionPayloads) {
        const response = await request
          .post('/api/v1/youtube/download')
          .send({ url: payload })
          .set('Authorization', `Bearer ${userToken}`);

        expect([400, 422]).toContain(response.status);
        expect(response.body).not.toHaveProperty('downloads');
      }
    });

    test('should prevent SQL injection in download ID parameters', async () => {
      const downloadIdInjectionPayloads = [
        "1'; UPDATE downloads SET status='completed'; --",
        '1 OR download_id IS NOT NULL --',
      ];

      for (const payload of downloadIdInjectionPayloads) {
        const response = await request
          .get(`/api/v1/youtube/downloads/${payload}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect([400, 404, 422]).toContain(response.status);
      }
    });
  });

  describe('Admin Dashboard SQL Injection Tests', () => {
    test('should prevent SQL injection in statistics queries', async () => {
      const statsInjectionPayloads = [
        "users'; DELETE FROM users; --",
        "requests' OR '1'='1' --",
        "downloads' UNION SELECT password FROM users --",
      ];

      for (const payload of statsInjectionPayloads) {
        const response = await request
          .get('/api/v1/admin/stats')
          .query({ type: payload })
          .set('Authorization', `Bearer ${adminToken}`);

        if (response.status === 200) {
          // Verify response doesn't contain sensitive data
          expect(response.body).not.toHaveProperty('password');
          expect(response.body).not.toHaveProperty('session_token');
          expect(response.body).not.toHaveProperty('api_key');
        } else {
          expect([400, 422]).toContain(response.status);
        }
      }
    });

    test('should prevent SQL injection in service status queries', async () => {
      const serviceInjectionPayloads = [
        "plex'; DELETE FROM services; --",
        "overseerr' OR service_name IS NOT NULL --",
      ];

      for (const payload of serviceInjectionPayloads) {
        const response = await request
          .get(`/api/v1/dashboard/status/${payload}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect([400, 404, 422]).toContain(response.status);
      }
    });
  });

  describe('Webhook SQL Injection Tests', () => {
    test('should prevent SQL injection in webhook payload processing', async () => {
      const webhookPayloads = [
        {
          event: "request.created'; DELETE FROM media_requests; --",
          data: { id: "123'; DROP TABLE users; --" },
        },
        {
          event: 'request.approved',
          data: {
            id: "123' OR '1'='1' --",
            title: "Movie'; UPDATE users SET role='admin'; --",
          },
        },
      ];

      for (const payload of webhookPayloads) {
        const response = await request
          .post('/api/v1/webhooks/overseerr')
          .send(payload)
          .set('X-Webhook-Signature', 'test-signature');

        // Should handle malicious webhook data safely
        expect([400, 401, 422]).toContain(response.status);
        expect(response.body).not.toHaveProperty('users');
        expect(response.body).not.toHaveProperty('media_requests');
      }
    });
  });

  describe('Time-Based SQL Injection Tests', () => {
    test('should prevent time-based blind SQL injection attacks', async () => {
      const timingAttackPayloads = [
        "admin'; WAITFOR DELAY '00:00:05'; --",
        "admin' AND (SELECT CASE WHEN (1=1) THEN pg_sleep(5) ELSE 0 END); --",
        "admin'; SELECT pg_sleep(5); --",
      ];

      for (const payload of timingAttackPayloads) {
        const startTime = Date.now();

        const response = await request.post('/api/v1/auth/plex/verify').send({
          pin: '1234',
          username: payload,
        });

        const duration = Date.now() - startTime;

        // Response should not be delayed by SQL injection
        expect(duration).toBeLessThan(3000); // Should complete in under 3 seconds
        expect([400, 401, 422]).toContain(response.status);
      }
    });
  });

  describe('Boolean-Based Blind SQL Injection Tests', () => {
    test('should prevent boolean-based blind SQL injection', async () => {
      const booleanAttackPayloads = [
        "admin' AND (SELECT COUNT(*) FROM users WHERE role='admin') > 0 --",
        "admin' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE username='admin') = 'a' --",
        "admin' AND ASCII(SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)) > 100 --",
      ];

      for (const payload of booleanAttackPayloads) {
        const response = await request
          .get('/api/v1/media/search')
          .query({ query: payload })
          .set('Authorization', `Bearer ${userToken}`);

        // Should not leak information through response differences
        if (response.status === 200) {
          expect(response.body).toHaveProperty('data');
          expect(Array.isArray(response.body.data)).toBe(true);
          // Results should be based on actual search, not SQL condition
          expect(response.body.data.length).toBe(0); // No results for malicious query
        } else {
          expect([400, 422]).toContain(response.status);
        }
      }
    });
  });

  describe('Second-Order SQL Injection Tests', () => {
    test('should prevent second-order SQL injection attacks', async () => {
      // First, try to store malicious data
      const maliciousTitle = "Movie'; DELETE FROM media_requests WHERE '1'='1";

      const createResponse = await request
        .post('/api/v1/media/request')
        .send({
          title: maliciousTitle,
          type: 'movie',
          tmdbId: 12345,
        })
        .set('Authorization', `Bearer ${userToken}`);

      if (createResponse.status === 201) {
        const requestId = createResponse.body.data.id;

        // Then try to retrieve it (second-order attack vector)
        const retrieveResponse = await request
          .get(`/api/v1/media/requests/${requestId}`)
          .set('Authorization', `Bearer ${userToken}`);

        if (retrieveResponse.status === 200) {
          // Verify the stored data doesn't cause SQL injection when retrieved
          expect(retrieveResponse.body.data.title).not.toContain('DELETE');
          // And that it doesn't break other requests
          const listResponse = await request
            .get('/api/v1/media/requests')
            .set('Authorization', `Bearer ${userToken}`);

          expect(listResponse.status).toBe(200);
          expect(Array.isArray(listResponse.body.data)).toBe(true);
        }
      }
    });
  });

  describe('ORM-Specific SQL Injection Tests', () => {
    test('should prevent Prisma ORM injection vulnerabilities', async () => {
      // Test raw query vulnerabilities
      const rawQueryPayloads = [
        { userId: '1; DELETE FROM users; --' },
        { userId: '1 OR 1=1' },
        { status: "pending'; UPDATE media_requests SET status='approved'; --" },
      ];

      for (const payload of rawQueryPayloads) {
        const response = await request
          .get('/api/v1/media/requests')
          .query(payload)
          .set('Authorization', `Bearer ${userToken}`);

        if (response.status === 200) {
          // Verify results are properly filtered
          expect(Array.isArray(response.body.data)).toBe(true);
          response.body.data?.forEach((item: any) => {
            expect(typeof item.id).toBe('number');
            expect(item).not.toHaveProperty('password');
          });
        } else {
          expect([400, 422]).toContain(response.status);
        }
      }
    });

    test('should validate parameterized query safety', async () => {
      // Verify that legitimate queries work correctly
      const legitimateQueries = [
        { query: 'Avengers' },
        { query: 'Breaking Bad' },
        { query: 'The Matrix' },
      ];

      for (const query of legitimateQueries) {
        const response = await request
          .get('/api/v1/media/search')
          .query(query)
          .set('Authorization', `Bearer ${userToken}`);

        expect([200, 404]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body).toHaveProperty('data');
          expect(Array.isArray(response.body.data)).toBe(true);
        }
      }
    });
  });

  describe('Database Error Handling Tests', () => {
    test('should not expose database errors to clients', async () => {
      // Test various malformed inputs that might cause DB errors
      const malformedInputs = [
        { tmdbId: 'not-a-number' },
        { id: '99999999999999999999' }, // Extremely large number
        { date: 'not-a-date' },
        { role: {} }, // Object instead of string
      ];

      for (const input of malformedInputs) {
        const response = await request
          .post('/api/v1/media/request')
          .send({
            title: 'Test Movie',
            type: 'movie',
            ...input,
          })
          .set('Authorization', `Bearer ${userToken}`);

        // Should return proper error response, not database error
        expect([400, 422]).toContain(response.status);

        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toMatch(/postgresql|database error|sql|constraint|foreign key/i);
        expect(responseText).not.toContain('prisma');
        expect(responseText).not.toMatch(/error:\s*invalid input/i);
      }
    });
  });
});
