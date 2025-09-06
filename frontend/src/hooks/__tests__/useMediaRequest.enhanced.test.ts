import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useToast } from '@/hooks/use-toast';
import { useRateLimit } from '@/hooks/useRateLimit';
import { submitMediaRequest } from '@/lib/api/requests';
import { socketManager } from '@/lib/socket';

import { useMediaRequest } from '../useMediaRequest';

// Enhanced mocks with detailed implementations
vi.mock('@/hooks/use-toast');
vi.mock('next/navigation');
vi.mock('@/lib/api/requests');
vi.mock('@/lib/socket');
vi.mock('@/hooks/useRateLimit');

const createWrapper = (options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
        ...options,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useMediaRequest - Enhanced Integration Tests', () => {
  const mockToast = vi.fn();
  const mockPush = vi.fn();
  const mockReplace = vi.fn();
  const mockTrackRequest = vi.fn();
  const mockEmit = vi.fn();
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const mockIsConnected = vi.fn();
  const mockOn = vi.fn();
  const mockOff = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Enhanced toast mock
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: [],
    } as any);

    // Enhanced router mock
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    } as any);

    // Enhanced rate limit mock
    vi.mocked(useRateLimit).mockReturnValue({
      canRequest: true,
      remainingRequests: 19,
      resetTime: new Date(Date.now() + 3600000),
      trackRequest: mockTrackRequest,
    });

    // Enhanced socket manager mock
    vi.mocked(socketManager).connect = mockConnect;
    vi.mocked(socketManager).disconnect = mockDisconnect;
    vi.mocked(socketManager).emit = mockEmit;
    vi.mocked(socketManager).isConnected = mockIsConnected;
    vi.mocked(socketManager).on = mockOn;
    vi.mocked(socketManager).off = mockOff;
    mockIsConnected.mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Hook Initialization and Cleanup', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(typeof result.current.submitRequest).toBe('function');
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('should handle socket connection on initialization', () => {
      mockIsConnected.mockReturnValue(false);

      renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('should clean up on unmount', () => {
      const { unmount } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      unmount();
      // Cleanup should be handled by React Query and socket manager
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Movie Request Submission Flow', () => {
    it('should handle complete movie request flow with detailed validation', async () => {
      const mockResponse = {
        id: 'req-123',
        tmdbId: 550,
        mediaType: 'movie',
        title: 'Fight Club',
        status: 'pending',
        requestedAt: new Date().toISOString(),
        userId: 'user-123',
        priority: 'normal',
      };

      vi.mocked(submitMediaRequest).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      // Verify initial state
      expect(result.current.isSubmitting).toBe(false);

      const request = {
        mediaType: 'movie' as const,
        tmdbId: 550,
        title: 'Fight Club',
        releaseYear: 1999,
      };

      // Submit request and track state changes
      act(() => {
        result.current.submitRequest(request);
      });

      // Immediately verify loading state
      expect(result.current.isSubmitting).toBe(true);

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      // Verify complete call sequence
      expect(submitMediaRequest).toHaveBeenCalledTimes(1);
      expect(submitMediaRequest).toHaveBeenCalledWith(request);
      expect(mockTrackRequest).toHaveBeenCalledTimes(1);

      // Verify socket subscription
      expect(mockEmit).toHaveBeenCalledWith('subscribe:request', 'req-123');

      // Verify user feedback
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Request submitted',
        description: 'Your request has been submitted successfully',
      });

      // Verify navigation
      expect(mockPush).toHaveBeenCalledWith('/media/requests');
    });

    it('should handle movie request with additional metadata', async () => {
      const mockResponse = {
        id: 'req-456',
        tmdbId: 238,
        mediaType: 'movie',
        title: 'The Godfather',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };

      vi.mocked(submitMediaRequest).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      const request = {
        mediaType: 'movie' as const,
        tmdbId: 238,
        title: 'The Godfather',
        releaseYear: 1972,
        quality: '4K',
        language: 'en',
      };

      act(() => {
        result.current.submitRequest(request);
      });

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      expect(submitMediaRequest).toHaveBeenCalledWith(request);
    });
  });

  describe('TV Show Request Submission with Season Management', () => {
    it('should handle TV show request with multiple seasons', async () => {
      const mockResponse = {
        id: 'req-789',
        tmdbId: 1396,
        mediaType: 'tv',
        title: 'Breaking Bad',
        status: 'pending',
        requestedAt: new Date().toISOString(),
        seasons: [
          { seasonNumber: 1, status: 'pending' },
          { seasonNumber: 2, status: 'pending' },
          { seasonNumber: 3, status: 'pending' },
        ],
      };

      vi.mocked(submitMediaRequest).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      const request = {
        mediaType: 'tv' as const,
        tmdbId: 1396,
        title: 'Breaking Bad',
        seasons: [1, 2, 3],
        quality: 'HD',
      };

      act(() => {
        result.current.submitRequest(request);
      });

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      expect(submitMediaRequest).toHaveBeenCalledWith(request);
      expect(mockEmit).toHaveBeenCalledWith('subscribe:request', 'req-789');

      // Verify season-specific toast message
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Request submitted',
        description: 'Your request has been submitted successfully',
      });
    });

    it('should handle single season TV show request', async () => {
      const mockResponse = {
        id: 'req-single-season',
        tmdbId: 71712,
        mediaType: 'tv',
        title: 'The Good Place',
        status: 'pending',
        requestedAt: new Date().toISOString(),
        seasons: [{ seasonNumber: 1, status: 'pending' }],
      };

      vi.mocked(submitMediaRequest).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      const request = {
        mediaType: 'tv' as const,
        tmdbId: 71712,
        seasons: [1],
      };

      act(() => {
        result.current.submitRequest(request);
      });

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      expect(submitMediaRequest).toHaveBeenCalledWith(request);
    });

    it('should handle complete series request', async () => {
      const mockResponse = {
        id: 'req-complete-series',
        tmdbId: 1418,
        mediaType: 'tv',
        title: 'The Big Bang Theory',
        status: 'pending',
        requestedAt: new Date().toISOString(),
        seasons: Array.from({ length: 12 }, (_, i) => ({
          seasonNumber: i + 1,
          status: 'pending',
        })),
      };

      vi.mocked(submitMediaRequest).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      const request = {
        mediaType: 'tv' as const,
        tmdbId: 1418,
        seasons: Array.from({ length: 12 }, (_, i) => i + 1),
        requestType: 'complete_series',
      };

      act(() => {
        result.current.submitRequest(request);
      });

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      expect(submitMediaRequest).toHaveBeenCalledWith(request);
    });
  });

  describe('Rate Limiting and Validation', () => {
    it('should enforce rate limits with detailed feedback', async () => {
      const resetTime = new Date(Date.now() + 1800000); // 30 minutes
      vi.mocked(useRateLimit).mockReturnValue({
        canRequest: false,
        remainingRequests: 0,
        resetTime,
        trackRequest: mockTrackRequest,
      });

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      const request = {
        mediaType: 'movie' as const,
        tmdbId: 550,
      };

      act(() => {
        result.current.submitRequest(request);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Rate limit exceeded',
          description: 'You have reached the maximum number of requests per hour',
          variant: 'destructive',
        });
      });

      expect(submitMediaRequest).not.toHaveBeenCalled();
      expect(mockTrackRequest).not.toHaveBeenCalled();
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should handle rate limit edge cases', async () => {
      // Test scenario where rate limit changes during request
      const { result, rerender } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      // Start with rate limit available
      vi.mocked(useRateLimit).mockReturnValue({
        canRequest: true,
        remainingRequests: 1,
        resetTime: new Date(Date.now() + 3600000),
        trackRequest: mockTrackRequest,
      });

      const mockResponse = {
        id: 'req-edge-case',
        tmdbId: 550,
        mediaType: 'movie',
        title: 'Fight Club',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };

      vi.mocked(submitMediaRequest).mockResolvedValue(mockResponse);

      const request = { mediaType: 'movie' as const, tmdbId: 550 };

      act(() => {
        result.current.submitRequest(request);
      });

      // Simulate rate limit being hit during request
      vi.mocked(useRateLimit).mockReturnValue({
        canRequest: false,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 3600000),
        trackRequest: mockTrackRequest,
      });

      rerender();

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      // Original request should complete successfully
      expect(submitMediaRequest).toHaveBeenCalledWith(request);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Request submitted',
        description: 'Your request has been submitted successfully',
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle comprehensive error scenarios', async () => {
      const errorScenarios = [
        {
          error: new Error('Network timeout'),
          expectedDescription: 'Network timeout',
          testName: 'network timeout',
        },
        {
          error: new Error('Server error: 500'),
          expectedDescription: 'Server error: 500',
          testName: 'server error',
        },
        {
          error: { message: 'Validation error', code: 'INVALID_REQUEST' },
          expectedDescription: 'Failed to submit request',
          testName: 'validation error object',
        },
        {
          error: 'String error message',
          expectedDescription: 'Failed to submit request',
          testName: 'string error',
        },
        {
          error: null,
          expectedDescription: 'Failed to submit request',
          testName: 'null error',
        },
      ];

      for (const { error, expectedDescription, testName } of errorScenarios) {
        const { result, unmount } = renderHook(() => useMediaRequest(), {
          wrapper: createWrapper(),
        });

        vi.mocked(submitMediaRequest).mockRejectedValueOnce(error);
        mockToast.mockClear();

        const request = { mediaType: 'movie' as const, tmdbId: 550 };

        act(() => {
          result.current.submitRequest(request);
        });

        // Verify loading state
        expect(result.current.isSubmitting).toBe(true);

        await waitFor(() => {
          expect(result.current.isSubmitting).toBe(false);
        });

        // Verify error handling
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: expectedDescription,
          variant: 'destructive',
        });

        // Verify no side effects on error
        expect(mockPush).not.toHaveBeenCalled();
        expect(mockTrackRequest).not.toHaveBeenCalled();
        expect(mockEmit).not.toHaveBeenCalled();

        unmount();
      }
    });

    it('should handle request cancellation', async () => {
      let rejectRequest: (error: Error) => void;
      const requestPromise = new Promise((_, reject) => {
        rejectRequest = reject;
      });

      vi.mocked(submitMediaRequest).mockReturnValue(requestPromise);

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      const request = { mediaType: 'movie' as const, tmdbId: 550 };

      act(() => {
        result.current.submitRequest(request);
      });

      expect(result.current.isSubmitting).toBe(true);

      // Simulate request cancellation
      rejectRequest!(new Error('Request cancelled'));

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Request cancelled',
        variant: 'destructive',
      });
    });
  });

  describe('Socket Integration and Real-time Updates', () => {
    it('should handle socket connection states correctly', async () => {
      const connectionStates = [
        { connected: true, shouldEmit: true },
        { connected: false, shouldEmit: false },
      ];

      for (const { connected, shouldEmit } of connectionStates) {
        mockIsConnected.mockReturnValue(connected);
        mockEmit.mockClear();

        const mockResponse = {
          id: `req-socket-${connected}`,
          tmdbId: 550,
          mediaType: 'movie',
          status: 'pending',
          requestedAt: new Date().toISOString(),
        };

        vi.mocked(submitMediaRequest).mockResolvedValue(mockResponse);

        const { result, unmount } = renderHook(() => useMediaRequest(), {
          wrapper: createWrapper(),
        });

        const request = { mediaType: 'movie' as const, tmdbId: 550 };

        act(() => {
          result.current.submitRequest(request);
        });

        await waitFor(() => {
          expect(result.current.isSubmitting).toBe(false);
        });

        if (shouldEmit) {
          expect(mockEmit).toHaveBeenCalledWith('subscribe:request', mockResponse.id);
        } else {
          expect(mockEmit).not.toHaveBeenCalled();
        }

        // Request should still succeed regardless of socket state
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Request submitted',
          description: 'Your request has been submitted successfully',
        });

        unmount();
      }
    });

    it('should handle socket events during request lifecycle', async () => {
      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      // Mock socket event handlers
      const eventHandlers: Record<string, Function> = {};
      mockOn.mockImplementation((event: string, handler: Function) => {
        eventHandlers[event] = handler;
      });

      const mockResponse = {
        id: 'req-socket-events',
        tmdbId: 550,
        mediaType: 'movie',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };

      vi.mocked(submitMediaRequest).mockResolvedValue(mockResponse);

      const request = { mediaType: 'movie' as const, tmdbId: 550 };

      act(() => {
        result.current.submitRequest(request);
      });

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      // Simulate socket events
      if (eventHandlers['request:updated']) {
        act(() => {
          eventHandlers['request:updated']({
            id: 'req-socket-events',
            status: 'approved',
          });
        });
      }

      expect(mockEmit).toHaveBeenCalledWith('subscribe:request', 'req-socket-events');
    });

    it('should handle socket reconnection scenarios', async () => {
      // Initially disconnected
      mockIsConnected.mockReturnValue(false);

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      expect(mockConnect).toHaveBeenCalledTimes(1);

      // Simulate reconnection
      mockIsConnected.mockReturnValue(true);

      const mockResponse = {
        id: 'req-reconnect',
        tmdbId: 550,
        mediaType: 'movie',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };

      vi.mocked(submitMediaRequest).mockResolvedValue(mockResponse);

      const request = { mediaType: 'movie' as const, tmdbId: 550 };

      act(() => {
        result.current.submitRequest(request);
      });

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      // Should work normally after reconnection
      expect(mockEmit).toHaveBeenCalledWith('subscribe:request', 'req-reconnect');
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests', async () => {
      const responses = [
        {
          id: 'req-concurrent-1',
          tmdbId: 550,
          mediaType: 'movie',
          status: 'pending',
          requestedAt: new Date().toISOString(),
        },
        {
          id: 'req-concurrent-2',
          tmdbId: 1396,
          mediaType: 'tv',
          status: 'pending',
          requestedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(submitMediaRequest)
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1]);

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      const requests = [
        { mediaType: 'movie' as const, tmdbId: 550 },
        { mediaType: 'tv' as const, tmdbId: 1396, seasons: [1, 2] },
      ];

      // Submit both requests concurrently
      act(() => {
        result.current.submitRequest(requests[0]);
        result.current.submitRequest(requests[1]);
      });

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      // Both requests should be processed
      expect(submitMediaRequest).toHaveBeenCalledTimes(2);
      expect(submitMediaRequest).toHaveBeenCalledWith(requests[0]);
      expect(submitMediaRequest).toHaveBeenCalledWith(requests[1]);

      // Both should trigger socket subscriptions
      expect(mockEmit).toHaveBeenCalledWith('subscribe:request', 'req-concurrent-1');
      expect(mockEmit).toHaveBeenCalledWith('subscribe:request', 'req-concurrent-2');

      // Should track both requests
      expect(mockTrackRequest).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success/failure scenarios', async () => {
      vi.mocked(submitMediaRequest)
        .mockResolvedValueOnce({
          id: 'req-success',
          tmdbId: 550,
          mediaType: 'movie',
          status: 'pending',
          requestedAt: new Date().toISOString(),
        })
        .mockRejectedValueOnce(new Error('Second request failed'));

      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.submitRequest({ mediaType: 'movie' as const, tmdbId: 550 });
        result.current.submitRequest({ mediaType: 'movie' as const, tmdbId: 238 });
      });

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      // Should show both success and error messages
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Request submitted',
        description: 'Your request has been submitted successfully',
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Second request failed',
        variant: 'destructive',
      });

      // Only successful request should be tracked and subscribed
      expect(mockEmit).toHaveBeenCalledTimes(1);
      expect(mockEmit).toHaveBeenCalledWith('subscribe:request', 'req-success');
    });
  });

  describe('Performance and Optimization', () => {
    it('should debounce rapid consecutive requests', async () => {
      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      const mockResponse = {
        id: 'req-debounced',
        tmdbId: 550,
        mediaType: 'movie',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };

      vi.mocked(submitMediaRequest).mockResolvedValue(mockResponse);

      const request = { mediaType: 'movie' as const, tmdbId: 550 };

      // Rapidly submit same request multiple times
      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.submitRequest(request);
        }
      });

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      // Should still process all requests (React Query handles deduplication)
      expect(submitMediaRequest).toHaveBeenCalled();
      expect(mockTrackRequest).toHaveBeenCalled();
    });

    it('should optimize socket emissions', async () => {
      const { result } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      const responses = Array.from({ length: 3 }, (_, i) => ({
        id: `req-optimize-${i}`,
        tmdbId: 550 + i,
        mediaType: 'movie',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      }));

      vi.mocked(submitMediaRequest)
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1])
        .mockResolvedValueOnce(responses[2]);

      // Submit multiple requests
      act(() => {
        responses.forEach((_, i) => {
          result.current.submitRequest({
            mediaType: 'movie' as const,
            tmdbId: 550 + i,
          });
        });
      });

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(false);
      });

      // Each successful request should have its own socket subscription
      expect(mockEmit).toHaveBeenCalledTimes(3);
      responses.forEach((response) => {
        expect(mockEmit).toHaveBeenCalledWith('subscribe:request', response.id);
      });
    });
  });
});
