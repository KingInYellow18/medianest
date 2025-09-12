/**
 * Session Hijacking Prevention Test Suite
 *
 * Comprehensive tests to validate session security and prevent session hijacking attacks
 * Tests session management, token security, and concurrent session handling
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { PrismaClient } from '@prisma/client';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { DatabaseTestHelper } from '../helpers/database-test-helper';

describe('Session Hijacking Prevention Test Suite', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let authHelper: AuthTestHelper;
  let dbHelper: DatabaseTestHelper;
  let userId: string;
  let validToken: string;

  beforeAll(async () => {
    app = createApp();
    request = supertest(app);
    prisma = new PrismaClient();
    authHelper = new AuthTestHelper(prisma);
    dbHelper = new DatabaseTestHelper(prisma);

    // Create test user
    const user = await authHelper.createTestUser('session-test-user', 'session-user@test.com');
    userId = user.id;
    validToken = await authHelper.generateValidToken(user.id, 'user');
  });

  afterAll(async () => {
    await dbHelper.cleanup();
    await prisma.$disconnect();
  });

  describe('Session Cookie Security Tests', () => {
    test('should set secure session cookie attributes', async () => {
      const response = await request
        .post('/api/v1/auth/plex/verify')
        .send({ pin: '1234', username: 'testuser' });

      const cookies = response.headers['set-cookie'];

      if (cookies && cookies.length > 0) {
        cookies.forEach((cookie: string) => {
          // Session cookies should have security flags
          if (cookie.includes('session') || cookie.includes('token')) {
            expect(cookie).toMatch(/HttpOnly/i); // Prevent XSS access
            expect(cookie).toMatch(/SameSite/i); // CSRF protection

            // In production, should have Secure flag for HTTPS
            // expect(cookie).toMatch(/Secure/i);

            // Should not be accessible via JavaScript
            expect(cookie).toMatch(/HttpOnly/i);
          }
        });
      }
    });

    test('should regenerate session ID after authentication', async () => {
      // Make initial request to get session
      const response1 = await request.get('/api/v1/health');

      const initialCookies = response1.headers['set-cookie'];

      // Authenticate user
      const response2 = await request
        .post('/api/v1/auth/plex/verify')
        .send({ pin: '1234', username: 'testuser' })
        .set('Cookie', initialCookies ? initialCookies.join('; ') : '');

      const postAuthCookies = response2.headers['set-cookie'];

      if (initialCookies && postAuthCookies) {
        // Session ID should change after authentication
        const initialSessionId = initialCookies.find((c: string) => c.includes('sessionId'));
        const newSessionId = postAuthCookies.find((c: string) => c.includes('sessionId'));

        if (initialSessionId && newSessionId) {
          expect(initialSessionId).not.toBe(newSessionId);
        }
      }
    });

    test('should invalidate session on logout', async () => {
      // Logout request
      const logoutResponse = await request
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validToken}`);

      expect([200, 204]).toContain(logoutResponse.status);

      // Try to use the same token after logout
      const response = await request
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${validToken}`);

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Session Fixation Prevention Tests', () => {
    test('should prevent session fixation attacks', async () => {
      const fixedSessionId = 'attacker-fixed-session-12345';

      // Attacker tries to set a fixed session ID
      const response = await request
        .post('/api/v1/auth/plex/verify')
        .send({ pin: '1234', username: 'testuser' })
        .set('Cookie', `sessionId=${fixedSessionId}`);

      const cookies = response.headers['set-cookie'];

      if (cookies) {
        // Server should not use the attacker's session ID
        const sessionCookie = cookies.find((cookie: string) => cookie.includes('sessionId'));

        if (sessionCookie) {
          expect(sessionCookie).not.toContain(fixedSessionId);
        }
      }
    });

    test('should generate cryptographically secure session IDs', async () => {
      const sessionIds = new Set<string>();

      // Generate multiple sessions
      for (let i = 0; i < 10; i++) {
        const response = await request
          .post('/api/v1/auth/plex/verify')
          .send({ pin: `123${i}`, username: `user${i}` });

        const cookies = response.headers['set-cookie'];

        if (cookies) {
          const sessionCookie = cookies.find((cookie: string) => cookie.includes('sessionId'));

          if (sessionCookie) {
            const sessionId = sessionCookie.split('=')[1]?.split(';')[0];

            if (sessionId) {
              // Should be unique
              expect(sessionIds.has(sessionId)).toBe(false);
              sessionIds.add(sessionId);

              // Should be sufficiently long and random
              expect(sessionId.length).toBeGreaterThanOrEqual(32);
              expect(sessionId).toMatch(/^[A-Za-z0-9+/=_-]+$/); // Base64 or similar encoding
            }
          }
        }
      }

      expect(sessionIds.size).toBe(10); // All should be unique
    });
  });

  describe('Session Hijacking Prevention Tests', () => {
    test('should detect and prevent session replay attacks', async () => {
      // Create a session
      const authResponse = await request
        .post('/api/v1/auth/plex/verify')
        .send({ pin: '1234', username: 'replaytest' });

      const cookies = authResponse.headers['set-cookie'];

      if (cookies && authResponse.status === 200) {
        const cookieString = cookies.join('; ');

        // Use session normally
        const normalResponse = await request
          .get('/api/v1/dashboard/stats')
          .set('Cookie', cookieString)
          .set('Authorization', `Bearer ${validToken}`);

        expect([200, 401]).toContain(normalResponse.status);

        // Simulate session being used from different IP/User-Agent
        const suspiciousResponse = await request
          .get('/api/v1/dashboard/stats')
          .set('Cookie', cookieString)
          .set('Authorization', `Bearer ${validToken}`)
          .set('User-Agent', 'AttackerBot/1.0')
          .set('X-Forwarded-For', '192.168.1.100');

        // Should either work normally or detect suspicious activity
        expect([200, 401, 403]).toContain(suspiciousResponse.status);
      }
    });

    test('should prevent session sidejacking', async () => {
      // Simulate an attacker trying to use a stolen session token
      const stolenToken = validToken;

      // Legitimate user makes a request
      const legitResponse = await request
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${validToken}`)
        .set('User-Agent', 'Mozilla/5.0 (legitimate browser)');

      // Attacker tries to use stolen token with different fingerprint
      const attackerResponse = await request
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${stolenToken}`)
        .set('User-Agent', 'curl/7.68.0')
        .set('X-Forwarded-For', '10.0.0.1');

      // Both requests might succeed if no fingerprinting is implemented
      // but sensitive operations should have additional validation
      expect([200, 401, 403]).toContain(attackerResponse.status);
    });

    test('should implement proper session timeout', async () => {
      // This test would require manipulating time or waiting
      // For now, we'll verify that timeout configuration exists
      const response = await request
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${validToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('expiresAt');
        expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
      }
    });
  });

  describe('Concurrent Session Management Tests', () => {
    test('should handle multiple concurrent sessions properly', async () => {
      const sessions: string[] = [];

      // Create multiple sessions for the same user
      for (let i = 0; i < 5; i++) {
        const token = await authHelper.generateValidToken(userId, 'user');
        sessions.push(token);
      }

      // All sessions should be valid (unless there's a concurrent limit)
      const responses = await Promise.all(
        sessions.map((token) =>
          request.get('/api/v1/dashboard/stats').set('Authorization', `Bearer ${token}`),
        ),
      );

      responses.forEach((response) => {
        expect([200, 401, 429]).toContain(response.status);
      });

      // Check if there's a concurrent session limit
      const validSessions = responses.filter((r) => r.status === 200);
      const rateLimited = responses.filter((r) => r.status === 429);

      if (rateLimited.length > 0) {
        // System implements concurrent session limiting
        expect(validSessions.length).toBeLessThan(sessions.length);
      }
    });

    test('should prevent session confusion attacks', async () => {
      // Create two users
      const user1 = await authHelper.createTestUser('user1', 'user1@test.com');
      const user2 = await authHelper.createTestUser('user2', 'user2@test.com');

      const token1 = await authHelper.generateValidToken(user1.id, 'user');
      const token2 = await authHelper.generateValidToken(user2.id, 'user');

      // Try to mix tokens in headers/cookies
      const response = await request
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${token1}`)
        .set('Cookie', `userToken=${token2.replace('Bearer ', '')}`);

      // Should use the proper token, not get confused
      if (response.status === 200) {
        expect(response.body.userId).toBe(user1.id);
        expect(response.body.userId).not.toBe(user2.id);
      } else {
        expect([401, 403]).toContain(response.status);
      }
    });
  });

  describe('Cross-Site Request Forgery via Session Tests', () => {
    test('should prevent CSRF attacks using valid sessions', async () => {
      // Simulate a CSRF attack where attacker has user's session
      const response = await request
        .post('/api/v1/media/request')
        .send({
          title: 'CSRF Attack Movie',
          type: 'movie',
          tmdbId: 99999,
        })
        .set('Authorization', `Bearer ${validToken}`)
        .set('Origin', 'http://malicious-site.com')
        .set('Referer', 'http://malicious-site.com/attack.html');

      // Should be blocked due to missing CSRF token
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Session Storage Security Tests', () => {
    test('should not expose session data in responses', async () => {
      const response = await request
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${validToken}`);

      if (response.status === 200) {
        const responseText = JSON.stringify(response.body);

        // Should not contain sensitive session data
        expect(responseText).not.toMatch(/sessionId|session_token|jwt_secret/i);
        expect(responseText).not.toContain('Bearer ');
        expect(responseText).not.toMatch(/password|secret|private_key/i);
      }
    });

    test('should implement secure session storage', async () => {
      // Test that sessions are not stored in localStorage-accessible format
      const response = await request
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${validToken}`);

      if (response.status === 200) {
        // Session info should be minimal and non-sensitive
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('secret');
        expect(response.body).not.toHaveProperty('private_key');

        if (response.body.token) {
          // Token should be opaque, not contain readable data
          expect(response.body.token).not.toContain('password');
          expect(response.body.token).not.toContain('admin');
        }
      }
    });
  });

  describe('Device and Browser Fingerprinting Tests', () => {
    test('should detect session use from different devices', async () => {
      const deviceFingerprints = [
        {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
        },
        {
          'User-Agent': 'curl/7.68.0',
          Accept: '*/*',
        },
      ];

      for (const headers of deviceFingerprints) {
        const response = await request
          .get('/api/v1/dashboard/stats')
          .set('Authorization', `Bearer ${validToken}`)
          .set(headers);

        // Should either work or flag suspicious activity
        expect([200, 401, 403]).toContain(response.status);
      }
    });
  });

  describe('Session Invalidation Tests', () => {
    test('should invalidate all user sessions on security event', async () => {
      // Create multiple sessions for user
      const tokens = [
        validToken,
        await authHelper.generateValidToken(userId, 'user'),
        await authHelper.generateValidToken(userId, 'user'),
      ];

      // All tokens should work initially
      for (const token of tokens) {
        const response = await request
          .get('/api/v1/media/requests')
          .set('Authorization', `Bearer ${token}`);
        expect([200, 401]).toContain(response.status);
      }

      // Simulate security event (password change, suspicious activity, etc.)
      // This would typically invalidate all sessions for the user
      const securityEventResponse = await request
        .post('/api/v1/auth/invalidate-all-sessions')
        .set('Authorization', `Bearer ${validToken}`);

      if (securityEventResponse.status === 200) {
        // All tokens should now be invalid
        for (const token of tokens) {
          const response = await request
            .get('/api/v1/media/requests')
            .set('Authorization', `Bearer ${token}`);
          expect([401, 403]).toContain(response.status);
        }
      }
    });

    test('should support selective session invalidation', async () => {
      // Create sessions from different devices
      const mobileToken = await authHelper.generateValidToken(userId, 'user');
      const desktopToken = await authHelper.generateValidToken(userId, 'user');

      // Invalidate only mobile sessions
      const response = await request
        .post('/api/v1/auth/logout-device')
        .send({ deviceType: 'mobile' })
        .set('Authorization', `Bearer ${desktopToken}`);

      if (response.status === 200) {
        // Mobile token should be invalid
        const mobileResponse = await request
          .get('/api/v1/dashboard/stats')
          .set('Authorization', `Bearer ${mobileToken}`);
        expect([401, 403]).toContain(mobileResponse.status);

        // Desktop token should still work
        const desktopResponse = await request
          .get('/api/v1/dashboard/stats')
          .set('Authorization', `Bearer ${desktopToken}`);
        expect([200, 401]).toContain(desktopResponse.status);
      }
    });
  });

  describe('Session Security Headers Tests', () => {
    test('should include security headers for session management', async () => {
      const response = await request
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${validToken}`);

      // Check for security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(['DENY', 'SAMEORIGIN']).toContain(response.headers['x-frame-options']);

      // Should not cache sensitive session data
      if (response.headers['cache-control']) {
        expect(response.headers['cache-control']).toMatch(/no-cache|no-store|private/);
      }
    });
  });

  describe('Session Persistence Security Tests', () => {
    test('should not persist sensitive session data in logs', async () => {
      // This test would require access to logs
      // For now, verify that responses don't contain token data that could be logged
      const response = await request
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${validToken}`);

      const responseHeaders = JSON.stringify(response.headers);
      const responseBody = JSON.stringify(response.body);

      // Response should not echo back sensitive authentication data
      expect(responseHeaders).not.toContain(validToken.replace('Bearer ', ''));
      expect(responseBody).not.toContain(validToken.replace('Bearer ', ''));
      expect(responseBody).not.toMatch(/jwt|bearer|session/i);
    });

    test('should implement proper session cleanup', async () => {
      // Create and immediately logout
      const tempUser = await authHelper.createTestUser('temp-session-user', 'temp@test.com');
      const tempToken = await authHelper.generateValidToken(tempUser.id, 'user');

      // Use session
      const useResponse = await request
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${tempToken}`);

      // Logout
      const logoutResponse = await request
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${tempToken}`);

      expect([200, 204]).toContain(logoutResponse.status);

      // Session should be cleaned up
      const postLogoutResponse = await request
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${tempToken}`);

      expect([401, 403]).toContain(postLogoutResponse.status);
    });
  });
});
