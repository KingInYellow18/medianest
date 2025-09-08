import { Request, Response, NextFunction } from 'express';

// @ts-ignore
import { BadRequestError, NotFoundError, ConflictError } from '@medianest/shared';

import { logger } from '@/utils/logger';
import { youtubeQueue } from '@/config/queues';
import { getSocketServer } from '@/socket/server';
import { YouTubeService } from '@/services/youtube.service';
import { YoutubeDownloadRepository } from '@/repositories/youtube-download.repository';
import { CatchError } from '../types/common';
import {
  createDownloadSchema,
  getDownloadSchema,
  getMetadataSchema,
} from '@/validations/youtube.validation';

export class YouTubeController {
  private youtubeService: YouTubeService;
  private youtubeDownloadRepo: YoutubeDownloadRepository;

  constructor() {
    this.youtubeService = new YouTubeService();
    this.youtubeDownloadRepo = new YoutubeDownloadRepository({} as any);
  }

  /**
   * Create a new download job
   * POST /api/v1/youtube/download
   */
  createDownload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      // Validate request
      const validation = createDownloadSchema.safeParse({ body: req.body });
      if (!validation.success) {
        throw new BadRequestError('Invalid request', validation.error.errors);
      }

      const { url, quality = '1080p', format = 'mp4' } = validation.data.body;

