'use client';

import { useEffect, useState, useCallback } from 'react';

import { useWebSocket } from '@/contexts/WebSocketContext';

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

export function useEnhancedDownloads() {
  const {
    subscribeToDownloads,
    unsubscribeFromDownloads,
    getDownloadStatus,
    cancelDownload,
    retryDownload,
    subscribe,
    emitWithCallback,
  } = useWebSocket();

  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(new Map());
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Subscribe to download events
  useEffect(() => {
    if (!isSubscribed) {
      subscribeToDownloads();
      setIsSubscribed(true);
    }

    // Set up event listeners
    const unsubscribeProgress = subscribe<DownloadProgress>('download:progress', (progress) => {
      setDownloads((prev) => {
        const newMap = new Map(prev);
        newMap.set(progress.downloadId, progress);
        return newMap;
      });
    });

    const unsubscribeCompleted = subscribe('download:completed', (data: any) => {
      setDownloads((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(data.downloadId);
        if (existing) {
          newMap.set(data.downloadId, {
            ...existing,
            status: 'completed',
            progress: 100,
          });
        }
        return newMap;
      });
    });

    const unsubscribeFailed = subscribe('download:failed', (data: any) => {
      setDownloads((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(data.downloadId);
        if (existing) {
          newMap.set(data.downloadId, {
            ...existing,
            status: 'failed',
            error: data.error,
          });
        }
        return newMap;
      });
    });

    const unsubscribeCancelled = subscribe('download:cancelled', (data: any) => {
      setDownloads((prev) => {
        const newMap = new Map(prev);
        newMap.delete(data.downloadId);
        return newMap;
      });
    });

    return () => {
      unsubscribeFromDownloads();
      unsubscribeProgress();
      unsubscribeCompleted();
      unsubscribeFailed();
      unsubscribeCancelled();
      setIsSubscribed(false);
    };
  }, [isSubscribed, subscribeToDownloads, unsubscribeFromDownloads, subscribe]);

  // Get queue statistics
  const refreshQueueStats = useCallback(async () => {
    try {
      const result = await emitWithCallback('downloads:queue:status', {});
      if (result.success) {
        setQueueStats(result.data.stats);
      }
    } catch (error) {
      console.error('Failed to get queue stats:', error);
    }
  }, [emitWithCallback]);

  // Get download status with caching
  const getDownloadStatusCached = useCallback(
    async (downloadId: string) => {
      // Check cache first
      const cached = downloads.get(downloadId);
      if (cached && Date.now() - (cached as any).lastUpdated < 5000) {
        // 5 second cache
        return cached;
      }

      // Fetch from server
      try {
        const result = await getDownloadStatus(downloadId);
        if (result.success) {
          const progress = { ...result.data, lastUpdated: Date.now() };
          setDownloads((prev) => {
            const newMap = new Map(prev);
            newMap.set(downloadId, progress);
            return newMap;
          });
          return progress;
        }
        return null;
      } catch (error) {
        console.error('Failed to get download status:', error);
        return null;
      }
    },
    [downloads, getDownloadStatus]
  );

  // Cancel download with optimistic update
  const cancelDownloadOptimistic = useCallback(
    async (downloadId: string) => {
      // Optimistic update
      setDownloads((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(downloadId);
        if (existing) {
          newMap.set(downloadId, {
            ...existing,
            status: 'failed', // Temporary status
          });
        }
        return newMap;
      });

      try {
        const success = await cancelDownload(downloadId);
        if (success) {
          // Remove from downloads on successful cancellation
          setDownloads((prev) => {
            const newMap = new Map(prev);
            newMap.delete(downloadId);
            return newMap;
          });
          await refreshQueueStats();
        } else {
          // Revert optimistic update
          await getDownloadStatusCached(downloadId);
        }
        return success;
      } catch (error) {
        // Revert optimistic update
        await getDownloadStatusCached(downloadId);
        throw error;
      }
    },
    [cancelDownload, getDownloadStatusCached, refreshQueueStats]
  );

  // Retry download with optimistic update
  const retryDownloadOptimistic = useCallback(
    async (downloadId: string) => {
      // Optimistic update
      setDownloads((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(downloadId);
        if (existing) {
          newMap.set(downloadId, {
            ...existing,
            status: 'pending',
            progress: 0,
            error: undefined,
          });
        }
        return newMap;
      });

      try {
        const success = await retryDownload(downloadId);
        if (success) {
          await refreshQueueStats();
        } else {
          // Revert optimistic update
          await getDownloadStatusCached(downloadId);
        }
        return success;
      } catch (error) {
        // Revert optimistic update
        await getDownloadStatusCached(downloadId);
        throw error;
      }
    },
    [retryDownload, getDownloadStatusCached, refreshQueueStats]
  );

  // Get downloads by status
  const getDownloadsByStatus = useCallback(
    (status: DownloadProgress['status']) => {
      return Array.from(downloads.values()).filter((download) => download.status === status);
    },
    [downloads]
  );

  // Get active downloads
  const getActiveDownloads = useCallback(() => {
    return getDownloadsByStatus('downloading');
  }, [getDownloadsByStatus]);

  // Get completed downloads
  const getCompletedDownloads = useCallback(() => {
    return getDownloadsByStatus('completed');
  }, [getDownloadsByStatus]);

  // Get failed downloads
  const getFailedDownloads = useCallback(() => {
    return getDownloadsByStatus('failed');
  }, [getDownloadsByStatus]);

  // Calculate total progress for active downloads
  const getTotalProgress = useCallback(() => {
    const activeDownloads = getActiveDownloads();
    if (activeDownloads.length === 0) return 0;

    const totalProgress = activeDownloads.reduce((sum, download) => sum + download.progress, 0);
    return totalProgress / activeDownloads.length;
  }, [getActiveDownloads]);

  // Initialize queue stats on mount
  useEffect(() => {
    refreshQueueStats();
  }, [refreshQueueStats]);

  return {
    // State
    downloads: Array.from(downloads.values()),
    downloadsMap: downloads,
    queueStats,
    isSubscribed,

    // Actions
    getDownloadStatus: getDownloadStatusCached,
    cancelDownload: cancelDownloadOptimistic,
    retryDownload: retryDownloadOptimistic,
    refreshQueueStats,

    // Computed values
    getDownloadsByStatus,
    getActiveDownloads,
    getCompletedDownloads,
    getFailedDownloads,
    getTotalProgress,

    // Statistics
    activeCount: getActiveDownloads().length,
    completedCount: getCompletedDownloads().length,
    failedCount: getFailedDownloads().length,
  };
}
