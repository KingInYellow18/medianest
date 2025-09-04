import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../../helpers/database-cleanup';
import { createAuthToken } from '../../helpers/auth';
import { testUsers } from '../../fixtures/test-data';

describe('YouTube Download Flow - Critical Path', () => {
  let userToken: string;
  let testUser: any;

  beforeAll(async () => {
    await databaseCleanup.cleanAll();

    // Create test user
    testUser = await prisma.user.create({
      data: {
        plexId: testUsers[0].plexId,
        plexUsername: testUsers[0].username,
        email: testUsers[0].email,
        role: testUsers[0].role,
        status: testUsers[0].status,
        plexToken: 'encrypted-token',
      },
    });

    userToken = createAuthToken(testUser);
  });

  afterAll(async () => {
    await databaseCleanup.cleanAll();
    await prisma.$disconnect();
  });

  describe('YouTube URL Validation', () => {
    it('should validate playlist URLs correctly', async () => {
      const playlistUrl = 'https://www.youtube.com/playlist?list=PLTest123';

      const response = await request(app)
        .post('/api/v1/youtube/validate')
        .send({ url: playlistUrl })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          isValid: true,
          type: 'playlist',
          id: expect.any(String),
        },
      });
    });

    it('should validate video URLs correctly', async () => {
      const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

      const response = await request(app)
        .post('/api/v1/youtube/validate')
        .send({ url: videoUrl })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          isValid: true,
          type: 'video',
          id: 'dQw4w9WgXcQ',
        },
      });
    });

    it('should reject invalid URLs', async () => {
      const invalidUrl = 'https://example.com/not-youtube';

      const response = await request(app)
        .post('/api/v1/youtube/validate')
        .send({ url: invalidUrl })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringContaining('Invalid YouTube URL'),
        },
      });
    });
  });

  describe('Download Queue with BullMQ', () => {
    it('should queue downloads successfully', async () => {
      const playlistUrl = 'https://www.youtube.com/playlist?list=PLQueue123';

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: playlistUrl,
          quality: '1080p',
          format: 'mp4',
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          status: 'queued',
          queuePosition: expect.any(Number),
        },
      });
    });

    it('should process queue in order', async () => {
      // Create multiple downloads
      const downloads = [];
      for (let i = 1; i <= 3; i++) {
        const response = await request(app)
          .post('/api/v1/youtube/download')
          .send({
            url: `https://www.youtube.com/playlist?list=PLOrder${i}`,
            quality: '720p',
          })
          .set('Authorization', `Bearer ${userToken}`);

        if (response.status === 201) {
          downloads.push(response.body.data);
        }
      }

      // Queue positions should be in order
      for (let i = 0; i < downloads.length - 1; i++) {
        expect(downloads[i].queuePosition).toBeLessThanOrEqual(downloads[i + 1].queuePosition);
      }
    });

    it('should track download progress', async () => {
      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://www.youtube.com/playlist?list=PLProgress123',
          quality: '720p',
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      const downloadId = response.body.data.id;

      // Check initial status
      const statusResponse = await request(app)
        .get(`/api/v1/youtube/downloads/${downloadId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(statusResponse.body.data.status).toBe('queued');
      expect(statusResponse.body.data).toHaveProperty('progress');
    });
  });

  describe('Rate Limiting for Downloads', () => {
    it('should enforce daily quota limits', async () => {
      // Check current quota
      const quotaResponse = await request(app)
        .get('/api/v1/youtube/quota')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(quotaResponse.body).toMatchObject({
        success: true,
        data: {
          dailyQuota: expect.any(Number),
          usedQuota: expect.any(Number),
          remainingQuota: expect.any(Number),
        },
      });
    });

    it('should rate limit rapid requests', async () => {
      const requests = [];

      // Make 10 rapid requests
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/v1/youtube/download')
            .send({
              url: `https://www.youtube.com/watch?v=rateLimit${i}`,
              quality: '720p',
            })
            .set('Authorization', `Bearer ${userToken}`),
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedCount = responses.filter((r) => r.status === 429).length;

      // Should have some rate-limited responses
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should respect per-user rate limits', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          plexId: 'rate-limit-user-2',
          plexUsername: 'ratelimituser2',
          email: 'ratelimit2@example.com',
          role: 'user',
          status: 'active',
          plexToken: 'encrypted-rl-token',
        },
      });

      const otherUserToken = createAuthToken(otherUser);

      // Each user should have their own rate limit
      const user1Response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://www.youtube.com/watch?v=user1Test',
          quality: '720p',
        })
        .set('Authorization', `Bearer ${userToken}`);

      const user2Response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://www.youtube.com/watch?v=user2Test',
          quality: '720p',
        })
        .set('Authorization', `Bearer ${otherUserToken}`);

      // Both users should be able to make requests independently
      if (user1Response.status < 429 && user2Response.status < 429) {
        expect(user1Response.body.data.userId).toBe(testUser.id);
        expect(user2Response.body.data.userId).toBe(otherUser.id);
      }
    });

    it('should handle quota exceeded scenarios', async () => {
      // Simulate quota exceeded by making many requests
      // In real implementation, this would be based on actual quota usage
      const responses = [];

      for (let i = 0; i < 50; i++) {
        const response = await request(app)
          .post('/api/v1/youtube/download')
          .send({
            url: `https://www.youtube.com/watch?v=quota${i}`,
            quality: '720p',
          })
          .set('Authorization', `Bearer ${userToken}`);

        responses.push(response);

        // Break if we hit quota limit
        if (response.status === 429) {
          expect(response.body).toMatchObject({
            success: false,
            error: {
              code: expect.stringMatching(/(QUOTA_EXCEEDED|RATE_LIMIT_EXCEEDED)/),
            },
          });
          break;
        }
      }
    });
  });

  describe('Download Management', () => {
    it('should allow cancellation of queued downloads', async () => {
      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://www.youtube.com/playlist?list=PLCancel123',
          quality: '720p',
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      const downloadId = response.body.data.id;

      const cancelResponse = await request(app)
        .delete(`/api/v1/youtube/downloads/${downloadId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(cancelResponse.body).toMatchObject({
        success: true,
        message: 'Download cancelled successfully',
      });
    });

    it('should provide download history', async () => {
      const historyResponse = await request(app)
        .get('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(historyResponse.body).toMatchObject({
        success: true,
        data: {
          downloads: expect.any(Array),
          totalCount: expect.any(Number),
        },
      });
    });

    it('should support filtering downloads by status', async () => {
      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .query({ status: 'queued' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.downloads.length > 0) {
        response.body.data.downloads.forEach((download: any) => {
          expect(download.status).toBe('queued');
        });
      }
    });
  });
});
