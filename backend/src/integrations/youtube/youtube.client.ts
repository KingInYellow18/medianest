import { spawn } from 'child_process';
import { promisify } from 'util';

import { BaseServiceClient } from '@/integrations/base.client';
import { logger } from '@/utils/logger';

const execFile = promisify(require('child_process').execFile);

export interface YouTubeVideoInfo {
  id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  description: string;
  uploadDate: string;
  viewCount: number;
  formats: Array<{
    formatId: string;
    ext: string;
    quality: string;
    height?: number;
    width?: number;
    filesize?: number;
    vcodec?: string;
    acodec?: string;
    fps?: number;
    tbr?: number;
  }>;
}

export class YouTubeClient extends BaseServiceClient {
  private ytDlpPath: string;

  constructor() {
    super({
      name: 'YouTube',
      baseURL: 'https://www.youtube.com',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
    });

    // Use yt-dlp binary path from environment or default
    this.ytDlpPath = process.env.YT_DLP_PATH || 'yt-dlp';
  }

  /**
   * Validate YouTube URL format
   */
  validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const validHosts = ['www.youtube.com', 'youtube.com', 'youtu.be', 'm.youtube.com'];

      if (!validHosts.includes(urlObj.hostname)) {
        return false;
      }

      // Check for video ID
      if (urlObj.hostname === 'youtu.be') {
        return urlObj.pathname.length > 1;
      } else {
        return urlObj.searchParams.has('v') || urlObj.pathname.includes('/watch');
      }
    } catch {
      return false;
    }
  }

  /**
   * Get video information without downloading
   */
  async getVideoInfo(url: string): Promise<YouTubeVideoInfo> {
    return this.executeWithCircuitBreaker(async () => {
      try {
        const args = [
          '--dump-json',
          '--no-playlist',
          '--no-warnings',
          '--quiet',
          '--no-progress',
          '--format',
          'best',
          url,
        ];

        const { stdout } = await execFile(this.ytDlpPath, args, {
          timeout: 30000,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });

        const data = JSON.parse(stdout);

        // Transform yt-dlp output to our format
        return {
          id: data.id,
          title: data.title || 'Unknown Title',
          channel: data.uploader || data.channel || 'Unknown Channel',
          duration: data.duration || 0,
          thumbnail: this.selectBestThumbnail(data.thumbnails) || data.thumbnail || '',
          description: data.description || '',
          uploadDate: data.upload_date || '',
          viewCount: data.view_count || 0,
          formats: this.transformFormats(data.formats || []),
        };
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string };

        if (err.code === 'ENOENT') {
          logger.error('yt-dlp not found. Please install yt-dlp.');
          throw new Error('YouTube downloader not configured');
        }

        if (err.message?.includes('Video unavailable')) {
          throw new Error('Video not found or unavailable');
        }

        if (err.message?.includes('Private video')) {
          throw new Error('This video is private');
        }

        if (err.message?.includes('age-restricted')) {
          throw new Error('This video is age-restricted');
        }

        logger.error('Failed to get video info', {
          url,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new Error('Failed to fetch video information');
      }
    });
  }

  /**
   * Download video with progress tracking
   */
  async downloadVideo(
    url: string,
    outputPath: string,
    quality: string = 'best',
    format: string = 'mp4',
    onProgress?: (progress: number) => void,
  ): Promise<{ filePath: string; fileSize: number }> {
    return new Promise((resolve, reject) => {
      const args = [
        '--no-playlist',
        '--no-warnings',
        '--newline',
        '--progress',
        '--format',
        this.buildFormatString(quality, format),
        '--merge-output-format',
        format,
        '--output',
        outputPath,
        url,
      ];

      const process = spawn(this.ytDlpPath, args);
      let lastProgress = 0;

      process.stdout.on('data', (data) => {
        const output = data.toString();

        // Parse progress from yt-dlp output
        const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (progressMatch && onProgress) {
          const progress = parseFloat(progressMatch[1]);
          if (progress > lastProgress) {
            lastProgress = progress;
            onProgress(progress);
          }
        }
      });

      process.stderr.on('data', (data) => {
        const error = data.toString();
        logger.warn('yt-dlp stderr', { error });
      });

      process.on('close', (code) => {
        if (code === 0) {
          // Get file size
          const fs = require('fs');
          try {
            const stats = fs.statSync(outputPath);
            resolve({
              filePath: outputPath,
              fileSize: stats.size,
            });
          } catch (err) {
            reject(new Error('Downloaded file not found'));
          }
        } else {
          reject(new Error(`Download failed with code ${code}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Build format string for yt-dlp
   */
  private buildFormatString(quality: string, _format: string): string {
    if (quality === 'best') {
      return 'bestvideo+bestaudio/best';
    }

    const height = quality.replace('p', '');
    return `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
  }

  /**
   * Select best thumbnail from available options
   */
  private selectBestThumbnail(thumbnails?: Array<Record<string, unknown>>): string | null {
    if (!thumbnails || thumbnails.length === 0) {
      return null;
    }

    // Define thumbnail interface for type safety
    interface Thumbnail {
      id?: string;
      url?: string;
      width?: number;
      height?: number;
    }

    const validThumbnails = thumbnails as Thumbnail[];

    // Prefer maxresdefault
    const maxres = validThumbnails.find(
      (t) => t.id === 'maxresdefault' || t.url?.includes('maxresdefault'),
    );
    if (maxres) return maxres.url || null;

    // Sort by resolution and return highest
    const sorted = validThumbnails
      .filter((t) => t.width && t.height)
      .sort((a, b) => b.width! * b.height! - a.width! * a.height!);

    return sorted[0]?.url || validThumbnails[0]?.url || null;
  }

  /**
   * Transform yt-dlp formats to our format
   */
  private transformFormats(formats: Array<Record<string, unknown>>): YouTubeVideoInfo['formats'] {
    interface YtDlpFormat {
      format_id: string;
      ext: string;
      quality_label?: string;
      height?: number;
      width?: number;
      filesize?: number;
      filesize_approx?: number;
      vcodec?: string;
      acodec?: string;
      fps?: number;
      tbr?: number;
    }

    const validFormats = formats as unknown as YtDlpFormat[];

    return validFormats
      .filter((f) => f.vcodec !== 'none' || f.acodec !== 'none')
      .map((f) => ({
        formatId: f.format_id,
        ext: f.ext,
        quality: f.quality_label || (f.height ? `${f.height}p` : 'unknown'),
        height: f.height,
        width: f.width,
        filesize: f.filesize || f.filesize_approx,
        vcodec: f.vcodec,
        acodec: f.acodec,
        fps: f.fps,
        tbr: f.tbr,
      }))
      .sort((a, b) => (b.height || 0) - (a.height || 0));
  }

  /**
   * Check if yt-dlp is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      await execFile(this.ytDlpPath, ['--version'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update yt-dlp to latest version
   */
  async updateYtDlp(): Promise<void> {
    try {
      await execFile(this.ytDlpPath, ['-U'], { timeout: 60000 });
      logger.info('yt-dlp updated successfully');
    } catch (error: unknown) {
      logger.error('Failed to update yt-dlp', { error });
      throw new Error('Failed to update YouTube downloader');
    }
  }
}
