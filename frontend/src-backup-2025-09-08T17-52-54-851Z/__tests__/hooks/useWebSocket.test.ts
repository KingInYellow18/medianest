import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWebSocket } from '../../hooks/useWebSocket';

// Mock enhanced socket manager
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  id: 'test-socket-id',
};

const mockEnhancedSocketManager = {
  connect: vi.fn(() => mockSocket),
  disconnect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  onStateChange: vi.fn(() => vi.fn()), // Returns unsubscribe function
  checkConnectionQuality: vi.fn(() => Promise.resolve('good')),
};

vi.mock('@/lib/enhanced-socket', () => ({
  enhancedSocketManager: mockEnhancedSocketManager,
  ConnectionState: {},
}));

vi.mock('@/lib/socket', () => ({
  socketManager: {
    connect: vi.fn(() => mockSocket),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    mockEnhancedSocketManager.onStateChange.mockReturnValue(vi.fn());
  });

  it('should initialize with default connection state', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(result.current.connectionState).toBeDefined();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionError).toBeNull();
    expect(typeof result.current.refreshService).toBe('function');
    expect(typeof result.current.reconnect).toBe('function');
    expect(typeof result.current.checkConnectionQuality).toBe('function');
  });

  it('should connect to enhanced socket manager', () => {
    renderHook(() => useWebSocket());

    expect(mockEnhancedSocketManager.connect).toHaveBeenCalledTimes(1);
    expect(mockEnhancedSocketManager.onStateChange).toHaveBeenCalledTimes(1);
  });

  it('should provide connection state properties', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(result.current).toHaveProperty('connectionState');
    expect(result.current).toHaveProperty('isConnected');
    expect(result.current).toHaveProperty('isConnecting');
    expect(result.current).toHaveProperty('connectionQuality');
    expect(result.current).toHaveProperty('latency');
    expect(result.current).toHaveProperty('connectionError');
    expect(result.current).toHaveProperty('reconnectAttempt');
  });

  it('should provide method functions', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(typeof result.current.refreshService).toBe('function');
    expect(typeof result.current.reconnect).toBe('function');
    expect(typeof result.current.checkConnectionQuality).toBe('function');
  });

  it('should call refreshService with correct parameters', () => {
    const { result } = renderHook(() => useWebSocket());

    act(() => {
      result.current.refreshService('test-service');
    });

    expect(mockEnhancedSocketManager.emit).toHaveBeenCalledWith('request:refresh', 'test-service');
  });

  it('should handle reconnect functionality', () => {
    const { result } = renderHook(() => useWebSocket());

    act(() => {
      result.current.reconnect();
    });

    expect(mockEnhancedSocketManager.disconnect).toHaveBeenCalledTimes(1);

    // Wait for setTimeout to complete
    vi.runAllTimers();

    expect(mockEnhancedSocketManager.connect).toHaveBeenCalledTimes(2); // Initial + reconnect
  });

  it('should check connection quality', async () => {
    const { result } = renderHook(() => useWebSocket());

    await act(async () => {
      const quality = await result.current.checkConnectionQuality();
      expect(quality).toBe('good');
    });

    expect(mockEnhancedSocketManager.checkConnectionQuality).toHaveBeenCalledTimes(1);
  });

  it('should handle connection state changes', () => {
    let stateChangeCallback: (state: any) => void = () => {};
    mockEnhancedSocketManager.onStateChange.mockImplementation((callback: (state: any) => void) => {
      stateChangeCallback = callback;
      return vi.fn(); // Return unsubscribe function
    });

    const { result } = renderHook(() => useWebSocket());

    const newState = {
      connected: true,
      connecting: false,
      quality: 'excellent' as const,
      reconnectAttempt: 0,
      latency: 50,
    };

    act(() => {
      stateChangeCallback(newState);
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionQuality).toBe('excellent');
  });

  it('should handle error states', () => {
    let stateChangeCallback: (state: any) => void = () => {};
    mockEnhancedSocketManager.onStateChange.mockImplementation((callback: (state: any) => void) => {
      stateChangeCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useWebSocket());

    const errorState = {
      connected: false,
      connecting: false,
      quality: 'poor' as const,
      reconnectAttempt: 3,
      lastError: 'Connection failed',
    };

    act(() => {
      stateChangeCallback(errorState);
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionError).toBe('Connection failed');
  });

  it('should subscribe to status updates when connected', () => {
    mockSocket.connected = true;
    renderHook(() => useWebSocket());

    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:status');
  });

  it('should cleanup on unmount', () => {
    const unsubscribe = vi.fn();
    mockEnhancedSocketManager.onStateChange.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useWebSocket());

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockEnhancedSocketManager.off).toHaveBeenCalled();
  });
});
