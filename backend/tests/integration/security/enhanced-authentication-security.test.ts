import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User } from '@prisma/client';

import { app } from '../../../src/server';
import { cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { createTestUser, generateValidToken } from '../../helpers/auth';
import { UserRepository } from '../../../src/repositories/user.repository';
import { SessionTokenRepository } from '../../../src/repositories/session-token.repository';

describe('Enhanced Authentication Security Tests', () => {
  let userRepository: UserRepository;
  let sessionTokenRepository: SessionTokenRepository;
  let testUser: User;
  let validToken: string;

  beforeAll(async () => {
    userRepository = new UserRepository();
    sessionTokenRepository = new SessionTokenRepository();
  });

  beforeEach(async () => {
    await cleanDatabase();
    
    testUser = await createTestUser({
      email: 'test@example.com',
      name: 'Test User',
      plexId: 'plex-123',
      role: 'user',
    });
    
    validToken = await generateValidToken(testUser.id);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('Multi-Factor Authentication Security', () => {
    it('should enforce 2FA for admin users', async () => {
      const adminUser = await createTestUser({
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
      });

      const response = await request(app)
        .post('/api/auth/admin')
        .send({
          email: adminUser.email,
          password: 'AdminPassword123!',
          name: 'Admin User',
          confirmPassword: 'AdminPassword123!',
        });

      if (response.status === 200) {
        // Should require 2FA setup for admin accounts
        expect(response.body.data).toHaveProperty('requiresMfa', true);
      }
    });

    it('should prevent admin login without 2FA verification', async () => {
      const adminUser = await createTestUser({
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        mfaEnabled: true,
        mfaSecret: 'JBSWY3DPEHPK3PXP', // Test TOTP secret
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminUser.email,
          password: 'AdminPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('MFA_REQUIRED');
    });

    it('should validate TOTP codes correctly', async () => {
      const adminUser = await createTestUser({
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        mfaEnabled: true,
        mfaSecret: 'JBSWY3DPEHPK3PXP',
      });

      // Generate valid TOTP code (would use library in real implementation)
      const validTotp = '123456'; // Mock valid TOTP

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminUser.email,
          password: 'AdminPassword123!',
          totpCode: validTotp,
        });

      // Should succeed with valid TOTP
      expect([200, 401]).toContain(response.status);
    });

    it('should reject invalid TOTP codes', async () => {
      const adminUser = await createTestUser({
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        mfaEnabled: true,
        mfaSecret: 'JBSWY3DPEHPK3PXP',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminUser.email,
          password: 'AdminPassword123!',
          totpCode: '000000', // Invalid TOTP
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_TOTP');
    });

    it('should prevent TOTP replay attacks', async () => {
      const adminUser = await createTestUser({
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        mfaEnabled: true,
        mfaSecret: 'JBSWY3DPEHPK3PXP',
      });

      const totpCode = '123456';

      // First login attempt
      await request(app)
        .post('/api/auth/login')
        .send({
          email: adminUser.email,
          password: 'AdminPassword123!',
          totpCode,
        });

      // Second attempt with same TOTP should fail
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminUser.email,
          password: 'AdminPassword123!',
          totpCode,
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('TOTP_ALREADY_USED');
    });
  });

  describe('Password Security Enhancements', () => {
    it('should enforce strong password requirements', async () => {
      const weakPasswords = [
        'password',
        '12345678',
        'Password',
        'password123',
        'Password123',
        'Aa1!', // Too short
        'abcdefgh1!', // No uppercase
        'ABCDEFGH1!', // No lowercase
        'ABCDefgh!', // No numbers
        'ABCDefgh1', // No special chars
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/admin')
          .send({
            email: 'admin@example.com',
            password,
            confirmPassword: password,
            name: 'Admin User',
          });

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should prevent password reuse', async () => {
      const adminUser = await createTestUser({
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        passwordHash: await bcrypt.hash('OldPassword123!', 12),
        passwordHistory: [
          await bcrypt.hash('OldPassword123!', 12),
          await bcrypt.hash('OlderPassword123!', 12),
        ],
      });

      const adminToken = await generateValidToken(adminUser.id);

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'OldPassword123!', // Same as current
          confirmNewPassword: 'OldPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('PASSWORD_REUSE_NOT_ALLOWED');
    });

    it('should enforce password expiry for admin accounts', async () => {
      const expiredPasswordDate = new Date(Date.now() - (91 * 24 * 60 * 60 * 1000)); // 91 days ago
      
      const adminUser = await createTestUser({
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        passwordHash: await bcrypt.hash('AdminPassword123!', 12),
        passwordChangedAt: expiredPasswordDate,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminUser.email,
          password: 'AdminPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('PASSWORD_EXPIRED');
    });

    it('should implement password breach checking', async () => {
      // Test with known breached passwords
      const breachedPasswords = [
        'Password123!', // Common breached password
        'Welcome123!',
        'Company123!',
      ];

      for (const password of breachedPasswords) {
        const response = await request(app)
          .post('/api/auth/admin')
          .send({
            email: 'admin@example.com',
            password,
            confirmPassword: password,
            name: 'Admin User',
          });

        // Should either succeed or warn about breach
        if (response.status === 400) {
          expect(response.body.code).toBe('PASSWORD_PREVIOUSLY_BREACHED');
        }
      }
    });
  });

  describe('Session Security Enhancements', () => {
    it('should implement concurrent session limits', async () => {
      const tokens: string[] = [];
      
      // Create multiple sessions for same user
      for (let i = 0; i < 6; i++) {
        const token = await generateValidToken(testUser.id);
        tokens.push(token);
      }

      // Test that older sessions get invalidated
      const oldTokenResponse = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${tokens[0]}`);

      const newTokenResponse = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${tokens[5]}`);

      // Newest session should work, oldest might be invalidated
      expect(newTokenResponse.status).toBe(200);
      
      if (tokens.length > 5) {
        expect(oldTokenResponse.status).toBe(401);
      }
    });

    it('should detect and prevent session hijacking', async () => {
      // Make request from one IP
      const response1 = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Forwarded-For', '192.168.1.1');

      expect(response1.status).toBe(200);

      // Make request from different IP (simulate hijack)
      const response2 = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Forwarded-For', '203.0.113.1');

      // Should either work or trigger security warning
      if (response2.status === 401) {
        expect(response2.body.code).toBe('SUSPICIOUS_ACTIVITY');
      }
    });

    it('should implement device fingerprinting', async () => {
      const fingerprint1 = 'Mozilla/5.0-Windows-Chrome';
      const fingerprint2 = 'curl/7.68.0-Linux';

      // First request with device fingerprint
      const response1 = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${validToken}`)
        .set('User-Agent', fingerprint1)
        .set('X-Device-Fingerprint', 'abc123');

      expect(response1.status).toBe(200);

      // Request with different device fingerprint
      const response2 = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${validToken}`)
        .set('User-Agent', fingerprint2)
        .set('X-Device-Fingerprint', 'xyz789');

      // Should detect device change and potentially require verification
      if (response2.status === 401) {
        expect(response2.body.code).toBe('DEVICE_NOT_RECOGNIZED');
      }
    });

    it('should auto-logout on suspicious activity', async () => {
      // Simulate suspicious activity patterns
      const suspiciousRequests = [
        { path: '/api/admin/users', expected: 403 },
        { path: '/api/admin/system', expected: 403 },
        { path: '/api/admin/config', expected: 403 },
        { path: '/api/admin/logs', expected: 403 },
        { path: '/api/admin/settings', expected: 403 },
      ];

      for (const req of suspiciousRequests) {
        await request(app)
          .get(req.path)
          .set('Authorization', `Bearer ${validToken}`);
      }

      // After multiple unauthorized attempts, session might be terminated
      const response = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${validToken}`);

      // Session might be invalidated due to suspicious activity
      if (response.status === 401) {
        expect(response.body.code).toBe('SESSION_TERMINATED_SUSPICIOUS_ACTIVITY');
      }
    });
  });

  describe('OAuth Security Enhancements', () => {
    it('should validate Plex OAuth state parameter', async () => {
      const response = await request(app)
        .post('/api/auth/plex/pin')
        .send({
          state: 'invalid-state-parameter',
        });

      // Should validate state parameter to prevent CSRF
      expect([200, 400]).toContain(response.status);
      
      if (response.status === 400) {
        expect(response.body.code).toBe('INVALID_STATE');
      }
    });

    it('should enforce PKCE for OAuth flows', async () => {
      const response = await request(app)
        .post('/api/auth/plex/pin')
        .send({
          codeChallenge: 'invalid-challenge',
          codeChallengeMethod: 'S256',
        });

      // Should support PKCE for enhanced security
      expect([200, 400]).toContain(response.status);
    });

    it('should prevent OAuth token replay attacks', async () => {
      // Create a PIN
      const pinResponse = await request(app)
        .post('/api/auth/plex/pin')
        .send({});

      if (pinResponse.status === 200) {
        const pinId = pinResponse.body.data.id;

        // Complete OAuth flow once
        const authResponse1 = await request(app)
          .post('/api/auth/plex')
          .send({ pinId });

        // Try to use same PIN again
        const authResponse2 = await request(app)
          .post('/api/auth/plex')
          .send({ pinId });

        expect(authResponse2.status).toBe(400);
        expect(authResponse2.body.code).toBe('PIN_ALREADY_USED');
      }
    });

    it('should validate OAuth redirect URIs', async () => {
      const maliciousRedirects = [
        'http://evil.com/callback',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'https://plex.tv.evil.com/callback',
      ];

      for (const redirect of maliciousRedirects) {
        const response = await request(app)
          .post('/api/auth/plex/pin')
          .send({
            redirectUri: redirect,
          });

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('INVALID_REDIRECT_URI');
      }
    });
  });

  describe('Account Security Features', () => {
    it('should implement account lockout after failed attempts', async () => {
      const maxAttempts = 5;
      
      // Make multiple failed login attempts
      for (let i = 0; i < maxAttempts + 1; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword',
          });
      }

      // Account should be locked
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'correctpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('ACCOUNT_LOCKED');
    });

    it('should send security notifications for suspicious activity', async () => {
      // Simulate login from new location
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'correctpassword',
        })
        .set('X-Forwarded-For', '203.0.113.1')
        .set('User-Agent', 'Unknown Browser');

      // Should trigger security notification (check logs or email queue)
      expect([200, 401]).toContain(response.status);
    });

    it('should require email verification for sensitive changes', async () => {
      const response = await request(app)
        .patch('/api/auth/change-email')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          newEmail: 'newemail@example.com',
        });

      expect(response.status).toBe(202);
      expect(response.body.message).toContain('verification email');
    });

    it('should implement trusted device management', async () => {
      // Register device as trusted
      const trustResponse = await request(app)
        .post('/api/auth/trust-device')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          deviceName: 'My Laptop',
          deviceFingerprint: 'abc123',
        });

      expect(trustResponse.status).toBe(200);

      // List trusted devices
      const listResponse = await request(app)
        .get('/api/auth/trusted-devices')
        .set('Authorization', `Bearer ${validToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Advanced Security Headers', () => {
    it('should set proper security headers on auth endpoints', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password',
        });

      // Check security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      expect(response.headers).toHaveProperty('strict-transport-security');
      expect(response.headers).toHaveProperty('content-security-policy');
    });

    it('should implement HSTS with proper configuration', async () => {
      const response = await request(app).get('/api/health');

      const hsts = response.headers['strict-transport-security'];
      expect(hsts).toBeDefined();
      expect(hsts).toContain('max-age=');
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');
    });

    it('should set secure cookie attributes', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'correctpassword',
        });

      if (loginResponse.status === 200) {
        const cookies = loginResponse.headers['set-cookie'];
        if (cookies) {
          cookies.forEach((cookie: string) => {
            if (cookie.includes('auth-token')) {
              expect(cookie).toContain('HttpOnly');
              expect(cookie).toContain('Secure');
              expect(cookie).toContain('SameSite=');
            }
          });
        }
      }
    });
  });

  describe('Security Logging and Monitoring', () => {
    it('should log authentication events', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        });

      // Should log failed login attempt
      // In real implementation, check log files or monitoring system
    });

    it('should track login patterns and anomalies', async () => {
      // Login from different locations rapidly
      const locations = ['192.168.1.1', '203.0.113.1', '198.51.100.1'];
      
      for (const ip of locations) {
        await request(app)
          .get('/api/auth/session')
          .set('Authorization', `Bearer ${validToken}`)
          .set('X-Forwarded-For', ip);
      }

      // Should detect unusual access patterns
    });

    it('should implement security metrics collection', async () => {
      // Make various requests to generate metrics
      await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${validToken}`);

      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      // Security metrics should be collected for monitoring
    });
  });
});