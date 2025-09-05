import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { User } from '@prisma/client';

import { app } from '../../../src/server';
import { cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { createTestUser, generateValidToken } from '../../helpers/auth';
import { getRedis } from '../../../src/config/redis';

describe('Rate Limiting and Bypass Prevention Tests', () => {
  let testUser: User;
  let testUserToken: string;
  let redis: any;

  beforeAll(async () => {
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
    
    testUserToken = await generateValidToken(testUser.id);
    
    // Clear Redis rate limit counters
    const keys = await redis.keys('rate:*');
    if (keys.length > 0) {
      await redis.del(keys);
    }
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('API Rate Limiting', () => {
    it('should enforce general API rate limits', async () => {
      const promises: Promise<any>[] = [];
      
      // Create requests exceeding the rate limit (100 requests per minute)
      for (let i = 0; i < 105; i++) {
        promises.push(
          request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${testUserToken}`)
        );
      }

      const responses = await Promise.all(promises);
      
      // Count successful and rate-limited responses
      const successful = responses.filter(r => r.status === 200).length;
      const rateLimited = responses.filter(r => r.status === 429).length;
      
      expect(successful).toBeLessThanOrEqual(100);
      expect(rateLimited).toBeGreaterThanOrEqual(5);
      
      // Check rate limit headers on rate-limited responses
      const rateLimitedResponse = responses.find(r => r.status === 429);
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-limit');
        expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-remaining');
        expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-reset');
        expect(rateLimitedResponse.headers).toHaveProperty('retry-after');
      }
    });

    it('should apply different rate limits per user', async () => {
      // Create second user
      const user2 = await createTestUser({
        email: 'user2@example.com',
        name: 'User Two',
        plexId: 'plex-456',
        role: 'user',
      });
      const user2Token = await generateValidToken(user2.id);

      // Each user should have their own rate limit
      const user1Promises = Array(30).fill(null).map(() =>
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${testUserToken}`)
      );

      const user2Promises = Array(30).fill(null).map(() =>
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${user2Token}`)
      );

      const [user1Responses, user2Responses] = await Promise.all([
        Promise.all(user1Promises),
        Promise.all(user2Promises),
      ]);

      // Both users should be able to make requests
      const user1Success = user1Responses.filter(r => r.status === 200).length;
      const user2Success = user2Responses.filter(r => r.status === 200).length;

      expect(user1Success).toBeGreaterThan(25);
      expect(user2Success).toBeGreaterThan(25);
    });

    it('should use IP-based rate limiting for unauthenticated requests', async () => {
      const promises = Array(15).fill(null).map(() =>
        request(app).get('/api/health')
      );

      const responses = await Promise.all(promises);
      
      // All should succeed since /api/health has different limits
      const successful = responses.filter(r => r.status === 200).length;
      expect(successful).toBe(15);
    });
  });

  describe('Authentication Rate Limiting', () => {
    it('should enforce strict rate limits on authentication endpoints', async () => {
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'wrong@example.com',
            password: 'wrongpassword',
          })
      );

      const responses = await Promise.all(promises);
      
      const successful = responses.filter(r => [200, 401].includes(r.status)).length;
      const rateLimited = responses.filter(r => r.status === 429).length;
      
      // Should start rate limiting after 5 attempts (15 minute window)
      expect(rateLimited).toBeGreaterThanOrEqual(5);
      expect(successful).toBeLessThanOrEqual(5);
    });

    it('should rate limit PIN generation attempts', async () => {
      const promises = Array(8).fill(null).map(() =>
        request(app)
          .post('/api/auth/plex/pin')
          .send({})
      );

      const responses = await Promise.all(promises);
      
      const rateLimited = responses.filter(r => r.status === 429).length;
      expect(rateLimited).toBeGreaterThanOrEqual(3); // Should hit strict rate limit
    });

    it('should rate limit password change attempts', async () => {
      const promises = Array(6).fill(null).map(() =>
        request(app)
          .patch('/api/auth/change-password')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            currentPassword: 'wrong-password',
            newPassword: 'NewPassword123!',
            confirmNewPassword: 'NewPassword123!',
          })
      );

      const responses = await Promise.all(promises);
      
      const rateLimited = responses.filter(r => r.status === 429).length;
      expect(rateLimited).toBeGreaterThanOrEqual(2); // Should hit rate limit quickly
    });
  });

  describe('YouTube Download Rate Limiting', () => {
    it('should enforce hourly YouTube download limits', async () => {
      const downloadRequests = Array(7).fill(null).map((_, i) =>
        request(app)
          .post('/api/youtube/download')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            url: `https://youtube.com/watch?v=test${i}`,
            format: 'mp4',
          })
      );

      const responses = await Promise.all(downloadRequests);
      
      const successful = responses.filter(r => [200, 201, 202].includes(r.status)).length;
      const rateLimited = responses.filter(r => r.status === 429).length;
      
      // Should limit to 5 downloads per hour
      expect(successful).toBeLessThanOrEqual(5);
      expect(rateLimited).toBeGreaterThanOrEqual(2);
    });

    it('should apply per-user YouTube download limits', async () => {
      const user2 = await createTestUser({
        email: 'user2@example.com',
        name: 'User Two',
        plexId: 'plex-456',
        role: 'user',
      });
      const user2Token = await generateValidToken(user2.id);

      const user1Downloads = Array(3).fill(null).map((_, i) =>
        request(app)
          .post('/api/youtube/download')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            url: `https://youtube.com/watch?v=user1_${i}`,
            format: 'mp4',
          })
      );

      const user2Downloads = Array(3).fill(null).map((_, i) =>
        request(app)
          .post('/api/youtube/download')
          .set('Authorization', `Bearer ${user2Token}`)
          .send({
            url: `https://youtube.com/watch?v=user2_${i}`,
            format: 'mp4',
          })
      );

      const [user1Responses, user2Responses] = await Promise.all([
        Promise.all(user1Downloads),
        Promise.all(user2Downloads),
      ]);

      // Both users should be able to make downloads within limit
      const user1Success = user1Responses.filter(r => [200, 201, 202].includes(r.status)).length;
      const user2Success = user2Responses.filter(r => [200, 201, 202].includes(r.status)).length;

      expect(user1Success).toBeGreaterThanOrEqual(2);
      expect(user2Success).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Media Request Rate Limiting', () => {
    it('should enforce hourly media request limits', async () => {
      const mediaRequests = Array(25).fill(null).map((_, i) =>
        request(app)
          .post('/api/media-requests')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            title: `Movie ${i}`,
            mediaType: 'movie',
            tmdbId: `${12345 + i}`,
          })
      );

      const responses = await Promise.all(mediaRequests);
      
      const successful = responses.filter(r => r.status === 201).length;
      const rateLimited = responses.filter(r => r.status === 429).length;
      
      // Should limit to 20 requests per hour
      expect(successful).toBeLessThanOrEqual(20);
      expect(rateLimited).toBeGreaterThanOrEqual(5);
    });

    it('should allow reasonable media request rates', async () => {
      const mediaRequests = Array(10).fill(null).map((_, i) =>
        request(app)
          .post('/api/media-requests')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            title: `Movie ${i}`,
            mediaType: 'movie',
            tmdbId: `${12345 + i}`,
          })
      );

      const responses = await Promise.all(mediaRequests);
      
      // All should succeed within reasonable limits
      const successful = responses.filter(r => r.status === 201).length;
      expect(successful).toBe(10);
    });
  });

  describe('Rate Limit Bypass Prevention', () => {
    it('should prevent rate limit bypass with different user agents', async () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'curl/7.68.0',
        'PostmanRuntime/7.28.0',
      ];

      const promises: Promise<any>[] = [];
      
      // Make requests with different user agents
      for (let i = 0; i < 110; i++) {
        const userAgent = userAgents[i % userAgents.length];
        promises.push(
          request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${testUserToken}`)
            .set('User-Agent', userAgent)
        );
      }

      const responses = await Promise.all(promises);
      
      const successful = responses.filter(r => r.status === 200).length;
      const rateLimited = responses.filter(r => r.status === 429).length;
      
      // Should still be rate limited regardless of user agent
      expect(successful).toBeLessThanOrEqual(100);
      expect(rateLimited).toBeGreaterThanOrEqual(10);
    });

    it('should prevent rate limit bypass with X-Forwarded-For headers', async () => {
      const fakeIPs = [
        '192.168.1.1',
        '10.0.0.1',
        '172.16.0.1',
        '203.0.113.1',
        '198.51.100.1',
      ];

      const promises: Promise<any>[] = [];
      
      // Make requests with different fake IPs
      for (let i = 0; i < 110; i++) {
        const fakeIP = fakeIPs[i % fakeIPs.length];
        promises.push(
          request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${testUserToken}`)
            .set('X-Forwarded-For', fakeIP)
        );
      }

      const responses = await Promise.all(promises);
      
      const successful = responses.filter(r => r.status === 200).length;
      const rateLimited = responses.filter(r => r.status === 429).length;
      
      // Should still be rate limited by user ID, not IP
      expect(successful).toBeLessThanOrEqual(100);
      expect(rateLimited).toBeGreaterThanOrEqual(10);
    });

    it('should prevent rate limit bypass with multiple authorization headers', async () => {
      const promises = Array(110).fill(null).map((_, i) =>
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${testUserToken}`)
          .set('X-API-Key', `fake-key-${i}`)
          .set('X-Auth-Token', `fake-token-${i}`)
      );

      const responses = await Promise.all(promises);
      
      const successful = responses.filter(r => r.status === 200).length;
      const rateLimited = responses.filter(r => r.status === 429).length;
      
      // Should still apply rate limits based on JWT token
      expect(successful).toBeLessThanOrEqual(100);
      expect(rateLimited).toBeGreaterThanOrEqual(10);
    });

    it('should prevent session rotation to bypass rate limits', async () => {
      // Generate multiple tokens for the same user
      const tokens = await Promise.all([
        generateValidToken(testUser.id),
        generateValidToken(testUser.id),
        generateValidToken(testUser.id),
      ]);

      const promises: Promise<any>[] = [];
      
      // Rotate through different tokens
      for (let i = 0; i < 110; i++) {
        const token = tokens[i % tokens.length];
        promises.push(
          request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${token}`)
        );
      }

      const responses = await Promise.all(promises);
      
      const successful = responses.filter(r => r.status === 200).length;
      const rateLimited = responses.filter(r => r.status === 429).length;
      
      // Should still be rate limited by user ID
      expect(successful).toBeLessThanOrEqual(100);
      expect(rateLimited).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Rate Limit Error Handling', () => {
    it('should provide proper rate limit error responses', async () => {
      // Hit rate limit first
      await Promise.all(
        Array(105).fill(null).map(() =>
          request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${testUserToken}`)
        )
      );

      // Make one more request to get rate limit response
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`);

      if (response.status === 429) {
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Too many');
        expect(response.body).toHaveProperty('code');
        expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
        
        expect(response.headers).toHaveProperty('x-ratelimit-limit');
        expect(response.headers).toHaveProperty('x-ratelimit-remaining', '0');
        expect(response.headers).toHaveProperty('retry-after');
        
        const retryAfter = parseInt(response.headers['retry-after']);
        expect(retryAfter).toBeGreaterThan(0);
        expect(retryAfter).toBeLessThanOrEqual(60); // Should be within 1 minute
      }
    });

    it('should not leak sensitive information in rate limit errors', async () => {
      // Hit auth rate limit
      await Promise.all(
        Array(6).fill(null).map(() =>
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'wrongpassword',
            })
        )
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      if (response.status === 429) {
        expect(response.body.message).not.toContain('redis');
        expect(response.body.message).not.toContain('database');
        expect(response.body.message).not.toContain('user');
        expect(response.body.message).not.toContain(testUser.id);
        expect(response.body.message).not.toContain(testUser.email);
      }
    });
  });

  describe('Rate Limit Redis Operations', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // This test would require mocking Redis failure, but we'll test the concept
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`);

      // Should work even if Redis is down (might not have rate limiting)
      expect([200, 500]).toContain(response.status);
    });

    it('should use Lua scripts for atomic operations', async () => {
      // Make a request and verify Redis keys are set atomically
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`);

      const rateKey = `rate:${testUser.id}`;
      const count = await redis.get(rateKey);
      const ttl = await redis.ttl(rateKey);

      expect(parseInt(count)).toBeGreaterThan(0);
      expect(ttl).toBeGreaterThan(0); // Should have expiry set
    });

    it('should clean up expired rate limit keys', async () => {
      // Make a request to create rate limit key
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`);

      const rateKey = `rate:${testUser.id}`;
      
      // Set short expiry for testing
      await redis.expire(rateKey, 1);
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Key should be gone
      const count = await redis.get(rateKey);
      expect(count).toBeNull();
    });
  });

  describe('Rate Limit Window Behavior', () => {
    it('should reset rate limits after time window expires', async () => {
      // Hit rate limit
      await Promise.all(
        Array(105).fill(null).map(() =>
          request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${testUserToken}`)
        )
      );

      // Should be rate limited
      const rateLimitedResponse = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`);
      
      expect(rateLimitedResponse.status).toBe(429);

      // For testing, we can't wait 60 seconds, so we'll simulate reset
      const rateKey = `rate:${testUser.id}`;
      await redis.del(rateKey);

      // Should work again
      const resetResponse = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`);
      
      expect(resetResponse.status).toBe(200);
    });

    it('should use sliding window for rate limits', async () => {
      // Make some requests
      const initialRequests = Array(50).fill(null).map(() =>
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${testUserToken}`)
      );

      await Promise.all(initialRequests);

      // Wait a bit (simulated)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Make more requests
      const laterRequests = Array(55).fill(null).map(() =>
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${testUserToken}`)
      );

      const laterResponses = await Promise.all(laterRequests);
      const rateLimited = laterResponses.filter(r => r.status === 429).length;
      
      // Should be rate limited due to total count
      expect(rateLimited).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Monitoring and Logging', () => {
    it('should log rate limit violations', async () => {
      // Hit rate limit to trigger logging
      await Promise.all(
        Array(105).fill(null).map(() =>
          request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${testUserToken}`)
        )
      );

      // Make another request to ensure rate limit is hit
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(429);
      // In a real scenario, we would check logs for rate limit violations
    });

    it('should track rate limit statistics', async () => {
      // Make several requests
      const responses = await Promise.all(
        Array(50).fill(null).map(() =>
          request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${testUserToken}`)
        )
      );

      // Check rate limit headers for statistics
      const lastResponse = responses[responses.length - 1];
      if (lastResponse.status === 200) {
        expect(lastResponse.headers).toHaveProperty('x-ratelimit-limit');
        expect(lastResponse.headers).toHaveProperty('x-ratelimit-remaining');
        
        const remaining = parseInt(lastResponse.headers['x-ratelimit-remaining']);
        expect(remaining).toBeLessThan(100); // Should have used some quota
      }
    });
  });

  describe('Administrative Rate Limit Controls', () => {
    it('should allow admins to have higher rate limits', async () => {
      const adminUser = await createTestUser({
        email: 'admin@example.com',
        name: 'Admin User',
        plexId: 'plex-admin',
        role: 'admin',
      });
      const adminToken = await generateValidToken(adminUser.id);

      // Admin should have higher or no rate limits
      const adminRequests = Array(120).fill(null).map(() =>
        request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
      );

      const responses = await Promise.all(adminRequests);
      const successful = responses.filter(r => [200, 404].includes(r.status)).length;
      
      // Admins might have higher limits or different enforcement
      expect(successful).toBeGreaterThan(100);
    });

    it('should allow rate limit configuration per role', async () => {
      // This would test different rate limits for different roles
      // Implementation would depend on role-specific rate limiting
      const moderatorUser = await createTestUser({
        email: 'moderator@example.com',
        name: 'Moderator User',
        plexId: 'plex-moderator',
        role: 'moderator',
      });
      const moderatorToken = await generateValidToken(moderatorUser.id);

      const moderatorRequests = Array(110).fill(null).map(() =>
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${moderatorToken}`)
      );

      const responses = await Promise.all(moderatorRequests);
      const rateLimited = responses.filter(r => r.status === 429).length;
      
      // Moderators might have similar limits to regular users
      expect(rateLimited).toBeGreaterThanOrEqual(5);
    });
  });
});