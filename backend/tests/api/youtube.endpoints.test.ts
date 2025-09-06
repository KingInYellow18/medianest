import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// CRITICAL: Mock Redis and Bull BEFORE any imports
vi.mock('ioredis', () => {
  const mockRedisClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn(),
    eval: vi.fn().mockResolvedValue(0),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-1),
  };

  return {
    __esModule: true,
    default: vi.fn(() => mockRedisClient),
  };
});

vi.mock('bull', () => ({
  default: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({ id: 'mock-job-123' }),
    process: vi.fn(),
    on: vi.fn(),
    getJob: vi.fn().mockResolvedValue({
      id: 'mock-job-123',
      progress: 50,
      getState: vi.fn().mockResolvedValue('active'),
      remove: vi.fn().mockResolvedValue(true),
    }),
  })),
}));

import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../helpers/database-cleanup';
import { createAuthToken } from '../helpers/auth';
import { testUsers, testYoutubeDownloads } from '../fixtures/test-data';

// Mock Redis and all Redis-related modules early
vi.mock('@/config/redis', () => ({
  initializeRedis: vi.fn().mockResolvedValue({
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-1),
    eval: vi.fn().mockResolvedValue(0),
  }),
  getRedis: vi.fn().mockReturnValue({
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-1),
    eval: vi.fn().mockResolvedValue(0),
  }),
  closeRedis: vi.fn().mockResolvedValue(undefined),
  checkRedisHealth: vi.fn().mockResolvedValue(true),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

// Mock middleware that might use Redis
vi.mock('@/middleware/rate-limiter', () => ({
  rateLimiter: vi.fn(() => (req: any, res: any, next: any) => next()),
}));

vi.mock('@/middleware/rate-limit', () => ({
  rateLimit: vi.fn(() => (req: any, res: any, next: any) => next()),
}));

// Mock external services that YouTube controller depends on
vi.mock('@/services/youtube.service', () => ({
  YouTubeService: vi.fn(() => ({
    getUserDownloadsInLastHour: vi.fn().mockResolvedValue(0),
    checkDuplicateDownload: vi.fn().mockResolvedValue(false),
    getVideoMetadata: vi.fn().mockResolvedValue({
      id: 'dQw4w9WgXcQ',
      title: 'Test Video Title',
      channel: 'Test Channel',
      duration: 212,
      thumbnail: 'https://example.com/thumb.jpg',
      description: 'Test description',
      uploadDate: '2021-01-01',
      viewCount: 1000000,
      formats: [{ quality: '720p' }, { quality: '1080p' }],
    }),
    validateYouTubeUrl: vi.fn().mockImplementation((url: string) => {
      if (url.includes('youtube.com/watch') || url.includes('youtube.com/playlist')) {
        return {
          isValid: true,
          type: url.includes('playlist') ? 'playlist' : 'video',
          id: url.includes('playlist') ? 'PLTest123' : 'dQw4w9WgXcQ',
        };
      }
      return { isValid: false, type: null, id: null };
    }),
  })),
}));

vi.mock('@/config/queues', () => ({
  youtubeQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job-123' }),
    getJob: vi.fn().mockResolvedValue({
      id: 'mock-job-123',
      progress: 50,
      attemptsMade: 1,
      processedOn: Date.now(),
      finishedOn: null,
      failedReason: null,
      getState: vi.fn().mockResolvedValue('active'),
    }),
  },
}));

vi.mock('@/socket/server', () => ({
  getSocketServer: vi.fn(() => ({
    to: vi.fn(() => ({
      emit: vi.fn(),
    })),
  })),
}));

vi.mock('@/repositories/youtube-download.repository', () => ({
  YoutubeDownloadRepository: vi.fn(() => ({
    create: vi.fn().mockImplementation((data) => ({
      id: 'mock-download-123',
      ...data,
      createdAt: new Date(),
      completedAt: null,
      status: 'queued',
    })),
    update: vi.fn().mockResolvedValue(true),
    findById: vi.fn().mockImplementation((id) => ({
      id,
      userId: 'test-user-id',
      playlistUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      playlistTitle: 'Test Video',
      status: 'downloading',
      progress: 50,
      filePaths: { jobId: 'mock-job-123' },
      createdAt: new Date(),
      completedAt: null,
    })),
    findByFilters: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'mock-download-123',
          userId: 'test-user-id',
          playlistUrl: 'https://www.youtube.com/playlist?list=PLTest123',
          playlistTitle: 'Test Playlist',
          status: 'queued',
          filePaths: { jobId: 'mock-job-123' },
          createdAt: new Date(),
          completedAt: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    }),
    updateStatus: vi.fn().mockResolvedValue(true),
  })),
}));

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

  describe('GET /api/v1/youtube/metadata', () => {
    it('should get video metadata', async () => {
      const validUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

      const response = await request(app)
        .get('/api/v1/youtube/metadata')
        .query({ url: validUrl })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'dQw4w9WgXcQ',
        title: 'Test Video Title',
        channel: 'Test Channel',
        duration: expect.any(Number),
        thumbnail: expect.any(String),
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/youtube/metadata')
        .query({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
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
        })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: 'Test Video Title',
        status: 'queued',
        progress: 0,
        userId: testUser.id,
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

      expect(response.body.id).toBeDefined();
      expect(response.body.status).toBe('queued');
    });

    it('should validate URL parameter', async () => {
      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({})
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({ url: 'https://www.youtube.com/playlist?list=PLTest123' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
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
        downloads: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            url: expect.any(String),
            status: expect.any(String),
          }),
        ]),
        total: expect.any(Number),
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .query({ page: 1, limit: 5 })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.downloads).toHaveProperty('length');
      expect(response.body.downloads.length).toBeLessThanOrEqual(5);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .query({ status: 'queued' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('downloads');
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
        id: download.id,
        url: download.playlistUrl,
        status: 'downloading',
        progress: expect.any(Number),
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
        .expect(404);

      expect(response.body).toHaveProperty('error');
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

      expect(response.body).toHaveProperty('error');
    });
  });
});
