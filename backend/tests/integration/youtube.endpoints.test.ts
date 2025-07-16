import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { server, rest } from '../msw/setup';
import { generateToken } from '@/utils/jwt.util';
import prisma from '@/config/database';
import { redisClient } from '@/config/redis';
import { Queue } from 'bullmq';

// Mock BullMQ
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    getJobs: vi.fn(),
    getJobCounts: vi.fn(),
    remove: vi.fn(),
    clean: vi.fn(),
  })),
  Worker: vi.fn(),
}));

// Mock Redis and Prisma
vi.mock('@/config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    eval: vi.fn(),
  },
}));

vi.mock('@/config/database', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    userSession: {
      findFirst: vi.fn(),
    },
    youtubeDownload: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('YouTube Download Endpoints', () => {
  let authToken: string;
  let adminToken: string;
  let mockQueue: any;

  beforeEach(() => {
    vi.clearAllMocks();
    authToken = generateToken({ id: 'user-1', role: 'USER' });
    adminToken = generateToken({ id: 'admin-1', role: 'ADMIN' });

    // Setup mock queue
    mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-1' }),
      getJobs: vi.fn().mockResolvedValue([]),
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      }),
      remove: vi.fn().mockResolvedValue(true),
      clean: vi.fn().mockResolvedValue([]),
    };
    (Queue as any).mockImplementation(() => mockQueue);

    // Default auth setup
    (prisma.userSession.findFirst as any).mockImplementation(({ where }) => {
      if (where.token === authToken) {
        return Promise.resolve({
          id: 'session-1',
          userId: 'user-1',
          token: authToken,
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
          user: {
            id: 'user-1',
            email: 'test@example.com',
            username: 'testuser',
            displayName: 'Test User',
            role: 'USER',
            isActive: true,
          },
        });
      }
      if (where.token === adminToken) {
        return Promise.resolve({
          id: 'session-2',
          userId: 'admin-1',
          token: adminToken,
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            username: 'admin',
            displayName: 'Admin User',
            role: 'ADMIN',
            isActive: true,
          },
        });
      }
      return null;
    });

    // Mock rate limiter to allow by default
    (redisClient.eval as any).mockResolvedValue([1, 5, 4, 3600]);
  });

  describe('POST /api/v1/youtube/download', () => {
    it('should create a download for a single video', async () => {
      (prisma.youtubeDownload.count as any).mockResolvedValue(0);
      (prisma.youtubeDownload.create as any).mockResolvedValue({
        id: 'download-1',
        userId: 'user-1',
        url: 'https://www.youtube.com/watch?v=test-video-id',
        title: 'Test Video Title',
        status: 'PENDING',
        format: 'mp4',
        quality: 'best',
        jobId: 'job-1',
        metadata: {
          duration: 330,
          uploader: 'Test Channel',
          thumbnail: 'https://i.ytimg.com/vi/test-video-id/maxresdefault.jpg',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://www.youtube.com/watch?v=test-video-id',
          format: 'mp4',
          quality: 'best',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'download-1',
          url: 'https://www.youtube.com/watch?v=test-video-id',
          title: 'Test Video Title',
          status: 'PENDING',
          format: 'mp4',
          quality: 'best',
        },
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'download',
        expect.objectContaining({
          downloadId: 'download-1',
          url: 'https://www.youtube.com/watch?v=test-video-id',
          format: 'mp4',
          quality: 'best',
        }),
        expect.objectContaining({
          removeOnComplete: true,
          removeOnFail: false,
        }),
      );
    });

    it('should create downloads for a playlist', async () => {
      (prisma.youtubeDownload.count as any).mockResolvedValue(0);

      // Mock creating multiple downloads
      let downloadCount = 0;
      (prisma.youtubeDownload.create as any).mockImplementation(() => {
        downloadCount++;
        return Promise.resolve({
          id: `download-${downloadCount}`,
          userId: 'user-1',
          url: `https://www.youtube.com/watch?v=playlist-video-${downloadCount - 1}`,
          title: `Playlist Video ${downloadCount}`,
          status: 'PENDING',
          format: 'mp3',
          quality: 'best',
          jobId: `job-${downloadCount}`,
          playlistId: 'test-playlist-id',
          playlistTitle: 'Test Playlist',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://www.youtube.com/playlist?list=test-playlist-id',
          format: 'mp3',
          quality: 'best',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          playlist: {
            id: 'test-playlist-id',
            title: 'Test Playlist',
            itemCount: 10,
          },
          downloads: expect.arrayContaining([
            expect.objectContaining({
              id: expect.stringMatching(/^download-\d+$/),
              status: 'PENDING',
              format: 'mp3',
            }),
          ]),
        },
      });

      // Should create multiple queue jobs
      expect(mockQueue.add).toHaveBeenCalledTimes(10);
    });

    it('should enforce rate limits', async () => {
      // Mock rate limiter to return limit exceeded
      (redisClient.eval as any).mockResolvedValue([0, 5, 5, 3599]);

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://www.youtube.com/watch?v=test-video-id',
          format: 'mp4',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(429);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Download limit exceeded. Maximum 5 downloads per hour.',
        },
      });
    });

    it('should validate URL format', async () => {
      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'not-a-youtube-url',
          format: 'mp4',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('Invalid YouTube URL'),
        },
      });
    });

    it('should validate format options', async () => {
      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://www.youtube.com/watch?v=test-video-id',
          format: 'invalid-format',
          quality: 'super-hd',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle YouTube API errors', async () => {
      server.use(
        rest.get('https://www.googleapis.com/youtube/v3/videos', (req, res, ctx) => {
          return res(
            ctx.status(403),
            ctx.json({
              error: {
                code: 403,
                message: 'API key quota exceeded',
              },
            }),
          );
        }),
      );

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://www.youtube.com/watch?v=test-video-id',
          format: 'mp4',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(503);

      expect(response.body.error.message).toContain('YouTube service error');
    });

    it('should handle audio-only download requests', async () => {
      (prisma.youtubeDownload.count as any).mockResolvedValue(0);
      (prisma.youtubeDownload.create as any).mockResolvedValue({
        id: 'download-1',
        userId: 'user-1',
        url: 'https://www.youtube.com/watch?v=test-video-id',
        title: 'Test Video Title',
        status: 'PENDING',
        format: 'mp3',
        quality: '192',
        audioOnly: true,
        jobId: 'job-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://www.youtube.com/watch?v=test-video-id',
          format: 'mp3',
          quality: '192',
          audioOnly: true,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.data.audioOnly).toBe(true);
      expect(response.body.data.format).toBe('mp3');
    });
  });

  describe('GET /api/v1/youtube/downloads', () => {
    it('should return user downloads with pagination', async () => {
      (prisma.youtubeDownload.findMany as any).mockResolvedValue([
        {
          id: 'download-1',
          userId: 'user-1',
          url: 'https://www.youtube.com/watch?v=video1',
          title: 'Video 1',
          status: 'COMPLETED',
          format: 'mp4',
          quality: '1080p',
          fileSize: 104857600,
          filePath: '/downloads/video1.mp4',
          progress: 100,
          createdAt: new Date('2023-01-01'),
          completedAt: new Date('2023-01-01T00:05:00'),
        },
        {
          id: 'download-2',
          userId: 'user-1',
          url: 'https://www.youtube.com/watch?v=video2',
          title: 'Video 2',
          status: 'DOWNLOADING',
          format: 'mp4',
          quality: '720p',
          progress: 45,
          createdAt: new Date('2023-01-02'),
        },
      ]);
      (prisma.youtubeDownload.count as any).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          downloads: expect.arrayContaining([
            expect.objectContaining({
              id: 'download-1',
              status: 'COMPLETED',
              progress: 100,
            }),
            expect.objectContaining({
              id: 'download-2',
              status: 'DOWNLOADING',
              progress: 45,
            }),
          ]),
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
          },
        },
      });
    });

    it('should filter by status', async () => {
      (prisma.youtubeDownload.findMany as any).mockResolvedValue([
        {
          id: 'download-1',
          userId: 'user-1',
          status: 'FAILED',
          error: 'Video not available',
        },
      ]);
      (prisma.youtubeDownload.count as any).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .query({ status: 'FAILED' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.downloads).toHaveLength(1);
      expect(response.body.data.downloads[0].status).toBe('FAILED');

      expect(prisma.youtubeDownload.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            status: 'FAILED',
          },
        }),
      );
    });

    it('should filter by playlist', async () => {
      (prisma.youtubeDownload.findMany as any).mockResolvedValue([
        {
          id: 'download-1',
          userId: 'user-1',
          playlistId: 'playlist-123',
          playlistTitle: 'My Playlist',
          title: 'Video from playlist',
          status: 'COMPLETED',
        },
      ]);
      (prisma.youtubeDownload.count as any).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .query({ playlistId: 'playlist-123' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.downloads[0].playlistId).toBe('playlist-123');
    });

    it('should allow admins to see all downloads', async () => {
      (prisma.youtubeDownload.findMany as any).mockResolvedValue([
        {
          id: 'download-1',
          userId: 'user-1',
          title: 'User 1 Video',
          user: {
            username: 'user1',
            email: 'user1@example.com',
          },
        },
        {
          id: 'download-2',
          userId: 'user-2',
          title: 'User 2 Video',
          user: {
            username: 'user2',
            email: 'user2@example.com',
          },
        },
      ]);
      (prisma.youtubeDownload.count as any).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .query({ all: true })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.downloads).toHaveLength(2);
      expect(prisma.youtubeDownload.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {}, // No user filter
          include: { user: true },
        }),
      );
    });
  });

  describe('GET /api/v1/youtube/downloads/:id', () => {
    it('should return download details', async () => {
      (prisma.youtubeDownload.findUnique as any).mockResolvedValue({
        id: 'download-1',
        userId: 'user-1',
        url: 'https://www.youtube.com/watch?v=test-video-id',
        title: 'Test Video',
        status: 'COMPLETED',
        format: 'mp4',
        quality: '1080p',
        fileSize: 104857600,
        filePath: '/downloads/test-video.mp4',
        progress: 100,
        metadata: {
          duration: 330,
          uploader: 'Test Channel',
          description: 'Test description',
        },
        createdAt: new Date(),
        completedAt: new Date(),
      });

      const response = await request(app)
        .get('/api/v1/youtube/downloads/download-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'download-1',
          title: 'Test Video',
          status: 'COMPLETED',
          fileSize: 104857600,
          metadata: expect.objectContaining({
            duration: 330,
            uploader: 'Test Channel',
          }),
        },
      });
    });

    it('should prevent access to other users downloads', async () => {
      (prisma.youtubeDownload.findUnique as any).mockResolvedValue({
        id: 'download-1',
        userId: 'other-user',
        title: 'Other User Video',
      });

      const response = await request(app)
        .get('/api/v1/youtube/downloads/download-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow admins to access any download', async () => {
      (prisma.youtubeDownload.findUnique as any).mockResolvedValue({
        id: 'download-1',
        userId: 'other-user',
        title: 'Other User Video',
        user: {
          username: 'otheruser',
          email: 'other@example.com',
        },
      });

      const response = await request(app)
        .get('/api/v1/youtube/downloads/download-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.id).toBe('download-1');
    });
  });

  describe('DELETE /api/v1/youtube/downloads/:id', () => {
    it('should allow cancelling pending downloads', async () => {
      (prisma.youtubeDownload.findUnique as any).mockResolvedValue({
        id: 'download-1',
        userId: 'user-1',
        status: 'PENDING',
        jobId: 'job-1',
      });
      (prisma.youtubeDownload.update as any).mockResolvedValue({
        id: 'download-1',
        status: 'CANCELLED',
      });

      const response = await request(app)
        .delete('/api/v1/youtube/downloads/download-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Download cancelled successfully',
        },
      });

      expect(mockQueue.remove).toHaveBeenCalledWith('job-1');
      expect(prisma.youtubeDownload.update).toHaveBeenCalledWith({
        where: { id: 'download-1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('should allow cancelling downloading status', async () => {
      (prisma.youtubeDownload.findUnique as any).mockResolvedValue({
        id: 'download-1',
        userId: 'user-1',
        status: 'DOWNLOADING',
        jobId: 'job-1',
      });
      (prisma.youtubeDownload.update as any).mockResolvedValue({
        id: 'download-1',
        status: 'CANCELLED',
      });

      const response = await request(app)
        .delete('/api/v1/youtube/downloads/download-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mockQueue.remove).toHaveBeenCalledWith('job-1');
    });

    it('should prevent cancelling completed downloads', async () => {
      (prisma.youtubeDownload.findUnique as any).mockResolvedValue({
        id: 'download-1',
        userId: 'user-1',
        status: 'COMPLETED',
      });

      const response = await request(app)
        .delete('/api/v1/youtube/downloads/download-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Cannot cancel download in current status',
        },
      });
    });
  });

  describe('POST /api/v1/youtube/downloads/:id/retry', () => {
    it('should allow retrying failed downloads', async () => {
      (prisma.youtubeDownload.findUnique as any).mockResolvedValue({
        id: 'download-1',
        userId: 'user-1',
        url: 'https://www.youtube.com/watch?v=test-video-id',
        status: 'FAILED',
        format: 'mp4',
        quality: 'best',
      });
      (prisma.youtubeDownload.update as any).mockResolvedValue({
        id: 'download-1',
        status: 'PENDING',
        jobId: 'job-2',
        error: null,
        progress: 0,
      });

      const response = await request(app)
        .post('/api/v1/youtube/downloads/download-1/retry')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'download-1',
          status: 'PENDING',
          error: null,
        },
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'download',
        expect.objectContaining({
          downloadId: 'download-1',
          url: 'https://www.youtube.com/watch?v=test-video-id',
        }),
      );
    });

    it('should only allow retrying failed downloads', async () => {
      (prisma.youtubeDownload.findUnique as any).mockResolvedValue({
        id: 'download-1',
        userId: 'user-1',
        status: 'COMPLETED',
      });

      const response = await request(app)
        .post('/api/v1/youtube/downloads/download-1/retry')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(response.body.error.message).toContain('Can only retry failed downloads');
    });
  });

  describe('GET /api/v1/youtube/downloads/stats', () => {
    it('should return download statistics for user', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 2,
        active: 1,
        completed: 10,
        failed: 1,
      });

      const response = await request(app)
        .get('/api/v1/youtube/downloads/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          queue: {
            waiting: 2,
            active: 1,
            completed: 10,
            failed: 1,
          },
          userStats: {
            total: expect.any(Number),
            byStatus: expect.any(Object),
            byFormat: expect.any(Object),
          },
        },
      });
    });
  });
});
