// Queue configuration exports
export {
  getQueue,
  getQueueEvents,
  closeAllQueues,
  createWorker,
  QUEUE_NAMES,
  QUEUE_CONFIGS,
  type QueueName,
} from './queue-config';

// YouTube download queue exports
export {
  addYoutubeDownloadJob,
  getUserDownloadJobs,
  getDownloadJob,
  cancelDownloadJob,
  retryDownloadJob,
  getDownloadQueueStats,
  pauseDownloadQueue,
  resumeDownloadQueue,
  cleanOldDownloadJobs,
  type YoutubeDownloadJobData,
  type YoutubeDownloadProgress,
} from './youtube-download-queue';
