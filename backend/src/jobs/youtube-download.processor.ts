import fs from 'fs/promises';
import path from 'path';

import { Worker, Job } from 'bullmq';

import { CatchError } from '../types/common';

import { config } from '@/config';
import { getRedis } from '@/config/redis';
import { YouTubeClient } from '@/integrations/youtube/youtube.client';
import { youtubeDownloadRepository } from '@/repositories/instances';
import { plexService } from '@/services/plex.service';
import { getSocketServer } from '@/socket/server';
import { logger } from '@/utils/logger';

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
  private youtubeDownloadRepo: typeof youtubeDownloadRepository;
  private downloadPath: string;

  constructor() {
    this.youtubeClient = new YouTubeClient();
    this.youtubeDownloadRepo = youtubeDownloadRepository;
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

      // Create metadata files for Plex
      await this.createPlexMetadata(outputPath, metadata);

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

      // Trigger Plex library scan
      await this.triggerPlexScan(userId, userDir);

      // Clean up old downloads if needed
      await this.cleanupOldDownloads(userId);
    } catch (error: CatchError) {
      logger.error('YouTube download failed', {
        jobId: job.id,
        downloadId,
        userId,
        error: error instanceof Error ? error.message : ('Unknown error' as any),
      });

      // Update status to failed
      await this.youtubeDownloadRepo.update(downloadId, {
        status: 'failed',
        filePaths: {
          jobId: job.id,
          error: error instanceof Error ? error.message : ('Unknown error' as any),
          quality,
          format,
        },
      });

      // Emit failure event
      io.to(userId).emit('youtube:failed', {
        downloadId,
        error: error instanceof Error ? error.message : ('Unknown error' as any),
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
   * Create metadata files for Plex to better identify YouTube content
   */
  private async createPlexMetadata(
    videoPath: string,
    metadata: DownloadJobData['metadata'],
  ): Promise<void> {
    try {
      // Create NFO file for Plex
      const nfoPath = videoPath.replace(/\.[^/.]+$/, '.nfo');
      const nfoContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<movie>
  <title>${this.escapeXml(metadata.title)}</title>
  <originaltitle>${this.escapeXml(metadata.title)}</originaltitle>
  <studio>${this.escapeXml(metadata.channel)}</studio>
  <plot>YouTube video from ${this.escapeXml(metadata.channel)}</plot>
  <runtime>${Math.floor(metadata.duration / 60)}</runtime>
  <thumb>${this.escapeXml(metadata.thumbnail)}</thumb>
  <genre>YouTube</genre>
  <tag>YouTube</tag>
  <tag>${this.escapeXml(metadata.channel)}</tag>
  <uniqueid type="youtube" default="true">${metadata.id}</uniqueid>
</movie>`;

      await fs.writeFile(nfoPath, nfoContent, 'utf-8');
      logger.debug('Created NFO file for Plex', { nfoPath });

      // Download thumbnail if available
      if (metadata.thumbnail) {
        try {
          const thumbPath = videoPath.replace(/\.[^/.]+$/, '-thumb.jpg');
          const response = await fetch(metadata.thumbnail);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            await fs.writeFile(thumbPath, Buffer.from(buffer));
            logger.debug('Downloaded thumbnail for Plex', { thumbPath });
          }
        } catch (error: CatchError) {
          logger.warn('Failed to download thumbnail', {
            videoId: metadata.id,
            error: error instanceof Error ? error.message : ('Unknown error' as any),
          });
        }
      }
    } catch (error: CatchError) {
      logger.error('Failed to create Plex metadata', {
        videoPath,
        error: error instanceof Error ? error.message : ('Unknown error' as any),
      });
    }
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Trigger Plex library scan for downloaded content
   */
  private async triggerPlexScan(userId: string, userDir: string): Promise<void> {
    try {
      // Find the YouTube library in Plex
      const youtubeLibraryKey = await plexService.findYouTubeLibrary(userId);

      if (!youtubeLibraryKey) {
        logger.warn('No YouTube library found in Plex for user', { userId });
        return;
      }

      // Convert download path to Plex-accessible path
      // This assumes the download path is mounted in the same location in Plex
      const plexPath = userDir.replace(
        this.downloadPath,
        config.PLEX_YOUTUBE_LIBRARY_PATH || '/data/youtube',
      );

      // Trigger targeted scan for the user's directory
      await plexService.scanDirectory(userId, youtubeLibraryKey, plexPath);

      logger.info('Plex library scan triggered', {
        userId,
        libraryKey: youtubeLibraryKey,
        path: plexPath,
      });
    } catch (error: CatchError) {
      // Don't fail the job if Plex scan fails
      logger.error('Failed to trigger Plex scan', {
        userId,
        error: error instanceof Error ? error.message : ('Unknown error' as any),
      });
    }
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
    } catch (error: CatchError) {
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
