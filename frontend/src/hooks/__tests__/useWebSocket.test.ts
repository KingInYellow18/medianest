import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useWebSocket } from '../useWebSocket';

// Mock both socket managers
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

vi.mock('@/lib/enhanced-socket', () => {
  const mockSocket = {
    connected: false,
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };

  return {
    enhancedSocketManager: {
      connect: vi.fn(() => mockSocket),
      onStateChange: vi.fn((callback) => {
        // Return unsubscribe function
        return vi.fn();
      }),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      checkConnectionQuality: vi.fn(() => Promise.resolve('good')),
    },
    ConnectionState: {},
  };
});

describe('useWebSocket', () => {
  let mockSocket: any;
  let mockEnhancedSocketManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockSocket = {
      connected: false,
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    // Get the mocked enhanced socket manager
    const { enhancedSocketManager } = await import('@/lib/enhanced-socket');
    mockEnhancedSocketManager = enhancedSocketManager;

    vi.mocked(mockEnhancedSocketManager.connect).mockReturnValue(mockSocket);
    vi.mocked(mockEnhancedSocketManager.onStateChange).mockImplementation((callback) => {
      // Simulate initial state
      setTimeout(() => {
        callback({
          connected: false,
          connecting: false,
          quality: 'unknown',
          reconnectAttempt: 0,
        });
      }, 0);
      return vi.fn(); // unsubscribe function
    });
  });

  it('should initialize connection on mount', () => {
    renderHook(() => useWebSocket());

    expect(mockEnhancedSocketManager.connect).toHaveBeenCalled();
  });

  it('should subscribe to status updates when connected', () => {
    mockSocket.connected = true;
    vi.mocked(mockEnhancedSocketManager.connect).mockReturnValue(mockSocket);

    renderHook(() => useWebSocket());

    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:status');
  });

  it('should handle connection status updates', async () => {
    let stateCallback: any;
    vi.mocked(mockEnhancedSocketManager.onStateChange).mockImplementation((callback) => {
      stateCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useWebSocket());

    // Simulate connection state change
    await act(async () => {
      stateCallback({
        connected: true,
        connecting: false,
        quality: 'good',
        reconnectAttempt: 0,
      });
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionError).toBeNull();
  });

  it('should handle connection errors', async () => {
    let stateCallback: any;
    vi.mocked(mockEnhancedSocketManager.onStateChange).mockImplementation((callback) => {
      stateCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useWebSocket());

    // Simulate error state
    await act(async () => {
      stateCallback({
        connected: false,
        connecting: false,
        quality: 'poor',
        reconnectAttempt: 0,
        lastError: 'Connection failed',
      });
    });

    expect(result.current.connectionError).toBe('Connection failed');
  });

  it('should track reconnection attempts', async () => {
    let stateCallback: any;
    vi.mocked(mockEnhancedSocketManager.onStateChange).mockImplementation((callback) => {
      stateCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useWebSocket());

    await act(async () => {
      stateCallback({
        connected: false,
        connecting: true,
        quality: 'unknown',
        reconnectAttempt: 3,
      });
    });

    expect(result.current.reconnectAttempt).toBe(3);
  });

  it('should provide refreshService function', () => {
    const { result } = renderHook(() => useWebSocket());

    act(() => {
      result.current.refreshService('plex');
    });

    expect(mockEnhancedSocketManager.emit).toHaveBeenCalledWith('request:refresh', 'plex');
  });

  it('should provide reconnect function', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useWebSocket());

    act(() => {
      result.current.reconnect();
    });

    expect(mockEnhancedSocketManager.disconnect).toHaveBeenCalled();

    // Fast forward the timeout
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockEnhancedSocketManager.connect).toHaveBeenCalledTimes(2); // Initial + reconnect

    vi.useRealTimers();
  });

  it('should clean up on unmount', () => {
    mockSocket.connected = true;
    vi.mocked(mockEnhancedSocketManager.connect).mockReturnValue(mockSocket);

    const { unmount } = renderHook(() => useWebSocket());

    unmount();

    // Should unsubscribe
    expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:status');

    // Should remove event listeners
    expect(mockEnhancedSocketManager.off).toHaveBeenCalledWith('error', expect.any(Function));
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