      // Rate limiting check (5 downloads per hour)
      const recentDownloads = await this.youtubeService.getUserDownloadsInLastHour(userId);
      if (recentDownloads >= 5) {
        res.setHeader('X-RateLimit-Limit', '5');
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 3600000).toISOString());
        res.setHeader('Retry-After', '3600');
        return res.status(429).json({
          error: 'Download rate limit exceeded',
          limit: 5,
          window: '1 hour',
          retryAfter: 3600,
        });
      }

      // Check for duplicate active downloads
      const isDuplicate = await this.youtubeService.checkDuplicateDownload(userId, url);
      if (isDuplicate) {
        throw new ConflictError('Video already downloading or queued');
      }

      // Fetch video metadata
      const metadata = await this.youtubeService.getVideoMetadata(url);

      // Create download record
      const download = await this.youtubeDownloadRepo.create({
        userId,
        playlistUrl: url,
        playlistTitle: metadata.title,
      });

      // Add to download queue
      const job = await youtubeQueue.add(
        'download-video',
        {
          downloadId: download.id,
          userId,
          url,
          metadata,
          quality,
          format,
        },
        {
          priority: 1,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        }
      );

      // Update download with job ID
      await this.youtubeDownloadRepo.update(download.id, {
        filePaths: { jobId: job.id },
      });

      // Emit creation event via WebSocket
      const io = getSocketServer();
      io.to(userId).emit('youtube:created', {
        downloadId: download.id,
        title: metadata.title,
        thumbnail: metadata.thumbnail,
        duration: metadata.duration,
        status: 'queued',
      });

      logger.info('YouTube download created', {
        downloadId: download.id,
        userId,
        videoId: metadata.id,
        title: metadata.title,
      });

      res.status(201).json({
        id: download.id,
        videoId: metadata.id,
        title: metadata.title,
        channel: metadata.channel,
        duration: metadata.duration,
        thumbnail: metadata.thumbnail,
        status: 'queued',
        progress: 0,
        jobId: job.id,
        quality,
        format,
        userId,
        createdAt: download.createdAt,
      });
    } catch (error: CatchError) {
      next(error);
    }
  };

  /**
   * Get user's download history
   * GET /api/v1/youtube/downloads
   */
  getDownloads = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { page = 1, limit = 20, status } = req.query;

      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = Math.min(parseInt(limit as string, 10) || 20, 100);

      const filters = {
        userId,
        ...(status && { status: status as string }),
      };

      const result = await this.youtubeDownloadRepo.findByFilters(filters, {
        page: pageNum,
        limit: limitNum,
        orderBy: { createdAt: 'desc' },
      });

      // Transform downloads to include additional fields
      const downloads = await Promise.all(
        result.items.map(async (download) => {
          const filePaths = download.filePaths as any;
          const jobId = filePaths?.jobId;

          // Get job progress if downloading
          let progress = 0;
          if (jobId && download.status === 'downloading') {
            const job = await youtubeQueue.getJob(jobId);
            if (job && job.progress) {
              progress = Number(job.progress) || 0;
            }
          }

          return {
            id: download.id,
            url: download.playlistUrl,
            title: download.playlistTitle || 'Unknown',
            status: download.status,
            progress,
            filePaths: filePaths?.files || [],
            fileSize: filePaths?.totalSize || 0,
            quality: filePaths?.quality || 'unknown',
            format: filePaths?.format || 'unknown',
            error: filePaths?.error || null,
            createdAt: download.createdAt,
            completedAt: download.completedAt,
          };
        })
      );

      res.json({
        downloads,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (error: CatchError) {
      next(error);
    }
  };

  /**
   * Get specific download details
   * GET /api/v1/youtube/downloads/:id
   */
  getDownload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      // Validate params
      const validation = getDownloadSchema.safeParse({ params: req.params });
      if (!validation.success) {
        throw new BadRequestError('Invalid download ID');
      }

      const { id } = validation.data.params;

      const download = await this.youtubeDownloadRepo.findById(id);
      if (!download || download.userId !== userId) {
        throw new NotFoundError('Download not found');
      }

      const filePaths = download.filePaths as any;
      const jobId = filePaths?.jobId;

      // Get current job status and progress
      let jobDetails = null;
      if (jobId) {
        const job = await youtubeQueue.getJob(jobId);
        if (job) {
          jobDetails = {
            progress: Number(job.progress) || 0,
            attemptsMade: job.attemptsMade,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason || '',
          } as any;
        }
      }

      res.json({
        id: download.id,
        url: download.playlistUrl,
        title: download.playlistTitle || 'Unknown',
        status: download.status,
        progress: (jobDetails as any)?.progress || 0,
        filePaths: filePaths?.files || [],
        fileSize: filePaths?.totalSize || 0,
        quality: filePaths?.quality || 'unknown',
        format: filePaths?.format || 'unknown',
        error: filePaths?.error || jobDetails?.failedReason || null,
        jobId,
        jobDetails,
        createdAt: download.createdAt,
        completedAt: download.completedAt,
      });
    } catch (error: CatchError) {
      next(error);
    }
  };

  /**
   * Cancel/delete a download
   * DELETE /api/v1/youtube/downloads/:id
   */
  deleteDownload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      // Validate params
      const validation = getDownloadSchema.safeParse({ params: req.params });
      if (!validation.success) {
        throw new BadRequestError('Invalid download ID');
      }

      const { id } = validation.data.params;

      const download = await this.youtubeDownloadRepo.findById(id);
      if (!download || download.userId !== userId) {
        throw new NotFoundError('Download not found');
      }

      // Check if download can be cancelled
      if (download.status === 'completed') {
        throw new BadRequestError('Cannot cancel completed download');
      }

      // Cancel job if exists
      const filePaths = download.filePaths as any;
      if (filePaths?.jobId) {
        const job = await youtubeQueue.getJob(filePaths.jobId);
        if (job && ['waiting', 'active', 'delayed'].includes(await job.getState())) {
          await job.remove();
        }
      }

      // Update status to cancelled
      await this.youtubeDownloadRepo.updateStatus(id, 'cancelled');

      // Emit cancellation event
      const io = getSocketServer();
      io.to(userId).emit('youtube:cancelled', {
        downloadId: id,
      });

      logger.info('YouTube download cancelled', {
        downloadId: id,
        userId,
      });

      res.json({
        message: 'Download cancelled successfully',
      });
    } catch (error: CatchError) {
      next(error);
    }
  };

  /**
   * Get video metadata without downloading
   * GET /api/v1/youtube/metadata
   */
  getMetadata = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate query
      const validation = getMetadataSchema.safeParse({ query: req.query });
      if (!validation.success) {
        throw new BadRequestError('Invalid request', validation.error.errors);
      }

      const { url } = validation.data.query;

      const metadata = await this.youtubeService.getVideoMetadata(url);

      res.json({
        id: metadata.id,
        title: metadata.title,
        channel: metadata.channel,
        duration: metadata.duration,
        thumbnail: metadata.thumbnail,
        description: metadata.description,
        uploadDate: metadata.uploadDate,
        viewCount: metadata.viewCount,
        availableQualities: metadata.formats?.map((f: any) => f.quality) || [],
      });
    } catch (error: CatchError) {
      next(error);
    }
  };
}
