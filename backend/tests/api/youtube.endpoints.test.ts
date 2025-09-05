import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../helpers/database-cleanup';
import { createAuthToken } from '../helpers/auth';
import { testUsers, testYoutubeDownloads } from '../fixtures/test-data';

describe('YouTube Endpoints - Critical Path', () => {
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

  describe('POST /api/v1/youtube/validate', () => {
    it('should validate YouTube playlist URL', async () => {
      const validUrl = 'https://www.youtube.com/playlist?list=PLTest123';

      const response = await request(app)
        .post('/api/v1/youtube/validate')
        .send({ url: validUrl })
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

    it('should validate YouTube video URL', async () => {
      const validUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

      const response = await request(app)
        .post('/api/v1/youtube/validate')
        .send({ url: validUrl })
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

    it('should reject invalid YouTube URL', async () => {
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

    it('should require URL parameter', async () => {
      const response = await request(app)
        .post('/api/v1/youtube/validate')
        .send({})
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringContaining('URL is required'),
        },
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/youtube/validate')
        .send({ url: 'https://www.youtube.com/playlist?list=PLTest123' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/youtube/download', () => {
    it('should queue YouTube playlist download', async () => {
      const playlistUrl = 'https://www.youtube.com/playlist?list=PLTest123';

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: playlistUrl,
          quality: '1080p',
          format: 'mp4',
          downloadAudio: true,
          createCollection: true,
          collectionName: 'Test Playlist Collection',
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          playlistUrl,
          status: 'queued',
          userId: testUser.id,
          queuePosition: expect.any(Number),
        },
      });
    });

    it('should queue YouTube video download', async () => {
      const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: videoUrl,
          quality: '720p',
          format: 'mp4',
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('queued');
    });

    it('should enforce rate limiting', async () => {
      const playlistUrl = 'https://www.youtube.com/playlist?list=PLRateLimit';

      // Make multiple rapid requests to trigger rate limiting
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/v1/youtube/download')
            .send({ url: `${playlistUrl}${i}`, quality: '720p' })
            .set('Authorization', `Bearer ${userToken}`),
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.some((r) => r.status === 429);

      expect(rateLimited).toBe(true);
    });

    it('should validate URL before queuing', async () => {
      const invalidUrl = 'https://example.com/not-youtube';

      const response = await request(app)
        .post('/api/v1/youtube/download')
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

    it('should validate quality parameter', async () => {
      const validUrl = 'https://www.youtube.com/playlist?list=PLTest123';

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: validUrl,
          quality: 'invalid-quality',
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/youtube/downloads', () => {
    beforeAll(async () => {
      // Create test downloads
      await prisma.youTubeDownload.createMany({
        data: [
          {
            userId: testUser.id,
            playlistUrl: testYoutubeDownloads[0].playlistUrl,
            playlistTitle: testYoutubeDownloads[0].playlistTitle,
            status: testYoutubeDownloads[0].status,
            quality: '1080p',
            format: 'mp4',
            createdAt: new Date(),
          },
        ],
      });
    });

    it('should get user download history', async () => {
      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          downloads: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              playlistUrl: expect.any(String),
              status: expect.any(String),
              userId: testUser.id,
            }),
          ]),
          totalCount: expect.any(Number),
        },
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .query({ page: 1, pageSize: 5 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.downloads).toHaveProperty('length');
      expect(response.body.data.downloads.length).toBeLessThanOrEqual(5);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .query({ status: 'queued' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/youtube/downloads/:id', () => {
    it('should get download details', async () => {
      const download = await prisma.youTubeDownload.create({
        data: {
          userId: testUser.id,
          playlistUrl: 'https://www.youtube.com/playlist?list=PLDetail123',
          playlistTitle: 'Detail Test Playlist',
          status: 'downloading',
          quality: '1080p',
          format: 'mp4',
          progress: 50,
          createdAt: new Date(),
        },
      });

      const response = await request(app)
        .get(`/api/v1/youtube/downloads/${download.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: download.id,
          playlistUrl: download.playlistUrl,
          status: 'downloading',
          progress: 50,
        },
      });
    });

    it('should not allow access to other user downloads', async () => {
      const otherUser = await prisma.user.create({
        data: {
          plexId: 'other-yt-user-123',
          plexUsername: 'otheryoutubeuser',
          email: 'otheryt@example.com',
          role: 'user',
          status: 'active',
          plexToken: 'encrypted-yt-token',
        },
      });

      const otherDownload = await prisma.youTubeDownload.create({
        data: {
          userId: otherUser.id,
          playlistUrl: 'https://www.youtube.com/playlist?list=PLOther123',
          playlistTitle: 'Other User Playlist',
          status: 'completed',
          quality: '720p',
          format: 'mp4',
          createdAt: new Date(),
        },
      });

      const response = await request(app)
        .get(`/api/v1/youtube/downloads/${otherDownload.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Access denied',
        },
      });
    });
  });

  describe('DELETE /api/v1/youtube/downloads/:id', () => {
    it('should cancel queued download', async () => {
      const download = await prisma.youTubeDownload.create({
        data: {
          userId: testUser.id,
          playlistUrl: 'https://www.youtube.com/playlist?list=PLCancel123',
          playlistTitle: 'Cancel Test Playlist',
          status: 'queued',
          quality: '1080p',
          format: 'mp4',
          createdAt: new Date(),
        },
      });

      const response = await request(app)
        .delete(`/api/v1/youtube/downloads/${download.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Download cancelled successfully',
      });

      // Verify download is marked as cancelled
      const cancelledDownload = await prisma.youTubeDownload.findUnique({
        where: { id: download.id },
      });
      expect(cancelledDownload?.status).toBe('cancelled');
    });

    it('should not cancel completed downloads', async () => {
      const completedDownload = await prisma.youTubeDownload.create({
        data: {
          userId: testUser.id,
          playlistUrl: 'https://www.youtube.com/playlist?list=PLCompleted123',
          playlistTitle: 'Completed Playlist',
          status: 'completed',
          quality: '720p',
          format: 'mp4',
          createdAt: new Date(),
        },
      });

      const response = await request(app)
        .delete(`/api/v1/youtube/downloads/${completedDownload.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Cannot cancel completed download',
        },
      });
    });
  });

  describe('GET /api/v1/youtube/quota', () => {
    it('should return user quota information', async () => {
      const response = await request(app)
        .get('/api/v1/youtube/quota')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          dailyQuota: expect.any(Number),
          usedQuota: expect.any(Number),
          remainingQuota: expect.any(Number),
          resetTime: expect.any(String),
        },
      });
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/v1/youtube/quota').expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
