import { vi } from 'vitest';

export const createMockYouTubeService = () => ({
  validateUrl: vi.fn(),
  getVideoInfo: vi.fn(),
  downloadVideo: vi.fn(),
  getDownloadProgress: vi.fn(),
  cancelDownload: vi.fn(),
  getFormats: vi.fn(),
  checkHealth: vi.fn()
});

export const mockYouTubeHealthy = (mockYouTubeService: ReturnType<typeof createMockYouTubeService>) => {
  mockYouTubeService.checkHealth.mockResolvedValue({
    status: 'healthy',
    version: 'yt-dlp 2024.01.01',
    responseTime: 100
  });
};

export const mockYouTubeUnhealthy = (mockYouTubeService: ReturnType<typeof createMockYouTubeService>) => {
  mockYouTubeService.checkHealth.mockRejectedValue(new Error('yt-dlp not available'));
};

export const mockYouTubeValidation = (mockYouTubeService: ReturnType<typeof createMockYouTubeService>) => {
  mockYouTubeService.validateUrl.mockImplementation(async (url: string) => {
    const validPatterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=[\w-]+/
    ];
    
    const isValid = validPatterns.some(pattern => pattern.test(url));
    return {
      valid: isValid,
      type: url.includes('playlist') ? 'playlist' : 'video',
      url: isValid ? url : null
    };
  });
};

export const mockYouTubeVideoInfo = (mockYouTubeService: ReturnType<typeof createMockYouTubeService>) => {
  mockYouTubeService.getVideoInfo.mockImplementation(async (url: string) => {
    if (url.includes('invalid')) {
      throw new Error('Video not available');
    }
    
    return {
      id: 'test-video-id',
      title: 'Test YouTube Video',
      description: 'A test video for unit testing',
      duration: 180, // 3 minutes
      uploader: 'Test Channel',
      uploadDate: '20240101',
      viewCount: 1000,
      likeCount: 50,
      thumbnail: 'https://img.youtube.com/vi/test-video-id/maxresdefault.jpg',
      formats: [
        {
          format_id: 'best',
          ext: 'mp4',
          quality: '720p',
          filesize: 50000000, // ~50MB
          vcodec: 'h264',
          acodec: 'aac'
        },
        {
          format_id: 'worst',
          ext: 'mp4',
          quality: '360p',
          filesize: 20000000, // ~20MB
          vcodec: 'h264',
          acodec: 'aac'
        }
      ]
    };
  });
};

export const mockYouTubeDownload = (mockYouTubeService: ReturnType<typeof createMockYouTubeService>) => {
  let downloadProgress = 0;
  
  mockYouTubeService.downloadVideo.mockImplementation(async (url: string, options: any) => {
    downloadProgress = 0;
    
    // Simulate download progress
    const progressInterval = setInterval(() => {
      downloadProgress += 10;
      if (downloadProgress >= 100) {
        clearInterval(progressInterval);
      }
    }, 100);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        clearInterval(progressInterval);
        downloadProgress = 100;
        resolve({
          id: 'download-job-id',
          status: 'completed',
          filename: 'test-video.mp4',
          filepath: '/downloads/test-video.mp4',
          filesize: 50000000
        });
      }, 1000);
    });
  });
  
  mockYouTubeService.getDownloadProgress.mockImplementation(async (jobId: string) => {
    return {
      jobId,
      status: downloadProgress < 100 ? 'downloading' : 'completed',
      progress: downloadProgress,
      speed: '1MB/s',
      eta: downloadProgress < 100 ? '30s' : '0s',
      downloaded: Math.floor((downloadProgress / 100) * 50000000),
      total: 50000000
    };
  });
  
  mockYouTubeService.cancelDownload.mockImplementation(async (jobId: string) => {
    downloadProgress = 0;
    return {
      jobId,
      status: 'cancelled',
      message: 'Download cancelled successfully'
    };
  });
};

export const mockYouTubeFormats = (mockYouTubeService: ReturnType<typeof createMockYouTubeService>) => {
  mockYouTubeService.getFormats.mockResolvedValue([
    {
      format_id: '18',
      ext: 'mp4',
      quality: '360p',
      resolution: '640x360',
      vcodec: 'h264',
      acodec: 'aac',
      filesize: 20000000
    },
    {
      format_id: '22',
      ext: 'mp4',
      quality: '720p',
      resolution: '1280x720',
      vcodec: 'h264',
      acodec: 'aac',
      filesize: 50000000
    },
    {
      format_id: '137',
      ext: 'mp4',
      quality: '1080p',
      resolution: '1920x1080',
      vcodec: 'h264',
      acodec: 'none',
      filesize: 100000000
    }
  ]);
};

export const mockYouTubePlaylist = (mockYouTubeService: ReturnType<typeof createMockYouTubeService>) => {
  mockYouTubeService.getVideoInfo.mockImplementation(async (url: string) => {
    if (url.includes('playlist')) {
      return {
        id: 'test-playlist-id',
        title: 'Test Playlist',
        description: 'A test playlist for unit testing',
        uploader: 'Test Channel',
        videoCount: 3,
        videos: [
          {
            id: 'video1',
            title: 'Test Video 1',
            duration: 120,
            url: 'https://youtube.com/watch?v=video1'
          },
          {
            id: 'video2',
            title: 'Test Video 2',
            duration: 150,
            url: 'https://youtube.com/watch?v=video2'
          },
          {
            id: 'video3',
            title: 'Test Video 3',
            duration: 180,
            url: 'https://youtube.com/watch?v=video3'
          }
        ]
      };
    }
    
    // Fall back to single video mock
    return mockYouTubeService.getVideoInfo(url);
  });
};