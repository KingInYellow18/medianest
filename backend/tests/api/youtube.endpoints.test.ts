import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '@/app';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import { createClient } from 'redis';

const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });

// Mock BullMQ
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({
      id: 'mock-job-id-123',
      data: {},
      opts: {},
    }),
    getJob: vi.fn().mockResolvedValue({
      id: 'mock-job-id-123',
      data: {},
      progress: 0,
      attemptsMade: 0,
      finishedOn: null,
      failedReason: null,
      processedOn: Date.now(),
    }),
    getJobs: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
  })),
  Worker: vi.fn(),
  QueueEvents: vi.fn(),
}));

// Mock yt-dlp info extraction
vi.mock('@/integrations/youtube/youtube.service', () => ({
  YouTubeService: vi.fn().mockImplementation(() => ({
    getVideoInfo: vi.fn().mockResolvedValue({
      id: 'dQw4w9WgXcQ',
      title: 'Test Video Title',
      channel: 'Test Channel',
      duration: 212,
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      description: 'Test video description',
      uploadDate: '2009-10-25',
      viewCount: 1000000000,
    }),
    validateUrl: vi.fn().mockReturnValue(true),
  })),
}));

describe('API Endpoints: YouTube (/api/v1/youtube)', () => {
  let authToken: string;
  let userId: string;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    await redis.connect();

    // Clean test database
    await prisma.youTubeDownload.deleteMany();
    await prisma.user.deleteMany();

    // Clear Redis
    await redis.flushDb();

    // Create test users
    const user = await prisma.user.create({
      data: {
        plexId: 'youtube-test-user',
        username: 'youtubeuser',
        email: 'youtube@example.com',
        role: 'user',
        status: 'active',
      },
    });
    userId = user.id;
    authToken = global.createTestJWT({ userId: user.id, role: user.role });

    const admin = await prisma.user.create({
      data: {
        plexId: 'youtube-admin-user',
        username: 'youtubeadmin',
        email: 'youtubeadmin@example.com',
        role: 'admin',
        status: 'active',
      },
    });
    adminId = admin.id;
    adminToken = global.createTestJWT({ userId: admin.id, role: admin.role });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.disconnect();
  });

  beforeEach(async () => {
    // Clean up downloads between tests
    await prisma.youTubeDownload.deleteMany();
    // Clear rate limit counters
    await redis.flushDb();
    // Reset mocks
    server.resetHandlers();
  });

  describe('POST /api/v1/youtube/downloads', () => {
    it('should create a new download request', async () => {
      const response = await request(app)
        .post('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          quality: 'best',
          format: 'mp4',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        videoId: 'dQw4w9WgXcQ',
        title: 'Test Video Title',
        channel: 'Test Channel',
        duration: 212,
        status: 'pending',
        progress: 0,
        jobId: 'mock-job-id-123',
        quality: 'best',
        format: 'mp4',
        userId: userId,
        createdAt: expect.any(String),
      });

      // Verify database record
      const download = await prisma.youTubeDownload.findUnique({
        where: { id: response.body.id },
      });
      expect(download).toBeTruthy();
      expect(download!.userId).toBe(userId);
    });

    it('should validate YouTube URL format', async () => {
      const invalidUrls = [
        'not-a-url',
        'https://example.com/video',
        'https://vimeo.com/123456',
        'youtube.com/watch?v=invalid', // Missing protocol
        'https://youtu.be/', // Missing video ID
      ];

      for (const url of invalidUrls) {
        const response = await request(app)
          .post('/api/v1/youtube/downloads')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ url })
          .expect(400);

        expect(response.body.error).toContain('Invalid YouTube URL');
      }
    });

    it('should enforce rate limiting (5 per hour)', async () => {
      // Create 5 downloads (should succeed)
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .post('/api/v1/youtube/downloads')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              url: `https://www.youtube.com/watch?v=video${i}`,
              quality: 'best',
              format: 'mp4',
            }),
        );
      }

      const responses = await Promise.all(requests);
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // 6th request should be rate limited
      const rateLimitedResponse = await request(app)
        .post('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://www.youtube.com/watch?v=video6',
          quality: 'best',
          format: 'mp4',
        })
        .expect(429);

      expect(rateLimitedResponse.body).toMatchObject({
        error: expect.stringContaining('rate limit'),
        limit: 5,
        window: '1 hour',
        retryAfter: expect.any(Number),
      });
      expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
    });

    it('should prevent duplicate active downloads', async () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

      // Create first download
      await request(app)
        .post('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url })
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url })
        .expect(409);

      expect(response.body.error).toContain('already downloading');
    });

    it('should validate request body', async () => {
      const invalidRequests = [
        {
          body: {},
          expectedError: 'url is required',
        },
        {
          body: { url: 'https://youtube.com/watch?v=test', quality: 'invalid' },
          expectedError: 'Invalid quality',
        },
        {
          body: { url: 'https://youtube.com/watch?v=test', format: 'avi' },
          expectedError: 'Invalid format',
        },
        {
          body: {
            url: 'https://youtube.com/watch?v=test',
            extraField: 'not-allowed',
          },
          expectedError: 'Unknown field',
        },
      ];

      for (const { body, expectedError } of invalidRequests) {
        const response = await request(app)
          .post('/api/v1/youtube/downloads')
          .set('Authorization', `Bearer ${authToken}`)
          .send(body)
          .expect(400);

        expect(response.body.error).toContain(expectedError);
      }
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/youtube/downloads')
        .send({ url: 'https://youtube.com/watch?v=test' })
        .expect(401);
    });

    it('should handle YouTube service errors', async () => {
      // Mock service error
      const YouTubeService = require('@/integrations/youtube/youtube.service').YouTubeService;
      YouTubeService.mockImplementationOnce(() => ({
        validateUrl: vi.fn().mockReturnValue(true),
        getVideoInfo: vi.fn().mockRejectedValue(new Error('Video not found')),
      }));

      const response = await request(app)
        .post('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://youtube.com/watch?v=invalid' })
        .expect(404);

      expect(response.body.error).toContain('Video not found');
    });
  });

  describe('GET /api/v1/youtube/downloads', () => {
    beforeEach(async () => {
      // Create test downloads
      await prisma.youTubeDownload.createMany({
        data: [
          {
            videoId: 'video1',
            url: 'https://youtube.com/watch?v=video1',
            title: 'Test Video 1',
            channel: 'Channel 1',
            duration: 120,
            userId: userId,
            status: 'completed',
            progress: 100,
            quality: 'best',
            format: 'mp4',
            fileSize: 104857600, // 100MB
            filePath: '/downloads/video1.mp4',
          },
          {
            videoId: 'video2',
            url: 'https://youtube.com/watch?v=video2',
            title: 'Test Video 2',
            channel: 'Channel 2',
            duration: 300,
            userId: userId,
            status: 'downloading',
            progress: 45,
            quality: '1080p',
            format: 'mp4',
          },
          {
            videoId: 'video3',
            url: 'https://youtube.com/watch?v=video3',
            title: 'Admin Video',
            channel: 'Admin Channel',
            duration: 180,
            userId: adminId,
            status: 'pending',
            progress: 0,
            quality: '720p',
            format: 'mp4',
          },
        ],
      });
    });

    it('should list user downloads only', async () => {
      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        downloads: expect.arrayContaining([
          expect.objectContaining({
            videoId: 'video1',
            title: 'Test Video 1',
            status: 'completed',
            progress: 100,
          }),
          expect.objectContaining({
            videoId: 'video2',
            title: 'Test Video 2',
            status: 'downloading',
            progress: 45,
          }),
        ]),
        total: 2,
        page: 1,
        limit: 20,
      });

      // Should not include admin's download
      expect(response.body.downloads).not.toContainEqual(
        expect.objectContaining({ videoId: 'video3' }),
      );
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/v1/youtube/downloads?status=completed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.downloads).toHaveLength(1);
      expect(response.body.downloads[0]).toMatchObject({
        videoId: 'video1',
        status: 'completed',
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/youtube/downloads?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        downloads: expect.any(Array),
        total: 2,
        page: 1,
        limit: 1,
      });
      expect(response.body.downloads).toHaveLength(1);
    });

    it('should sort by creation date (newest first)', async () => {
      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const dates = response.body.downloads.map((d: any) => new Date(d.createdAt));
      expect(dates).toEqual([...dates].sort((a, b) => b.getTime() - a.getTime()));
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/youtube/downloads').expect(401);
    });
  });

  describe('GET /api/v1/youtube/downloads/:downloadId', () => {
    let downloadId: string;

    beforeEach(async () => {
      const download = await prisma.youTubeDownload.create({
        data: {
          videoId: 'specific-video',
          url: 'https://youtube.com/watch?v=specific',
          title: 'Specific Video',
          channel: 'Specific Channel',
          duration: 240,
          userId: userId,
          status: 'downloading',
          progress: 67,
          quality: '1080p',
          format: 'mp4',
          jobId: 'job-123',
        },
      });
      downloadId = download.id;
    });

    it('should return specific download details', async () => {
      const response = await request(app)
        .get(`/api/v1/youtube/downloads/${downloadId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: downloadId,
        videoId: 'specific-video',
        title: 'Specific Video',
        channel: 'Specific Channel',
        status: 'downloading',
        progress: 67,
        quality: '1080p',
        format: 'mp4',
        jobId: 'job-123',
      });
    });

    it('should validate ownership', async () => {
      // Try to access with different user
      await request(app)
        .get(`/api/v1/youtube/downloads/${downloadId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should handle non-existent downloads', async () => {
      const response = await request(app)
        .get('/api/v1/youtube/downloads/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toContain('Download not found');
    });

    it('should require authentication', async () => {
      await request(app).get(`/api/v1/youtube/downloads/${downloadId}`).expect(401);
    });

    it('should include error details for failed downloads', async () => {
      // Create failed download
      const failedDownload = await prisma.youTubeDownload.create({
        data: {
          videoId: 'failed-video',
          url: 'https://youtube.com/watch?v=failed',
          title: 'Failed Video',
          channel: 'Failed Channel',
          duration: 100,
          userId: userId,
          status: 'failed',
          progress: 23,
          quality: 'best',
          format: 'mp4',
          error: 'Network timeout during download',
        },
      });

      const response = await request(app)
        .get(`/api/v1/youtube/downloads/${failedDownload.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'failed',
        error: 'Network timeout during download',
        progress: 23,
      });
    });
  });

  describe('DELETE /api/v1/youtube/downloads/:downloadId', () => {
    it('should cancel pending download', async () => {
      const download = await prisma.youTubeDownload.create({
        data: {
          videoId: 'cancel-video',
          url: 'https://youtube.com/watch?v=cancel',
          title: 'Cancel Video',
          channel: 'Cancel Channel',
          duration: 150,
          userId: userId,
          status: 'pending',
          progress: 0,
          quality: 'best',
          format: 'mp4',
          jobId: 'cancel-job-123',
        },
      });

      const response = await request(app)
        .delete(`/api/v1/youtube/downloads/${download.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Download cancelled successfully',
      });

      // Verify status updated
      const cancelled = await prisma.youTubeDownload.findUnique({
        where: { id: download.id },
      });
      expect(cancelled?.status).toBe('cancelled');
    });

    it('should cancel downloading video', async () => {
      const download = await prisma.youTubeDownload.create({
        data: {
          videoId: 'downloading-video',
          url: 'https://youtube.com/watch?v=downloading',
          title: 'Downloading Video',
          channel: 'Channel',
          duration: 200,
          userId: userId,
          status: 'downloading',
          progress: 35,
          quality: 'best',
          format: 'mp4',
          jobId: 'downloading-job-123',
        },
      });

      await request(app)
        .delete(`/api/v1/youtube/downloads/${download.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const cancelled = await prisma.youTubeDownload.findUnique({
        where: { id: download.id },
      });
      expect(cancelled?.status).toBe('cancelled');
    });

    it('should not cancel completed downloads', async () => {
      const download = await prisma.youTubeDownload.create({
        data: {
          videoId: 'completed-video',
          url: 'https://youtube.com/watch?v=completed',
          title: 'Completed Video',
          channel: 'Channel',
          duration: 180,
          userId: userId,
          status: 'completed',
          progress: 100,
          quality: 'best',
          format: 'mp4',
          filePath: '/downloads/completed.mp4',
          fileSize: 52428800, // 50MB
        },
      });

      const response = await request(app)
        .delete(`/api/v1/youtube/downloads/${download.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toContain('Cannot cancel completed download');
    });

    it('should validate ownership', async () => {
      const download = await prisma.youTubeDownload.create({
        data: {
          videoId: 'other-user-video',
          url: 'https://youtube.com/watch?v=other',
          title: 'Other User Video',
          channel: 'Channel',
          duration: 120,
          userId: adminId, // Different user
          status: 'pending',
          progress: 0,
          quality: 'best',
          format: 'mp4',
        },
      });

      await request(app)
        .delete(`/api/v1/youtube/downloads/${download.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app).delete('/api/v1/youtube/downloads/some-id').expect(401);
    });

    it('should handle non-existent downloads', async () => {
      const response = await request(app)
        .delete('/api/v1/youtube/downloads/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toContain('Download not found');
    });
  });

  describe('GET /api/v1/youtube/downloads/stats', () => {
    beforeEach(async () => {
      // Create various downloads for stats
      await prisma.youTubeDownload.createMany({
        data: [
          {
            videoId: 'stat1',
            url: 'https://youtube.com/watch?v=stat1',
            title: 'Stat Video 1',
            channel: 'Channel',
            duration: 100,
            userId: userId,
            status: 'completed',
            progress: 100,
            quality: 'best',
            format: 'mp4',
            fileSize: 104857600, // 100MB
          },
          {
            videoId: 'stat2',
            url: 'https://youtube.com/watch?v=stat2',
            title: 'Stat Video 2',
            channel: 'Channel',
            duration: 200,
            userId: userId,
            status: 'completed',
            progress: 100,
            quality: '1080p',
            format: 'mp4',
            fileSize: 209715200, // 200MB
          },
          {
            videoId: 'stat3',
            url: 'https://youtube.com/watch?v=stat3',
            title: 'Stat Video 3',
            channel: 'Channel',
            duration: 150,
            userId: userId,
            status: 'failed',
            progress: 67,
            quality: '720p',
            format: 'mp4',
          },
        ],
      });
    });

    it('should return user download statistics', async () => {
      const response = await request(app)
        .get('/api/v1/youtube/downloads/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        total: 3,
        completed: 2,
        failed: 1,
        pending: 0,
        downloading: 0,
        cancelled: 0,
        totalSize: 314572800, // 300MB
        totalDuration: 450, // seconds
      });
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/youtube/downloads/stats').expect(401);
    });
  });

  describe('WebSocket Integration', () => {
    it('should emit download progress updates', async () => {
      // This would be tested in the WebSocket integration tests
      // Just documenting the expected behavior here
      // When download progress updates:
      // io.to(userId).emit('youtube:progress', {
      //   downloadId: download.id,
      //   progress: 75,
      //   status: 'downloading'
      // })
    });

    it('should emit download completion', async () => {
      // When download completes:
      // io.to(userId).emit('youtube:complete', {
      //   downloadId: download.id,
      //   filePath: '/downloads/video.mp4',
      //   fileSize: 104857600
      // })
    });

    it('should emit download failure', async () => {
      // When download fails:
      // io.to(userId).emit('youtube:failed', {
      //   downloadId: download.id,
      //   error: 'Network timeout'
      // })
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid json}')
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('Invalid JSON'),
      });
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const originalCreate = prisma.youTubeDownload.create;
      prisma.youTubeDownload.create = vi
        .fn()
        .mockRejectedValue(new Error('Database connection lost'));

      const response = await request(app)
        .post('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://youtube.com/watch?v=test' })
        .expect(503);

      expect(response.body).toMatchObject({
        error: 'Service temporarily unavailable',
        retryAfter: expect.any(Number),
      });

      // Restore original method
      prisma.youTubeDownload.create = originalCreate;
    });

    it('should handle queue errors gracefully', async () => {
      // Mock queue error
      const Queue = require('bullmq').Queue;
      Queue.mockImplementationOnce(() => ({
        add: vi.fn().mockRejectedValue(new Error('Queue connection failed')),
        close: vi.fn(),
      }));

      const response = await request(app)
        .post('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://youtube.com/watch?v=test' })
        .expect(503);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('temporarily unavailable'),
        retryAfter: expect.any(Number),
      });
    });
  });
});
