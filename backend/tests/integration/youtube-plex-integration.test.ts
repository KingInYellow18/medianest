import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Worker, Queue } from 'bullmq';
import { YouTubeDownloadProcessor } from '@/jobs/youtube-download.processor';
import { plexService } from '@/services/plex.service';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/config/redis';

// Mock the plex service
vi.mock('@/services/plex.service', () => ({
  plexService: {
    findYouTubeLibrary: vi.fn(),
    scanDirectory: vi.fn(),
  },
}));

// Mock the YouTube client
vi.mock('@/integrations/youtube/youtube.client', () => ({
  YouTubeClient: vi.fn().mockImplementation(() => ({
    downloadVideo: vi.fn().mockResolvedValue({
      filePath: '/var/lib/medianest/downloads/test-user/test-video.mp4',
      fileSize: 1024 * 1024 * 100, // 100MB
    }),
  })),
}));

describe('YouTube to Plex Integration', () => {
  let processor: YouTubeDownloadProcessor;
  let queue: Queue;
  let userId: string;

  beforeEach(async () => {
    // Clean up database
    await prisma.youTubeDownload.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'youtube-plex@example.com',
        plexId: 'plex-youtube-test',
        username: 'YouTube Plex Test',
        role: 'user',
      },
    });
    userId = user.id;

    // Initialize queue and processor
    const redis = getRedis();
    queue = new Queue('youtube-downloads', {
      connection: {
        host: redis.options.host,
        port: redis.options.port as number,
        password: redis.options.password,
      },
    });

    processor = new YouTubeDownloadProcessor();
  });

  afterEach(async () => {
    await queue.close();
    await processor.stop();
    vi.clearAllMocks();
  });

  it('should trigger Plex library scan after successful download', async () => {
    // Mock Plex service to return a YouTube library
    vi.mocked(plexService.findYouTubeLibrary).mockResolvedValue('3');
    vi.mocked(plexService.scanDirectory).mockResolvedValue(undefined);

    // Create download record
    const download = await prisma.youTubeDownload.create({
      data: {
        userId,
        url: 'https://www.youtube.com/watch?v=test123',
        title: 'Test Video',
        videoId: 'test123',
        type: 'video',
        status: 'queued',
        progress: 0,
        quality: '1080p',
        audioOnly: false,
      },
    });

    // Add job to queue
    const job = await queue.add('download', {
      downloadId: download.id,
      userId,
      url: download.url,
      metadata: {
        id: download.videoId,
        title: download.title,
        channel: 'Test Channel',
        duration: 300,
        thumbnail: 'https://example.com/thumb.jpg',
      },
      quality: download.quality,
      format: 'mp4',
    });

    // Wait for job to complete
    await job.waitUntilFinished(queue.events);

    // Verify Plex library scan was triggered
    expect(plexService.findYouTubeLibrary).toHaveBeenCalledWith(userId);
    expect(plexService.scanDirectory).toHaveBeenCalledWith(
      userId,
      '3',
      expect.stringContaining('/data/youtube/'),
    );

    // Verify download record was updated
    const updatedDownload = await prisma.youTubeDownload.findUnique({
      where: { id: download.id },
    });
    expect(updatedDownload?.status).toBe('completed');
    expect(updatedDownload?.completedAt).toBeDefined();
  });

  it('should continue download process even if Plex scan fails', async () => {
    // Mock Plex service to throw error
    vi.mocked(plexService.findYouTubeLibrary).mockRejectedValue(
      new Error('Plex connection failed'),
    );

    // Create download record
    const download = await prisma.youTubeDownload.create({
      data: {
        userId,
        url: 'https://www.youtube.com/watch?v=test456',
        title: 'Test Video 2',
        videoId: 'test456',
        type: 'video',
        status: 'queued',
        progress: 0,
        quality: '720p',
        audioOnly: false,
      },
    });

    // Add job to queue
    const job = await queue.add('download', {
      downloadId: download.id,
      userId,
      url: download.url,
      metadata: {
        id: download.videoId,
        title: download.title,
        channel: 'Test Channel',
        duration: 300,
        thumbnail: 'https://example.com/thumb.jpg',
      },
      quality: download.quality,
      format: 'mp4',
    });

    // Wait for job to complete
    await job.waitUntilFinished(queue.events);

    // Verify download still completed successfully
    const updatedDownload = await prisma.youTubeDownload.findUnique({
      where: { id: download.id },
    });
    expect(updatedDownload?.status).toBe('completed');

    // Verify Plex scan was attempted
    expect(plexService.findYouTubeLibrary).toHaveBeenCalledWith(userId);
  });

  it('should not trigger Plex scan if no YouTube library is configured', async () => {
    // Mock Plex service to return null (no YouTube library)
    vi.mocked(plexService.findYouTubeLibrary).mockResolvedValue(null);

    // Create download record
    const download = await prisma.youTubeDownload.create({
      data: {
        userId,
        url: 'https://www.youtube.com/watch?v=test789',
        title: 'Test Video 3',
        videoId: 'test789',
        type: 'video',
        status: 'queued',
        progress: 0,
        quality: '480p',
        audioOnly: false,
      },
    });

    // Add job to queue
    const job = await queue.add('download', {
      downloadId: download.id,
      userId,
      url: download.url,
      metadata: {
        id: download.videoId,
        title: download.title,
        channel: 'Test Channel',
        duration: 300,
        thumbnail: 'https://example.com/thumb.jpg',
      },
      quality: download.quality,
      format: 'mp4',
    });

    // Wait for job to complete
    await job.waitUntilFinished(queue.events);

    // Verify Plex library lookup was attempted but scan was not called
    expect(plexService.findYouTubeLibrary).toHaveBeenCalledWith(userId);
    expect(plexService.scanDirectory).not.toHaveBeenCalled();

    // Verify download still completed
    const updatedDownload = await prisma.youTubeDownload.findUnique({
      where: { id: download.id },
    });
    expect(updatedDownload?.status).toBe('completed');
  });
});
