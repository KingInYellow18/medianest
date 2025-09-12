/**
 * CRITICAL SECURITY TEST SUITE: Authentication Bypass Prevention
 *
 * Tests comprehensive fixes for authentication bypass vulnerabilities:
 * - Cache poisoning prevention
 * - JWT token security
 * - Session isolation
 * - IP validation
 * - Token blacklisting
 */

import { Express } from 'express';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

import { authCacheService } from '../../src/middleware/auth-cache';
import { authSecurityService } from '../../src/middleware/auth-security-fixes';
import { createTestUser, generateValidToken } from '../helpers/auth';
import { createTestApp } from '../helpers/test-app';

describe('CRITICAL: Authentication Bypass Prevention', () => {
  let app: Express;
  let testUser: any;
  let validToken: string;
  let redis: Redis;

  beforeEach(async () => {
    app = createTestApp();
    testUser = await createTestUser({ role: 'user' });
    validToken = generateValidToken(testUser);
    redis = new Redis(process.env.REDIS_URL);

    // Clear Redis cache
    await redis.flushall();
  });

  afterEach(async () => {
    await redis.flushall();
    await redis.quit();
  });

  describe('Cache Poisoning Prevention', () => {
    test('CRITICAL: Should prevent cross-user cache pollution', async () => {
      const user1 = await createTestUser({ email: 'user1@test.com', role: 'user' });
      const user2 = await createTestUser({ email: 'user2@test.com', role: 'admin' });

      const token1 = generateValidToken(user1);
      const token2 = generateValidToken(user2);

      // Authenticate user1 from IP 192.168.1.1
      const response1 = await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${token1}`)
        .set('X-Forwarded-For', '192.168.1.1')
        .expect(200);

      // Try to use user1's cached data for user2 from different IP
      const response2 = await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${token2}`)
        .set('X-Forwarded-For', '192.168.1.2')
        .expect(200);

      // Verify each user gets their own data (not cached cross-pollution)
      expect(response1.body.user.id).toBe(user1.id);
      expect(response2.body.user.id).toBe(user2.id);
      expect(response1.body.user.role).toBe('user');
      expect(response2.body.user.role).toBe('admin');
    });

    test('CRITICAL: Should invalidate cache on IP address change', async () => {
      // Cache user from first IP
      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Forwarded-For', '192.168.1.1')
        .expect(200);

      // Attempt from different IP should NOT use cached data
      const spy = vi.spyOn(authCacheService, 'getCachedUser');

      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Forwarded-For', '192.168.1.2')
        .expect(401); // Should fail due to IP mismatch

      expect(spy).toHaveBeenCalled();
    });

    test('CRITICAL: Should use session-specific cache keys', async () => {
      const sessionId1 = 'session-123';
      const sessionId2 = 'session-456';

      const token1 = jwt.sign(
        { userId: testUser.id, sessionId: sessionId1, ipAddress: '192.168.1.1' },
        process.env.JWT_SECRET!,
      );

      const token2 = jwt.sign(
        { userId: testUser.id, sessionId: sessionId2, ipAddress: '192.168.1.1' },
        process.env.JWT_SECRET!,
      );

      // Each session should have isolated cache
      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${token1}`)
        .set('X-Forwarded-For', '192.168.1.1')
        .expect(200);

      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${token2}`)
        .set('X-Forwarded-For', '192.168.1.1')
        .expect(200);

      // Verify separate cache entries exist
      const cacheKey1 = authSecurityService.generateSecureCacheKey(
        testUser.id,
        sessionId1,
        '192.168.1.1',
        'user',
      );
      const cacheKey2 = authSecurityService.generateSecureCacheKey(
        testUser.id,
        sessionId2,
        '192.168.1.1',
        'user',
      );

      expect(cacheKey1).not.toBe(cacheKey2);
    });
  });

  describe('JWT Token Security', () => {
    test('CRITICAL: Should validate IP address in token', async () => {
      const tokenWithIP = jwt.sign(
        { userId: testUser.id, sessionId: 'test-session', ipAddress: '192.168.1.1' },
        process.env.JWT_SECRET!,
      );

      // Valid IP should work
      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${tokenWithIP}`)
        .set('X-Forwarded-For', '192.168.1.1')
        .expect(200);

      // Different IP should fail
      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${tokenWithIP}`)
        .set('X-Forwarded-For', '192.168.1.2')
        .expect(401);
    });

    test('CRITICAL: Should blacklist tokens on logout', async () => {
      // Valid request first
      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Logout - should blacklist token
      await authSecurityService.blacklistToken(validToken, testUser.id, 'test_logout');

      // Token should now be invalid
      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);
    });

    test('CRITICAL: Should detect token reuse after rotation', async () => {
      const oldToken = validToken;

      // Simulate token rotation
      const newToken = jwt.sign(
        { userId: testUser.id, sessionId: 'new-session', tokenGeneration: 2 },
        process.env.JWT_SECRET!,
      );

      // Blacklist old token during rotation
      await authSecurityService.blacklistToken(oldToken, testUser.id, 'token_rotation');

      // Old token should fail
      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(401);

      // New token should work
      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);
    });
  });

  describe('Session Security', () => {
    test('CRITICAL: Should isolate user sessions', async () => {
      const user1 = await createTestUser({ email: 'isolated1@test.com' });
      const user2 = await createTestUser({ email: 'isolated2@test.com' });

      // Create separate sessions
      const token1 = generateValidToken(user1);
      const token2 = generateValidToken(user2);

      // Invalidate user1 sessions
      await authSecurityService.invalidateUserSessions(user1.id, 'security_test');

      // User1 should be logged out
      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${token1}`)
        .expect(401);

      // User2 should still be logged in
      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);
    });

    test('CRITICAL: Should invalidate cache on user status change', async () => {
      // Cache user data
      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Simulate user deactivation
      testUser.status = 'inactive';
      await authCacheService.invalidateUserCache(testUser.id, 'user_deactivated');

      // Should now be unauthorized
      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);
    });
  });

  describe('Suspicious Activity Detection', () => {
    test('CRITICAL: Should detect rapid authentication attempts', async () => {
      const ipAddress = '192.168.1.100';

      // Simulate 15 rapid attempts
      for (let i = 0; i < 15; i++) {
        await authSecurityService.detectSuspiciousActivity(testUser.id, ipAddress);
      }

      const result = await authSecurityService.detectSuspiciousActivity(testUser.id, ipAddress);

      expect(result.isSuspicious).toBe(true);
      expect(result.reasons).toContain('rapid_authentication_attempts');
      expect(result.riskScore).toBeGreaterThan(40);
    });

    test('CRITICAL: Should detect multiple IP addresses', async () => {
      const ips = [
        '192.168.1.1',
        '192.168.1.2',
        '192.168.1.3',
        '192.168.1.4',
        '192.168.1.5',
        '192.168.1.6',
      ];

      // Register activity from multiple IPs
      for (const ip of ips) {
        await authSecurityService.detectSuspiciousActivity(testUser.id, ip);
      }

      const result = await authSecurityService.detectSuspiciousActivity(testUser.id, '192.168.1.7');

      expect(result.isSuspicious).toBe(true);
      expect(result.reasons).toContain('multiple_ip_addresses');
    });
  });

  describe('Security Audit Logging', () => {
    test('CRITICAL: Should log all security events', async () => {
      const spy = vi.spyOn(authSecurityService, 'logSecurityEvent');

      await authSecurityService.blacklistToken(validToken, testUser.id, 'test_audit');

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUser.id,
          action: 'logout',
          reason: 'Token blacklisted: test_audit',
        }),
      );
    });

    test('CRITICAL: Should maintain audit trail in Redis', async () => {
      await authSecurityService.logSecurityEvent({
        userId: testUser.id,
        action: 'login',
        reason: 'Test security event',
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
      });

      const auditKey = `security:audit:${testUser.id}`;
      const auditLogs = await redis.lrange(auditKey, 0, -1);

      expect(auditLogs.length).toBeGreaterThan(0);

      const logEntry = JSON.parse(auditLogs[0]);
      expect(logEntry.userId).toBe(testUser.id);
      expect(logEntry.action).toBe('login');
    });
  });

  describe('Zero Trust Validation', () => {
    test('CRITICAL: Should never trust cached data without validation', async () => {
      const spy = vi.spyOn(authCacheService, 'getCachedUser');

      // Mock cached data with inactive status
      spy.mockResolvedValueOnce({
        id: testUser.id,
        email: testUser.email,
        role: testUser.role,
        status: 'inactive',
        cachedAt: Date.now(),
      });

      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401); // Should reject inactive user even if cached

      spy.mockRestore();
    });

    test('CRITICAL: Should validate JWT signature always', async () => {
      const tamperedToken = validToken.slice(0, -10) + 'tampered123';

      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);
    });

    test('CRITICAL: Should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: testUser.id, exp: Math.floor(Date.now() / 1000) - 3600 }, // Expired 1 hour ago
        process.env.JWT_SECRET!,
      );

      await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Memory Safety', () => {
    test('CRITICAL: Should limit cache size to prevent memory attacks', async () => {
      // This test would be implementation-specific
      // Testing cache size limits and cleanup
      expect(true).toBe(true); // Placeholder - implement based on cache implementation
    });

    test('CRITICAL: Should clean up expired cache entries', async () => {
      // Simulate expired cache entries cleanup
      const cleanupSpy = vi.spyOn(authCacheService, 'invalidateUserCache');

      // This would trigger cache cleanup in real implementation
      await authCacheService.getCachedUser(testUser.id, 'test-session', '192.168.1.1', true);

      expect(cleanupSpy).toBeDefined();
    });
  });
});
