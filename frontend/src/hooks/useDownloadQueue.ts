import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { 
  fetchDownloadQueue, 
  cancelDownload, 
  retryDownload,
  deleteDownload,
  type FetchDownloadQueueOptions 
} from '@/lib/api/youtube';
import { 
  type DownloadQueueResponse, 
  type DownloadProgress,
  type DownloadStatus,
  type QueueFilters 
} from '@/types/youtube-queue';
import { useWebSocket } from '@/hooks/useWebSocket';

export interface UseDownloadQueueOptions {
  userId?: string;
  filters: QueueFilters;
  page?: number;
  limit?: number;
  refetchInterval?: number;
}

export function useDownloadQueue(options: UseDownloadQueueOptions) {
  const queryClient = useQueryClient();
  const { socket } = useWebSocket();
  
  const queryKey = ['youtube', 'queue', options.userId || 'me', options.filters, options.page];
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchDownloadQueue(options),
    refetchInterval: options.refetchInterval || 5000, // Poll every 5 seconds as backup
    staleTime: 2000, // Consider data stale after 2 seconds
  });
  
  // Real-time progress updates via WebSocket
  useEffect(() => {
    if (!socket) return;
    
    const handleProgressUpdate = useCallback((update: DownloadProgress) => {
      queryClient.setQueryData(queryKey, (old: DownloadQueueResponse | undefined) => {
        if (!old) return old;
        
        return {
          ...old,
          downloads: old.downloads.map(download => 
            download.id === update.downloadId
              ? {
                  ...download,
                  progress: update.progress,
                  downloadedSize: update.downloadedSize,
                  totalSize: update.totalSize,
                  downloadSpeed: update.speed,
                  eta: update.eta,
                  currentVideo: update.currentVideo?.index,
                  updatedAt: new Date().toISOString(),
                }
              : download
          )
        };
      });
    }, [queryClient, queryKey]);
    
    const handleStatusUpdate = useCallback((update: { downloadId: string; status: DownloadStatus; error?: string }) => {
      queryClient.setQueryData(queryKey, (old: DownloadQueueResponse | undefined) => {
        if (!old) return old;
        
        return {
          ...old,
          downloads: old.downloads.map(download => 
            download.id === update.downloadId
              ? { 
                  ...download, 
                  status: update.status,
                  error: update.error,
                  updatedAt: new Date().toISOString(),
                  completedAt: update.status === 'completed' ? new Date().toISOString() : download.completedAt,
                }
              : download
          )
        };
      });
    }, [queryClient, queryKey]);
    
    const handleQueueUpdate = useCallback(() => {
      // Refetch the entire queue when new items are added or structure changes
      refetch();
    }, [refetch]);
    
    // Subscribe to WebSocket events
    socket.on('download:progress', handleProgressUpdate);
    socket.on('download:status', handleStatusUpdate);
    socket.on('download:queue-update', handleQueueUpdate);
    
    // Subscribe to updates for all downloads in view
    if (data?.downloads) {
      data.downloads.forEach(download => {
        socket.emit('subscribe:download', download.id);
      });
    }
    
    return () => {
      socket.off('download:progress', handleProgressUpdate);
      socket.off('download:status', handleStatusUpdate);
      socket.off('download:queue-update', handleQueueUpdate);
      
      // Unsubscribe from download updates
      if (data?.downloads) {
        data.downloads.forEach(download => {
          socket.emit('unsubscribe:download', download.id);
        });
      }
    };
  }, [socket, data?.downloads, queryClient, queryKey, refetch]);
  
  const cancelMutation = useMutation({
    mutationFn: cancelDownload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube', 'queue'] });
    },
    onError: (error) => {
      console.error('Failed to cancel download:', error);
    },
  });
  
  const retryMutation = useMutation({
    mutationFn: retryDownload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube', 'queue'] });
    },
    onError: (error) => {
      console.error('Failed to retry download:', error);
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: deleteDownload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube', 'queue'] });
    },
    onError: (error) => {
      console.error('Failed to delete download:', error);
    },
  });
  
  return {
    downloads: data?.downloads || [],
    stats: data?.stats || { total: 0, active: 0, queued: 0, completed: 0, failed: 0 },
    totalCount: data?.totalCount || 0,
    isLoading,
    error,
    refetch,
    cancelDownload: cancelMutation.mutateAsync,
    retryDownload: retryMutation.mutateAsync,
    deleteDownload: deleteMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
    isRetrying: retryMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}