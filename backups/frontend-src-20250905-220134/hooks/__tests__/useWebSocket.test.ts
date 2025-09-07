import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { socketManager } from '@/lib/socket';

import { useWebSocket } from '../useWebSocket';

// Mock the socket manager
vi.mock('@/lib/socket', () => ({
  socketManager: {
    connect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(),
  },
}));

describe('useWebSocket', () => {
  let mockSocket: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSocket = {
      connected: false,
      on: vi.fn(),
      emit: vi.fn(),
    };

    vi.mocked(socketManager.connect).mockReturnValue(mockSocket);
  });

  it('should initialize connection on mount', () => {
    renderHook(() => useWebSocket());

    expect(socketManager.connect).toHaveBeenCalled();
  });

  it('should subscribe to status updates when connected', () => {
    mockSocket.connected = true;

    renderHook(() => useWebSocket());

    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:status');
  });

  it('should handle connection status updates', () => {
    const { result } = renderHook(() => useWebSocket());

    // Get the connection status handler
    const connectionHandler = vi
      .mocked(socketManager.on)
      .mock.calls.find((call) => call[0] === 'connection:status')?.[1];

    // Simulate connection
    act(() => {
      connectionHandler?.({ connected: true });
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionError).toBeNull();
  });

  it('should handle connection errors', () => {
    const { result } = renderHook(() => useWebSocket());

    // Get the error handler
    const errorHandler = vi
      .mocked(socketManager.on)
      .mock.calls.find((call) => call[0] === 'error')?.[1];

    // Simulate error
    act(() => {
      errorHandler?.({ message: 'Connection failed' });
    });

    expect(result.current.connectionError).toBe('Connection failed');
  });

  it('should track reconnection attempts', () => {
    const { result } = renderHook(() => useWebSocket());

    const connectionHandler = vi
      .mocked(socketManager.on)
      .mock.calls.find((call) => call[0] === 'connection:status')?.[1];

    act(() => {
      connectionHandler?.({ connected: false, reconnectAttempt: 3 });
    });

    expect(result.current.reconnectAttempt).toBe(3);
  });

  it('should provide refreshService function', () => {
    const { result } = renderHook(() => useWebSocket());

    act(() => {
      result.current.refreshService('plex');
    });

    expect(socketManager.emit).toHaveBeenCalledWith('request:refresh', 'plex');
  });

  it('should provide reconnect function', () => {
    const { result } = renderHook(() => useWebSocket());

    act(() => {
      result.current.reconnect();
    });

    expect(socketManager.disconnect).toHaveBeenCalled();
    expect(socketManager.connect).toHaveBeenCalledTimes(2); // Initial + reconnect
  });

  it('should clean up on unmount', () => {
    mockSocket.connected = true;
    const { unmount } = renderHook(() => useWebSocket());

    unmount();

    // Should unsubscribe
    expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:status');

    // Should remove event listeners
    expect(socketManager.off).toHaveBeenCalledWith('connection:status', expect.any(Function));
    expect(socketManager.off).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should subscribe on connect event', () => {
    renderHook(() => useWebSocket());

    // Get the connect handler
    const connectHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];

    // Trigger connect
    act(() => {
      connectHandler?.();
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:status');
  });
});
