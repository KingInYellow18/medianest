import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useToast } from '@/hooks/use-toast';
import { useRateLimit } from '@/hooks/useRateLimit';
import { submitMediaRequest } from '@/lib/api/requests';
import { socketManager } from '@/lib/socket';

import { useMediaRequest } from '../useMediaRequest';

// Mock dependencies
vi.mock('@/hooks/use-toast');
vi.mock('next/navigation');
vi.mock('@/lib/api/requests');
vi.mock('@/lib/socket');
vi.mock('@/hooks/useRateLimit');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useMediaRequest', () => {
  const mockToast = vi.fn();
  const mockPush = vi.fn();
  const mockTrackRequest = vi.fn();
  const mockEmit = vi.fn();
  const mockConnect = vi.fn();
  const mockIsConnected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useToast).mockReturnValue({ toast: mockToast } as any);
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);
    vi.mocked(useRateLimit).mockReturnValue({
      canRequest: true,
      remainingRequests: 19,
      resetTime: new Date(Date.now() + 3600000),
      trackRequest: mockTrackRequest,
    });

    vi.mocked(socketManager).connect = mockConnect;
    vi.mocked(socketManager).emit = mockEmit;
    vi.mocked(socketManager).isConnected = mockIsConnected;
    mockIsConnected.mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should submit a movie request successfully with complete flow validation', async () => {
    const mockResponse = {
      id: '123',
      tmdbId: 550,
      mediaType: 'movie',
      title: 'Fight Club',
      status: 'pending',
      requestedAt: new Date().toISOString(),
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
    };

    // Submit request and verify state changes
    result.current.submitRequest(request);
    expect(result.current.isSubmitting).toBe(true);

    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(false);
    });

    // Verify all expected calls in correct order
    expect(submitMediaRequest).toHaveBeenCalledWith(request);
    expect(submitMediaRequest).toHaveBeenCalledTimes(1);
    expect(mockTrackRequest).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith('subscribe:request', '123');
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Request submitted',
      description: 'Your request has been submitted successfully',
    });
    expect(mockPush).toHaveBeenCalledWith('/media/requests');
  });

  it('should submit a TV show request with seasons', async () => {
    const mockResponse = {
      id: '456',
      tmdbId: 1396,
      mediaType: 'tv',
      title: 'Breaking Bad',
      status: 'pending',
      requestedAt: new Date().toISOString(),
      seasons: [
        { seasonNumber: 1, status: 'pending' },
        { seasonNumber: 2, status: 'pending' },
      ],
    };

    vi.mocked(submitMediaRequest).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMediaRequest(), {
      wrapper: createWrapper(),
    });

    const request = {
      mediaType: 'tv' as const,
      tmdbId: 1396,
      seasons: [1, 2],
    };

    result.current.submitRequest(request);

    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(false);
    });

    expect(submitMediaRequest).toHaveBeenCalledWith(request);
    expect(mockEmit).toHaveBeenCalledWith('subscribe:request', '456');
  });

  it('should handle rate limit exceeded', async () => {
    vi.mocked(useRateLimit).mockReturnValue({
      canRequest: false,
      remainingRequests: 0,
      resetTime: new Date(Date.now() + 3600000),
      trackRequest: mockTrackRequest,
    });

    const { result } = renderHook(() => useMediaRequest(), {
      wrapper: createWrapper(),
    });

    const request = {
      mediaType: 'movie' as const,
      tmdbId: 550,
    };

    // Wrap in try/catch to handle the expected rejection - PROVEN PATTERN
    try {
      await result.current.submitRequest(request);
    } catch (error: any) {
      // Expected error - rate limit exceeded
      expect(error.message).toBe('Rate limit exceeded');
    }

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Rate limit exceeded',
        description: 'You have reached the maximum number of requests per hour',
        variant: 'destructive',
      });
    });

    expect(submitMediaRequest).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('should handle API errors gracefully with comprehensive error scenarios', async () => {
    const errorScenarios = [
      { error: new Error('Network error'), expectedDescription: 'Network error' },
      { error: new Error('Server error'), expectedDescription: 'Server error' },
      { error: new Error('Validation failed'), expectedDescription: 'Validation failed' },
      { error: 'String error', expectedDescription: 'Failed to submit request' },
      { error: { message: 'Object error' }, expectedDescription: 'Failed to submit request' },
    ];

    for (const { error, expectedDescription } of errorScenarios) {
      const { result, unmount } = renderHook(() => useMediaRequest(), {
        wrapper: createWrapper(),
      });

      vi.mocked(submitMediaRequest).mockRejectedValueOnce(error);
      mockToast.mockClear();

      const request = {
        mediaType: 'movie' as const,
        tmdbId: 550,
      };

      result.current.submitRequest(request);

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
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockTrackRequest).not.toHaveBeenCalled();

      unmount();
    }
  });

  it('should handle submission without socket connection', async () => {
    mockIsConnected.mockReturnValue(false);

    const mockResponse = {
      id: '789',
      tmdbId: 550,
      mediaType: 'movie',
      title: 'Fight Club',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    vi.mocked(submitMediaRequest).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMediaRequest(), {
      wrapper: createWrapper(),
    });

    const request = {
      mediaType: 'movie' as const,
      tmdbId: 550,
    };

    result.current.submitRequest(request);

    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(false);
    });

    // Should still submit successfully
    expect(submitMediaRequest).toHaveBeenCalledWith(request);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Request submitted',
      description: 'Your request has been submitted successfully',
    });

    // Should not try to subscribe to socket events
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('should connect socket if not connected', async () => {
    mockIsConnected.mockReturnValue(false);

    const mockResponse = {
      id: '999',
      tmdbId: 550,
      mediaType: 'movie',
      title: 'Fight Club',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    vi.mocked(submitMediaRequest).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMediaRequest(), {
      wrapper: createWrapper(),
    });

    // Verify socket connect is called on hook initialization
    expect(mockConnect).toHaveBeenCalled();

    const request = {
      mediaType: 'movie' as const,
      tmdbId: 550,
    };

    result.current.submitRequest(request);

    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  it('should track submission state correctly', async () => {
    vi.mocked(submitMediaRequest).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                id: '111',
                tmdbId: 550,
                mediaType: 'movie',
                title: 'Fight Club',
                status: 'pending',
                requestedAt: new Date().toISOString(),
              }),
            100,
          ),
        ),
    );

    const { result } = renderHook(() => useMediaRequest(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isSubmitting).toBe(false);

    const request = {
      mediaType: 'movie' as const,
      tmdbId: 550,
    };

    result.current.submitRequest(request);

    expect(result.current.isSubmitting).toBe(true);

    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  it('should handle concurrent requests properly', async () => {
    const mockResponse1 = {
      id: '111',
      tmdbId: 550,
      mediaType: 'movie',
      title: 'Fight Club',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    const mockResponse2 = {
      id: '222',
      tmdbId: 1396,
      mediaType: 'tv',
      title: 'Breaking Bad',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    vi.mocked(submitMediaRequest)
      .mockResolvedValueOnce(mockResponse1)
      .mockResolvedValueOnce(mockResponse2);

    const { result } = renderHook(() => useMediaRequest(), {
      wrapper: createWrapper(),
    });

    const request1 = { mediaType: 'movie' as const, tmdbId: 550 };
    const request2 = { mediaType: 'tv' as const, tmdbId: 1396, seasons: [1] };

    // Submit both requests concurrently
    result.current.submitRequest(request1);
    result.current.submitRequest(request2);

    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(false);
    });

    // Verify both requests were processed
    expect(submitMediaRequest).toHaveBeenCalledTimes(2);
    expect(submitMediaRequest).toHaveBeenCalledWith(request1);
    expect(submitMediaRequest).toHaveBeenCalledWith(request2);
    expect(mockTrackRequest).toHaveBeenCalledTimes(2);
  });

  it('should handle socket connection failures gracefully', async () => {
    // Mock socket connection failure
    mockConnect.mockImplementationOnce(() => {
      throw new Error('Socket connection failed');
    });

    const mockResponse = {
      id: '333',
      tmdbId: 550,
      mediaType: 'movie',
      title: 'Fight Club',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    vi.mocked(submitMediaRequest).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMediaRequest(), {
      wrapper: createWrapper(),
    });

    const request = {
      mediaType: 'movie' as const,
      tmdbId: 550,
    };

    result.current.submitRequest(request);

    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(false);
    });

    // Should still submit successfully despite socket failure
    expect(submitMediaRequest).toHaveBeenCalledWith(request);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Request submitted',
      description: 'Your request has been submitted successfully',
    });
  });
});
