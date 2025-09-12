/**
 * AUTHENTICATION API INTEGRATION TESTS
 *
 * Comprehensive integration tests for authentication endpoints
 * Covers Plex OAuth flow, session management, CSRF protection
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createServer } from '../../src/server';
import { DatabaseTestHelper } from '../helpers/database-test-helper';
import { AuthTestHelper } from '../helpers/auth-test-helper';

const prisma = new PrismaClient();
let app: any;
let server: any;
let dbHelper: DatabaseTestHelper;
let authHelper: AuthTestHelper;

describe('Authentication API Integration Tests', () => {
  beforeAll(async () => {
    dbHelper = new DatabaseTestHelper();
    authHelper = new AuthTestHelper();

    // Setup test database and server
    await dbHelper.setupTestDatabase();
    app = await createServer();
    server = app.listen(0);
  });

  afterAll(async () => {
    await server?.close();
    await dbHelper.cleanupTestDatabase();
    await authHelper.disconnect();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await dbHelper.seedTestData();
  });

  describe('POST /api/v1/auth/plex/pin', () => {
    test('should generate Plex PIN successfully', async () => {
      const response = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('code');
      expect(response.body.data.code).toMatch(/^\d{4}$/);
      expect(response.body.data).toHaveProperty('product');
      expect(response.body.data).toHaveProperty('expiresIn');
      expect(response.body.data.expiresIn).toBe(900); // 15 minutes
    });

    test('should handle Plex API timeout gracefully', async () => {
      // Mock Plex API timeout
      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          generatePin: vi.fn().mockRejectedValue(new Error('TIMEOUT')),
        },
      }));

      const response = await request(app).post('/api/v1/auth/plex/pin').expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('service unavailable');
    });

    test('should validate request rate limiting', async () => {
      // Make multiple rapid requests
      const requests = Array(10)
        .fill(null)
        .map(() => request(app).post('/api/v1/auth/plex/pin'));

      const responses = await Promise.allSettled(requests);
      const statusCodes = responses.map((result) =>
        result.status === 'fulfilled' ? result.value.status : 500,
      );

      // Should have some rate limited responses
      expect(statusCodes.filter((code) => code === 429).length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/auth/plex/verify', () => {
    test('should verify Plex PIN and create session', async () => {
      // First generate a PIN
      const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      const pinId = pinResponse.body.data.id;

      // Mock successful PIN verification
      const verifyResponse = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId,
          code: pinResponse.body.data.code,
        })
        .expect(200);

      expect(verifyResponse.body).toHaveProperty('success', true);
      expect(verifyResponse.body.data).toHaveProperty('user');
      expect(verifyResponse.body.data).toHaveProperty('tokens');
      expect(verifyResponse.body.data.tokens).toHaveProperty('accessToken');
      expect(verifyResponse.body.data.tokens).toHaveProperty('refreshToken');

      // Verify session cookie is set
      const cookies = verifyResponse.get('Set-Cookie');
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => cookie.includes('session'))).toBe(true);
    });

    test('should reject invalid PIN', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'invalid-pin-id',
          code: '1234',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid PIN');
    });

    test('should reject expired PIN', async () => {
      // Generate PIN and wait for expiration (mocked)
      const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      // Mock expired PIN
      vi.setSystemTime(new Date(Date.now() + 16 * 60 * 1000)); // 16 minutes later

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: pinResponse.body.data.id,
          code: pinResponse.body.data.code,
        })
        .expect(400);

      expect(response.body.error).toContain('expired');
      vi.useRealTimers();
    });

    test('should validate CSRF token on verify', async () => {
      const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      // Attempt verification without CSRF token
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: pinResponse.body.data.id,
          code: pinResponse.body.data.code,
        })
        .expect(403);

      expect(response.body.error).toContain('CSRF');
    });

    test('should handle concurrent PIN verifications', async () => {
      const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      const pinId = pinResponse.body.data.id;
      const code = pinResponse.body.data.code;

      // Create multiple concurrent verification attempts
      const verifyRequests = Array(5)
        .fill(null)
        .map(() => request(app).post('/api/v1/auth/plex/verify').send({ pinId, code }));

      const responses = await Promise.allSettled(verifyRequests);

      // Only one should succeed, others should fail
      const successfulResponses = responses.filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value.status === 200,
      );

      expect(successfulResponses.length).toBe(1);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    test('should logout successfully with valid session', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('logged out');

      // Verify session is invalidated
      const protectedResponse = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      expect(protectedResponse.body.error).toContain('Invalid token');
    });

    test('should require authentication', async () => {
      const response = await request(app).post('/api/v1/auth/logout').expect(401);

      expect(response.body.error).toContain('Authentication required');
    });

    test('should validate CSRF token', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body.error).toContain('CSRF');
    });

    test('should handle logout for already expired token', async () => {
      // Create expired token
      const expiredToken = await authHelper.generateAccessToken('user-id');
      vi.setSystemTime(new Date(Date.now() + 2 * 60 * 60 * 1000)); // 2 hours later

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toContain('Token expired');
      vi.useRealTimers();
    });
  });

  describe('GET /api/v1/auth/session', () => {
    test('should return current session info', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('id', user.id);
      expect(response.body.data.user).toHaveProperty('email', user.email);
      expect(response.body.data.user).toHaveProperty('role', user.role);
      expect(response.body.data).toHaveProperty('sessionInfo');
      expect(response.body.data.sessionInfo).toHaveProperty('isValid', true);
    });

    test('should require authentication', async () => {
      const response = await request(app).get('/api/v1/auth/session').expect(401);

      expect(response.body.error).toContain('Authentication required');
    });

    test('should handle invalid token', async () => {
      const invalidToken = 'invalid.jwt.token';

      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body.error).toContain('Invalid token');
    });

    test('should validate token signature', async () => {
      // Create token with wrong secret
      const maliciousToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid_signature';

      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${maliciousToken}`)
        .expect(401);

      expect(response.body.error).toContain('Invalid token');
    });

    test('should include security headers', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    });
  });

  describe('Multi-device Session Management', () => {
    test('should support concurrent sessions from different devices', async () => {
      const user = await authHelper.createTestUser();

      // Login from device 1
      const device1Response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .set('User-Agent', 'Device1-App/1.0')
        .send({ pinId: 'pin1', code: '1234' })
        .expect(200);

      // Login from device 2
      const device2Response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .set('User-Agent', 'Device2-App/1.0')
        .send({ pinId: 'pin2', code: '5678' })
        .expect(200);

      const device1Token = device1Response.body.data.tokens.accessToken;
      const device2Token = device2Response.body.data.tokens.accessToken;

      // Both sessions should be active
      await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${device1Token}`)
        .expect(200);

      await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${device2Token}`)
        .expect(200);

      // Tokens should be different
      expect(device1Token).not.toBe(device2Token);
    });

    test('should handle device-specific logout', async () => {
      const user = await authHelper.createTestUser();
      const device1Token = await authHelper.generateAccessToken(user.id);
      const device2Token = await authHelper.generateAccessToken(user.id);

      // Logout from device 1
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${device1Token}`)
        .expect(200);

      // Device 1 session should be invalid
      await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${device1Token}`)
        .expect(401);

      // Device 2 session should still be valid
      await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${device2Token}`)
        .expect(200);
    });
  });

  describe('Authentication Security Tests', () => {
    test('should prevent brute force attacks on PIN verification', async () => {
      const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      const pinId = pinResponse.body.data.id;

      // Attempt multiple wrong codes
      const attempts = Array(5)
        .fill(null)
        .map((_, index) =>
          request(app)
            .post('/api/v1/auth/plex/verify')
            .send({ pinId, code: `999${index}` }),
        );

      const responses = await Promise.all(attempts);

      // Should get rate limited after several attempts
      const rateLimitedCount = responses.filter((res) => res.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    test('should validate JWT algorithm and prevent algorithm confusion', async () => {
      // Create token with 'none' algorithm (security attack)
      const noneAlgToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyLWlkIn0.';

      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${noneAlgToken}`)
        .expect(401);

      expect(response.body.error).toContain('Invalid token');
    });

    test('should handle malformed Authorization headers', async () => {
      const testCases = [
        'Bearer', // No token
        'Bearer ', // Empty token
        'Invalid token', // Wrong format
        'Bearer token.with.invalid.structure', // Invalid JWT structure
      ];

      for (const authHeader of testCases) {
        const response = await request(app)
          .get('/api/v1/auth/session')
          .set('Authorization', authHeader)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      }
    });

    test('should prevent session fixation attacks', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Get initial session
      const session1Response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Logout and re-login should create new session
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Old session should be invalid
      await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  describe('CORS and Headers Validation', () => {
    test('should include proper CORS headers', async () => {
      const response = await request(app)
        .options('/api/v1/auth/plex/pin')
        .set('Origin', 'https://medianest.app')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    test('should validate Content-Type header', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .set('Content-Type', 'application/xml') // Wrong content type
        .send('<xml>data</xml>')
        .expect(400);

      expect(response.body.error).toContain('content type');
    });

    test('should set security headers on all responses', async () => {
      const response = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      // Verify security headers are present
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection failures gracefully', async () => {
      // Mock database failure
      vi.doMock('@prisma/client', () => ({
        PrismaClient: vi.fn().mockImplementation(() => ({
          user: {
            findFirst: vi.fn().mockRejectedValue(new Error('Database connection failed')),
          },
        })),
      }));

      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${await authHelper.generateAccessToken('user-id')}`)
        .expect(500);

      expect(response.body.error).toContain('Internal server error');
    });

    test('should sanitize error messages for security', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'test',
          code: 'SELECT * FROM users', // SQL injection attempt
        })
        .expect(400);

      // Should not expose SQL or sensitive info in error
      expect(response.body.error).not.toContain('SQL');
      expect(response.body.error).not.toContain('database');
      expect(response.body.error).not.toContain('SELECT');
    });

    test('should handle JSON parsing errors', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid JSON');
    });
  });
});
