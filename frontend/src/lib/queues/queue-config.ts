import { Queue, Worker, QueueEvents, ConnectionOptions } from 'bullmq';

import { createRedisConnection } from '../redis/redis-client';

// Queue names
export const QUEUE_NAMES = {
  YOUTUBE_DOWNLOAD: 'youtube-download',
  MEDIA_REQUEST: 'media-request',
  SERVICE_STATUS: 'service-status',
  NOTIFICATIONS: 'notifications',
  CLEANUP: 'cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Shared connection options for BullMQ
const connectionOptions: ConnectionOptions = {
  maxRetriesPerRequest: null, // Important for workers
  enableOfflineQueue: true,
  retryStrategy: (times: number): number => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

// Queue instances cache
const queues = new Map<QueueName, Queue>();
const queueEvents = new Map<QueueName, QueueEvents>();

/**
 * Get or create a queue instance
 */
export function getQueue(name: QueueName): Queue {
  if (!queues.has(name)) {
    const connection = createRedisConnection(connectionOptions as any);
    const queue = new Queue(name, {
      connection: connection as any,
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100, // Keep max 100 completed jobs
        },
        removeOnFail: {
          age: 24 * 3600, // Keep failed jobs for 24 hours
          count: 50, // Keep max 50 failed jobs
        },
      },
    });

    queues.set(name, queue);
  }

  return queues.get(name)!;
}

/**
 * Get or create queue events instance
 */
export function getQueueEvents(name: QueueName): QueueEvents {
  if (!queueEvents.has(name)) {
    const connection = createRedisConnection(connectionOptions as any);
    const events = new QueueEvents(name, { connection: connection as any });
    queueEvents.set(name, events);
  }

  return queueEvents.get(name)!;
}

/**
 * Close all queue connections
 */
export async function closeAllQueues(): Promise<void> {
  const promises: Promise<void>[] = [];

  // Close all queues
  for (const queue of queues.values()) {
    promises.push(queue.close());
  }

  // Close all queue events
  for (const events of queueEvents.values()) {
    promises.push(events.close());
  }

  await Promise.all(promises);

  queues.clear();
  queueEvents.clear();

  console.log('✅ All queue connections closed');
}

// Queue-specific configurations
export const QUEUE_CONFIGS = {
  [QUEUE_NAMES.YOUTUBE_DOWNLOAD]: {
    concurrency: 2, // Process 2 downloads concurrently
    maxStalledCount: 1,
    stalledInterval: 30000, // 30 seconds
    lockDuration: 300000, // 5 minutes lock per job
    lockRenewTime: 150000, // Renew lock every 2.5 minutes
  },
  [QUEUE_NAMES.MEDIA_REQUEST]: {
    concurrency: 5,
    maxStalledCount: 3,
    stalledInterval: 10000,
    lockDuration: 30000,
  },
  [QUEUE_NAMES.SERVICE_STATUS]: {
    concurrency: 10,
    maxStalledCount: 3,
    stalledInterval: 5000,
    lockDuration: 10000,
  },
  [QUEUE_NAMES.NOTIFICATIONS]: {
    concurrency: 20,
    maxStalledCount: 3,
    stalledInterval: 5000,
    lockDuration: 5000,
  },
  [QUEUE_NAMES.CLEANUP]: {
    concurrency: 1,
    maxStalledCount: 1,
    stalledInterval: 60000,
    lockDuration: 600000, // 10 minutes for cleanup tasks
  },
} as const;

/**
 * Create a worker with default configuration
 */
export function createWorker<T = any>(
  name: QueueName,
  processor: (job: any) => Promise<T>,
  customOptions?: Partial<(typeof QUEUE_CONFIGS)[QueueName]>,
): Worker<T> {
  const connection = createRedisConnection({
    ...connectionOptions,
    maxRetriesPerRequest: null, // Workers should keep trying
  } as any);

  const config = QUEUE_CONFIGS[name];
  const options = {
    ...config,
    ...customOptions,
    connection: connection as any,
  };

  return new Worker(name, processor, options);
}
