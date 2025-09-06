import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import io, { Socket } from 'socket.io-client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ServiceStatus } from '@/types/dashboard';

import { useServiceStatus } from '../useServiceStatus';

// Mock socket.io-client
vi.mock('socket.io-client');
const mockIo = io as unknown as ReturnType<typeof vi.fn>;

// Mock js-cookie
vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn(() => 'mock-jwt-token'),
  },
}));

// Mock fetch API for service status - PROVEN PATTERN
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useServiceStatus', () => {
  let mockSocket: Partial<Socket>;
  let queryClient: QueryClient;

  const initialServices: ServiceStatus[] = [
    {
      id: 'plex',
      name: 'Plex',
      displayName: 'Plex Media Server',
      status: 'up',
      responseTime: 100,
      lastCheckAt: new Date(),
      uptime: {
        '24h': 99.9,
        '7d': 99.5,
        '30d': 99.2,
      },
    },
  ];

  beforeEach(() => {
    // Setup mock socket
    mockSocket = {
      on: vi.fn((event, callback) => {
        // Auto-trigger connect event
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
        return mockSocket as Socket;
      }) as any,
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
    };

    (mockIo as any).mockReturnValue(mockSocket as Socket);

    // Setup query client
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Setup fetch mock - PROVEN PATTERN to prevent unhandled requests
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            services: [
              {
                id: 'plex',
                name: 'Plex',
                displayName: 'Plex Updated',
                status: 'up',
                responseTime: 120,
                lastCheckAt: new Date().toISOString(),
                uptimePercentage: 99.8,
                uptime: {
                  '24h': 99.8,
                  '7d': 99.5,
                  '30d': 99.2,
                },
              },
            ],
          },
        }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  it('initializes with provided services', async () => {
    const { result } = renderHook(() => useServiceStatus(initialServices), { wrapper });

    expect(result.current.services).toEqual(initialServices);

    // Wait for the connect event to fire and update the state
    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });
  });

  it('creates socket connection with authentication', () => {
    renderHook(() => useServiceStatus(initialServices), { wrapper });

    expect(mockIo).toHaveBeenCalledWith(process.env.NEXT_PUBLIC_BACKEND_URL, {
      auth: {
        token: 'mock-jwt-token',
      },
      transports: ['websocket', 'polling'],
    });
  });

  it('registers socket event listeners', () => {
    renderHook(() => useServiceStatus(initialServices), { wrapper });

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('service:status', expect.any(Function));
  });

  it('updates connection status on connect/disconnect', () => {
    const { result } = renderHook(() => useServiceStatus(initialServices), { wrapper });

    // Simulate disconnect
    const disconnectHandler = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
      ([event]) => event === 'disconnect',
    )?.[1];

    act(() => {
      disconnectHandler();
    });

    expect(result.current.connected).toBe(false);

    // Simulate reconnect
    const connectHandler = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
      ([event]) => event === 'connect',
    )?.[1];

    act(() => {
      connectHandler();
    });

    expect(result.current.connected).toBe(true);
  });

  it('updates service status on service:status event', () => {
    const { result } = renderHook(() => useServiceStatus(initialServices), { wrapper });

    const statusHandler = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
      ([event]) => event === 'service:status',
    )?.[1];

    const updatedService: ServiceStatus = {
      id: 'plex',
      name: 'Plex',
      displayName: 'Plex Media Server',
      status: 'down',
      responseTime: 0,
      lastCheckAt: new Date(),
      uptime: {
        '24h': 98.5,
        '7d': 98.0,
        '30d': 97.5,
      },
    };

    act(() => {
      statusHandler(updatedService);
    });

    expect(result.current.services[0]?.status).toBe('down');
    expect(result.current.services[0]?.uptime['24h']).toBe(98.5);
  });

  it('adds new service if not in list', () => {
    const { result } = renderHook(() => useServiceStatus(initialServices), { wrapper });

    const statusHandler = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls.find(
      ([event]) => event === 'service:status',
    )?.[1];

    const newService: ServiceStatus = {
      id: 'overseerr',
      name: 'Overseerr',
      displayName: 'Overseerr',
      status: 'up',
      responseTime: 200,
      lastCheckAt: new Date(),
      uptime: {
        '24h': 100,
        '7d': 100,
        '30d': 100,
      },
    };

    act(() => {
      statusHandler(newService);
    });

    expect(result.current.services).toHaveLength(2);
    expect(result.current.services[1]?.id).toBe('overseerr');
  });

  it('cleans up socket on unmount', () => {
    const { unmount } = renderHook(() => useServiceStatus(initialServices), { wrapper });

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('connect');
    expect(mockSocket.off).toHaveBeenCalledWith('disconnect');
    expect(mockSocket.off).toHaveBeenCalledWith('service:status');
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('fetches services periodically', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 'plex',
              name: 'Plex',
              displayName: 'Plex Updated',
              status: 'up',
              responseTime: 120,
              lastCheckAt: new Date().toISOString(),
              uptime: {
                '24h': 99.8,
                '7d': 99.5,
                '30d': 99.2,
              },
            },
          ]),
      } as unknown as Response),
    );
    global.fetch = mockFetch as any;

    renderHook(() => useServiceStatus(initialServices), { wrapper });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/services/status');
    });
  });
});
