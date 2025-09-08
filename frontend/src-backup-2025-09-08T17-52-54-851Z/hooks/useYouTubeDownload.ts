import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  queueYouTubeDownload,
  getDownloadQueue,
  cancelDownload,
  retryDownload,
} from '@/lib/api/youtube';
import type { DownloadFormat } from '@/types/youtube';

export function useYouTubeDownload() {
  const queryClient = useQueryClient();

  const queueMutation = useMutation({
    mutationFn: ({ url, format }: { url: string; format: DownloadFormat }) =>
      queueYouTubeDownload(url, format),
    onSuccess: () => {
      // Invalidate and refetch download queue and quota
      queryClient.invalidateQueries({ queryKey: ['youtube', 'downloads'] });
      queryClient.invalidateQueries({ queryKey: ['youtube', 'quota'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelDownload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube', 'downloads'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: retryDownload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube', 'downloads'] });
    },
  });

  return {
    queueDownload: queueMutation.mutateAsync,
    cancelDownload: cancelMutation.mutateAsync,
    retryDownload: retryMutation.mutateAsync,
    isQueueing: queueMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isRetrying: retryMutation.isPending,
  };
}

export function useDownloadQueue() {
  const {
    data: downloads,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['youtube', 'downloads'],
    queryFn: getDownloadQueue,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 5 * 1000, // Refetch every 5 seconds for real-time updates
  });

  return {
    downloads: downloads || [],
    isLoading,
    error,
    refetch,
  };
}
