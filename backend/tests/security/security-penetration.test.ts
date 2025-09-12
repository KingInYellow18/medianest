/**
 * SECURITY PENETRATION TESTING SUITE
 *
 * Comprehensive security validation and penetration testing for MediaNest
 * Tests authentication bypass, authorization flaws, injection attacks, and more
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/app';

describe('Security Penetration Testing Suite', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;

  beforeEach(async () => {
    app = createApp();
    request = supertest(app);
  });

  describe('Authentication Security Tests', () => {
    test('should prevent authentication bypass attempts', async () => {
      const bypassAttempts = [
        { path: '/api/auth/admin', headers: { 'x-forwarded-for': '127.0.0.1' } },
        { path: '/api/auth/admin', headers: { host: 'localhost' } },
        { path: '/api/auth/admin', headers: { 'x-real-ip': '127.0.0.1' } },
        { path: '/api/auth/../admin', headers: {} },
        { path: '/api/auth/admin%00', headers: {} },
      ];

      for (const attempt of bypassAttempts) {
        const response = await request.get(attempt.path).set(attempt.headers);

        expect([401, 403, 404]).toContain(response.status);
      }
    });

    test('should prevent JWT token manipulation', async () => {
      const maliciousTokens = [
        'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9.', // Algorithm: none
        'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9.invalid', // Invalid signature
        'Bearer ..', // Malformed token
        'Bearer ' + 'A'.repeat(10000), // Extremely long token
        '', // Empty token
        'Basic YWRtaW46cGFzc3dvcmQ=', // Wrong auth type
      ];

      for (const token of maliciousTokens) {
        const response = await request.get('/api/dashboard').set('Authorization', token);

        expect([401, 403, 400]).toContain(response.status);
      }
    });

    test('should prevent session fixation attacks', async () => {
      // Attempt to use a fixed session ID
      const response1 = await request
        .post('/api/auth/login')
        .set('Cookie', 'sessionId=fixed-session-id')
        .send({ username: 'testuser', password: 'wrongpass' });

      expect(response1.status).toBe(401);

      // Ensure session ID changes after failed login
      const cookies = response1.headers['set-cookie'];
      if (cookies) {
        expect(
          cookies.some((cookie: string) => cookie.includes('sessionId=fixed-session-id')),
        ).toBe(false);
      }
    });

    test('should prevent brute force attacks', async () => {
      const attempts = Array(20)
        .fill(null)
        .map((_, i) =>
          request.post('/api/auth/login').send({ username: 'admin', password: `wrongpass${i}` }),
        );

      const responses = await Promise.all(attempts);

      // Should start rate limiting after several failed attempts
      const later_responses = responses.slice(-5);
      const hasRateLimit = later_responses.some((res) => res.status === 429);
      expect(hasRateLimit).toBe(true);
    });
  });

  describe('Authorization Security Tests', () => {
    test('should prevent privilege escalation via parameter pollution', async () => {
      const maliciousRequests = [
        { body: { role: 'admin', userId: '123' } },
        { body: { role: ['user', 'admin'], userId: '123' } },
        { query: '?role=user&role=admin&userId=123' },
        { body: { 'user.role': 'admin', userId: '123' } },
        { body: { '__proto__.role': 'admin', userId: '123' } },
      ];

      for (const maliciousReq of maliciousRequests) {
        const response = await request
          .post('/api/admin/users')
          .send(maliciousReq.body || {})
          .query(maliciousReq.query || '');

        expect([401, 403, 400]).toContain(response.status);
      }
    });

    test('should prevent horizontal privilege escalation', async () => {
      // User trying to access another user's data
      const response = await request
        .get('/api/users/456/profile') // Accessing user 456's profile
        .set('Authorization', 'Bearer valid-jwt-for-user-123');

      expect([401, 403]).toContain(response.status);
    });

    test('should prevent vertical privilege escalation', async () => {
      // Regular user trying to access admin endpoints
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/settings',
        '/api/admin/system',
        '/api/admin/logs',
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request
          .get(endpoint)
          .set('Authorization', 'Bearer valid-jwt-for-regular-user');

        expect([401, 403]).toContain(response.status);
      }
    });
  });

  describe('Injection Attack Tests', () => {
    test('should prevent SQL injection attacks', async () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1' --",
        "' UNION SELECT password FROM users --",
        "admin'/*",
        "' AND 1=CONVERT(int, (SELECT COUNT(*) FROM users)) --",
      ];

      for (const payload of sqlPayloads) {
        const response = await request.get('/api/media/search').query({ q: payload });

        expect(response.status).not.toBe(500); // Should not cause server error
        expect(response.body).not.toHaveProperty('password');
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
          .post('/api/auth/login')
          .send({ username: 'admin', password: payload });

        expect(response.status).toBe(401);
      }
    });

    test('should prevent command injection attacks', async () => {
      const commandPayloads = [
        '; cat /etc/passwd',
        '| whoami',
        '& ls -la',
        '`id`',
        '$(cat /etc/hosts)',
      ];

      for (const payload of commandPayloads) {
        const response = await request
          .post('/api/media/download')
          .send({ url: `https://youtube.com/watch?v=test${payload}` });

        expect([400, 422]).toContain(response.status);
      }
    });

    test('should prevent LDAP injection attacks', async () => {
      const ldapPayloads = ['*', '*)(&', '*)(uid=*', '*)((|uid=*', '*(|(password=*))'];

      for (const payload of ldapPayloads) {
        const response = await request
          .post('/api/auth/ldap-login')
          .send({ username: payload, password: 'test' });

        expect([400, 401]).toContain(response.status);
      }
    });
  });

  describe('Cross-Site Scripting (XSS) Tests', () => {
    test('should prevent stored XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '"><script>document.cookie</script>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert("xss")',
      ];

      for (const payload of xssPayloads) {
        const response = await request.post('/api/media/request').send({
          title: payload,
          description: payload,
          imdbId: 'tt1234567',
        });

        if (response.status === 200) {
          // If request succeeds, verify XSS payload is sanitized
          expect(response.body.data?.title).not.toContain('<script>');
          expect(response.body.data?.description).not.toContain('<script>');
        }
      }
    });

    test('should prevent reflected XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '%3Cscript%3Ealert("xss")%3C/script%3E',
        '<iframe src="javascript:alert(1)"></iframe>',
      ];

      for (const payload of xssPayloads) {
        const response = await request.get('/api/search').query({ q: payload });

        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('javascript:');
      }
    });
  });

  describe('Cross-Site Request Forgery (CSRF) Tests', () => {
    test('should prevent CSRF attacks on state-changing operations', async () => {
      const stateChangingEndpoints = [
        { method: 'post', path: '/api/media/request' },
        { method: 'put', path: '/api/users/123/profile' },
        { method: 'delete', path: '/api/media/123' },
        { method: 'post', path: '/api/admin/users' },
      ];

      for (const endpoint of stateChangingEndpoints) {
        const response = await request[endpoint.method](endpoint.path).send({ test: 'data' });

        // Should require CSRF token for state-changing operations
        expect([403, 401]).toContain(response.status);
      }
    });

    test('should validate CSRF token properly', async () => {
      const invalidTokens = [
        'invalid-token',
        '',
        'Bearer jwt-token', // Wrong format
        'token-from-different-user',
      ];

      for (const token of invalidTokens) {
        const response = await request
          .post('/api/media/request')
          .set('X-CSRF-Token', token)
          .send({ title: 'Test Movie' });

        expect([401, 403]).toContain(response.status);
      }
    });
  });

  describe('Server-Side Request Forgery (SSRF) Tests', () => {
    test('should prevent SSRF attacks via URL parameters', async () => {
      const ssrfPayloads = [
        'http://localhost:8080/admin',
        'http://127.0.0.1:22',
        'file:///etc/passwd',
        'ftp://internal-server/files',
        'http://169.254.169.254/latest/meta-data/', // AWS metadata
        'http://metadata.google.internal/computeMetadata/v1/', // GCP metadata
        'gopher://localhost:8080/_GET%20/admin',
      ];

      for (const payload of ssrfPayloads) {
        const response = await request.post('/api/media/import').send({ url: payload });

        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe('File Upload Security Tests', () => {
    test('should prevent malicious file uploads', async () => {
      const maliciousFiles = [
        { filename: 'shell.php', content: '<?php system($_GET["cmd"]); ?>' },
        { filename: 'script.jsp', content: '<% Runtime.exec("cmd"); %>' },
        { filename: 'test.svg', content: '<svg><script>alert(1)</script></svg>' },
        { filename: '../../etc/passwd', content: 'root:x:0:0:root' },
        { filename: 'test.exe', content: 'MZ\x90\x00\x03\x00\x00\x00' },
      ];

      for (const file of maliciousFiles) {
        const response = await request
          .post('/api/upload')
          .attach('file', Buffer.from(file.content), file.filename);

        expect([400, 422, 415]).toContain(response.status);
      }
    });

    test('should prevent file path traversal', async () => {
      const traversalPaths = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        '....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      ];

      for (const path of traversalPaths) {
        const response = await request.get(`/api/files/${path}`);

        expect([400, 403, 404]).toContain(response.status);
      }
    });
  });

  describe('Rate Limiting and DoS Prevention', () => {
    test('should prevent application-layer DoS attacks', async () => {
      const heavyRequests = Array(50)
        .fill(null)
        .map(() =>
          request.post('/api/media/search').send({
            query: 'A'.repeat(10000), // Very long search query
            filters: Array(1000).fill('filter'), // Too many filters
          }),
        );

      const responses = await Promise.allSettled(heavyRequests);

      // Should start rate limiting or rejecting requests
      const rejectedCount = responses.filter(
        (r) => r.status === 'fulfilled' && [429, 400].includes((r.value as any).status),
      ).length;

      expect(rejectedCount).toBeGreaterThan(0);
    });

    test('should prevent regex DoS (ReDoS) attacks', async () => {
      const redosPayloads = [
        'a'.repeat(100000),
        '(' + 'a?'.repeat(1000) + ')*',
        'a' + 'a?'.repeat(1000) + 'b',
      ];

      for (const payload of redosPayloads) {
        const startTime = Date.now();

        const response = await request.get('/api/search').query({ q: payload });

        const duration = Date.now() - startTime;

        // Should not take too long to process (timeout protection)
        expect(duration).toBeLessThan(5000); // 5 seconds max
      }
    });
  });

  describe('Information Disclosure Tests', () => {
    test('should prevent sensitive information leakage in errors', async () => {
      const response = await request.get('/api/nonexistent-endpoint');

      expect(response.status).toBe(404);

      // Should not reveal sensitive information
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toMatch(/password|secret|key|token|database|internal/i);
    });

    test('should prevent stack trace exposure', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({ username: null, password: undefined }); // Cause internal error

      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('Error:');
      expect(responseText).not.toContain('at ');
      expect(responseText).not.toMatch(/\.js:\d+:\d+/);
    });

    test('should prevent directory listing', async () => {
      const directories = [
        '/api/',
        '/uploads/',
        '/static/',
        '/assets/',
        '/.git/',
        '/node_modules/',
      ];

      for (const dir of directories) {
        const response = await request.get(dir);

        expect(response.status).not.toBe(200);
        expect(response.text).not.toContain('Index of');
      }
    });
  });

  describe('Business Logic Security Tests', () => {
    test('should prevent race condition attacks', async () => {
      // Simulate concurrent requests that might cause race conditions
      const concurrentRequests = Array(10)
        .fill(null)
        .map(() => request.post('/api/media/request').send({ title: 'Race Condition Test Movie' }));

      const responses = await Promise.all(concurrentRequests);

      // Should handle concurrent requests gracefully
      const successCount = responses.filter((r) => r.status === 200).length;
      expect(successCount).toBeLessThanOrEqual(1); // Only one should succeed for duplicate requests
    });

    test('should prevent integer overflow attacks', async () => {
      const overflowValues = [
        Number.MAX_SAFE_INTEGER,
        '9'.repeat(100),
        -Number.MAX_SAFE_INTEGER,
        'Infinity',
        'NaN',
      ];

      for (const value of overflowValues) {
        const response = await request.post('/api/user/update').send({ userId: value });

        expect([400, 422]).toContain(response.status);
      }
    });

    test('should validate business rule enforcement', async () => {
      // Test business logic that might be bypassed
      const response = await request
        .post('/api/media/approve-all')
        .send({ bypass: true, override: true });

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Security Headers Tests', () => {
    test('should include security headers in responses', async () => {
      const response = await request.get('/api/health');

      // Check for essential security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers).toHaveProperty('strict-transport-security');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should prevent content type sniffing', async () => {
      const response = await request.get('/api/media/thumbnail/test.jpg');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});
