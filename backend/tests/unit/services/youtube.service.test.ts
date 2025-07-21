import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YouTubeService } from '../../../src/services/youtube.service';
import { YouTubeClient } from '../../../src/integrations/youtube/youtube.client';
import { YoutubeDownloadRepository } from '../../../src/repositories/youtube-download.repository';
import { getRedis } from '../../../src/config/redis';
import { BadRequestError, NotFoundError } from '@medianest/shared';

// Mock dependencies
vi.mock('../../../src/integrations/youtube/youtube.client');
vi.mock('../../../src/repositories/youtube-download.repository');
vi.mock('../../../src/config/redis');
vi.mock('../../../src/utils/logger');

describe('YouTubeService', () => {
  let youtubeService: YouTubeService;
  let mockYouTubeClient: any;
  let mockYoutubeDownloadRepo: any;
  let mockRedis: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup YouTubeClient mock
    mockYouTubeClient = {
      validateUrl: vi.fn(),
      getVideoInfo: vi.fn(),
    };
    vi.mocked(YouTubeClient).mockImplementation(() => mockYouTubeClient);

    // Setup YoutubeDownloadRepository mock
    mockYoutubeDownloadRepo = {
      findByFilters: vi.fn(),
      getUserDownloadsInPeriod: vi.fn(),
      getUserDownloadStats: vi.fn(),
      findByUser: vi.fn(),
    };
    vi.mocked(YoutubeDownloadRepository).mockImplementation(() => mockYoutubeDownloadRepo);

    // Setup Redis mock
    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
    };
    vi.mocked(getRedis).mockReturnValue(mockRedis);

    youtubeService = new YouTubeService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getVideoMetadata', () => {
    it('should return cached metadata if available', async () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const cachedMetadata = {
        id: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        channel: 'Rick Astley',
        duration: 213,
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        description: 'Rick Astley song',
        uploadDate: '2009-10-25',
        viewCount: 1000000000,
      };

      mockYouTubeClient.validateUrl.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedMetadata));

      const result = await youtubeService.getVideoMetadata(url);

      expect(mockYouTubeClient.validateUrl).toHaveBeenCalledWith(url);
      expect(mockRedis.get).toHaveBeenCalledWith('youtube:metadata:dQw4w9WgXcQ');
      expect(result).toEqual(cachedMetadata);
      expect(mockYouTubeClient.getVideoInfo).not.toHaveBeenCalled();
    });

    it('should fetch metadata from YouTube and cache it', async () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const metadata = {
        id: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        channel: 'Rick Astley',
        duration: 213,
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        description: 'Rick Astley song',
        uploadDate: '2009-10-25',
        viewCount: 1000000000,
      };

      mockYouTubeClient.validateUrl.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);
      mockYouTubeClient.getVideoInfo.mockResolvedValue(metadata);

      const result = await youtubeService.getVideoMetadata(url);

      expect(mockYouTubeClient.getVideoInfo).toHaveBeenCalledWith(url);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'youtube:metadata:dQw4w9WgXcQ',
        3600,
        JSON.stringify(metadata),
      );
      expect(result).toEqual(metadata);
    });

    it('should throw BadRequestError for invalid URL', async () => {
      const url = 'invalid-url';
      mockYouTubeClient.validateUrl.mockReturnValue(false);

      await expect(youtubeService.getVideoMetadata(url)).rejects.toThrow(
        new BadRequestError('Invalid YouTube URL'),
      );
    });

    it('should throw NotFoundError if video not found', async () => {
      const url = 'https://www.youtube.com/watch?v=invalid';
      mockYouTubeClient.validateUrl.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);
      mockYouTubeClient.getVideoInfo.mockResolvedValue(null);

      await expect(youtubeService.getVideoMetadata(url)).rejects.toThrow(
        new NotFoundError('Video not found'),
      );
    });

    it('should handle fetch error and throw BadRequestError', async () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      mockYouTubeClient.validateUrl.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);
      mockYouTubeClient.getVideoInfo.mockRejectedValue(new Error('Fetch failed'));

      await expect(youtubeService.getVideoMetadata(url)).rejects.toThrow(
        new BadRequestError('Failed to fetch video information'),
      );
    });

    it('should re-throw BadRequestError and NotFoundError', async () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      mockYouTubeClient.validateUrl.mockReturnValue(true);
      mockRedis.get.mockResolvedValue(null);
      mockYouTubeClient.getVideoInfo.mockRejectedValue(new BadRequestError('Specific error'));

      await expect(youtubeService.getVideoMetadata(url)).rejects.toThrow(
        new BadRequestError('Specific error'),
      );
    });
  });

  describe('checkDuplicateDownload', () => {
    it('should return false if video ID cannot be extracted', async () => {
      const userId = 'user-123';
      const url = 'invalid-url';

      const result = await youtubeService.checkDuplicateDownload(userId, url);

      expect(result).toBe(false);
      expect(mockYoutubeDownloadRepo.findByFilters).not.toHaveBeenCalled();
    });

    it('should return true if duplicate download exists', async () => {
      const userId = 'user-123';
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const activeDownloads = {
        items: [
          { playlistUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
          { playlistUrl: 'https://www.youtube.com/watch?v=other' },
        ],
      };

      mockYoutubeDownloadRepo.findByFilters.mockResolvedValue(activeDownloads);

      const result = await youtubeService.checkDuplicateDownload(userId, url);

      expect(mockYoutubeDownloadRepo.findByFilters).toHaveBeenCalledWith({
        userId,
        status: 'queued',
      });
      expect(result).toBe(true);
    });

    it('should return false if no duplicate download exists', async () => {
      const userId = 'user-123';
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const activeDownloads = {
        items: [
          { playlistUrl: 'https://www.youtube.com/watch?v=other1' },
          { playlistUrl: 'https://www.youtube.com/watch?v=other2' },
        ],
      };

      mockYoutubeDownloadRepo.findByFilters.mockResolvedValue(activeDownloads);

      const result = await youtubeService.checkDuplicateDownload(userId, url);

      expect(result).toBe(false);
    });

    it('should handle youtu.be URLs', async () => {
      const userId = 'user-123';
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      const activeDownloads = {
        items: [{ playlistUrl: 'https://youtu.be/dQw4w9WgXcQ' }],
      };

      mockYoutubeDownloadRepo.findByFilters.mockResolvedValue(activeDownloads);

      const result = await youtubeService.checkDuplicateDownload(userId, url);

      expect(result).toBe(true);
    });
  });

  describe('getUserDownloadsInLastHour', () => {
    it('should return download count from repository', async () => {
      const userId = 'user-123';
      const expectedCount = 5;

      mockYoutubeDownloadRepo.getUserDownloadsInPeriod.mockResolvedValue(expectedCount);

      const result = await youtubeService.getUserDownloadsInLastHour(userId);

      expect(mockYoutubeDownloadRepo.getUserDownloadsInPeriod).toHaveBeenCalledWith(userId, 1);
      expect(result).toBe(expectedCount);
    });
  });

  describe('extractVideoId', () => {
    it('should extract video ID from youtube.com URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s';
      // Access private method for testing
      const extractVideoId = (youtubeService as any).extractVideoId.bind(youtubeService);

      const result = extractVideoId(url);

      expect(result).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtu.be URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      const extractVideoId = (youtubeService as any).extractVideoId.bind(youtubeService);

      const result = extractVideoId(url);

      expect(result).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid URL format', () => {
      const url = 'https://example.com/invalid';
      const extractVideoId = (youtubeService as any).extractVideoId.bind(youtubeService);

      const result = extractVideoId(url);

      expect(result).toBeNull();
    });

    it('should return null for malformed URL', () => {
      const url = 'not-a-url';
      const extractVideoId = (youtubeService as any).extractVideoId.bind(youtubeService);

      const result = extractVideoId(url);

      expect(result).toBeNull();
    });
  });

  describe('selectOptimalQuality', () => {
    it('should throw error if no formats available', async () => {
      await expect(youtubeService.selectOptimalQuality([], 'best')).rejects.toThrow(
        new BadRequestError('No formats available for this video'),
      );
    });

    it('should throw error if no suitable formats found', async () => {
      const formats = [
        { vcodec: 'none', acodec: 'opus', height: 720 },
        { vcodec: 'h264', acodec: 'none', height: 480 },
      ];

      await expect(youtubeService.selectOptimalQuality(formats, 'best')).rejects.toThrow(
        new BadRequestError('No suitable formats found'),
      );
    });

    it('should return best quality when requested', async () => {
      const formats = [
        { vcodec: 'h264', acodec: 'opus', height: 480 },
        { vcodec: 'h264', acodec: 'opus', height: 1080 },
        { vcodec: 'h264', acodec: 'opus', height: 720 },
      ];

      const result = await youtubeService.selectOptimalQuality(formats, 'best');

      expect(result).toEqual({
        format: { vcodec: 'h264', acodec: 'opus', height: 1080 },
        quality: '1080p',
      });
    });

    it('should return exact match when available', async () => {
      const formats = [
        { vcodec: 'h264', acodec: 'opus', height: 480 },
        { vcodec: 'h264', acodec: 'opus', height: 720 },
        { vcodec: 'h264', acodec: 'opus', height: 1080 },
      ];

      const result = await youtubeService.selectOptimalQuality(formats, '720p');

      expect(result).toEqual({
        format: { vcodec: 'h264', acodec: 'opus', height: 720 },
        quality: '720p',
      });
    });

    it('should return closest lower quality if exact match not found', async () => {
      const formats = [
        { vcodec: 'h264', acodec: 'opus', height: 480 },
        { vcodec: 'h264', acodec: 'opus', height: 1080 },
      ];

      const result = await youtubeService.selectOptimalQuality(formats, '720p');

      expect(result).toEqual({
        format: { vcodec: 'h264', acodec: 'opus', height: 480 },
        quality: '480p',
      });
    });

    it('should return best available if no lower quality found', async () => {
      const formats = [
        { vcodec: 'h264', acodec: 'opus', height: 1080 },
        { vcodec: 'h264', acodec: 'opus', height: 1440 },
      ];

      const result = await youtubeService.selectOptimalQuality(formats, '720p');

      expect(result).toEqual({
        format: { vcodec: 'h264', acodec: 'opus', height: 1440 },
        quality: '1440p',
      });
    });
  });

  describe('validateDownloadParams', () => {
    it('should not throw for valid quality and format', () => {
      expect(() => youtubeService.validateDownloadParams('1080p', 'mp4')).not.toThrow();
      expect(() => youtubeService.validateDownloadParams('best', 'webm')).not.toThrow();
      expect(() => youtubeService.validateDownloadParams('720p', 'mkv')).not.toThrow();
    });

    it('should throw error for invalid quality', () => {
      expect(() => youtubeService.validateDownloadParams('4K', 'mp4')).toThrow(
        new BadRequestError(
          'Invalid quality. Valid options: best, 2160p, 1440p, 1080p, 720p, 480p, 360p',
        ),
      );
    });

    it('should throw error for invalid format', () => {
      expect(() => youtubeService.validateDownloadParams('1080p', 'avi')).toThrow(
        new BadRequestError('Invalid format. Valid options: mp4, webm, mkv'),
      );
    });
  });

  describe('getUserDownloadStats', () => {
    it('should return comprehensive download statistics', async () => {
      const userId = 'user-123';
      const stats = {
        completed: 10,
        failed: 2,
        queued: 3,
        downloading: 1,
        cancelled: 1,
      };
      const downloads = {
        total: 17,
        items: [
          {
            filePaths: {
              totalSize: 1000000000, // 1GB
              duration: 3600, // 1 hour
            },
          },
          {
            filePaths: {
              totalSize: 500000000, // 500MB
              duration: 1800, // 30 minutes
            },
          },
        ],
      };

      mockYoutubeDownloadRepo.getUserDownloadStats.mockResolvedValue(stats);
      mockYoutubeDownloadRepo.findByUser.mockResolvedValue(downloads);

      const result = await youtubeService.getUserDownloadStats(userId);

      expect(mockYoutubeDownloadRepo.getUserDownloadStats).toHaveBeenCalledWith(userId);
      expect(mockYoutubeDownloadRepo.findByUser).toHaveBeenCalledWith(userId, { limit: 1000 });
      expect(result).toEqual({
        total: 17,
        completed: 10,
        failed: 2,
        pending: 3,
        downloading: 1,
        cancelled: 1,
        totalSize: 1500000000,
        totalDuration: 5400,
      });
    });

    it('should handle downloads without file data', async () => {
      const userId = 'user-123';
      const stats = { completed: 5 };
      const downloads = {
        total: 5,
        items: [
          { filePaths: null },
          { filePaths: {} },
          { filePaths: { totalSize: 1000, duration: 100 } },
        ],
      };

      mockYoutubeDownloadRepo.getUserDownloadStats.mockResolvedValue(stats);
      mockYoutubeDownloadRepo.findByUser.mockResolvedValue(downloads);

      const result = await youtubeService.getUserDownloadStats(userId);

      expect(result.totalSize).toBe(1000);
      expect(result.totalDuration).toBe(100);
    });

    it('should handle missing stats gracefully', async () => {
      const userId = 'user-123';
      const stats = {}; // Empty stats
      const downloads = { total: 0, items: [] };

      mockYoutubeDownloadRepo.getUserDownloadStats.mockResolvedValue(stats);
      mockYoutubeDownloadRepo.findByUser.mockResolvedValue(downloads);

      const result = await youtubeService.getUserDownloadStats(userId);

      expect(result).toEqual({
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        downloading: 0,
        cancelled: 0,
        totalSize: 0,
        totalDuration: 0,
      });
    });
  });
});
