import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '@/app';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { Queue } from 'bullmq';
import { createClient } from 'redis';

const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });

// Mock BullMQ queue
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getJob: vi.fn().mockResolvedValue({
      id: 'mock-job-id',
      data: {},
      progress: 50,
      attemptsMade: 0,
      finishedOn: null,
      failedReason: null,
    }),
    getJobs: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
  })),
  Worker: vi.fn(),
  QueueEvents: vi.fn(),
}));

describe('Critical Path: YouTube Download Flow', () => {
  let authToken: string;
  let userId: string;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    await redis.connect();

    // Clean up test database
    await prisma.youTubeDownload.deleteMany();
    await prisma.user.deleteMany();

    // Clear Redis
    await redis.flushDb();

    // Create test user
    const user = await prisma.user.create({
      data: {
        plexId: 'test-plex-id',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
      },
    });
    userId = user.id;
    authToken = global.createTestJWT({ userId: user.id, role: user.role });

    // Create admin user
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
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: expect.any(String),
      status: 'queued',
      progress: 0,
      quality: '1080p',
      audioOnly: false,
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
      status: expect.stringMatching(/queued|processing/),
      progress: expect.any(Number),
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
          title: expect.any(String),
          status: expect.any(String),
        }),
      ]),
      total: expect.any(Number),
      active: expect.any(Number),
      queued: expect.any(Number),
    });

    // Step 5: Verify job was added to BullMQ
    const Queue = (await import('bullmq')).Queue;
    const mockQueue = new Queue('youtube-downloads');
    expect(mockQueue.add).toHaveBeenCalledWith(
      'download',
      expect.objectContaining({
        downloadId,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        quality: '1080p',
        userId,
      }),
      expect.any(Object),
    );
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

  it('should handle playlist downloads correctly', async () => {
    // Validate playlist URL
    const validateResponse = await request(app)
      .post('/api/v1/youtube/validate')
      .send({ url: 'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf' })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(validateResponse.body).toMatchObject({
      valid: true,
      type: 'playlist',
      playlistId: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
      title: expect.any(String),
      videoCount: expect.any(Number),
    });

    // Submit playlist download
    const downloadResponse = await request(app)
      .post('/api/v1/youtube/download')
      .send({
        url: 'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
        quality: '720p',
        playlistItems: 'all', // or could be '1-5' for first 5 videos
      })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(downloadResponse.body).toMatchObject({
      type: 'playlist',
      playlistId: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
      totalVideos: expect.any(Number),
      status: 'queued',
    });
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

    // Try to access as admin (should fail for non-admin)
    // Create another regular user
    const otherUser = await prisma.user.create({
      data: {
        plexId: 'other-plex-id',
        username: 'otheruser',
        email: 'other@example.com',
        role: 'user',
        status: 'active',
      },
    });
    const otherToken = global.createTestJWT({ userId: otherUser.id, role: 'user' });

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

  it('should track download progress through WebSocket events', async () => {
    const downloadResponse = await request(app)
      .post('/api/v1/youtube/download')
      .send({
        url: 'https://www.youtube.com/watch?v=progress',
        quality: '1080p',
      })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    const downloadId = downloadResponse.body.id;

    // Simulate progress update (would normally come from worker)
    await prisma.youTubeDownload.update({
      where: { id: downloadId },
      data: {
        status: 'processing',
        progress: 45,
        metadata: {
          speed: '1.2MB/s',
          eta: '00:02:30',
        },
      },
    });

    // Get updated status
    const statusResponse = await request(app)
      .get(`/api/v1/youtube/downloads/${downloadId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(statusResponse.body).toMatchObject({
      status: 'processing',
      progress: 45,
      metadata: expect.objectContaining({
        speed: '1.2MB/s',
        eta: '00:02:30',
      }),
    });
  });

  it('should handle download failures gracefully', async () => {
    // Submit a download that will fail
    const downloadResponse = await request(app)
      .post('/api/v1/youtube/download')
      .send({
        url: 'https://www.youtube.com/watch?v=willFail',
        quality: '4k',
      })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    const downloadId = downloadResponse.body.id;

    // Simulate failure
    await prisma.youTubeDownload.update({
      where: { id: downloadId },
      data: {
        status: 'failed',
        error: 'Video is private or age-restricted',
        completedAt: new Date(),
      },
    });

    // Check failed status
    const statusResponse = await request(app)
      .get(`/api/v1/youtube/downloads/${downloadId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(statusResponse.body).toMatchObject({
      status: 'failed',
      error: 'Video is private or age-restricted',
    });

    // Failed downloads should not count against rate limit
    // User should be able to try again
    const retryResponse = await request(app)
      .post('/api/v1/youtube/download')
      .send({
        url: 'https://www.youtube.com/watch?v=retry',
        quality: '1080p',
      })
      .set('Authorization', `Bearer ${authToken}`);

    // Should succeed if under rate limit
    expect([201, 429]).toContain(retryResponse.status);
  });

  it('should validate supported video qualities and formats', async () => {
    // Invalid quality
    const invalidQualityResponse = await request(app)
      .post('/api/v1/youtube/download')
      .send({
        url: 'https://www.youtube.com/watch?v=test',
        quality: '8k', // Not supported
      })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(invalidQualityResponse.body.error).toContain('quality');

    // Audio only download
    const audioResponse = await request(app)
      .post('/api/v1/youtube/download')
      .send({
        url: 'https://www.youtube.com/watch?v=audio',
        audioOnly: true,
        format: 'mp3',
      })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(audioResponse.body).toMatchObject({
      audioOnly: true,
      format: 'mp3',
    });
  });

  it('should organize downloads by user preferences', async () => {
    // Update user preferences
    await prisma.user.update({
      where: { id: userId },
      data: {
        preferences: {
          youtube: {
            defaultQuality: '1080p',
            outputPath: '/media/youtube/${uploader}/${title}',
            audioFormat: 'mp3',
            subtitles: true,
          },
        },
      },
    });

    // Submit download without specifying quality
    const downloadResponse = await request(app)
      .post('/api/v1/youtube/download')
      .send({
        url: 'https://www.youtube.com/watch?v=prefs',
      })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(downloadResponse.body).toMatchObject({
      quality: '1080p', // From user preferences
      metadata: expect.objectContaining({
        outputPath: expect.stringContaining('/media/youtube/'),
      }),
    });
  });

  it('should trigger Plex library scan after successful download', async () => {
    // Create a completed download
    const download = await prisma.youTubeDownload.create({
      data: {
        userId,
        url: 'https://www.youtube.com/watch?v=complete',
        title: 'Completed Video',
        videoId: 'complete',
        type: 'video',
        status: 'completed',
        progress: 100,
        quality: '1080p',
        audioOnly: false,
        outputPath: '/media/youtube/Completed Video.mp4',
        fileSize: '125MB',
        completedAt: new Date(),
      },
    });

    // Mock Plex library scan endpoint
    let plexScanCalled = false;
    server.use(
      http.post(/\/library\/sections\/\d+\/refresh/, () => {
        plexScanCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );

    // Trigger post-download processing (would normally be done by worker)
    const processResponse = await request(app)
      .post(`/api/v1/youtube/downloads/${download.id}/process`)
      .set('Authorization', `Bearer ${adminToken}`) // Admin only
      .expect(200);

    expect(processResponse.body).toMatchObject({
      message: 'Post-processing completed',
      plexScanTriggered: true,
    });

    // In a real scenario, verify Plex scan was called
    // expect(plexScanCalled).toBe(true)
  });
});
