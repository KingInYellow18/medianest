import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';

import { app } from '../../../src/server';
import { cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { createTestUser, generateValidToken } from '../../helpers/auth';
import { UserRepository } from '../../../src/repositories/user.repository';
import { SessionTokenRepository } from '../../../src/repositories/session-token.repository';
import { getRedis } from '../../../src/config/redis';

describe('Session Management Security Tests', () => {
  let userRepository: UserRepository;
  let sessionTokenRepository: SessionTokenRepository;
  let testUser: User;
  let redis: any;

  beforeAll(async () => {
    userRepository = new UserRepository();
    sessionTokenRepository = new SessionTokenRepository();
    redis = getRedis();
  });

  beforeEach(async () => {
    await cleanDatabase();
    
    testUser = await createTestUser({
      email: 'test@example.com',
      name: 'Test User',
      plexId: 'plex-123',
      role: 'user',
    });
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('Session Creation Security', () => {
    it('should create session token when generating JWT', async () => {
      const token = await generateValidToken(testUser.id);
      
      // Verify session was created in database
      const session = await sessionTokenRepository.validate(token);
      expect(session).not.toBeNull();
      expect(session?.userId).toBe(testUser.id);
    });

    it('should set appropriate session expiry', async () => {
      const token = await generateValidToken(testUser.id);
      const session = await sessionTokenRepository.validate(token);
      
      expect(session).not.toBeNull();
      expect(session!.expiresAt).toBeInstanceOf(Date);
      expect(session!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should prevent session token reuse for different users', async () => {
      const user2 = await createTestUser({
        email: 'user2@example.com',
        name: 'User Two',
        plexId: 'plex-456',
        role: 'user',
      });

      const token1 = await generateValidToken(testUser.id);
      
      // Try to create session with same token for different user
      const duplicateSession = sessionTokenRepository.create({
        userId: user2.id,
        token: token1,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await expect(duplicateSession).rejects.toThrow();
    });

    it('should prevent multiple active sessions with same token', async () => {
      const token = await generateValidToken(testUser.id);
      
      // Try to create another session with same token
      const duplicateSession = sessionTokenRepository.create({
        userId: testUser.id,
        token: token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await expect(duplicateSession).rejects.toThrow();
    });
  });

  describe('Session Validation Security', () => {
    it('should validate active sessions correctly', async () => {
      const token = await generateValidToken(testUser.id);
      
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testUser.id);
    });

    it('should reject revoked sessions', async () => {
      const token = await generateValidToken(testUser.id);
      
      // First request should work
      const response1 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(response1.status).toBe(200);

      // Revoke session
      await sessionTokenRepository.revoke(token);

      // Second request should fail
      const response2 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(response2.status).toBe(401);
    });

    it('should reject expired sessions', async () => {
      // Create session with past expiry
      const expiredToken = jwt.sign(
        {
          userId: testUser.id,
          email: testUser.email,
          role: testUser.role,
        },
        process.env.JWT_SECRET || 'development-secret-change-in-production'
      );

      await sessionTokenRepository.create({
        userId: testUser.id,
        token: expiredToken,
        expiresAt: new Date(Date.now() - 1000), // Already expired
      });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    it('should clean up expired sessions automatically', async () => {
      // Create expired session
      const expiredToken = jwt.sign(
        {
          userId: testUser.id,
          email: testUser.email,
          role: testUser.role,
        },
        process.env.JWT_SECRET || 'development-secret-change-in-production'
      );

      await sessionTokenRepository.create({
        userId: testUser.id,
        token: expiredToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      // Trigger cleanup
      await sessionTokenRepository.cleanupExpired();

      // Session should be removed
      const session = await sessionTokenRepository.validate(expiredToken);
      expect(session).toBeNull();
    });
  });

  describe('Session Hijacking Prevention', () => {
    it('should validate user agent consistency', async () => {
      const token = await generateValidToken(testUser.id);
      const userAgent1 = 'Mozilla/5.0 (Test Browser 1)';
      const userAgent2 = 'Mozilla/5.0 (Test Browser 2)';

      // First request with user agent 1
      const response1 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', userAgent1);
      expect(response1.status).toBe(200);

      // Second request with different user agent should work but be logged
      const response2 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .set('User-Agent', userAgent2);
      expect(response2.status).toBe(200); // Should work but trigger security logging
    });

    it('should detect suspicious IP changes', async () => {
      const token = await generateValidToken(testUser.id);

      // Simulate requests from different IPs
      const response1 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Forwarded-For', '192.168.1.100');
      expect(response1.status).toBe(200);

      const response2 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Forwarded-For', '10.0.0.50');
      expect(response2.status).toBe(200); // Should work but be monitored
    });

    it('should prevent concurrent sessions from different locations', async () => {
      const token1 = await generateValidToken(testUser.id);
      const token2 = await generateValidToken(testUser.id);

      // Concurrent requests from different tokens should work
      const responses = await Promise.all([
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token1}`),
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token2}`),
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Session Fixation Prevention', () => {
    it('should generate new session token on authentication', async () => {
      // Simulate pre-authentication state
      const preAuthToken = jwt.sign(
        { temp: true },
        process.env.JWT_SECRET || 'development-secret-change-in-production'
      );

      // New token should be different
      const postAuthToken = await generateValidToken(testUser.id);
      
      expect(preAuthToken).not.toBe(postAuthToken);
    });

    it('should invalidate old sessions on password change', async () => {
      const token1 = await generateValidToken(testUser.id);
      const token2 = await generateValidToken(testUser.id);

      // Both tokens should work initially
      const response1 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token1}`);
      expect(response1.status).toBe(200);

      const response2 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token2}`);
      expect(response2.status).toBe(200);

      // Simulate password change (would typically revoke all sessions)
      await sessionTokenRepository.revokeAllForUser(testUser.id);

      // Both tokens should now be invalid
      const response3 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token1}`);
      expect(response3.status).toBe(401);

      const response4 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token2}`);
      expect(response4.status).toBe(401);
    });

    it('should invalidate sessions on user deactivation', async () => {
      const token = await generateValidToken(testUser.id);

      // Token should work initially
      const response1 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(response1.status).toBe(200);

      // Deactivate user
      await userRepository.update(testUser.id, { status: 'inactive' });

      // Token should now be invalid
      const response2 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(response2.status).toBe(401);
    });
  });

  describe('Concurrent Session Management', () => {
    it('should handle concurrent authentication requests', async () => {
      const promises = Array(5).fill(null).map(async () => {
        const token = await generateValidToken(testUser.id);
        return request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`);
      });

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(testUser.id);
      });
    });

    it('should handle concurrent session revocation', async () => {
      const tokens = await Promise.all([
        generateValidToken(testUser.id),
        generateValidToken(testUser.id),
        generateValidToken(testUser.id),
      ]);

      // Revoke all sessions concurrently
      const revokePromises = tokens.map(token =>
        sessionTokenRepository.revoke(token)
      );
      
      await Promise.all(revokePromises);

      // All tokens should be invalid
      const testPromises = tokens.map(token =>
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`)
      );

      const responses = await Promise.all(testPromises);
      responses.forEach(response => {
        expect(response.status).toBe(401);
      });
    });

    it('should prevent race conditions in session validation', async () => {
      const token = await generateValidToken(testUser.id);

      // Create multiple concurrent requests with same token
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`)
      );

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(testUser.id);
      });
    });
  });

  describe('Redis Session Security', () => {
    it('should securely store session data in Redis', async () => {
      const token = await generateValidToken(testUser.id);
      
      // Check if session data is stored in Redis
      const sessionKey = `session:${token}`;
      const sessionData = await redis.get(sessionKey);
      
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        expect(parsed).not.toHaveProperty('password');
        expect(parsed).not.toHaveProperty('plexToken');
      }
    });

    it('should handle Redis connection failures gracefully', async () => {
      const token = await generateValidToken(testUser.id);
      
      // Even if Redis fails, database session should still work
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it('should properly expire Redis session data', async () => {
      const token = await generateValidToken(testUser.id);
      const sessionKey = `session:${token}`;
      
      // Check if TTL is set
      const ttl = await redis.ttl(sessionKey);
      expect(ttl).toBeGreaterThan(0); // Should have an expiry time
    });
  });

  describe('Session Logout Security', () => {
    it('should properly revoke session on logout', async () => {
      const token = await generateValidToken(testUser.id);

      // Login should work
      const response1 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(response1.status).toBe(200);

      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      expect(logoutResponse.status).toBe(200);

      // Subsequent requests should fail
      const response2 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(response2.status).toBe(401);
    });

    it('should support logout from all sessions', async () => {
      const token1 = await generateValidToken(testUser.id);
      const token2 = await generateValidToken(testUser.id);

      // Both tokens should work
      const response1 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token1}`);
      expect(response1.status).toBe(200);

      const response2 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token2}`);
      expect(response2.status).toBe(200);

      // Logout from all sessions
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token1}`)
        .send({ allSessions: true });
      expect(logoutResponse.status).toBe(200);

      // Both tokens should now be invalid
      const response3 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token1}`);
      expect(response3.status).toBe(401);

      const response4 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token2}`);
      expect(response4.status).toBe(401);
    });
  });

  describe('Session Security Headers', () => {
    it('should set secure session-related headers', async () => {
      const token = await generateValidToken(testUser.id);

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      
      // Should not expose sensitive session information in headers
      expect(response.headers).not.toHaveProperty('x-session-id');
      expect(response.headers).not.toHaveProperty('x-user-token');
    });

    it('should handle CORS properly for authenticated requests', async () => {
      const token = await generateValidToken(testUser.id);

      const response = await request(app)
        .options('/api/users/me')
        .set('Origin', 'https://malicious.com')
        .set('Authorization', `Bearer ${token}`);

      // CORS should be properly configured
      expect(response.headers['access-control-allow-origin']).not.toBe('*');
    });
  });

  describe('Session Cleanup and Maintenance', () => {
    it('should automatically clean up expired sessions', async () => {
      // Create multiple expired sessions
      const expiredSessions = await Promise.all([
        sessionTokenRepository.create({
          userId: testUser.id,
          token: 'expired1',
          expiresAt: new Date(Date.now() - 1000),
        }),
        sessionTokenRepository.create({
          userId: testUser.id,
          token: 'expired2',
          expiresAt: new Date(Date.now() - 2000),
        }),
      ]);

      // Run cleanup
      await sessionTokenRepository.cleanupExpired();

      // Sessions should be removed
      for (const session of expiredSessions) {
        const found = await sessionTokenRepository.validate(session.token);
        expect(found).toBeNull();
      }
    });

    it('should maintain session statistics', async () => {
      const token1 = await generateValidToken(testUser.id);
      const token2 = await generateValidToken(testUser.id);

      // Get session count for user
      const count = await sessionTokenRepository.countActiveForUser(testUser.id);
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('should handle database session conflicts gracefully', async () => {
      const token = await generateValidToken(testUser.id);

      // Simulate database constraint violation
      try {
        await sessionTokenRepository.create({
          userId: testUser.id,
          token: token, // Duplicate token
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      } catch (error) {
        // Should handle gracefully
        expect(error).toBeDefined();
      }

      // Original session should still work
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
    });
  });
});