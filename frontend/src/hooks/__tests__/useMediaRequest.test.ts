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

  it('should submit a movie request successfully', async () => {
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

    const request = {
      mediaType: 'movie' as const,
      tmdbId: 550,
    };

    await act(async () => {
      await result.current.submitRequest(request);
    });

    expect(submitMediaRequest).toHaveBeenCalledWith(request);
    expect(mockTrackRequest).toHaveBeenCalled();
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

    await act(async () => {
      await result.current.submitRequest(request);
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

    await act(async () => {
      try {
        await result.current.submitRequest(request);
      } catch (error) {
        // Expected to throw
      }
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Rate limit exceeded',
      description: 'You have reached the maximum number of requests per hour',
      variant: 'destructive',
    });
    expect(submitMediaRequest).not.toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    const errorMessage = 'Failed to submit request';
    vi.mocked(submitMediaRequest).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useMediaRequest(), {
      wrapper: createWrapper(),
    });

    const request = {
      mediaType: 'movie' as const,
      tmdbId: 550,
    };

    await act(async () => {
      try {
        await result.current.submitRequest(request);
      } catch (error) {
        // Expected to throw
      }
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error',
      description: errorMessage,
      variant: 'destructive',
    });
    expect(mockPush).not.toHaveBeenCalled();
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

    await act(async () => {
      await result.current.submitRequest(request);
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

    await act(async () => {
      await result.current.submitRequest(request);
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

    await act(async () => {
      await result.current.submitRequest(request);
    });

    await waitFor(() => {
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  it('should handle non-Error objects in catch block', async () => {
    vi.mocked(submitMediaRequest).mockRejectedValue('Network error');

    const { result } = renderHook(() => useMediaRequest(), {
      wrapper: createWrapper(),
    });

    const request = {
      mediaType: 'movie' as const,
      tmdbId: 550,
    };

    await act(async () => {
      try {
        await result.current.submitRequest(request);
      } catch (error) {
        // Expected to throw
      }
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Failed to submit request',
      variant: 'destructive',
    });
  });
});
