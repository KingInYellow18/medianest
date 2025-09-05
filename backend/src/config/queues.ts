import Queue from 'bull';

import { logger } from '../utils/logger';

import { getRedis } from './redis';

export let youtubeQueue: Queue.Queue;

export const initializeQueues = async () => {
  const redis = getRedis();

  youtubeQueue = new Queue('youtube-downloads', {
    redis: {
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
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });

  // Queue event handlers
  youtubeQueue.on('completed', job => {
    logger.info(`YouTube download completed: ${job.id}`);
  });

  youtubeQueue.on('failed', (job, err) => {
    logger.error(`YouTube download failed: ${job.id}`, err);
  });

  youtubeQueue.on('stalled', job => {
    logger.warn(`YouTube download stalled: ${job.id}`);
  });
};
