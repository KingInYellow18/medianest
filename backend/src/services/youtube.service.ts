// @ts-nocheck
// @ts-ignore
import {
  BadRequestError,
  NotFoundError, // @ts-ignore
} from '@medianest/shared';

import { CatchError } from '../types/common';

import { getRedis } from '@/config/redis';
import { YouTubeClient } from '@/integrations/youtube/youtube.client';
import { YoutubeDownloadRepository } from '@/repositories/youtube-download.repository';
import { logger } from '@/utils/logger';

export interface VideoMetadata {
  id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  description: string;
  uploadDate: string;
  viewCount: number;
  formats?: Array<{
    quality: string;
    ext: string;
    filesize?: number;
  }>;
}

export class YouTubeService {
  private youtubeClient: YouTubeClient;
  private youtubeDownloadRepo: YoutubeDownloadRepository;
  private redis: ReturnType<typeof getRedis>;

  constructor() {
    this.youtubeClient = new YouTubeClient();
    this.youtubeDownloadRepo = new YoutubeDownloadRepository();
    this.redis = getRedis();
  }

  /**
   * Get video metadata from YouTube
   */
  async getVideoMetadata(url: string): Promise<VideoMetadata> {
    try {
      // Validate URL format
      if (!this.youtubeClient.validateUrl(url)) {
        throw new BadRequestError('Invalid YouTube URL');
      }

      // Check cache first
      const cacheKey = `youtube:metadata:${this.extractVideoId(url)}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        logger.debug('YouTube metadata cache hit', { url });
        return JSON.parse(cached);
      }

      // Fetch from YouTube
      const metadata = await this.youtubeClient.getVideoInfo(url);
      if (!metadata) {
        throw new NotFoundError('Video not found');
      }

      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(metadata));

      return metadata;
    } catch (error: CatchError) {
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to get YouTube metadata', { url, error });
      throw new BadRequestError('Failed to fetch video information');
    }
  }

  /**
   * Check if user has an active download for the same video
   */
  async checkDuplicateDownload(userId: string, url: string): Promise<boolean> {
    const videoId = this.extractVideoId(url);
    if (!videoId) return false;

    const activeDownloads = await this.youtubeDownloadRepo.findByFilters({
      userId,
      status: 'queued',
    });

    // Check if any active download has the same video ID
    return activeDownloads.items.some((download) => {
      return download.playlistUrl.includes(videoId);
    });
  }

  /**
   * Get user's download count in the last hour (for rate limiting)
   */
  async getUserDownloadsInLastHour(userId: string): Promise<number> {
    return this.youtubeDownloadRepo.getUserDownloadsInPeriod(userId, 1);
  }

  /**
   * Extract video ID from YouTube URL
   */
  private extractVideoId(url: string): string | null {
    try {
      const urlObj = new URL(url);

      // Handle youtube.com URLs
      if (urlObj.hostname.includes('youtube.com')) {
        return urlObj.searchParams.get('v');
      }

      // Handle youtu.be URLs
      if (urlObj.hostname === 'youtu.be') {
        return urlObj.pathname.slice(1);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Calculate optimal quality based on user preferences and available formats
   */
  async selectOptimalQuality(
    formats: unknown[],
    requestedQuality: string,
  ): Promise<{ format: any; quality: string }> {
    if (!formats || formats.length === 0) {
      throw new BadRequestError('No formats available for this video');
    }

    // Sort formats by quality (height)
    const sortedFormats = formats
      .filter((f) => f.vcodec !== 'none' && f.acodec !== 'none') // Only formats with both video and audio
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    if (sortedFormats.length === 0) {
      throw new BadRequestError('No suitable formats found');
    }

    // If 'best' is requested, return the highest quality
    if (requestedQuality === 'best') {
      return {
        format: sortedFormats[0],
        quality: `${sortedFormats[0].height}p`,
      };
    }

    // Try to find exact match
    const requestedHeight = parseInt(requestedQuality.replace('p', ''), 10);
    const exactMatch = sortedFormats.find((f) => f.height === requestedHeight);
    if (exactMatch) {
      return {
        format: exactMatch,
        quality: requestedQuality,
      };
    }

    // Find closest lower quality
    const lowerQuality = sortedFormats.find((f) => f.height < requestedHeight);
    if (lowerQuality) {
      return {
        format: lowerQuality,
        quality: `${lowerQuality.height}p`,
      };
    }

    // Return best available if no lower quality found
    return {
      format: sortedFormats[0],
      quality: `${sortedFormats[0].height}p`,
    };
  }

  /**
   * Validate download parameters
   */
  validateDownloadParams(quality: string, format: string): void {
    const validQualities = ['best', '2160p', '1440p', '1080p', '720p', '480p', '360p'];
    const validFormats = ['mp4', 'webm', 'mkv'];

    if (!validQualities.includes(quality)) {
      throw new BadRequestError(`Invalid quality. Valid options: ${validQualities.join(', ')}`);
    }

    if (!validFormats.includes(format)) {
      throw new BadRequestError(`Invalid format. Valid options: ${validFormats.join(', ')}`);
    }
  }

  /**
   * Get download statistics for a user
   */
  async getUserDownloadStats(userId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
    downloading: number;
    cancelled: number;
    totalSize: number;
    totalDuration: number;
  }> {
    const stats = await this.youtubeDownloadRepo.getUserDownloadStats(userId);
    const downloads = await this.youtubeDownloadRepo.findByUser(userId, { limit: 1000 });

    let totalSize = 0;
    let totalDuration = 0;

    downloads.items.forEach((download) => {
      const filePaths = download.filePaths as any;
      if (filePaths?.totalSize) {
        totalSize += filePaths.totalSize;
      }
      if (filePaths?.duration) {
        totalDuration += filePaths.duration;
      }
    });

    return {
      total: downloads.total,
      completed: stats['completed'] || 0,
      failed: stats['failed'] || 0,
      pending: stats['queued'] || 0,
      downloading: stats['downloading'] || 0,
      cancelled: stats['cancelled'] || 0,
      totalSize,
      totalDuration,
    };
  }
}
