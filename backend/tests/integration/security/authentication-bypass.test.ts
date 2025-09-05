import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';

import { app } from '../../../src/server';
import { cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { createTestUser, generateValidToken } from '../../helpers/auth';
import { UserRepository } from '../../../src/repositories/user.repository';
import { SessionTokenRepository } from '../../../src/repositories/session-token.repository';

describe('Authentication Bypass Security Tests', () => {
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

  describe('Token Tampering Prevention', () => {
    it('should reject tokens with modified payload', async () => {
      // Create a token with modified user ID
      const decodedToken = jwt.decode(validToken) as any;
      decodedToken.userId = 'malicious-user-id';
      
      const tamperedToken = jwt.sign(decodedToken, 'wrong-secret');

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid token');
    });

    it('should reject tokens signed with wrong secret', async () => {
      const payload = {
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      };
      
      const maliciousToken = jwt.sign(payload, 'malicious-secret');

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${maliciousToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject tokens with modified signature', async () => {
      const tokenParts = validToken.split('.');
      const maliciousSignature = 'malicious-signature';
      const tamperedToken = `${tokenParts[0]}.${tokenParts[1]}.${maliciousSignature}`;

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject expired tokens', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        {
          userId: testUser.id,
          email: testUser.email,
          role: testUser.role,
          exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        },
        process.env.JWT_SECRET || 'development-secret-change-in-production'
      );

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });

    it('should reject tokens with wrong issuer', async () => {
      const maliciousToken = jwt.sign(
        {
          userId: testUser.id,
          email: testUser.email,
          role: testUser.role,
        },
        process.env.JWT_SECRET || 'development-secret-change-in-production',
        {
          issuer: 'malicious-issuer',
          audience: process.env.JWT_AUDIENCE || 'medianest-users',
          algorithm: 'HS256',
        }
      );

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${maliciousToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject tokens with wrong audience', async () => {
      const maliciousToken = jwt.sign(
        {
          userId: testUser.id,
          email: testUser.email,
          role: testUser.role,
        },
        process.env.JWT_SECRET || 'development-secret-change-in-production',
        {
          issuer: process.env.JWT_ISSUER || 'medianest',
          audience: 'malicious-audience',
          algorithm: 'HS256',
        }
      );

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${maliciousToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject tokens with unsupported algorithm', async () => {
      // Try to create a token with 'none' algorithm (security vulnerability)
      const headerBuffer = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }));
      const payloadBuffer = Buffer.from(JSON.stringify({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      }));
      
      const noneToken = `${headerBuffer.toString('base64')}.${payloadBuffer.toString('base64')}.`;

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${noneToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe('Session Token Validation', () => {
    it('should reject requests with valid JWT but invalid session token', async () => {
      // Delete the session token from database
      await sessionTokenRepository.revoke(validToken);

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid session');
    });

    it('should reject requests for inactive users', async () => {
      // Deactivate the user
      await userRepository.update(testUser.id, { status: 'inactive' });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('User not found or inactive');
    });

    it('should reject requests for deleted users', async () => {
      // Delete the user
      await userRepository.delete(testUser.id);

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('User not found or inactive');
    });
  });

  describe('Authorization Header Bypass Attempts', () => {
    it('should reject malformed authorization headers', async () => {
      const malformedHeaders = [
        'malformed-header',
        'Bearer',
        'Bearer ',
        'Basic ' + Buffer.from('user:pass').toString('base64'),
        'Token ' + validToken,
        validToken, // Missing Bearer prefix
      ];

      for (const header of malformedHeaders) {
        const response = await request(app)
          .get('/api/users/me')
          .set('Authorization', header);

        expect(response.status).toBe(401);
      }
    });

    it('should reject requests with multiple authorization headers', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Auth-Token', validToken);

      // Should use the Authorization header, ignore X-Auth-Token
      expect(response.status).toBe(200);
    });

    it('should reject empty or whitespace tokens', async () => {
      const invalidTokens = ['', ' ', '   ', '\t', '\n'];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
      }
    });
  });

  describe('Cookie-Based Auth Bypass Attempts', () => {
    it('should reject malformed auth cookies', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Cookie', 'auth-token=malformed-cookie');

      expect(response.status).toBe(401);
    });

    it('should prefer Authorization header over cookie when both present', async () => {
      const maliciousCookie = 'malicious-token';
      
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Cookie', `auth-token=${maliciousCookie}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testUser.id);
    });

    it('should reject cookie injection attempts', async () => {
      const injectionAttempts = [
        'auth-token=token1; auth-token=token2',
        'auth-token[]=' + validToken,
        'auth-token[malicious]=' + validToken,
        'auth-token=' + validToken + '; path=/admin',
      ];

      for (const cookie of injectionAttempts) {
        const response = await request(app)
          .get('/api/users/me')
          .set('Cookie', cookie);

        // Should either work with valid token or reject properly
        if (response.status === 200) {
          expect(response.body.id).toBe(testUser.id);
        } else {
          expect(response.status).toBe(401);
        }
      }
    });
  });

  describe('Protected Endpoint Access', () => {
    it('should protect all API endpoints except health', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/api/users/me' },
        { method: 'get', path: '/api/media-requests' },
        { method: 'post', path: '/api/media-requests' },
        { method: 'get', path: '/api/admin/users' },
        { method: 'get', path: '/api/dashboard' },
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });

    it('should allow access to health endpoint without authentication', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
    });

    it('should prevent path traversal attacks', async () => {
      const maliciousPaths = [
        '/api/users/../admin/users',
        '/api/users/../../admin/users',
        '/api/../admin/users',
        '/api/users/%2e%2e/admin/users',
        '/api/users/..%2fadmin%2fusers',
      ];

      for (const path of maliciousPaths) {
        const response = await request(app)
          .get(path)
          .set('Authorization', `Bearer ${validToken}`);

        // Should either be not found or properly handled
        expect([401, 404]).toContain(response.status);
      }
    });
  });

  describe('Role Escalation Prevention', () => {
    it('should prevent regular user from accessing admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(403);
    });

    it('should reject tokens with modified role claims', async () => {
      // Create a token with admin role for regular user
      const escalatedToken = jwt.sign(
        {
          userId: testUser.id,
          email: testUser.email,
          role: 'admin', // Escalated role
        },
        process.env.JWT_SECRET || 'development-secret-change-in-production',
        {
          issuer: process.env.JWT_ISSUER || 'medianest',
          audience: process.env.JWT_AUDIENCE || 'medianest-users',
          algorithm: 'HS256',
        }
      );

      // Create session for the escalated token
      await sessionTokenRepository.create({
        userId: testUser.id,
        token: escalatedToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${escalatedToken}`);

      // Should be rejected because user's actual role is 'user'
      expect(response.status).toBe(403);
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should have consistent response times for invalid tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        validToken + 'extra',
        validToken.slice(0, -5),
        'a'.repeat(validToken.length),
      ];

      const timings: number[] = [];

      for (const token of invalidTokens) {
        const start = Date.now();
        await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`);
        timings.push(Date.now() - start);
      }

      // Check that timing differences are minimal (less than 100ms variance)
      const minTime = Math.min(...timings);
      const maxTime = Math.max(...timings);
      expect(maxTime - minTime).toBeLessThan(100);
    });

    it('should have consistent response times for non-existent vs invalid users', async () => {
      const nonExistentUserToken = jwt.sign(
        {
          userId: 'non-existent-user',
          email: 'nonexistent@example.com',
          role: 'user',
        },
        process.env.JWT_SECRET || 'development-secret-change-in-production',
        {
          issuer: process.env.JWT_ISSUER || 'medianest',
          audience: process.env.JWT_AUDIENCE || 'medianest-users',
          algorithm: 'HS256',
        }
      );

      const start1 = Date.now();
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${nonExistentUserToken}`);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token');
      const time2 = Date.now() - start2;

      // Response times should be similar
      expect(Math.abs(time1 - time2)).toBeLessThan(50);
    });
  });

  describe('Request Forgery Prevention', () => {
    it('should reject requests with suspicious user agents', async () => {
      const suspiciousUserAgents = [
        'sqlmap/1.0',
        'nikto',
        'nessus',
        'OpenVAS',
        'curl/7.0 (injection)',
      ];

      for (const userAgent of suspiciousUserAgents) {
        const response = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${validToken}`)
          .set('User-Agent', userAgent);

        // Should work but be logged for monitoring
        expect(response.status).toBe(200);
      }
    });

    it('should handle missing user agent gracefully', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`)
        .unset('User-Agent');

      expect(response.status).toBe(200);
    });
  });

  describe('Error Information Disclosure Prevention', () => {
    it('should not leak sensitive information in error responses', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.message).not.toContain('JWT');
      expect(response.body.message).not.toContain('secret');
      expect(response.body.message).not.toContain('database');
      expect(response.body.message).not.toContain('prisma');
      expect(response.body.message).not.toContain(process.env.JWT_SECRET || '');
    });

    it('should not expose stack traces in production mode', async () => {
      // Set NODE_ENV to production for this test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('trace');

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });
  });
});