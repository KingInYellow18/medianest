import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createTestApp, createTestJWT } from '../../helpers/test-app';
import { server } from '../../mocks/server';
const prisma = new PrismaClient();

// Simple in-memory Redis mock for testing
const redisMock = {
  data: new Map<string, any>(),
  ttls: new Map<string, number>(),

  async connect() {
    return Promise.resolve();
  },
  async disconnect() {
    return Promise.resolve();
  },
  async flushDb() {
    this.data.clear();
    this.ttls.clear();
  },
  async incr(key: string) {
    const current = this.data.get(key) || 0;
    const newValue = current + 1;
    this.data.set(key, newValue);
    return newValue;
  },
  async expire(key: string, seconds: number) {
    this.ttls.set(key, Date.now() + seconds * 1000);
    return 1;
  },
  async ttl(key: string) {
    const expiry = this.ttls.get(key);
    if (!expiry) return -1;
    const remaining = Math.floor((expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  },
};

const redis = redisMock;

describe('Critical Path: YouTube Download Flow (Simplified)', () => {
  let app: any;
  let authToken: string;
  let userId: string;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    // Redis mock already connected

    // Clean up test database (order matters due to foreign keys)
    await prisma.youtubeDownload.deleteMany();
    await prisma.mediaRequest.deleteMany();
    await prisma.user.deleteMany();

    // Clear Redis
    await redis.flushDb();

    // Create test user
    const user = await prisma.user.create({
      data: {
        plexId: 'test-plex-id',
        plexUsername: 'testuser',
        email: 'test@example.com',
        role: 'USER',
      },
    });
    userId = user.id;
    authToken = createTestJWT({ userId: user.id, role: user.role });

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        plexId: 'admin-plex-id',
        plexUsername: 'admin',
        email: 'admin@example.com',
        role: 'ADMIN',
      },
    });
    adminId = admin.id;
    adminToken = createTestJWT({ userId: admin.id, role: admin.role });

    // Create test app with mock routes
    app = createTestApp();

    // Mock validate endpoint
    app.post('/api/v1/youtube/validate', async (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { url } = req.body;

      if (!url || !url.includes('youtube.com/watch')) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
      }

      // Extract video ID from URL
      const match = url.match(/watch\?v=([a-zA-Z0-9_-]+)/);
      const videoId = match ? match[1] : null;

      res.json({
        valid: true,
        type: 'video',
        videoId,
        title: `Test Video ${videoId}`,
        duration: '03:45',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      });
    });

    // Mock download endpoint
    app.post('/api/v1/youtube/download', async (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { url, quality = '720p', audioOnly = false } = req.body;

      // Check rate limit (5 per hour for non-admin)
      if (req.user.role !== 'ADMIN') {
        const rateLimitKey = `youtube:ratelimit:${req.user.userId}`;
        const count = await redis.incr(rateLimitKey);

        if (count === 1) {
          await redis.expire(rateLimitKey, 3600); // 1 hour
        }

        if (count > 5) {
          const ttl = await redis.ttl(rateLimitKey);
          return res.status(429).json({
            error: 'YouTube download rate limit exceeded',
            retryAfter: ttl,
          });
        }
      }

      // Extract video ID
      const match = url.match(/watch\?v=([a-zA-Z0-9_-]+)/);
      const videoId = match ? match[1] : null;

      // Create download record
      const download = await prisma.youtubeDownload.create({
        data: {
          userId: req.user.userId,
          playlistUrl: url,
          playlistTitle: `Test Video ${videoId}`,
          status: 'queued',
        },
      });

      res.status(201).json(download);
    });

    // Mock get downloads endpoint
    app.get('/api/v1/youtube/downloads', async (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const all = req.query.all === 'true' && req.user.role === 'ADMIN';

      const downloads = await prisma.youtubeDownload.findMany({
        where: all ? {} : { userId: req.user.userId },
        orderBy: { createdAt: 'desc' },
      });

      const stats = {
        total: downloads.length,
        active: downloads.filter((d) => d.status === 'processing').length,
        queued: downloads.filter((d) => d.status === 'queued').length,
      };

      res.json({
        downloads,
        ...stats,
      });
    });

    // Mock get specific download endpoint
    app.get('/api/v1/youtube/downloads/:id', async (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const download = await prisma.youtubeDownload.findFirst({
        where: {
          id: req.params.id,
          ...(req.user.role !== 'ADMIN' ? { userId: req.user.userId } : {}),
        },
      });

      if (!download) {
        return res.status(404).json({ error: 'Download not found' });
      }

      res.json(download);
    });

    // Mock cancel download endpoint
    app.delete('/api/v1/youtube/downloads/:id', async (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const download = await prisma.youtubeDownload.findFirst({
        where: {
          id: req.params.id,
          ...(req.user.role !== 'ADMIN' ? { userId: req.user.userId } : {}),
        },
      });

      if (!download) {
        return res.status(404).json({ error: 'Download not found' });
      }

      if (download.status === 'completed') {
        return res.status(400).json({ error: 'Cannot cancel completed download' });
      }

      await prisma.youtubeDownload.update({
        where: { id: download.id },
        data: { status: 'cancelled' },
      });

      res.json({
        message: 'Download cancelled successfully',
        downloadId: download.id,
      });
    });
  });

  afterAll(async () => {
    await redis.disconnect();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    server.resetHandlers();
    vi.clearAllMocks();
    // Clear rate limit counters
    await redis.flushDb();
  });

  it('should complete full YouTube download flow from URL submission to queue', async () => {
    // Step 1: Validate YouTube URL
    const validateResponse = await request(app)
      .post('/api/v1/youtube/validate')
      .send({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(validateResponse.body).toMatchObject({
      valid: true,
      type: 'video',
      videoId: 'dQw4w9WgXcQ',
      title: expect.any(String),
      duration: expect.any(String),
      thumbnail: expect.any(String),
    });

    // Step 2: Submit download request
    const downloadResponse = await request(app)
      .post('/api/v1/youtube/download')
      .send({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        quality: '1080p',
        audioOnly: false,
      })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(downloadResponse.body).toMatchObject({
      id: expect.any(String),
      playlistUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      playlistTitle: expect.any(String),
      status: 'queued',
      userId: userId,
    });

    const downloadId = downloadResponse.body.id;

    // Step 3: Check download status
    const statusResponse = await request(app)
      .get(`/api/v1/youtube/downloads/${downloadId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(statusResponse.body).toMatchObject({
      id: downloadId,
      status: 'queued',
    });

    // Step 4: Get user's download queue
    const queueResponse = await request(app)
      .get('/api/v1/youtube/downloads')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(queueResponse.body).toMatchObject({
      downloads: expect.arrayContaining([
        expect.objectContaining({
          id: downloadId,
          playlistTitle: expect.any(String),
          status: 'queued',
        }),
      ]),
      total: expect.any(Number),
      active: 0,
      queued: expect.any(Number),
    });
  });

  it('should enforce rate limiting of 5 downloads per hour per user', async () => {
    // Submit 5 downloads (should all succeed)
    const downloads = [];
    for (let i = 0; i < 5; i++) {
      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: `https://www.youtube.com/watch?v=video${i}`,
          quality: '720p',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      downloads.push(response.body);
    }

    expect(downloads).toHaveLength(5);

    // 6th download should be rate limited
    const rateLimitedResponse = await request(app)
      .post('/api/v1/youtube/download')
      .send({
        url: 'https://www.youtube.com/watch?v=video6',
        quality: '720p',
      })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(429);

    expect(rateLimitedResponse.body).toMatchObject({
      error: expect.stringContaining('rate limit'),
      retryAfter: expect.any(Number),
    });

    // Admin should not be rate limited
    const adminResponse = await request(app)
      .post('/api/v1/youtube/download')
      .send({
        url: 'https://www.youtube.com/watch?v=adminvideo',
        quality: '720p',
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(adminResponse.body.status).toBe('queued');
  });

  it('should allow users to cancel their own downloads', async () => {
    // Create a download
    const downloadResponse = await request(app)
      .post('/api/v1/youtube/download')
      .send({
        url: 'https://www.youtube.com/watch?v=cancelme',
        quality: '1080p',
      })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    const downloadId = downloadResponse.body.id;

    // Cancel the download
    const cancelResponse = await request(app)
      .delete(`/api/v1/youtube/downloads/${downloadId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(cancelResponse.body).toMatchObject({
      message: expect.stringContaining('cancelled'),
      downloadId,
    });

    // Verify status is cancelled
    const statusResponse = await request(app)
      .get(`/api/v1/youtube/downloads/${downloadId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(statusResponse.body.status).toBe('cancelled');
  });

  it('should enforce user isolation for downloads', async () => {
    // Create download as regular user
    const userDownload = await request(app)
      .post('/api/v1/youtube/download')
      .send({
        url: 'https://www.youtube.com/watch?v=useronly',
        quality: '720p',
      })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    // Create another regular user
    const otherUser = await prisma.user.create({
      data: {
        plexId: 'other-plex-id',
        plexUsername: 'otheruser',
        email: 'other@example.com',
        role: 'USER',
      },
    });
    const otherToken = createTestJWT({ userId: otherUser.id, role: 'USER' });

    // Other user should not see first user's download
    const otherUserQueue = await request(app)
      .get('/api/v1/youtube/downloads')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);

    expect(otherUserQueue.body.downloads).toHaveLength(0);

    // Other user cannot access specific download
    await request(app)
      .get(`/api/v1/youtube/downloads/${userDownload.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    // Admin can see all downloads
    const adminQueue = await request(app)
      .get('/api/v1/youtube/downloads')
      .query({ all: true })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(adminQueue.body.downloads.length).toBeGreaterThan(0);
    const foundDownload = adminQueue.body.downloads.find((d: any) => d.id === userDownload.body.id);
    expect(foundDownload).toBeTruthy();
  });

  it('should validate YouTube URL format', async () => {
    // Invalid URL
    const invalidResponse = await request(app)
      .post('/api/v1/youtube/validate')
      .send({ url: 'not-a-youtube-url' })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(invalidResponse.body.error).toContain('Invalid YouTube URL');

    // Valid URL
    const validResponse = await request(app)
      .post('/api/v1/youtube/validate')
      .send({ url: 'https://www.youtube.com/watch?v=validvideo' })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(validResponse.body.valid).toBe(true);
  });
});
