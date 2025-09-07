'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { socketManager } from '@/lib/socket';
import { MediaRequest, RequestStatusUpdate } from '@/types/requests';

export function useRequestStatus(requestId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!requestId) return;

    const handleStatusUpdate = (update: RequestStatusUpdate) => {
      queryClient.setQueryData<MediaRequest>(['request', requestId], (old) =>
        old ? { ...old, ...update } : old,
      );

      // Also update in user's request list
      queryClient.setQueryData<MediaRequest[]>(
        ['requests', 'user'],
        (old) => old?.map((req) => (req.id === requestId ? { ...req, ...update } : req)) || [],
      );
    };

    socketManager.on(`request:${requestId}:status`, handleStatusUpdate);

    return () => {
      socketManager.off(`request:${requestId}:status`, handleStatusUpdate);
    };
  }, [requestId, queryClient]);
}
