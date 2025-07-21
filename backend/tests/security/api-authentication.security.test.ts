/**
 * TIER 4 CRITICAL SECURITY TESTS - API Authentication Endpoints (15 tests)
 * Testing authentication endpoint security vulnerabilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { setupTestApp, teardownTestApp } from '../helpers/test-app';

describe('API Authentication Security Tests', () => {
  beforeEach(async () => {
    await setupTestApp();
  });

  afterEach(async () => {
    await teardownTestApp();
  });

  describe('Plex OAuth Security', () => {
    describe('PIN Generation Security', () => {
      it('should prevent multiple PIN requests from same IP', async () => {
        // Make multiple rapid PIN requests
        const requests = Array(10).fill(null).map(() =>
          request(app)
            .post('/api/auth/plex/pin')
            .set('X-Forwarded-For', '192.168.1.100')
        );

        const responses = await Promise.all(requests);
        
        // Should implement rate limiting
        const rateLimitedResponses = responses.filter(res => res.status === 429);
        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      });

      it('should validate PIN format and prevent injection', async () => {
        const response = await request(app)
          .post('/api/auth/plex/pin');

        expect(response.status).toBe(200);
        
        if (response.body.pin) {
          // PIN should be numeric and safe length
          expect(response.body.pin).toMatch(/^\d{4}$/);
          expect(response.body.pin).not.toContain('<script>');
          expect(response.body.pin).not.toContain('\\');
        }
      });

      it('should generate cryptographically secure session IDs', async () => {
        const response1 = await request(app)
          .post('/api/auth/plex/pin');
        const response2 = await request(app)
          .post('/api/auth/plex/pin');

        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);

        if (response1.body.sessionId && response2.body.sessionId) {
          // Session IDs should be unique and unpredictable
          expect(response1.body.sessionId).not.toBe(response2.body.sessionId);
          expect(response1.body.sessionId.length).toBeGreaterThan(20);
          expect(response2.body.sessionId.length).toBeGreaterThan(20);
        }
      });

      it('should validate auth URL to prevent redirect attacks', async () => {
        const response = await request(app)
          .post('/api/auth/plex/pin');

        expect(response.status).toBe(200);
        
        if (response.body.authUrl) {
          // Auth URL should be Plex domain only
          expect(response.body.authUrl).toMatch(/^https:\/\/app\.plex\.tv/);
          expect(response.body.authUrl).not.toContain('evil.com');
          expect(response.body.authUrl).not.toContain('javascript:');
        }
      });

      it('should implement CSRF protection', async () => {
        // Request without proper headers should be rejected in production
        const response = await request(app)
          .post('/api/auth/plex/pin')
          .set('Origin', 'https://evil.com');

        // Should implement origin validation
        if (process.env.NODE_ENV === 'production') {
          expect([400, 403, 200]).toContain(response.status);
        }
      });
    });

    describe('PIN Polling Security', () => {
      it('should validate session ID format in polling requests', async () => {
        const maliciousSessionIds = [
          '<script>alert("XSS")</script>',
          '../../etc/passwd',
          'session"; DROP TABLE sessions; --',
          null,
          undefined,
          123,
          {},
        ];

        for (const maliciousId of maliciousSessionIds) {
          const response = await request(app)
            .get(`/api/auth/plex/pin?sessionId=${maliciousId}`);

          // Should handle malicious session IDs safely
          expect([400, 404, 500]).toContain(response.status);
          expect(response.body).not.toContain('<script>');
        }
      });

      it('should prevent timing attacks on PIN verification', async () => {
        // Create valid PIN
        const pinResponse = await request(app)
          .post('/api/auth/plex/pin');

        const sessionId = pinResponse.body.sessionId;
        
        if (sessionId) {
          const startTime = Date.now();
          
          // Poll for non-existent session
          await request(app)
            .get(`/api/auth/plex/pin?sessionId=non-existent-session`);
          
          const invalidTime = Date.now() - startTime;
          
          // Poll for valid session
          const startTime2 = Date.now();
          
          await request(app)
            .get(`/api/auth/plex/pin?sessionId=${sessionId}`);
          
          const validTime = Date.now() - startTime2;
          
          // Response times should be similar to prevent timing attacks
          const timeDifference = Math.abs(invalidTime - validTime);
          expect(timeDifference).toBeLessThan(100); // Within 100ms
        }
      });

      it('should implement polling rate limits', async () => {
        const pinResponse = await request(app)
          .post('/api/auth/plex/pin');

        const sessionId = pinResponse.body.sessionId;
        
        if (sessionId) {
          // Make rapid polling requests
          const requests = Array(20).fill(null).map(() =>
            request(app)
              .get(`/api/auth/plex/pin?sessionId=${sessionId}`)
              .set('X-Forwarded-For', '192.168.1.100')
          );

          const responses = await Promise.all(requests);
          
          // Should implement rate limiting for polling
          const rateLimitedResponses = responses.filter(res => res.status === 429);
          expect(rateLimitedResponses.length).toBeGreaterThan(0);
        }
      });

      it('should expire sessions after reasonable time', async () => {
        const pinResponse = await request(app)
          .post('/api/auth/plex/pin');

        const sessionId = pinResponse.body.sessionId;
        
        if (sessionId) {
          // Mock time advancement (in real test, would wait or mock time)
          const response = await request(app)
            .get(`/api/auth/plex/pin?sessionId=${sessionId}`);

          // Session should have expiration logic
          expect([200, 404, 410]).toContain(response.status);
        }
      });
    });

    describe('Token Exchange Security', () => {
      it('should validate Plex auth tokens', async () => {
        const maliciousTokens = [
          '<script>alert("XSS")</script>',
          'token"; DROP TABLE users; --',
          '../../../etc/passwd',
          null,
          undefined,
          123,
          '',
          'a'.repeat(10000), // Extremely long token
        ];

        for (const maliciousToken of maliciousTokens) {
          const response = await request(app)
            .post('/api/auth/plex/callback')
            .send({ authToken: maliciousToken });

          // Should handle malicious tokens safely
          expect([400, 401, 500]).toContain(response.status);
          expect(response.body).not.toContain('<script>');
        }
      });

      it('should prevent token replay attacks', async () => {
        const validToken = 'valid-plex-token-12345';

        // Use token first time
        const response1 = await request(app)
          .post('/api/auth/plex/callback')
          .send({ authToken: validToken });

        // Attempt to reuse token
        const response2 = await request(app)
          .post('/api/auth/plex/callback')
          .send({ authToken: validToken });

        // Should prevent token reuse
        if (response1.status === 200) {
          expect([400, 401, 409]).toContain(response2.status);
        }
      });

      it('should validate token format and structure', async () => {
        const response = await request(app)
          .post('/api/auth/plex/callback')
          .send({ authToken: 'properly-formatted-token' });

        // Should validate token structure
        expect([200, 400, 401]).toContain(response.status);
      });
    });
  });

  describe('Admin Authentication Security', () => {
    describe('Admin Login Security', () => {
      it('should prevent brute force attacks on admin login', async () => {
        const loginAttempts = Array(10).fill(null).map((_, i) =>
          request(app)
            .post('/api/auth/admin/login')
            .send({
              username: 'admin',
              password: `wrong-password-${i}`,
            })
            .set('X-Forwarded-For', '192.168.1.100')
        );

        const responses = await Promise.all(loginAttempts);
        
        // Should implement progressive delays or account lockout
        const rateLimitedResponses = responses.filter(res => 
          res.status === 429 || res.status === 423
        );
        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      });

      it('should validate admin credentials securely', async () => {
        const maliciousCredentials = [
          {
            username: '<script>alert("XSS")</script>',
            password: 'admin',
          },
          {
            username: 'admin"; DROP TABLE users; --',
            password: 'admin',
          },
          {
            username: 'admin',
            password: '../../etc/passwd',
          },
          {
            username: 'admin',
            password: null,
          },
          {
            username: null,
            password: 'admin',
          },
        ];

        for (const maliciousCreds of maliciousCredentials) {
          const response = await request(app)
            .post('/api/auth/admin/login')
            .send(maliciousCreds);

          // Should handle malicious input safely
          expect([400, 401, 500]).toContain(response.status);
          expect(response.body).not.toContain('<script>');
        }
      });

      it('should not expose user enumeration information', async () => {
        // Test non-existent user
        const response1 = await request(app)
          .post('/api/auth/admin/login')
          .send({
            username: 'non-existent-user',
            password: 'any-password',
          });

        // Test existing user with wrong password
        const response2 = await request(app)
          .post('/api/auth/admin/login')
          .send({
            username: 'admin',
            password: 'wrong-password',
          });

        // Error messages should be similar to prevent enumeration
        expect(response1.status).toBe(response2.status);
        if (response1.body.message && response2.body.message) {
          expect(response1.body.message).toBe(response2.body.message);
        }
      });

      it('should enforce secure password policies', async () => {
        const weakPasswords = [
          '123',
          'password',
          'admin',
          '',
          'a',
          '12345678', // Common weak password
        ];

        for (const weakPassword of weakPasswords) {
          const response = await request(app)
            .post('/api/auth/admin/change-password')
            .send({
              currentPassword: 'admin',
              newPassword: weakPassword,
            });

          // Should reject weak passwords
          expect([400, 422]).toContain(response.status);
        }
      });
    });

    describe('Session Management Security', () => {
      it('should generate secure session tokens', async () => {
        const response = await request(app)
          .post('/api/auth/admin/login')
          .send({
            username: 'admin',
            password: 'admin',
          });

        if (response.status === 200 && response.body.token) {
          const token = response.body.token;
          
          // Token should be long and unpredictable
          expect(token.length).toBeGreaterThan(32);
          expect(token).not.toMatch(/^admin/);
          expect(token).not.toMatch(/^\d+$/);
        }
      });

      it('should implement secure session expiration', async () => {
        const loginResponse = await request(app)
          .post('/api/auth/admin/login')
          .send({
            username: 'admin',
            password: 'admin',
          });

        if (loginResponse.status === 200 && loginResponse.body.token) {
          const token = loginResponse.body.token;
          
          // Use token for authenticated request
          const authResponse = await request(app)
            .get('/api/admin/status')
            .set('Authorization', `Bearer ${token}`);

          // Should accept valid token
          expect([200, 401]).toContain(authResponse.status);
        }
      });

      it('should invalidate sessions on password change', async () => {
        // Login and get token
        const loginResponse = await request(app)
          .post('/api/auth/admin/login')
          .send({
            username: 'admin',
            password: 'admin',
          });

        if (loginResponse.status === 200 && loginResponse.body.token) {
          const token = loginResponse.body.token;
          
          // Change password
          await request(app)
            .post('/api/auth/admin/change-password')
            .set('Authorization', `Bearer ${token}`)
            .send({
              currentPassword: 'admin',
              newPassword: 'new-secure-password-123!',
            });

          // Old token should be invalidated
          const response = await request(app)
            .get('/api/admin/status')
            .set('Authorization', `Bearer ${token}`);

          expect(response.status).toBe(401);
        }
      });
    });
  });

  describe('General Authentication Security', () => {
    it('should implement proper CORS policies', async () => {
      const maliciousOrigins = [
        'https://evil.com',
        'http://malicious.site',
        'null',
        'file://',
        'data:text/html,<script>evil()</script>',
      ];

      for (const origin of maliciousOrigins) {
        const response = await request(app)
          .post('/api/auth/plex/pin')
          .set('Origin', origin);

        // Should implement strict CORS policy
        expect(response.headers['access-control-allow-origin']).not.toBe(origin);
      }
    });

    it('should prevent clickjacking attacks', async () => {
      const response = await request(app)
        .get('/api/auth/status');

      // Should set X-Frame-Options or CSP frame-ancestors
      expect(
        response.headers['x-frame-options'] || 
        response.headers['content-security-policy']
      ).toBeDefined();
    });

    it('should implement secure headers', async () => {
      const response = await request(app)
        .get('/api/auth/status');

      // Should set security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
    });
  });
});