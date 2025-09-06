import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { socketManager } from '@/lib/socket';
import { ServiceStatus } from '@/types/dashboard';

import { useRealtimeStatus } from '../useRealtimeStatus';

// Mock the socket manager
vi.mock('@/lib/socket', () => ({
  socketManager: {
    on: vi.fn(),
    off: vi.fn(),
  },
}));

describe('useRealtimeStatus', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactElement<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    wrapper = ({ children }: { children: React.ReactNode }) => {
      return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
  });

  it('should subscribe to socket events on mount', () => {
    renderHook(() => useRealtimeStatus(), { wrapper });

    expect(socketManager.on).toHaveBeenCalledWith('service:status', expect.any(Function));
    expect(socketManager.on).toHaveBeenCalledWith('service:bulk-update', expect.any(Function));
  });

  it('should handle single service status update', () => {
    const initialServices: ServiceStatus[] = [
      {
        id: 'plex',
        name: 'Plex',
        displayName: 'Plex Media Server',
        status: 'up',
        responseTime: 50,
        lastCheckAt: new Date(),
        uptime: { '24h': 99.9, '7d': 99.5, '30d': 99.0 },
      },
      {
        id: 'overseerr',
        name: 'Overseerr',
        displayName: 'Overseerr',
        status: 'up',
        responseTime: 100,
        lastCheckAt: new Date(),
        uptime: { '24h': 100, '7d': 100, '30d': 100 },
      },
    ];

    // Set initial data
    queryClient.setQueryData(['services', 'status'], initialServices);

    renderHook(() => useRealtimeStatus(), { wrapper });

    // Get the status update handler
    const statusHandler = vi
      .mocked(socketManager.on)
      .mock.calls.find((call) => call[0] === 'service:status')?.[1];

    // Simulate status update
    const update = {
      serviceId: 'plex',
      status: 'down' as const,
      responseTime: 0,
      timestamp: new Date().toISOString(),
      details: { error: 'Connection timeout' },
    };

    statusHandler?.(update);

    // Check if data was updated
    const updatedServices = queryClient.getQueryData<ServiceStatus[]>(['services', 'status']);
    expect(updatedServices?.[0].status).toBe('down');
    expect(updatedServices?.[0].responseTime).toBe(0);
    expect(updatedServices?.[0].details).toEqual({ error: 'Connection timeout' });

    // Check if animation trigger was set
    const animationData = queryClient.getQueryData(['service-update', 'plex']);
    expect(animationData).toEqual(update);
  });

  it('should handle bulk service updates', () => {
    renderHook(() => useRealtimeStatus(), { wrapper });

    // Get the bulk update handler
    const bulkHandler = vi
      .mocked(socketManager.on)
      .mock.calls.find((call) => call[0] === 'service:bulk-update')?.[1];

    // Simulate bulk update
    const bulkUpdate: ServiceStatus[] = [
      {
        id: 'plex',
        name: 'Plex',
        displayName: 'Plex Media Server',
        status: 'up',
        responseTime: 45,
        lastCheckAt: new Date(),
        uptime: { '24h': 99.9, '7d': 99.5, '30d': 99.0 },
      },
      {
        id: 'overseerr',
        name: 'Overseerr',
        displayName: 'Overseerr',
        status: 'degraded',
        responseTime: 500,
        lastCheckAt: new Date(),
        uptime: { '24h': 95, '7d': 97, '30d': 98 },
      },
    ];

    bulkHandler?.(bulkUpdate);

    // Check if data was updated
    const updatedServices = queryClient.getQueryData<ServiceStatus[]>(['services', 'status']);
    expect(updatedServices).toEqual(bulkUpdate);
  });

  it('should clear animation trigger after timeout', async () => {
    vi.useFakeTimers();

    renderHook(() => useRealtimeStatus(), { wrapper });

    const statusHandler = vi
      .mocked(socketManager.on)
      .mock.calls.find((call) => call[0] === 'service:status')?.[1];

    const update = {
      serviceId: 'plex',
      status: 'up' as const,
      timestamp: new Date().toISOString(),
    };

    statusHandler?.(update);

    // Animation data should be set
    expect(queryClient.getQueryData(['service-update', 'plex'])).toBeDefined();

    // Fast forward time
    vi.advanceTimersByTime(1000);

    // Animation data should be cleared
    await vi.waitFor(() => {
      expect(queryClient.getQueryData(['service-update', 'plex'])).toBeUndefined();
    });

    vi.useRealTimers();
  });

  it('should handle missing service in update', () => {
    const initialServices: ServiceStatus[] = [
      {
        id: 'plex',
        name: 'Plex',
        displayName: 'Plex Media Server',
        status: 'up',
        responseTime: 50,
        lastCheckAt: new Date(),
        uptime: { '24h': 99.9, '7d': 99.5, '30d': 99.0 },
      },
    ];

    queryClient.setQueryData(['services', 'status'], initialServices);

    renderHook(() => useRealtimeStatus(), { wrapper });

    const statusHandler = vi
      .mocked(socketManager.on)
      .mock.calls.find((call) => call[0] === 'service:status')?.[1];

    // Update for non-existent service
    const update = {
      serviceId: 'nonexistent',
      status: 'up' as const,
      timestamp: new Date().toISOString(),
    };

    statusHandler?.(update);

    // Should not crash and data should remain unchanged
    const services = queryClient.getQueryData<ServiceStatus[]>(['services', 'status']);
    expect(services).toHaveLength(1);
    expect(services?.[0].id).toBe('plex');
  });

  it('should unsubscribe from events on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeStatus(), { wrapper });

    unmount();

    expect(socketManager.off).toHaveBeenCalledWith('service:status', expect.any(Function));
    expect(socketManager.off).toHaveBeenCalledWith('service:bulk-update', expect.any(Function));
  });
});
