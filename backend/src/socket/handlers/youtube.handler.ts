import { Server, Socket } from 'socket.io';

import { logger } from '@/utils/logger';
import { youtubeQueue } from '@/config/queues';

export function registerYouTubeHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.user?.id;

  if (!userId) {
    logger.warn('YouTube handlers registered for unauthenticated socket');
    return;
  }

  // Subscribe to user's YouTube events
  socket.join(`youtube:${userId}`);

  // Get download status
  socket.on('youtube:status', async (downloadId: string, callback) => {
    try {
      // This would typically fetch from the database
      // For now, we'll try to get job status from the queue
      const job = await youtubeQueue.getJob(downloadId);

      if (!job) {
        callback({ error: 'Download not found' });
        return;
      }

      const state = await job.getState();
      const progress = job.progress || 0;

      callback({
        id: downloadId,
        state,
        progress,
        data: job.data,
      });
    } catch (error) {
      logger.error('Failed to get download status', { error, downloadId, userId });
      callback({ error: 'Failed to get status' });
    }
  });

  // Cancel download
  socket.on('youtube:cancel', async (downloadId: string, callback) => {
    try {
      const job = await youtubeQueue.getJob(downloadId);

      if (!job) {
        callback({ error: 'Download not found' });
        return;
      }

      // Check if job belongs to user
      if (job.data.userId !== userId) {
        callback({ error: 'Unauthorized' });
        return;
      }

      const state = await job.getState();
      if (['completed', 'failed'].includes(state)) {
        callback({ error: 'Cannot cancel finished download' });
        return;
      }

      await job.remove();
      callback({ success: true });

      // Emit cancellation to user
      io.to(`youtube:${userId}`).emit('youtube:cancelled', {
        downloadId,
      });
    } catch (error) {
      logger.error('Failed to cancel download', { error, downloadId, userId });
      callback({ error: 'Failed to cancel' });
    }
  });

  // Retry failed download
  socket.on('youtube:retry', async (downloadId: string, callback) => {
    try {
      const job = await youtubeQueue.getJob(downloadId);

      if (!job) {
        callback({ error: 'Download not found' });
        return;
      }

      // Check if job belongs to user
      if (job.data.userId !== userId) {
        callback({ error: 'Unauthorized' });
        return;
      }

      const state = await job.getState();
      if (state !== 'failed') {
        callback({ error: 'Can only retry failed downloads' });
        return;
      }

      await job.retry();
      callback({ success: true });

      // Emit retry event to user
      io.to(`youtube:${userId}`).emit('youtube:retrying', {
        downloadId,
      });
    } catch (error) {
      logger.error('Failed to retry download', { error, downloadId, userId });
      callback({ error: 'Failed to retry' });
    }
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    socket.leave(`youtube:${userId}`);
  });
}
