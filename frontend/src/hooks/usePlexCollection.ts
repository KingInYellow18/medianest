'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useWebSocket } from '@/hooks/useWebSocket';
import {
  fetchCollectionStatus,
  fetchUserCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  retryCollectionCreation,
  cancelCollectionCreation,
  fetchCollectionStats,
} from '@/lib/api/plex-collections';
import type {
  PlexCollectionCreation,
  CollectionProgress,
  CollectionFilters,
  CollectionSort,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  CollectionProgressEvent,
  CollectionStatusEvent,
  CollectionCompleteEvent,
} from '@/types/plex-collections';

/**
 * Hook for managing collection status for a specific download
 */
export function useCollectionStatus(downloadId: string) {
  const queryClient = useQueryClient();
  const { socket } = useWebSocket();

  const queryKey = ['plex', 'collection', 'download', downloadId];

  const {
    data: collection,
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: () => fetchCollectionStatus(downloadId),
    enabled: !!downloadId,
    refetchInterval: (data) => {
      // Stop polling when completed or failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 5000; // Poll every 5 seconds for active collections
    },
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    retry: (failureCount, error) => {
      // Retry up to 3 times for network errors, but not for 404s
      if (failureCount >= 3) return false;
      if (error?.message?.includes('404')) return false;
      return true;
    },
  });

  // Real-time updates via WebSocket
  useEffect(() => {
    if (!socket || !collection) return;

    const handleProgressUpdate = (event: CollectionProgressEvent) => {
      if (event.collectionId !== collection.id) return;

      queryClient.setQueryData(queryKey, (old: PlexCollectionCreation | undefined) => {
        if (!old) return old;

        return {
          ...old,
          status: event.status,
          processedCount: Math.floor((event.progress / 100) * old.videoCount),
          message: event.message,
        };
      });
    };

    const handleStatusUpdate = (event: CollectionStatusEvent) => {
      if (event.collectionId !== collection.id) return;

      queryClient.setQueryData(queryKey, (old: PlexCollectionCreation | undefined) => {
        if (!old) return old;

        return {
          ...old,
          status: event.status,
          error: event.error,
        };
      });
    };

    const handleCompleteUpdate = (event: CollectionCompleteEvent) => {
      if (event.collectionId !== collection.id) return;

      queryClient.setQueryData(queryKey, (old: PlexCollectionCreation | undefined) => {
        if (!old) return old;

        return {
          ...old,
          status: 'completed',
          collectionKey: event.collectionKey,
          processedCount: event.successCount,
          completedAt: new Date(),
        };
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['plex', 'collections'] });
    };

    // Subscribe to real-time events
    socket.on('collection:progress', handleProgressUpdate);
    socket.on('collection:status', handleStatusUpdate);
    socket.on('collection:complete', handleCompleteUpdate);
    socket.emit('subscribe:collection', collection.id);

    return () => {
      socket.off('collection:progress', handleProgressUpdate);
      socket.off('collection:status', handleStatusUpdate);
      socket.off('collection:complete', handleCompleteUpdate);
      socket.emit('unsubscribe:collection', collection.id);
    };
  }, [socket, collection, queryClient, queryKey]);

  return {
    collection,
    isLoading,
    error: error?.message,
  };
}

/**
 * Hook for managing user's collections with filtering and sorting
 */
export function useUserCollections(filters?: CollectionFilters, sort?: CollectionSort) {
  const queryKey = ['plex', 'collections', 'user', filters, sort];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchUserCollections(filters, sort),
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
  });

  return {
    collections: data?.collections || [],
    total: data?.total || 0,
    isLoading,
    error: error?.message,
  };
}

/**
 * Hook for collection statistics
 */
export function useCollectionStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['plex', 'collections', 'stats'],
    queryFn: fetchCollectionStats,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
  });

  return {
    stats: data || {
      total: 0,
      active: 0,
      completed: 0,
      failed: 0,
      completedToday: 0,
    },
    isLoading,
  };
}

/**
 * Hook for creating collections
 */
export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCollection,
    onSuccess: (newCollection) => {
      // Update collections list
      queryClient.invalidateQueries({ queryKey: ['plex', 'collections'] });

      // Add to cache optimistically
      queryClient.setQueryData(
        ['plex', 'collection', 'download', newCollection.downloadId],
        newCollection
      );
    },
    onError: (error) => {
      console.error('Failed to create collection:', error);
    },
  });
}

/**
 * Hook for updating collections
 */
export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCollection,
    onSuccess: (updatedCollection) => {
      // Update specific collection in cache
      queryClient.setQueryData(
        ['plex', 'collections', updatedCollection.collectionKey],
        updatedCollection
      );

      // Invalidate collections list
      queryClient.invalidateQueries({ queryKey: ['plex', 'collections'] });
    },
  });
}

/**
 * Hook for deleting collections
 */
export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCollection,
    onSuccess: (_, collectionKey) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: ['plex', 'collections', collectionKey],
      });

      // Invalidate collections list
      queryClient.invalidateQueries({ queryKey: ['plex', 'collections'] });
    },
  });
}

/**
 * Hook for retrying failed collection creation
 */
export function useRetryCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryCollectionCreation,
    onSuccess: (retriedCollection) => {
      // Update collection status
      queryClient.setQueryData(
        ['plex', 'collection', 'download', retriedCollection.downloadId],
        retriedCollection
      );

      // Invalidate collections list
      queryClient.invalidateQueries({ queryKey: ['plex', 'collections'] });
    },
  });
}

/**
 * Hook for canceling collection creation
 */
export function useCancelCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelCollectionCreation,
    onSuccess: (_, collectionId) => {
      // Invalidate all related queries to trigger refetch
      queryClient.invalidateQueries({
        queryKey: ['plex', 'collection'],
      });
    },
  });
}

/**
 * Hook for batch operations on collections
 */
export function useCollectionBatch() {
  const queryClient = useQueryClient();

  const batchDelete = useMutation({
    mutationFn: async (collectionKeys: string[]) => {
      await Promise.all(collectionKeys.map((key) => deleteCollection(key)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plex', 'collections'] });
    },
  });

  const batchRetry = useMutation({
    mutationFn: async (collectionIds: string[]) => {
      return Promise.all(collectionIds.map((id) => retryCollectionCreation(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plex', 'collections'] });
    },
  });

  return {
    batchDelete,
    batchRetry,
  };
}
