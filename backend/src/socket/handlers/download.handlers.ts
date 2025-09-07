// @ts-nocheck
import { Server, Socket } from 'socket.io';
import { logger } from '@/utils/logger';
import { youtubeQueue } from '@/config/queues';
import { YoutubeDownloadRepository } from '@/repositories/youtube-download.repository';
import { CatchError } from '../../types/common';

interface DownloadProgress {
  downloadId: string;
  progress: number;
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed';
  speed?: string;
  eta?: string;
  fileSize?: number;
  downloadedBytes?: number;
  error?: string;
  metadata?: {
    title?: string;
    duration?: number;
    quality?: string;
    format?: string;
  };
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export function registerDownloadHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.user?.id;

  if (!userId) {
    logger.warn('Download handlers registered for unauthenticated socket');
    return;
  }

  logger.debug('Registering download handlers for user', { userId });

  // Subscribe to user's download progress
  socket.on('downloads:subscribe', (callback) => {
    socket.join(`downloads:user:${userId}`);
    socket.join('downloads:global'); // For system-wide announcements

    logger.debug('User subscribed to download updates', { userId });

    if (callback) {
      callback({ success: true });
    }
  });

  // Unsubscribe from download progress
  socket.on('downloads:unsubscribe', (callback) => {
    socket.leave(`downloads:user:${userId}`);
    socket.leave('downloads:global');

    logger.debug('User unsubscribed from download updates', { userId });

    if (callback) {
      callback({ success: true });
    }
  });

  // Get current download queue status for user
  socket.on('downloads:queue:status', async (callback) => {
    try {
      const waiting = await youtubeQueue.getWaiting();
      const active = await youtubeQueue.getActive();
      const completed = await youtubeQueue.getCompleted();
      const failed = await youtubeQueue.getFailed();

      // Filter by user ID
      const userJobs = {
        waiting: waiting.filter((job) => job.data.userId === userId).length,
        active: active.filter((job) => job.data.userId === userId).length,
        completed: completed.filter((job) => job.data.userId === userId).slice(0, 10), // Last 10
        failed: failed.filter((job) => job.data.userId === userId).slice(0, 5), // Last 5 failures
      };

      const stats: QueueStats = {
        waiting: userJobs.waiting,
        active: userJobs.active,
        completed: userJobs.completed.length,
        failed: userJobs.failed.length,
        delayed: 0,
        paused: 0,
      };

      if (callback) {
        callback({
          success: true,
          data: {
            stats,
            recentCompleted: userJobs.completed.map((job) => ({
              id: job.id,
              downloadId: job.data.downloadId,
              title: job.data.metadata?.title,
              completedAt: job.finishedOn,
            })),
            recentFailed: userJobs.failed.map((job) => ({
              id: job.id,
              downloadId: job.data.downloadId,
              title: job.data.metadata?.title,
              error: job.failedReason,
              failedAt: job.processedOn,
            })),
          },
        });
      }
    } catch (error: CatchError) {
      logger.error('Failed to get download queue status', {
        userId,
        error: error instanceof Error ? error.message : ('Unknown error' as any),
      });

      if (callback) {
        callback({
          success: false,
          error: error instanceof Error ? error.message : ('Unknown error' as any),
        });
      }
    }
  });

  // Get specific download status
  socket.on('downloads:status', async (downloadId: string, callback) => {
    try {
      if (!downloadId) {
        if (callback) {
          callback({ success: false, error: 'Download ID is required' });
        }
        return;
      }

      // Try to find the job in the queue
      const job = await youtubeQueue.getJob(downloadId);

      let downloadStatus: DownloadProgress;

      if (job) {
        // Job exists in queue
        const state = await job.getState();
        const progress = job.progress || 0;

        // Check if job belongs to user
        if (job.data.userId !== userId) {
          if (callback) {
            callback({ success: false, error: 'Unauthorized' });
          }
          return;
        }

        downloadStatus = {
          downloadId,
          progress: typeof progress === 'number' ? progress : 0,
          status:
            state === 'waiting'
              ? 'pending'
              : state === 'active'
              ? 'downloading'
              : state === 'completed'
              ? 'completed'
              : 'failed',
          metadata: {
            title: job.data.metadata?.title,
            duration: job.data.metadata?.duration,
            quality: job.data.quality,
            format: job.data.format,
          },
        };

        if (state === 'failed') {
          downloadStatus.error = job.failedReason;
        }
      } else {
        // Job not in queue, check database
        const repo = new YoutubeDownloadRepository();
        const download = await repo.findByIdAndUserId(downloadId, userId);

        if (!download) {
          if (callback) {
            callback({ success: false, error: 'Download not found' });
          }
          return;
        }

        downloadStatus = {
          downloadId,
          progress: download.status === 'completed' ? 100 : 0,
          status: download.status as any,
          error: download.filePaths?.error as string,
          metadata: {
            title: download.metadata?.title as string,
            duration: download.metadata?.duration as number,
            quality: download.filePaths?.quality as string,
            format: download.filePaths?.format as string,
          },
        };
      }

      if (callback) {
        callback({ success: true, data: downloadStatus });
      }
    } catch (error: CatchError) {
      logger.error('Failed to get download status', {
        userId,
        downloadId,
        error: error instanceof Error ? error.message : ('Unknown error' as any),
      });

      if (callback) {
        callback({
          success: false,
          error: error instanceof Error ? error.message : ('Unknown error' as any),
        });
      }
    }
  });

