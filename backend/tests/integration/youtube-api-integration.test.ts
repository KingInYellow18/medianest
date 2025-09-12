/**
 * YOUTUBE API INTEGRATION TESTS
 *
 * Comprehensive integration tests for YouTube integration endpoints
 * Covers downloads, metadata, rate limiting, and external API mocking
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createServer } from '../../src/server';
import { DatabaseTestHelper } from '../helpers/database-test-helper';
import { AuthTestHelper } from '../helpers/auth-test-helper';

const prisma = new PrismaClient();
let app: any;
let server: any;
let dbHelper: DatabaseTestHelper;
let authHelper: AuthTestHelper;

describe('YouTube API Integration Tests', () => {
  beforeAll(async () => {
    dbHelper = new DatabaseTestHelper();
    authHelper = new AuthTestHelper();

    await dbHelper.setupTestDatabase();
    app = await createServer();
    server = app.listen(0);
  });

  afterAll(async () => {
    await server?.close();
    await dbHelper.cleanupTestDatabase();
    await authHelper.disconnect();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await dbHelper.seedTestData();
    vi.clearAllMocks();
  });

  describe('Authentication Requirements', () => {
    test('should require authentication for all YouTube routes', async () => {
      const youtubeEndpoints = [
        { method: 'post', path: '/api/v1/youtube/download' },
        { method: 'get', path: '/api/v1/youtube/downloads' },
        { method: 'get', path: '/api/v1/youtube/downloads/123' },
        { method: 'delete', path: '/api/v1/youtube/downloads/123' },
        { method: 'get', path: '/api/v1/youtube/metadata' },
      ];

      for (const { method, path } of youtubeEndpoints) {
        await request(app)[method](path).expect(401);
      }
    });

    test('should allow access with valid authentication', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/youtube.service', () => ({
        youtubeService: {
          getVideoMetadata: vi.fn().mockResolvedValue({
            title: 'Test Video',
            duration: '00:03:45',
          }),
        },
      }));

      await request(app)
        .get('/api/v1/youtube/metadata')
        .query({ url: 'https://youtube.com/watch?v=test' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe('POST /api/v1/youtube/download', () => {
    test('should create download successfully', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      const mockDownload = {
        id: 'download-123',
        url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        duration: '00:03:33',
        quality: '720p',
        format: 'mp4',
        status: 'pending',
        progress: 0,
        userId: user.id,
        createdAt: new Date().toISOString(),
      };

      vi.doMock('../../src/controllers/youtube.controller', () => ({
        YouTubeController: vi.fn().mockImplementation(() => ({
          createDownload: vi.fn().mockImplementation((req, res) => {
            res.status(201).json({
              success: true,
              data: { download: mockDownload },
            });
          }),
        })),
      }));

      const downloadRequest = {
        url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        quality: '720p',
        format: 'mp4',
      };

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send(downloadRequest)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.download).toHaveProperty('id');
      expect(response.body.data.download).toHaveProperty('url', downloadRequest.url);
      expect(response.body.data.download).toHaveProperty('quality', downloadRequest.quality);
      expect(response.body.data.download).toHaveProperty('format', downloadRequest.format);
      expect(response.body.data.download).toHaveProperty('status', 'pending');
      expect(response.body.data.download).toHaveProperty('progress', 0);
    });

    test('should validate YouTube URL format', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const invalidUrls = [
        'not-a-url',
        'https://vimeo.com/123456',
        'https://youtube.com/invalid',
        'https://youtu.be/',
        '',
      ];

      for (const invalidUrl of invalidUrls) {
        const response = await request(app)
          .post('/api/v1/youtube/download')
          .send({ url: invalidUrl, quality: '720p', format: 'mp4' })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(400);

        expect(response.body.error).toContain('Invalid YouTube URL');
      }
    });

    test('should validate quality parameter', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const invalidQualities = ['invalid_quality', '4K', '1080i', ''];
      const validQualities = ['144p', '240p', '360p', '480p', '720p', '1080p'];

      // Test invalid qualities
      for (const quality of invalidQualities) {
        await request(app)
          .post('/api/v1/youtube/download')
          .send({
            url: 'https://youtube.com/watch?v=test',
            quality,
            format: 'mp4',
          })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(400);
      }

      // Test that valid qualities would be accepted (mocked)
      vi.doMock('../../src/controllers/youtube.controller', () => ({
        YouTubeController: vi.fn().mockImplementation(() => ({
          createDownload: vi.fn().mockImplementation((req, res) => {
            res.status(201).json({ success: true, data: { download: {} } });
          }),
        })),
      }));

      for (const quality of validQualities) {
        await request(app)
          .post('/api/v1/youtube/download')
          .send({
            url: 'https://youtube.com/watch?v=test',
            quality,
            format: 'mp4',
          })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(201);
      }
    });

    test('should validate format parameter', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const invalidFormats = ['invalid', 'avi', 'mov', ''];
      const validFormats = ['mp4', 'webm', 'mkv'];

      // Test invalid formats
      for (const format of invalidFormats) {
        await request(app)
          .post('/api/v1/youtube/download')
          .send({
            url: 'https://youtube.com/watch?v=test',
            quality: '720p',
            format,
          })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(400);
      }
    });

    test('should enforce rate limiting (5 downloads per hour)', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/controllers/youtube.controller', () => ({
        YouTubeController: vi.fn().mockImplementation(() => ({
          createDownload: vi.fn().mockImplementation((req, res) => {
            res.status(201).json({ success: true, data: { download: {} } });
          }),
        })),
      }));

      const downloadRequest = {
        url: 'https://youtube.com/watch?v=test',
        quality: '720p',
        format: 'mp4',
      };

      // Make 6 rapid requests to test rate limiting
      const requests = Array(6)
        .fill(null)
        .map((_, index) =>
          request(app)
            .post('/api/v1/youtube/download')
            .send({ ...downloadRequest, url: `${downloadRequest.url}${index}` })
            .set('Authorization', `Bearer ${accessToken}`),
        );

      const responses = await Promise.all(
        requests.map((req) => req.then((res) => res.status).catch(() => 429)),
      );

      const successfulRequests = responses.filter((status) => status === 201);
      const rateLimitedRequests = responses.filter((status) => status === 429);

      expect(successfulRequests.length).toBeLessThanOrEqual(5);
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });

    test('should handle YouTube API errors gracefully', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/controllers/youtube.controller', () => ({
        YouTubeController: vi.fn().mockImplementation(() => ({
          createDownload: vi.fn().mockImplementation((req, res) => {
            res.status(503).json({
              error: 'YouTube service unavailable',
            });
          }),
        })),
      }));

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://youtube.com/watch?v=test',
          quality: '720p',
          format: 'mp4',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(503);

      expect(response.body.error).toContain('YouTube service unavailable');
    });

    test('should handle private/deleted videos', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/controllers/youtube.controller', () => ({
        YouTubeController: vi.fn().mockImplementation(() => ({
          createDownload: vi.fn().mockImplementation((req, res) => {
            res.status(404).json({
              error: 'Video not found or is private',
            });
          }),
        })),
      }));

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://youtube.com/watch?v=private_video',
          quality: '720p',
          format: 'mp4',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.error).toContain('Video not found');
    });

    test('should prevent duplicate download requests', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      // Create existing download in database
      await prisma.youtubeDownload.create({
        data: {
          url: 'https://youtube.com/watch?v=test123',
          title: 'Existing Download',
          quality: '720p',
          format: 'mp4',
          status: 'in_progress',
          userId: user.id,
        },
      });

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://youtube.com/watch?v=test123',
          quality: '720p',
          format: 'mp4',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(409);

      expect(response.body.error).toContain('already in progress');
    });
  });

  describe('GET /api/v1/youtube/downloads', () => {
    test('should get user download history with pagination', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      // Create test downloads
      const downloads = await Promise.all(
        Array(15)
          .fill(null)
          .map((_, index) =>
            prisma.youtubeDownload.create({
              data: {
                url: `https://youtube.com/watch?v=test${index}`,
                title: `Test Video ${index}`,
                quality: '720p',
                format: 'mp4',
                status: index % 3 === 0 ? 'completed' : 'pending',
                progress: index % 3 === 0 ? 100 : 0,
                userId: user.id,
              },
            }),
          ),
      );

      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('downloads');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.downloads)).toBe(true);
      expect(response.body.data.downloads.length).toBeLessThanOrEqual(10);
      expect(response.body.data.pagination).toHaveProperty('currentPage', 1);
      expect(response.body.data.pagination).toHaveProperty('totalItems');
    });

    test('should filter downloads by status', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      await Promise.all([
        prisma.youtubeDownload.create({
          data: {
            url: 'https://youtube.com/watch?v=pending1',
            title: 'Pending Download',
            quality: '720p',
            format: 'mp4',
            status: 'pending',
            userId: user.id,
          },
        }),
        prisma.youtubeDownload.create({
          data: {
            url: 'https://youtube.com/watch?v=completed1',
            title: 'Completed Download',
            quality: '720p',
            format: 'mp4',
            status: 'completed',
            progress: 100,
            userId: user.id,
          },
        }),
      ]);

      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .query({ status: 'completed' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.downloads).toHaveLength(1);
      expect(response.body.data.downloads[0].status).toBe('completed');
    });

    test('should sort downloads by creation date (newest first)', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      const now = new Date();
      await Promise.all([
        prisma.youtubeDownload.create({
          data: {
            url: 'https://youtube.com/watch?v=old',
            title: 'Old Download',
            quality: '720p',
            format: 'mp4',
            status: 'completed',
            userId: user.id,
            createdAt: new Date(now.getTime() - 86400000), // 1 day ago
          },
        }),
        prisma.youtubeDownload.create({
          data: {
            url: 'https://youtube.com/watch?v=new',
            title: 'New Download',
            quality: '720p',
            format: 'mp4',
            status: 'completed',
            userId: user.id,
            createdAt: now,
          },
        }),
      ]);

      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.downloads[0].title).toBe('New Download');
      expect(response.body.data.downloads[1].title).toBe('Old Download');
    });

    test('should only show user own downloads', async () => {
      const { user: user1, accessToken: token1 } = await authHelper.createUserWithTokens();
      const { user: user2 } = await authHelper.createUserWithTokens();

      await Promise.all([
        prisma.youtubeDownload.create({
          data: {
            url: 'https://youtube.com/watch?v=user1',
            title: 'User 1 Download',
            quality: '720p',
            format: 'mp4',
            status: 'completed',
            userId: user1.id,
          },
        }),
        prisma.youtubeDownload.create({
          data: {
            url: 'https://youtube.com/watch?v=user2',
            title: 'User 2 Download',
            quality: '720p',
            format: 'mp4',
            status: 'completed',
            userId: user2.id,
          },
        }),
      ]);

      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.data.downloads).toHaveLength(1);
      expect(response.body.data.downloads[0].title).toBe('User 1 Download');
    });
  });

  describe('GET /api/v1/youtube/downloads/:id', () => {
    test('should get specific download details', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      const download = await prisma.youtubeDownload.create({
        data: {
          url: 'https://youtube.com/watch?v=specific',
          title: 'Specific Download',
          quality: '720p',
          format: 'mp4',
          status: 'in_progress',
          progress: 45,
          userId: user.id,
        },
      });

      const response = await request(app)
        .get(`/api/v1/youtube/downloads/${download.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.download).toHaveProperty('id', download.id);
      expect(response.body.data.download).toHaveProperty('title', 'Specific Download');
      expect(response.body.data.download).toHaveProperty('status', 'in_progress');
      expect(response.body.data.download).toHaveProperty('progress', 45);
    });

    test('should prevent access to other users downloads', async () => {
      const { user: user1 } = await authHelper.createUserWithTokens();
      const { accessToken: token2 } = await authHelper.createUserWithTokens();

      const download = await prisma.youtubeDownload.create({
        data: {
          url: 'https://youtube.com/watch?v=private',
          title: 'Private Download',
          quality: '720p',
          format: 'mp4',
          status: 'completed',
          userId: user1.id,
        },
      });

      await request(app)
        .get(`/api/v1/youtube/downloads/${download.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(404);
    });

    test('should handle non-existent download ID', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      await request(app)
        .get('/api/v1/youtube/downloads/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    test('should include download file information when completed', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      const download = await prisma.youtubeDownload.create({
        data: {
          url: 'https://youtube.com/watch?v=completed',
          title: 'Completed Download',
          quality: '720p',
          format: 'mp4',
          status: 'completed',
          progress: 100,
          filePath: '/downloads/completed_video.mp4',
          fileSize: 52428800, // 50MB
          userId: user.id,
        },
      });

      const response = await request(app)
        .get(`/api/v1/youtube/downloads/${download.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.download).toHaveProperty('filePath');
      expect(response.body.data.download).toHaveProperty('fileSize', 52428800);
    });
  });

  describe('DELETE /api/v1/youtube/downloads/:id', () => {
    test('should cancel pending download successfully', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      const download = await prisma.youtubeDownload.create({
        data: {
          url: 'https://youtube.com/watch?v=to_cancel',
          title: 'Download to Cancel',
          quality: '720p',
          format: 'mp4',
          status: 'pending',
          userId: user.id,
        },
      });

      const response = await request(app)
        .delete(`/api/v1/youtube/downloads/${download.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cancelled');

      // Verify download is deleted from database
      const deletedDownload = await prisma.youtubeDownload.findUnique({
        where: { id: download.id },
      });
      expect(deletedDownload).toBeNull();
    });

    test('should delete completed download and clean up files', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      const download = await prisma.youtubeDownload.create({
        data: {
          url: 'https://youtube.com/watch?v=to_delete',
          title: 'Download to Delete',
          quality: '720p',
          format: 'mp4',
          status: 'completed',
          progress: 100,
          filePath: '/downloads/to_delete.mp4',
          userId: user.id,
        },
      });

      vi.doMock('../../src/controllers/youtube.controller', () => ({
        YouTubeController: vi.fn().mockImplementation(() => ({
          deleteDownload: vi.fn().mockImplementation((req, res) => {
            res.status(200).json({
              success: true,
              message: 'Download deleted and files cleaned up',
            });
          }),
        })),
      }));

      const response = await request(app)
        .delete(`/api/v1/youtube/downloads/${download.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.message).toContain('deleted');
    });

    test('should prevent deletion of other users downloads', async () => {
      const { user: user1 } = await authHelper.createUserWithTokens();
      const { accessToken: token2 } = await authHelper.createUserWithTokens();

      const download = await prisma.youtubeDownload.create({
        data: {
          url: 'https://youtube.com/watch?v=protected',
          title: 'Protected Download',
          quality: '720p',
          format: 'mp4',
          status: 'completed',
          userId: user1.id,
        },
      });

      await request(app)
        .delete(`/api/v1/youtube/downloads/${download.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(404);
    });

    test('should handle in-progress downloads properly', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      const download = await prisma.youtubeDownload.create({
        data: {
          url: 'https://youtube.com/watch?v=in_progress',
          title: 'In Progress Download',
          quality: '720p',
          format: 'mp4',
          status: 'in_progress',
          progress: 45,
          userId: user.id,
        },
      });

      vi.doMock('../../src/controllers/youtube.controller', () => ({
        YouTubeController: vi.fn().mockImplementation(() => ({
          deleteDownload: vi.fn().mockImplementation((req, res) => {
            res.status(200).json({
              success: true,
              message: 'Download cancelled and cleaned up',
            });
          }),
        })),
      }));

      const response = await request(app)
        .delete(`/api/v1/youtube/downloads/${download.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.message).toContain('cancelled');
    });
  });

  describe('GET /api/v1/youtube/metadata', () => {
    test('should get video metadata without downloading', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const mockMetadata = {
        title: 'Never Gonna Give You Up',
        duration: '00:03:33',
        uploader: 'Official Rick Astley',
        uploadDate: '2009-10-25',
        viewCount: 1400000000,
        description: 'The official video for "Never Gonna Give You Up"...',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        availableQualities: ['144p', '240p', '360p', '480p', '720p'],
        availableFormats: ['mp4', 'webm'],
      };

      vi.doMock('../../src/controllers/youtube.controller', () => ({
        YouTubeController: vi.fn().mockImplementation(() => ({
          getMetadata: vi.fn().mockImplementation((req, res) => {
            res.status(200).json({
              success: true,
              data: { metadata: mockMetadata },
            });
          }),
        })),
      }));

      const response = await request(app)
        .get('/api/v1/youtube/metadata')
        .query({ url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metadata).toHaveProperty('title', 'Never Gonna Give You Up');
      expect(response.body.data.metadata).toHaveProperty('duration', '00:03:33');
      expect(response.body.data.metadata).toHaveProperty('uploader');
      expect(response.body.data.metadata).toHaveProperty('viewCount');
      expect(response.body.data.metadata).toHaveProperty('availableQualities');
      expect(Array.isArray(response.body.data.metadata.availableQualities)).toBe(true);
      expect(response.body.data.metadata).toHaveProperty('availableFormats');
      expect(Array.isArray(response.body.data.metadata.availableFormats)).toBe(true);
    });

    test('should require URL parameter', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/youtube/metadata')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.error).toContain('URL parameter is required');
    });

    test('should validate YouTube URL format', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const invalidUrls = ['not-a-url', 'https://vimeo.com/123456', 'https://youtube.com/invalid'];

      for (const url of invalidUrls) {
        const response = await request(app)
          .get('/api/v1/youtube/metadata')
          .query({ url })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(400);

        expect(response.body.error).toContain('Invalid YouTube URL');
      }
    });

    test('should handle private or deleted videos', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/controllers/youtube.controller', () => ({
        YouTubeController: vi.fn().mockImplementation(() => ({
          getMetadata: vi.fn().mockImplementation((req, res) => {
            res.status(404).json({
              error: 'Video not found or is private',
            });
          }),
        })),
      }));

      const response = await request(app)
        .get('/api/v1/youtube/metadata')
        .query({ url: 'https://youtube.com/watch?v=private_video' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.error).toContain('Video not found');
    });

    test('should handle YouTube API failures', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/controllers/youtube.controller', () => ({
        YouTubeController: vi.fn().mockImplementation(() => ({
          getMetadata: vi.fn().mockImplementation((req, res) => {
            res.status(503).json({
              error: 'YouTube service unavailable',
            });
          }),
        })),
      }));

      const response = await request(app)
        .get('/api/v1/youtube/metadata')
        .query({ url: 'https://youtube.com/watch?v=test' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(503);

      expect(response.body.error).toContain('YouTube service unavailable');
    });
  });

  describe('External Service Integration Tests', () => {
    test('should handle youtube-dl/yt-dlp binary not available', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/youtube.service', () => ({
        youtubeService: {
          downloadVideo: vi.fn().mockRejectedValue(new Error('youtube-dl not found')),
        },
      }));

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://youtube.com/watch?v=test',
          quality: '720p',
          format: 'mp4',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(503);

      expect(response.body.error).toContain('service unavailable');
    });

    test('should handle network connectivity issues', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/youtube.service', () => ({
        youtubeService: {
          getVideoMetadata: vi.fn().mockRejectedValue({ code: 'ENOTFOUND' }),
        },
      }));

      const response = await request(app)
        .get('/api/v1/youtube/metadata')
        .query({ url: 'https://youtube.com/watch?v=test' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(503);

      expect(response.body.error).toContain('network error');
    });

    test('should handle disk space issues during download', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/services/youtube.service', () => ({
        youtubeService: {
          downloadVideo: vi.fn().mockRejectedValue(new Error('ENOSPC: no space left on device')),
        },
      }));

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://youtube.com/watch?v=test',
          quality: '720p',
          format: 'mp4',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(507);

      expect(response.body.error).toContain('insufficient storage');
    });
  });

  describe('Security and Data Validation', () => {
    test('should sanitize video metadata', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const mockMetadata = {
        title: '<script>alert("xss")</script>Malicious Video',
        description: 'Contains <img src=x onerror=alert("xss")> malicious content',
        uploader: 'Hacker<script>alert("hack")</script>',
      };

      vi.doMock('../../src/controllers/youtube.controller', () => ({
        YouTubeController: vi.fn().mockImplementation(() => ({
          getMetadata: vi.fn().mockImplementation((req, res) => {
            // Simulate sanitized response
            res.status(200).json({
              success: true,
              data: {
                metadata: {
                  title: '&lt;script&gt;alert("xss")&lt;/script&gt;Malicious Video',
                  description: 'Contains &lt;img src=x onerror=alert("xss")&gt; malicious content',
                  uploader: 'Hacker&lt;script&gt;alert("hack")&lt;/script&gt;',
                },
              },
            });
          }),
        })),
      }));

      const response = await request(app)
        .get('/api/v1/youtube/metadata')
        .query({ url: 'https://youtube.com/watch?v=malicious' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify XSS content is escaped
      expect(response.body.data.metadata.title).not.toContain('<script>');
      expect(response.body.data.metadata.description).not.toContain('<img');
    });

    test('should prevent path traversal in download requests', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const maliciousUrls = [
        'https://youtube.com/watch?v=../../../etc/passwd',
        'https://youtube.com/watch?v=..%2F..%2F..%2Fetc%2Fpasswd',
      ];

      for (const url of maliciousUrls) {
        await request(app)
          .post('/api/v1/youtube/download')
          .send({ url, quality: '720p', format: 'mp4' })
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(400);
      }
    });

    test('should validate file size limits', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/controllers/youtube.controller', () => ({
        YouTubeController: vi.fn().mockImplementation(() => ({
          createDownload: vi.fn().mockImplementation((req, res) => {
            res.status(413).json({
              error: 'Video file too large (max 2GB allowed)',
            });
          }),
        })),
      }));

      const response = await request(app)
        .post('/api/v1/youtube/download')
        .send({
          url: 'https://youtube.com/watch?v=huge_video',
          quality: '1080p',
          format: 'mp4',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(413);

      expect(response.body.error).toContain('too large');
    });
  });

  describe('Performance and Load Tests', () => {
    test('should handle concurrent metadata requests efficiently', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/controllers/youtube.controller', () => ({
        YouTubeController: vi.fn().mockImplementation(() => ({
          getMetadata: vi.fn().mockImplementation((req, res) => {
            res.status(200).json({
              success: true,
              data: { metadata: { title: 'Test Video' } },
            });
          }),
        })),
      }));

      const startTime = Date.now();

      const requests = Array(10)
        .fill(null)
        .map((_, index) =>
          request(app)
            .get('/api/v1/youtube/metadata')
            .query({ url: `https://youtube.com/watch?v=test${index}` })
            .set('Authorization', `Bearer ${accessToken}`),
        );

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    test('should maintain download queue performance', async () => {
      const { user } = await authHelper.createUserWithTokens();

      // Create many downloads to test query performance
      const downloads = Array(100)
        .fill(null)
        .map((_, index) => ({
          url: `https://youtube.com/watch?v=perf_test_${index}`,
          title: `Performance Test Video ${index}`,
          quality: '720p',
          format: 'mp4',
          status: index % 3 === 0 ? 'completed' : 'pending',
          progress: index % 3 === 0 ? 100 : Math.floor(Math.random() * 100),
          userId: user.id,
        }));

      await prisma.youtubeDownload.createMany({ data: downloads });

      const { accessToken } = await authHelper.generateAccessToken(user.id);

      const startTime = Date.now();

      const response = await request(app)
        .get('/api/v1/youtube/downloads')
        .query({ limit: 20 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const queryDuration = Date.now() - startTime;

      expect(response.body.data.downloads).toHaveLength(20);
      expect(queryDuration).toBeLessThan(1000); // 1 second max
    });
  });
});
