import { Queue, QueueEvents } from 'bullmq';

import { logger } from '../utils/logger';

import { getRedis } from './redis';

export let youtubeQueue: Queue;
export let youtubeQueueEvents: QueueEvents;

export const initializeQueues = async () => {
  const redis = getRedis();

  youtubeQueue = new Queue('youtube-downloads', {
    connection: {
      host: redis.options.host,
      port: redis.options.port as number,
      password: redis.options.password,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: {
        count: 100,
        age: 24 * 60 * 60, // 24 hours
      },
      removeOnFail: {
        count: 500,
        age: 7 * 24 * 60 * 60, // 7 days
      },
    },
  });

  // Create queue events listener
  youtubeQueueEvents = new QueueEvents('youtube-downloads', {
    connection: {
      host: redis.options.host,
      port: redis.options.port as number,
      password: redis.options.password,
    },
  });

  // Queue event handlers
  youtubeQueueEvents.on('completed', ({ jobId }) => {
    logger.info(`YouTube download completed: ${jobId}`);
  });

  youtubeQueueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error(`YouTube download failed: ${jobId}`, { reason: failedReason });
  });

  youtubeQueueEvents.on('stalled', ({ jobId }) => {
    logger.warn(`YouTube download stalled: ${jobId}`);
  });
};