  // Cancel a download
  socket.on('downloads:cancel', async (downloadId: string, callback) => {
    try {
      if (!downloadId) {
        if (callback) {
          callback({ success: false, error: 'Download ID is required' });
        }
        return;
      }

      const job = await youtubeQueue.getJob(downloadId);

      if (!job) {
        if (callback) {
          callback({ success: false, error: 'Download not found' });
        }
        return;
      }

      // Check if job belongs to user
      if (job.data.userId !== userId) {
        if (callback) {
          callback({ success: false, error: 'Unauthorized' });
        }
        return;
      }

      const state = await job.getState();
      if (['completed', 'failed'].includes(state)) {
        if (callback) {
          callback({ success: false, error: 'Cannot cancel finished download' });
        }
        return;
      }

      await job.remove();

      // Emit cancellation event
      io.to(`downloads:user:${userId}`).emit('download:cancelled', {
        downloadId,
        timestamp: new Date().toISOString(),
      });

      if (callback) {
        callback({ success: true });
      }

      logger.info('Download cancelled by user', { userId, downloadId });
    } catch (error: CatchError) {
      logger.error('Failed to cancel download', {
        userId,
        downloadId,
        error: error instanceof Error ? error.message : ('Unknown error' as any),
      });

      if (callback) {
        callback({
          success: false,
          error: error instanceof Error ? error.message : ('Unknown error' as any),
        });
      }
    }
  });

  // Retry a failed download
  socket.on('downloads:retry', async (downloadId: string, callback) => {
    try {
      if (!downloadId) {
        if (callback) {
          callback({ success: false, error: 'Download ID is required' });
        }
        return;
      }

      const job = await youtubeQueue.getJob(downloadId);

      if (!job) {
        if (callback) {
          callback({ success: false, error: 'Download not found' });
        }
        return;
      }

      // Check if job belongs to user
      if (job.data.userId !== userId) {
        if (callback) {
          callback({ success: false, error: 'Unauthorized' });
        }
        return;
      }

      const state = await job.getState();
      if (state !== 'failed') {
        if (callback) {
          callback({ success: false, error: 'Can only retry failed downloads' });
        }
        return;
      }

      await job.retry();

      // Emit retry event
      io.to(`downloads:user:${userId}`).emit('download:retrying', {
        downloadId,
        timestamp: new Date().toISOString(),
      });

      if (callback) {
        callback({ success: true });
      }

      logger.info('Download retry requested by user', { userId, downloadId });
    } catch (error: CatchError) {
      logger.error('Failed to retry download', {
        userId,
        downloadId,
        error: error instanceof Error ? error.message : ('Unknown error' as any),
      });

      if (callback) {
        callback({
          success: false,
          error: error instanceof Error ? error.message : ('Unknown error' as any),
        });
      }
    }
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    logger.debug('User disconnected from download handlers', { userId });
  });
}

// Helper function to emit download progress (called from job processor)
export function emitDownloadProgress(
  io: Server,
  userId: string,
  downloadId: string,
  progress: DownloadProgress
): void {
  // Emit to user's download room
  io.of('/downloads').to(`downloads:user:${userId}`).emit('download:progress', progress);

  // Also emit to main namespace for backward compatibility
  io.to(`downloads:user:${userId}`).emit('download:progress', progress);

  // Throttle logging
  const logThreshold = [0, 10, 25, 50, 75, 90, 95, 100];
  if (logThreshold.includes(Math.floor(progress.progress))) {
    logger.debug('Download progress updated', {
      userId,
      downloadId,
      progress: progress.progress,
      status: progress.status,
    });
  }
}

// Helper function to emit download completion
export function emitDownloadComplete(
  io: Server,
  userId: string,
  downloadId: string,
  result: {
    filePath: string;
    fileSize: number;
    metadata?: any;
  }
): void {
  const completeData = {
    downloadId,
    filePath: result.filePath,
    fileSize: result.fileSize,
    metadata: result.metadata,
    timestamp: new Date().toISOString(),
  };

  // Emit to user's download room
  io.of('/downloads').to(`downloads:user:${userId}`).emit('download:completed', completeData);

  // Also emit to main namespace for backward compatibility
  io.to(`downloads:user:${userId}`).emit('download:completed', completeData);

  logger.info('Download completed and notification sent', {
    userId,
    downloadId,
    fileSize: result.fileSize,
  });
}

// Helper function to emit download failure
export function emitDownloadFailure(
  io: Server,
  userId: string,
  downloadId: string,
  error: string
): void {
  const failureData = {
    downloadId,
    error,
    timestamp: new Date().toISOString(),
  };

  // Emit to user's download room
  io.of('/downloads').to(`downloads:user:${userId}`).emit('download:failed', failureData);

  // Also emit to main namespace for backward compatibility
  io.to(`downloads:user:${userId}`).emit('download:failed', failureData);

  logger.warn('Download failed and notification sent', {
    userId,
    downloadId,
    error,
  });
}
