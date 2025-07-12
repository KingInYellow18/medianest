'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { socketManager } from '@/lib/socket';
import { submitMediaRequest } from '@/lib/api/requests';

export function useMediaRequest() {
  const queryClient = useQueryClient();
  
  const submitRequest = useMutation({
    mutationFn: submitMediaRequest,
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['media', 'availability', variables.mediaId] });
      queryClient.invalidateQueries({ queryKey: ['requests', 'user'] });
      
      // Subscribe to real-time updates for this request
      socketManager.emit('subscribe:request', data.id);
    },
    onError: (error: any) => {
      if (error.response?.status === 429) {
        throw new Error('Request limit exceeded. Please try again later.');
      }
      throw error;
    }
  });
  
  return {
    submitRequest: submitRequest.mutateAsync,
    isSubmitting: submitRequest.isPending
  };
}