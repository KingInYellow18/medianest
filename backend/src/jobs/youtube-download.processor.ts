import { Worker, Job } from 'bullmq';
import path from 'path';
import fs from 'fs/promises';

import { logger } from '@/utils/logger';
import { getRedis } from '@/config/redis';
import { getSocketServer } from '@/socket/server';
import { YouTubeClient } from '@/integrations/youtube/youtube.client';
import { YoutubeDownloadRepository } from '@/repositories/youtube-download.repository';

interface DownloadJobData {
  downloadId: string;
  userId: string;
  url: string;
  metadata: {
    id: string;
    title: string;
    channel: string;
    duration: number;
    thumbnail: string;
  };
  quality: string;
  format: string;
}

export class YouTubeDownloadProcessor {
  private worker: Worker<DownloadJobData>;
  private youtubeClient: YouTubeClient;
  private youtubeDownloadRepo: YoutubeDownloadRepository;
  private downloadPath: string;

  constructor() {
    this.youtubeClient = new YouTubeClient();
    this.youtubeDownloadRepo = new YoutubeDownloadRepository();
    this.downloadPath = process.env.DOWNLOAD_PATH || '/var/lib/medianest/downloads';

    const redis = getRedis();

    this.worker = new Worker<DownloadJobData>(
      'youtube-downloads',
      this.processDownload.bind(this),
      {
        connection: {
          host: redis.options.host,
          port: redis.options.port as number,
          password: redis.options.password,
        },
        concurrency: 3, // Process up to 3 downloads simultaneously
        limiter: {
          max: 5,
          duration: 60000, // Max 5 jobs per minute
        },
      },
    );

    this.setupEventHandlers();
  }

  /**
   * Main job processing function
   */
  private async processDownload(job: Job<DownloadJobData>): Promise<void> {
    const { downloadId, userId, url, metadata, quality, format } = job.data;
    const io = getSocketServer();

    logger.info('Starting YouTube download', {
      jobId: job.id,
      downloadId,
      userId,
      videoId: metadata.id,
      title: metadata.title,
    });

    try {
      // Update status to downloading
      await this.youtubeDownloadRepo.updateStatus(downloadId, 'downloading');

      // Emit start event
      io.to(userId).emit('youtube:started', {
        downloadId,
        title: metadata.title,
      });

      // Ensure user download directory exists
      const userDir = path.join(this.downloadPath, userId);
      await fs.mkdir(userDir, { recursive: true });

      // Generate safe filename
      const safeTitle = this.sanitizeFilename(metadata.title);
      const timestamp = Date.now();
      const filename = `${safeTitle}_${metadata.id}_${timestamp}.${format}`;
      const outputPath = path.join(userDir, filename);

      // Download with progress tracking
      const result = await this.youtubeClient.downloadVideo(
        url,
        outputPath,
        quality,
        format,
        async (progress) => {
          // Update job progress
          await job.updateProgress(progress);

          // Emit progress event (throttled)
          if (Math.floor(progress) % 5 === 0) {
            io.to(userId).emit('youtube:progress', {
              downloadId,
              progress: Math.floor(progress),
              status: 'downloading',
            });
          }
        },
      );

      // Update download record with file information
      await this.youtubeDownloadRepo.update(downloadId, {
        status: 'completed',
        completedAt: new Date(),
        filePaths: {
          jobId: job.id,
          files: [
            {
              path: result.filePath,
              size: result.fileSize,
              filename,
            },
          ],
          totalSize: result.fileSize,
          quality,
          format,
          duration: metadata.duration,
        },
      });

      // Emit completion event
      io.to(userId).emit('youtube:completed', {
        downloadId,
        filePath: filename,
        fileSize: result.fileSize,
      });

      logger.info('YouTube download completed', {
        jobId: job.id,
        downloadId,
        userId,
        videoId: metadata.id,
        fileSize: result.fileSize,
      });

      // Clean up old downloads if needed
      await this.cleanupOldDownloads(userId);
    } catch (error: any) {
      logger.error('YouTube download failed', {
        jobId: job.id,
        downloadId,
        userId,
        error: error.message,
      });

      // Update status to failed
      await this.youtubeDownloadRepo.update(downloadId, {
        status: 'failed',
        filePaths: {
          jobId: job.id,
          error: error.message,
          quality,
          format,
        },
      });

      // Emit failure event
      io.to(userId).emit('youtube:failed', {
        downloadId,
        error: error.message,
      });

      // Re-throw to mark job as failed
      throw error;
    }
  }

  /**
   * Setup worker event handlers
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      logger.info('YouTube download job completed', {
        jobId: job.id,
        downloadId: job.data.downloadId,
      });
    });

    this.worker.on('failed', (job, err) => {
      logger.error('YouTube download job failed', {
        jobId: job?.id,
        downloadId: job?.data.downloadId,
        error: err.message,
      });
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn('YouTube download job stalled', { jobId });
    });

    this.worker.on('error', (err) => {
      logger.error('YouTube download worker error', { error: err.message });
    });
  }

  /**
   * Sanitize filename for safe filesystem storage
   */
  private sanitizeFilename(title: string): string {
    return title
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 100); // Limit length
  }

  /**
   * Clean up old downloads to manage disk space
   */
  private async cleanupOldDownloads(userId: string): Promise<void> {
    try {
      const userDir = path.join(this.downloadPath, userId);
      const files = await fs.readdir(userDir);

      // Get file stats
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(userDir, file);
          const stats = await fs.stat(filePath);
          return { file, filePath, mtime: stats.mtime, size: stats.size };
        }),
      );

      // Sort by modification time (oldest first)
      fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

      // Calculate total size
      const totalSize = fileStats.reduce((sum, file) => sum + file.size, 0);
      const maxUserStorage = 10 * 1024 * 1024 * 1024; // 10GB per user

      // Remove old files if over limit
      let currentSize = totalSize;
      for (const fileInfo of fileStats) {
        if (currentSize <= maxUserStorage) break;

        try {
          await fs.unlink(fileInfo.filePath);
          currentSize -= fileInfo.size;
          logger.info('Cleaned up old download', {
            userId,
            file: fileInfo.file,
            size: fileInfo.size,
          });
        } catch (err) {
          logger.error('Failed to delete old download', {
            userId,
            file: fileInfo.file,
            error: err,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old downloads', { userId, error });
    }
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    logger.info('YouTube download processor started');
  }

  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    await this.worker.close();
    logger.info('YouTube download processor stopped');
  }
}
