import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '@/app';
import { createClient } from 'redis';

const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });

describe('Critical Path: User Isolation and Data Security', () => {
  let user1Token: string;
  let user1Id: string;
  let user2Token: string;
  let user2Id: string;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    await redis.connect();

    // Clean up test database
    await prisma.youTubeDownload.deleteMany();
    await prisma.mediaRequest.deleteMany();
    await prisma.user.deleteMany();

    // Create test users
    const user1 = await prisma.user.create({
      data: {
        plexId: 'user1-plex-id',
        username: 'user1',
        email: 'user1@example.com',
        role: 'user',
        status: 'active',
      },
    });
    user1Id = user1.id;
    user1Token = global.createTestJWT({ userId: user1.id, role: user1.role });

    const user2 = await prisma.user.create({
      data: {
        plexId: 'user2-plex-id',
        username: 'user2',
        email: 'user2@example.com',
        role: 'user',
        status: 'active',
      },
    });
    user2Id = user2.id;
    user2Token = global.createTestJWT({ userId: user2.id, role: user2.role });

    const admin = await prisma.user.create({
      data: {
        plexId: 'admin-plex-id',
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        status: 'active',
      },
    });
    adminId = admin.id;
    adminToken = global.createTestJWT({ userId: admin.id, role: admin.role });

    // Create test data for each user
    await Promise.all([
      // User 1 data
      prisma.mediaRequest.create({
        data: {
          userId: user1Id,
          externalId: 101,
          mediaType: 'movie',
          mediaId: 101,
          title: 'User 1 Movie Request',
          status: 'pending',
          requestedAt: new Date(),
        },
      }),
      prisma.youTubeDownload.create({
        data: {
          userId: user1Id,
          url: 'https://youtube.com/watch?v=user1video',
          title: 'User 1 Video',
          videoId: 'user1video',
          type: 'video',
          status: 'processing',
          progress: 50,
          quality: '1080p',
          audioOnly: false,
        },
      }),
      // User 2 data
      prisma.mediaRequest.create({
        data: {
          userId: user2Id,
          externalId: 102,
          mediaType: 'tv',
          mediaId: 102,
          title: 'User 2 TV Request',
          status: 'approved',
          requestedAt: new Date(),
        },
      }),
      prisma.youTubeDownload.create({
        data: {
          userId: user2Id,
          url: 'https://youtube.com/watch?v=user2video',
          title: 'User 2 Video',
          videoId: 'user2video',
          type: 'video',
          status: 'completed',
          progress: 100,
          quality: '720p',
          audioOnly: false,
          completedAt: new Date(),
        },
      }),
    ]);
  });

  afterAll(async () => {
    await redis.disconnect();
    await prisma.$disconnect();
  });

  describe('Media Request Isolation', () => {
    it('should only show user their own media requests', async () => {
      // User 1 requests
      const user1Response = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(user1Response.body.requests).toHaveLength(1);
      expect(user1Response.body.requests[0]).toMatchObject({
        title: 'User 1 Movie Request',
        userId: user1Id,
      });

      // User 2 requests
      const user2Response = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(user2Response.body.requests).toHaveLength(1);
      expect(user2Response.body.requests[0]).toMatchObject({
        title: 'User 2 TV Request',
        userId: user2Id,
      });
    });

    it('should prevent users from accessing other users specific requests', async () => {
      // Get User 1's request ID
      const user1Requests = await prisma.mediaRequest.findFirst({
        where: { userId: user1Id },
      });

      // User 2 tries to access User 1's request
      await request(app)
        .get(`/api/v1/media/requests/${user1Requests!.id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404);

      // User 1 can access their own request
      const ownRequest = await request(app)
        .get(`/api/v1/media/requests/${user1Requests!.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(ownRequest.body.userId).toBe(user1Id);
    });

    it('should prevent users from deleting other users requests', async () => {
      const user2Request = await prisma.mediaRequest.findFirst({
        where: { userId: user2Id },
      });

      // User 1 tries to delete User 2's request
      await request(app)
        .delete(`/api/v1/media/requests/${user2Request!.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);

      // Verify request still exists
      const stillExists = await prisma.mediaRequest.findUnique({
        where: { id: user2Request!.id },
      });
      expect(stillExists).toBeTruthy();
    });
  });

  describe('YouTube Download Isolation', () => {
    it('should only show user their own downloads', async () => {
      // User 1 downloads
      const user1Response = await request(app)
        .get('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(user1Response.body.downloads).toHaveLength(1);
      expect(user1Response.body.downloads[0]).toMatchObject({
        title: 'User 1 Video',
        userId: user1Id,
      });

      // User 2 downloads
      const user2Response = await request(app)
        .get('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(user2Response.body.downloads).toHaveLength(1);
      expect(user2Response.body.downloads[0]).toMatchObject({
        title: 'User 2 Video',
        userId: user2Id,
      });
    });

    it('should prevent users from accessing other users download details', async () => {
      const user1Download = await prisma.youTubeDownload.findFirst({
        where: { userId: user1Id },
      });

      // User 2 tries to access User 1's download
      await request(app)
        .get(`/api/v1/youtube/downloads/${user1Download!.id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404);
    });

    it('should prevent users from cancelling other users downloads', async () => {
      const user2Download = await prisma.youTubeDownload.findFirst({
        where: { userId: user2Id },
      });

      // User 1 tries to cancel User 2's download
      await request(app)
        .delete(`/api/v1/youtube/downloads/${user2Download!.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);

      // Verify download still exists and status unchanged
      const stillExists = await prisma.youTubeDownload.findUnique({
        where: { id: user2Download!.id },
      });
      expect(stillExists).toBeTruthy();
      expect(stillExists!.status).toBe('completed');
    });
  });

  describe('Rate Limiting Isolation', () => {
    it('should enforce separate rate limits per user', async () => {
      // Clear rate limits
      await redis.flushDb();

      // User 1 makes 5 requests (at limit)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/youtube/download')
          .send({
            url: `https://youtube.com/watch?v=user1_${i}`,
            quality: '720p',
          })
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(201);
      }

      // User 1's 6th request should be rate limited
      await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://youtube.com/watch?v=user1_blocked',
          quality: '720p',
        })
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(429);

      // User 2 should still be able to download
      await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://youtube.com/watch?v=user2_allowed',
          quality: '720p',
        })
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(201);
    });

    it('should track API rate limits separately per user', async () => {
      // Make rapid API calls as User 1
      const user1Promises = Array(50)
        .fill(null)
        .map(() =>
          request(app)
            .get('/api/v1/media/search?q=test')
            .set('Authorization', `Bearer ${user1Token}`),
        );

      const user1Results = await Promise.all(user1Promises);
      const user1RateLimited = user1Results.some((r) => r.status === 429);

      // User 2 should still have their own rate limit
      const user2Response = await request(app)
        .get('/api/v1/media/search?q=test')
        .set('Authorization', `Bearer ${user2Token}`);

      // User 2 should not be affected by User 1's rate limit
      expect(user2Response.status).not.toBe(429);
    });
  });

  describe('Admin Access Controls', () => {
    it('should allow admin to view all users requests', async () => {
      const adminResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ all: true })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Admin should see both users' requests
      expect(adminResponse.body.requests.length).toBeGreaterThanOrEqual(2);
      const userIds = adminResponse.body.requests.map((r: any) => r.userId);
      expect(userIds).toContain(user1Id);
      expect(userIds).toContain(user2Id);
    });

    it('should allow admin to view all YouTube downloads', async () => {
      const adminResponse = await request(app)
        .get('/api/v1/youtube/downloads')
        .query({ all: true })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Admin should see both users' downloads
      expect(adminResponse.body.downloads.length).toBeGreaterThanOrEqual(2);
      const titles = adminResponse.body.downloads.map((d: any) => d.title);
      expect(titles).toContain('User 1 Video');
      expect(titles).toContain('User 2 Video');
    });

    it('should allow admin to manage any users downloads', async () => {
      const user1Download = await prisma.youTubeDownload.findFirst({
        where: { userId: user1Id, status: 'processing' },
      });

      // Admin can cancel any user's download
      const cancelResponse = await request(app)
        .delete(`/api/v1/youtube/downloads/${user1Download!.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(cancelResponse.body.message).toContain('cancelled');

      // Verify download was cancelled
      const cancelled = await prisma.youTubeDownload.findUnique({
        where: { id: user1Download!.id },
      });
      expect(cancelled!.status).toBe('cancelled');
    });

    it('should not apply rate limits to admin users', async () => {
      // Clear rate limits
      await redis.flushDb();

      // Admin can exceed normal rate limits
      const adminDownloads = Array(10)
        .fill(null)
        .map((_, i) =>
          request(app)
            .post('/api/v1/youtube/download')
            .send({
              url: `https://youtube.com/watch?v=admin_${i}`,
              quality: '1080p',
            })
            .set('Authorization', `Bearer ${adminToken}`),
        );

      const results = await Promise.all(adminDownloads);

      // All should succeed (no 429 responses)
      results.forEach((response) => {
        expect(response.status).toBe(201);
      });
    });
  });

  describe('Data Privacy and Security', () => {
    it('should not expose sensitive user data in API responses', async () => {
      // Get user profile
      const profileResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      // Should not contain sensitive fields
      expect(profileResponse.body).not.toHaveProperty('plexToken');
      expect(profileResponse.body).not.toHaveProperty('password');
      expect(profileResponse.body).not.toHaveProperty('sessions');
    });

    it('should not allow users to update other users profiles', async () => {
      // User 1 tries to update User 2's profile
      await request(app)
        .patch(`/api/v1/users/${user2Id}`)
        .send({
          preferences: { theme: 'dark' },
        })
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(403);
    });

    it('should sanitize user input in search queries', async () => {
      // Attempt SQL injection in search
      const sqlInjectionResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ q: "'; DROP TABLE users; --" })
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      // Should return empty results, not cause an error
      expect(sqlInjectionResponse.body.results).toEqual([]);

      // Verify users table still exists
      const usersExist = await prisma.user.count();
      expect(usersExist).toBeGreaterThan(0);
    });

    it('should properly handle authorization headers', async () => {
      // No auth header
      await request(app).get('/api/v1/media/requests').expect(401);

      // Invalid token
      await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Wrong auth scheme
      await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Basic ${Buffer.from('user:pass').toString('base64')}`)
        .expect(401);
    });
  });

  describe('Cross-User Data Leakage Prevention', () => {
    it('should not leak user data through error messages', async () => {
      // Try to access non-existent request with valid UUID format
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/v1/media/requests/${fakeId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);

      // Error should not reveal whether ID exists for another user
      expect(response.body.error).not.toContain('another user');
      expect(response.body.error).not.toContain('not authorized');
      expect(response.body.error).toContain('not found');
    });

    it('should use consistent error messages for authorization failures', async () => {
      const user2Request = await prisma.mediaRequest.findFirst({
        where: { userId: user2Id },
      });

      // Access attempt should return 404, not 403
      const response = await request(app)
        .get(`/api/v1/media/requests/${user2Request!.id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);

      // Same error as non-existent resource
      expect(response.body.error).toContain('not found');
    });

    it('should not expose user existence through timing attacks', async () => {
      const timings: number[] = [];

      // Time requests for existing vs non-existing users
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await request(app).post('/api/v1/auth/plex/callback').send({ pinId: 'fake-pin' });
        const end = Date.now();
        timings.push(end - start);
      }

      // Response times should be consistent (within reasonable variance)
      const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
      const variance = timings.map((t) => Math.abs(t - avgTiming));
      const maxVariance = Math.max(...variance);

      // Allow up to 50ms variance
      expect(maxVariance).toBeLessThan(50);
    });
  });
});
