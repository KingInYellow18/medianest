import { Job } from 'bullmq';
import { getQueue, QUEUE_NAMES } from './queue-config';

export interface YoutubeDownloadJobData {
  userId: string;
  playlistUrl: string;
  playlistTitle?: string;
  requestId: string;
  options?: {
    quality?: 'highest' | 'high' | 'medium' | 'low';
    format?: 'mp4' | 'webm' | 'mkv';
    subtitles?: boolean;
  };
}

export interface YoutubeDownloadProgress {
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  currentVideo?: string;
  totalVideos?: number;
  completedVideos?: number;
  error?: string;
}

/**
 * Add a YouTube download job to the queue
 */
export async function addYoutubeDownloadJob(
  data: YoutubeDownloadJobData
): Promise<Job<YoutubeDownloadJobData>> {
  const queue = getQueue(QUEUE_NAMES.YOUTUBE_DOWNLOAD);
  
  const job = await queue.add(
    'download-playlist',
    data,
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000 // Start with 5 second delay
      },
      removeOnComplete: {
        age: 3600, // Keep for 1 hour after completion
        count: 10 // Keep last 10 completed per user
      },
      removeOnFail: {
        age: 86400, // Keep for 24 hours after failure
        count: 5 // Keep last 5 failed per user
      }
    }
  );

  console.log(`📥 YouTube download job ${job.id} added for user ${data.userId}`);
  return job;
}

/**
 * Get all download jobs for a user
 */
export async function getUserDownloadJobs(
  userId: string,
  statuses: Array<'completed' | 'failed' | 'delayed' | 'active' | 'waiting'> = ['active', 'waiting']
): Promise<Job<YoutubeDownloadJobData>[]> {
  const queue = getQueue(QUEUE_NAMES.YOUTUBE_DOWNLOAD);
  const jobs: Job<YoutubeDownloadJobData>[] = [];

  for (const status of statuses) {
    const statusJobs = await queue.getJobs(status);
    const userJobs = statusJobs.filter(job => job.data.userId === userId);
    jobs.push(...userJobs);
  }

  return jobs.sort((a, b) => 
    (b.timestamp || 0) - (a.timestamp || 0)
  );
}

/**
 * Get download job by ID
 */
export async function getDownloadJob(
  jobId: string
): Promise<Job<YoutubeDownloadJobData> | null> {
  const queue = getQueue(QUEUE_NAMES.YOUTUBE_DOWNLOAD);
  const job = await queue.getJob(jobId);
  
  return job as Job<YoutubeDownloadJobData> | null;
}

/**
 * Cancel a download job
 */
export async function cancelDownloadJob(
  jobId: string,
  userId: string
): Promise<boolean> {
  const job = await getDownloadJob(jobId);
  
  if (!job) {
    console.error(`Job ${jobId} not found`);
    return false;
  }

  // Verify user owns this job
  if (job.data.userId !== userId) {
    console.error(`User ${userId} does not own job ${jobId}`);
    return false;
  }

  // Remove the job
  await job.remove();
  console.log(`🚫 Cancelled download job ${jobId} for user ${userId}`);
  
  return true;
}

/**
 * Retry a failed download job
 */
export async function retryDownloadJob(
  jobId: string,
  userId: string
): Promise<Job<YoutubeDownloadJobData> | null> {
  const job = await getDownloadJob(jobId);
  
  if (!job) {
    console.error(`Job ${jobId} not found`);
    return null;
  }

  // Verify user owns this job
  if (job.data.userId !== userId) {
    console.error(`User ${userId} does not own job ${jobId}`);
    return null;
  }

  // Only retry failed jobs
  const state = await job.getState();
  if (state !== 'failed') {
    console.error(`Job ${jobId} is not in failed state (current: ${state})`);
    return null;
  }

  // Retry the job
  await job.retry();
  console.log(`🔄 Retrying download job ${jobId} for user ${userId}`);
  
  return job;
}

/**
 * Get download queue statistics
 */
export async function getDownloadQueueStats() {
  const queue = getQueue(QUEUE_NAMES.YOUTUBE_DOWNLOAD);
  
  const [
    waiting,
    active,
    completed,
    failed,
    delayed
  ] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount()
  ]);

  // Note: getPausedCount is not available in this BullMQ version
  const paused = 0;

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    total: waiting + active + completed + failed + delayed + paused
  };
}

/**
 * Pause the download queue
 */
export async function pauseDownloadQueue(): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.YOUTUBE_DOWNLOAD);
  await queue.pause();
  console.log('⏸️  YouTube download queue paused');
}

/**
 * Resume the download queue
 */
export async function resumeDownloadQueue(): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.YOUTUBE_DOWNLOAD);
  await queue.resume();
  console.log('▶️  YouTube download queue resumed');
}

/**
 * Clean old completed/failed jobs
 */
export async function cleanOldDownloadJobs(
  olderThanDays: number = 7
): Promise<number> {
  const queue = getQueue(QUEUE_NAMES.YOUTUBE_DOWNLOAD);
  const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  
  let cleaned = 0;

  // Clean completed jobs
  const completedJobs = await queue.getJobs('completed');
  for (const job of completedJobs) {
    if (job.finishedOn && job.finishedOn < cutoffTime) {
      await job.remove();
      cleaned++;
    }
  }

  // Clean failed jobs
  const failedJobs = await queue.getJobs('failed');
  for (const job of failedJobs) {
    if (job.finishedOn && job.finishedOn < cutoffTime) {
      await job.remove();
      cleaned++;
    }
  }

  console.log(`🧹 Cleaned ${cleaned} old download jobs`);
  return cleaned;
}