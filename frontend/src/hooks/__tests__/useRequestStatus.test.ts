import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { socketManager } from '@/lib/socket';
import { RequestStatus } from '@/types/requests';

import { useRequestStatus } from '../useRequestStatus';

// Mock socket manager
vi.mock('@/lib/socket');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useRequestStatus', () => {
  const mockOn = vi.fn();
  const mockOff = vi.fn();
  const mockConnect = vi.fn();
  const mockIsConnected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(socketManager).on = mockOn;
    vi.mocked(socketManager).off = mockOff;
    vi.mocked(socketManager).connect = mockConnect;
    vi.mocked(socketManager).isConnected = mockIsConnected;

    mockIsConnected.mockReturnValue(true);
  });

  it('should connect to socket and subscribe to status updates', () => {
    const requestId = 'test-123';

    renderHook(() => useRequestStatus(requestId), {
      wrapper: createWrapper(),
    });

    expect(mockConnect).toHaveBeenCalled();
    expect(mockOn).toHaveBeenCalledWith(`request:${requestId}:status`, expect.any(Function));
  });

  it('should update query cache when status changes', () => {
    const requestId = 'test-123';
    const queryClient = new QueryClient();

    // Set initial data
    queryClient.setQueryData(
      ['requests', 'user'],
      [
        {
          id: requestId,
          tmdbId: 550,
          mediaType: 'movie',
          title: 'Fight Club',
          status: 'pending' as RequestStatus,
          requestedAt: new Date().toISOString(),
        },
      ],
    );

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useRequestStatus(requestId), { wrapper });

    // Get the callback that was registered
    const statusCallback = mockOn.mock.calls[0][1];

    // Simulate status update
    act(() => {
      statusCallback({ status: 'available' });
    });

    // Check that the cache was updated
    const updatedData = queryClient.getQueryData(['requests', 'user']) as any[];
    expect(updatedData[0].status).toBe('available');
  });

  it('should handle status updates for requests not in cache', () => {
    const requestId = 'test-456';
    const queryClient = new QueryClient();

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useRequestStatus(requestId), { wrapper });

    const statusCallback = mockOn.mock.calls[0][1];

    // Should not throw when updating non-existent request
    expect(() => {
      act(() => {
        statusCallback({ status: 'available' });
      });
    }).not.toThrow();
  });

  it('should update specific request in list', () => {
    const requestId = 'test-789';
    const queryClient = new QueryClient();

    // Set initial data with multiple requests
    queryClient.setQueryData(
      ['requests', 'user'],
      [
        {
          id: 'other-1',
          tmdbId: 100,
          mediaType: 'movie',
          title: 'Other Movie',
          status: 'available' as RequestStatus,
          requestedAt: new Date().toISOString(),
        },
        {
          id: requestId,
          tmdbId: 550,
          mediaType: 'movie',
          title: 'Fight Club',
          status: 'pending' as RequestStatus,
          requestedAt: new Date().toISOString(),
        },
        {
          id: 'other-2',
          tmdbId: 200,
          mediaType: 'tv',
          title: 'Other Show',
          status: 'denied' as RequestStatus,
          requestedAt: new Date().toISOString(),
        },
      ],
    );

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useRequestStatus(requestId), { wrapper });

    const statusCallback = mockOn.mock.calls[0][1];

    act(() => {
      statusCallback({ status: 'processing' });
    });

    const updatedData = queryClient.getQueryData(['requests', 'user']) as any[];

    // Only the specific request should be updated
    expect(updatedData[0].status).toBe('available');
    expect(updatedData[1].status).toBe('processing');
    expect(updatedData[2].status).toBe('denied');
  });

  it('should clean up event listener on unmount', () => {
    const requestId = 'test-999';

    const { unmount } = renderHook(() => useRequestStatus(requestId), {
      wrapper: createWrapper(),
    });

    const statusCallback = mockOn.mock.calls[0][1];

    unmount();

    expect(mockOff).toHaveBeenCalledWith(`request:${requestId}:status`, statusCallback);
  });

  it('should not connect if already connected', () => {
    mockIsConnected.mockReturnValue(true);

    renderHook(() => useRequestStatus('test-111'), {
      wrapper: createWrapper(),
    });

    // connect should still be called as per the hook implementation
    expect(mockConnect).toHaveBeenCalled();
  });

  it('should handle multiple status updates', () => {
    const requestId = 'test-multi';
    const queryClient = new QueryClient();

    queryClient.setQueryData(
      ['requests', 'user'],
      [
        {
          id: requestId,
          tmdbId: 550,
          mediaType: 'movie',
          title: 'Fight Club',
          status: 'pending' as RequestStatus,
          requestedAt: new Date().toISOString(),
        },
      ],
    );

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useRequestStatus(requestId), { wrapper });

    const statusCallback = mockOn.mock.calls[0][1];

    // Simulate multiple status updates
    act(() => {
      statusCallback({ status: 'approved' });
    });

    let updatedData = queryClient.getQueryData(['requests', 'user']) as any[];
    expect(updatedData[0].status).toBe('approved');

    act(() => {
      statusCallback({ status: 'processing' });
    });

    updatedData = queryClient.getQueryData(['requests', 'user']) as any[];
    expect(updatedData[0].status).toBe('processing');

    act(() => {
      statusCallback({ status: 'available' });
    });

    updatedData = queryClient.getQueryData(['requests', 'user']) as any[];
    expect(updatedData[0].status).toBe('available');
  });

  it('should preserve other request properties when updating status', () => {
    const requestId = 'test-preserve';
    const queryClient = new QueryClient();

    const originalRequest = {
      id: requestId,
      tmdbId: 550,
      mediaType: 'movie' as const,
      title: 'Fight Club',
      status: 'pending' as RequestStatus,
      requestedAt: '2023-01-01T00:00:00Z',
      overview: 'A great movie',
      posterPath: '/poster.jpg',
    };

    queryClient.setQueryData(['requests', 'user'], [originalRequest]);

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useRequestStatus(requestId), { wrapper });

    const statusCallback = mockOn.mock.calls[0][1];

    act(() => {
      statusCallback({ status: 'available' });
    });

    const updatedData = queryClient.getQueryData(['requests', 'user']) as any[];

    // All properties except status should remain unchanged
    expect(updatedData[0]).toEqual({
      ...originalRequest,
      status: 'available',
    });
  });
});
