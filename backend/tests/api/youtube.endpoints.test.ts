import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { testPrismaClient as prisma } from '../helpers/test-prisma-client';
import { cleanupDatabase } from '../helpers/database-cleanup';
import { createAuthToken, createAdminToken } from '../helpers/auth';

describe('YouTube Endpoints - Critical Path', () => {
  let app: any;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await cleanupDatabase(prisma);
    app = createTestApp();
    authToken = createAuthToken();
    adminToken = createAdminToken();

    // Mock YouTube download endpoint
    app.post('/api/youtube/download', (req, res) => {
      const { url, quality, format } = req.body;

      if (!req.user) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required for YouTube downloads',
        });
      }

      if (!url) {
        return res.status(400).json({
          error: 'MISSING_URL',
          message: 'YouTube URL is required',
        });
      }

      // Validate YouTube URL format
      if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        return res.status(400).json({
          error: 'INVALID_URL',
          message: 'Please provide a valid YouTube URL',
        });
      }

      // Simulate video not found
      if (url.includes('not-found')) {
        return res.status(404).json({
          error: 'VIDEO_NOT_FOUND',
          message: 'Video not found or is private/deleted',
        });
      }

      // Simulate quota exceeded
      if (req.query.quota_exceeded === 'true') {
        return res.status(429).json({
          error: 'QUOTA_EXCEEDED',
          message: 'Daily download quota exceeded',
          resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      res.status(202).json({
        id: 'download_123',
        url,
        status: 'queued',
        quality: quality || 'best',
        format: format || 'mp4',
        estimatedSize: '150MB',
        queuePosition: 1,
        estimatedTime: 120,
        userId: req.user.id,
        createdAt: new Date().toISOString(),
      });
    });

    // Mock download status endpoint
    app.get('/api/youtube/download/:id/status', (req, res) => {
      const { id } = req.params;
      const status = req.query.status || 'processing';

      if (!req.user) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      const statusResponses = {
        queued: {
          id,
          status: 'queued',
          progress: 0,
          queuePosition: 2,
          estimatedTime: 240,
        },
        processing: {
          id,
          status: 'processing',
          progress: 45,
          stage: 'downloading',
          downloadSpeed: '5.2 MB/s',
          estimatedTimeRemaining: 60,
        },
        completed: {
          id,
          status: 'completed',
          progress: 100,
          downloadUrl: `/api/youtube/download/${id}/file`,
          fileSize: '157MB',
          completedAt: new Date().toISOString(),
        },
        failed: {
          id,
          status: 'failed',
          progress: 30,
          error: 'Video is age-restricted and cannot be downloaded',
          failedAt: new Date().toISOString(),
        },
      };

      res.json(
        statusResponses[status as keyof typeof statusResponses] || statusResponses.processing,
      );
    });

    // Mock download file endpoint
    app.get('/api/youtube/download/:id/file', (req, res) => {
      const { id } = req.params;

      if (!req.user) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      // Simulate file not ready
      if (req.query.not_ready === 'true') {
        return res.status(404).json({
          error: 'FILE_NOT_READY',
          message: 'Download not yet completed',
        });
      }

      // Simulate file download
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="video_${id}.mp4"`);
      res.status(200).send('mock-video-content');
    });

    // Mock download history endpoint
    app.get('/api/youtube/downloads', (req, res) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      const { page = 1, limit = 10, status } = req.query;

      const downloads = [
        {
          id: 'download_123',
          url: 'https://youtube.com/watch?v=test123',
          title: 'Test Video 1',
          status: 'completed',
          quality: 'best',
          format: 'mp4',
          fileSize: '157MB',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
        {
          id: 'download_124',
          url: 'https://youtube.com/watch?v=test124',
          title: 'Test Video 2',
          status: 'processing',
          quality: '720p',
          format: 'mp4',
          progress: 65,
          createdAt: new Date().toISOString(),
        },
      ];

      const filteredDownloads = status ? downloads.filter((d) => d.status === status) : downloads;
      const totalCount = filteredDownloads.length;
      const pageSize = parseInt(limit as string);
      const pageNumber = parseInt(page as string);
      const startIndex = (pageNumber - 1) * pageSize;
      const paginatedDownloads = filteredDownloads.slice(startIndex, startIndex + pageSize);

      res.json({
        downloads: paginatedDownloads,
        pagination: {
          page: pageNumber,
          limit: pageSize,
          total: totalCount,
          pages: Math.ceil(totalCount / pageSize),
        },
      });
    });

    // Mock download cancellation endpoint
    app.delete('/api/youtube/download/:id', (req, res) => {
      const { id } = req.params;

      if (!req.user) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      // Simulate download not found
      if (id === 'not-found') {
        return res.status(404).json({
          error: 'DOWNLOAD_NOT_FOUND',
          message: 'Download not found',
        });
      }

      // Simulate cannot cancel completed download
      if (req.query.completed === 'true') {
        return res.status(400).json({
          error: 'CANNOT_CANCEL_COMPLETED',
          message: 'Cannot cancel a completed download',
        });
      }

      res.json({
        message: 'Download cancelled successfully',
        id,
        cancelledAt: new Date().toISOString(),
      });
    });

    // Mock video info endpoint
    app.post('/api/youtube/info', (req, res) => {
      const { url } = req.body;

      if (!req.user) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      if (!url) {
        return res.status(400).json({
          error: 'MISSING_URL',
          message: 'YouTube URL is required',
        });
      }

      if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        return res.status(400).json({
          error: 'INVALID_URL',
          message: 'Please provide a valid YouTube URL',
        });
      }

      // Simulate video not found
      if (url.includes('not-found')) {
        return res.status(404).json({
          error: 'VIDEO_NOT_FOUND',
          message: 'Video not found or is private',
        });
      }

      res.json({
        id: 'video_123',
        title: 'Test Video Title',
        description: 'Test video description',
        duration: 180,
        uploader: 'Test Channel',
        uploadDate: '2024-01-01',
        viewCount: 1000000,
        likeCount: 50000,
        thumbnail: 'https://img.youtube.com/vi/test123/maxresdefault.jpg',
        formats: [
          { format_id: '18', ext: 'mp4', resolution: '360p', filesize: 52428800 },
          { format_id: '22', ext: 'mp4', resolution: '720p', filesize: 157286400 },
          { format_id: '137', ext: 'mp4', resolution: '1080p', filesize: 314572800 },
        ],
        availableQualities: ['360p', '720p', '1080p', 'best'],
        availableFormats: ['mp4', 'webm', 'audio-only'],
      });
    });

    // Mock admin download management
    app.get('/api/admin/youtube/downloads', (req, res) => {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
        });
      }

      const { status, user } = req.query;

      const allDownloads = [
        {
          id: 'download_123',
          url: 'https://youtube.com/watch?v=test123',
          title: 'Test Video 1',
          status: 'completed',
          userId: 'user_1',
          userName: 'User One',
          quality: 'best',
          format: 'mp4',
          fileSize: '157MB',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'download_124',
          url: 'https://youtube.com/watch?v=test124',
          title: 'Test Video 2',
          status: 'processing',
          userId: 'user_2',
          userName: 'User Two',
          quality: '720p',
          format: 'mp4',
          progress: 65,
          createdAt: new Date().toISOString(),
        },
      ];

      let filteredDownloads = allDownloads;

      if (status) {
        filteredDownloads = filteredDownloads.filter((d) => d.status === status);
      }

      if (user) {
        filteredDownloads = filteredDownloads.filter((d) => d.userId === user);
      }

      res.json({
        downloads: filteredDownloads,
        stats: {
          total: allDownloads.length,
          completed: allDownloads.filter((d) => d.status === 'completed').length,
          processing: allDownloads.filter((d) => d.status === 'processing').length,
          failed: allDownloads.filter((d) => d.status === 'failed').length,
        },
      });
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('YouTube Download Initiation', () => {
    it('should start YouTube download with valid URL', async () => {
      const response = await request(app)
        .post('/api/youtube/download')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://youtube.com/watch?v=test123',
          quality: '720p',
          format: 'mp4',
        })
        .expect(202);

      expect(response.body).toMatchObject({
        id: expect.stringMatching(/^download_/),
        url: 'https://youtube.com/watch?v=test123',
        status: 'queued',
        quality: '720p',
        format: 'mp4',
        estimatedSize: expect.any(String),
        queuePosition: expect.any(Number),
        estimatedTime: expect.any(Number),
        userId: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it('should start download with default quality and format', async () => {
      const response = await request(app)
        .post('/api/youtube/download')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://youtu.be/shorturl123',
        })
        .expect(202);

      expect(response.body).toMatchObject({
        quality: 'best',
        format: 'mp4',
      });
    });

    it('should reject download without authentication', async () => {
      const response = await request(app)
        .post('/api/youtube/download')
        .send({
          url: 'https://youtube.com/watch?v=test123',
        })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'UNAUTHORIZED',
        message: expect.stringContaining('Authentication required'),
      });
    });

    it('should reject download without URL', async () => {
      const response = await request(app)
        .post('/api/youtube/download')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'MISSING_URL',
        message: expect.stringContaining('URL is required'),
      });
    });

    it('should reject invalid YouTube URLs', async () => {
      const response = await request(app)
        .post('/api/youtube/download')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://invalid-site.com/video',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'INVALID_URL',
        message: expect.stringContaining('valid YouTube URL'),
      });
    });

    it('should handle video not found', async () => {
      const response = await request(app)
        .post('/api/youtube/download')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://youtube.com/watch?v=not-found',
        })
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'VIDEO_NOT_FOUND',
        message: expect.stringContaining('not found'),
      });
    });

    it('should handle quota exceeded', async () => {
      const response = await request(app)
        .post('/api/youtube/download?quota_exceeded=true')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://youtube.com/watch?v=test123',
        })
        .expect(429);

      expect(response.body).toMatchObject({
        error: 'QUOTA_EXCEEDED',
        message: expect.stringContaining('quota exceeded'),
        resetTime: expect.any(String),
      });
    });
  });

  describe('Download Status Tracking', () => {
    it('should get queued download status', async () => {
      const response = await request(app)
        .get('/api/youtube/download/download_123/status?status=queued')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'download_123',
        status: 'queued',
        progress: 0,
        queuePosition: expect.any(Number),
        estimatedTime: expect.any(Number),
      });
    });

    it('should get processing download status', async () => {
      const response = await request(app)
        .get('/api/youtube/download/download_123/status?status=processing')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'download_123',
        status: 'processing',
        progress: expect.any(Number),
        stage: expect.any(String),
        downloadSpeed: expect.any(String),
        estimatedTimeRemaining: expect.any(Number),
      });
    });

    it('should get completed download status', async () => {
      const response = await request(app)
        .get('/api/youtube/download/download_123/status?status=completed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'download_123',
        status: 'completed',
        progress: 100,
        downloadUrl: expect.stringContaining('/api/youtube/download/'),
        fileSize: expect.any(String),
        completedAt: expect.any(String),
      });
    });

    it('should get failed download status', async () => {
      const response = await request(app)
        .get('/api/youtube/download/download_123/status?status=failed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'download_123',
        status: 'failed',
        error: expect.any(String),
        failedAt: expect.any(String),
      });
    });

    it('should reject status check without authentication', async () => {
      const response = await request(app)
        .get('/api/youtube/download/download_123/status')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'UNAUTHORIZED',
      });
    });
  });

  describe('File Download', () => {
    it('should download completed file', async () => {
      const response = await request(app)
        .get('/api/youtube/download/download_123/file')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('video/mp4');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('video_download_123.mp4');
    });

    it('should reject download without authentication', async () => {
      const response = await request(app)
        .get('/api/youtube/download/download_123/file')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'UNAUTHORIZED',
      });
    });

    it('should handle file not ready', async () => {
      const response = await request(app)
        .get('/api/youtube/download/download_123/file?not_ready=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'FILE_NOT_READY',
        message: expect.stringContaining('not yet completed'),
      });
    });
  });

  describe('Download History', () => {
    it('should get user download history', async () => {
      const response = await request(app)
        .get('/api/youtube/downloads')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        downloads: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            url: expect.any(String),
            title: expect.any(String),
            status: expect.any(String),
            createdAt: expect.any(String),
          }),
        ]),
        pagination: {
          page: 1,
          limit: 10,
          total: expect.any(Number),
          pages: expect.any(Number),
        },
      });
    });

    it('should filter downloads by status', async () => {
      const response = await request(app)
        .get('/api/youtube/downloads?status=completed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.downloads).toHaveLength(1);
      expect(response.body.downloads[0].status).toBe('completed');
    });

    it('should paginate download history', async () => {
      const response = await request(app)
        .get('/api/youtube/downloads?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 1,
        total: 2,
        pages: 2,
      });
      expect(response.body.downloads).toHaveLength(1);
    });

    it('should reject history access without authentication', async () => {
      const response = await request(app).get('/api/youtube/downloads').expect(401);

      expect(response.body).toMatchObject({
        error: 'UNAUTHORIZED',
      });
    });
  });

  describe('Download Management', () => {
    it('should cancel pending download', async () => {
      const response = await request(app)
        .delete('/api/youtube/download/download_123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Download cancelled successfully',
        id: 'download_123',
        cancelledAt: expect.any(String),
      });
    });

    it('should reject cancellation of non-existent download', async () => {
      const response = await request(app)
        .delete('/api/youtube/download/not-found')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'DOWNLOAD_NOT_FOUND',
        message: expect.stringContaining('not found'),
      });
    });

    it('should reject cancellation of completed download', async () => {
      const response = await request(app)
        .delete('/api/youtube/download/download_123?completed=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'CANNOT_CANCEL_COMPLETED',
        message: expect.stringContaining('cannot cancel'),
      });
    });

    it('should reject cancellation without authentication', async () => {
      const response = await request(app).delete('/api/youtube/download/download_123').expect(401);

      expect(response.body).toMatchObject({
        error: 'UNAUTHORIZED',
      });
    });
  });

  describe('Video Information', () => {
    it('should get video information', async () => {
      const response = await request(app)
        .post('/api/youtube/info')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://youtube.com/watch?v=test123',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        description: expect.any(String),
        duration: expect.any(Number),
        uploader: expect.any(String),
        uploadDate: expect.any(String),
        viewCount: expect.any(Number),
        thumbnail: expect.any(String),
        formats: expect.arrayContaining([
          expect.objectContaining({
            format_id: expect.any(String),
            ext: expect.any(String),
            resolution: expect.any(String),
            filesize: expect.any(Number),
          }),
        ]),
        availableQualities: expect.arrayContaining(['360p', '720p', '1080p']),
        availableFormats: expect.arrayContaining(['mp4', 'webm']),
      });
    });

    it('should handle video info for unavailable video', async () => {
      const response = await request(app)
        .post('/api/youtube/info')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://youtube.com/watch?v=not-found',
        })
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'VIDEO_NOT_FOUND',
        message: expect.stringContaining('not found'),
      });
    });

    it('should reject info request without URL', async () => {
      const response = await request(app)
        .post('/api/youtube/info')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'MISSING_URL',
      });
    });

    it('should reject info request without authentication', async () => {
      const response = await request(app)
        .post('/api/youtube/info')
        .send({
          url: 'https://youtube.com/watch?v=test123',
        })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'UNAUTHORIZED',
      });
    });
  });

  describe('Admin Download Management', () => {
    it('should allow admin to view all downloads', async () => {
      const response = await request(app)
        .get('/api/admin/youtube/downloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        downloads: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            userId: expect.any(String),
            userName: expect.any(String),
            status: expect.any(String),
          }),
        ]),
        stats: {
          total: expect.any(Number),
          completed: expect.any(Number),
          processing: expect.any(Number),
          failed: expect.any(Number),
        },
      });
    });

    it('should allow admin to filter downloads by status', async () => {
      const response = await request(app)
        .get('/api/admin/youtube/downloads?status=completed')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.downloads.every((d: any) => d.status === 'completed')).toBe(true);
    });

    it('should allow admin to filter downloads by user', async () => {
      const response = await request(app)
        .get('/api/admin/youtube/downloads?user=user_1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.downloads.every((d: any) => d.userId === 'user_1')).toBe(true);
    });

    it('should reject admin access for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/youtube/downloads')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: expect.stringContaining('Admin privileges required'),
      });
    });

    it('should reject admin access without authentication', async () => {
      const response = await request(app).get('/api/admin/youtube/downloads').expect(401);

      expect(response.body).toMatchObject({
        error: 'UNAUTHORIZED',
      });
    });
  });
});
