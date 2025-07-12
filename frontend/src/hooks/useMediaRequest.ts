'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useToast } from '@/hooks/use-toast';
import { useRateLimit } from '@/hooks/useRateLimit';
import { submitMediaRequest } from '@/lib/api/requests';
import { socketManager } from '@/lib/socket';

export function useMediaRequest() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const { canRequest, remainingRequests, resetTime, trackRequest } = useRateLimit(20, 3600000);

  // Ensure socket is connected
  useEffect(() => {
    if (!socketManager.isConnected()) {
      socketManager.connect();
    }
  }, []);

  const submitRequest = useMutation({
    mutationFn: async (request: Parameters<typeof submitMediaRequest>[0]) => {
      // Check rate limit before submission
      if (!canRequest) {
        throw new Error('Rate limit exceeded');
      }

      return submitMediaRequest(request);
    },
    onSuccess: (data, variables) => {
      // Track the successful request
      trackRequest();

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['media', 'availability', variables.mediaId] });
      queryClient.invalidateQueries({ queryKey: ['requests', 'user'] });

      // Subscribe to real-time updates for this request if connected
      if (socketManager.isConnected()) {
        socketManager.emit('subscribe:request', data.id);
      }

      // Show success toast
      toast({
        title: 'Request submitted',
        description: 'Your request has been submitted successfully',
      });

      // Navigate to requests page
      router.push('/media/requests');
    },
    onError: (error: any) => {
      if (error.message === 'Rate limit exceeded') {
        toast({
          title: 'Rate limit exceeded',
          description: 'You have reached the maximum number of requests per hour',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to submit request',
          variant: 'destructive',
        });
      }
    },
  });

  return {
    submitRequest: submitRequest.mutateAsync,
    isSubmitting: submitRequest.isPending,
    canRequest,
    remainingRequests,
    resetTime,
  };
}
