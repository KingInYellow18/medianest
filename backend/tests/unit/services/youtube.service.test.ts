import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YoutubeService } from '@/services/youtube.service';
import axios from 'axios';

// Mock dependencies
vi.mock('axios');
vi.mock('@/config/database', () => ({
  getDatabase: vi.fn(() => mockDatabase),
}));

vi.mock('@/services/cache.service', () => ({
  cacheService: mockCacheService,
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockedAxios = vi.mocked(axios);

const mockDatabase = {
  youtubeDownload: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
};

const mockCacheService = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

describe('YoutubeService', () => {
  let service: YoutubeService;

  beforeEach(() => {
    service = new YoutubeService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getVideoInfo', () => {
    it('should get video info from cache if available', async () => {
      const videoId = 'test-video-id';
      const cachedInfo = {
        id: videoId,
        title: 'Cached Video',
        duration: '00:03:45',
        thumbnail: 'https://example.com/thumb.jpg',
        uploader: 'Test Channel',
      };

      mockCacheService.get.mockResolvedValue(cachedInfo);

      const result = await service.getVideoInfo(videoId);

      expect(mockCacheService.get).toHaveBeenCalledWith(`youtube_info:${videoId}`);
      expect(result).toEqual(cachedInfo);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should fetch video info from API if not cached', async () => {
      const videoId = 'test-video-id';
      const apiResponse = {
        data: {
          id: videoId,
          title: 'Test Video',
          duration: '00:05:30',
          thumbnail: 'https://example.com/thumbnail.jpg',
          uploader: 'Test Channel',
          view_count: 1000000,
          upload_date: '20231201',
        },
      };

      mockCacheService.get.mockResolvedValue(null);
      mockedAxios.get.mockResolvedValue(apiResponse);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getVideoInfo(videoId);

      expect(mockCacheService.get).toHaveBeenCalledWith(`youtube_info:${videoId}`);
      expect(mockedAxios.get).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `youtube_info:${videoId}`,
        apiResponse.data,
        1800, // 30 minutes
      );
      expect(result).toEqual(apiResponse.data);
    });

    it('should handle API errors gracefully', async () => {
      const videoId = 'test-video-id';

      mockCacheService.get.mockResolvedValue(null);
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      await expect(service.getVideoInfo(videoId)).rejects.toThrow(
        'Failed to fetch video information',
      );
    });

    it('should handle invalid video ID', async () => {
      const videoId = '';

      await expect(service.getVideoInfo(videoId)).rejects.toThrow('Invalid video ID');
    });

    it('should handle rate limiting', async () => {
      const videoId = 'test-video-id';

      mockCacheService.get.mockResolvedValue(null);
      mockedAxios.get.mockRejectedValue({
        response: { status: 429 },
        isAxiosError: true,
      });

      await expect(service.getVideoInfo(videoId)).rejects.toThrow(
        'Rate limit exceeded. Please try again later.',
      );
    });
  });

  describe('createDownloadRequest', () => {
    it('should create download request successfully', async () => {
      const requestData = {
        userId: 'user-123',
        videoId: 'video-123',
        url: 'https://youtube.com/watch?v=video-123',
        quality: '720p',
        format: 'mp4',
      };

      const mockDownload = {
        id: 'download-123',
        ...requestData,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.youtubeDownload.create.mockResolvedValue(mockDownload);

      const result = await service.createDownloadRequest(requestData);

      expect(mockDatabase.youtubeDownload.create).toHaveBeenCalledWith({
        data: {
          ...requestData,
          status: 'pending',
          progress: 0,
        },
      });
      expect(result).toEqual(mockDownload);
    });

    it('should validate video URL', async () => {
      const requestData = {
        userId: 'user-123',
        videoId: 'video-123',
        url: 'invalid-url',
        quality: '720p',
        format: 'mp4',
      };

      await expect(service.createDownloadRequest(requestData)).rejects.toThrow(
        'Invalid YouTube URL',
      );
    });

    it('should handle database errors', async () => {
      const requestData = {
        userId: 'user-123',
        videoId: 'video-123',
        url: 'https://youtube.com/watch?v=video-123',
        quality: '720p',
        format: 'mp4',
      };

      mockDatabase.youtubeDownload.create.mockRejectedValue(new Error('Database error'));

      await expect(service.createDownloadRequest(requestData)).rejects.toThrow('Database error');
    });
  });

  describe('getUserDownloads', () => {
    it('should get user downloads with pagination', async () => {
      const userId = 'user-123';
      const mockDownloads = [
        {
          id: 'download-1',
          userId,
          videoId: 'video-1',
          status: 'completed',
          createdAt: new Date(),
        },
        {
          id: 'download-2',
          userId,
          videoId: 'video-2',
          status: 'pending',
          createdAt: new Date(),
        },
      ];

      mockDatabase.youtubeDownload.findMany.mockResolvedValue(mockDownloads);

      const result = await service.getUserDownloads(userId);

      expect(mockDatabase.youtubeDownload.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual(mockDownloads);
    });

    it('should handle custom pagination', async () => {
      const userId = 'user-123';
      const options = { limit: 10, offset: 20 };

      mockDatabase.youtubeDownload.findMany.mockResolvedValue([]);

      await service.getUserDownloads(userId, options);

      expect(mockDatabase.youtubeDownload.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 20,
      });
    });

    it('should filter by status', async () => {
      const userId = 'user-123';
      const options = { status: 'completed' as const };

      mockDatabase.youtubeDownload.findMany.mockResolvedValue([]);

      await service.getUserDownloads(userId, options);

      expect(mockDatabase.youtubeDownload.findMany).toHaveBeenCalledWith({
        where: { userId, status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });
  });

  describe('updateDownloadProgress', () => {
    it('should update download progress successfully', async () => {
      const downloadId = 'download-123';
      const progress = 50;
      const status = 'downloading' as const;

      const mockUpdatedDownload = {
        id: downloadId,
        progress,
        status,
        updatedAt: new Date(),
      };

      mockDatabase.youtubeDownload.update.mockResolvedValue(mockUpdatedDownload);

      const result = await service.updateDownloadProgress(downloadId, progress, status);

      expect(mockDatabase.youtubeDownload.update).toHaveBeenCalledWith({
        where: { id: downloadId },
        data: { progress, status, updatedAt: expect.any(Date) },
      });
      expect(result).toEqual(mockUpdatedDownload);
    });

    it('should validate progress range', async () => {
      const downloadId = 'download-123';
      const invalidProgress = 150;

      await expect(service.updateDownloadProgress(downloadId, invalidProgress)).rejects.toThrow(
        'Progress must be between 0 and 100',
      );
    });

    it('should handle negative progress', async () => {
      const downloadId = 'download-123';
      const invalidProgress = -10;

      await expect(service.updateDownloadProgress(downloadId, invalidProgress)).rejects.toThrow(
        'Progress must be between 0 and 100',
      );
    });
  });

  describe('deleteDownload', () => {
    it('should delete download successfully', async () => {
      const downloadId = 'download-123';
      const userId = 'user-123';

      const mockDownload = {
        id: downloadId,
        userId,
      };

      mockDatabase.youtubeDownload.delete.mockResolvedValue(mockDownload);

      const result = await service.deleteDownload(downloadId, userId);

      expect(mockDatabase.youtubeDownload.delete).toHaveBeenCalledWith({
        where: { id: downloadId, userId },
      });
      expect(result).toEqual(mockDownload);
    });

    it('should handle unauthorized deletion', async () => {
      mockDatabase.youtubeDownload.delete.mockRejectedValue(new Error('Record not found'));

      await expect(service.deleteDownload('download-123', 'wrong-user')).rejects.toThrow(
        'Record not found',
      );
    });
  });

  describe('getDownloadById', () => {
    it('should get download by ID successfully', async () => {
      const downloadId = 'download-123';
      const userId = 'user-123';

      const mockDownload = {
        id: downloadId,
        userId,
        videoId: 'video-123',
        status: 'completed',
      };

      mockDatabase.youtubeDownload.findFirst.mockResolvedValue(mockDownload);

      const result = await service.getDownloadById(downloadId, userId);

      expect(mockDatabase.youtubeDownload.findFirst).toHaveBeenCalledWith({
        where: { id: downloadId, userId },
      });
      expect(result).toEqual(mockDownload);
    });

    it('should return null if download not found', async () => {
      mockDatabase.youtubeDownload.findFirst.mockResolvedValue(null);

      const result = await service.getDownloadById('nonexistent', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('cancelDownload', () => {
    it('should cancel download successfully', async () => {
      const downloadId = 'download-123';
      const userId = 'user-123';

      const mockDownload = {
        id: downloadId,
        userId,
        status: 'cancelled',
        cancelledAt: new Date(),
      };

      mockDatabase.youtubeDownload.update.mockResolvedValue(mockDownload);

      const result = await service.cancelDownload(downloadId, userId);

      expect(mockDatabase.youtubeDownload.update).toHaveBeenCalledWith({
        where: { id: downloadId, userId },
        data: {
          status: 'cancelled',
          cancelledAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockDownload);
    });

    it('should handle unauthorized cancellation', async () => {
      mockDatabase.youtubeDownload.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.cancelDownload('download-123', 'wrong-user')).rejects.toThrow(
        'Record not found',
      );
    });
  });

  describe('getAvailableFormats', () => {
    it('should return available formats for video', async () => {
      const videoId = 'test-video-id';
      const mockFormats = [
        { format_id: '18', ext: 'mp4', resolution: '360p', filesize: 50000000 },
        { format_id: '22', ext: 'mp4', resolution: '720p', filesize: 150000000 },
        { format_id: '137', ext: 'mp4', resolution: '1080p', filesize: 300000000 },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockedAxios.get.mockResolvedValue({ data: { formats: mockFormats } });
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getAvailableFormats(videoId);

      expect(result).toEqual(mockFormats);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `youtube_formats:${videoId}`,
        mockFormats,
        3600, // 1 hour
      );
    });

    it('should return cached formats if available', async () => {
      const videoId = 'test-video-id';
      const cachedFormats = [{ format_id: '18', ext: 'mp4', resolution: '360p' }];

      mockCacheService.get.mockResolvedValue(cachedFormats);

      const result = await service.getAvailableFormats(videoId);

      expect(result).toEqual(cachedFormats);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe('validateYouTubeUrl', () => {
    it('should validate correct YouTube URLs', () => {
      const validUrls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'http://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s',
      ];

      validUrls.forEach((url) => {
        expect(() => service.validateYouTubeUrl(url)).not.toThrow();
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'https://vimeo.com/123456',
        'https://example.com',
        'not-a-url',
        '',
        'https://youtube.com/playlist?list=123',
      ];

      invalidUrls.forEach((url) => {
        expect(() => service.validateYouTubeUrl(url)).toThrow('Invalid YouTube URL');
      });
    });
  });

  describe('extractVideoId', () => {
    it('should extract video ID from various YouTube URL formats', () => {
      const testCases = [
        { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
        { url: 'https://youtu.be/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
        { url: 'https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s', expected: 'dQw4w9WgXcQ' },
        { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
      ];

      testCases.forEach(({ url, expected }) => {
        expect(service.extractVideoId(url)).toBe(expected);
      });
    });

    it('should return null for invalid URLs', () => {
      const invalidUrls = ['https://vimeo.com/123456', 'https://example.com', 'not-a-url', ''];

      invalidUrls.forEach((url) => {
        expect(service.extractVideoId(url)).toBeNull();
      });
    });
  });

  describe('cleanupOldDownloads', () => {
    it('should cleanup downloads older than specified days', async () => {
      const days = 30;
      const mockResult = { count: 5 };

      mockDatabase.youtubeDownload.deleteMany = vi.fn().mockResolvedValue(mockResult);

      const result = await service.cleanupOldDownloads(days);

      expect(mockDatabase.youtubeDownload.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
          status: {
            in: ['completed', 'cancelled', 'failed'],
          },
        },
      });
      expect(result).toEqual(mockResult);
    });

    it('should use default of 30 days if not specified', async () => {
      const mockResult = { count: 3 };

      mockDatabase.youtubeDownload.deleteMany = vi.fn().mockResolvedValue(mockResult);

      await service.cleanupOldDownloads();

      const callArgs = mockDatabase.youtubeDownload.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.createdAt.lt;
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 30);
      const timeDiff = Math.abs(cutoffDate.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(60000); // Within 1 minute
    });
  });
});
