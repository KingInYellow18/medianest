'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { socketManager } from '@/lib/socket';
import { UseRequestHistoryOptions, RequestHistoryResponse, RequestUpdate } from '@/types/requests';

async function fetchUserRequests(
  options: UseRequestHistoryOptions
): Promise<RequestHistoryResponse> {
  const params = new URLSearchParams({
    page: options.page.toString(),
    pageSize: options.pageSize.toString(),
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
  });

  // Add filters
  if (options.filters.status && options.filters.status !== 'all') {
    params.append('status', options.filters.status);
  }
  if (options.filters.mediaType && options.filters.mediaType !== 'all') {
    params.append('mediaType', options.filters.mediaType);
  }
  if (options.filters.search) {
    params.append('search', options.filters.search);
  }
  if (options.filters.dateRange) {
    params.append('startDate', options.filters.dateRange.start.toISOString());
    params.append('endDate', options.filters.dateRange.end.toISOString());
  }

  const url = options.userId
    ? `/api/media/requests/user/${options.userId}?${params}`
    : `/api/media/requests?${params}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch request history');
  }

  return response.json();
}

export function useRequestHistory(options: UseRequestHistoryOptions) {
  const queryClient = useQueryClient();

  const queryKey = ['requests', options.userId || 'me', options];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchUserRequests(options),
    staleTime: 30 * 1000, // 30 seconds
  });

  // Real-time updates
  useEffect(() => {
    if (!socketManager.isConnected()) {
      socketManager.connect();
    }

    const handleRequestUpdate = (update: RequestUpdate) => {
      queryClient.setQueryData(queryKey, (old: RequestHistoryResponse | undefined) => {
        if (!old) return old;

        return {
          ...old,
          requests: old.requests.map((req) =>
            req.id === update.requestId ? { ...req, ...update.data } : req
          ),
        };
      });
    };

    socketManager.on('request:update', handleRequestUpdate);

    // Subscribe to updates for all requests in view
    data?.requests.forEach((request) => {
      socketManager.emit('subscribe:request', request.id);
    });

    return () => {
      socketManager.off('request:update', handleRequestUpdate);
      data?.requests.forEach((request) => {
        socketManager.emit('unsubscribe:request', request.id);
      });
    };
  }, [data?.requests, queryClient, queryKey]);

  return {
    requests: data?.requests || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 1,
    currentPage: data?.currentPage || 1,
    isLoading,
    error,
  };
}
